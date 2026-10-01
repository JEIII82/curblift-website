import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BriefcaseBusiness,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  FileText,
  Mail,
  MapPin,
  Phone,
  ReceiptText,
  Search,
  UserRound,
} from "lucide-react";
import { getCustomers, getCustomerWorkspace } from "./api.js";

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
  if (["paid", "completed", "closed_won", "approved"].includes(status)) return "bg-emerald-50 text-emerald-700";
  if (["scheduled", "sent", "viewed"].includes(status)) return "bg-blue-50 text-blue-700";
  if (["in_progress", "on_my_way", "changes_requested", "partially_paid"].includes(status)) return "bg-amber-50 text-amber-800";
  if (["cancelled", "declined", "closed_lost", "overdue"].includes(status)) return "bg-red-50 text-red-700";
  return "bg-slate-100 text-slate-600";
}

function Badge({ status }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${badgeClass(status)}`}>{titleCase(status)}</span>;
}

function HistoryCard({ title, icon: Icon, count, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 p-5">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-cyan-700" />
          <h3 className="font-black text-slate-950">{title}</h3>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">{count}</span>
      </div>
      {children}
    </section>
  );
}

function ClickRow({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-4 border-b border-slate-100 p-5 text-left transition last:border-b-0 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-cyan-500"
    >
      {children}
      {onClick && <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />}
    </button>
  );
}

function CustomerDetail({ session, customerId, onBack, onOpenQuote, onOpenJob, onOpenInvoice }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setData(null);
    setError("");
    getCustomerWorkspace(session, customerId)
      .then((result) => active && setData(result))
      .catch((err) => active && setError(err.message));
    return () => { active = false; };
  }, [session, customerId]);

  if (error) return <div className="rounded-2xl border border-red-200 bg-red-50 p-5 font-bold text-red-700">{error}</div>;
  if (!data) return <p className="text-sm font-bold text-slate-500">Loading customer…</p>;
  if (!data.customer) return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center font-bold text-slate-600">Customer not found.</div>;

  const { customer, properties, leads, quotes, jobs, invoices, payments, activity } = data;
  const completedJobs = jobs.filter((job) => job.status === "completed").length;
  const paidTotal = payments.filter((p) => p.status === "succeeded").reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const openBalance = invoices.reduce((sum, invoice) => sum + Number(invoice.amount_due || 0), 0);
  const primaryProperty = properties.find((property) => property.is_primary) || properties[0];

  return (
    <div className="grid gap-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div>
          <button onClick={onBack} className="inline-flex items-center gap-2 text-sm font-extrabold text-cyan-800">
            <ArrowLeft className="h-4 w-4" /> Back to customers
          </button>
          <div className="mt-4 flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-50 text-cyan-800"><UserRound className="h-6 w-6" /></div>
            <div>
              <h2 className="text-3xl font-black text-slate-950">{customer.display_name || "Customer"}</h2>
              <p className="mt-1 text-sm text-slate-500">Customer since {formatDate(customer.created_at)}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {customer.phone && <a href={`tel:${customer.phone}`} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-700"><Phone className="h-4 w-4" /> Call</a>}
          {customer.email && <a href={`mailto:${customer.email}`} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-700"><Mail className="h-4 w-4" /> Email</a>}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Jobs", jobs.length, `${completedJobs} completed`],
          ["Quotes", quotes.length, quotes.some((q) => ["sent","viewed","changes_requested"].includes(q.status)) ? "Open quote activity" : "Quote history"],
          ["Paid", money(paidTotal), "Recorded payments"],
          ["Open balance", money(openBalance), openBalance > 0 ? "Still owed" : "Nothing due"],
        ].map(([label, value, note]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[.14em] text-slate-400">{label}</p>
            <p className="mt-3 text-3xl font-black text-slate-950">{value}</p>
            <p className="mt-2 text-sm text-slate-500">{note}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[.72fr_1.28fr]">
        <aside className="grid content-start gap-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-black text-slate-950">Contact</h3>
            <div className="mt-4 grid gap-3 text-sm">
              <div><p className="text-xs font-black uppercase tracking-[.12em] text-slate-400">Email</p><p className="mt-1 font-bold text-slate-800">{customer.email || "—"}</p></div>
              <div><p className="text-xs font-black uppercase tracking-[.12em] text-slate-400">Phone</p><p className="mt-1 font-bold text-slate-800">{customer.phone || "—"}</p></div>
              <div><p className="text-xs font-black uppercase tracking-[.12em] text-slate-400">Preferred contact</p><p className="mt-1 font-bold text-slate-800">{titleCase(customer.preferred_contact)}</p></div>
              <div><p className="text-xs font-black uppercase tracking-[.12em] text-slate-400">Lead source</p><p className="mt-1 font-bold text-slate-800">{titleCase(customer.lead_source)}</p></div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2"><MapPin className="h-5 w-5 text-cyan-700" /><h3 className="font-black text-slate-950">Properties</h3></div>
            <div className="mt-4 grid gap-3">
              {properties.length ? properties.map((property) => (
                <div key={property.id} className="rounded-xl bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3"><p className="font-black text-slate-900">{property.label || (property.is_primary ? "Primary property" : "Service property")}</p>{property.is_primary && <span className="text-[10px] font-black uppercase tracking-wide text-cyan-700">Primary</span>}</div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{property.address_line1}{property.address_line2 ? `, ${property.address_line2}` : ""}<br />{property.city}, {property.state} {property.postal_code}</p>
                </div>
              )) : <p className="text-sm text-slate-500">No saved properties.</p>}
            </div>
            {primaryProperty && <a target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([primaryProperty.address_line1, primaryProperty.city, primaryProperty.state, primaryProperty.postal_code].filter(Boolean).join(", "))}`} className="mt-4 inline-flex items-center gap-2 text-sm font-black text-cyan-800">Open primary address ↗</a>}
          </section>
        </aside>

        <section className="grid gap-6">
          <HistoryCard title="Jobs" icon={BriefcaseBusiness} count={jobs.length}>
            {jobs.length ? jobs.map((job) => (
              <ClickRow key={job.id} onClick={() => onOpenJob?.(job.id)}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><p className="font-black text-slate-900">Job #{job.job_number} · {job.title}</p><Badge status={job.status} /></div>
                  <p className="mt-1 text-sm text-slate-500">{job.lead?.submitted_name && job.lead.submitted_name !== customer.display_name ? `Submitted as ${job.lead.submitted_name} · ` : ""}{job.scheduled_start ? formatDate(job.scheduled_start, true) : "Not scheduled"} · {money(job.final_total ?? job.quoted_total)}</p>
                </div>
              </ClickRow>
            )) : <p className="p-5 text-sm text-slate-500">No jobs yet.</p>}
          </HistoryCard>

          <HistoryCard title="Quotes" icon={FileText} count={quotes.length}>
            {quotes.length ? quotes.map((quote) => (
              <ClickRow key={quote.id} onClick={() => onOpenQuote?.(quote.id)}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><p className="font-black text-slate-900">Quote #{quote.quote_number} · {quote.title}</p><Badge status={quote.status} /></div>
                  <p className="mt-1 text-sm text-slate-500">{quote.lead?.submitted_name && quote.lead.submitted_name !== customer.display_name ? `Submitted as ${quote.lead.submitted_name} · ` : ""}{formatDate(quote.created_at)} · {money(quote.total)}</p>
                </div>
              </ClickRow>
            )) : <p className="p-5 text-sm text-slate-500">No quotes yet.</p>}
          </HistoryCard>

          <HistoryCard title="Invoices" icon={ReceiptText} count={invoices.length}>
            {invoices.length ? invoices.map((invoice) => (
              <ClickRow key={invoice.id} onClick={() => onOpenInvoice?.(invoice.id)}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><p className="font-black text-slate-900">Invoice #{invoice.invoice_number}</p><Badge status={invoice.status} /></div>
                  <p className="mt-1 text-sm text-slate-500">{invoice.job?.lead?.submitted_name && invoice.job.lead.submitted_name !== customer.display_name ? `Submitted as ${invoice.job.lead.submitted_name} · ` : ""}{money(invoice.total)} total · {money(invoice.amount_due)} due</p>
                </div>
              </ClickRow>
            )) : <p className="p-5 text-sm text-slate-500">No invoices yet.</p>}
          </HistoryCard>

          <HistoryCard title="Lead history" icon={ClipboardList} count={leads.length}>
            {leads.length ? leads.map((lead) => (
              <div key={lead.id} className="border-b border-slate-100 p-5 last:border-b-0">
                <div className="flex flex-wrap items-center gap-2"><p className="font-black text-slate-900">{lead.submitted_name || customer.display_name}</p><Badge status={lead.status} /></div>
                <p className="mt-1 text-sm text-slate-500">{lead.requested_service || "Service not set"} · {formatDate(lead.created_at, true)}</p>
                {(lead.submitted_email || lead.submitted_phone) && <p className="mt-1 text-xs text-slate-400">{lead.submitted_email || "No email"} · {lead.submitted_phone || "No phone"}</p>}
              </div>
            )) : <p className="p-5 text-sm text-slate-500">No lead history.</p>}
          </HistoryCard>

          <HistoryCard title="Payments" icon={CircleDollarSign} count={payments.length}>
            {payments.length ? payments.map((payment) => (
              <div key={payment.id} className="flex items-center justify-between gap-4 border-b border-slate-100 p-5 last:border-b-0">
                <div><p className="font-black text-slate-900">{money(payment.amount)}</p><p className="mt-1 text-sm text-slate-500">{titleCase(payment.method || payment.provider)} · {formatDate(payment.paid_at || payment.created_at, true)}</p></div>
                <Badge status={payment.status} />
              </div>
            )) : <p className="p-5 text-sm text-slate-500">No payments recorded.</p>}
          </HistoryCard>

          <HistoryCard title="Activity" icon={CreditCard} count={activity.length}>
            {activity.length ? activity.slice(0, 20).map((event) => (
              <div key={event.id} className="border-b border-slate-100 p-5 last:border-b-0">
                <p className="font-bold text-slate-800">{event.summary || titleCase(event.event_type)}</p>
                <p className="mt-1 text-xs text-slate-400">{formatDate(event.created_at, true)}</p>
              </div>
            )) : <p className="p-5 text-sm text-slate-500">No activity recorded yet.</p>}
          </HistoryCard>
        </section>
      </div>
    </div>
  );
}

