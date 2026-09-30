import { useState } from "react";
import { useForm, ValidationError } from "@formspree/react";
import {
  ArrowRight,
  Building2,
  Camera,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Droplets,
  Gauge,
  MapPin,
  Menu,
  MessageSquare,
  Phone,
  ShieldCheck,
  Sparkles,
  Trees,
  X,
} from "lucide-react";

const business = {
  name: "RinsePoint Exterior Cleaning",
  shortName: "RinsePoint",
  tagline: "Clean starts here.",
  location: "Allen, TX",
  serviceLine: "Pressure Washing • Concrete Cleaning • Surface Cleaning",
  phone: "(972) 379-7161",
  phoneLink: "tel:+19723797161",
  smsLink: "sms:+19723797161",
};

const services = [
  {
    icon: Droplets,
    title: "Driveway & Concrete Cleaning",
    short: "Driveways, parking pads, entry concrete, and other residential flatwork.",
    detail:
      "We use a controlled cleaning process to remove surface dirt, organic buildup, tire marks, and general grime from concrete without treating every surface with maximum pressure.",
  },
  {
    icon: Sparkles,
    title: "Sidewalk & Walkway Cleaning",
    short: "Front walks, entry paths, side walks, and other high-traffic concrete.",
    detail:
      "Walkways are one of the first things guests notice. We clean the agreed area, rinse surrounding surfaces, and check the finished result before leaving.",
  },
  {
    icon: Trees,
    title: "Patio & Outdoor Surface Cleaning",
    short: "Patios, porches, and suitable exterior hard surfaces.",
    detail:
      "Outdoor living areas collect dirt, algae, dust, and weathering. We match the cleaning approach to the material and condition instead of using one method everywhere.",
  },
  {
    icon: Building2,
    title: "Commercial Concrete Cleaning",
    short: "Storefront sidewalks, entryways, pads, and small commercial flatwork.",
    detail:
      "Clean exterior concrete improves the first impression of a business. We can quote small commercial work from photos and site details before scheduling.",
  },
];

const packages = [
  {
    name: "Driveway Cleaning",
    price: "$149",
    note: "Starting price for a standard residential driveway with typical buildup.",
  },
  {
    name: "Driveway + Front Walkway",
    price: "$199",
    note: "A popular curb-appeal package for the driveway, front walk, and entry approach.",
    featured: true,
  },
  {
    name: "Full Exterior Concrete",
    price: "$299",
    note: "Starting price for a larger bundle such as driveway, walkways, and a typical patio or porch area.",
  },
];

const process = [
  {
    title: "Send the basics",
    text: "Tell us the address, what you want cleaned, and send a few clear photos.",
  },
  {
    title: "Get a clear quote",
    text: "We confirm the scope and price before the job so you know what is included.",
  },
  {
    title: "We clean and inspect",
    text: "We complete the agreed work, rinse the surrounding area, and check the finished result.",
  },
];

const serviceAreas = [
  "Allen",
  "Parker",
  "Lucas",
  "Fairview",
  "McKinney",
  "Plano",
  "Frisco",
  "Murphy",
  "Wylie",
  "Richardson",
  "Prosper",
  "Sachse",
];

const faqs = [
  {
    q: "Can I get a quote from photos?",
    a: "Yes. Most residential concrete-cleaning jobs can be estimated from clear photos, your address or city, and a short description of what you want cleaned.",
  },
  {
    q: "Do you need access to water?",
    a: "Yes. Most residential jobs require access to a working outdoor water spigot with adequate flow.",
  },
  {
    q: "Can pressure washing damage concrete?",
    a: "It can when the wrong pressure, nozzle, distance, or technique is used. RinsePoint uses a surface-appropriate approach and avoids treating every surface with maximum pressure.",
  },
  {
    q: "Can you remove oil, rust, or deep stains?",
    a: "Many stains can be improved substantially, but deeply absorbed oil, rust, paint, or older discoloration may not disappear completely. We set expectations before starting when a stain appears permanent or may need specialty treatment.",
  },
  {
    q: "Do I need to be home?",
    a: "Not always. If the cleaning area is accessible and the outdoor water source is available, many jobs can be completed while you are away.",
  },
  {
    q: "How long does a typical job take?",
    a: "Timing depends on the size, buildup, stains, access, and how much rinsing is needed. Most residential concrete-cleaning jobs can be completed in a single visit.",
  },
];

