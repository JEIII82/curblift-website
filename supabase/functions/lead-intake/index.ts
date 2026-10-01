import { createClient } from "npm:@supabase/supabase-js@2";

const ORG_ID = "00000000-0000-4000-8000-000000000001";
const ALLOWED_ORIGINS = new Set([
  "https://www.rinsepoint.com",
  "https://rinsepoint.com",
]);

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://www.rinsepoint.com";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, idempotency-key",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(data: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

function cleanText(value: unknown, max = 1000) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

function normalizeState(value: string) {
  return value.trim().toUpperCase();
}

function normalizePostalCode(value: string) {
  return value.trim().toUpperCase();
}

function toE164(phone: string) {
  if (phone.length === 10) return "+1" + phone;
  if (phone.length === 11 && phone.startsWith("1")) return "+" + phone;
  return phone.startsWith("+") ? phone : "+" + phone;
}

function isTruthy(value: unknown) {
  return value === true || value === "true" || value === "yes" || value === "1" || value === "on";
}

function normalizedSubmittedAt(value: unknown) {
  const raw = cleanText(value, 100);
  if (!raw) return new Date().toISOString();
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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
    const body = await req.json();

    // Honeypot. Real customers never fill this.
    if (cleanText(body.website, 200)) return json({ ok: true }, 200, origin);

    const name = cleanText(body.name, 120);
    const phoneRaw = cleanText(body.phone, 40);
    const phone = normalizePhone(phoneRaw);
    const email = cleanText(body.email, 254).toLowerCase();

    const addressLine1 = cleanText(body.addressLine1, 200);
    const city = cleanText(body.city, 100);
    const state = normalizeState(cleanText(body.state, 40) || "TX");
    const postalCode = normalizePostalCode(cleanText(body.postalCode, 20));

    const service = cleanText(body.service, 160);
    const message = cleanText(body.message, 3000);
    const requestedPackage = cleanText(body.package, 160);

    const smsConsent = isTruthy(body.smsConsent);
    const preferredContactRaw = cleanText(body.preferredContact, 20).toLowerCase();
    const preferredContact = ["email", "phone", "sms"].includes(preferredContactRaw)
      ? preferredContactRaw
      : smsConsent
        ? "sms"
        : email
          ? "email"
          : "phone";

    const landingPage = cleanText(body.landingPage || body.pageUrl, 1000);
    const referrer = cleanText(body.referrer, 1000);
    const utmSource = cleanText(body.utmSource, 300);
    const utmMedium = cleanText(body.utmMedium, 300);
    const utmCampaign = cleanText(body.utmCampaign, 300);
    const utmContent = cleanText(body.utmContent, 300);
    const utmTerm = cleanText(body.utmTerm, 300);
    const gclid = cleanText(body.gclid, 500);
    const fbclid = cleanText(body.fbclid, 500);

    const submittedAt = normalizedSubmittedAt(body.submittedAt);
    const requestId = cleanText(
      body.requestId || req.headers.get("idempotency-key") || crypto.randomUUID(),
      120,
    );

    if (!name || !phone || !addressLine1 || !city || !postalCode || !service || !message || !requestId) {
      return json({ error: "Please complete all required quote-request fields." }, 400, origin);
    }
    if (phone.length < 10 || phone.length > 15) {
      return json({ error: "Please enter a valid phone number." }, 400, origin);
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: "Please enter a valid email address." }, 400, origin);
    }
    if (!/^[A-Z]{2}$/.test(state)) {
      return json({ error: "Please enter a valid two-letter state." }, 400, origin);
    }
    if (!/^\d{5}(-\d{4})?$/.test(postalCode)) {
      return json({ error: "Please enter a valid ZIP code." }, 400, origin);
    }
    if (preferredContact === "sms" && !smsConsent) {
      return json({ error: "SMS must be explicitly authorized before it can be the preferred contact method." }, 400, origin);
    }

    const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    const secretKey = secretKeys.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!secretKey) throw new Error("Server configuration error");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Rate-limit by a one-way hash of the requester IP.
    const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const ip = req.headers.get("cf-connecting-ip") || forwarded || "unknown";
    const ipHash = await sha256(ip);
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const { count: recentAttempts } = await supabase
      .from("lead_intake_attempts")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", ORG_ID)
      .eq("ip_hash", ipHash)
      .gte("created_at", since);

    if ((recentAttempts || 0) >= 10) {
      return json({ error: "Too many requests. Please try again shortly." }, 429, origin);
    }

    await supabase.from("lead_intake_attempts").insert({
      organization_id: ORG_ID,
      ip_hash: ipHash,
    });

    const intakePayload = {
      contractVersion: 1,
      name,
      phone,
      email,
      addressLine1,
      city,
      state,
      postalCode,
      service,
      message,
      package: requestedPackage,
      preferredContact,
      smsConsent,
      landingPage,
      referrer,
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
      utmTerm,
      gclid,
      fbclid,
      submittedAt,
      requestId,
    };

    // One database RPC owns the business transaction: customer/property/lead/task/events.
    const { data: intakeResult, error: intakeError } = await supabase.rpc("intake_website_lead", {
      p_payload: intakePayload,
    });

    if (intakeError) {
      console.error("lead intake transaction failed", intakeError);
      return json({ error: "We couldn't save your quote request. Please try again." }, 500, origin);
    }

    if (!intakeResult?.leadId) {
      throw new Error("Lead intake transaction returned no lead ID");
    }

    // Integrations are secondary. A Make failure never rolls back or hides CRM persistence.
    if (intakeResult.automationEventId) {
      const { data: integration } = await supabase
        .from("integration_settings")
        .select("make_lead_webhook_url")
        .eq("organization_id", ORG_ID)
        .single();

      if (integration?.make_lead_webhook_url) {
        const webhookPayload = {
          eventType: "lead.created",
          ...intakePayload,
          pageUrl: landingPage,
          leadSource: "Website",
          leadId: intakeResult.leadId,
          customerId: intakeResult.customerId,
          propertyId: intakeResult.propertyId,
          smsToPhone: toE164(phone),
          duplicateReviewRequired: Boolean(intakeResult.duplicateReviewRequired),
        };

        try {
          const makeResponse = await fetch(integration.make_lead_webhook_url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(webhookPayload),
            signal: AbortSignal.timeout(5000),
          });

          await supabase
            .from("automation_events")
            .update({
              status: makeResponse.ok ? "completed" : "failed",
              attempts: 1,
              processed_at: makeResponse.ok ? new Date().toISOString() : null,
              last_error: makeResponse.ok ? null : "Make returned HTTP " + makeResponse.status,
            })
            .eq("id", intakeResult.automationEventId);
        } catch (error) {
          await supabase
            .from("automation_events")
            .update({
              status: "failed",
              attempts: 1,
              last_error: error instanceof Error ? error.message : "Make delivery failed",
            })
            .eq("id", intakeResult.automationEventId);
        }
      }
    }

    return json({
      ok: true,
      leadId: intakeResult.leadId,
      duplicate: Boolean(intakeResult.duplicate),
      duplicateReviewRequired: Boolean(intakeResult.duplicateReviewRequired),
    }, intakeResult.duplicate ? 200 : 201, origin);
  } catch (error) {
    console.error(error);
    return json({ error: "We couldn't save your quote request. Please try again." }, 500, origin);
  }
});
