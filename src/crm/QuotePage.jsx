import { useEffect, useMemo, useState } from "react";
import { Copy, FilePlus2, Loader2, Plus, Save, Send, Trash2 } from "lucide-react";
import {
  getCustomerProperties,
  getCustomers,
  getQuoteDetails,
  getQuotes,
  getServices,
  quoteAdmin,
} from "./api.js";

function money(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value || 0));
}

function dateInput(days = 14) {
  const date = new Date(Date.now() + days * 86400000);
  return date.toISOString().slice(0, 10);
}

function statusLabel(status) {
  return {
    draft: "Draft",
    sent: "Sent",
    viewed: "Viewed",
    changes_requested: "Changes Requested",
    approved: "Approved",
    declined: "Declined",
    expired: "Expired",
    cancelled: "Cancelled",
  }[status] || status;
}

function newLine(service = null) {
  return {
    localId: crypto.randomUUID(),
    serviceId: service?.id || "",
    name: service?.name || "",
    description: service?.description || "",
    quantity: 1,
    unitPrice: service?.base_price ?? "",
    optional: false,
    selected: true,
  };
}

function publicLink(token) {
  return `${window.location.origin}/quote/?token=${token}`;
}

function QuoteBuilder({ session, customers, services, lead, quoteId, onClose, onSaved }) {
  const [loading, setLoading] = useState(Boolean(quoteId));
  const [saving, setSaving] = useState(false);
  const [properties, setProperties] = useState([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [savedQuote, setSavedQuote] = useState(null);
  const [form, setForm] = useState({
    customerId: lead?.customer?.id || "",
    propertyId: lead?.property?.id || "",
    leadId: lead?.id || "",
    title: lead?.requested_service || "Exterior Cleaning",
    customerMessage: "Thanks for the opportunity to quote your project. The scope and pricing below reflect the work discussed.",
    internalNotes: lead?.project_details || "",
    discountAmount: "",
    taxRate: "8.25",
    taxExempt: false,
    expiresAt: dateInput(14),
    addressLine1: lead?.property?.address_line1 || "",
    addressLine2: lead?.property?.address_line2 || "",
    city: lead?.property?.city || lead?.service_city || "",
    state: lead?.property?.state || lead?.service_state || "TX",
    postalCode: lead?.property?.postal_code || "",
    items: [],
  });

  useEffect(() => {
    if (!services.length || form.items.length || quoteId) return;
    const wanted = (lead?.requested_service || "").toLowerCase();
    const match = services.find((service) => {
      const name = service.name.toLowerCase();
      return wanted && (name.includes(wanted) || wanted.includes(name.split(" / ")[0]));
    });
    if (match) setForm((current) => ({ ...current, items: [newLine(match)] }));
  }, [services, lead, quoteId, form.items.length]);

  useEffect(() => {
    if (!form.customerId) {
      setProperties([]);
      return;
    }
    getCustomerProperties(session, form.customerId).then(setProperties).catch(() => setProperties([]));
  }, [session, form.customerId]);

  useEffect(() => {
    if (!quoteId) return;
    let active = true;
    getQuoteDetails(session, quoteId)
      .then((quote) => {
        if (!active || !quote) return;
        setSavedQuote(quote);
        setForm({
          customerId: quote.customer_id,
          propertyId: quote.property_id || "",
          leadId: quote.lead_id || "",
          title: quote.title || "Exterior Cleaning",
          customerMessage: quote.customer_message || "",
          internalNotes: quote.internal_notes || "",
          discountAmount: quote.discount_amount || "",
          taxRate: String(quote.tax_rate ?? 8.25),
          taxExempt: Boolean(quote.tax_exempt),
          expiresAt: quote.expires_at ? quote.expires_at.slice(0, 10) : dateInput(14),
          addressLine1: quote.property?.address_line1 || "",
          addressLine2: quote.property?.address_line2 || "",
          city: quote.property?.city || "",
          state: quote.property?.state || "TX",
          postalCode: quote.property?.postal_code || "",
          items: (quote.items || []).sort((a, b) => a.sort_order - b.sort_order).map((item) => ({
            localId: item.id,
            serviceId: item.service_id || "",
            name: item.name,
            description: item.description || "",
            quantity: item.quantity,
            unitPrice: item.unit_price,
            optional: item.optional,
            selected: item.selected,
          })),
        });
      })
      .catch((err) => setError(err.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [quoteId, session]);

  const subtotal = useMemo(() => form.items.reduce((sum, item) => {
    if (item.optional && !item.selected) return sum;
    return sum + Number(item.quantity || 0) * Number(item.unitPrice || 0);
  }, 0), [form.items]);
  const taxableBase = Math.max(subtotal - Number(form.discountAmount || 0), 0);
  const taxRate = Math.max(Number(form.taxRate || 0), 0);
  const taxAmount = form.taxExempt ? 0 : Math.round(taxableBase * taxRate) / 100;
  const total = taxableBase + taxAmount;

  function patch(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function patchItem(localId, field, value) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => item.localId === localId ? { ...item, [field]: value } : item),
    }));
  }

  function chooseProperty(propertyId) {
    patch("propertyId", propertyId);
    const property = properties.find((item) => item.id === propertyId);
    if (property) {
      setForm((current) => ({
        ...current,
        propertyId,
        addressLine1: property.address_line1 || "",
        addressLine2: property.address_line2 || "",
        city: property.city || "",
        state: property.state || "TX",
        postalCode: property.postal_code || "",
      }));
    }
  }

  function addService(service) {
    setForm((current) => ({ ...current, items: [...current.items, newLine(service)] }));
  }

  async function save(markSent = false) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      if (!form.customerId) throw new Error("Choose a customer.");
      if (!form.items.length) throw new Error("Add at least one service or line item.");
      if (markSent && (!form.addressLine1 || !form.city)) throw new Error("Add the service address before sending.");
      const result = await quoteAdmin(session, {
        action: "save",
        quoteId: savedQuote?.id || quoteId || null,
        leadId: form.leadId || null,
        customerId: form.customerId,
        propertyId: form.propertyId || null,
        property: {
          addressLine1: form.addressLine1,
          addressLine2: form.addressLine2,
          city: form.city,
          state: form.state || "TX",
          postalCode: form.postalCode,
        },
        title: form.title,
        customerMessage: form.customerMessage,
        internalNotes: form.internalNotes,
        discountAmount: Number(form.discountAmount || 0),
        taxRate: Number(form.taxRate || 0),
        taxExempt: Boolean(form.taxExempt),
        expiresAt: form.expiresAt ? new Date(form.expiresAt + "T23:59:59").toISOString() : null,
        items: form.items.map(({ serviceId, name, description, quantity, unitPrice, optional, selected }) => ({
          serviceId: serviceId || null,
          name,
          description,
          quantity: Number(quantity || 1),
          unitPrice: Number(unitPrice || 0),
          optional,
          selected,
        })),
      });
      setSavedQuote(result.quote);

      if (markSent) {
        const sent = await quoteAdmin(session, { action: "send", quoteId: result.quote.id });
        setSavedQuote((current) => ({ ...current, ...sent.quote }));
        setNotice("Quote sent. Waiting for customer approval — no job is created until the customer approves it. The secure customer link is below.");
      } else {
        setNotice(`Draft quote #${result.quote.quote_number} saved.`);
      }
      onSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const link = savedQuote?.public_token ? publicLink(savedQuote.public_token) : null;

  if (loading) return <div className="grid min-h-[50vh] place-items-center"><Loader2 className="h-7 w-7 animate-spin text-cyan-700" /></div>;

  return (
    <div className="grid gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <button onClick={onClose} className="text-sm font-extrabold text-cyan-800">← Back to quotes</button>
          <h2 className="mt-3 text-3xl font-black text-slate-950">{savedQuote ? `Quote #${savedQuote.quote_number}` : "New Quote"}</h2>
          <p className="mt-1 text-sm text-slate-500">Build the scope once, then send the customer a secure approval link.</p>
        </div>
        {savedQuote?.status && <span className="self-start rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-slate-600">{statusLabel(savedQuote.status)}</span>}
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}
      {notice && <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-sm font-bold text-cyan-900">{notice}</div>}

      {link && ["sent","viewed","changes_requested"].includes(savedQuote?.status) && (
        <div className="flex flex-col gap-3 rounded-2xl border border-cyan-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0"><p className="text-xs font-black uppercase tracking-[.14em] text-cyan-700">Customer quote link</p><p className="mt-2 truncate text-sm font-bold text-slate-700">{link}</p></div>
          <button onClick={() => navigator.clipboard.writeText(link).then(() => setNotice("Customer quote link copied."))} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white"><Copy className="h-4 w-4" /> Copy link</button>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
        <section className="grid gap-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-black text-slate-950">Customer & service address</h3>
            <div className="mt-5 grid min-w-0 gap-4 md:grid-cols-12">
              <label className="grid min-w-0 gap-2 text-sm font-extrabold text-slate-700 md:col-span-6">Customer
                <select value={form.customerId} disabled={Boolean(lead)} onChange={(e) => patch("customerId", e.target.value)} className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-cyan-600">
                  <option value="">Choose customer</option>
                  {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.display_name}{customer.email ? ` — ${customer.email}` : ""}</option>)}
                </select>
              </label>
              <label className="grid min-w-0 gap-2 text-sm font-extrabold text-slate-700 md:col-span-6">Saved property
                <select value={form.propertyId} onChange={(e) => chooseProperty(e.target.value)} className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-cyan-600">
                  <option value="">Enter a new address</option>
                  {properties.map((property) => <option key={property.id} value={property.id}>{property.address_line1}, {property.city}</option>)}
                </select>
              </label>
              <label className="grid min-w-0 gap-2 text-sm font-extrabold text-slate-700 md:col-span-12">Street address
                <input value={form.addressLine1} onChange={(e) => { patch("propertyId", ""); patch("addressLine1", e.target.value); }} placeholder="123 Main St" className="w-full min-w-0 rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-cyan-600" />
              </label>
              <label className="grid min-w-0 gap-2 text-sm font-extrabold text-slate-700 md:col-span-6">City
                <input value={form.city} onChange={(e) => patch("city", e.target.value)} className="w-full min-w-0 rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-cyan-600" />
              </label>
              <label className="grid min-w-0 gap-2 text-sm font-extrabold text-slate-700 md:col-span-2">State
                <input value={form.state} onChange={(e) => patch("state", e.target.value.toUpperCase())} className="w-full min-w-0 rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-cyan-600" />
              </label>
              <label className="grid min-w-0 gap-2 text-sm font-extrabold text-slate-700 md:col-span-4">ZIP
                <input value={form.postalCode} onChange={(e) => patch("postalCode", e.target.value)} className="w-full min-w-0 rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-cyan-600" />
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div><h3 className="text-lg font-black text-slate-950">Scope & pricing</h3><p className="mt-1 text-sm text-slate-500">Add services from the RinsePoint pricebook or a custom line.</p></div>
              <button onClick={() => setForm((current) => ({ ...current, items: [...current.items, newLine()] }))} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-black text-slate-700"><Plus className="h-4 w-4" /> Custom line</button>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {services.filter((service) => service.active).map((service) => <button key={service.id} onClick={() => addService(service)} className="rounded-full bg-cyan-50 px-3 py-2 text-xs font-black text-cyan-900 hover:bg-cyan-100">+ {service.name}{service.base_price !== null ? ` · ${money(service.base_price)}` : ""}</button>)}
            </div>

            <div className="mt-6 grid gap-4">
              {form.items.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 p-7 text-center text-sm font-bold text-slate-500">Add a service above to start the quote.</div>}
              {form.items.map((item, index) => (
                <div key={item.localId} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3"><p className="text-xs font-black uppercase tracking-[.14em] text-slate-400">Line {index + 1}</p><button onClick={() => setForm((current) => ({ ...current, items: current.items.filter((row) => row.localId !== item.localId) }))} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></div>
                  <div className="mt-3 grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_110px_140px]">
                    <label className="grid min-w-0 gap-1.5 text-xs font-extrabold text-slate-500">Service / item
                      <input value={item.name} onChange={(e) => patchItem(item.localId, "name", e.target.value)} className="w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-cyan-600" />
                    </label>
                    <label className="grid min-w-0 gap-1.5 text-xs font-extrabold text-slate-500">Qty
                      <input value={item.quantity} type="number" min="0.001" step="0.001" onChange={(e) => patchItem(item.localId, "quantity", e.target.value)} className="w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-cyan-600" />
                    </label>
                    <label className="grid min-w-0 gap-1.5 text-xs font-extrabold text-slate-500">Unit price
                      <input value={item.unitPrice} type="number" min="0" step="0.01" onChange={(e) => patchItem(item.localId, "unitPrice", e.target.value)} className="w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-cyan-600" />
                    </label>
                  </div>
                  <label className="mt-3 grid gap-1.5 text-xs font-extrabold text-slate-500">Description
                    <textarea value={item.description} onChange={(e) => patchItem(item.localId, "description", e.target.value)} rows="2" className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-cyan-600" />
                  </label>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <label className="flex items-center gap-2 text-xs font-extrabold text-slate-600"><input type="checkbox" checked={item.optional} onChange={(e) => patchItem(item.localId, "optional", e.target.checked)} /> Optional add-on</label>
                    <p className="font-black text-slate-900">{money(Number(item.quantity || 0) * Number(item.unitPrice || 0))}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-black text-slate-950">Customer message</h3>
            <label className="mt-4 grid gap-2 text-sm font-extrabold text-slate-700">Quote title
              <input value={form.title} onChange={(e) => patch("title", e.target.value)} className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-cyan-600" />
            </label>
            <label className="mt-4 grid gap-2 text-sm font-extrabold text-slate-700">Message shown on quote
              <textarea value={form.customerMessage} onChange={(e) => patch("customerMessage", e.target.value)} rows="4" className="rounded-xl border border-slate-300 px-4 py-3 font-medium outline-none focus:border-cyan-600" />
            </label>
            <label className="mt-4 grid gap-2 text-sm font-extrabold text-slate-700">Internal notes <span className="font-medium text-slate-400">Customer cannot see these</span>
              <textarea value={form.internalNotes} onChange={(e) => patch("internalNotes", e.target.value)} rows="3" className="rounded-xl border border-slate-300 px-4 py-3 font-medium outline-none focus:border-cyan-600" />
            </label>
          </div>
        </section>

        <aside className="xl:sticky xl:top-28 xl:self-start">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-black text-slate-950">Quote summary</h3>
            <div className="mt-5 grid gap-3 text-sm">
              <div className="flex justify-between gap-4 text-slate-600"><span>Subtotal</span><strong className="text-slate-900">{money(subtotal)}</strong></div>
              <label className="flex items-center justify-between gap-4 text-slate-600"><span>Discount</span><input value={form.discountAmount} onChange={(e) => patch("discountAmount", e.target.value)} type="number" min="0" step="0.01" className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-right font-bold text-slate-900" /></label>
              <div className="flex items-center justify-between gap-4 text-slate-600">
                <span>Sales tax</span>
                <div className="flex items-center gap-2">
                  <input value={form.taxRate} onChange={(e) => patch("taxRate", e.target.value)} disabled={form.taxExempt} type="number" min="0" max="20" step="0.0001" className="w-20 rounded-lg border border-slate-300 px-3 py-2 text-right font-bold text-slate-900 disabled:bg-slate-100 disabled:text-slate-400" />
                  <span className="font-bold text-slate-500">%</span>
                </div>
              </div>
              <div className="flex justify-between gap-4 text-slate-600"><span>Tax amount</span><strong className="text-slate-900">{money(taxAmount)}</strong></div>
              <label className="flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs font-bold text-slate-600">
                <input type="checkbox" checked={form.taxExempt} onChange={(e) => patch("taxExempt", e.target.checked)} className="mt-0.5" />
                Tax exempt / do not charge sales tax
              </label>
              <div className="mt-2 flex justify-between border-t border-slate-200 pt-4 text-lg"><span className="font-black text-slate-950">Total</span><strong className="text-2xl font-black text-slate-950">{money(total)}</strong></div>
            </div>
            <label className="mt-6 grid gap-2 text-sm font-extrabold text-slate-700">Valid through
              <input value={form.expiresAt} onChange={(e) => patch("expiresAt", e.target.value)} type="date" className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-cyan-600" />
            </label>
            <div className="mt-6 grid gap-3">
              <button disabled={saving} onClick={() => save(false)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-3.5 font-black text-slate-800 disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save draft</button>
              <button disabled={saving} onClick={() => save(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-3.5 font-black text-white hover:bg-cyan-700 disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Prepare customer quote</button>
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-400">Preparing the quote creates a secure customer approval link. Automated email delivery is being connected to this same event.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function QuotePage({ session, initialLead, onInitialLeadHandled }) {
  const [quotes, setQuotes] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [services, setServices] = useState([]);
  const [builder, setBuilder] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      const [quoteRows, customerRows, serviceRows] = await Promise.all([
        getQuotes(session),
        getCustomers(session),
        getServices(session),
      ]);
      setQuotes(quoteRows);
      setCustomers(customerRows);
      setServices(serviceRows);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { load(); }, [session]);

  useEffect(() => {
    if (!initialLead) return;
    setBuilder({ lead: initialLead, quoteId: null });
    onInitialLeadHandled?.();
  }, [initialLead, onInitialLeadHandled]);

  if (builder) {
    return <QuoteBuilder session={session} customers={customers} services={services} lead={builder.lead} quoteId={builder.quoteId} onClose={() => setBuilder(null)} onSaved={load} />;
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div><p className="text-sm text-slate-500">Create, price, send, and track customer estimates.</p></div>
        <button onClick={() => setBuilder({ lead: null, quoteId: null })} className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-3 text-sm font-black text-white"><FilePlus2 className="h-4 w-4" /> New quote</button>
      </div>
      {error && <div className="rounded-xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}
      {!quotes ? <p className="text-sm font-bold text-slate-500">Loading quotes…</p> : quotes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <FilePlus2 className="mx-auto h-8 w-8 text-cyan-700" />
          <p className="mt-4 text-lg font-black text-slate-900">No quotes yet</p>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">Create a quote from a lead, or start one here for an existing customer.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-[900px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black uppercase tracking-[.12em] text-slate-400"><tr><th className="px-5 py-4">Quote</th><th className="px-5 py-4">Customer</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Total</th><th className="px-5 py-4">Expires</th><th className="px-5 py-4"></th></tr></thead>
            <tbody className="divide-y divide-slate-100">{quotes.map((quote) => (
              <tr key={quote.id} className="hover:bg-slate-50/70">
                <td className="px-5 py-4"><p className="font-black text-slate-900">#{quote.quote_number}</p><p className="mt-1 text-xs text-slate-500">{quote.title || "Exterior Cleaning"}</p></td>
                <td className="px-5 py-4"><p className="font-bold text-slate-800">{quote.lead?.submitted_name || quote.customer?.display_name || "—"}</p><p className="mt-1 text-xs text-slate-500">{quote.property ? `${quote.property.address_line1}, ${quote.property.city}` : "Address pending"}</p></td>
                <td className="px-5 py-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">{statusLabel(quote.status)}</span></td>
                <td className="px-5 py-4 font-black text-slate-900">{money(quote.total)}</td>
                <td className="px-5 py-4 text-slate-500">{quote.expires_at ? new Date(quote.expires_at).toLocaleDateString() : "—"}</td>
                <td className="px-5 py-4 text-right"><div className="flex justify-end gap-2"><button onClick={() => setBuilder({ lead: null, quoteId: quote.id })} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-black text-slate-700">Open</button>{quote.public_token && quote.status !== "draft" && <button onClick={() => navigator.clipboard.writeText(publicLink(quote.public_token))} title="Copy customer link" className="rounded-lg border border-slate-300 p-2 text-slate-600"><Copy className="h-4 w-4" /></button>}</div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
