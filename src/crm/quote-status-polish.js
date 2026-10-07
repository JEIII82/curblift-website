import { ORGANIZATION_ID, getStoredSession, rest } from "./api.js";

const STATUS_LABELS = new Set([
  "Draft",
  "Sent",
  "Viewed",
  "Changes Requested",
  "Approved",
  "Declined",
  "Expired",
  "Cancelled",
]);

let lastKey = "";
let scheduled = false;
let requestVersion = 0;

function formatDateTime(value) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

function getQuoteContext() {
  const heading = Array.from(document.querySelectorAll("h2")).find((node) => /^Quote #\d+/.test(node.textContent?.trim() || ""));
  if (!heading) return null;

  const root = heading.closest("div.grid.gap-6");
  if (!root) return null;

  const number = Number((heading.textContent.match(/Quote #(\d+)/) || [])[1]);
  if (!number) return null;

  const statusNode = Array.from(root.querySelectorAll("span")).find((node) => STATUS_LABELS.has(node.textContent?.trim() || ""));
  const statusLabel = statusNode?.textContent?.trim() || "";

  const summaryHeading = Array.from(root.querySelectorAll("h3")).find((node) => node.textContent?.trim() === "Quote summary");
  const summaryCard = summaryHeading?.parentElement;
  if (!summaryCard) return null;

  return { root, number, statusLabel, summaryCard, summaryHeading };
}

function setActionLabels(context) {
  const { summaryCard, statusLabel } = context;
  const sentLike = ["Sent", "Viewed", "Changes Requested"].includes(statusLabel);
  if (!sentLike) return;

  for (const button of summaryCard.querySelectorAll("button")) {
    const text = button.textContent?.trim() || "";
    if (text.includes("Save draft") || text === "Save changes") {
      const icon = button.querySelector("svg");
      button.childNodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) node.textContent = " Save changes";
      });
      if (!icon && button.textContent?.trim() !== "Save changes") button.textContent = "Save changes";
    }
    if (text.includes("Save & send quote") || text.includes("Resend quote") || text.includes("Save & resend quote")) {
      const label = statusLabel === "Changes Requested" ? "Save & resend quote" : "Resend quote";
      button.childNodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) node.textContent = ` ${label}`;
      });
    }
  }
}

function makeLine(label, value) {
  if (!value) return null;
  const row = document.createElement("div");
  row.className = "rp-quote-status-line";
  const key = document.createElement("span");
  key.textContent = label;
  const val = document.createElement("strong");
  val.textContent = value;
  row.append(key, val);
  return row;
}

function renderBanner(context, quote) {
  const { summaryCard, summaryHeading } = context;
  summaryCard.querySelector(".rp-quote-lifecycle")?.remove();

  if (!quote || quote.status === "draft") return;

  const customerName = quote.lead?.submitted_name || quote.customer?.display_name || "Customer";
  const customerEmail = quote.lead?.submitted_email || quote.customer?.email || "";
  const status = quote.status;

  const banner = document.createElement("section");
  banner.className = `rp-quote-lifecycle rp-quote-lifecycle--${status}`;

  const eyebrow = document.createElement("p");
  eyebrow.className = "rp-quote-lifecycle-eyebrow";

  const title = document.createElement("p");
  title.className = "rp-quote-lifecycle-title";

  const detail = document.createElement("p");
  detail.className = "rp-quote-lifecycle-detail";

  const meta = document.createElement("div");
  meta.className = "rp-quote-lifecycle-meta";

  if (status === "sent") {
    eyebrow.textContent = "SENT";
    title.textContent = `Quote sent to ${customerName}`;
    detail.textContent = "The customer proposal is active and waiting for a response.";
    const sent = makeLine("Sent", formatDateTime(quote.sent_at));
    const recipient = makeLine("Recipient", customerEmail);
    if (sent) meta.append(sent);
    if (recipient) meta.append(recipient);
  } else if (status === "viewed") {
    eyebrow.textContent = "VIEWED";
    title.textContent = `${customerName} viewed the quote`;
    detail.textContent = "The customer has opened the proposal. It is now waiting for approval or a change request.";
    const viewed = makeLine("Viewed", formatDateTime(quote.viewed_at));
    const sent = makeLine("Sent", formatDateTime(quote.sent_at));
    if (viewed) meta.append(viewed);
    if (sent) meta.append(sent);
  } else if (status === "changes_requested") {
    eyebrow.textContent = "CHANGES REQUESTED";
    title.textContent = `${customerName} requested changes`;
    detail.textContent = "Update the scope or pricing, then resend the quote when it is ready.";
  } else if (status === "approved") {
    eyebrow.textContent = "APPROVED";
    title.textContent = `Quote approved by ${customerName}`;
    detail.textContent = "This proposal is complete and the approved work can move forward as a job.";
    const approved = makeLine("Approved", formatDateTime(quote.approved_at));
    if (approved) meta.append(approved);
  } else if (status === "declined") {
    eyebrow.textContent = "DECLINED";
    title.textContent = `Quote declined by ${customerName}`;
    detail.textContent = "This quote is closed. Reopen the sales conversation from the customer or lead record if needed.";
    const declined = makeLine("Declined", formatDateTime(quote.declined_at));
    if (declined) meta.append(declined);
  } else if (status === "expired") {
    eyebrow.textContent = "EXPIRED";
    title.textContent = "Quote expired";
    detail.textContent = "The customer can no longer approve this version. Create or send an updated proposal if the opportunity is still active.";
  } else if (status === "cancelled") {
    eyebrow.textContent = "CANCELLED";
    title.textContent = "Quote cancelled";
    detail.textContent = "This proposal is no longer active for the customer.";
  }

  banner.append(eyebrow, title, detail);
  if (meta.childElementCount) banner.append(meta);
  summaryHeading.insertAdjacentElement("afterend", banner);
}

async function enhanceQuoteStatus() {
  scheduled = false;
  if (window.location.hostname !== "app.rinsepoint.com") return;

  const context = getQuoteContext();
  if (!context) {
    lastKey = "";
    return;
  }

  setActionLabels(context);

  const key = `${context.number}:${context.statusLabel}`;
  if (key === lastKey && context.summaryCard.querySelector(".rp-quote-lifecycle")) return;
  lastKey = key;

  if (!context.statusLabel || context.statusLabel === "Draft") {
    context.summaryCard.querySelector(".rp-quote-lifecycle")?.remove();
    return;
  }

  const version = ++requestVersion;
  try {
    const session = getStoredSession();
    if (!session?.access_token) return;

    const rows = await rest(
      session,
      `quotes?select=quote_number,status,sent_at,viewed_at,approved_at,declined_at,customer:customers(display_name,email),lead:leads(submitted_name,submitted_email)&organization_id=eq.${ORGANIZATION_ID}&quote_number=eq.${context.number}&limit=1`,
      { method: "GET" },
    );
    if (version !== requestVersion) return;

    const current = getQuoteContext();
    if (!current || current.number !== context.number) return;
    renderBanner(current, rows?.[0] || null);
    setActionLabels(current);
  } catch {
    // Quote tracking is a progressive enhancement. The core editor remains usable.
  }
}

function scheduleEnhancement() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(enhanceQuoteStatus);
}

if (typeof window !== "undefined") {
  const observer = new MutationObserver(scheduleEnhancement);
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  window.addEventListener("DOMContentLoaded", scheduleEnhancement, { once: true });
  scheduleEnhancement();
}
