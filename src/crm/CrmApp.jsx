import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  FileText,
  Gauge,
  LogOut,
  Menu,
  Search,
  Settings,
  Users,
  X,
} from "lucide-react";
import {
  claimOwner,
  getAppointments,
  getCustomers,
  getDashboard,
  getInvoices,
  getJobs,
  getLeads,
  getQuotes,
  getServices,
  getStoredSession,
  signIn,
  signOut,
  signUp,
  updateLeadStatus,
} from "./api.js";

const sections = [
  ["dashboard", "Dashboard", Gauge],
  ["leads", "Leads", ClipboardList],
  ["customers", "Customers", Users],
  ["quotes", "Quotes", FileText],
  ["jobs", "Jobs", BriefcaseBusiness],
  ["calendar", "Calendar", CalendarDays],
  ["invoices", "Invoices", CircleDollarSign],
  ["services", "Pricebook", Settings],
];

const statusLabel = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  quote_needed: "Quote Needed",
  closed_won: "Won",
  closed_lost: "Lost",
  do_not_contact: "Do Not Contact",
};

function formatMoney(value) {
  if (value === null || value === undefined || value === "") return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value));
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

function StatusBadge({ children }) {
  return <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-extrabold text-slate-600">{children}</span>;
}

function EmptyState({ title, text }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <p className="text-lg font-black text-slate-900">{title}</p>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">{text}</p>
    </div>
  );
}

