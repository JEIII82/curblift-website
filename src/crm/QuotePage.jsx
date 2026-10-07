import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Copy, FilePlus2, Loader2, Plus, Save, Send, Trash2 } from "lucide-react";
import {
  ORGANIZATION_ID,
  getCustomerProperties,
  getCustomers,
  getQuotes,
  getServices,
  quoteAdmin,
  rest,
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

function publicLink(token) {
  return `https://rinsepoint.com/quote/?token=${token}`;
}

function newLine(service = null, options = {}) {
  return {
    localId: crypto.randomUUID(),
    serviceId: service?.id || "",
    name: service?.name || "",
    description: service?.description || "",
    quantity: 1,
    unitPrice: service?.base_price ?? service?.unit_price ?? "",
    optional: Boolean(options.optional),
    selected: options.selected ?? !options.optional,
  };
}

function normalizeLine(item) {
  return {
    localId: item.id || crypto.randomUUID(),
    serviceId: item.service_id || item.serviceId || "",
    name: item.name || "",
    description: item.description || "",
    quantity: item.quantity ?? 1,
    unitPrice: item.unit_price ?? item.unitPrice ?? "",
    optional: Boolean(item.optional),
    selected: item.selected !== false,
  };
}

function cloneLine(item, options = {}) {
  return {
    ...item,
    localId: crypto.randomUUID(),
    optional: options.optional ?? item.optional ?? false,
    selected: options.selected ?? item.selected ?? true,
  };
}

function newPackage(tier, name, description, isRecommended, seedItems = []) {
  return {
    localId: crypto.randomUUID(),
    tier,
    name,
    description,
    isRecommended,
    items: seedItems.length ? seedItems.map((item) => cloneLine(item, { optional: false, selected: true })) : [newLine()],
  };
}

function lineTotal(item) {
  return Number(item.quantity || 0) * Number(item.unitPrice || 0);
}

function packageSubtotal(pkg) {
  return (pkg?.items || []).reduce((sum, item) => sum + lineTotal(item), 0);
}

function tierLabel(tier) {
  return { good: "Good", better: "Better", best: "Best", custom: "Option" }[tier] || "Option";
}

async function getQuoteWorkspace(session, quoteId) {
  const id = encodeURIComponent(quoteId);
  const [quoteRows, packageRows, itemRows] = await Promise.all([
    rest(session, `quotes?select=id,quote_number,status,title,customer_message,internal_notes,subtotal,discount_amount,tax_amount,tax_rate,tax_exempt,total,expires_at,public_token,lead_id,customer_id,property_id,selected_package_id,customer:customers(id,display_name,email,phone),lead:leads(id,submitted_name,submitted_email,submitted_phone,requested_service),property:properties(id,address_line1,address_line2,city,state,postal_code)&organization_id=eq.${ORGANIZATION_ID}&id=eq.${id}&limit=1`, { method: "GET" }),
    rest(session, `quote_packages?select=id,name,tier,description,is_recommended,sort_order&organization_id=eq.${ORGANIZATION_ID}&quote_id=eq.${id}&order=sort_order.asc`, { method: "GET" }),
    rest(session, `quote_items?select=id,quote_id,service_id,package_id,name,description,quantity,unit_price,line_total,optional,selected,sort_order&quote_id=eq.${id}&order=sort_order.asc`, { method: "GET" }),
  ]);

  const quote = quoteRows?.[0];
  if (!quote) return null;
  const packages = (packageRows || []).map((pkg) => ({
    ...pkg,
    items: (itemRows || []).filter((item) => item.package_id === pkg.id),
  }));
  return {
    ...quote,
    items: (itemRows || []).filter((item) => !item.package_id),
    packages,
  };
}

function LineEditor({ item, index, onPatch, onRemove, showOptional = false }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">Line {index + 1}</p>
        <button type="button" onClick={onRemove} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
      </div>
      <div className="mt-3 grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_100px_130px]">
        <label className="grid min-w-0 gap-1.5 text-xs font-extrabold text-slate-500">Service / item
          <input value={item.name} onChange={(e) => onPatch("name", e.target.value)} className="w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-cyan-600" />
        </label>
        <label className="grid min-w-0 gap-1.5 text-xs font-extrabold text-slate-500">Qty
          <input value={item.quantity} type="number" min="0.001" step="0.001" onChange={(e) => onPatch("quantity", e.target.value)} className="w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-cyan-600" />
        </label>
        <label className="grid min-w-0 gap-1.5 text-xs font-extrabold text-slate-500">Unit price
          <input value={item.unitPrice} type="number" min="0" step="0.01" onChange={(e) => onPatch("unitPrice", e.target.value)} className="w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-cyan-600" />
        </label>
      </div>
      <label className="mt-3 grid gap-1.5 text-xs font-extrabold text-slate-500">Description
        <textarea value={item.description} onChange={(e) => onPatch("description", e.target.value)} rows="2" className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-cyan-600" />
      </label>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        {showOptional ? <label className="flex items-center gap-2 text-xs font-extrabold text-slate-600"><input type="checkbox" checked={item.optional} onChange={(e) => onPatch("optional", e.target.checked)} /> Optional add-on</label> : <span className="text-xs font-bold text-slate-400">Included</span>}
        <p className="font-black text-slate-900">{money(lineTotal(item))}</p>
      </div>
    </div>
  );
}