const beforeAfter = {
  before: "/images/before-sidewalk.jpg",
  after: "/images/after-sidewalk.jpg",
};

function Logo() {
  return (
    <a href="/" aria-label="RinsePoint Exterior Cleaning home" className="block shrink-0">
      <img
        src="/rinsepoint-logo.svg"
        alt="RinsePoint Exterior Cleaning"
        className="h-auto w-[168px] sm:w-[192px]"
      />
    </a>
  );
}

function Header() {
  const [open, setOpen] = useState(false);
  const nav = [
    ["Services", "/services/"],
    ["Results", "/results/"],
    ["About", "/about/"],
    ["Service Areas", "/areas/"],
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
        <Logo />

        <nav aria-label="Primary navigation" className="hidden items-center gap-7 lg:flex">
          {nav.map(([label, href]) => (
            <a
              key={href}
              href={href}
              className="text-sm font-bold text-slate-600 transition hover:text-slate-950"
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <a
            href={business.phoneLink}
            className="text-sm font-extrabold text-slate-700 hover:text-cyan-700"
          >
            {business.phone}
          </a>
          <a
            href="/contact/"
            className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-5 py-3 text-sm font-extrabold text-white transition hover:bg-slate-800"
          >
            Get a Quote <ArrowRight className="h-4 w-4" />
          </a>
        </div>

        <button
          type="button"
          aria-label={open ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="rounded-lg border border-slate-200 p-3 text-slate-800 lg:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-slate-200 bg-white px-5 py-5 lg:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-1" aria-label="Mobile navigation">
            {nav.map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="rounded-lg px-3 py-3 font-bold text-slate-700 hover:bg-slate-50"
              >
                {label}
              </a>
            ))}
            <div className="mt-3 grid grid-cols-2 gap-3">
              <a
                href={business.phoneLink}
                className="rounded-lg border border-slate-200 px-4 py-3 text-center font-extrabold text-slate-900"
              >
                Call
              </a>
              <a
                href="/contact/"
                className="rounded-lg bg-cyan-500 px-4 py-3 text-center font-extrabold text-white"
              >
                Get a Quote
              </a>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-950 text-slate-300">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 md:grid-cols-[1.3fr_1fr_1fr] lg:px-8">
        <div>
          <a href="/" aria-label="RinsePoint home" className="inline-block">
            <img
              src="/rinsepoint-logo-white.svg"
              alt="RinsePoint Exterior Cleaning"
              className="h-auto w-[220px]"
              loading="lazy"
            />
          </a>
          <p className="mt-4 max-w-sm text-sm leading-6 text-slate-400">
            Owner-operated pressure washing and exterior concrete cleaning in Allen, Texas and nearby North Texas communities.
          </p>
          <p className="mt-5 text-sm font-bold text-cyan-300">{business.tagline}</p>
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Explore</p>
          <div className="mt-4 grid gap-3 text-sm font-bold">
            <a href="/services/" className="hover:text-white">Services</a>
            <a href="/results/" className="hover:text-white">Results</a>
            <a href="/about/" className="hover:text-white">About</a>
            <a href="/areas/" className="hover:text-white">Service Areas</a>
          </div>
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Contact</p>
          <div className="mt-4 grid gap-3 text-sm font-bold">
            <a href={business.phoneLink} className="hover:text-white">{business.phone}</a>
            <a href={business.smsLink} className="hover:text-white">Text photos for a quote</a>
            <a href="/contact/" className="hover:text-white">Request a quote</a>
            <a href="/privacy.html" className="hover:text-white">Privacy</a>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto max-w-7xl px-5 py-5 text-xs text-slate-500 lg:px-8">
          © 2026 RinsePoint Exterior Cleaning. Allen, Texas.
        </div>
      </div>
    </footer>
  );
}

function MobileBar() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 p-3 shadow-2xl backdrop-blur lg:hidden">
      <div className="mx-auto grid max-w-md grid-cols-2 gap-3">
        <a
          href={business.smsLink}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-3 text-sm font-black text-slate-900"
        >
          <MessageSquare className="h-4 w-4" /> Text Photos
        </a>
        <a
          href="/contact/"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 py-3 text-sm font-black text-white"
        >
          Get a Quote
        </a>
      </div>
    </div>
  );
}

