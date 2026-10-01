import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BadgeDollarSign,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  FileText,
  Mail,
  MapPin,
  MessageSquareText,
  Pencil,
  Phone,
  ReceiptText,
  Search,
  Tag,
  UserRound,
  X,
} from "lucide-react";
import { getCustomers, getCustomerWorkspace, updateCustomer } from "./api.js";

function money(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value || 0));
}

function formatDate(value, withTime = false) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(new Date(value));
}

function titleCase(value) {
  if (!value) return "—";
  return String(value).replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function badgeClass(status) {
  if (["paid", "completed", "closed_won", "approved", "succeeded"].includes(status)) return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (["scheduled", "sent", "viewed"].includes(status)) return "bg-blue-50 text-blue-700 ring-blue-200";
  if (["in_progress", "on_my_way", "changes_requested", "partially_paid", "new"].includes(status)) return "bg-amber-50 text-amber-800 ring-amber-200";
  if (["cancelled", "declined", "closed_lost", "overdue"].includes(status)) return "bg-red-50 text-red-700 ring-red-200";
  return "bg-slate-100 text-slate-600 ring-slate-200";
}

function Badge({ status }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ring-1 ring-inset ${badgeClass(status)}`}>{titleCase(status)}</span>;
}

function Section({ title, subtitle, action, children }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
        <div>
          <h3 className="font-black text-slate-950">{title}</h3>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function RowButton({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-4 border-b border-slate-100 px-5 py-4 text-left transition last:border-b-0 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-cyan-500"
    >
      {children}
      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
    </button>
  );
}

function getNextAction({ leads, quotes, jobs, invoices }) {
  const draftInvoice = invoices.find((invoice) => invoice.status === "draft");
  if (draftInvoice) return {
    type: "invoice",
    id: draftInvoice.id,
    eyebrow: "Needs action",
    title: `Send Invoice #${draftInvoice.invoice_number}`,
    text: `${money(draftInvoice.total)} is ready to invoice.`,
    button: "Open invoice",
  };

  const collectInvoice = invoices.find((invoice) => ["sent", "partially_paid", "overdue"].includes(invoice.status) && Number(invoice.amount_due || 0) > 0);
  if (collectInvoice) return {
    type: "invoice",
    id: collectInvoice.id,
    eyebrow: collectInvoice.status === "overdue" ? "Overdue" : "Payment due",
    title: collectInvoice.status === "overdue" ? `Follow up on Invoice #${collectInvoice.invoice_number}` : `Collect payment on Invoice #${collectInvoice.invoice_number}`,
    text: `${money(collectInvoice.amount_due)} is still outstanding.`,
    button: "Open invoice",
  };

  const inProgress = jobs.find((job) => job.status === "in_progress");
  if (inProgress) return { type: "job", id: inProgress.id, eyebrow: "In progress", title: `Finish Job #${inProgress.job_number}`, text: "Record completion details and move this job to invoicing.", button: "Continue job" };

  const onMyWay = jobs.find((job) => job.status === "on_my_way");
  if (onMyWay) return { type: "job", id: onMyWay.id, eyebrow: "Field workflow", title: `Start Job #${onMyWay.job_number}`, text: "You already marked yourself on the way.", button: "Continue job" };

  const scheduled = jobs.find((job) => job.status === "scheduled");
  if (scheduled) return { type: "job", id: scheduled.id, eyebrow: "Upcoming work", title: `Job #${scheduled.job_number} is scheduled`, text: scheduled.scheduled_start ? `Service is set for ${formatDate(scheduled.scheduled_start, true)}.` : "The job is scheduled.", button: "Open job" };

  const unscheduled = jobs.find((job) => job.status === "unscheduled");
  if (unscheduled) return { type: "job", id: unscheduled.id, eyebrow: "Needs scheduling", title: `Schedule Job #${unscheduled.job_number}`, text: "The quote is approved. Pick a service date and arrival window.", button: "Schedule job" };

  const changesQuote = quotes.find((quote) => quote.status === "changes_requested");
  if (changesQuote) return { type: "quote", id: changesQuote.id, eyebrow: "Quote needs changes", title: `Update Quote #${changesQuote.quote_number}`, text: "The customer asked for changes.", button: "Open quote" };

  const openQuote = quotes.find((quote) => ["sent", "viewed"].includes(quote.status));
  if (openQuote) return { type: "quote", id: openQuote.id, eyebrow: "Waiting on customer", title: `Follow up on Quote #${openQuote.quote_number}`, text: openQuote.status === "viewed" ? "The customer viewed the quote but has not approved it yet." : "The quote is waiting for customer approval.", button: "Open quote" };

  const activeLead = leads.find((lead) => ["new", "contacted", "qualified", "quote_needed"].includes(lead.status));
  if (activeLead) return { type: "lead", lead: activeLead, eyebrow: "Lead needs action", title: activeLead.status === "new" ? "Create a quote" : "Continue this lead", text: activeLead.requested_service || "This request still needs action.", button: "Create quote" };

  return { type: "done", eyebrow: "Up to date", title: "Nothing needs action right now", text: "Completed work, billing, and history remain available below.", button: null };
}