export default function CustomerPage({
  session,
  initialCustomerId,
  onInitialCustomerHandled,
  onOpenQuote,
  onOpenJob,
  onOpenInvoice,
}) {
  const [rows, setRows] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    getCustomers(session).then(setRows).catch((err) => setError(err.message));
  }, [session]);

  useEffect(() => {
    if (!initialCustomerId) return;
    setSelectedId(initialCustomerId);
    onInitialCustomerHandled?.();
  }, [initialCustomerId, onInitialCustomerHandled]);

  const filtered = useMemo(() => (rows || []).filter((customer) =>
    [customer.display_name, customer.email, customer.phone, customer.lead_source]
      .join(" ")
      .toLowerCase()
      .includes(query.toLowerCase())
  ), [rows, query]);

  if (selectedId) {
    return (
      <CustomerDetail
        session={session}
        customerId={selectedId}
        onBack={() => setSelectedId(null)}
        onOpenQuote={onOpenQuote}
        onOpenJob={onOpenJob}
        onOpenInvoice={onOpenInvoice}
      />
    );
  }

  if (error) return <div className="rounded-2xl border border-red-200 bg-red-50 p-5 font-bold text-red-700">{error}</div>;
  if (!rows) return <p className="text-sm font-bold text-slate-500">Loading customers…</p>;

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block max-w-md flex-1"><Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search customers…" className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-cyan-600" /></label>
        <p className="text-sm font-bold text-slate-500">{filtered.length} customer{filtered.length === 1 ? "" : "s"}</p>
      </div>

      {filtered.length ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-[800px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black uppercase tracking-[.12em] text-slate-400"><tr><th className="px-5 py-4">Customer</th><th className="px-5 py-4">Email</th><th className="px-5 py-4">Phone</th><th className="px-5 py-4">Source</th><th className="px-5 py-4">Customer since</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((customer) => (
                <tr
                  key={customer.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedId(customer.id)}
                  onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelectedId(customer.id); }}
                  className="cursor-pointer transition hover:bg-slate-50 focus:bg-cyan-50 focus:outline-none"
                >
                  <td className="px-5 py-4"><p className="font-black text-slate-900">{customer.display_name || "Customer"}</p><p className="mt-1 text-xs font-bold text-cyan-800">View full customer history →</p></td>
                  <td className="px-5 py-4 text-slate-600">{customer.email || "—"}</td>
                  <td className="px-5 py-4 text-slate-600">{customer.phone || "—"}</td>
                  <td className="px-5 py-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">{titleCase(customer.lead_source)}</span></td>
                  <td className="px-5 py-4 text-slate-500">{formatDate(customer.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><p className="font-black text-slate-900">No matching customers</p><p className="mt-2 text-sm text-slate-500">Try a different name, email, or phone number.</p></div>
      )}
    </div>
  );
}