function SectionIntro({ eyebrow, title, text, align = "center", light = false }) {
  const centered = align === "center";
  return (
    <div className={centered ? "mx-auto max-w-3xl text-center" : "max-w-2xl"}>
      <p className={`text-xs font-black uppercase tracking-[0.24em] ${light ? "text-cyan-300" : "text-cyan-700"}`}>{eyebrow}</p>
      <h2 className={`mt-3 text-3xl font-black tracking-tight md:text-5xl ${light ? "text-white" : "text-slate-950"}`}>{title}</h2>
      {text && <p className={`mt-5 text-base leading-8 md:text-lg ${light ? "text-slate-300" : "text-slate-600"}`}>{text}</p>}
    </div>
  );
}

function BeforeAfter({ priority = false }) {
  return (
    <div className="overflow-hidden border border-slate-200 bg-white shadow-xl">
      <div className="grid grid-cols-2">
        <div className="relative aspect-[4/3] overflow-hidden bg-slate-200">
          <img
            src={beforeAfter.before}
            alt="Concrete sidewalk before pressure washing"
            decoding="async"
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            className="h-full w-full object-cover"
          />
          <span className="absolute left-3 top-3 bg-slate-950 px-3 py-1 text-xs font-black uppercase tracking-widest text-white">Before</span>
        </div>
        <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
          <img
            src={beforeAfter.after}
            alt="Concrete sidewalk after pressure washing"
            decoding="async"
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            className="h-full w-full object-cover"
          />
          <span className="absolute right-3 top-3 bg-cyan-500 px-3 py-1 text-xs font-black uppercase tracking-widest text-white">After</span>
        </div>
      </div>
    </div>
  );
}

function PageHero({ eyebrow, title, text, children }) {
  return (
    <section className="border-b border-slate-200 bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">{eyebrow}</p>
        <h1 className="mt-4 max-w-4xl text-4xl font-black tracking-tight md:text-6xl">{title}</h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">{text}</p>
        {children && <div className="mt-8">{children}</div>}
      </div>
    </section>
  );
}

