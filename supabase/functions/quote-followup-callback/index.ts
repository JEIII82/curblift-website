import { createClient } from "npm:@supabase/supabase-js@2";

const ORG_ID = "00000000-0000-4000-8000-000000000001";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function clean(value: unknown, max = 4000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (req.headers.get("origin")) return json({ error: "Browser requests are not allowed" }, 403);

  try {
    const body = await req.json();
    const followUpId = clean(body.followUpId, 80);
    const deliveryToken = clean(body.deliveryToken, 80);
    const result = clean(body.result, 20).toLowerCase();
    if (!followUpId || !deliveryToken || !["sent","failed"].includes(result)) {
      return json({ error: "Invalid callback payload" }, 400);
    }

    const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    const secretKey = secretKeys.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!secretKey) throw new Error("Server configuration error");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: followUp } = await supabase
      .from("quote_follow_ups")
      .select("id,organization_id,quote_id,customer_id,lead_id,step,status,delivery_token,automation_event_id,quote:quotes(id,quote_number,status)")
      .eq("id", followUpId)
      .eq("organization_id", ORG_ID)
      .maybeSingle();

    if (!followUp || followUp.status !== "processing" || followUp.delivery_token !== deliveryToken) {
      return json({ ok: true, duplicateOrExpired: true }, 200);
    }

    if (result === "failed") {
      const error = clean(body.error, 2000) || "Delivery failed";
      if (followUp.automation_event_id) {
        await supabase.from("automation_events").update({
          status: "failed",
          last_error: error,
          processed_at: new Date().toISOString(),
        }).eq("id", followUp.automation_event_id);
      }
      const { data, error: rpcError } = await supabase.rpc("fail_quote_follow_up_step", {
        p_follow_up_id: followUpId,
        p_delivery_token: deliveryToken,
        p_error: error,
      });
      if (rpcError) throw rpcError;
      return json({ ok: true, followUp: data });
    }

    const provider = clean(body.provider, 80) || "gmail";
    const providerMessageId = clean(body.providerMessageId, 300) || null;
    const subject = clean(body.subject, 500) || `Following up on RinsePoint quote #${followUp.quote?.quote_number ?? ""}`;
    const messageBody = clean(body.body, 10000) || null;
    const now = new Date().toISOString();

    if (providerMessageId) {
      const { data: existing } = await supabase
        .from("communications")
        .select("id")
        .eq("provider", provider)
        .eq("provider_message_id", providerMessageId)
        .maybeSingle();
      if (!existing) {
        await supabase.from("communications").insert({
          organization_id: ORG_ID,
          customer_id: followUp.customer_id,
          lead_id: followUp.lead_id,
          quote_id: followUp.quote_id,
          channel: "email",
          direction: "outbound",
          subject,
          body: messageBody,
          status: "sent",
          provider,
          provider_message_id: providerMessageId,
          sent_at: now,
        });
      }
    } else {
      await supabase.from("communications").insert({
        organization_id: ORG_ID,
        customer_id: followUp.customer_id,
        lead_id: followUp.lead_id,
        quote_id: followUp.quote_id,
        channel: "email",
        direction: "outbound",
        subject,
        body: messageBody,
        status: "sent",
        provider,
        sent_at: now,
      });
    }

    await supabase.from("activity_events").insert({
      organization_id: ORG_ID,
      actor_type: "system",
      customer_id: followUp.customer_id,
      entity_type: "quote",
      entity_id: followUp.quote_id,
      event_type: "quote.followup_sent",
      summary: `Quote #${followUp.quote?.quote_number ?? ""} follow-up ${followUp.step} sent`,
      metadata: { step: followUp.step, provider, providerMessageId },
    });

    if (followUp.automation_event_id) {
      await supabase.from("automation_events").update({
        status: "completed",
        processed_at: now,
        last_error: null,
      }).eq("id", followUp.automation_event_id);
    }

    const { data, error: rpcError } = await supabase.rpc("complete_quote_follow_up_step", {
      p_follow_up_id: followUpId,
      p_delivery_token: deliveryToken,
    });
    if (rpcError) throw rpcError;

    return json({ ok: true, followUp: data });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Callback failed" }, 500);
  }
});