function Login({ onSession }) {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("curbliftclean@gmail.com");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (mode === "signup") {
        const result = await signUp(email, password);
        if (result?.access_token) onSession(result);
        else setNotice("Account created. Check your email for the confirmation link, then come back and sign in.");
      } else {
        onSession(await signIn(email, password));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#eef5f8] px-5 py-14">
      <div className="mx-auto grid min-h-[75vh] max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl lg:grid-cols-[1.05fr_.95fr]">
        <section className="hidden bg-[#08243f] p-12 text-white lg:block">
          <img src="/rinsepoint-logo-white.svg" alt="RinsePoint" className="w-56" />
          <p className="mt-16 text-xs font-black uppercase tracking-[.22em] text-cyan-300">RinsePoint OS</p>
          <h1 className="mt-4 text-5xl font-black leading-tight">Run the business from one place.</h1>
          <p className="mt-5 max-w-md text-lg leading-8 text-slate-300">
            Leads, quotes, jobs, customers, scheduling, invoices, photos, communication, and automations built around RinsePoint.
          </p>
        </section>
        <section className="flex items-center p-7 sm:p-12">
          <div className="w-full">
            <div className="lg:hidden"><img src="/rinsepoint-logo.svg" alt="RinsePoint" className="w-52" /></div>
            <p className="mt-8 text-xs font-black uppercase tracking-[.2em] text-cyan-700 lg:mt-0">Owner access</p>
            <h2 className="mt-3 text-3xl font-black text-slate-950">{mode === "signin" ? "Sign in to RinsePoint OS" : "Create your owner account"}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">Use the RinsePoint business email account. The first authorized account becomes the owner.</p>
            <form className="mt-8 grid gap-5" onSubmit={submit}>
              <label className="grid gap-2 text-sm font-extrabold text-slate-700">
                Email
                <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required autoComplete="email" className="rounded-xl border border-slate-300 px-4 py-3 font-medium outline-none focus:border-cyan-600" />
              </label>
              <label className="grid gap-2 text-sm font-extrabold text-slate-700">
                Password
                <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" minLength={8} required autoComplete={mode === "signin" ? "current-password" : "new-password"} className="rounded-xl border border-slate-300 px-4 py-3 font-medium outline-none focus:border-cyan-600" />
              </label>
              {error && <div className="rounded-xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}
              {notice && <div className="rounded-xl bg-cyan-50 p-4 text-sm font-bold text-cyan-900">{notice}</div>}
              <button disabled={busy} className="rounded-xl bg-[#08243f] px-5 py-3.5 font-black text-white disabled:opacity-50">{busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}</button>
            </form>
            <button onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); setNotice(""); }} className="mt-5 text-sm font-extrabold text-cyan-800">
              {mode === "signin" ? "First time here? Create the owner account" : "Already created it? Sign in"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

function Sidebar({ active, setActive, open, setOpen, logout }) {
  return (
    <>
      {open && <button aria-label="Close menu" className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden" onClick={() => setOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-40 w-72 border-r border-white/10 bg-[#08243f] text-white transition-transform lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-20 items-center border-b border-white/10 px-6"><img src="/rinsepoint-logo-white.svg" alt="RinsePoint" className="w-48" /></div>
        <nav className="p-4">
          <p className="px-3 pb-3 pt-2 text-[10px] font-black uppercase tracking-[.2em] text-slate-500">RinsePoint OS</p>
          <div className="grid gap-1">
            {sections.map(([id, label, Icon]) => (
              <button key={id} onClick={() => { setActive(id); setOpen(false); }} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-extrabold transition ${active === id ? "bg-cyan-500 text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}>
                <Icon className="h-5 w-5" /> {label}
              </button>
            ))}
          </div>
        </nav>
        <div className="absolute inset-x-4 bottom-4">
          <button onClick={logout} className="flex w-full items-center gap-3 rounded-xl border border-white/10 px-3 py-3 text-sm font-extrabold text-slate-300 hover:bg-white/10 hover:text-white"><LogOut className="h-5 w-5" /> Sign out</button>
        </div>
      </aside>
    </>
  );
}

function PageHeader({ title, eyebrow, onMenu }) {
  return (
    <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-slate-200 bg-white/95 px-5 backdrop-blur lg:px-8">
      <div className="flex items-center gap-4">
        <button onClick={onMenu} className="rounded-xl border border-slate-200 p-2.5 lg:hidden"><Menu className="h-5 w-5" /></button>
        <div><p className="text-[10px] font-black uppercase tracking-[.2em] text-cyan-700">{eyebrow}</p><h1 className="text-xl font-black text-slate-950 sm:text-2xl">{title}</h1></div>
      </div>
      <a href="/" className="hidden text-sm font-extrabold text-slate-500 hover:text-cyan-700 sm:block">View website ↗</a>
    </header>
  );
}

function Dashboard({ session }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { getDashboard(session).then(setData).catch((e) => setError(e.message)); }, [session]);
  if (error) return <EmptyState title="Dashboard couldn't load" text={error} />;
  if (!data) return <p className="text-sm font-bold text-slate-500">Loading dashboard…</p>;
  const cards = [
    ["New leads", data.newLeads, "Needs attention"],
    ["Open quotes", data.openQuotes, "Waiting on customers"],
    ["Active jobs", data.scheduledJobs, "Scheduled or underway"],
    ["Unpaid invoices", data.unpaidInvoices, "Needs collection"],
  ];
  return (
    <div className="grid gap-7">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value, note]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-black uppercase tracking-[.16em] text-slate-400">{label}</p><p className="mt-3 text-4xl font-black text-slate-950">{value}</p><p className="mt-2 text-sm text-slate-500">{note}</p></div>)}
      </div>
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 p-5"><div><h2 className="font-black text-slate-950">Recent leads</h2><p className="mt-1 text-sm text-slate-500">Newest requests entering RinsePoint.</p></div></div>
        {data.recentLeads.length ? <div className="divide-y divide-slate-100">{data.recentLeads.map((lead) => <div key={lead.id} className="flex items-center justify-between gap-4 p-5"><div><p className="font-black text-slate-900">{lead.customer?.display_name || "New customer"}</p><p className="mt-1 text-sm text-slate-500">{lead.requested_service || "Service not set"} · {lead.service_city || "Location pending"}</p></div><div className="flex items-center gap-3"><StatusBadge>{statusLabel[lead.status] || lead.status}</StatusBadge><ChevronRight className="h-4 w-4 text-slate-300" /></div></div>)}</div> : <div className="p-6"><EmptyState title="No leads yet" text="Your next website quote request will appear here automatically." /></div>}
      </section>
    </div>
  );
}

function Leads({ session }) {
  const [rows, setRows] = useState(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(() => getLeads(session).then(setRows).catch((e) => setError(e.message)), [session]);
  useEffect(() => { load(); }, [load]);
  const filtered = useMemo(() => (rows || []).filter((lead) => [lead.customer?.display_name, lead.customer?.email, lead.customer?.phone, lead.requested_service, lead.service_city].join(" ").toLowerCase().includes(query.toLowerCase())), [rows, query]);

  async function changeStatus(id, status) {
    setRows((current) => current.map((row) => row.id === id ? { ...row, status } : row));
    try { await updateLeadStatus(session, id, status); } catch (e) { setError(e.message); load(); }
  }

  if (error && !rows) return <EmptyState title="Leads couldn't load" text={error} />;
  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block max-w-md flex-1"><Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search leads…" className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-cyan-600" /></label>
        <div className="text-sm font-bold text-slate-500">{rows ? `${filtered.length} lead${filtered.length === 1 ? "" : "s"}` : "Loading…"}</div>
      </div>
      {error && <div className="rounded-xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}
      {!rows ? <p className="text-sm font-bold text-slate-500">Loading leads…</p> : filtered.length ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-[900px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black uppercase tracking-[.12em] text-slate-400"><tr><th className="px-5 py-4">Customer</th><th className="px-5 py-4">Service</th><th className="px-5 py-4">City</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Received</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{filtered.map((lead) => <tr key={lead.id} className="hover:bg-slate-50/70"><td className="px-5 py-4"><p className="font-black text-slate-900">{lead.customer?.display_name || "Unknown"}</p><p className="mt-1 text-xs text-slate-500">{lead.customer?.email || lead.customer?.phone || "No contact info"}</p></td><td className="px-5 py-4 font-bold text-slate-700">{lead.requested_service || "—"}</td><td className="px-5 py-4 text-slate-600">{lead.service_city || "—"}</td><td className="px-5 py-4"><select value={lead.status} onChange={(e) => changeStatus(lead.id, e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-700">{Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td><td className="px-5 py-4 text-slate-500">{formatDate(lead.created_at, true)}</td></tr>)}</tbody>
          </table>
        </div>
      ) : <EmptyState title="No matching leads" text="Try a different search, or wait for the next website request." />}
    </div>
  );
}

function SimpleTable({ rows, columns, emptyTitle, emptyText }) {
  if (!rows) return <p className="text-sm font-bold text-slate-500">Loading…</p>;
  if (!rows.length) return <EmptyState title={emptyTitle} text={emptyText} />;
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-[780px] w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs font-black uppercase tracking-[.12em] text-slate-400"><tr>{columns.map((column) => <th key={column.label} className="px-5 py-4">{column.label}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">{rows.map((row) => <tr key={row.id} className="hover:bg-slate-50/70">{columns.map((column) => <td key={column.label} className="px-5 py-4">{column.render(row)}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

function DataPage({ session, loader, type }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { loader(session).then(setRows).catch((e) => setError(e.message)); }, [session, loader]);
  if (error) return <EmptyState title={`${type} couldn't load`} text={error} />;

  const configs = {
    Customers: {
      empty: ["No customers yet", "Customers will be created automatically as new leads arrive."],
      columns: [
        { label: "Customer", render: (r) => <span className="font-black text-slate-900">{r.display_name}</span> },
        { label: "Email", render: (r) => <span className="text-slate-600">{r.email || "—"}</span> },
        { label: "Phone", render: (r) => <span className="text-slate-600">{r.phone || "—"}</span> },
        { label: "Source", render: (r) => <StatusBadge>{r.lead_source || "—"}</StatusBadge> },
        { label: "Created", render: (r) => <span className="text-slate-500">{formatDate(r.created_at)}</span> },
      ],
    },
    Quotes: {
      empty: ["No quotes yet", "Quote creation is the next workflow we’ll connect to your leads."],
      columns: [
        { label: "Quote", render: (r) => <span className="font-black text-slate-900">#{r.quote_number}</span> },
        { label: "Customer", render: (r) => <span className="font-bold">{r.customer?.display_name || "—"}</span> },
        { label: "Status", render: (r) => <StatusBadge>{r.status}</StatusBadge> },
        { label: "Total", render: (r) => <span className="font-black">{formatMoney(r.total)}</span> },
        { label: "Expires", render: (r) => <span className="text-slate-500">{formatDate(r.expires_at)}</span> },
      ],
    },
    Jobs: {
      empty: ["No jobs yet", "Approved quotes will become jobs here."],
      columns: [
        { label: "Job", render: (r) => <span className="font-black text-slate-900">#{r.job_number} · {r.title}</span> },
        { label: "Customer", render: (r) => <span className="font-bold">{r.customer?.display_name || "—"}</span> },
        { label: "Property", render: (r) => <span className="text-slate-600">{r.property ? `${r.property.address_line1}, ${r.property.city}` : "—"}</span> },
        { label: "Status", render: (r) => <StatusBadge>{r.status}</StatusBadge> },
        { label: "Scheduled", render: (r) => <span className="text-slate-500">{formatDate(r.scheduled_start, true)}</span> },
      ],
    },
    Calendar: {
      empty: ["Nothing scheduled yet", "Appointments and jobs will show here as soon as they are booked."],
      columns: [
        { label: "When", render: (r) => <span className="font-black text-slate-900">{formatDate(r.starts_at, true)}</span> },
        { label: "Customer", render: (r) => <span className="font-bold">{r.customer?.display_name || "—"}</span> },
        { label: "Location", render: (r) => <span className="text-slate-600">{r.property ? `${r.property.address_line1}, ${r.property.city}` : "—"}</span> },
        { label: "Type", render: (r) => <StatusBadge>{r.appointment_type}</StatusBadge> },
        { label: "Status", render: (r) => <StatusBadge>{r.status}</StatusBadge> },
      ],
    },
    Invoices: {
      empty: ["No invoices yet", "Completed jobs will flow into invoicing here."],
      columns: [
        { label: "Invoice", render: (r) => <span className="font-black text-slate-900">#{r.invoice_number}</span> },
        { label: "Customer", render: (r) => <span className="font-bold">{r.customer?.display_name || "—"}</span> },
        { label: "Status", render: (r) => <StatusBadge>{r.status}</StatusBadge> },
        { label: "Total", render: (r) => <span className="font-black">{formatMoney(r.total)}</span> },
        { label: "Due", render: (r) => <span className="font-bold text-slate-700">{formatMoney(r.amount_due)}</span> },
      ],
    },
    Pricebook: {
      empty: ["Pricebook is empty", "Add your services and reusable pricing here."],
      columns: [
        { label: "Service", render: (r) => <div><p className="font-black text-slate-900">{r.name}</p><p className="mt-1 text-xs text-slate-500">{r.category || "Service"}</p></div> },
        { label: "Pricing", render: (r) => <StatusBadge>{r.pricing_model}</StatusBadge> },
        { label: "Base price", render: (r) => <span className="font-black">{formatMoney(r.base_price)}</span> },
        { label: "Status", render: (r) => <StatusBadge>{r.active ? "Active" : "Inactive"}</StatusBadge> },
      ],
    },
  };
  const config = configs[type];
  return <SimpleTable rows={rows} columns={config.columns} emptyTitle={config.empty[0]} emptyText={config.empty[1]} />;
}

export default function CrmApp() {
  const [session, setSession] = useState(() => getStoredSession());
  const [active, setActive] = useState("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const [booting, setBooting] = useState(Boolean(session));
  const [bootError, setBootError] = useState("");

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "RinsePoint OS";
    let robots = document.querySelector('meta[name="robots"]');
    const created = !robots;
    if (!robots) { robots = document.createElement("meta"); robots.name = "robots"; document.head.appendChild(robots); }
    const previousRobots = robots.content;
    robots.content = "noindex,nofollow";
    return () => {
      document.title = previousTitle;
      if (created) robots.remove();
      else robots.content = previousRobots;
    };
  }, []);

  useEffect(() => {
    if (!session) { setBooting(false); return; }
    setBooting(true);
    setBootError("");
    claimOwner(session)
      .catch((err) => setBootError(err.message))
      .finally(() => setBooting(false));
  }, [session]);

  async function logout() {
    await signOut(session);
    setSession(null);
  }

  if (!session) return <Login onSession={setSession} />;
  if (booting) return <main className="grid min-h-screen place-items-center bg-slate-50"><p className="font-black text-slate-500">Opening RinsePoint OS…</p></main>;
  if (bootError) return <main className="grid min-h-screen place-items-center bg-slate-50 p-5"><div className="max-w-lg rounded-2xl border border-red-200 bg-white p-8 shadow-sm"><h1 className="text-2xl font-black text-slate-950">Access needs attention</h1><p className="mt-3 leading-7 text-slate-600">{bootError}</p><button onClick={logout} className="mt-6 rounded-xl bg-slate-950 px-5 py-3 font-black text-white">Sign out</button></div></main>;

  const titles = Object.fromEntries(sections.map(([id, label]) => [id, label]));
  return (
    <div className="min-h-screen bg-[#f4f7f9] text-slate-950">
      <Sidebar active={active} setActive={setActive} open={menuOpen} setOpen={setMenuOpen} logout={logout} />
      <div className="lg:pl-72">
        <PageHeader title={titles[active]} eyebrow="RinsePoint OS" onMenu={() => setMenuOpen(true)} />
        <main className="mx-auto max-w-[1500px] p-5 lg:p-8">
          {active === "dashboard" && <Dashboard session={session} />}
          {active === "leads" && <Leads session={session} />}
          {active === "customers" && <DataPage session={session} loader={getCustomers} type="Customers" />}
          {active === "quotes" && <DataPage session={session} loader={getQuotes} type="Quotes" />}
          {active === "jobs" && <DataPage session={session} loader={getJobs} type="Jobs" />}
          {active === "calendar" && <DataPage session={session} loader={getAppointments} type="Calendar" />}
          {active === "invoices" && <DataPage session={session} loader={getInvoices} type="Invoices" />}
          {active === "services" && <DataPage session={session} loader={getServices} type="Pricebook" />}
        </main>
      </div>
    </div>
  );
}
