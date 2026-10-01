import { createClient } from "npm:@supabase/supabase-js@2";

const ORG_ID = "00000000-0000-4000-8000-000000000001";
const ALLOWED_ORIGINS = new Set([
  "https://www.rinsepoint.com",
  "https://rinsepoint.com",
  "https://curblift-website-git-rinsepoint-os-jojo-s-projects82.vercel.app",
]);

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://www.rinsepoint.com";
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

function clean(value: unknown, max = 3000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function money(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0;
}

function toE164(value: string) {
  const phone = value.replace(/\D/g, "");
  if (phone.length === 10) return "+1" + phone;
  if (phone.length === 11 && phone.startsWith("1")) return "+" + phone;
  return phone ? "+" + phone : "";
}

async function getPublicBaseUrl(supabase: any) {
  const { data } = await supabase
    .from("organization_settings")
    .select("public_base_url")
    .eq("organization_id", ORG_ID)
    .single();

  return String(data?.public_base_url || "https://rinsepoint.com").replace(/\/+$/, "");
}

async function sendEvent(supabase: any, eventType: string, payload: Record<string, unknown>) {
  const { data: integration } = await supabase
    .from("integration_settings")
    .select("make_events_webhook_url")
    .eq("organization_id", ORG_ID)
    .single();

  if (!integration?.make_events_webhook_url) return { delivered: false };

  try {
    const response = await fetch(integration.make_events_webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType, ...payload }),
    });
    return { delivered: response.ok, status: response.status };
  } catch {
    return { delivered: false };
  }
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

    const publicBaseUrl = await getPublicBaseUrl(supabase);
    const body = await req.json();
    const action = clean(body.action, 50);
    const invoiceId = clean(body.invoiceId, 80);
    if (!invoiceId) return json({ error: "Invoice ID is required." }, 400, origin);

    const { data: invoice } = await supabase
      .from("invoices")
      .select("*,customer:customers(id,display_name,email,phone,sms_consent_at,sms_opt_out_at),property:properties(id,address_line1,address_line2,city,state,postal_code),job:jobs(id,job_number,title),items:invoice_items(*)")
      .eq("id", invoiceId)
      .eq("organization_id", ORG_ID)
      .single();

    if (!invoice) return json({ error: "Invoice not found." }, 404, origin);

    const firstName = (invoice.customer?.display_name || "").trim().split(/\s+/)[0] || "there";
    const smsConsent = Boolean(invoice.customer?.sms_consent_at && !invoice.customer?.sms_opt_out_at);
    const smsToPhone = toE164(invoice.customer?.phone || "");

    if (action === "send") {
      if (!invoice.customer?.email) return json({ error: "Add a customer email before sending the invoice." }, 400, origin);
      if (invoice.status === "void") return json({ error: "A void invoice cannot be sent." }, 409, origin);

      const now = new Date().toISOString();
      const dueAt = invoice.due_at || new Date(Date.now() + 7 * 86400000).toISOString();

      const { data: sentInvoice, error: sendError } = await supabase
        .from("invoices")
        .update({
          status: Number(invoice.amount_due) <= 0 ? "paid" : "sent",
          sent_at: invoice.sent_at || now,
          due_at: dueAt,
        })
        .eq("id", invoiceId)
        .select("id,invoice_number,status,total,amount_paid,amount_due,due_at,public_token")
        .single();

      if (sendError) throw sendError;

      const { count } = await supabase
        .from("invoice_revisions")
        .select("id", { count: "exact", head: true })
        .eq("invoice_id", invoiceId);

      await supabase.from("invoice_revisions").insert({
        organization_id: ORG_ID,
        invoice_id: invoiceId,
        version_number: (count || 0) + 1,
        created_by: user.id,
        snapshot: {
          subtotal: invoice.subtotal,
          discount_amount: invoice.discount_amount,
          tax_amount: invoice.tax_amount,
          total: invoice.total,
          amount_paid: invoice.amount_paid,
          amount_due: invoice.amount_due,
          due_at: dueAt,
          customer: invoice.customer,
          property: invoice.property,
          job: invoice.job,
          items: invoice.items,
        },
      });

      const publicUrl = `${publicBaseUrl}/invoice/?token=${sentInvoice.public_token}`;

      await supabase.from("activity_events").insert({
        organization_id: ORG_ID,
        actor_user_id: user.id,
        actor_type: "user",
        customer_id: invoice.customer_id,
        entity_type: "invoice",
        entity_id: invoiceId,
        event_type: "invoice.sent",
        summary: `Invoice #${invoice.invoice_number} sent`,
        metadata: { total: invoice.total, amountDue: invoice.amount_due, publicUrl },
      });

      const payload = {
        invoiceId,
        invoiceNumber: invoice.invoice_number,
        customerName: invoice.customer?.display_name || "",
        customerFirstName: firstName,
        customerEmail: invoice.customer?.email || "",
        customerPhone: invoice.customer?.phone || "",
        smsConsent,
        smsToPhone,
        service: invoice.job?.title || "Exterior Cleaning",
        total: invoice.total,
        amountDue: invoice.amount_due,
        dueAt,
        publicUrl,
      };

      await supabase.from("automation_events").insert({
        organization_id: ORG_ID,
        event_type: "invoice.sent",
        entity_type: "invoice",
        entity_id: invoiceId,
        payload,
        dedupe_key: `invoice.sent:${invoiceId}:${(count || 0) + 1}`,
      });

      const delivery = await sendEvent(supabase, "invoice.sent", payload);

      return json({ ok: true, invoice: sentInvoice, publicUrl, delivery }, 200, origin);
    }

    if (action === "record_payment") {
      if (invoice.status === "void") return json({ error: "A void invoice cannot receive payment." }, 409, origin);

      const amount = money(body.amount);
      const method = clean(body.method, 30) || "other";
      const notes = clean(body.notes, 1000) || null;

      if (amount <= 0) return json({ error: "Payment amount must be greater than $0." }, 400, origin);
      if (amount > Number(invoice.amount_due) + 0.009) return json({ error: "Payment cannot exceed the amount due." }, 400, origin);

      const paidAt = new Date().toISOString();

      const { error: paymentError } = await supabase.from("payments").insert({
        organization_id: ORG_ID,
        invoice_id: invoiceId,
        customer_id: invoice.customer_id,
        amount,
        status: "succeeded",
        method,
        provider: "manual",
        paid_at: paidAt,
        notes,
      });
      if (paymentError) throw paymentError;

      const newPaid = Math.round((Number(invoice.amount_paid || 0) + amount) * 100) / 100;
      const isPaid = newPaid + 0.009 >= Number(invoice.total);

      const { data: updated, error: updateError } = await supabase
        .from("invoices")
        .update({
          amount_paid: newPaid,
          status: isPaid ? "paid" : "partially_paid",
          paid_at: isPaid ? paidAt : null,
        })
        .eq("id", invoiceId)
        .select("id,invoice_number,status,total,amount_paid,amount_due,paid_at")
        .single();
      if (updateError) throw updateError;

      await supabase.from("activity_events").insert({
        organization_id: ORG_ID,
        actor_user_id: user.id,
        actor_type: "user",
        customer_id: invoice.customer_id,
        entity_type: "invoice",
        entity_id: invoiceId,
        event_type: isPaid ? "invoice.paid" : "invoice.payment_recorded",
        summary: isPaid ? `Invoice #${invoice.invoice_number} paid` : `Payment recorded on invoice #${invoice.invoice_number}`,
        metadata: { amount, method, amountPaid: updated.amount_paid, amountDue: updated.amount_due },
      });

      if (isPaid) {
        const eventPayload = {
          invoiceId,
          invoiceNumber: invoice.invoice_number,
          customerName: invoice.customer?.display_name || "",
          customerFirstName: firstName,
          customerEmail: invoice.customer?.email || "",
          customerPhone: invoice.customer?.phone || "",
          smsConsent,
          smsToPhone,
          amountPaid: updated.amount_paid,
        };

        await supabase.from("automation_events").insert({
          organization_id: ORG_ID,
          event_type: "invoice.paid",
          entity_type: "invoice",
          entity_id: invoiceId,
          payload: eventPayload,
          dedupe_key: `invoice.paid:${invoiceId}`,
        });

        await sendEvent(supabase, "invoice.paid", eventPayload);
      }

      return json({ ok: true, invoice: updated }, 200, origin);
    }

    if (action === "void") {
      if (invoice.status === "paid") return json({ error: "Paid invoices should be refunded rather than voided." }, 409, origin);

      const { data: updated, error } = await supabase
        .from("invoices")
        .update({ status: "void" })
        .eq("id", invoiceId)
        .select("id,invoice_number,status")
        .single();
      if (error) throw error;

      await supabase.from("activity_events").insert({
        organization_id: ORG_ID,
        actor_user_id: user.id,
        actor_type: "user",
        customer_id: invoice.customer_id,
        entity_type: "invoice",
        entity_id: invoiceId,
        event_type: "invoice.voided",
        summary: `Invoice #${invoice.invoice_number} voided`,
        metadata: {},
      });

      return json({ ok: true, invoice: updated }, 200, origin);
    }

    return json({ error: "Unsupported action." }, 400, origin);
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Invoice operation failed." }, 500, origin);
  }
});