function EditCustomer({ customer, onCancel, onSaved, session }) {
  const [form, setForm] = useState({
    first_name: customer.first_name || "",
    last_name: customer.last_name || "",
    company_name: customer.company_name || "",
    email: customer.email || "",
    phone: customer.phone || "",
    preferred_contact: customer.preferred_contact || "email",
    lead_source: customer.lead_source || "",
    tags: (customer.tags || []).join(", "),
    notes: customer.notes || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const updated = await updateCustomer(session, customer.id, {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        company_name: form.company_name.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        preferred_contact: form.preferred_contact,
        lead_source: form.lead_source.trim() || null,
        tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        notes: form.notes.trim() || null,
      });
      onSaved(updated);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="grid gap-4 p-5">
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-xs font-black uppercase tracking-wide text-slate-500">First name<input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-bold normal-case tracking-normal text-slate-900 outline-none focus:border-cyan-600" /></label>
        <label className="grid gap-1.5 text-xs font-black uppercase tracking-wide text-slate-500">Last name<input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-bold normal-case tracking-normal text-slate-900 outline-none focus:border-cyan-600" /></label>
        <label className="grid gap-1.5 text-xs font-black uppercase tracking-wide text-slate-500">Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-bold normal-case tracking-normal text-slate-900 outline-none focus:border-cyan-600" /></label>
        <label className="grid gap-1.5 text-xs font-black uppercase tracking-wide text-slate-500">Phone<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-bold normal-case tracking-normal text-slate-900 outline-none focus:border-cyan-600" /></label>
        <label className="grid gap-1.5 text-xs font-black uppercase tracking-wide text-slate-500">Company<input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-bold normal-case tracking-normal text-slate-900 outline-none focus:border-cyan-600" /></label>
        <label className="grid gap-1.5 text-xs font-black uppercase tracking-wide text-slate-500">Preferred contact<select value={form.preferred_contact} onChange={(e) => setForm({ ...form, preferred_contact: e.target.value })} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-bold normal-case tracking-normal text-slate-900 outline-none focus:border-cyan-600"><option value="email">Email</option><option value="phone">Phone</option><option value="sms">Text</option></select></label>
      </div>
      <label className="grid gap-1.5 text-xs font-black uppercase tracking-wide text-slate-500">Tags<input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="Residential, VIP, Repeat" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-bold normal-case tracking-normal text-slate-900 outline-none focus:border-cyan-600" /></label>
      <label className="grid gap-1.5 text-xs font-black uppercase tracking-wide text-slate-500">Internal notes<textarea rows="4" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm normal-case tracking-normal text-slate-900 outline-none focus:border-cyan-600" /></label>
      <div className="flex justify-end gap-2"><button type="button" onClick={onCancel} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-black text-slate-700">Cancel</button><button disabled={saving} className="rounded-xl bg-[#08243f] px-4 py-2.5 text-sm font-black text-white disabled:opacity-60">{saving ? "Saving…" : "Save customer"}</button></div>
    </form>
  );
}

function CustomerDetail({ session, customerId, onBack, onOpenQuote, onOpenJob, onOpenInvoice, onCreateQuote }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("overview");
  const [editing, setEditing] = useState(false);

  async function load() {
    const result = await getCustomerWorkspace(session, customerId);
    setData(result);
    return result;
  }

  useEffect(() => {
    let active = true;
    setData(null);
    setError("");
    getCustomerWorkspace(session, customerId).then((result) => active && setData(result)).catch((err) => active && setError(err.message));
    return () => { active = false; };
  }, [session, customerId]);

  if (error) return <div className="rounded-2xl border border-red-200 bg-red-50 p-5 font-bold text-red-700">{error}</div>;
  if (!data) return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm font-bold text-slate-500 shadow-sm">Loading customer…</div>;
  if (!data.customer) return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center font-bold text-slate-600">Customer not found.</div>;

  const { customer, properties, leads, quotes, jobs, invoices, payments, appointments, communications, tasks, reviews, activity } = data;
  const completedJobs = jobs.filter((job) => job.status === "completed").length;
  const paidTotal = payments.filter((payment) => payment.status === "succeeded").reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const openBalance = invoices.reduce((sum, invoice) => sum + Number(invoice.amount_due || 0), 0);
  const nextAction = getNextAction({ leads, quotes, jobs, invoices });
  const upcoming = appointments.filter((appointment) => appointment.starts_at && new Date(appointment.starts_at) >= new Date()).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  const primaryProperty = properties.find((property) => property.is_primary) || properties[0];

  function continueWorkflow() {
    if (nextAction.type === "invoice") onOpenInvoice?.(nextAction.id);
    if (nextAction.type === "job") onOpenJob?.(nextAction.id);
    if (nextAction.type === "quote") onOpenQuote?.(nextAction.id);
    if (nextAction.type === "lead") onCreateQuote?.({ ...nextAction.lead, customer });
  }

  const tabs = [["overview", "Overview"], ["work", "Work"], ["billing", "Billing"], ["activity", "Activity"]];

  return (
    <div className="grid gap-5">
      <button onClick={onBack} className="inline-flex w-fit items-center gap-2 text-sm font-black text-cyan-800"><ArrowLeft className="h-4 w-4" /> Customers</button>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-5 p-5 lg:flex-row lg:items-start">
          <div className="flex min-w-0 items-start gap-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#e9f6fb] text-cyan-800"><UserRound className="h-7 w-7" /></div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-3xl font-black text-slate-950">{customer.display_name || "Customer"}</h2>
                {(customer.tags || []).map((tag) => <span key={tag} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">{tag}</span>)}
              </div>
              <p className="mt-1 text-sm text-slate-500">{customer.company_name || (primaryProperty ? [primaryProperty.address_line1, primaryProperty.city].filter(Boolean).join(" · ") : "No service address yet")}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {customer.phone && <a href={`tel:${customer.phone}`} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-black text-slate-700"><Phone className="h-4 w-4" /> Call</a>}
                {customer.phone && <a href={`sms:${customer.phone}`} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-black text-slate-700"><MessageSquareText className="h-4 w-4" /> Text</a>}
                {customer.email && <a href={`mailto:${customer.email}`} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-black text-slate-700"><Mail className="h-4 w-4" /> Email</a>}
                <button onClick={() => setEditing(true)} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-black text-slate-700"><Pencil className="h-4 w-4" /> Edit</button>
              </div>
            </div>
          </div>

          <div className="grid min-w-[260px] grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-50 p-4"><p className="text-[11px] font-black uppercase tracking-[.14em] text-slate-400">Lifetime value</p><p className="mt-2 text-xl font-black text-slate-950">{money(paidTotal)}</p></div>
            <div className="rounded-xl bg-slate-50 p-4"><p className="text-[11px] font-black uppercase tracking-[.14em] text-slate-400">Open balance</p><p className="mt-2 text-xl font-black text-slate-950">{money(openBalance)}</p></div>
          </div>
        </div>

        <div className="flex gap-1 overflow-x-auto border-t border-slate-100 px-5 pt-2">
          {tabs.map(([id, label]) => <button key={id} onClick={() => setTab(id)} className={`border-b-2 px-4 py-3 text-sm font-black transition ${tab === id ? "border-cyan-700 text-cyan-800" : "border-transparent text-slate-500 hover:text-slate-900"}`}>{label}</button>)}
        </div>
      </section>

      {editing && (
        <Section title="Edit customer" subtitle="Keep the permanent customer profile current." action={<button onClick={() => setEditing(false)} className="text-slate-400"><X className="h-5 w-5" /></button>}>
          <EditCustomer customer={customer} session={session} onCancel={() => setEditing(false)} onSaved={async () => { setEditing(false); await load(); }} />
        </Section>
      )}

      {tab === "overview" && (
        <div className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
          <div className="grid content-start gap-5">
            <section className={`rounded-2xl border p-5 shadow-sm ${nextAction.type === "done" ? "border-emerald-200 bg-emerald-50" : "border-cyan-200 bg-cyan-50"}`}>
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div><p className={`text-xs font-black uppercase tracking-[.16em] ${nextAction.type === "done" ? "text-emerald-700" : "text-cyan-700"}`}>{nextAction.eyebrow}</p><h3 className="mt-2 text-xl font-black text-slate-950">{nextAction.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{nextAction.text}</p></div>
                {nextAction.button && <button onClick={continueWorkflow} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#08243f] px-5 py-3.5 text-sm font-black text-white">{nextAction.button}<ChevronRight className="h-4 w-4" /></button>}
              </div>
            </section>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-black uppercase tracking-[.14em] text-slate-400">Jobs</p><p className="mt-3 text-3xl font-black text-slate-950">{jobs.length}</p><p className="mt-2 text-sm text-slate-500">{completedJobs} completed</p></div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-black uppercase tracking-[.14em] text-slate-400">Quotes</p><p className="mt-3 text-3xl font-black text-slate-950">{quotes.length}</p><p className="mt-2 text-sm text-slate-500">{quotes.filter((quote) => quote.status === "approved").length} approved</p></div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-black uppercase tracking-[.14em] text-slate-400">Invoices</p><p className="mt-3 text-3xl font-black text-slate-950">{invoices.length}</p><p className="mt-2 text-sm text-slate-500">{invoices.filter((invoice) => invoice.status === "paid").length} paid</p></div>
            </div>

            <Section title="Upcoming schedule" subtitle="The next visits and appointments for this customer.">
              {upcoming.length ? upcoming.slice(0, 5).map((appointment) => (
                <RowButton key={appointment.id} onClick={() => appointment.job?.id && onOpenJob?.(appointment.job.id)}>
                  <div><div className="flex flex-wrap items-center gap-2"><p className="font-black text-slate-900">{appointment.job ? `Job #${appointment.job.job_number} · ${appointment.job.title}` : "Appointment"}</p><Badge status={appointment.status} /></div><p className="mt-1 text-sm text-slate-500">{formatDate(appointment.starts_at, true)}{appointment.ends_at ? ` – ${new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(appointment.ends_at))}` : ""}</p></div>
                </RowButton>
              )) : <div className="p-5 text-sm text-slate-500">No upcoming appointments.</div>}
            </Section>

            <Section title="Recent work" subtitle="The latest jobs, quotes, and invoices.">
              {[...jobs.slice(0, 2).map((item) => ({ kind: "job", date: item.created_at, item })), ...quotes.slice(0, 2).map((item) => ({ kind: "quote", date: item.created_at, item })), ...invoices.slice(0, 2).map((item) => ({ kind: "invoice", date: item.created_at, item }))].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5).map(({ kind, item }) => (
                <RowButton key={`${kind}-${item.id}`} onClick={() => kind === "job" ? onOpenJob?.(item.id) : kind === "quote" ? onOpenQuote?.(item.id) : onOpenInvoice?.(item.id)}>
                  <div><div className="flex flex-wrap items-center gap-2"><p className="font-black text-slate-900">{kind === "job" ? `Job #${item.job_number} · ${item.title}` : kind === "quote" ? `Quote #${item.quote_number} · ${item.title}` : `Invoice #${item.invoice_number}`}</p><Badge status={item.status} /></div><p className="mt-1 text-sm text-slate-500">{formatDate(item.created_at)}{kind === "invoice" ? ` · ${money(item.total)}` : kind === "quote" ? ` · ${money(item.total)}` : item.quoted_total ? ` · ${money(item.final_total ?? item.quoted_total)}` : ""}</p></div>
                </RowButton>
              ))}
            </Section>
          </div>

          <aside className="grid content-start gap-5">
            <Section title="Contact" action={<button onClick={() => setEditing(true)} className="text-xs font-black text-cyan-800">Edit</button>}>
              <div className="grid gap-4 p-5 text-sm">
                <div><p className="text-[11px] font-black uppercase tracking-[.14em] text-slate-400">Email</p><p className="mt-1 break-words font-bold text-slate-800">{customer.email || "No email on file"}</p></div>
                <div><p className="text-[11px] font-black uppercase tracking-[.14em] text-slate-400">Phone</p><p className="mt-1 font-bold text-slate-800">{customer.phone || "No phone on file"}</p></div>
                <div><p className="text-[11px] font-black uppercase tracking-[.14em] text-slate-400">Preferred contact</p><p className="mt-1 font-bold text-slate-800">{titleCase(customer.preferred_contact)}</p></div>
                <div><p className="text-[11px] font-black uppercase tracking-[.14em] text-slate-400">Lead source</p><p className="mt-1 font-bold text-slate-800">{titleCase(customer.lead_source)}</p></div>
              </div>
            </Section>

            <Section title="Properties" subtitle="Service locations for this customer.">
              <div className="divide-y divide-slate-100">
                {properties.length ? properties.map((property) => <div key={property.id} className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="font-black text-slate-900">{property.label || (property.is_primary ? "Primary property" : "Service property")}</p><p className="mt-1 text-sm leading-6 text-slate-500">{property.address_line1}{property.address_line2 ? `, ${property.address_line2}` : ""}<br />{property.city}, {property.state} {property.postal_code}</p></div>{property.is_primary && <span className="rounded-full bg-cyan-50 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-cyan-700">Primary</span>}</div>{(property.access_notes || property.property_notes) && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">{property.access_notes || property.property_notes}</p>}</div>) : <div className="p-5 text-sm text-slate-500">No property saved.</div>}
              </div>
              {primaryProperty && <div className="border-t border-slate-100 p-4"><a target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([primaryProperty.address_line1, primaryProperty.city, primaryProperty.state, primaryProperty.postal_code].filter(Boolean).join(", "))}`} className="inline-flex items-center gap-2 text-sm font-black text-cyan-800"><MapPin className="h-4 w-4" /> Directions ↗</a></div>}
            </Section>

            <Section title="Internal notes" action={<button onClick={() => setEditing(true)} className="text-xs font-black text-cyan-800">Edit</button>}>
              <div className="p-5 text-sm leading-6 text-slate-600">{customer.notes || "No customer-level notes yet."}</div>
            </Section>
          </aside>
        </div>
      )}

      {tab === "work" && (
        <div className="grid gap-5">
          <Section title="Jobs" subtitle="All scheduled, active, and completed work.">
            {jobs.length ? jobs.map((job) => <RowButton key={job.id} onClick={() => onOpenJob?.(job.id)}><div><div className="flex flex-wrap items-center gap-2"><p className="font-black text-slate-900">Job #{job.job_number} · {job.title}</p><Badge status={job.status} /></div><p className="mt-1 text-sm text-slate-500">{job.scheduled_start ? formatDate(job.scheduled_start, true) : "Not scheduled"} · {money(job.final_total ?? job.quoted_total)}</p></div></RowButton>) : <div className="p-5 text-sm text-slate-500">No jobs yet.</div>}
          </Section>
          <Section title="Quotes" subtitle="Estimate and approval history.">
            {quotes.length ? quotes.map((quote) => <RowButton key={quote.id} onClick={() => onOpenQuote?.(quote.id)}><div><div className="flex flex-wrap items-center gap-2"><p className="font-black text-slate-900">Quote #{quote.quote_number} · {quote.title}</p><Badge status={quote.status} /></div><p className="mt-1 text-sm text-slate-500">{formatDate(quote.created_at)} · {money(quote.total)}</p></div></RowButton>) : <div className="p-5 text-sm text-slate-500">No quotes yet.</div>}
          </Section>
          <Section title="Requests / leads" subtitle="Original requests stay available even after the work is won or completed.">
            {leads.length ? leads.map((lead) => <div key={lead.id} className="border-b border-slate-100 p-5 last:border-b-0"><div className="flex flex-wrap items-center gap-2"><p className="font-black text-slate-900">{lead.requested_service || "Service request"}</p><Badge status={lead.status} /></div><p className="mt-1 text-sm text-slate-500">Submitted {formatDate(lead.created_at, true)}{lead.submitted_name ? ` as ${lead.submitted_name}` : ""}</p>{lead.project_details && <p className="mt-3 text-sm leading-6 text-slate-600">{lead.project_details}</p>}</div>) : <div className="p-5 text-sm text-slate-500">No lead history.</div>}
          </Section>
        </div>
      )}

      {tab === "billing" && (
        <div className="grid gap-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><BadgeDollarSign className="h-5 w-5 text-cyan-700" /><p className="mt-4 text-xs font-black uppercase tracking-[.14em] text-slate-400">Lifetime paid</p><p className="mt-2 text-3xl font-black text-slate-950">{money(paidTotal)}</p></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><CircleDollarSign className="h-5 w-5 text-cyan-700" /><p className="mt-4 text-xs font-black uppercase tracking-[.14em] text-slate-400">Open balance</p><p className="mt-2 text-3xl font-black text-slate-950">{money(openBalance)}</p></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><ReceiptText className="h-5 w-5 text-cyan-700" /><p className="mt-4 text-xs font-black uppercase tracking-[.14em] text-slate-400">Invoices</p><p className="mt-2 text-3xl font-black text-slate-950">{invoices.length}</p></div>
          </div>
          <Section title="Invoices">
            {invoices.length ? invoices.map((invoice) => <RowButton key={invoice.id} onClick={() => onOpenInvoice?.(invoice.id)}><div><div className="flex flex-wrap items-center gap-2"><p className="font-black text-slate-900">Invoice #{invoice.invoice_number}</p><Badge status={invoice.status} /></div><p className="mt-1 text-sm text-slate-500">{money(invoice.total)} total · {money(invoice.amount_due)} due{invoice.due_at ? ` · Due ${formatDate(invoice.due_at)}` : ""}</p></div></RowButton>) : <div className="p-5 text-sm text-slate-500">No invoices yet.</div>}
          </Section>
          <Section title="Payments">
            {payments.length ? payments.map((payment) => <div key={payment.id} className="flex items-center justify-between gap-4 border-b border-slate-100 p-5 last:border-b-0"><div><p className="font-black text-slate-900">{money(payment.amount)}</p><p className="mt-1 text-sm text-slate-500">{titleCase(payment.method || payment.provider)} · {formatDate(payment.paid_at || payment.created_at, true)}</p></div><Badge status={payment.status} /></div>) : <div className="p-5 text-sm text-slate-500">No payments recorded.</div>}
          </Section>
        </div>
      )}

      {tab === "activity" && (
        <div className="grid gap-5 xl:grid-cols-2">
          <Section title="Communication" subtitle="Emails and texts tied to this customer.">
            {communications.length ? communications.map((item) => <div key={item.id} className="border-b border-slate-100 p-5 last:border-b-0"><div className="flex items-center justify-between gap-3"><p className="font-black text-slate-900">{titleCase(item.channel)} · {titleCase(item.direction)}</p><span className="text-xs text-slate-400">{formatDate(item.sent_at || item.received_at || item.created_at, true)}</span></div>{item.subject && <p className="mt-2 text-sm font-bold text-slate-700">{item.subject}</p>}<p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-500">{item.body || "No message body recorded."}</p></div>) : <div className="p-5 text-sm text-slate-500">No communication history yet.</div>}
          </Section>
          <Section title="Timeline" subtitle="Important activity across this customer's workflow.">
            {activity.length ? activity.slice(0, 30).map((event) => <div key={event.id} className="flex gap-3 border-b border-slate-100 p-5 last:border-b-0"><div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-cyan-600" /><div><p className="font-bold text-slate-800">{event.summary || titleCase(event.event_type)}</p><p className="mt-1 text-xs text-slate-400">{formatDate(event.created_at, true)}</p></div></div>) : <div className="p-5 text-sm text-slate-500">No activity recorded.</div>}
          </Section>
          <Section title="Tasks" subtitle="Follow-ups and operational reminders.">
            {tasks.length ? tasks.map((task) => <div key={task.id} className="flex items-start justify-between gap-4 border-b border-slate-100 p-5 last:border-b-0"><div><p className="font-black text-slate-900">{task.title}</p>{task.description && <p className="mt-1 text-sm text-slate-500">{task.description}</p>}<p className="mt-2 text-xs text-slate-400">{task.due_at ? `Due ${formatDate(task.due_at, true)}` : "No due date"}</p></div><Badge status={task.status} /></div>) : <div className="p-5 text-sm text-slate-500">No open tasks.</div>}
          </Section>
          <Section title="Reviews" subtitle="Review request and feedback history.">
            {reviews.length ? reviews.map((review) => <div key={review.id} className="flex items-center justify-between gap-4 border-b border-slate-100 p-5 last:border-b-0"><div><p className="font-black text-slate-900">{titleCase(review.platform)} review</p><p className="mt-1 text-sm text-slate-500">{review.received_at ? `Received ${formatDate(review.received_at)}` : review.requested_at ? `Requested ${formatDate(review.requested_at)}` : "Not requested yet"}</p></div><Badge status={review.status} /></div>) : <div className="p-5 text-sm text-slate-500">No review history.</div>}
          </Section>
        </div>
      )}
    </div>
  );
}

export default function CustomerPage({ session, initialCustomerId, onInitialCustomerHandled, onOpenQuote, onOpenJob, onOpenInvoice, onCreateQuote }) {
  const [rows, setRows] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { getCustomers(session).then(setRows).catch((err) => setError(err.message)); }, [session]);
  useEffect(() => { if (!initialCustomerId) return; setSelectedId(initialCustomerId); onInitialCustomerHandled?.(); }, [initialCustomerId, onInitialCustomerHandled]);

  const filtered = useMemo(() => (rows || []).filter((customer) => [customer.display_name, customer.company_name, customer.email, customer.phone, customer.lead_source, ...(customer.tags || [])].join(" ").toLowerCase().includes(query.toLowerCase())), [rows, query]);

  if (selectedId) return <CustomerDetail session={session} customerId={selectedId} onBack={() => setSelectedId(null)} onOpenQuote={onOpenQuote} onOpenJob={onOpenJob} onOpenInvoice={onOpenInvoice} onCreateQuote={onCreateQuote} />;
  if (error) return <div className="rounded-2xl border border-red-200 bg-red-50 p-5 font-bold text-red-700">{error}</div>;
  if (!rows) return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm font-bold text-slate-500 shadow-sm">Loading customers…</div>;

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <label className="relative block max-w-xl flex-1"><Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email, phone, tag…" className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-cyan-600" /></label>
        <div className="text-sm font-bold text-slate-500">{filtered.length} customer{filtered.length === 1 ? "" : "s"}</div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-[900px] w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-black uppercase tracking-[.12em] text-slate-400"><tr><th className="px-5 py-4">Customer</th><th className="px-5 py-4">Contact</th><th className="px-5 py-4">Tags</th><th className="px-5 py-4">Source</th><th className="px-5 py-4">Customer since</th><th className="w-12 px-5 py-4"></th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((customer) => (
              <tr key={customer.id} role="button" tabIndex={0} onClick={() => setSelectedId(customer.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelectedId(customer.id); }} className="cursor-pointer transition hover:bg-slate-50 focus:bg-cyan-50 focus:outline-none">
                <td className="px-5 py-4"><p className="font-black text-slate-900">{customer.display_name || "Customer"}</p>{customer.company_name && <p className="mt-1 text-xs text-slate-500">{customer.company_name}</p>}</td>
                <td className="px-5 py-4"><p className="text-slate-700">{customer.email || "No email"}</p><p className="mt-1 text-xs text-slate-500">{customer.phone || "No phone"}</p></td>
                <td className="px-5 py-4"><div className="flex flex-wrap gap-1">{(customer.tags || []).length ? customer.tags.map((tag) => <span key={tag} className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-600">{tag}</span>) : <span className="text-slate-400">—</span>}</div></td>
                <td className="px-5 py-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">{titleCase(customer.lead_source)}</span></td>
                <td className="px-5 py-4 text-slate-500">{formatDate(customer.created_at)}</td>
                <td className="px-5 py-4"><ChevronRight className="h-4 w-4 text-slate-300" /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && <div className="p-10 text-center"><p className="font-black text-slate-900">No matching customers</p><p className="mt-2 text-sm text-slate-500">Try a different search.</p></div>}
      </div>
    </div>
  );
}
