import { createClient } from "npm:@supabase/supabase-js@2";

const ORG_ID = "00000000-0000-4000-8000-000000000001";
const ALLOWED_ORIGINS = new Set([
  "https://www.rinsepoint.com",
  "https://rinsepoint.com",
  "https://app.rinsepoint.com",
  "https://curblift-website-git-rinsepoint-os-jojo-s-projects82.vercel.app",
]);
const MANUAL_STAGES = new Set(["new", "contacted", "qualified", "estimate_needed", "follow_up"]);

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://app.rinsepoint.com";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function json(data: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

function clean(value: unknown, max = 2000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    if (origin && !ALLOWED_ORIGINS.has(origin)) return json({ error: "Origin not allowed" }, 403, origin);
    return new Response("ok", { headers: corsHeaders(origin) });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);
  if (origin && !ALLOWED_ORIGINS.has(origin)) return json({ error: "Origin not allowed" }, 403, origin);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Unauthorized" }, 401, origin);

    const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    const secretKey = secretKeys.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!secretKey) throw new Error("Server configuration error");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    const user = userData.user;
    if (userError || !user) return json({ error: "Unauthorized" }, 401, origin);

    const { data: membership } = await supabase
      .from("memberships")
      .select("role,is_active")
      .eq("organization_id", ORG_ID)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership?.is_active) return json({ error: "Forbidden" }, 403, origin);

    const body = await req.json();
    const action = clean(body.action, 40);
    const leadId = clean(body.leadId, 80);
    if (!leadId) return json({ error: "Lead ID is required." }, 400, origin);

    const { data: lead } = await supabase
      .from("leads")
      .select("id,customer_id,stage,outcome,status,lost_reason")
      .eq("id", leadId)
      .eq("organization_id", ORG_ID)
      .maybeSingle();
    if (!lead) return json({ error: "Lead not found." }, 404, origin);

    if (action === "set_stage") {
      const stage = clean(body.stage, 40);
      if (!MANUAL_STAGES.has(stage)) return json({ error: "That stage is managed automatically or is not valid." }, 400, origin);
      if (lead.outcome !== "open") return json({ error: "Closed leads cannot change stage." }, 409, origin);

      const { data: updated, error } = await supabase.from("leads")
        .update({ stage, updated_at: new Date().toISOString() })
        .eq("id", leadId).eq("organization_id", ORG_ID)
        .select("id,status,stage,outcome,closed_at,lost_reason").single();
      if (error) throw error;

      if (stage !== lead.stage) await supabase.from("activity_events").insert({
        organization_id: ORG_ID, actor_user_id: user.id, actor_type: "user", customer_id: lead.customer_id,
        entity_type: "lead", entity_id: leadId, event_type: "lead.stage_changed",
        summary: `Lead stage changed to ${stage.replaceAll("_", " ")}`, metadata: { from: lead.stage, to: stage },
      });
      return json({ ok: true, lead: updated }, 200, origin);
    }

    if (action === "mark_lost" || action === "do_not_contact") {
      if (lead.outcome === "won") return json({ error: "Won leads cannot be closed this way." }, 409, origin);
      const reason = clean(body.reason, 1000);
      if (action === "mark_lost" && !reason) return json({ error: "Add a lost reason before closing this lead." }, 400, origin);

      const { data: openQuotes, error: quoteError } = await supabase.from("quotes")
        .select("id,quote_number,status").eq("organization_id", ORG_ID).eq("lead_id", leadId)
        .in("status", ["draft", "sent", "viewed", "changes_requested"]);
      if (quoteError) throw quoteError;

      if (openQuotes?.length) {
        const { error } = await supabase.from("quotes").update({ status: "cancelled" }).in("id", openQuotes.map((quote) => quote.id));
        if (error) throw error;
      }

      const outcome = action === "mark_lost" ? "lost" : "do_not_contact";
      const finalReason = reason || "Marked do not contact";
      const now = new Date().toISOString();
      const { data: updated, error } = await supabase.from("leads")
        .update({ outcome, lost_reason: finalReason, closed_at: now, updated_at: now })
        .eq("id", leadId).eq("organization_id", ORG_ID)
        .select("id,status,stage,outcome,closed_at,lost_reason").single();
      if (error) throw error;

      await supabase.from("tasks").update({ status: "completed", completed_at: now, updated_at: now })
        .eq("organization_id", ORG_ID).eq("lead_id", leadId).eq("status", "open");

      await supabase.from("activity_events").insert({
        organization_id: ORG_ID, actor_user_id: user.id, actor_type: "user", customer_id: lead.customer_id,
        entity_type: "lead", entity_id: leadId,
        event_type: outcome === "lost" ? "lead.lost" : "lead.do_not_contact",
        summary: outcome === "lost" ? "Lead marked lost" : "Lead marked do not contact",
        metadata: { reason: finalReason, cancelledQuotes: (openQuotes || []).map((quote) => ({ id: quote.id, quoteNumber: quote.quote_number })) },
      });
      return json({ ok: true, lead: updated, cancelledQuotes: openQuotes?.length || 0 }, 200, origin);
    }

    if (action === "reopen") {
      if (lead.outcome === "won") return json({ error: "Won leads cannot be reopened. Use the approved quote/job workflow instead." }, 409, origin);
      if (lead.outcome === "open") return json({ ok: true, lead }, 200, origin);

      const now = new Date().toISOString();
      const { data: updated, error } = await supabase.from("leads")
        .update({ outcome: "open", stage: "qualified", lost_reason: null, closed_at: null, updated_at: now })
        .eq("id", leadId).eq("organization_id", ORG_ID)
        .select("id,status,stage,outcome,closed_at,lost_reason").single();
      if (error) throw error;

      await supabase.from("activity_events").insert({
        organization_id: ORG_ID, actor_user_id: user.id, actor_type: "user", customer_id: lead.customer_id,
        entity_type: "lead", entity_id: leadId, event_type: "lead.reopened", summary: "Lead reopened",
        metadata: { previousOutcome: lead.outcome },
      });
      return json({ ok: true, lead: updated }, 200, origin);
    }

    if (action === "mark_won") return json({ error: "Won is controlled by quote approval. Approve the quote instead." }, 409, origin);
    return json({ error: "Unsupported action." }, 400, origin);
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Lead operation failed." }, 500, origin);
  }
});
