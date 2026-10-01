import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, ReceiptText } from "lucide-react";
import { getPublicInvoice } from "../crm/api.js";

function money(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(new Date(value));
}

export default function PublicInvoicePage() {
  const token = new URLSearchParams(window.location.search).get("token") || "";
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = "Your RinsePoint Invoice";
    getPublicInvoice(token).then(setData).catch((err) => setError(err.message));
  }, [token]);

  if (!token) return <main className="grid min-h-screen place-items-center bg-slate-50 p-5"><p className="font-black text-slate-700">This invoice link is incomplete.</p></main>;
  if (!data && !error) return <main className="grid min-h-screen place-items-center bg-slate-50"><Loader2 className="h-8 w-8 animate-spin text-cyan-700" /></main>;
  if (error) return <main className="grid min-h-screen place-items-center bg-slate-50 p-5"><div className="max-w-lg rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm"><h1 className="text-2xl font-black text-slate-950">Invoice unavailable</h1><p className="mt-3 text-slate-600">{error}</p></div></main>;

  const { invoice, organization } = data;
  const isPaid = invoice.status === "paid";

  return (
    <main className="min-h-screen bg-[#eef5f8] px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
        <header className="bg-[#08243f] px-6 py-7 text-white sm:px-10">
          <img src="/rinsepoint-logo-white.svg" alt="RinsePoint Exterior Cleaning" className="w-56" />
          <div className="mt-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div><p className="text-xs font-black uppercase tracking-[.2em] text-cyan-300">Invoice #{invoice.invoice_number}</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">{invoice.job?.title || "Exterior Cleaning"}</h1><p className="mt-2 text-slate-300">For {invoice.customer?.display_name}</p></div>
            <span className={`self-start rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-wide sm:self-auto ${isPaid ? "bg-emerald-400/20 text-emerald-100" : "bg-white/10 text-cyan-100"}`}>{isPaid ? "Paid" : invoice.status}</span>
          </div>
        </header>

        <div className="grid gap-8 p-6 sm:p-10">
          <section className="grid gap-5 sm:grid-cols-2">
            <div><p className="text-xs font-black uppercase tracking-[.16em] text-slate-400">Service address</p><p className="mt-2 font-bold leading-7 text-slate-800">{invoice.property?.address_line1}<br />{invoice.property?.address_line2 && <>{invoice.property.address_line2}<br /></>}{invoice.property?.city}, {invoice.property?.state} {invoice.property?.postal_code}</p></div>
            <div><p className="text-xs font-black uppercase tracking-[.16em] text-slate-400">Payment due</p><p className="mt-2 font-bold text-slate-800">{formatDate(invoice.due_at)}</p></div>
          </section>

          <section>
            <div className="border-b border-slate-200 pb-3"><h2 className="text-lg font-black text-slate-950">Invoice details</h2></div>
            <div className="divide-y divide-slate-100">
              {(invoice.items || []).map((item) => <div key={item.id} className="grid grid-cols-[1fr_auto] gap-5 py-5"><div><p className="font-black text-slate-900">{item.name}</p>{item.description && <p className="mt-2 text-sm leading-6 text-slate-500">{item.description}</p>}<p className="mt-2 text-xs font-bold text-slate-400">{Number(item.quantity)} × {money(item.unit_price)}</p></div><p className="font-black text-slate-900">{money(item.line_total)}</p></div>)}
            </div>
            <div className="ml-auto mt-4 max-w-sm border-t border-slate-200 pt-4">
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>{money(invoice.subtotal)}</span></div>
                {Number(invoice.discount_amount) > 0 && <div className="flex justify-between text-slate-500"><span>Discount</span><span>-{money(invoice.discount_amount)}</span></div>}
                {Number(invoice.tax_amount) > 0 && <div className="flex justify-between text-slate-500"><span>Sales tax ({Number(invoice.tax_rate || 0).toFixed(2)}%)</span><span>{money(invoice.tax_amount)}</span></div>}
                {invoice.tax_exempt && <div className="flex justify-between text-slate-500"><span>Sales tax</span><span>Exempt</span></div>}
                <div className="flex justify-between border-t border-slate-200 pt-3 text-slate-700"><strong>Total</strong><strong>{money(invoice.total)}</strong></div>
                <div className="flex justify-between text-slate-500"><span>Paid</span><span>{money(invoice.amount_paid)}</span></div>
                <div className="flex justify-between border-t border-slate-200 pt-3 text-xl"><strong>Amount due</strong><strong>{money(invoice.amount_due)}</strong></div>
              </div>
            </div>
          </section>

          {isPaid ? (
            <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center"><CheckCircle2 className="mx-auto h-9 w-9 text-emerald-700" /><h2 className="mt-3 text-xl font-black text-emerald-950">Paid in full</h2><p className="mt-2 text-sm text-emerald-800">Thank you for choosing RinsePoint.</p></section>
          ) : (
            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
              <div className="flex items-start gap-3"><ReceiptText className="mt-0.5 h-5 w-5 text-cyan-700" /><div><h2 className="font-black text-slate-950">Payment</h2><p className="mt-1 text-sm leading-6 text-slate-500">Online payment is being connected. For now, reply to your RinsePoint invoice email or call/text {organization?.phone} to arrange payment.</p></div></div>
            </section>
          )}

          <footer className="border-t border-slate-200 pt-6 text-center text-sm text-slate-500"><p className="font-black text-slate-800">{organization?.name || "RinsePoint Exterior Cleaning"}</p><p className="mt-1">{organization?.phone} · {organization?.email}</p></footer>
        </div>
      </div>
    </main>
  );
}
