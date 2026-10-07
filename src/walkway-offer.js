const OFFER_NAME = "Front Walkway & Entry Cleaning";
const OFFER_PRICE = "$99";
const OFFER_NOTE = "Starting price for a front walkway, entry path, and small front stoop or landing with typical buildup.";

function textEquals(node, value) {
  return node?.textContent?.trim() === value;
}

function ensureWalkwayPackage() {
  document.querySelectorAll('.package-grid').forEach((grid) => {
    if (grid.querySelector('[data-rp-walkway-offer="true"]')) return;

    const card = document.createElement('article');
    card.className = 'package-card';
    card.dataset.rpWalkwayOffer = 'true';
    card.innerHTML = `
      <p class="package-label">Entry</p>
      <h3>${OFFER_NAME}</h3>
      <div class="package-price">${OFFER_PRICE}<span> / starting price</span></div>
      <p class="package-note">${OFFER_NOTE}</p>
      <a class="package-link" href="/contact/?package=${encodeURIComponent(OFFER_NAME)}">
        Start with this option <span aria-hidden="true">→</span>
      </a>
    `;
    grid.prepend(card);
  });
}

function updateWalkwayServiceCopy() {
  document.querySelectorAll('h2, h3').forEach((heading) => {
    if (!textEquals(heading, 'Sidewalk & Walkway Cleaning')) return;
    heading.textContent = OFFER_NAME;

    const container = heading.closest('article, a');
    const description = container?.querySelector('p');
    if (!description) return;

    if (container?.classList.contains('service-card')) {
      description.textContent = 'Front walks, entry paths, small stoops, and the concrete guests see first.';
    } else {
      description.textContent = 'A clean front approach can make a noticeable difference even when there is no front driveway to wash. We clean the agreed front walkway, entry path, and small stoop or landing, rinse the surrounding area, and confirm the finished result before leaving.';
    }
  });

  document.querySelectorAll('p').forEach((node) => {
    if (textEquals(node, 'Good · Better · Best')) node.textContent = 'Common starting points';
  });
}

function updateQuoteForm() {
  const select = document.querySelector('#quote-service');
  if (!select) return;

  Array.from(select.options).forEach((option) => {
    if (option.textContent?.trim() === 'Sidewalk / walkway cleaning') {
      option.textContent = OFFER_NAME;
      option.value = OFFER_NAME;
    }
  });

  const requestedPackage = new URLSearchParams(window.location.search).get('package');
  if (requestedPackage !== OFFER_NAME) return;

  select.value = OFFER_NAME;

  const form = document.querySelector('#quote-form');
  if (!form) return;

  if (!form.querySelector('input[data-rp-walkway-package="true"]')) {
    const hidden = document.createElement('input');
    hidden.type = 'hidden';
    hidden.name = 'package';
    hidden.value = OFFER_NAME;
    hidden.dataset.rpWalkwayPackage = 'true';
    form.prepend(hidden);
  }

  if (!form.querySelector('[data-rp-walkway-starting-point="true"]')) {
    const note = document.createElement('p');
    note.dataset.rpWalkwayStartingPoint = 'true';
    note.className = 'mb-6 rounded-lg bg-cyan-50 p-4 text-sm text-slate-700';
    note.innerHTML = `Starting point: <strong>Entry · ${OFFER_NAME}</strong> · from ${OFFER_PRICE}`;
    const heading = form.querySelector('h2');
    if (heading) form.insertBefore(note, heading);
  }
}

function updateSupportingCopy() {
  document.querySelectorAll('p').forEach((node) => {
    const text = node.textContent?.trim();
    if (text === 'Driveway, sidewalk, patio, commercial concrete, or multiple areas.') {
      node.textContent = 'Front walkway or entry, driveway, patio, commercial concrete, or multiple areas.';
    }
  });
}

function applyWalkwayOffer() {
  ensureWalkwayPackage();
  updateWalkwayServiceCopy();
  updateQuoteForm();
  updateSupportingCopy();
}

let queued = false;
function queueApply() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    applyWalkwayOffer();
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', queueApply, { once: true });
  queueApply();

  const root = document.getElementById('root');
  if (root) {
    new MutationObserver(queueApply).observe(root, { childList: true, subtree: true });
  }
}