function QuoteBuilder({ session, customers, services, lead, quoteId, onClose, onSaved }) {
  const [loading, setLoading] = useState(Boolean(quoteId));
  const [saving, setSaving] = useState(false);
  const [properties, setProperties] = useState([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [savedQuote, setSavedQuote] = useState(null);
  const [mode, setMode] = useState("simple");
  const [packages, setPackages] = useState([]);
  const [form, setForm] = useState({
    customerId: lead?.customer?.id || "",
    propertyId: lead?.property?.id || "",
    leadId: lead?.id || "",
    title: lead?.requested_service || "Exterior Cleaning",
    customerMessage: "Thanks for the opportunity to quote your project. Review the service plan and pricing below, then approve when you’re ready to move forward.",
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
    if (!services.length || form.items.length || quoteId || mode !== "simple") return;
    const wanted = (lead?.requested_service || "").toLowerCase();
    const match = services.find((service) => {
      const name = service.name.toLowerCase();
      return wanted && (name.includes(wanted) || wanted.includes(name.split(" / ")[0]));
    });
    if (match) setForm((current) => ({ ...current, items: [newLine(match)] }));
  }, [services, lead, quoteId, form.items.length, mode]);

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
    getQuoteWorkspace(session, quoteId)
      .then((quote) => {
        if (!active || !quote) return;
        setSavedQuote(quote);
        const packageMode = Boolean(quote.packages?.length);
        setMode(packageMode ? "packages" : "simple");
        setPackages((quote.packages || []).map((pkg) => ({
          localId: pkg.id,
          tier: pkg.tier,
          name: pkg.name,
          description: pkg.description || "",
          isRecommended: Boolean(pkg.is_recommended),
          items: (pkg.items || []).map(normalizeLine),
        })));
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
          items: (quote.items || []).map(normalizeLine),
        });
      })
      .catch((err) => setError(err.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [quoteId, session]);

  const recommendedPackage = useMemo(() => packages.find((pkg) => pkg.isRecommended) || packages[0] || null, [packages]);
  const globalSubtotal = useMemo(() => form.items.reduce((sum, item) => {
    if (item.optional && !item.selected) return sum;
    return sum + lineTotal(item);
  }, 0), [form.items]);
  const subtotal = mode === "packages" ? globalSubtotal + packageSubtotal(recommendedPackage) : globalSubtotal;
  const taxableBase = Math.max(subtotal - Number(form.discountAmount || 0), 0);
  const taxRate = Math.max(Number(form.taxRate || 0), 0);
  const taxAmount = form.taxExempt ? 0 : Math.round(taxableBase * taxRate) / 100;
  const total = taxableBase + taxAmount;
  const locked = ["approved", "declined", "cancelled", "expired"].includes(savedQuote?.status);

  function patch(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function patchItem(localId, field, value) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => item.localId === localId ? { ...item, [field]: value } : item),
    }));
  }

  function patchPackage(packageId, field, value) {
    setPackages((current) => current.map((pkg) => pkg.localId === packageId ? { ...pkg, [field]: value } : pkg));
  }

  function patchPackageItem(packageId, itemId, field, value) {
    setPackages((current) => current.map((pkg) => pkg.localId === packageId ? {
      ...pkg,
      items: pkg.items.map((item) => item.localId === itemId ? { ...item, [field]: value } : item),
    } : pkg));
  }

  function chooseProperty(propertyId) {
    const property = properties.find((item) => item.id === propertyId);
    setForm((current) => ({
      ...current,
      propertyId,
      ...(property ? {
        addressLine1: property.address_line1 || "",
        addressLine2: property.address_line2 || "",
        city: property.city || "",
        state: property.state || "TX",
        postalCode: property.postal_code || "",
      } : {}),
    }));
  }

  function enablePackages() {
    const included = form.items.filter((item) => !item.optional);
    const addOns = form.items.filter((item) => item.optional).map((item) => ({ ...item, selected: false }));
    setPackages([
      newPackage("good", "Essential Clean", "The core cleaning scope for the priority area.", false, included),
      newPackage("better", "Curb Appeal Clean", "A broader clean designed to improve the main arrival areas together.", true, included),
      newPackage("best", "Full Refresh", "The most complete option for a larger exterior concrete refresh.", false, included),
    ]);
    setForm((current) => ({ ...current, items: addOns }));
    setMode("packages");
    setNotice("Package mode enabled. Build each option, then choose the package you recommend.");
  }

  function enableSimple() {
    const source = packages.find((pkg) => pkg.isRecommended) || packages[0];
    const included = (source?.items || []).map((item) => cloneLine(item, { optional: false, selected: true }));
    setForm((current) => ({ ...current, items: [...included, ...current.items.map((item) => cloneLine(item))] }));
    setPackages([]);
    setMode("simple");
    setNotice("Switched to a simple quote using the recommended package scope.");
  }

  function markRecommended(packageId) {
    setPackages((current) => current.map((pkg) => ({ ...pkg, isRecommended: pkg.localId === packageId })));
  }

  function addPackageService(packageId, serviceId) {
    const service = services.find((item) => item.id === serviceId);
    if (!service) return;
    setPackages((current) => current.map((pkg) => pkg.localId === packageId ? { ...pkg, items: [...pkg.items, newLine(service)] } : pkg));
  }

  function addPackageCustom(packageId) {
    setPackages((current) => current.map((pkg) => pkg.localId === packageId ? { ...pkg, items: [...pkg.items, newLine()] } : pkg));
  }

  function addPackage() {
    if (packages.length >= 4) return;
    setPackages((current) => [...current, newPackage("custom", `Option ${current.length + 1}`, "Custom service option.", false)]);
  }

  function removePackage(packageId) {
    if (packages.length <= 2) return;
    const removing = packages.find((pkg) => pkg.localId === packageId);
    const next = packages.filter((pkg) => pkg.localId !== packageId);
    if (removing?.isRecommended && next.length) next[Math.min(1, next.length - 1)] = { ...next[Math.min(1, next.length - 1)], isRecommended: true };
    setPackages(next);
  }

  function addAddon(serviceId) {
    const service = services.find((item) => item.id === serviceId);
    if (!service) return;
    setForm((current) => ({ ...current, items: [...current.items, newLine(service, { optional: true, selected: false })] }));
  }

  async function save(markSent = false) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      if (!form.customerId) throw new Error("Choose a customer.");
      if (mode === "simple" && !form.items.length) throw new Error("Add at least one service or line item.");
      if (mode === "packages") {
        if (packages.length < 2 || packages.length > 4) throw new Error("Package quotes need 2 to 4 options.");
        if (packages.some((pkg) => !pkg.name.trim() || !pkg.items.length || pkg.items.some((item) => !item.name.trim()))) throw new Error("Every package needs a name and at least one complete line item.");
      }
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
        packages: mode === "packages" ? packages.map((pkg) => ({
          name: pkg.name,
          tier: pkg.tier,
          description: pkg.description,
          isRecommended: pkg.isRecommended,
          items: pkg.items.map(({ serviceId, name, description, quantity, unitPrice }) => ({
            serviceId: serviceId || null,
            name,
            description,
            quantity: Number(quantity || 1),
            unitPrice: Number(unitPrice || 0),
          })),
        })) : [],
      });

      setSavedQuote(result.quote);
      if (result.quote?.packages) {
        setPackages(result.quote.packages.map((pkg) => ({
          localId: pkg.id,
          tier: pkg.tier,
          name: pkg.name,
          description: pkg.description || "",
          isRecommended: Boolean(pkg.is_recommended),
          items: (pkg.items || []).map(normalizeLine),
        })));
        setForm((current) => ({ ...current, items: (result.quote.items || []).filter((item) => !item.package_id).map(normalizeLine) }));
      }

      if (markSent) {
        const sent = await quoteAdmin(session, { action: "send", quoteId: result.quote.id });
        setSavedQuote((current) => ({ ...current, ...sent.quote }));
        setNotice("Quote sent. The customer can review the proposal and approve their service choice from the secure RinsePoint link.");
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
          <p className="mt-1 text-sm text-slate-500">Build a simple estimate or give the customer clear service options.</p>
        </div>
        {savedQuote?.status && <span className="self-start rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-slate-600">{statusLabel(savedQuote.status)}</span>}
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}
      {notice && <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-sm font-bold text-cyan-900">{notice}</div>}

      {link && ["sent", "viewed", "changes_requested"].includes(savedQuote?.status) && (
        <div className="flex flex-col gap-3 rounded-2xl border border-cyan-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0"><p className="text-xs font-black uppercase tracking-[.14em] text-cyan-700">Customer proposal link</p><p className="mt-2 truncate text-sm font-bold text-slate-700">{link}</p></div>
          <button onClick={() => navigator.clipboard.writeText(link).then(() => setNotice("Customer proposal link copied."))} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white"><Copy className="h-4 w-4" /> Copy link</button>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="grid gap-2 sm:grid-cols-2">
          <button type="button" disabled={locked} onClick={enableSimple} className={`rounded-xl px-4 py-3 text-left transition ${mode === "simple" ? "bg-[#08243f] text-white" : "text-slate-600 hover:bg-slate-50"}`}><p className="font-black">Simple quote</p><p className={`mt-1 text-xs ${mode === "simple" ? "text-slate-300" : "text-slate-400"}`}>One clear scope and price.</p></button>
          <button type="button" disabled={locked} onClick={enablePackages} className={`rounded-xl px-4 py-3 text-left transition ${mode === "packages" ? "bg-cyan-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}><p className="font-black">Package quote</p><p className={`mt-1 text-xs ${mode === "packages" ? "text-cyan-100" : "text-slate-400"}`}>Good / Better / Best choices plus add-ons.</p></button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
        <section className="grid content-start gap-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-black text-slate-950">Customer & service address</h3>
            <div className="mt-5 grid min-w-0 gap-4 md:grid-cols-12">
              <label className="grid min-w-0 gap-2 text-sm font-extrabold text-slate-700 md:col-span-6">Customer
                <select value={form.customerId} disabled={Boolean(lead) || locked} onChange={(e) => patch("customerId", e.target.value)} className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-cyan-600 disabled:bg-slate-100">
                  <option value="">Choose customer</option>
                  {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.display_name}{customer.email ? ` — ${customer.email}` : ""}</option>)}
                </select>
              </label>
              <label className="grid min-w-0 gap-2 text-sm font-extrabold text-slate-700 md:col-span-6">Saved property
                <select value={form.propertyId} disabled={locked} onChange={(e) => chooseProperty(e.target.value)} className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-cyan-600 disabled:bg-slate-100">
                  <option value="">Enter a new address</option>
                  {properties.map((property) => <option key={property.id} value={property.id}>{property.address_line1}, {property.city}</option>)}
                </select>
              </label>
              <label className="grid min-w-0 gap-2 text-sm font-extrabold text-slate-700 md:col-span-12">Street address
                <input disabled={locked} value={form.addressLine1} onChange={(e) => setForm((current) => ({ ...current, propertyId: "", addressLine1: e.target.value }))} placeholder="123 Main St" className="w-full min-w-0 rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-cyan-600 disabled:bg-slate-100" />
              </label>
              <label className="grid min-w-0 gap-2 text-sm font-extrabold text-slate-700 md:col-span-6">City<input disabled={locked} value={form.city} onChange={(e) => patch("city", e.target.value)} className="w-full min-w-0 rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-cyan-600 disabled:bg-slate-100" /></label>
              <label className="grid min-w-0 gap-2 text-sm font-extrabold text-slate-700 md:col-span-2">State<input disabled={locked} value={form.state} onChange={(e) => patch("state", e.target.value.toUpperCase())} className="w-full min-w-0 rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-cyan-600 disabled:bg-slate-100" /></label>
              <label className="grid min-w-0 gap-2 text-sm font-extrabold text-slate-700 md:col-span-4">ZIP<input disabled={locked} value={form.postalCode} onChange={(e) => patch("postalCode", e.target.value)} className="w-full min-w-0 rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-cyan-600 disabled:bg-slate-100" /></label>
            </div>
          </div>

          {mode === "simple" ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div><h3 className="text-lg font-black text-slate-950">Scope & pricing</h3><p className="mt-1 text-sm text-slate-500">One approved scope. Optional lines can be offered as add-ons.</p></div>
                <button disabled={locked} onClick={() => setForm((current) => ({ ...current, items: [...current.items, newLine()] }))} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-black text-slate-700 disabled:opacity-50"><Plus className="h-4 w-4" /> Custom line</button>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">{services.filter((service) => service.active).map((service) => <button disabled={locked} key={service.id} onClick={() => setForm((current) => ({ ...current, items: [...current.items, newLine(service)] }))} className="rounded-full bg-cyan-50 px-3 py-2 text-xs font-black text-cyan-900 hover:bg-cyan-100 disabled:opacity-50">+ {service.name}{service.base_price !== null ? ` · ${money(service.base_price)}` : ""}</button>)}</div>
              <div className="mt-6 grid gap-4">
                {!form.items.length && <div className="rounded-xl border border-dashed border-slate-300 p-7 text-center text-sm font-bold text-slate-500">Add a service above to start the quote.</div>}
                {form.items.map((item, index) => <LineEditor key={item.localId} item={item} index={index} showOptional onPatch={(field, value) => patchItem(item.localId, field, value)} onRemove={() => setForm((current) => ({ ...current, items: current.items.filter((row) => row.localId !== item.localId) }))} />)}
              </div>
            </div>
          ) : (
            <div className="grid gap-5">
              <div className="rounded-2xl border border-cyan-200 bg-cyan-50/50 p-5">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><p className="text-xs font-black uppercase tracking-[.14em] text-cyan-700">Package quote</p><h3 className="mt-1 text-xl font-black text-slate-950">Build the customer’s choices</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">The recommended option sets the initial quote total. The customer can choose another package before approving.</p></div>{packages.length < 4 && <button disabled={locked} onClick={addPackage} className="inline-flex items-center gap-2 rounded-xl border border-cyan-300 bg-white px-4 py-2.5 text-sm font-black text-cyan-900"><Plus className="h-4 w-4" /> Add option</button>}</div>
              </div>

              {packages.map((pkg, packageIndex) => (
                <article key={pkg.localId} className={`rounded-2xl border bg-white p-5 shadow-sm ${pkg.isRecommended ? "border-cyan-400 ring-2 ring-cyan-100" : "border-slate-200"}`}>
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-black ${pkg.isRecommended ? "bg-cyan-600 text-white" : "bg-slate-100 text-slate-600"}`}>{packageIndex + 1}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-slate-500">{tierLabel(pkg.tier)}</span>{pkg.isRecommended && <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-cyan-800">Recommended</span>}</div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-[150px_1fr]">
                          <select disabled={locked} value={pkg.tier} onChange={(e) => patchPackage(pkg.localId, "tier", e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-bold"><option value="good">Good</option><option value="better">Better</option><option value="best">Best</option><option value="custom">Custom</option></select>
                          <input disabled={locked} value={pkg.name} onChange={(e) => patchPackage(pkg.localId, "name", e.target.value)} placeholder="Package name" className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-black text-slate-900" />
                        </div>
                        <textarea disabled={locked} value={pkg.description} onChange={(e) => patchPackage(pkg.localId, "description", e.target.value)} rows="2" placeholder="Short explanation of who this option is for." className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-700" />
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2"><p className="text-xl font-black text-slate-950">{money(packageSubtotal(pkg))}</p><button disabled={locked || pkg.isRecommended} onClick={() => markRecommended(pkg.localId)} className="text-xs font-black text-cyan-800 disabled:text-slate-400">{pkg.isRecommended ? "Recommended" : "Make recommended"}</button>{packages.length > 2 && <button disabled={locked} onClick={() => removePackage(pkg.localId)} className="text-xs font-black text-red-600">Remove option</button>}</div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <select disabled={locked} defaultValue="" onChange={(e) => { addPackageService(pkg.localId, e.target.value); e.target.value = ""; }} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700"><option value="">+ Add pricebook service</option>{services.filter((service) => service.active).map((service) => <option key={service.id} value={service.id}>{service.name}{service.base_price !== null ? ` · ${money(service.base_price)}` : ""}</option>)}</select>
                    <button disabled={locked} onClick={() => addPackageCustom(pkg.localId)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-black text-slate-700">+ Custom line</button>
                  </div>
                  <div className="mt-4 grid gap-3">{pkg.items.map((item, index) => <LineEditor key={item.localId} item={item} index={index} onPatch={(field, value) => patchPackageItem(pkg.localId, item.localId, field, value)} onRemove={() => setPackages((current) => current.map((row) => row.localId === pkg.localId ? { ...row, items: row.items.filter((line) => line.localId !== item.localId) } : row))} />)}</div>
                </article>
              ))}

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div><h3 className="text-lg font-black text-slate-950">Optional add-ons</h3><p className="mt-1 text-sm text-slate-500">These sit outside the packages so the customer can add them to whichever option they choose.</p></div>
                <div className="mt-4 flex flex-wrap gap-2"><select disabled={locked} defaultValue="" onChange={(e) => { addAddon(e.target.value); e.target.value = ""; }} className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-xs font-bold text-slate-700"><option value="">+ Add service as add-on</option>{services.filter((service) => service.active).map((service) => <option key={service.id} value={service.id}>{service.name}{service.base_price !== null ? ` · ${money(service.base_price)}` : ""}</option>)}</select><button disabled={locked} onClick={() => setForm((current) => ({ ...current, items: [...current.items, newLine(null, { optional: true, selected: false })] }))} className="rounded-lg border border-slate-300 px-3 py-2.5 text-xs font-black text-slate-700">+ Custom add-on</button></div>
                <div className="mt-4 grid gap-3">{form.items.length ? form.items.map((item, index) => <LineEditor key={item.localId} item={{ ...item, optional: true }} index={index} onPatch={(field, value) => patchItem(item.localId, field === "optional" ? "optional" : field, value)} onRemove={() => setForm((current) => ({ ...current, items: current.items.filter((row) => row.localId !== item.localId) }))} />) : <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">No add-ons yet.</div>}</div>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-black text-slate-950">Customer message</h3>
            <label className="mt-4 grid gap-2 text-sm font-extrabold text-slate-700">Quote title<input disabled={locked} value={form.title} onChange={(e) => patch("title", e.target.value)} className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-cyan-600 disabled:bg-slate-100" /></label>
            <label className="mt-4 grid gap-2 text-sm font-extrabold text-slate-700">Message shown on proposal<textarea disabled={locked} value={form.customerMessage} onChange={(e) => patch("customerMessage", e.target.value)} rows="4" className="rounded-xl border border-slate-300 px-4 py-3 font-medium outline-none focus:border-cyan-600 disabled:bg-slate-100" /></label>
            <label className="mt-4 grid gap-2 text-sm font-extrabold text-slate-700">Internal notes <span className="font-medium text-slate-400">Customer cannot see these</span><textarea disabled={locked} value={form.internalNotes} onChange={(e) => patch("internalNotes", e.target.value)} rows="3" className="rounded-xl border border-slate-300 px-4 py-3 font-medium outline-none focus:border-cyan-600 disabled:bg-slate-100" /></label>
          </div>
        </section>

        <aside className="xl:sticky xl:top-28 xl:self-start">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-black text-slate-950">Quote summary</h3>
            {mode === "packages" && recommendedPackage && <div className="mt-4 rounded-xl bg-cyan-50 p-4"><p className="text-[10px] font-black uppercase tracking-[.14em] text-cyan-700">Recommended starting option</p><div className="mt-2 flex items-center justify-between gap-3"><strong className="text-sm text-slate-900">{recommendedPackage.name}</strong><strong className="text-slate-950">{money(packageSubtotal(recommendedPackage))}</strong></div><p className="mt-2 text-xs leading-5 text-slate-500">The customer can choose a different package before approval.</p></div>}
            <div className="mt-5 grid gap-3 text-sm">
              <div className="flex justify-between gap-4 text-slate-600"><span>Subtotal</span><strong className="text-slate-900">{money(subtotal)}</strong></div>
              <label className="flex items-center justify-between gap-4 text-slate-600"><span>Discount</span><input disabled={locked} value={form.discountAmount} onChange={(e) => patch("discountAmount", e.target.value)} type="number" min="0" step="0.01" className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-right font-bold text-slate-900 disabled:bg-slate-100" /></label>
              <div className="flex items-center justify-between gap-4 text-slate-600"><span>Sales tax</span><div className="flex items-center gap-2"><input disabled={form.taxExempt || locked} value={form.taxRate} onChange={(e) => patch("taxRate", e.target.value)} type="number" min="0" max="20" step="0.0001" className="w-20 rounded-lg border border-slate-300 px-3 py-2 text-right font-bold text-slate-900 disabled:bg-slate-100" /><span className="font-bold text-slate-500">%</span></div></div>
              <div className="flex justify-between gap-4 text-slate-600"><span>Tax amount</span><strong className="text-slate-900">{money(taxAmount)}</strong></div>
              <label className="flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs font-bold text-slate-600"><input disabled={locked} type="checkbox" checked={form.taxExempt} onChange={(e) => patch("taxExempt", e.target.checked)} className="mt-0.5" /> Tax exempt / do not charge sales tax</label>
              <div className="mt-2 flex justify-between border-t border-slate-200 pt-4 text-lg"><span className="font-black text-slate-950">Default total</span><strong className="text-2xl font-black text-slate-950">{money(total)}</strong></div>
            </div>
            <label className="mt-6 grid gap-2 text-sm font-extrabold text-slate-700">Valid through<input disabled={locked} value={form.expiresAt} onChange={(e) => patch("expiresAt", e.target.value)} type="date" className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-cyan-600 disabled:bg-slate-100" /></label>
            {!locked ? <div className="mt-6 grid gap-3"><button disabled={saving} onClick={() => save(false)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-3.5 font-black text-slate-800 disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save draft</button><button disabled={saving} onClick={() => save(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-3.5 font-black text-white hover:bg-cyan-700 disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Save & send quote</button></div> : <div className="mt-6 rounded-xl bg-slate-50 p-4 text-sm font-bold text-slate-500"><CheckCircle2 className="mb-2 h-5 w-5 text-slate-400" /> This quote is closed and read-only.</div>}
            <p className="mt-4 text-xs leading-5 text-slate-400">Customer links always use rinsepoint.com. Package choices and add-ons are finalized only when the customer approves.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function QuotePage({ session, initialLead, initialQuoteId, onInitialLeadHandled, onInitialQuoteHandled, onOpenCustomer }) {
  const [quotes, setQuotes] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [services, setServices] = useState([]);
  const [builder, setBuilder] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      const [quoteRows, customerRows, serviceRows] = await Promise.all([getQuotes(session), getCustomers(session), getServices(session)]);
      setQuotes(quoteRows);
      setCustomers(customerRows);
      setServices(serviceRows);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { load(); }, [session]);
  useEffect(() => { if (!initialLead) return; setBuilder({ lead: initialLead, quoteId: null }); onInitialLeadHandled?.(); }, [initialLead, onInitialLeadHandled]);
  useEffect(() => { if (!initialQuoteId) return; setBuilder({ lead: null, quoteId: initialQuoteId }); onInitialQuoteHandled?.(); }, [initialQuoteId, onInitialQuoteHandled]);

  if (builder) return <QuoteBuilder session={session} customers={customers} services={services} lead={builder.lead} quoteId={builder.quoteId} onClose={() => setBuilder(null)} onSaved={load} />;

  return (
    <div className="grid gap-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><p className="text-sm text-slate-500">Create, price, send, and track customer proposals.</p></div><button onClick={() => setBuilder({ lead: null, quoteId: null })} className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-3 text-sm font-black text-white"><FilePlus2 className="h-4 w-4" /> New quote</button></div>
      {error && <div className="rounded-xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}
      {!quotes ? <p className="text-sm font-bold text-slate-500">Loading quotes…</p> : quotes.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><FilePlus2 className="mx-auto h-8 w-8 text-cyan-700" /><p className="mt-4 text-lg font-black text-slate-900">No quotes yet</p><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">Create a quote from a lead, or start one here for an existing customer.</p></div> : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm"><table className="min-w-[900px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs font-black uppercase tracking-[.12em] text-slate-400"><tr><th className="px-5 py-4">Quote</th><th className="px-5 py-4">Customer</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Total</th><th className="px-5 py-4">Expires</th><th className="px-5 py-4"></th></tr></thead><tbody className="divide-y divide-slate-100">{quotes.map((quote) => <tr key={quote.id} role="button" tabIndex={0} onClick={() => setBuilder({ lead: null, quoteId: quote.id })} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setBuilder({ lead: null, quoteId: quote.id }); }} className="cursor-pointer transition hover:bg-slate-50 focus:bg-cyan-50 focus:outline-none"><td className="px-5 py-4"><p className="font-black text-slate-900">#{quote.quote_number}</p><p className="mt-1 text-xs text-slate-500">{quote.title || "Exterior Cleaning"}</p></td><td className="px-5 py-4"><button type="button" onClick={(event) => { event.stopPropagation(); onOpenCustomer?.(quote.customer?.id); }} className="text-left hover:text-cyan-800"><p className="font-bold text-slate-800">{quote.lead?.submitted_name || quote.customer?.display_name || "—"}</p><p className="mt-1 text-xs text-slate-500">{quote.property ? `${quote.property.address_line1}, ${quote.property.city}` : "Address pending"}</p></button></td><td className="px-5 py-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">{statusLabel(quote.status)}</span>{quote.jobs?.[0] && <p className="mt-2 text-xs font-bold text-slate-500">Job #{quote.jobs[0].job_number} · {quote.jobs[0].status.replaceAll("_", " ")}</p>}</td><td className="px-5 py-4 font-black text-slate-900">{money(quote.total)}</td><td className="px-5 py-4 text-slate-500">{quote.expires_at ? new Date(quote.expires_at).toLocaleDateString() : "—"}</td><td className="px-5 py-4 text-right"><div className="flex justify-end gap-2"><button onClick={(event) => { event.stopPropagation(); setBuilder({ lead: null, quoteId: quote.id }); }} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-black text-slate-700">Open</button>{quote.public_token && quote.status !== "draft" && <button onClick={(event) => { event.stopPropagation(); navigator.clipboard.writeText(publicLink(quote.public_token)); }} title="Copy customer link" className="rounded-lg border border-slate-300 p-2 text-slate-600"><Copy className="h-4 w-4" /></button>}</div></td></tr>)}</tbody></table></div>
      )}
    </div>
  );
}
