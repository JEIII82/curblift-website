const BASE_URL = "https://www.rinsepoint.com";

const pages = {
  "/": {
    title: "RinsePoint | Pressure Washing in Allen, TX",
    description: "RinsePoint provides professional pressure washing, driveway cleaning, sidewalk cleaning, patio cleaning, and concrete cleaning in Allen, TX and nearby North Texas communities.",
  },
  "/services": {
    title: "Pressure Washing Services | RinsePoint Allen, TX",
    description: "Driveway, sidewalk, patio, concrete, and small commercial pressure washing services from RinsePoint in Allen, TX and nearby North Texas communities.",
  },
  "/results": {
    title: "Pressure Washing Results | RinsePoint Allen, TX",
    description: "See real RinsePoint before-and-after exterior cleaning results and learn what to expect from professional concrete cleaning in Allen, TX.",
  },
  "/about": {
    title: "About RinsePoint | Exterior Cleaning in Allen, TX",
    description: "Meet RinsePoint, an owner-operated exterior cleaning company serving Allen, TX with clear communication, careful cleaning, and straightforward service.",
  },
  "/areas": {
    title: "Pressure Washing Service Areas | RinsePoint North Texas",
    description: "RinsePoint serves Allen, McKinney, Plano, Fairview, Lucas, Parker, Murphy, Wylie, and nearby North Texas communities.",
  },
  "/contact": {
    title: "Request a Pressure Washing Quote | RinsePoint",
    description: "Request a pressure washing quote from RinsePoint. Send your property details, cleaning scope, and photos for a clear estimate in Allen and nearby North Texas communities.",
  },
};

function upsertMeta(selector, attrs) {
  let node = document.head.querySelector(selector);
  if (!node) {
    node = document.createElement("meta");
    document.head.appendChild(node);
  }
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
}

export function applySeo() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  const page = pages[path] || {
    title: "RinsePoint Exterior Cleaning",
    description: "Professional pressure washing and exterior cleaning in Allen, TX and nearby North Texas communities.",
  };
  const canonicalPath = path === "/" ? "/" : `${path}/`;
  const canonicalUrl = `${BASE_URL}${canonicalPath}`;

  document.title = page.title;

  upsertMeta('meta[name="description"]', { name: "description", content: page.description });
  upsertMeta('meta[property="og:title"]', { property: "og:title", content: page.title });
  upsertMeta('meta[property="og:description"]', { property: "og:description", content: page.description });
  upsertMeta('meta[property="og:url"]', { property: "og:url", content: canonicalUrl });
  upsertMeta('meta[name="twitter:title"]', { name: "twitter:title", content: page.title });
  upsertMeta('meta[name="twitter:description"]', { name: "twitter:description", content: page.description });

  let canonical = document.head.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.rel = "canonical";
    document.head.appendChild(canonical);
  }
  canonical.href = canonicalUrl;
}
