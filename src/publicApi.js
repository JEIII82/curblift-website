const SUPABASE_URL = "https://cfrdooivdzjuqsauhaqy.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_NJ4i8nPAhTCLhEgLZXha6A_Vgjf8-8U";

function headers(extra = {}) {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    ...extra,
  };
}

async function readJson(response) {
  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  if (!response.ok) {
    const message = payload?.msg || payload?.message || payload?.error_description || payload?.error || "Request failed";
    throw new Error(message);
  }
  return payload;
}

export async function getPublicQuote(token) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/quote-public?token=${encodeURIComponent(token)}`, {
    method: "GET",
    headers: headers(),
  });
  return readJson(response);
}

export async function publicQuoteAction(token, action, data = {}) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/quote-public`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ token, action, ...data }),
  });
  return readJson(response);
}

export async function getPublicInvoice(token) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/invoice-public?token=${encodeURIComponent(token)}`, {
    method: "GET",
    headers: headers(),
  });
  return readJson(response);
}

export async function publicInvoiceCheckout(token, action) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/invoice-checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, action }),
  });
  return readJson(response);
}