function QuoteForm() {
  const [state, handleSubmit] = useForm("meedvvbl");

  if (state.succeeded) {
    return (
      <div className="border border-cyan-200 bg-cyan-50 p-8 md:p-10">
        <CheckCircle2 className="h-10 w-10 text-cyan-700" />
        <h2 className="mt-5 text-3xl font-black text-slate-950">Quote request sent.</h2>
        <p className="mt-3 max-w-lg leading-7 text-slate-600">
          Thanks for reaching out to RinsePoint. We received your request and will follow up as soon as possible.
        </p>
        <a href={business.phoneLink} className="mt-6 inline-block font-black text-cyan-800">
          Need it faster? Call {business.phone}
        </a>
      </div>
    );
  }

  return (
    <form className="border border-slate-200 bg-white p-6 shadow-sm md:p-8" onSubmit={handleSubmit}>
      <input type="hidden" name="_subject" value="New RinsePoint Quote Request" />
      <input type="hidden" name="business" value="RinsePoint Exterior Cleaning" />
      <div className="grid gap-5">
        <div>
          <label htmlFor="quote-name" className="mb-2 block text-sm font-black text-slate-700">Name</label>
          <input id="quote-name" name="name" autoComplete="name" required className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100" />
          <ValidationError field="name" errors={state.errors} className="mt-2 block text-sm font-bold text-red-600" />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="quote-phone" className="mb-2 block text-sm font-black text-slate-700">Phone</label>
            <input id="quote-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" required className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100" />
            <ValidationError field="phone" errors={state.errors} className="mt-2 block text-sm font-bold text-red-600" />
          </div>
          <div>
            <label htmlFor="quote-email" className="mb-2 block text-sm font-black text-slate-700">
              Email <span className="font-medium text-slate-400">(optional)</span>
            </label>
            <input id="quote-email" name="email" type="email" autoComplete="email" className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100" />
            <ValidationError field="email" errors={state.errors} className="mt-2 block text-sm font-bold text-red-600" />
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="quote-city" className="mb-2 block text-sm font-black text-slate-700">City</label>
            <input id="quote-city" name="city" autoComplete="address-level2" required placeholder="Allen, McKinney, Plano..." className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100" />
            <ValidationError field="city" errors={state.errors} className="mt-2 block text-sm font-bold text-red-600" />
          </div>
          <div>
            <label htmlFor="quote-service" className="mb-2 block text-sm font-black text-slate-700">Service needed</label>
            <select id="quote-service" name="service" required className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100">
              <option value="">Choose a service</option>
              <option>Driveway / concrete cleaning</option>
              <option>Sidewalk / walkway cleaning</option>
              <option>Patio / outdoor surface cleaning</option>
              <option>Commercial concrete cleaning</option>
              <option>Not sure yet</option>
            </select>
            <ValidationError field="service" errors={state.errors} className="mt-2 block text-sm font-bold text-red-600" />
          </div>
        </div>
        <div>
          <label htmlFor="quote-details" className="mb-2 block text-sm font-black text-slate-700">Project details</label>
          <textarea id="quote-details" name="message" rows="5" required placeholder="What do you want cleaned? Include approximate size, stains, access notes, or anything else we should know." className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100" />
          <ValidationError field="message" errors={state.errors} className="mt-2 block text-sm font-bold text-red-600" />
        </div>
        <button type="submit" disabled={state.submitting} className="rounded-lg bg-cyan-500 px-6 py-4 font-extrabold text-white transition hover:bg-cyan-600 disabled:opacity-60">
          {state.submitting ? "Sending..." : "Request My Quote"}
        </button>
        <ValidationError errors={state.errors} className="text-sm font-bold text-red-600" />
        <p className="text-xs leading-5 text-slate-500">
          By submitting, you agree that RinsePoint may contact you about this request. See our <a href="/privacy.html" className="font-bold text-cyan-700 hover:underline">Privacy Policy</a>.
        </p>
      </div>
    </form>
  );
}

