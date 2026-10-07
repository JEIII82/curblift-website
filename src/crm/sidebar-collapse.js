const STORAGE_KEY = "rinsepoint-os-sidebar-collapsed";
const DESKTOP_QUERY = "(min-width: 1024px)";
const NAV_SELECTOR = "aside.fixed.inset-y-0.left-0";
const TOGGLE_SELECTOR = "header.sticky.top-0 button";

function isDesktop() {
  return window.matchMedia(DESKTOP_QUERY).matches;
}

function isCollapsed() {
  return document.documentElement.dataset.rpSidebar === "collapsed";
}

function applyCollapsed(collapsed) {
  if (collapsed) document.documentElement.dataset.rpSidebar = "collapsed";
  else delete document.documentElement.dataset.rpSidebar;

  try {
    localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  } catch {
    // Storage is a convenience only; the sidebar still works without it.
  }

  syncAccessibility();
}

function storedPreference() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function syncAccessibility() {
  const toggle = document.querySelector(TOGGLE_SELECTOR);
  if (toggle) {
    const label = isCollapsed() ? "Expand navigation" : "Collapse navigation";
    toggle.setAttribute("aria-label", label);
    toggle.setAttribute("title", label);
    toggle.setAttribute("aria-expanded", String(!isCollapsed()));
  }

  const nav = document.querySelector(NAV_SELECTOR);
  nav?.querySelectorAll("nav button").forEach((button) => {
    const label = button.textContent?.trim();
    if (label) button.setAttribute("title", label);
  });

  const signOut = nav?.querySelector(":scope > div:last-child button");
  if (signOut?.textContent?.trim()) signOut.setAttribute("title", "Sign out");
}

if (typeof window !== "undefined") {
  if (storedPreference()) document.documentElement.dataset.rpSidebar = "collapsed";

  document.addEventListener(
    "click",
    (event) => {
      if (!isDesktop()) return;
      const toggle = event.target.closest?.(TOGGLE_SELECTOR);
      if (!toggle) return;

      // On desktop this button controls only the navigation rail. Prevent the
      // existing mobile drawer handler from also opening the overlay state.
      event.preventDefault();
      event.stopPropagation();
      applyCollapsed(!isCollapsed());
    },
    true,
  );

  const observer = new MutationObserver(syncAccessibility);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("DOMContentLoaded", syncAccessibility, { once: true });
  window.addEventListener("resize", syncAccessibility);
}
