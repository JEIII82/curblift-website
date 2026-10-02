import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, MessageSquareText, ShieldCheck } from "lucide-react";
import { getPublicQuote, publicQuoteAction } from "../publicApi.js";

function money(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value || 0));
}

function statusText(status) {
  return {
    sent: "Ready for review",
    viewed: "Ready for review",
    changes_requested: "Changes requested",
    approved: "Approved",
    declined: "Declined",
    expired: "Expired",
  }[status] || status;
}

export default function PublicQuotePage() {
  const token = new URLSearchParams(window.location.search).get("token") || "";
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [name, setName] = useState("");
  const [changeMessage, setChangeMessage] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    document.title = "Your RinsePoint Quote";
    getPublicQuote(token).then(setData).catch((err) => setError(err.message));
  }, [token]);

  const includedItems = useMemo(() => (data?.quote?.items || []).filter((item) => !item.optional || item.selected), [data]);

  async function act(action) {
    setBusy(action);
    setError("");
    try {
      const result = await publicQuoteAction(token, action, {
        name,
        message: changeMessage,
      });
      setData((current) => ({ ...current, quote: { ...current.quote, status: result.status } }));
      if (action === "approve") setNotice("Quote approved. RinsePoint will follow up to schedule your service.");
      if (action === "decline") setNotice("Thanks for letting us know. RinsePoint has been notified.");
      if (action === "request_changes") setNotice("Your requested changes were sent to RinsePoint.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  if (!token) return <main className="grid min-h-screen place-items-center bg-slate-50 p-5"><p className="font-black text-slate-700">This quote link is incomplete.</p></main>;
  if (!data && !error) return <main className="grid min-h-screen place-items-center bg-slate-50"><Loader2 className="h-8 w-8 animate-spin text-cyan-700" /></main>;
  if (error && !data) return <main className="grid min-h-screen place-items-center bg-slate-50 p-5"><div className="max-w-lg rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm"><h1 className="text-2xl font-black text-slate-950">Quote unavailable</h1><p className="mt-3 text-slate-600">{error}</p></div></main>;

  const { quote, organization } = data;
  const closed = ["approved","declined","expired"].includes(quote.status);

  return (
    <main className="min-h-screen bg-[#eef5f8] px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
        <header className="bg-[#08243f] px-6 py-7 text-white sm:px-10">
          <img src="/rinsepoint-logo-white.svg" alt="RinsePoint Exterior Cleaning" className="w-56" />
          <div className="mt-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div><p className="text-xs font-black uppercase tracking-[.2em] text-cyan-300">Quote #{quote.quote_number}</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">{quote.title || "Exterior Cleaning"}</h1><p className="mt-2 text-slate-300">Prepared for {quote.customer?.display_name}</p></div>
            <span className="self-start rounded-full bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-cyan-100 sm:self-auto">{statusText(quote.status)}</span>
          </div>
        </header>

        <div className="grid gap-8 p-6 sm:p-10">
          {notice && <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-5 font-bold text-cyan-950">{notice}</div>}
          {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-5 font-bold text-red-700">{error}</div>}

          <section className="grid gap-5 sm:grid-cols-2">
            <div><p className="text-xs font-black uppercase tracking-[.16em] text-slate-400">Service address</p><p className="mt-2 font-bold leading-7 text-slate-800">{quote.property?.address_line1}<br />{quote.property?.address_line2 && <>{quote.property.address_line2}<br /></>}{quote.property?.city}, {quote.property?.state} {quote.property?.postal_code}</p></div>
            <div><p className="text-xs font-black uppercase tracking-[.16em] text-slate-400">Quote valid through</p><p className="mt-2 font-bold text-slate-800">{quote.expires_at ? new Date(quote.expires_at).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) : "Contact RinsePoint"}</p></div>
          </section>

          {quote.customer_message && <section className="rounded-2xl bg-slate-50 p-5 text-sm leading-7 text-slate-600">{quote.customer_message}</section>}

          <section>
            <div className="border-b border-slate-200 pb-3"><h2 className="text-lg font-black text-slate-950">Scope & pricing</h2></div>
            <div className="divide-y divide-slate-100">
              {includedItems.map((item) => <div key={item.id} className="grid grid-cols-[1fr_auto] gap-5 py-5"><div><p className="font-black text-slate-900">{item.name}{item.optional && <span className="ml-2 rounded-full bg-cyan-50 px-2 py-1 text-[10px] uppercase tracking-wide text-cyan-800">Optional add-on</span>}</p>{item.description && <p className="mt-2 text-sm leading-6 text-slate-500">{item.description}</p>}<p className="mt-2 text-xs font-bold text-slate-400">{Number(item.quantity)} × {money(item.unit_price)}</p></div><p className="font-black text-slate-900">{money(item.line_total)}</p></div>)}
            </div>
            <div className="ml-auto mt-4 max-w-sm border-t border-slate-200 pt-4">
              <div className="grid gap-2 text-sm"><div className="flex justify-between text-slate-500"><span>Subtotal</span><span>{money(quote.subtotal)}</span></div>{quote.discount_amount > 0 && <div className="flex justify-between text-slate-500"><span>Discount</span><span>-{money(quote.discount_amount)}</span></div>}{quote.tax_amount > 0 && <div className="flex justify-between text-slate-500"><span>Sales tax ({Number(quote.tax_rate || 0).toFixed(2)}%)</span><span>{money(quote.tax_amount)}</span></div>}{quote.tax_exempt && <div className="flex justify-between text-slate-500"><span>Sales tax</span><span>Exempt</span></div>}<div className="flex justify-between border-t border-slate-200 pt-3 text-xl"><strong>Total</strong><strong>{money(quote.total)}</strong></div></div>
            </div>
          </section>

          {!closed && (
            <section className="rounded-2xl border border-slate-200 p-5 sm:p-6">
              <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-cyan-700" /><div><h2 className="font-black text-slate-950">Approve this quote</h2><p className="mt-1 text-sm leading-6 text-slate-500">Enter your name to confirm that you approve the scope and total shown above.</p></div></div>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" className="mt-5 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-cyan-600" />
              <button disabled={Boolean(busy)} onClick={() => act("approve")} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-3.5 font-black text-white disabled:opacity-50">{busy === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />} Approve quote</button>

              <details className="mt-5 border-t border-slate-200 pt-5">
                <summary className="font-black text-slate-700">Need a change or don't want to move forward?</summary>
                <textarea value={changeMessage} onChange={(e) => setChangeMessage(e.target.value)} rows="3" placeholder="Tell us what you'd like changed (optional if declining)." className="mt-4 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-cyan-600" />
                <div className="mt-3 grid gap-3 sm:grid-cols-2"><button disabled={Boolean(busy)} onClick={() => act("request_changes")} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-3 text-sm font-black text-slate-700"><MessageSquareText className="h-4 w-4" /> Request changes</button><button disabled={Boolean(busy)} onClick={() => act("decline")} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-black text-slate-500">Decline quote</button></div>
              </details>
            </section>
          )}

          {quote.status === "approved" && <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center"><CheckCircle2 className="mx-auto h-9 w-9 text-emerald-700" /><h2 className="mt-3 text-xl font-black text-emerald-950">Quote approved</h2><p className="mt-2 text-sm leading-6 text-emerald-800">RinsePoint has been notified and will follow up about scheduling.</p></section>}

          <footer className="border-t border-slate-200 pt-6 text-center text-sm text-slate-500">
            <p className="font-black text-slate-800">{organization?.name || "RinsePoint Exterior Cleaning"}</p>
            <p className="mt-1">{organization?.phone} · {organization?.email}</p>
          </footer>
        </div>
      </div>
    </main>
  );
}
