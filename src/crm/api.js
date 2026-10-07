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

export function getStoredSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

function storeSession(session) {
  if (session?.access_token && session.expires_in && !session.expires_at) {
    session = { ...session, expires_at: Math.floor(Date.now() / 1000) + Number(session.expires_in) };
  }
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
  const fresh = await ensureFreshSession(session);
  if (!fresh) throw new Error("Your session expired. Please sign in again.");

  const response = await fetch(`${SUPABASE_URL}/functions/v1/claim-owner`, {
    method: "POST",
    headers: headers(fresh, { "Content-Type": "application/json" }),
    body: "{}",
  });
  return { result: await readJson(response), session: fresh };
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

export async function leadAdmin(session, payload) {
  const fresh = await ensureFreshSession(session);
  if (!fresh) throw new Error("Your session expired. Please sign in again.");
  const response = await fetch(`${SUPABASE_URL}/functions/v1/lead-admin`, {
    method: "POST",
    headers: headers(fresh, { "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  return readJson(response);
}

export async function getDashboard(session) {
  const org = `organization_id=eq.${ORGANIZATION_ID}`;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [
    newLeads,
    openQuotes,
    activeJobs,
    unpaidInvoices,
    unscheduledJobs,
    draftInvoices,
    overdueInvoices,
    recentLeads,
    todayAppointments,
    actionQuotes,
    actionJobs,
    actionInvoices,
  ] = await Promise.all([
    countRows(session, "leads", `${org}&outcome=eq.open&stage=eq.new`),
    countRows(session, "quotes", `${org}&status=in.(sent,viewed,changes_requested)`),
    countRows(session, "jobs", `${org}&status=in.(scheduled,on_my_way,in_progress)`),
    countRows(session, "invoices", `${org}&status=in.(sent,partially_paid,overdue)`),
    countRows(session, "jobs", `${org}&status=eq.unscheduled`),
    countRows(session, "invoices", `${org}&status=eq.draft`),
    countRows(session, "invoices", `${org}&status=eq.overdue`),
    rest(session, `leads?select=id,status,stage,outcome,lost_reason,requested_service,service_city,submitted_name,submitted_email,submitted_phone,created_at,customer:customers!leads_customer_id_fkey(id,display_name,email,phone)&${org}&order=created_at.desc&limit=6`, { method: "GET" }),
    rest(session, `appointments?select=id,status,starts_at,ends_at,customer:customers(id,display_name),property:properties(address_line1,city,state),job:jobs(id,job_number,title,status)&${org}&starts_at=gte.${encodeURIComponent(today.toISOString())}&starts_at=lt.${encodeURIComponent(tomorrow.toISOString())}&order=starts_at.asc`, { method: "GET" }),
    rest(session, `quotes?select=id,quote_number,status,title,total,sent_at,viewed_at,customer:customers(id,display_name),lead:leads(id,submitted_name)&${org}&status=in.(sent,viewed,changes_requested)&order=updated_at.asc&limit=5`, { method: "GET" }),
    rest(session, `jobs?select=id,job_number,status,title,scheduled_start,quoted_total,customer:customers(id,display_name),lead:leads(id,submitted_name)&${org}&status=in.(unscheduled,scheduled,on_my_way,in_progress)&order=scheduled_start.asc.nullslast,created_at.asc&limit=6`, { method: "GET" }),
    rest(session, `invoices?select=id,invoice_number,status,total,amount_due,due_at,customer:customers(id,display_name),job:jobs(id,job_number,title,lead:leads(id,submitted_name))&${org}&status=in.(draft,sent,partially_paid,overdue)&order=due_at.asc.nullslast,created_at.asc&limit=6`, { method: "GET" }),
  ]);

  return {
    newLeads,
    openQuotes,
    activeJobs,
    unpaidInvoices,
    unscheduledJobs,
    draftInvoices,
    overdueInvoices,
    recentLeads,
    todayAppointments,
    actionQuotes,
    actionJobs,
    actionInvoices,
  };
}

export function getLeads(session) {
  return rest(session, `leads?select=id,status,stage,outcome,lost_reason,closed_at,requested_service,requested_package,service_city,service_state,project_details,property_id,submitted_name,submitted_email,submitted_phone,created_at,customer:customers!leads_customer_id_fkey(id,display_name,email,phone),property:properties(id,address_line1,address_line2,city,state,postal_code)&organization_id=eq.${ORGANIZATION_ID}&order=created_at.desc&limit=200`, { method: "GET" });
}

export function getCustomers(session) {
  return rest(session, `customers?select=id,display_name,company_name,email,phone,preferred_contact,tags,notes,lead_source,created_at&organization_id=eq.${ORGANIZATION_ID}&archived_at=is.null&order=updated_at.desc,created_at.desc&limit=200`, { method: "GET" });
}

export function updateCustomer(session, customerId, payload) {
  return rest(session, `customers?id=eq.${encodeURIComponent(customerId)}&organization_id=eq.${ORGANIZATION_ID}`, {
    method: "PATCH",
    body: JSON.stringify({ ...payload, updated_at: new Date().toISOString() }),
  }).then((rows) => rows?.[0] || null);
}

export async function getCustomerWorkspace(session, customerId) {
  const id = encodeURIComponent(customerId);
  const org = `organization_id=eq.${ORGANIZATION_ID}`;

  const [customerRows, properties, leads, quotes, jobs, invoices, payments, appointments, communications, tasks, reviews, activity] = await Promise.all([
    rest(session, `customers?select=id,display_name,first_name,last_name,company_name,email,phone,preferred_contact,tags,notes,lead_source,marketing_opt_in,sms_consent_at,sms_opt_out_at,sms_consent_source,created_at,updated_at&${org}&id=eq.${id}&limit=1`, { method: "GET" }),
    rest(session, `properties?select=id,label,address_line1,address_line2,city,state,postal_code,access_notes,property_notes,is_primary,created_at&${org}&customer_id=eq.${id}&archived_at=is.null&order=is_primary.desc,created_at.desc`, { method: "GET" }),
    rest(session, `leads?select=id,status,stage,outcome,lost_reason,requested_service,requested_package,project_details,service_city,service_state,submitted_name,submitted_email,submitted_phone,created_at,closed_at,property:properties(id,address_line1,city,state,postal_code)&${org}&customer_id=eq.${id}&order=created_at.desc`, { method: "GET" }),
    rest(session, `quotes?select=id,quote_number,status,title,total,subtotal,tax_amount,created_at,sent_at,viewed_at,approved_at,lead:leads(id,submitted_name,requested_service),property:properties(id,address_line1,city,state,postal_code),jobs(id,job_number,status)&${org}&customer_id=eq.${id}&order=created_at.desc`, { method: "GET" }),
    rest(session, `jobs?select=id,job_number,status,title,scope_of_work,quoted_total,final_total,scheduled_start,scheduled_end,actual_start,actual_end,completed_at,created_at,lead:leads(id,submitted_name,requested_service),property:properties(id,address_line1,city,state,postal_code)&${org}&customer_id=eq.${id}&order=created_at.desc`, { method: "GET" }),
    rest(session, `invoices?select=id,invoice_number,status,subtotal,tax_amount,total,amount_paid,amount_due,due_at,sent_at,paid_at,created_at,job:jobs(id,job_number,title,lead:leads(id,submitted_name,requested_service))&${org}&customer_id=eq.${id}&order=created_at.desc`, { method: "GET" }),
    rest(session, `payments?select=id,invoice_id,amount,status,method,provider,paid_at,created_at&${org}&customer_id=eq.${id}&order=paid_at.desc.nullslast,created_at.desc`, { method: "GET" }),
    rest(session, `appointments?select=id,job_id,status,starts_at,ends_at,arrival_window_minutes,notes,job:jobs(id,job_number,title,status)&${org}&customer_id=eq.${id}&order=starts_at.desc.nullslast,created_at.desc`, { method: "GET" }),
    rest(session, `communications?select=id,channel,direction,subject,body,status,provider,sent_at,received_at,created_at,lead_id,quote_id,job_id,invoice_id&${org}&customer_id=eq.${id}&order=created_at.desc&limit=100`, { method: "GET" }),
    rest(session, `tasks?select=id,title,description,status,priority,due_at,completed_at,lead_id,quote_id,job_id,invoice_id,created_at&${org}&customer_id=eq.${id}&order=due_at.asc.nullslast,created_at.desc&limit=100`, { method: "GET" }),
    rest(session, `reviews?select=id,status,platform,requested_at,received_at,rating,review_url,notes,job_id,created_at&${org}&customer_id=eq.${id}&order=created_at.desc`, { method: "GET" }),
    rest(session, `activity_events?select=id,event_type,summary,entity_type,entity_id,created_at,metadata&${org}&customer_id=eq.${id}&order=created_at.desc&limit=100`, { method: "GET" }),
  ]);

  return {
    customer: customerRows?.[0] || null,
    properties,
    leads,
    quotes,
    jobs,
    invoices,
    payments,
    appointments,
    communications,
    tasks,
    reviews,
    activity,
  };
}

export async function getSchedule(session, startIso, endIso) {
  const org = `organization_id=eq.${ORGANIZATION_ID}`;
  const start = encodeURIComponent(startIso);
  const end = encodeURIComponent(endIso);

  const [appointments, unscheduledJobs] = await Promise.all([
    rest(session, `appointments?select=id,status,appointment_type,starts_at,ends_at,arrival_window_minutes,notes,customer:customers(id,display_name,phone,email),property:properties(id,address_line1,city,state,postal_code),job:jobs(id,job_number,title,status)&${org}&starts_at=gte.${start}&starts_at=lt.${end}&order=starts_at.asc`, { method: "GET" }),
    rest(session, `jobs?select=id,job_number,title,status,quoted_total,created_at,customer:customers(id,display_name,phone,email),lead:leads(id,submitted_name,requested_service),property:properties(id,address_line1,city,state,postal_code)&${org}&status=eq.unscheduled&order=created_at.asc`, { method: "GET" }),
  ]);

  return { appointments, unscheduledJobs };
}

export function getQuotes(session) {
  return rest(session, `quotes?select=id,quote_number,status,title,subtotal,discount_amount,tax_amount,tax_rate,tax_exempt,total,expires_at,sent_at,viewed_at,approved_at,public_token,created_at,customer:customers(id,display_name,email,phone),lead:leads(id,submitted_name,submitted_email,submitted_phone,requested_service),jobs(id,job_number,status),property:properties(id,address_line1,city,state,postal_code)&organization_id=eq.${ORGANIZATION_ID}&order=created_at.desc&limit=200`, { method: "GET" });
}

export function getQuoteDetails(session, quoteId) {
  return rest(session, `quotes?select=id,quote_number,status,title,customer_message,internal_notes,subtotal,discount_amount,tax_amount,tax_rate,tax_exempt,total,expires_at,public_token,lead_id,customer_id,property_id,customer:customers(id,display_name,email,phone),lead:leads(id,submitted_name,submitted_email,submitted_phone,requested_service),property:properties(id,address_line1,address_line2,city,state,postal_code),items:quote_items(id,service_id,name,description,quantity,unit_price,line_total,optional,selected,sort_order)&organization_id=eq.${ORGANIZATION_ID}&id=eq.${encodeURIComponent(quoteId)}&limit=1`, { method: "GET" }).then((rows) => rows?.[0] || null);
}

export function getCustomerProperties(session, customerId) {
  return rest(session, `properties?select=id,label,address_line1,address_line2,city,state,postal_code,is_primary&organization_id=eq.${ORGANIZATION_ID}&customer_id=eq.${encodeURIComponent(customerId)}&archived_at=is.null&order=is_primary.desc,created_at.desc`, { method: "GET" });
}

export async function quoteAdmin(session, payload) {
  const fresh = await ensureFreshSession(session);
  if (!fresh) throw new Error("Your session expired. Please sign in again.");
  const response = await fetch(`${SUPABASE_URL}/functions/v1/quote-admin`, {
    method: "POST",
    headers: headers(fresh, { "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  return readJson(response);
}

export async function getPublicQuote(token) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/quote-public?token=${encodeURIComponent(token)}`, {
    method: "GET",
    headers: headers(null),
  });
  return readJson(response);
}

export async function publicQuoteAction(token, action, data = {}) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/quote-public`, {
    method: "POST",
    headers: headers(null, { "Content-Type": "application/json" }),
    body: JSON.stringify({ token, action, ...data }),
  });
  return readJson(response);
}

export function getJobs(session) {
  return rest(session, `jobs?select=id,job_number,title,status,scheduled_start,scheduled_end,arrival_window_minutes,quoted_total,final_total,completed_at,created_at,customer:customers(id,display_name,email,phone),lead:leads(id,submitted_name,submitted_email,submitted_phone,requested_service),property:properties(id,address_line1,address_line2,city,state,postal_code),quote:quotes(id,quote_number,total)&organization_id=eq.${ORGANIZATION_ID}&order=created_at.desc&limit=200`, { method: "GET" });
}

export function getJobDetails(session, jobId) {
  return rest(session, `jobs?select=id,job_number,title,status,scope_of_work,internal_notes,completion_notes,scheduled_start,scheduled_end,arrival_window_minutes,actual_start,actual_end,quoted_total,final_total,completed_at,created_at,customer_id,property_id,quote_id,lead_id,customer:customers(id,display_name,email,phone),lead:leads(id,submitted_name,submitted_email,submitted_phone,requested_service),property:properties(id,address_line1,address_line2,city,state,postal_code),quote:quotes(id,quote_number,total),appointments(id,status,starts_at,ends_at,arrival_window_minutes)&organization_id=eq.${ORGANIZATION_ID}&id=eq.${encodeURIComponent(jobId)}&limit=1`, { method: "GET" }).then((rows) => rows?.[0] || null);
}

export async function jobAdmin(session, payload) {
  const fresh = await ensureFreshSession(session);
  if (!fresh) throw new Error("Your session expired. Please sign in again.");
  const response = await fetch(`${SUPABASE_URL}/functions/v1/job-admin`, {
    method: "POST",
    headers: headers(fresh, { "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  return readJson(response);
}

export function getAppointments(session) {
  return rest(session, `appointments?select=id,appointment_type,status,starts_at,ends_at,customer:customers(display_name),property:properties(address_line1,city,state)&organization_id=eq.${ORGANIZATION_ID}&order=starts_at.asc&limit=200`, { method: "GET" });
}

export function getInvoices(session) {
  return rest(session, `invoices?select=id,invoice_number,status,total,amount_paid,amount_due,due_at,sent_at,paid_at,public_token,created_at,customer:customers(id,display_name,email,phone),property:properties(id,address_line1,city,state,postal_code),job:jobs(id,job_number,title,lead:leads(id,submitted_name,submitted_email,submitted_phone,requested_service))&organization_id=eq.${ORGANIZATION_ID}&order=created_at.desc&limit=200`, { method: "GET" });
}

export function getInvoiceDetails(session, invoiceId) {
  return rest(session, `invoices?select=id,invoice_number,status,subtotal,discount_amount,tax_amount,tax_rate,tax_exempt,total,amount_paid,amount_due,due_at,sent_at,paid_at,public_token,notes,customer_id,property_id,job_id,quote_id,customer:customers(id,display_name,email,phone),property:properties(id,address_line1,address_line2,city,state,postal_code),job:jobs(id,job_number,title,lead:leads(id,submitted_name,submitted_email,submitted_phone,requested_service)),items:invoice_items(id,service_id,name,description,quantity,unit_price,line_total,sort_order),payments(id,amount,status,method,paid_at,notes)&organization_id=eq.${ORGANIZATION_ID}&id=eq.${encodeURIComponent(invoiceId)}&limit=1`, { method: "GET" }).then((rows) => rows?.[0] || null);
}

export async function invoiceAdmin(session, payload) {
  const fresh = await ensureFreshSession(session);
  if (!fresh) throw new Error("Your session expired. Please sign in again.");
  const response = await fetch(`${SUPABASE_URL}/functions/v1/invoice-admin`, {
    method: "POST",
    headers: headers(fresh, { "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  return readJson(response);
}

export async function getPublicInvoice(token) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/invoice-public?token=${encodeURIComponent(token)}`, {
    method: "GET",
    headers: headers(null),
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

export function getServices(session) {
  return rest(session, `services?select=id,name,category,description,pricing_model,base_price,unit_price,unit_name,active,sort_order&organization_id=eq.${ORGANIZATION_ID}&order=sort_order.asc`, { method: "GET" });
}
