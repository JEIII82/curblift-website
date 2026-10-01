export const LEAD_INTAKE_ENDPOINT =
  "https://cfrdooivdzjuqsauhaqy.supabase.co/functions/v1/lead-intake";

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function boolFromForm(value) {
  return value === "on" || value === "yes" || value === "true" || value === true;
}

export function collectLeadAttribution({
  href = globalThis.location?.href || "",
  referrer = globalThis.document?.referrer || "",
} = {}) {
  let url;
  try {
    url = new URL(href || "https://rinsepoint.com/");
  } catch {
    url = new URL("https://rinsepoint.com/");
  }

  const param = (name) => text(url.searchParams.get(name));

  return {
    landingPage: href || url.href,
    referrer: text(referrer),
    utmSource: param("utm_source"),
    utmMedium: param("utm_medium"),
    utmCampaign: param("utm_campaign"),
    utmContent: param("utm_content"),
    utmTerm: param("utm_term"),
    gclid: param("gclid"),
    fbclid: param("fbclid"),
  };
}

export function buildLeadIntakePayload(
  formData,
  {
    requestId = globalThis.crypto?.randomUUID?.() || `web-${Date.now()}`,
    submittedAt = new Date().toISOString(),
    attribution = collectLeadAttribution(),
  } = {},
) {
  const get = (name) => text(formData.get(name));
  const email = get("email");
  const smsConsent = boolFromForm(formData.get("smsConsent"));

  return {
    contractVersion: 1,
    name: get("name"),
    phone: get("phone"),
    email,
    addressLine1: get("addressLine1"),
    city: get("city"),
    state: get("state") || "TX",
    postalCode: get("postalCode"),
    service: get("service"),
    message: get("message"),
    package: get("package"),
    preferredContact: smsConsent ? "sms" : email ? "email" : "phone",
    smsConsent,
    website: get("website"),
    submittedAt,
    requestId,
    ...attribution,
  };
}

export async function submitLeadIntake(
  payload,
  {
    fetchImpl = globalThis.fetch,
    endpoint = LEAD_INTAKE_ENDPOINT,
  } = {},
) {
  if (typeof fetchImpl !== "function") {
    throw new Error("Quote request service is unavailable.");
  }

  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": payload.requestId,
    },
    body: JSON.stringify(payload),
    keepalive: true,
  });

  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok || !body?.ok) {
    throw new Error(body?.error || "We couldn't save your quote request. Please try again.");
  }

  return body;
}
