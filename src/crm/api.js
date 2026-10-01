const SUPABASE_URL = "https://cfrdooivdzjuqsauhaqy.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_NJ4i8nPAhTCLhEgLZXha6A_Vgjf8-8U";
export const ORGANIZATION_ID = "00000000-0000-4000-8000-000000000001";

const SESSION_KEY = "rinsepoint-os-session";

function headers(session, extra = {}) {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    ...extra,
  };
}

async function readJson(response) {
  const text = await response.text();
  let payload = null;
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

export function getStoredSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

function storeSession(session) {
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(SESSION_KEY);
  return session;
}

export async function signIn(email, password) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: headers(null, { "Content-Type": "application/json" }),
    body: JSON.stringify({ email, password }),
  });
  return storeSession(await readJson(response));
}

export async function signUp(email, password) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: headers(null, { "Content-Type": "application/json" }),
    body: JSON.stringify({ email, password }),
  });
  const payload = await readJson(response);
  if (payload?.access_token) storeSession(payload);
  return payload;
}

export async function refreshSession(session = getStoredSession()) {
  if (!session?.refresh_token) return null;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: headers(null, { "Content-Type": "application/json" }),
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  });
  return storeSession(await readJson(response));
}

export async function signOut(session = getStoredSession()) {
  if (session?.access_token) {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: "POST",
      headers: headers(session),
    }).catch(() => {});
  }
  storeSession(null);
}

export async function ensureFreshSession(session = getStoredSession()) {
  if (!session) return null;
  const expiresAt = session.expires_at || 0;
  if (expiresAt && expiresAt * 1000 - Date.now() < 5 * 60 * 1000) {
    try {
      return await refreshSession(session);
    } catch {
      storeSession(null);
      return null;
    }
  }
  return session;
}

export async function claimOwner(session) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/claim-owner`, {
    method: "POST",
    headers: headers(session, { "Content-Type": "application/json" }),
    body: "{}",
  });
  return readJson(response);
}

export async function rest(session, path, options = {}) {
  const fresh = await ensureFreshSession(session);
  if (!fresh) throw new Error("Your session expired. Please sign in again.");

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: headers(fresh, {
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=representation",
      ...(options.headers || {}),
    }),
  });
  return readJson(response);
}

export async function countRows(session, table, query = "") {
  const fresh = await ensureFreshSession(session);
  if (!fresh) throw new Error("Your session expired. Please sign in again.");

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=id${query ? `&${query}` : ""}`, {
    method: "HEAD",
    headers: headers(fresh, { Prefer: "count=exact" }),
  });

  if (!response.ok) await readJson(response);
  const range = response.headers.get("content-range") || "0/0";
  const total = range.split("/")[1];
  return total === "*" ? 0 : Number(total || 0);
}

export async function updateLeadStatus(session, leadId, status) {
  return rest(session, `leads?id=eq.${encodeURIComponent(leadId)}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function getDashboard(session) {
  const org = `organization_id=eq.${ORGANIZATION_ID}`;
  const [newLeads, openQuotes, scheduledJobs, unpaidInvoices, recentLeads] = await Promise.all([
    countRows(session, "leads", `${org}&status=eq.new`),
    countRows(session, "quotes", `${org}&status=in.(sent,viewed,changes_requested)`),
    countRows(session, "jobs", `${org}&status=in.(scheduled,on_my_way,in_progress)`),
    countRows(session, "invoices", `${org}&status=in.(sent,partially_paid,overdue)`),
    rest(session, `leads?select=id,status,requested_service,service_city,created_at,customer:customers(display_name,email,phone)&${org}&order=created_at.desc&limit=6`, { method: "GET" }),
  ]);
  return { newLeads, openQuotes, scheduledJobs, unpaidInvoices, recentLeads };
}

export function getLeads(session) {
  return rest(session, `leads?select=id,status,requested_service,service_city,project_details,created_at,customer:customers(display_name,email,phone)&organization_id=eq.${ORGANIZATION_ID}&order=created_at.desc&limit=200`, { method: "GET" });
}

export function getCustomers(session) {
  return rest(session, `customers?select=id,display_name,email,phone,lead_source,created_at&organization_id=eq.${ORGANIZATION_ID}&archived_at=is.null&order=created_at.desc&limit=200`, { method: "GET" });
}

export function getQuotes(session) {
  return rest(session, `quotes?select=id,quote_number,status,total,expires_at,created_at,customer:customers(display_name)&organization_id=eq.${ORGANIZATION_ID}&order=created_at.desc&limit=200`, { method: "GET" });
}

export function getJobs(session) {
  return rest(session, `jobs?select=id,job_number,title,status,scheduled_start,scheduled_end,final_total,customer:customers(display_name),property:properties(address_line1,city,state)&organization_id=eq.${ORGANIZATION_ID}&order=created_at.desc&limit=200`, { method: "GET" });
}

export function getAppointments(session) {
  return rest(session, `appointments?select=id,appointment_type,status,starts_at,ends_at,customer:customers(display_name),property:properties(address_line1,city,state)&organization_id=eq.${ORGANIZATION_ID}&order=starts_at.asc&limit=200`, { method: "GET" });
}

export function getInvoices(session) {
  return rest(session, `invoices?select=id,invoice_number,status,total,amount_paid,amount_due,due_at,created_at,customer:customers(display_name)&organization_id=eq.${ORGANIZATION_ID}&order=created_at.desc&limit=200`, { method: "GET" });
}

export function getServices(session) {
  return rest(session, `services?select=id,name,category,description,pricing_model,base_price,unit_price,unit_name,active,sort_order&organization_id=eq.${ORGANIZATION_ID}&order=sort_order.asc`, { method: "GET" });
}
