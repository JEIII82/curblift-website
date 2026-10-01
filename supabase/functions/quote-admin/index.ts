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

function text(value: unknown, max = 3000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function money(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0;
}

function quantity(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 1000) / 1000 : 1;
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
    const payload = await req.json();
    const action = text(payload.action, 40);

    if (action === "save") {
      const quoteId = text(payload.quoteId, 80) || null;
      const leadId = text(payload.leadId, 80) || null;
      let customerId = text(payload.customerId, 80);
      let propertyId = text(payload.propertyId, 80) || null;

      if (!customerId && leadId) {
        const { data: lead } = await supabase
          .from("leads")
          .select("customer_id,property_id")
          .eq("id", leadId)
          .eq("organization_id", ORG_ID)
          .single();
        customerId = lead?.customer_id || "";
        propertyId = propertyId || lead?.property_id || null;
      }

      if (!customerId) return json({ error: "A customer is required." }, 400, origin);

      const { data: customer } = await supabase
        .from("customers")
        .select("id")
        .eq("id", customerId)
        .eq("organization_id", ORG_ID)
        .single();

      if (!customer) return json({ error: "Customer not found." }, 404, origin);

      const property = payload.property || {};
      const addressLine1 = text(property.addressLine1, 200);
      const city = text(property.city, 100);

      if (!propertyId && addressLine1 && city) {
        const state = text(property.state, 40) || "TX";
        const postalCode = text(property.postalCode, 20) || null;

        const { data: existingProperty } = await supabase
          .from("properties")
          .select("id")
          .eq("organization_id", ORG_ID)
          .eq("customer_id", customerId)
          .ilike("address_line1", addressLine1)
          .ilike("city", city)
          .limit(1)
          .maybeSingle();

        if (existingProperty) {
          propertyId = existingProperty.id;
        } else {
          const { data: createdProperty, error: propertyError } = await supabase
            .from("properties")
            .insert({
              organization_id: ORG_ID,
              customer_id: customerId,
              label: text(property.label, 80) || "Primary",
              address_line1: addressLine1,
              address_line2: text(property.addressLine2, 120) || null,
              city,
              state,
              postal_code: postalCode,
              is_primary: Boolean(property.isPrimary ?? true),
            })
            .select("id")
            .single();
          if (propertyError) throw propertyError;
          propertyId = createdProperty.id;
        }
      }

      const items = Array.isArray(payload.items) ? payload.items : [];
      if (!items.length) return json({ error: "Add at least one quote item." }, 400, origin);

      const sanitizedItems = items
        .map((item: any, index: number) => ({
          service_id: text(item.serviceId, 80) || null,
          name: text(item.name, 200),
          description: text(item.description, 1200) || null,
          quantity: quantity(item.quantity),
          unit_price: money(item.unitPrice),
          optional: Boolean(item.optional),
          selected: item.optional ? Boolean(item.selected) : true,
          sort_order: index * 10,
        }))
        .filter((item: any) => item.name);

      if (!sanitizedItems.length) return json({ error: "Quote items need a name." }, 400, origin);

      const { data: taxSettings } = await supabase
        .from("organization_settings")
        .select("sales_tax_enabled,default_sales_tax_rate")
        .eq("organization_id", ORG_ID)
        .single();

      const requestedRate = Number(payload.taxRate);
      const taxRate = Number.isFinite(requestedRate) && requestedRate >= 0
        ? Math.round(requestedRate * 10000) / 10000
        : Number(taxSettings?.default_sales_tax_rate || 0);
      const taxExempt = !taxSettings?.sales_tax_enabled || Boolean(payload.taxExempt);

      const quoteValues = {
        organization_id: ORG_ID,
        customer_id: customerId,
        property_id: propertyId,
        lead_id: leadId,
        title: text(payload.title, 200) || "Exterior Cleaning",
        customer_message: text(payload.customerMessage, 3000) || null,
        internal_notes: text(payload.internalNotes, 3000) || null,
        discount_amount: money(payload.discountAmount),
        tax_rate: taxRate,
        tax_exempt: taxExempt,
        expires_at: payload.expiresAt || null,
      };

      let savedQuote: any;

      if (quoteId) {
        const { data: current } = await supabase
          .from("quotes")
          .select("id,status")
          .eq("id", quoteId)
          .eq("organization_id", ORG_ID)
          .single();

        if (!current) return json({ error: "Quote not found." }, 404, origin);
        if (["approved","declined","cancelled","expired"].includes(current.status)) {
          return json({ error: "This quote can no longer be edited." }, 409, origin);
        }

        const { data, error } = await supabase
          .from("quotes")
          .update(quoteValues)
          .eq("id", quoteId)
          .eq("organization_id", ORG_ID)
          .select("id,quote_number,status,public_token")
          .single();
        if (error) throw error;
        savedQuote = data;

        const { error: deleteError } = await supabase.from("quote_items").delete().eq("quote_id", quoteId);
        if (deleteError) throw deleteError;
      } else {
        const { data, error } = await supabase
          .from("quotes")
          .insert({ ...quoteValues, status: "draft", created_by: user.id })
          .select("id,quote_number,status,public_token")
          .single();
        if (error) throw error;
        savedQuote = data;
      }

      const { error: itemError } = await supabase.from("quote_items").insert(
        sanitizedItems.map((item: any) => ({ ...item, quote_id: savedQuote.id }))
      );
      if (itemError) throw itemError;

      const { data: finalQuote, error: finalError } = await supabase
        .from("quotes")
        .select("id,quote_number,status,subtotal,discount_amount,tax_amount,tax_rate,tax_exempt,total,expires_at,public_token,property_id")
        .eq("id", savedQuote.id)
        .single();
      if (finalError) throw finalError;

      await supabase.from("activity_events").insert({
        organization_id: ORG_ID,
        actor_user_id: user.id,
        actor_type: "user",
        customer_id: customerId,
        entity_type: "quote",
        entity_id: savedQuote.id,
        event_type: quoteId ? "quote.updated" : "quote.created",
        summary: quoteId ? `Quote #${savedQuote.quote_number} updated` : `Quote #${savedQuote.quote_number} created`,
        metadata: { leadId, total: finalQuote.total },
      });

      return json({
        ok: true,
        quote: finalQuote,
        publicUrl: `${publicBaseUrl}/quote/?token=${finalQuote.public_token}`,
      }, quoteId ? 200 : 201, origin);
    }

    if (action === "send") {
      const quoteId = text(payload.quoteId, 80);
      if (!quoteId) return json({ error: "Quote ID is required." }, 400, origin);

      const { data: quote } = await supabase
        .from("quotes")
        .select("*,customer:customers(id,display_name,email,phone,sms_consent_at,sms_opt_out_at),property:properties(id,address_line1,city,state,postal_code),items:quote_items(*)")
        .eq("id", quoteId)
        .eq("organization_id", ORG_ID)
        .single();

      if (!quote) return json({ error: "Quote not found." }, 404, origin);
      if (!quote.customer?.email) return json({ error: "Add a customer email before sending this quote." }, 400, origin);
      if (!quote.property_id || !quote.property?.address_line1) return json({ error: "Add the service address before sending this quote." }, 400, origin);
      if (!quote.items?.length) return json({ error: "Add at least one quote item before sending." }, 400, origin);

      const expiresAt = quote.expires_at || new Date(Date.now() + 14 * 86400000).toISOString();

      const { data: sentQuote, error: sendError } = await supabase
        .from("quotes")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          expires_at: expiresAt,
        })
        .eq("id", quoteId)
        .select("id,quote_number,status,total,public_token,expires_at")
        .single();
      if (sendError) throw sendError;

      const { count } = await supabase
        .from("quote_revisions")
        .select("id", { head: true, count: "exact" })
        .eq("quote_id", quoteId);

      await supabase.from("quote_revisions").insert({
        organization_id: ORG_ID,
        quote_id: quoteId,
        version_number: (count || 0) + 1,
        created_by: user.id,
        snapshot: {
          title: quote.title,
          customer_message: quote.customer_message,
          subtotal: quote.subtotal,
          discount_amount: quote.discount_amount,
          tax_amount: quote.tax_amount,
          tax_rate: quote.tax_rate,
          tax_exempt: quote.tax_exempt,
          total: quote.total,
          expires_at: expiresAt,
          customer: quote.customer,
          property: quote.property,
          items: quote.items,
        },
      });

      const publicUrl = `${publicBaseUrl}/quote/?token=${sentQuote.public_token}`;

      await supabase.from("activity_events").insert({
        organization_id: ORG_ID,
        actor_user_id: user.id,
        actor_type: "user",
        customer_id: quote.customer_id,
        entity_type: "quote",
        entity_id: quoteId,
        event_type: "quote.sent",
        summary: `Quote #${quote.quote_number} marked sent`,
        metadata: { total: quote.total, publicUrl },
      });

      const customerFirstName = (quote.customer.display_name || "").trim().split(/\\s+/)[0] || "there";
      const smsConsent = Boolean(quote.customer.sms_consent_at && !quote.customer.sms_opt_out_at);
      const smsToPhone = toE164(quote.customer.phone || "");

      const { data: automationEvent } = await supabase.from("automation_events").insert({
        organization_id: ORG_ID,
        event_type: "quote.sent",
        entity_type: "quote",
        entity_id: quoteId,
        payload: {
          quoteId,
          quoteNumber: quote.quote_number,
          customerName: quote.customer.display_name,
          customerFirstName,
          customerEmail: quote.customer.email,
          customerPhone: quote.customer.phone || "",
          smsConsent,
          smsToPhone,
          total: quote.total,
          expiresAt,
          publicUrl,
        },
        status: "pending",
        available_at: new Date().toISOString(),
        dedupe_key: `quote.sent:${quoteId}:${(count || 0) + 1}`,
      }).select("id").single();

      const { data: integration } = await supabase
        .from("integration_settings")
        .select("make_quote_webhook_url")
        .eq("organization_id", ORG_ID)
        .single();

      if (integration?.make_quote_webhook_url) {
        try {
          const delivery = await fetch(integration.make_quote_webhook_url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              eventType: "quote.sent",
              quoteId,
              quoteNumber: quote.quote_number,
              customerName: quote.customer.display_name,
              customerFirstName,
              customerEmail: quote.customer.email,
              customerPhone: quote.customer.phone || "",
              smsConsent,
              smsToPhone,
              total: quote.total,
              expiresAt,
              publicUrl,
            }),
          });

          if (automationEvent?.id) {
            await supabase.from("automation_events").update({
              status: delivery.ok ? "completed" : "failed",
              attempts: 1,
              processed_at: delivery.ok ? new Date().toISOString() : null,
              last_error: delivery.ok ? null : `Make returned HTTP ${delivery.status}`,
            }).eq("id", automationEvent.id);
          }

          if (!delivery.ok) {
            return json({ error: "Quote was saved, but the customer email could not be sent. Try again." }, 502, origin);
          }
        } catch (deliveryError) {
          if (automationEvent?.id) {
            await supabase.from("automation_events").update({
              status: "failed",
              attempts: 1,
              last_error: deliveryError instanceof Error ? deliveryError.message : "Make delivery failed",
            }).eq("id", automationEvent.id);
          }
          return json({ error: "Quote was saved, but the customer email could not be sent. Try again." }, 502, origin);
        }
      }

      return json({ ok: true, quote: sentQuote, publicUrl }, 200, origin);
    }

    return json({ error: "Unsupported action." }, 400, origin);
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Quote operation failed." }, 500, origin);
  }
});