function HomePage() {
  return (
    <>
      <section className="overflow-hidden bg-slate-950 text-white">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 lg:grid-cols-[1.05fr_.95fr] lg:px-8 lg:py-24">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 border border-cyan-300/30 bg-cyan-300/10 px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-100">
              <MapPin className="h-4 w-4" /> Allen, Texas
            </div>
            <h1 className="text-4xl font-black tracking-tight sm:text-5xl md:text-7xl">
              Professional pressure washing for the concrete people notice first.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              RinsePoint cleans driveways, sidewalks, walkways, patios, and exterior concrete in Allen and nearby North Texas communities. Clear quotes. Straightforward service. Visible results.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href="/contact/" className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-500 px-6 py-4 font-extrabold text-white transition hover:bg-cyan-600">
                Get a Free Quote <ArrowRight className="h-5 w-5" />
              </a>
              <a href={business.smsLink} className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/20 bg-white px-6 py-4 font-extrabold text-slate-950">
                <MessageSquare className="h-5 w-5" /> Text Photos
              </a>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-7 gap-y-3 text-sm font-bold text-slate-300">
              <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-cyan-300" /> Owner-operated</span>
              <span className="flex items-center gap-2"><Camera className="h-4 w-4 text-cyan-300" /> Photo quotes</span>
              <span className="flex items-center gap-2"><ClipboardCheck className="h-4 w-4 text-cyan-300" /> Clear scope</span>
            </div>
          </div>
          <div>
            <BeforeAfter priority />
            <div className="border-x border-b border-slate-200 bg-white px-5 py-4 text-slate-900">
              <p className="text-sm font-black">Actual project result</p>
              <p className="mt-1 text-sm text-slate-500">Concrete sidewalk cleaning.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl divide-y divide-slate-200 px-5 md:grid-cols-3 md:divide-x md:divide-y-0 lg:px-8">
          {[
            ["Surface-aware cleaning", "The method is matched to the surface and condition."],
            ["Straightforward pricing", "Scope and starting price are explained before the job."],
            ["Fast communication", "Call, text, or send photos to get the process moving."],
          ].map(([title, text]) => (
            <div key={title} className="py-7 md:px-8 md:first:pl-0 md:last:pr-0">
              <p className="font-black text-slate-950">{title}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-5 py-20 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <SectionIntro eyebrow="Services" title="Exterior cleaning focused on the surfaces that shape curb appeal." text="RinsePoint is starting with the work we can execute well right now: concrete and compatible exterior hard surfaces." align="left" />
            <a href="/services/" className="inline-flex items-center gap-2 font-black text-cyan-800">View all services <ArrowRight className="h-4 w-4" /></a>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {services.map((service) => {
              const Icon = service.icon;
              return (
                <div key={service.title} className="border-t-4 border-cyan-500 bg-slate-50 p-6">
                  <Icon className="h-7 w-7 text-cyan-700" />
                  <h3 className="mt-5 text-xl font-black text-slate-950">{service.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{service.short}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-slate-50 px-5 py-20 lg:px-8">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2">
          <BeforeAfter />
          <div>
            <SectionIntro eyebrow="Results" title="The work should speak for itself." text="We use real project photography instead of stock photos or fake reviews. As the project library grows, this section will grow with it." align="left" />
            <div className="mt-7 grid gap-3">
              {[
                "Actual before-and-after project photos",
                "Clear expectations around permanent stains",
                "Scope confirmed before the job starts",
                "Finished work checked before we leave",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-cyan-700" />
                  <span className="font-bold text-slate-700">{item}</span>
                </div>
              ))}
            </div>
            <a href="/results/" className="mt-8 inline-flex items-center gap-2 font-black text-cyan-800">See project results <ArrowRight className="h-4 w-4" /></a>
          </div>
        </div>
      </section>

      <section className="px-5 py-20 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionIntro eyebrow="How it works" title="Simple from the first text to the final rinse." text="No complicated booking process and no surprise scope changes after the work starts." />
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {process.map((step, index) => (
              <div key={step.title} className="border-t border-slate-300 pt-6">
                <div className="text-sm font-black text-cyan-700">0{index + 1}</div>
                <h3 className="mt-4 text-2xl font-black text-slate-950">{step.title}</h3>
                <p className="mt-3 leading-7 text-slate-600">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-950 px-5 py-20 text-white lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionIntro eyebrow="Starting packages" title="Enough pricing to know what to expect." text="Every property is different, but a useful starting point is better than making customers guess." light />
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {packages.map((pkg) => (
              <div key={pkg.name} className={pkg.featured ? "border border-cyan-400 bg-white p-7 text-slate-950" : "border border-white/15 bg-white/5 p-7"}>
                <p className={pkg.featured ? "text-xs font-black uppercase tracking-[0.18em] text-cyan-700" : "text-xs font-black uppercase tracking-[0.18em] text-cyan-300"}>Starting at</p>
                <div className="mt-3 text-4xl font-black">{pkg.price}</div>
                <h3 className="mt-4 text-xl font-black">{pkg.name}</h3>
                <p className={pkg.featured ? "mt-3 text-sm leading-7 text-slate-600" : "mt-3 text-sm leading-7 text-slate-300"}>{pkg.note}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm leading-6 text-slate-400">
            Final pricing depends on size, buildup, stains, access, and specialty treatment needs. Photos are the fastest way to get an accurate quote.
          </p>
        </div>
      </section>

      <section className="px-5 py-20 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[.85fr_1.15fr] lg:items-center">
          <div>
            <SectionIntro eyebrow="Service area" title="Based in Allen. Built for nearby North Texas." text="RinsePoint serves Allen and nearby communities where the schedule and travel make sense for the job." align="left" />
            <a href="/areas/" className="mt-7 inline-flex items-center gap-2 font-black text-cyan-800">Check your area <ArrowRight className="h-4 w-4" /></a>
          </div>
          <div className="grid grid-cols-2 gap-px bg-slate-200 border border-slate-200 sm:grid-cols-3">
            {serviceAreas.slice(0, 9).map((area) => (
              <div key={area} className="bg-white p-5 text-center font-black text-slate-800">{area}</div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-cyan-50 px-5 py-16 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-7 md:flex-row md:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-700">Ready when you are</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">Send a few photos. Get a clear starting point.</h2>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <a href={business.smsLink} className="rounded-lg border border-slate-300 bg-white px-6 py-4 text-center font-extrabold text-slate-900">Text Photos</a>
            <a href="/contact/" className="rounded-lg bg-slate-950 px-6 py-4 text-center font-extrabold text-white">Request a Quote</a>
          </div>
        </div>
      </section>
    </>
  );
}

function ServicesPage() {
  return (
    <>
      <PageHero eyebrow="Services" title="Focused services. Clear scope. Professional execution." text="RinsePoint currently specializes in pressure washing and exterior hard-surface cleaning for homes and small businesses in Allen and nearby communities.">
        <a href="/contact/" className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-6 py-4 font-extrabold text-white">Request a Quote <ArrowRight className="h-5 w-5" /></a>
      </PageHero>

      <section className="px-5 py-20 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-2">
          {services.map((service) => {
            const Icon = service.icon;
            return (
              <article key={service.title} className="border border-slate-200 p-7 md:p-9">
                <Icon className="h-8 w-8 text-cyan-700" />
                <h2 className="mt-5 text-2xl font-black text-slate-950">{service.title}</h2>
                <p className="mt-4 leading-8 text-slate-600">{service.detail}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="bg-slate-50 px-5 py-20 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionIntro eyebrow="Starting packages" title="Common residential starting points." text="These are not one-size-fits-all guarantees. They are useful starting prices so you know the general range before sending photos." />
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {packages.map((pkg) => (
              <div key={pkg.name} className={pkg.featured ? "border-2 border-cyan-500 bg-white p-7" : "border border-slate-200 bg-white p-7"}>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">Starting at</p>
                <div className="mt-3 text-4xl font-black text-slate-950">{pkg.price}</div>
                <h3 className="mt-4 text-xl font-black text-slate-950">{pkg.name}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{pkg.note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-20 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[.9fr_1.1fr]">
          <div>
            <SectionIntro eyebrow="Before service" title="A few things help the job go smoothly." text="Moving vehicles, small furniture, fragile items, and anything blocking the cleaning area before arrival can save time." align="left" />
          </div>
          <div className="grid gap-4">
            {[
              "Working outdoor water source available",
              "Vehicles moved from the cleaning area",
              "Fragile or lightweight items moved when possible",
              "Gates or access points unlocked if needed",
              "Problem stains mentioned before the job",
            ].map((item) => (
              <div key={item} className="flex gap-3 border-b border-slate-200 pb-4">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-cyan-700" />
                <span className="font-bold text-slate-700">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <FAQSection />
    </>
  );
}

function ResultsPage() {
  return (
    <>
      <PageHero eyebrow="Results" title="Real work, shown clearly." text="RinsePoint uses actual project photos so you can judge the cleaning difference for yourself. No stock-photo gallery and no manufactured reviews." />
      <section className="px-5 py-20 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
          <div>
            <BeforeAfter priority />
            <div className="border-x border-b border-slate-200 bg-white p-5">
              <p className="font-black text-slate-950">Concrete sidewalk cleaning</p>
              <p className="mt-1 text-sm text-slate-500">Before-and-after surface cleaning</p>
            </div>
          </div>
          <div>
            <SectionIntro eyebrow="Project 01" title="Visible surface improvement without overselling the result." text="Some stains can be permanent or require specialty treatment. We would rather set the expectation correctly than promise that every mark will disappear." align="left" />
            <div className="mt-7 grid gap-4">
              {[
                "Real before-and-after photos",
                "Surface condition reviewed before starting",
                "Problem stains discussed up front",
                "Finished work checked at completion",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-cyan-700" />
                  <span className="font-bold text-slate-700">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      <section className="bg-slate-50 px-5 py-16 lg:px-8">
        <div className="mx-auto max-w-7xl border-l-4 border-cyan-500 bg-white p-7 md:p-9">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-cyan-700">Project library</p>
          <h2 className="mt-3 text-3xl font-black text-slate-950">More real jobs will be added as they are completed.</h2>
          <p className="mt-4 max-w-2xl leading-8 text-slate-600">
            The goal is to build this page with genuine RinsePoint work from Allen, Parker, Lucas, Fairview, McKinney, and nearby areas—not filler photography.
          </p>
        </div>
      </section>
    </>
  );
}

function AboutPage() {
  return (
    <>
      <PageHero eyebrow="About RinsePoint" title="A local exterior-cleaning company built around straightforward service." text="RinsePoint is owner-operated in Allen, Texas. The focus is simple: communicate clearly, show up prepared, clean carefully, and let the finished work speak for itself." />
      <section className="px-5 py-20 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-2">
          <div>
            <SectionIntro eyebrow="The approach" title="Professional does not have to mean complicated." text="Customers should know what is being cleaned, what it is expected to cost, what access is needed, and what happens next. That is the standard RinsePoint is being built around." align="left" />
          </div>
          <div className="grid gap-px bg-slate-200 border border-slate-200 sm:grid-cols-2">
            {[
              ["Clear scope", "The agreed cleaning area is confirmed before work begins."],
              ["Fast response", "Text and photo quotes make the first step easy."],
              ["Careful methods", "The cleaning approach is matched to the surface and condition."],
              ["Visible proof", "Real project photos show the difference without inflated claims."],
            ].map(([title, text]) => (
              <div key={title} className="bg-white p-6">
                <h3 className="font-black text-slate-950">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="bg-slate-950 px-5 py-20 text-white lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[.8fr_1.2fr]">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">How we build trust</p>
            <h2 className="mt-4 text-3xl font-black md:text-4xl">Real work first. Claims second.</h2>
          </div>
          <div className="text-lg leading-8 text-slate-300">
            <p>
              RinsePoint is a growing local business. The website is built around services we are actually ready to perform, real project photography, and clear starting prices.
            </p>
            <p className="mt-5">
              As the company adds equipment, services, completed projects, and customer reviews, the site will expand with real proof instead of pretending those things already exist.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}

function AreasPage() {
  return (
    <>
      <PageHero eyebrow="Service areas" title="Allen first. Nearby North Texas when the job makes sense." text="RinsePoint is based in Allen and serves nearby communities for residential and small commercial exterior cleaning." />
      <section className="px-5 py-20 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-2 gap-px border border-slate-200 bg-slate-200 sm:grid-cols-3 lg:grid-cols-4">
            {serviceAreas.map((area) => (
              <div key={area} className="bg-white p-7 text-center">
                <MapPin className="mx-auto h-5 w-5 text-cyan-700" />
                <div className="mt-3 font-black text-slate-950">{area}</div>
                <div className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Texas</div>
              </div>
            ))}
          </div>
          <div className="mt-10 border-l-4 border-cyan-500 bg-slate-50 p-7">
            <h2 className="text-2xl font-black text-slate-950">Not sure if you are in range?</h2>
            <p className="mt-3 max-w-2xl leading-7 text-slate-600">
              Send the property address, the service you need, and a few photos. We will confirm whether the job is within the current service area before quoting.
            </p>
            <a href="/contact/" className="mt-5 inline-flex items-center gap-2 font-black text-cyan-800">Check availability <ArrowRight className="h-4 w-4" /></a>
          </div>
        </div>
      </section>
    </>
  );
}

function FAQSection() {
  return (
    <section className="bg-slate-50 px-5 py-20 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <SectionIntro eyebrow="FAQ" title="Questions worth answering before you book." />
        <div className="mt-10 divide-y divide-slate-200 border-y border-slate-200">
          {faqs.map((faq) => (
            <details key={faq.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-5 font-black text-slate-950">
                {faq.q}
                <span className="text-cyan-700 transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 max-w-3xl leading-7 text-slate-600">{faq.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function ContactPage() {
  return (
    <>
      <PageHero eyebrow="Request a quote" title="Tell us what you want cleaned." text="The fastest quote starts with the address, the surfaces you want cleaned, and a few clear photos. You can also call or text directly.">
        <div className="flex flex-col gap-3 sm:flex-row">
          <a href={business.phoneLink} className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-4 font-extrabold text-slate-950">
            <Phone className="h-5 w-5" /> {business.phone}
          </a>
          <a href={business.smsLink} className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/20 px-6 py-4 font-extrabold text-white">
            <MessageSquare className="h-5 w-5" /> Text Photos
          </a>
        </div>
      </PageHero>

      <section className="px-5 py-16 lg:px-8 lg:py-20">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[.75fr_1.25fr]">
          <div>
            <h2 className="text-2xl font-black text-slate-950">What helps us quote faster</h2>
            <div className="mt-6 grid gap-5">
              {[
                ["Property location", "Address or at least the city."],
                ["What needs cleaning", "Driveway, sidewalk, patio, commercial concrete, or multiple areas."],
                ["Clear photos", "Wide shots plus closer photos of stains or problem spots."],
                ["Access details", "Gates, water source, parking, or anything unusual."],
              ].map(([title, text]) => (
                <div key={title} className="border-b border-slate-200 pb-5">
                  <p className="font-black text-slate-950">{title}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{text}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 bg-cyan-50 p-6">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-cyan-800">Direct contact</p>
              <a href={business.phoneLink} className="mt-3 block text-2xl font-black text-slate-950">{business.phone}</a>
              <p className="mt-2 text-sm leading-6 text-slate-600">Call or text. Photos by text are usually the fastest way to start.</p>
            </div>
          </div>
          <QuoteForm />
        </div>
      </section>
    </>
  );
}

function NotFoundPage() {
  return (
    <section className="px-5 py-24 lg:px-8">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-black uppercase tracking-[0.22em] text-cyan-700">404</p>
        <h1 className="mt-4 text-5xl font-black text-slate-950">That page is not here.</h1>
        <p className="mt-5 text-lg text-slate-600">Head back to the RinsePoint homepage or request a quote.</p>
        <a href="/" className="mt-8 inline-block rounded-lg bg-slate-950 px-6 py-4 font-extrabold text-white">Back to home</a>
      </div>
    </section>
  );
}

function CurrentPage() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  if (path === "/") return <HomePage />;
  if (path === "/services") return <ServicesPage />;
  if (path === "/results") return <ResultsPage />;
  if (path === "/about") return <AboutPage />;
  if (path === "/areas") return <AreasPage />;
  if (path === "/contact") return <ContactPage />;
  return <NotFoundPage />;
}

export default function App() {
  return (
    <div className="min-h-screen bg-white pb-20 text-slate-950 lg:pb-0">
      <Header />
      <main>
        <CurrentPage />
      </main>
      <Footer />
      <MobileBar />
    </div>
  );
}
