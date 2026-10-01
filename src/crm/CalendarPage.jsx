import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  RefreshCw,
} from "lucide-react";
import { getSchedule } from "./api.js";

function startOfWeek(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - date.getDay());
  return date;
}

function addDays(value, days) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function iso(value) {
  return new Date(value).toISOString();
}

function dateKey(value) {
  const date = new Date(value);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function dayLabel(value) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(value);
}

function dayNumber(value) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(value);
}

function time(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function money(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value || 0));
}

function statusLabel(value) {
  if (!value) return "—";
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusClass(value) {
  if (value === "completed") return "border-emerald-200 bg-emerald-50";
  if (value === "in_progress") return "border-amber-200 bg-amber-50";
  if (value === "on_my_way") return "border-cyan-200 bg-cyan-50";
  return "border-slate-200 bg-white";
}

export default function CalendarPage({ session, onOpenJob }) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const result = await getSchedule(session, iso(weekStart), iso(addDays(weekStart, 7)));
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [session, weekStart]);

  const grouped = useMemo(() => {
    const output = Object.fromEntries(days.map((day) => [dateKey(day), []]));
    for (const appointment of data?.appointments || []) {
      const key = dateKey(appointment.starts_at);
      if (output[key]) output[key].push(appointment);
    }
    return output;
  }, [data, days]);

  const rangeLabel = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).formatRange
    ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).formatRange(days[0], days[6])
    : `${dayNumber(days[0])} – ${dayNumber(days[6])}, ${days[6].getFullYear()}`;

  return (
    <div className="grid gap-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[.16em] text-cyan-700">Schedule</p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">{rangeLabel}</h2>
            <p className="mt-1 text-sm text-slate-500">Scheduled jobs, arrival windows, and work waiting to be booked.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setWeekStart(startOfWeek(new Date()))} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-black text-slate-700">Today</button>
            <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="rounded-xl border border-slate-300 p-2.5 text-slate-700" aria-label="Previous week"><ChevronLeft className="h-5 w-5" /></button>
            <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="rounded-xl border border-slate-300 p-2.5 text-slate-700" aria-label="Next week"><ChevronRight className="h-5 w-5" /></button>
            <button onClick={load} disabled={loading} className="rounded-xl border border-slate-300 p-2.5 text-slate-700 disabled:opacity-50" aria-label="Refresh schedule"><RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} /></button>
          </div>
        </div>
      </section>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-700">{error}</div>}

      <div className="grid gap-5 xl:grid-cols-[1fr_300px]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="grid min-w-[980px] grid-cols-7">
            {days.map((day) => {
              const today = dateKey(day) === dateKey(new Date());
              return (
                <div key={dateKey(day)} className="min-h-[520px] border-r border-slate-100 last:border-r-0">
                  <div className={`border-b border-slate-100 px-3 py-4 text-center ${today ? "bg-cyan-50" : "bg-slate-50"}`}>
                    <p className={`text-xs font-black uppercase tracking-[.14em] ${today ? "text-cyan-700" : "text-slate-400"}`}>{dayLabel(day)}</p>
                    <p className="mt-1 font-black text-slate-900">{dayNumber(day)}</p>
                  </div>
                  <div className="grid gap-2 p-2">
                    {(grouped[dateKey(day)] || []).map((appointment) => (
                      <button
                        key={appointment.id}
                        onClick={() => appointment.job?.id && onOpenJob?.(appointment.job.id)}
                        className={`rounded-xl border p-3 text-left transition hover:shadow-sm ${statusClass(appointment.job?.status || appointment.status)}`}
                      >
                        <div className="flex items-center gap-1.5 text-[11px] font-black text-slate-500"><Clock3 className="h-3.5 w-3.5" /> {time(appointment.starts_at)}{appointment.ends_at ? `–${time(appointment.ends_at)}` : ""}</div>
                        <p className="mt-2 text-sm font-black leading-5 text-slate-900">{appointment.job ? `#${appointment.job.job_number} ${appointment.job.title}` : "Appointment"}</p>
                        <p className="mt-1 truncate text-xs font-bold text-slate-600">{appointment.customer?.display_name || "Customer"}</p>
                        {appointment.property && <p className="mt-2 line-clamp-2 text-[11px] leading-4 text-slate-500">{appointment.property.address_line1}<br />{appointment.property.city}</p>}
                        <span className="mt-2 inline-flex rounded-full bg-white/80 px-2 py-1 text-[10px] font-black text-slate-600">{statusLabel(appointment.job?.status || appointment.status)}</span>
                      </button>
                    ))}
                    {!grouped[dateKey(day)]?.length && <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs font-bold text-slate-400">Open</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <aside className="grid content-start gap-5">
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-4">
              <div className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-cyan-700" /><h3 className="font-black text-slate-950">Unscheduled</h3></div>
              <p className="mt-1 text-sm text-slate-500">Approved work waiting for a date.</p>
            </div>
            <div className="divide-y divide-slate-100">
              {data?.unscheduledJobs?.length ? data.unscheduledJobs.map((job) => (
                <button key={job.id} onClick={() => onOpenJob?.(job.id)} className="w-full p-4 text-left transition hover:bg-slate-50">
                  <p className="font-black text-slate-900">Job #{job.job_number}</p>
                  <p className="mt-1 text-sm font-bold text-slate-700">{job.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{job.lead?.submitted_name || job.customer?.display_name || "Customer"}</p>
                  {job.property && <p className="mt-2 flex items-start gap-1 text-xs leading-5 text-slate-500"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {job.property.address_line1}, {job.property.city}</p>}
                  <p className="mt-2 text-xs font-black text-cyan-800">{money(job.quoted_total)}</p>
                </button>
              )) : <div className="p-5 text-sm text-slate-500">No unscheduled jobs.</div>}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
