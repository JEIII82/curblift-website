import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Loader2,
  MapPin,
  MessageSquareText,
  Phone,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { getPublicQuote, publicQuoteAction } from "../publicApi.js";

function money(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value || 0));
}

function statusText(status) {
  return {
    sent: "Ready for review",
    viewed: "Ready for review",
    changes_requested: "Revision requested",
    approved: "Approved",
    declined: "Declined",
    expired: "Expired",
  }[status] || status;
}

function phoneHref(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits ? `tel:+${digits.length === 10 ? `1${digits}` : digits}` : "tel:+19723797161";
}

function tierLabel(tier) {
  return { good: "Good", better: "Better", best: "Best", custom: "Option" }[tier] || "Option";
}

function itemTotal(item) {
  return Number(item?.line_total ?? (Number(item?.quantity || 0) * Number(item?.unit_price || 0)));
}

export default function PublicQuotePage() {
  const token = new URLSearchParams(window.location.search).get("token") || "";
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [name, setName] = useState("");
  const [changeMessage, setChangeMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [selectedAddOnIds, setSelectedAddOnIds] = useState([]);

  useEffect(() => {
    document.title = "Your RinsePoint Quote";
    getPublicQuote(token).then(setData).catch((err) => setError(err.message));
  }, [token]);

  const quote = data?.quote;
  const packages = quote?.packages || [];
  const addOns = quote?.addOns || [];
  const baseItems = quote?.baseItems || [];

  useEffect(() => {
    if (!quote) return;
    const recommended = packages.find((pkg) => pkg.is_recommended);
    setSelectedPackageId(quote.selected_package_id || recommended?.id || packages[0]?.id || "");
    setSelectedAddOnIds(addOns.filter((item) => item.selected).map((item) => item.id));
  }, [quote?.id]);

  const selectedPackage = useMemo(() => packages.find((pkg) => pkg.id === selectedPackageId) || packages[0] || null, [packages, selectedPackageId]);
  const selectedAddOns = useMemo(() => addOns.filter((item) => selectedAddOnIds.includes(item.id)), [addOns, selectedAddOnIds]);
  const selectedScopeItems = useMemo(() => {
    const packageItems = selectedPackage?.items || [];
    return [...baseItems, ...packageItems, ...selectedAddOns];
  }, [baseItems, selectedPackage, selectedAddOns]);

  const selectedSubtotal = useMemo(() => selectedScopeItems.reduce((sum, item) => sum + itemTotal(item), 0), [selectedScopeItems]);
  const taxableBase = Math.max(selectedSubtotal - Number(quote?.discount_amount || 0), 0);
  const selectedTax = quote?.tax_exempt ? 0 : Math.round(taxableBase * Number(quote?.tax_rate || 0)) / 100;
  const selectedTotal = taxableBase + selectedTax;

  function packagePrice(pkg) {
    return [...baseItems, ...(pkg?.items || [])].reduce((sum, item) => sum + itemTotal(item), 0);
  }

  function toggleAddOn(id) {
    setSelectedAddOnIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  async function act(action) {
    setBusy(action);
    setError("");
    try {
      const result = await publicQuoteAction(token, action, {
        name,
        message: changeMessage,
        ...(action === "approve" ? {
          packageId: selectedPackage?.id || null,
          selectedAddOnIds,
        } : {}),
      });
      setData((current) => ({
        ...current,
        quote: {
          ...current.quote,
          status: result.status,
          total: result.total ?? current.quote.total,
          selected_package_id: result.selectedPackageId ?? current.quote.selected_package_id,
        },
      }));
      if (action === "approve") setNotice("Quote approved. RinsePoint will follow up to schedule your service.");
      if (action === "decline") setNotice("Thanks for letting us know. RinsePoint has been notified.");
      if (action === "request_changes") setNotice("Your requested changes were sent to RinsePoint. We’ll prepare an updated quote.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  if (!token) return <main className="grid min-h-screen place-items-center bg-[#eef5f8] p-5"><div className="max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl"><img src="/rinsepoint-logo.svg" alt="RinsePoint" className="mx-auto w-56" /><h1 className="mt-7 text-2xl font-black text-slate-950">This quote link is incomplete</h1><p className="mt-3 leading-7 text-slate-600">Use the full quote link from your RinsePoint email, or contact us and we’ll send it again.</p><a href="/contact/" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#08243f] px-5 py-3 font-black text-white">Contact RinsePoint <ArrowRight className="h-4 w-4" /></a></div></main>;
  if (!data && !error) return <main className="grid min-h-screen place-items-center bg-[#eef5f8]"><Loader2 className="h-8 w-8 animate-spin text-cyan-700" /></main>;
  if (error && !data) return <main className="grid min-h-screen place-items-center bg-[#eef5f8] p-5"><div className="max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl"><img src="/rinsepoint-logo.svg" alt="RinsePoint" className="mx-auto w-56" /><h1 className="mt-7 text-2xl font-black text-slate-950">Quote unavailable</h1><p className="mt-3 leading-7 text-slate-600">{error}</p><a href="/contact/" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#08243f] px-5 py-3 font-black text-white">Contact RinsePoint <ArrowRight className="h-4 w-4" /></a></div></main>;

  const { organization } = data;
  const closed = ["approved", "declined", "expired", "changes_requested"].includes(quote.status);
  const phone = organization?.phone || "(972) 379-7161";
  const packageMode = packages.length > 0;

  return (
    <main className="min-h-screen bg-[#eef5f8] px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-xl shadow-slate-900/5">
        <header className="relative overflow-hidden bg-[#08243f] px-6 py-8 text-white sm:px-10 sm:py-10">
          <div className="absolute -right-24 -top-28 h-72 w-72 rounded-full bg-cyan-400/10" />
          <div className="absolute -bottom-32 right-36 h-64 w-64 rounded-full bg-cyan-300/5" />
          <div className="relative">
            <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-start">
              <a href="/" aria-label="RinsePoint home"><img src="/rinsepoint-logo-white.svg" alt="RinsePoint Exterior Cleaning" className="w-56" /></a>
              <span className="w-fit rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-[.12em] text-cyan-100">{statusText(quote.status)}</span>
            </div>
            <div className="mt-10 max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[.22em] text-cyan-300">Exterior cleaning proposal · Quote #{quote.quote_number}</p>
              <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">{quote.title || "Exterior Cleaning"}</h1>
              <p className="mt-4 text-base leading-7 text-slate-300 sm:text-lg">Prepared for <strong className="text-white">{quote.customer?.display_name}</strong>. {packageMode ? "Choose the service option that fits best, add anything extra you want, and approve when you’re ready." : "Review the scope, pricing, and what to expect before approving."}</p>
            </div>
          </div>
        </header>

        <div className="grid gap-8 p-5 sm:p-8 lg:p-10">
          {notice && <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-5 font-bold text-cyan-950">{notice}</div>}
          {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-5 font-bold text-red-700">{error}</div>}

          <section className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><div className="flex gap-3"><MapPin className="mt-0.5 h-5 w-5 shrink-0 text-cyan-700" /><div><p className="text-xs font-black uppercase tracking-[.16em] text-slate-400">Service address</p><p className="mt-2 font-bold leading-7 text-slate-800">{quote.property?.address_line1}<br />{quote.property?.address_line2 && <>{quote.property.address_line2}<br /></>}{quote.property?.city}, {quote.property?.state} {quote.property?.postal_code}</p></div></div></div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><div className="flex gap-3"><CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-cyan-700" /><div><p className="text-xs font-black uppercase tracking-[.16em] text-slate-400">Quote valid through</p><p className="mt-2 font-bold text-slate-800">{quote.expires_at ? new Date(quote.expires_at).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) : "Contact RinsePoint"}</p><p className="mt-2 text-xs leading-5 text-slate-500">Pricing and scope are based on the information currently provided.</p></div></div></div>
          </section>

          {quote.customer_message && <section className="rounded-2xl border border-cyan-100 bg-cyan-50/60 p-5 sm:p-6"><p className="text-xs font-black uppercase tracking-[.16em] text-cyan-700">Your service plan</p><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">{quote.customer_message}</p></section>}

          {packageMode && (
            <section>
              <div className="border-b border-slate-200 pb-4"><p className="text-xs font-black uppercase tracking-[.16em] text-cyan-700">Choose your service level</p><h2 className="mt-1 text-2xl font-black text-slate-950">Good, better, or best</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Select one option below. The highlighted recommendation is where RinsePoint suggests starting based on the project details.</p></div>
              <div className={`mt-5 grid gap-4 ${packages.length >= 3 ? "lg:grid-cols-3" : "sm:grid-cols-2"}`}>
                {packages.map((pkg) => {
                  const active = selectedPackage?.id === pkg.id;
                  return <button type="button" disabled={closed} key={pkg.id} onClick={() => setSelectedPackageId(pkg.id)} className={`relative rounded-2xl border p-5 text-left transition ${active ? "border-cyan-500 bg-cyan-50 ring-2 ring-cyan-100" : "border-slate-200 bg-white hover:border-cyan-300"} disabled:cursor-default`}>
                    {pkg.is_recommended && <span className="absolute right-4 top-4 rounded-full bg-cyan-600 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white">Recommended</span>}
                    <p className="text-[10px] font-black uppercase tracking-[.16em] text-slate-400">{tierLabel(pkg.tier)}</p>
                    <h3 className="mt-2 pr-24 text-xl font-black text-slate-950">{pkg.name}</h3>
                    {pkg.description && <p className="mt-2 text-sm leading-6 text-slate-500">{pkg.description}</p>}
                    <p className="mt-5 text-3xl font-black text-slate-950">{money(packagePrice(pkg))}</p>
                    <p className="mt-1 text-xs text-slate-400">Service price before tax and optional add-ons</p>
                    <div className="mt-5 border-t border-slate-100 pt-4"><p className="text-xs font-black uppercase tracking-wide text-slate-400">Includes</p><div className="mt-3 grid gap-2">{(pkg.items || []).map((item) => <div key={item.id} className="flex gap-2 text-sm text-slate-700"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-700" /><span>{item.name}</span></div>)}</div></div>
                    <div className={`mt-5 rounded-xl px-3 py-2.5 text-center text-sm font-black ${active ? "bg-cyan-600 text-white" : "bg-slate-100 text-slate-600"}`}>{active ? "Selected" : "Choose this option"}</div>
                  </button>;
                })}
              </div>
            </section>
          )}

          {addOns.length > 0 && !closed && (
            <section>
              <div className="border-b border-slate-200 pb-4"><p className="text-xs font-black uppercase tracking-[.16em] text-cyan-700">Optional add-ons</p><h2 className="mt-1 text-2xl font-black text-slate-950">Add a little more while we’re there</h2><p className="mt-2 text-sm leading-6 text-slate-500">Choose any extras you want. Your total updates automatically before you approve.</p></div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">{addOns.map((item) => {
                const checked = selectedAddOnIds.includes(item.id);
                return <button type="button" key={item.id} onClick={() => toggleAddOn(item.id)} className={`flex items-start justify-between gap-4 rounded-2xl border p-4 text-left transition ${checked ? "border-cyan-400 bg-cyan-50" : "border-slate-200 hover:border-cyan-300"}`}><div className="flex gap-3"><div className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border ${checked ? "border-cyan-600 bg-cyan-600 text-white" : "border-slate-300 bg-white"}`}>{checked && <CheckCircle2 className="h-4 w-4" />}</div><div><p className="font-black text-slate-900">{item.name}</p>{item.description && <p className="mt-1 text-xs leading-5 text-slate-500">{item.description}</p>}</div></div><strong className="shrink-0 text-slate-950">+{money(itemTotal(item))}</strong></button>;
              })}</div>
            </section>
          )}

          <section>
            <div className="border-b border-slate-200 pb-4"><p className="text-xs font-black uppercase tracking-[.16em] text-cyan-700">Scope & pricing</p><h2 className="mt-1 text-2xl font-black text-slate-950">What’s included</h2>{packageMode && selectedPackage && <p className="mt-2 text-sm font-bold text-cyan-800">Selected: {selectedPackage.name}</p>}</div>
            <div className="divide-y divide-slate-100">
              {selectedScopeItems.map((item) => <div key={item.id} className="grid grid-cols-[1fr_auto] gap-5 py-5 sm:py-6"><div className="flex gap-3"><div className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-cyan-50"><CheckCircle2 className="h-4 w-4 text-cyan-700" /></div><div><p className="font-black text-slate-900">{item.name}{item.optional && <span className="ml-2 rounded-full bg-cyan-50 px-2 py-1 text-[10px] uppercase tracking-wide text-cyan-800">Add-on</span>}</p>{item.description && <p className="mt-2 text-sm leading-6 text-slate-500">{item.description}</p>}<p className="mt-2 text-xs font-bold text-slate-400">{Number(item.quantity)} × {money(item.unit_price)}</p></div></div><p className="font-black text-slate-900">{money(itemTotal(item))}</p></div>)}
            </div>
            <div className="ml-auto mt-4 max-w-md rounded-2xl bg-[#08243f] p-5 text-white sm:p-6">
              <div className="grid gap-2 text-sm"><div className="flex justify-between text-slate-300"><span>Subtotal</span><span>{money(selectedSubtotal)}</span></div>{quote.discount_amount > 0 && <div className="flex justify-between text-slate-300"><span>Discount</span><span>-{money(quote.discount_amount)}</span></div>}{selectedTax > 0 && <div className="flex justify-between text-slate-300"><span>Sales tax ({Number(quote.tax_rate || 0).toFixed(2)}%)</span><span>{money(selectedTax)}</span></div>}{quote.tax_exempt && <div className="flex justify-between text-slate-300"><span>Sales tax</span><span>Exempt</span></div>}<div className="mt-2 flex items-end justify-between border-t border-white/15 pt-4"><span className="font-bold text-slate-200">Your total</span><strong className="text-3xl">{money(selectedTotal)}</strong></div></div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 p-5"><ShieldCheck className="h-5 w-5 text-cyan-700" /><h3 className="mt-4 font-black text-slate-950">Clear scope first</h3><p className="mt-2 text-sm leading-6 text-slate-500">We confirm the agreed cleaning areas and price before service begins.</p></div>
            <div className="rounded-2xl border border-slate-200 p-5"><Sparkles className="h-5 w-5 text-cyan-700" /><h3 className="mt-4 font-black text-slate-950">Surface-appropriate cleaning</h3><p className="mt-2 text-sm leading-6 text-slate-500">The cleaning approach is matched to the surface and condition instead of using maximum pressure everywhere.</p></div>
            <div className="rounded-2xl border border-slate-200 p-5"><CheckCircle2 className="h-5 w-5 text-cyan-700" /><h3 className="mt-4 font-black text-slate-950">Final rinse & inspection</h3><p className="mt-2 text-sm leading-6 text-slate-500">We rinse the work area and inspect the agreed surfaces before wrapping up.</p></div>
          </section>

          {quote.status === "changes_requested" && <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6"><MessageSquareText className="h-6 w-6 text-amber-700" /><h2 className="mt-3 text-xl font-black text-amber-950">Changes requested</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-amber-900">RinsePoint has your request. Approval is paused while we prepare the revised quote; you’ll receive an updated link when it’s ready.</p></section>}

          {!closed && (
            <section className="rounded-3xl border border-cyan-200 bg-gradient-to-br from-cyan-50 to-white p-5 sm:p-7">
              <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-cyan-700" /><div><p className="text-xs font-black uppercase tracking-[.16em] text-cyan-700">Ready to move forward?</p><h2 className="mt-1 text-2xl font-black text-slate-950">Approve your RinsePoint quote</h2><p className="mt-2 text-sm leading-6 text-slate-600">Enter your name to confirm the selected scope and total shown above. We’ll then follow up to schedule the service.</p></div></div>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" className="mt-5 w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 outline-none focus:border-cyan-600" />
              <button disabled={Boolean(busy) || (packageMode && !selectedPackage)} onClick={() => act("approve")} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-4 font-black text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-50">{busy === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />} {packageMode && selectedPackage ? `Approve ${selectedPackage.name}` : "Approve quote"} · {money(selectedTotal)}</button>

              <details className="mt-5 border-t border-cyan-100 pt-5">
                <summary className="cursor-pointer font-black text-slate-700">Need a change or don’t want to move forward?</summary>
                <textarea value={changeMessage} onChange={(e) => setChangeMessage(e.target.value)} rows="3" placeholder="Tell us what you’d like changed (optional if declining)." className="mt-4 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-cyan-600" />
                <div className="mt-3 grid gap-3 sm:grid-cols-2"><button disabled={Boolean(busy)} onClick={() => act("request_changes")} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-700"><MessageSquareText className="h-4 w-4" /> Request changes</button><button disabled={Boolean(busy)} onClick={() => act("decline")} className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-500">Decline quote</button></div>
              </details>
            </section>
          )}

          {quote.status === "approved" && <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-7 text-center"><CheckCircle2 className="mx-auto h-10 w-10 text-emerald-700" /><h2 className="mt-3 text-2xl font-black text-emerald-950">Quote approved</h2><p className="mt-2 text-sm leading-6 text-emerald-800">RinsePoint has been notified and will follow up about scheduling.</p></section>}
          {quote.status === "declined" && <section className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center"><h2 className="text-xl font-black text-slate-900">Quote declined</h2><p className="mt-2 text-sm text-slate-600">If you change your mind or want a different scope, contact RinsePoint and we’ll be happy to help.</p></section>}
          {quote.status === "expired" && <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center"><h2 className="text-xl font-black text-amber-950">This quote has expired</h2><p className="mt-2 text-sm text-amber-900">Contact RinsePoint and we can prepare an updated quote.</p></section>}

          <footer className="grid gap-5 border-t border-slate-200 pt-7 text-center sm:grid-cols-[1fr_auto] sm:text-left">
            <div><p className="font-black text-slate-900">{organization?.name || "RinsePoint Exterior Cleaning"}</p><p className="mt-1 text-sm text-slate-500">Clean starts here. · Allen, Texas & nearby communities</p></div>
            <div className="flex flex-wrap justify-center gap-3 sm:justify-end"><a href={phoneHref(phone)} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-black text-slate-700"><Phone className="h-4 w-4" /> {phone}</a><a href="/contact/" className="inline-flex items-center gap-2 rounded-xl bg-[#08243f] px-4 py-2.5 text-sm font-black text-white">Contact us <ArrowRight className="h-4 w-4" /></a></div>
          </footer>
        </div>
      </div>
    </main>
  );
}
