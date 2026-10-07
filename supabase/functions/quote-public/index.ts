import { createClient } from "npm:@supabase/supabase-js@2";

const ORG_ID = "00000000-0000-4000-8000-000000000001";
const ALLOWED_ORIGINS = new Set([
  "https://www.rinsepoint.com",
  "https://rinsepoint.com",
  "https://app.rinsepoint.com",
  "https://curblift-website-git-rinsepoint-os-jojo-s-projects82.vercel.app",
]);

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://www.rinsepoint.com";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

function stringArray(value: unknown, max = 100) {
  if (!Array.isArray(value)) return null;
  return value.map((item) => clean(item, max)).filter(Boolean);
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    if (origin && !ALLOWED_ORIGINS.has(origin)) return json({ error: "Origin not allowed" }, 403, origin);
    return new Response("ok", { headers: corsHeaders(origin) });
  }
  if (origin && !ALLOWED_ORIGINS.has(origin)) return json({ error: "Origin not allowed" }, 403, origin);

  try {
    const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    const secretKey = secretKeys.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!secretKey) throw new Error("Server configuration error");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const url = new URL(req.url);
    const token = clean(url.searchParams.get("token"), 100) || (req.method === "POST" ? clean((await req.clone().json()).token, 100) : "");
    if (!token) return json({ error: "Quote not found." }, 404, origin);

    const { data: quote } = await supabase
      .from("quotes")
      .select("id,quote_number,status,title,customer_message,subtotal,discount_amount,tax_amount,tax_rate,tax_exempt,total,expires_at,sent_at,viewed_at,approved_at,declined_at,public_token,customer_id,property_id,lead_id,selected_package_id,customer:customers(display_name),property:properties(address_line1,address_line2,city,state,postal_code),items:quote_items(id,service_id,package_id,name,description,quantity,unit_price,line_total,optional,selected,sort_order)")
      .eq("organization_id", ORG_ID)
      .eq("public_token", token)
      .single();

    if (!quote || quote.status === "draft") {
      return json({ error: "Quote not found." }, 404, origin);
    }

    if (quote.status === "cancelled") {
      return json({ error: "This quote has been cancelled. Contact RinsePoint if you would like an updated quote." }, 410, origin);
    }

    const { data: packageRows, error: packageError } = await supabase
      .from("quote_packages")
      .select("id,name,tier,description,is_recommended,sort_order")
      .eq("quote_id", quote.id)
      .eq("organization_id", ORG_ID)
      .order("sort_order", { ascending: true });
    if (packageError) throw packageError;

    const packages = packageRows || [];
    const sortedItems = (quote.items || []).sort((a: any, b: any) => a.sort_order - b.sort_order);

    if (quote.expires_at && new Date(quote.expires_at).getTime() < Date.now() && !["approved","declined"].includes(quote.status)) {
      await supabase.from("quotes").update({ status: "expired" }).eq("id", quote.id);
      quote.status = "expired";
    }

    if (req.method === "GET") {
      if (quote.status === "sent") {
        const viewedAt = quote.viewed_at || new Date().toISOString();
        await supabase.from("quotes").update({
          status: "viewed",
          viewed_at: viewedAt,
        }).eq("id", quote.id);
        quote.status = "viewed";
        quote.viewed_at = viewedAt;

        await supabase.from("activity_events").insert({
          organization_id: ORG_ID,
          actor_type: "customer",
          customer_id: quote.customer_id,
          entity_type: "quote",
          entity_id: quote.id,
          event_type: "quote.viewed",
          summary: `Quote #${quote.quote_number} viewed by customer`,
          metadata: {},
        });
      }

      const { data: organization } = await supabase
        .from("organizations")
        .select("name,phone,email,website")
        .eq("id", ORG_ID)
        .single();

      const enrichedPackages = packages.map((pkg: any) => ({
        ...pkg,
        items: sortedItems.filter((item: any) => item.package_id === pkg.id),
      }));

      return json({
        quote: {
          ...quote,
          items: sortedItems,
          packages: enrichedPackages,
          addOns: sortedItems.filter((item: any) => !item.package_id && item.optional),
          baseItems: sortedItems.filter((item: any) => !item.package_id && !item.optional),
        },
        organization,
      }, 200, origin);
    }

    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);
    const body = await req.json();
    const action = clean(body.action, 40);
    const approvalName = clean(body.name, 160);
    const message = clean(body.message, 2000);

    if (quote.status === "changes_requested") {
      return json({ error: "RinsePoint is preparing an updated quote. Approval will reopen when the revision is sent." }, 409, origin);
    }

    if (["approved","declined","expired"].includes(quote.status)) {
      return json({ error: "This quote is already closed." }, 409, origin);
    }

    if (action === "approve") {
      if (!approvalName) return json({ error: "Enter your name to approve the quote." }, 400, origin);
      if (!quote.property_id) return json({ error: "Service address is missing. Please contact RinsePoint." }, 409, origin);

      let selectedPackageId = quote.selected_package_id || null;
      const requestedPackageId = clean(body.packageId, 100) || null;

      if (packages.length) {
        selectedPackageId = requestedPackageId || selectedPackageId || packages.find((pkg: any) => pkg.is_recommended)?.id || packages[0]?.id || null;
        if (!selectedPackageId || !packages.some((pkg: any) => pkg.id === selectedPackageId)) {
          return json({ error: "Choose one of the available service packages before approving." }, 400, origin);
        }

        const { error: packageSelectError } = await supabase
          .from("quotes")
          .update({ selected_package_id: selectedPackageId })
          .eq("id", quote.id)
          .eq("organization_id", ORG_ID);
        if (packageSelectError) throw packageSelectError;
      }

      const requestedAddOns = stringArray(body.selectedAddOnIds);
      if (requestedAddOns) {
        const globalAddOns = sortedItems.filter((item: any) => !item.package_id && item.optional);
        const allowedIds = new Set(globalAddOns.map((item: any) => item.id));
        if (requestedAddOns.some((id) => !allowedIds.has(id))) {
          return json({ error: "One or more selected add-ons are not available for this quote." }, 400, origin);
        }

        if (globalAddOns.length) {
          const { error: resetAddOnError } = await supabase
            .from("quote_items")
            .update({ selected: false })
            .eq("quote_id", quote.id)
            .is("package_id", null)
            .eq("optional", true);
          if (resetAddOnError) throw resetAddOnError;
        }

        if (requestedAddOns.length) {
          const { error: chooseAddOnError } = await supabase
            .from("quote_items")
            .update({ selected: true })
            .eq("quote_id", quote.id)
            .is("package_id", null)
            .eq("optional", true)
            .in("id", requestedAddOns);
          if (chooseAddOnError) throw chooseAddOnError;
        }
      }

      const { data: refreshedQuote, error: refreshError } = await supabase
        .from("quotes")
        .select("id,total,subtotal,tax_amount,selected_package_id,items:quote_items(id,package_id,name,optional,selected,sort_order)")
        .eq("id", quote.id)
        .single();
      if (refreshError || !refreshedQuote) throw refreshError || new Error("Unable to refresh quote totals");

      const finalPackageId = refreshedQuote.selected_package_id || null;
      const finalItems = (refreshedQuote.items || [])
        .filter((item: any) => {
          const includedByScope = item.package_id ? item.package_id === finalPackageId : true;
          return includedByScope && (!item.optional || item.selected);
        })
        .sort((a: any, b: any) => a.sort_order - b.sort_order);
      const selectedPackage = packages.find((pkg: any) => pkg.id === finalPackageId) || null;

      const now = new Date().toISOString();
      const { error } = await supabase.from("quotes").update({
        status: "approved",
        approved_at: now,
        approval_name: approvalName,
      }).eq("id", quote.id);
      if (error) throw error;

      let jobId: string | null = null;
      const { data: existingJob } = await supabase.from("jobs").select("id").eq("quote_id", quote.id).maybeSingle();
      if (existingJob) {
        jobId = existingJob.id;
      } else {
        const scope = finalItems.map((item: any) => item.name).join(", ");
        const { data: job, error: jobError } = await supabase.from("jobs").insert({
          organization_id: ORG_ID,
          customer_id: quote.customer_id,
          property_id: quote.property_id,
          quote_id: quote.id,
          lead_id: quote.lead_id,
          status: "unscheduled",
          title: selectedPackage?.name || quote.title || "Exterior Cleaning",
          scope_of_work: scope || null,
          quoted_total: refreshedQuote.total,
          final_total: refreshedQuote.total,
        }).select("id").single();
        if (jobError) throw jobError;
        jobId = job.id;
      }

      await supabase.from("activity_events").insert({
        organization_id: ORG_ID,
        actor_type: "customer",
        customer_id: quote.customer_id,
        entity_type: "quote",
        entity_id: quote.id,
        event_type: "quote.approved",
        summary: `Quote #${quote.quote_number} approved by ${approvalName}`,
        metadata: {
          jobId,
          approvalName,
          selectedPackageId: finalPackageId,
          selectedPackageName: selectedPackage?.name || null,
          selectedAddOnIds: finalItems.filter((item: any) => !item.package_id && item.optional).map((item: any) => item.id),
          total: refreshedQuote.total,
        },
      });

      await supabase.from("automation_events").insert({
        organization_id: ORG_ID,
        event_type: "quote.approved",
        entity_type: "quote",
        entity_id: quote.id,
        payload: {
          quoteId: quote.id,
          quoteNumber: quote.quote_number,
          jobId,
          customerName: quote.customer?.display_name || "",
          total: refreshedQuote.total,
          approvalName,
          selectedPackageId: finalPackageId,
          selectedPackageName: selectedPackage?.name || null,
        },
        dedupe_key: `quote.approved:${quote.id}`,
      });

      return json({ ok: true, status: "approved", jobId, total: refreshedQuote.total, selectedPackageId: finalPackageId }, 200, origin);
    }

    if (action === "decline") {
      const now = new Date().toISOString();
      const { error } = await supabase.from("quotes").update({
        status: "declined",
        declined_at: now,
      }).eq("id", quote.id);
      if (error) throw error;

      await supabase.from("activity_events").insert({
        organization_id: ORG_ID,
        actor_type: "customer",
        customer_id: quote.customer_id,
        entity_type: "quote",
        entity_id: quote.id,
        event_type: "quote.declined",
        summary: `Quote #${quote.quote_number} declined`,
        metadata: { message },
      });

      await supabase.from("automation_events").insert({
        organization_id: ORG_ID,
        event_type: "quote.declined",
        entity_type: "quote",
        entity_id: quote.id,
        payload: { quoteId: quote.id, quoteNumber: quote.quote_number, message },
        dedupe_key: `quote.declined:${quote.id}`,
      });

      return json({ ok: true, status: "declined" }, 200, origin);
    }

    if (action === "request_changes") {
      if (!message) return json({ error: "Tell us what you would like changed." }, 400, origin);

      const { error } = await supabase.from("quotes").update({ status: "changes_requested" }).eq("id", quote.id);
      if (error) throw error;

      await supabase.from("activity_events").insert({
        organization_id: ORG_ID,
        actor_type: "customer",
        customer_id: quote.customer_id,
        entity_type: "quote",
        entity_id: quote.id,
        event_type: "quote.changes_requested",
        summary: `Changes requested on quote #${quote.quote_number}`,
        metadata: { message },
      });

      await supabase.from("tasks").insert({
        organization_id: ORG_ID,
        customer_id: quote.customer_id,
        quote_id: quote.id,
        title: `Review requested changes for quote #${quote.quote_number}`,
        description: message,
        priority: "high",
        status: "open",
      });

      await supabase.from("automation_events").insert({
        organization_id: ORG_ID,
        event_type: "quote.changes_requested",
        entity_type: "quote",
        entity_id: quote.id,
        payload: { quoteId: quote.id, quoteNumber: quote.quote_number, message },
        dedupe_key: `quote.changes_requested:${quote.id}:${Date.now()}`,
      });

      return json({ ok: true, status: "changes_requested" }, 200, origin);
    }

    return json({ error: "Unsupported action." }, 400, origin);
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Quote request failed." }, 500, origin);
  }
});
