import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Loader2,
  MapPin,
  Navigation,
  Phone,
  Play,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { getJobDetails, getJobs, jobAdmin } from "./api.js";

function money(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value || 0));
}

function localDateTimeParts(value) {
  if (!value) return { date: "", time: "" };
  const d = new Date(value);
  const pad = (n) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
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

function label(status) {
  return {
    unscheduled: "Unscheduled",
    scheduled: "Scheduled",
    on_my_way: "On My Way",
    in_progress: "In Progress",
    completed: "Completed",
    cancelled: "Cancelled",
  }[status] || status;
}

function badgeClass(status) {
  if (status === "completed") return "bg-emerald-50 text-emerald-700";
  if (status === "in_progress" || status === "on_my_way") return "bg-cyan-50 text-cyan-800";
  if (status === "cancelled") return "bg-red-50 text-red-700";
  if (status === "scheduled") return "bg-blue-50 text-blue-700";
  return "bg-slate-100 text-slate-600";
}

function JobList({ session, onOpen }) {
  const [jobs, setJobs] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getJobs(session).then(setJobs).catch((err) => setError(err.message));
  }, [session]);

  if (error) return <div className="rounded-2xl border border-red-200 bg-red-50 p-5 font-bold text-red-700">{error}</div>;
  if (!jobs) return <p className="text-sm font-bold text-slate-500">Loading jobs…</p>;

  if (!jobs.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="text-lg font-black text-slate-900">No jobs yet</p>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">Approved quotes automatically become jobs here.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-[920px] w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs font-black uppercase tracking-[.12em] text-slate-400">
          <tr>
            <th className="px-5 py-4">Job</th>
            <th className="px-5 py-4">Customer</th>
            <th className="px-5 py-4">Status</th>
            <th className="px-5 py-4">Scheduled</th>
            <th className="px-5 py-4">Value</th>
            <th className="px-5 py-4"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {jobs.map((job) => (
            <tr key={job.id} className="hover:bg-slate-50/70">
              <td className="px-5 py-4">
                <p className="font-black text-slate-900">#{job.job_number} · {job.title}</p>
                <p className="mt-1 text-xs text-slate-500">{job.property ? `${job.property.address_line1}, ${job.property.city}` : "Address pending"}</p>
              </td>
              <td className="px-5 py-4">
                <p className="font-bold text-slate-800">{job.lead?.submitted_name || job.customer?.display_name || "—"}</p>
                <p className="mt-1 text-xs text-slate-500">{job.lead?.submitted_phone || job.lead?.submitted_email || job.customer?.phone || job.customer?.email || "—"}</p>
              </td>
              <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-black ${badgeClass(job.status)}`}>{label(job.status)}</span></td>
              <td className="px-5 py-4 text-slate-600">{job.scheduled_start ? formatDate(job.scheduled_start, true) : "Not scheduled"}</td>
              <td className="px-5 py-4 font-black text-slate-900">{money(job.final_total ?? job.quoted_total)}</td>
              <td className="px-5 py-4 text-right">
                <button onClick={() => onOpen(job.id)} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-black text-slate-700">Open <ChevronRight className="h-3.5 w-3.5" /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function JobDetail({ session, jobId, onBack }) {
  const [job, setJob] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [completionNotes, setCompletionNotes] = useState("");
  const [finalTotal, setFinalTotal] = useState("");
  const [cancelReason, setCancelReason] = useState("");

  const [schedule, setSchedule] = useState({
    date: "",
    start: "09:00",
    end: "11:00",
    arrivalWindowMinutes: "60",
  });

  async function load() {
    const data = await getJobDetails(session, jobId);
    setJob(data);
    if (data) {
      const start = localDateTimeParts(data.scheduled_start);
      const end = localDateTimeParts(data.scheduled_end);
      setSchedule({
        date: start.date || "",
        start: start.time || "09:00",
        end: end.time || "11:00",
        arrivalWindowMinutes: data.arrival_window_minutes ? String(data.arrival_window_minutes) : "60",
      });
      setFinalTotal(String(data.final_total ?? data.quoted_total ?? ""));
      setCompletionNotes(data.completion_notes || "");
    }
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [jobId, session]);

  const fullAddress = useMemo(() => {
    if (!job?.property) return "";
    return [job.property.address_line1, job.property.address_line2, job.property.city, job.property.state, job.property.postal_code].filter(Boolean).join(", ");
  }, [job]);

  async function act(action, extra = {}) {
    setBusy(action);
    setError("");
    setNotice("");
    try {
      const result = await jobAdmin(session, { action, jobId, ...extra });
      if (action === "schedule") setNotice("Job scheduled. The customer confirmation automation has been triggered.");
      if (action === "on_my_way") setNotice("On-my-way status sent to the automation system.");
      if (action === "start") setNotice("Job started.");
      if (action === "complete") setNotice("Job completed and a draft invoice was created automatically.");
      if (action === "cancel") setNotice("Job cancelled.");
      await load();
      return result;
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  function scheduleJob() {
    if (!schedule.date || !schedule.start || !schedule.end) {
      setError("Choose the service date and time window.");
      return;
    }
    const startsAt = new Date(`${schedule.date}T${schedule.start}:00`).toISOString();
    const endsAt = new Date(`${schedule.date}T${schedule.end}:00`).toISOString();
    act("schedule", {
      startsAt,
      endsAt,
      arrivalWindowMinutes: Number(schedule.arrivalWindowMinutes || 0),
    });
  }

  if (!job) {
    return error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-5 font-bold text-red-700">{error}</div> : <p className="text-sm font-bold text-slate-500">Loading job…</p>;
  }

  const actionable = !["completed", "cancelled"].includes(job.status);

  return (
    <div className="grid gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <button onClick={onBack} className="text-sm font-extrabold text-cyan-800">← Back to jobs</button>
          <h2 className="mt-3 text-3xl font-black text-slate-950">Job #{job.job_number}</h2>
          <p className="mt-1 text-lg font-bold text-slate-600">{job.title}</p>
        </div>
        <span className={`self-start rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-wide ${badgeClass(job.status)}`}>{label(job.status)}</span>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}
      {notice && <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-sm font-bold text-cyan-900">{notice}</div>}

      <div className="grid gap-6 xl:grid-cols-[1fr_.72fr]">
        <section className="grid gap-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-black text-slate-950">Customer & property</h3>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <div>
                <p className="text-xs font-black uppercase tracking-[.14em] text-slate-400">Customer</p>
                <p className="mt-2 font-black text-slate-900">{job.lead?.submitted_name || job.customer?.display_name}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {job.customer?.phone && <a href={`tel:${job.customer.phone}`} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-black text-slate-700"><Phone className="h-4 w-4" /> Call</a>}
                </div>
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[.14em] text-slate-400">Service address</p>
                <p className="mt-2 font-bold leading-6 text-slate-800">{fullAddress || "—"}</p>
                {fullAddress && <a target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-black text-slate-700"><MapPin className="h-4 w-4" /> Directions</a>}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-black text-slate-950">Scope & value</h3>
            <p className="mt-4 whitespace-pre-line text-sm leading-7 text-slate-600">{job.scope_of_work || job.title}</p>
            <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-5">
              <span className="font-bold text-slate-500">Job value</span>
              <strong className="text-2xl font-black text-slate-950">{money(job.final_total ?? job.quoted_total)}</strong>
            </div>
          </div>

          {job.status === "in_progress" && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-black text-slate-950">Complete job</h3>
              <p className="mt-1 text-sm leading-6 text-slate-500">Finishing the job will automatically create a draft invoice using the job total and the approved quote line items.</p>
              <label className="mt-5 grid gap-2 text-sm font-extrabold text-slate-700">Final total
                <input type="number" min="0" step="0.01" value={finalTotal} onChange={(e) => setFinalTotal(e.target.value)} className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-cyan-600" />
              </label>
              <label className="mt-4 grid gap-2 text-sm font-extrabold text-slate-700">Completion notes
                <textarea rows="4" value={completionNotes} onChange={(e) => setCompletionNotes(e.target.value)} placeholder="Anything worth remembering about the job…" className="rounded-xl border border-slate-300 px-4 py-3 font-medium outline-none focus:border-cyan-600" />
              </label>
              <button disabled={Boolean(busy)} onClick={() => act("complete", { finalTotal: Number(finalTotal || 0), completionNotes })} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3.5 font-black text-white disabled:opacity-50">{busy === "complete" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />} Complete job & create invoice</button>
            </div>
          )}

          {job.status === "completed" && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-700" /><div><h3 className="font-black text-emerald-950">Job complete</h3><p className="mt-1 text-sm leading-6 text-emerald-800">Completed {formatDate(job.completed_at, true)}. A draft invoice is ready in Invoices.</p></div></div>
            </div>
          )}
        </section>

        <aside className="grid gap-6 self-start xl:sticky xl:top-28">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-cyan-700" /><h3 className="text-lg font-black text-slate-950">Schedule</h3></div>
            <div className="mt-5 grid gap-4">
              <label className="grid gap-2 text-sm font-extrabold text-slate-700">Service date
                <input type="date" value={schedule.date} onChange={(e) => setSchedule((current) => ({ ...current, date: e.target.value }))} disabled={!actionable} className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-cyan-600 disabled:bg-slate-100" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-2 text-sm font-extrabold text-slate-700">Start
                  <input type="time" value={schedule.start} onChange={(e) => setSchedule((current) => ({ ...current, start: e.target.value }))} disabled={!actionable} className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-cyan-600 disabled:bg-slate-100" />
                </label>
                <label className="grid gap-2 text-sm font-extrabold text-slate-700">End
                  <input type="time" value={schedule.end} onChange={(e) => setSchedule((current) => ({ ...current, end: e.target.value }))} disabled={!actionable} className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-cyan-600 disabled:bg-slate-100" />
                </label>
              </div>
              <label className="grid gap-2 text-sm font-extrabold text-slate-700">Arrival window
                <select value={schedule.arrivalWindowMinutes} onChange={(e) => setSchedule((current) => ({ ...current, arrivalWindowMinutes: e.target.value }))} disabled={!actionable} className="rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-cyan-600 disabled:bg-slate-100">
                  <option value="0">Exact time</option>
                  <option value="30">30 minutes</option>
                  <option value="60">1 hour</option>
                  <option value="120">2 hours</option>
                </select>
              </label>
              {actionable && <button disabled={Boolean(busy)} onClick={scheduleJob} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-3 font-black text-slate-800 disabled:opacity-50">{busy === "schedule" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} {job.status === "unscheduled" ? "Schedule job" : "Save schedule"}</button>}
            </div>
            {job.scheduled_start && <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm"><p className="font-black text-slate-900">{formatDate(job.scheduled_start, true)}</p><p className="mt-1 text-slate-500">through {formatDate(job.scheduled_end, true)}</p></div>}
          </div>

          {actionable && job.status !== "unscheduled" && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-black text-slate-950">Field actions</h3>
              <div className="mt-4 grid gap-3">
                {job.status === "scheduled" && <button disabled={Boolean(busy)} onClick={() => act("on_my_way")} className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-3.5 font-black text-white disabled:opacity-50"><Navigation className="h-5 w-5" /> On my way</button>}
                {["scheduled","on_my_way"].includes(job.status) && <button disabled={Boolean(busy)} onClick={() => act("start")} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3.5 font-black text-white disabled:opacity-50"><Play className="h-5 w-5" /> Start job</button>}
                {job.status === "in_progress" && <div className="flex items-center gap-2 rounded-xl bg-amber-50 p-4 text-sm font-black text-amber-800"><Clock3 className="h-4 w-4" /> Job is in progress</div>}
              </div>
            </div>
          )}

          {actionable && (
            <details className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <summary className="cursor-pointer text-sm font-black text-slate-500">Cancel this job</summary>
              <textarea rows="3" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Reason (optional)" className="mt-4 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-red-400" />
              <button disabled={Boolean(busy)} onClick={() => act("cancel", { reason: cancelReason })} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-3 text-sm font-black text-red-700 disabled:opacity-50"><XCircle className="h-4 w-4" /> Cancel job</button>
            </details>
          )}
        </aside>
      </div>
    </div>
  );
}

export default function JobPage({ session }) {
  const [selectedId, setSelectedId] = useState(null);

  if (selectedId) return <JobDetail session={session} jobId={selectedId} onBack={() => setSelectedId(null)} />;
  return <JobList session={session} onOpen={setSelectedId} />;
}
