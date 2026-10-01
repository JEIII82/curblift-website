import { createClient } from "npm:@supabase/supabase-js@2";

const ORG_ID = "00000000-0000-4000-8000-000000000001";
const ALLOWED = new Set([
  "https://www.rinsepoint.com",
  "https://rinsepoint.com",
  "https://curblift-website-git-rinsepoint-os-jojo-s-projects82.vercel.app",
]);

function cors(origin: string | null) {
  const o = origin && ALLOWED.has(origin) ? origin : "https://rinsepoint.com";
  return {
    "Access-Control-Allow-Origin": o,
    "Access-Control-Allow-Headers": "apikey, authorization, x-client-info, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    Vary: "Origin",
  };
}

function out(data: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(data), { status, headers: cors(origin) });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return out({ error: "Method not allowed" }, 405, origin);
  if (origin && !ALLOWED.has(origin)) return out({ error: "Origin not allowed" }, 403, origin);

  try {
    const body = await req.json();
    const action = String(body.action || "");
    const token = String(body.token || "").trim();
    if (!token) return out({ error: "Missing invoice token" }, 400, origin);

    const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    const serviceKey = keys.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: invoice } = await supabase
      .from("invoices")
      .select("id,invoice_number,status,total,amount_paid,amount_due,public_token,stripe_checkout_session_id,stripe_checkout_url,stripe_payment_status,customer_id,customer:customers(display_name,email,phone),job:jobs(title)")
      .eq("organization_id", ORG_ID)
      .eq("public_token", token)
      .maybeSingle();

    if (!invoice) return out({ error: "Invoice not found" }, 404, origin);

    const [{ data: integration }, { data: settings }] = await Promise.all([
      supabase
        .from("integration_settings")
        .select("make_events_webhook_url")
        .eq("organization_id", ORG_ID)
        .single(),
      supabase
        .from("organization_settings")
        .select("public_base_url")
        .eq("organization_id", ORG_ID)
        .single(),
    ]);

    if (!integration?.make_events_webhook_url) throw new Error("Payment automation is not configured");

    const publicBaseUrl = String(settings?.public_base_url || "https://rinsepoint.com").replace(/\/+$/, "");
    const returnOrigin = origin && ALLOWED.has(origin) ? origin : publicBaseUrl;

    if (action === "start") {
      if (invoice.status === "paid" || Number(invoice.amount_due) <= 0) return out({ error: "Invoice is already paid" }, 409, origin);
      if (invoice.status === "draft" || invoice.status === "void") return out({ error: "Invoice is not payable" }, 409, origin);

      if (invoice.stripe_checkout_url && invoice.stripe_payment_status === "unpaid") {
        return out({ checkoutUrl: invoice.stripe_checkout_url, sessionId: invoice.stripe_checkout_session_id, reused: true }, 200, origin);
      }

      const payload = {
        eventType: "payment.checkout_requested",
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_number,
        customerEmail: invoice.customer?.email || "",
        customerName: invoice.customer?.display_name || "",
        amountCents: Math.round(Number(invoice.amount_due || 0) * 100),
        amountDue: Number(invoice.amount_due || 0),
        service: invoice.job?.title || "RinsePoint Exterior Cleaning",
        successUrl: `${returnOrigin}/invoice/?token=${encodeURIComponent(token)}&payment=success`,
        cancelUrl: `${returnOrigin}/invoice/?token=${encodeURIComponent(token)}&payment=cancel`,
      };

      const response = await fetch(integration.make_events_webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok || !result?.checkoutUrl || !result?.sessionId) throw new Error("Unable to create checkout");

      await supabase.from("invoices").update({
        stripe_checkout_session_id: result.sessionId,
        stripe_checkout_url: result.checkoutUrl,
        stripe_payment_status: "unpaid",
      }).eq("id", invoice.id);

      return out({ checkoutUrl: result.checkoutUrl, sessionId: result.sessionId }, 200, origin);
    }

    if (action === "verify") {
      if (invoice.status === "paid") return out({ paid: true, invoiceStatus: "paid" }, 200, origin);
      if (!invoice.stripe_checkout_session_id) return out({ paid: false, invoiceStatus: invoice.status }, 200, origin);

      const response = await fetch(integration.make_events_webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "payment.verify_requested",
          sessionId: invoice.stripe_checkout_session_id,
        }),
      });
      const verified = await response.json();
      if (!response.ok) throw new Error("Unable to verify payment");

      if (verified.invoiceId !== invoice.id) throw new Error("Checkout session mismatch");

      await supabase.from("invoices").update({
        stripe_payment_intent_id: verified.paymentIntentId || null,
        stripe_payment_status: verified.paymentStatus || verified.status || "unknown",
      }).eq("id", invoice.id);

      const paid = verified.paymentStatus === "paid";
      if (!paid) return out({ paid: false, invoiceStatus: invoice.status, paymentStatus: verified.paymentStatus }, 200, origin);

      const amountCents = Number(verified.amountTotalCents || 0);
      const expectedCents = Math.round(Number(invoice.amount_due || 0) * 100);
      if (amountCents !== expectedCents) throw new Error("Payment amount does not match invoice balance");

      const paymentIntentId = String(verified.paymentIntentId || "");
      if (paymentIntentId) {
        const { data: existing } = await supabase
          .from("payments")
          .select("id")
          .eq("organization_id", ORG_ID)
          .eq("stripe_payment_intent_id", paymentIntentId)
          .maybeSingle();
        if (existing) return out({ paid: true, invoiceStatus: "paid" }, 200, origin);
      }

      const amount = amountCents / 100;
      const paidAt = new Date().toISOString();

      const { error: paymentError } = await supabase.from("payments").insert({
        organization_id: ORG_ID,
        invoice_id: invoice.id,
        customer_id: invoice.customer_id,
        amount,
        status: "succeeded",
        method: "card",
        provider: "stripe",
        paid_at: paidAt,
        stripe_checkout_session_id: invoice.stripe_checkout_session_id,
        stripe_payment_intent_id: paymentIntentId || null,
      });
      if (paymentError) throw paymentError;

      const newPaid = Math.round((Number(invoice.amount_paid || 0) + amount) * 100) / 100;
      const paidInFull = newPaid + 0.009 >= Number(invoice.total);

      const { data: updated, error: updateError } = await supabase
        .from("invoices")
        .update({
          amount_paid: newPaid,
          status: paidInFull ? "paid" : "partially_paid",
          paid_at: paidInFull ? paidAt : null,
          stripe_payment_status: "paid",
          stripe_payment_intent_id: paymentIntentId || null,
        })
        .eq("id", invoice.id)
        .select("status,amount_paid,amount_due,paid_at")
        .single();
      if (updateError) throw updateError;

      await supabase.from("activity_events").insert({
        organization_id: ORG_ID,
        customer_id: invoice.customer_id,
        actor_type: "system",
        entity_type: "invoice",
        entity_id: invoice.id,
        event_type: paidInFull ? "invoice.paid" : "invoice.payment_recorded",
        summary: paidInFull ? `Invoice #${invoice.invoice_number} paid through Stripe` : `Stripe payment recorded on invoice #${invoice.invoice_number}`,
        metadata: { amount, paymentIntentId, checkoutSessionId: invoice.stripe_checkout_session_id },
      });

      if (paidInFull) {
        const customerName = invoice.customer?.display_name || "";
        const customerFirstName = customerName.trim().split(/\\s+/)[0] || "there";
        const publicUrl = `${returnOrigin}/invoice/?token=${encodeURIComponent(token)}`;
        const eventPayload = {
          eventType: "invoice.paid",
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoice_number,
          customerName,
          customerFirstName,
          customerEmail: invoice.customer?.email || "",
          customerPhone: invoice.customer?.phone || "",
          service: invoice.job?.title || "RinsePoint Exterior Cleaning",
          total: Number(updated.amount_paid || 0),
          amountDue: Number(updated.amount_due || 0),
          publicUrl,
        };

        await supabase.from("automation_events").upsert({
          organization_id: ORG_ID,
          event_type: "invoice.paid",
          entity_type: "invoice",
          entity_id: invoice.id,
          payload: eventPayload,
          status: "pending",
          available_at: paidAt,
          dedupe_key: `invoice.paid:${invoice.id}`,
        }, { onConflict: "organization_id,dedupe_key" });

        try {
          await fetch(integration.make_events_webhook_url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(eventPayload),
          });
        } catch {
          // Payment stays recorded even if a notification provider is temporarily unavailable.
        }
      }

      return out({ paid: paidInFull, invoiceStatus: updated.status, amountPaid: updated.amount_paid, amountDue: updated.amount_due }, 200, origin);
    }

    return out({ error: "Unsupported action" }, 400, origin);
  } catch (error) {
    console.error(error);
    return out({ error: error instanceof Error ? error.message : "Payment request failed" }, 500, origin);
  }
});
