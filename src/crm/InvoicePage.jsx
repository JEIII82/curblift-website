import { useEffect, useState } from "react";
import { Copy, CreditCard, Loader2, Mail, ReceiptText } from "lucide-react";
import { getInvoiceDetails, getInvoices, invoiceAdmin } from "./api.js";

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

function statusLabel(status) {
  return {
    draft: "Draft",
    sent: "Sent",
    partially_paid: "Partially Paid",
    paid: "Paid",
    overdue: "Overdue",
    void: "Void",
  }[status] || status;
}

function badgeClass(status) {
  if (status === "paid") return "bg-emerald-50 text-emerald-700";
  if (status === "overdue") return "bg-red-50 text-red-700";
  if (status === "partially_paid") return "bg-amber-50 text-amber-700";
  if (status === "sent") return "bg-blue-50 text-blue-700";
  return "bg-slate-100 text-slate-600";
}

function publicLink(token) {
  return `${window.location.origin}/invoice/?token=${token}`;
}

function InvoiceDetail({ session, invoiceId, onBack, onOpenCustomer }) {
  const [invoice, setInvoice] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [payment, setPayment] = useState({ amount: "", method: "cash", notes: "" });

  async function load() {
    const data = await getInvoiceDetails(session, invoiceId);
    setInvoice(data);
    if (data) setPayment((current) => ({ ...current, amount: String(data.amount_due || "") }));
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [invoiceId, session]);

  async function act(action, extra = {}) {
    setBusy(action);
    setError("");
    setNotice("");
    try {
      const result = await invoiceAdmin(session, { action, invoiceId, ...extra });
      if (action === "send") setNotice("Invoice sent to the customer.");
      if (action === "record_payment") setNotice(result.invoice?.status === "paid" ? "Invoice marked paid." : "Payment recorded.");
      if (action === "void") setNotice("Invoice voided.");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  if (!invoice) {
    return error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-5 font-bold text-red-700">{error}</div> : <p className="text-sm font-bold text-slate-500">Loading invoice…</p>;
  }

  const link = invoice.public_token ? publicLink(invoice.public_token) : null;
  const canSend = !["paid","void"].includes(invoice.status);
  const canRecord = Number(invoice.amount_due) > 0 && invoice.status !== "void";

  return (
    <div className="grid gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <button onClick={onBack} className="text-sm font-extrabold text-cyan-800">← Back to invoices</button>
          <h2 className="mt-3 text-3xl font-black text-slate-950">Invoice #{invoice.invoice_number}</h2>
          <p className="mt-1 text-sm text-slate-500">{invoice.job?.title || "RinsePoint service"} · Job #{invoice.job?.job_number || "—"}</p>
        </div>
        <span className={`self-start rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-wide ${badgeClass(invoice.status)}`}>{statusLabel(invoice.status)}</span>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}
      {notice && <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-sm font-bold text-cyan-900">{notice}</div>}

      <div className="grid gap-6 xl:grid-cols-[1fr_.72fr]">
        <section className="grid gap-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <p className="text-xs font-black uppercase tracking-[.14em] text-slate-400">Bill to</p>
                <button type="button" onClick={() => onOpenCustomer?.(invoice.customer?.id)} className="mt-2 text-left font-black text-slate-900 hover:text-cyan-800">{invoice.job?.lead?.submitted_name || invoice.customer?.display_name}</button>
                <p className="mt-1 text-sm text-slate-500">{invoice.job?.lead?.submitted_email || invoice.customer?.email || "No email"}</p>
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[.14em] text-slate-400">Service address</p>
                <p className="mt-2 font-bold leading-6 text-slate-800">
                  {invoice.property?.address_line1}<br />
                  {invoice.property?.address_line2 && <>{invoice.property.address_line2}<br /></>}
                  {invoice.property?.city}, {invoice.property?.state} {invoice.property?.postal_code}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-black text-slate-950">Invoice items</h3>
            <div className="mt-4 divide-y divide-slate-100">
              {(invoice.items || []).map((item) => (
                <div key={item.id} className="grid grid-cols-[1fr_auto] gap-5 py-4">
                  <div>
                    <p className="font-black text-slate-900">{item.name}</p>
                    {item.description && <p className="mt-1 text-sm text-slate-500">{item.description}</p>}
                    <p className="mt-2 text-xs font-bold text-slate-400">{Number(item.quantity)} × {money(item.unit_price)}</p>
                  </div>
                  <p className="font-black text-slate-900">{money(item.line_total)}</p>
                </div>
              ))}
            </div>
            <div className="ml-auto mt-5 max-w-sm border-t border-slate-200 pt-4">
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between text-slate-500"><span>Subtotal</span><strong className="text-slate-900">{money(invoice.subtotal)}</strong></div>
                {Number(invoice.discount_amount) > 0 && <div className="flex justify-between text-slate-500"><span>Discount</span><strong className="text-slate-900">-{money(invoice.discount_amount)}</strong></div>}
                {Number(invoice.tax_amount) > 0 && <div className="flex justify-between text-slate-500"><span>Sales tax ({Number(invoice.tax_rate || 0).toFixed(2)}%)</span><strong className="text-slate-900">{money(invoice.tax_amount)}</strong></div>}
                {invoice.tax_exempt && <div className="flex justify-between text-slate-500"><span>Sales tax</span><strong className="text-slate-900">Exempt</strong></div>}
                <div className="flex justify-between border-t border-slate-200 pt-3 text-slate-700"><span className="font-bold">Total</span><strong className="text-slate-900">{money(invoice.total)}</strong></div>
                <div className="flex justify-between text-slate-500"><span>Paid</span><strong className="text-slate-900">{money(invoice.amount_paid)}</strong></div>
                <div className="flex justify-between border-t border-slate-200 pt-3 text-lg"><span className="font-black">Amount due</span><strong className="text-2xl font-black">{money(invoice.amount_due)}</strong></div>
              </div>
            </div>
          </div>

          {(invoice.payments || []).length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-black text-slate-950">Payments</h3>
              <div className="mt-4 divide-y divide-slate-100">
                {invoice.payments.map((p) => <div key={p.id} className="flex items-center justify-between gap-4 py-4"><div><p className="font-black text-slate-900">{money(p.amount)}</p><p className="mt-1 text-xs text-slate-500">{p.method || "other"} · {formatDate(p.paid_at, true)}</p></div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700">Paid</span></div>)}
              </div>
            </div>
          )}
        </section>

        <aside className="grid gap-6 self-start xl:sticky xl:top-28">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2"><ReceiptText className="h-5 w-5 text-cyan-700" /><h3 className="text-lg font-black text-slate-950">Invoice actions</h3></div>
            <div className="mt-5 grid gap-3">
              {canSend && <button disabled={Boolean(busy)} onClick={() => act("send")} className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-3.5 font-black text-white disabled:opacity-50">{busy === "send" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-5 w-5" />} {invoice.status === "draft" ? "Send invoice" : "Resend invoice"}</button>}
              {link && invoice.status !== "draft" && <button onClick={() => navigator.clipboard.writeText(link).then(() => setNotice("Invoice link copied."))} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-3 font-black text-slate-800"><Copy className="h-4 w-4" /> Copy invoice link</button>}
            </div>
            <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm">
              <p className="font-black text-slate-900">Due {formatDate(invoice.due_at)}</p>
              <p className="mt-1 text-slate-500">{money(invoice.amount_due)} remaining</p>
            </div>
          </div>

          {canRecord && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-cyan-700" /><h3 className="text-lg font-black text-slate-950">Record payment</h3></div>
              <label className="mt-5 grid gap-2 text-sm font-extrabold text-slate-700">Amount
                <input type="number" min="0.01" step="0.01" value={payment.amount} onChange={(e) => setPayment((current) => ({ ...current, amount: e.target.value }))} className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-cyan-600" />
              </label>
              <label className="mt-4 grid gap-2 text-sm font-extrabold text-slate-700">Method
                <select value={payment.method} onChange={(e) => setPayment((current) => ({ ...current, method: e.target.value }))} className="rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-cyan-600">
                  <option value="cash">Cash</option>
                  <option value="check">Check</option>
                  <option value="card">Card</option>
                  <option value="ach">ACH</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="mt-4 grid gap-2 text-sm font-extrabold text-slate-700">Notes
                <textarea rows="3" value={payment.notes} onChange={(e) => setPayment((current) => ({ ...current, notes: e.target.value }))} className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-cyan-600" />
              </label>
              <button disabled={Boolean(busy)} onClick={() => act("record_payment", { amount: Number(payment.amount || 0), method: payment.method, notes: payment.notes })} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3.5 font-black text-white disabled:opacity-50">{busy === "record_payment" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-5 w-5" />} Record payment</button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

export default function InvoicePage({ session, initialInvoiceId, onInitialInvoiceHandled, onOpenCustomer }) {
  const [rows, setRows] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getInvoices(session).then(setRows).catch((err) => setError(err.message));
  }, [session, selected]);

  useEffect(() => {
    if (!initialInvoiceId) return;
    setSelected(initialInvoiceId);
    onInitialInvoiceHandled?.();
  }, [initialInvoiceId, onInitialInvoiceHandled]);

  if (selected) return <InvoiceDetail session={session} invoiceId={selected} onBack={() => setSelected(null)} onOpenCustomer={onOpenCustomer} />;
  if (error) return <div className="rounded-2xl border border-red-200 bg-red-50 p-5 font-bold text-red-700">{error}</div>;
  if (!rows) return <p className="text-sm font-bold text-slate-500">Loading invoices…</p>;

  if (!rows.length) {
    return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><p className="text-lg font-black text-slate-900">No invoices yet</p><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">Completing a job automatically creates a draft invoice.</p></div>;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-[900px] w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs font-black uppercase tracking-[.12em] text-slate-400"><tr><th className="px-5 py-4">Invoice</th><th className="px-5 py-4">Customer</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Total</th><th className="px-5 py-4">Due</th><th className="px-5 py-4"></th></tr></thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((invoice) => (
            <tr key={invoice.id} role="button" tabIndex={0} onClick={() => setSelected(invoice.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelected(invoice.id); }} className="cursor-pointer transition hover:bg-slate-50 focus:bg-cyan-50 focus:outline-none">
              <td className="px-5 py-4"><p className="font-black text-slate-900">#{invoice.invoice_number}</p><p className="mt-1 text-xs text-slate-500">{invoice.job?.title || "RinsePoint service"}</p></td>
              <td className="px-5 py-4"><button type="button" onClick={(event) => { event.stopPropagation(); onOpenCustomer?.(invoice.customer?.id); }} className="text-left hover:text-cyan-800"><p className="font-bold text-slate-800">{invoice.job?.lead?.submitted_name || invoice.customer?.display_name || "—"}</p><p className="mt-1 text-xs text-slate-500">{invoice.job?.lead?.submitted_email || invoice.customer?.email || "—"}</p></button></td>
              <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-black ${badgeClass(invoice.status)}`}>{statusLabel(invoice.status)}</span></td>
              <td className="px-5 py-4 font-black text-slate-900">{money(invoice.total)}</td>
              <td className="px-5 py-4"><p className="font-black text-slate-800">{money(invoice.amount_due)}</p><p className="mt-1 text-xs text-slate-500">{formatDate(invoice.due_at)}</p></td>
              <td className="px-5 py-4 text-right"><button onClick={(event) => { event.stopPropagation(); setSelected(invoice.id); }} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-black text-slate-700">Open</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
