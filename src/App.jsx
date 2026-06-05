import React, { useState } from "react";
import { useForm, ValidationError } from "@formspree/react";
import { motion } from "framer-motion";
import {
  Phone,
  MessageSquare,
  Droplets,
  ShieldCheck,
  Star,
  MapPin,
  Sparkles,
  Home,
  Building2,
  Trees,
  ClipboardCheck,
  Camera,
  CheckCircle2,
  Menu,
  X,
  Mail,
  Clock,
  ChevronRight,
  DollarSign,
  Info,
} from "lucide-react";

const business = {
  name: "CurbLift Exterior Cleaning",
  shortName: "CurbLift",
  tagline: "We lift the dirt. You enjoy the difference.",
  location: "Allen, TX",
  serviceLine: "Pressure Washing • Soft Washing • Surface Cleaning",
  phone: "(972) 672-0212",
  smsLink: "sms:+19726720212",
  phoneLink: "tel:+19726720212",
  email: "CurbLiftClean@gmail.com",
};

const beforeAfter = {
  before: "/images/before-sidewalk.jpg",
  after: "/images/after-sidewalk.jpg",
};

const services = [
  {
    icon: Home,
    title: "House Washing",
    text: "Low-pressure soft washing for siding, brick, gutters, trim, and exterior surfaces so your home looks fresh without unnecessary damage.",
  },
  {
    icon: Droplets,
    title: "Driveway & Concrete Cleaning",
    text: "Remove built-up dirt, mildew, algae, tire marks, and stains from driveways, sidewalks, walkways, and entryways.",
  },
  {
    icon: Trees,
    title: "Deck, Fence & Patio Cleaning",
    text: "Refresh outdoor living spaces with careful cleaning for wood, composite, stone, concrete, and backyard surfaces.",
  },
  {
    icon: Building2,
    title: "Commercial Exterior Cleaning",
    text: "Keep storefronts, entryways, sidewalks, dumpster pads, and exterior business areas looking clean and professional.",
  },
];

const pricing = [
  {
    service: "Sidewalk Cleaning",
    price: "$49",
    note: "Great for front walkways, entry paths, and smaller concrete areas.",
  },
  {
    service: "Driveway Cleaning",
    price: "$99",
    note: "Starting price for standard residential driveways. Larger or heavily stained concrete may be higher.",
  },
  {
    service: "Patio Cleaning",
    price: "$89",
    note: "For backyard patios, sitting areas, and smaller outdoor concrete spaces.",
  },
  {
    service: "House Washing",
    price: "$199",
    note: "Starting price for exterior soft washing. Final quote depends on size, stories, and buildup.",
  },
];

const process = [
  {
    title: "Request a Quote",
    text: "Call, text, or fill out the form with what you need cleaned.",
  },
  {
    title: "Send Photos",
    text: "Clear photos help us estimate faster and understand the job before arrival.",
  },
  {
    title: "Schedule Service",
    text: "Pick a time that works and we confirm the service details up front.",
  },
  {
    title: "Enjoy the Difference",
    text: "We clean, rinse, inspect, and leave the property looking noticeably better.",
  },
];

const serviceAreas = [
  "Allen",
  "McKinney",
  "Plano",
  "Frisco",
  "Fairview",
  "Lucas",
  "Parker",
  "Murphy",
  "Wylie",
  "Richardson",
  "Prosper",
  "Sachse",
];

const faqs = [
  {
    q: "Do you use high pressure on houses?",
    a: "No. For most home exteriors, soft washing is the safer method. It uses the right cleaning mix and lower pressure instead of blasting delicate surfaces.",
  },
  {
    q: "Can I get a quote from photos?",
    a: "Yes. Most residential jobs can be estimated with clear photos, your city, and a short description of what needs to be cleaned.",
  },
  {
    q: "Do I need to be home during service?",
    a: "Not always. If we have access to the cleaning areas and an outdoor water source, many jobs can be completed while you are away.",
  },
  {
    q: "Are you insured?",
    a: "CurbLift is not advertising full insurance coverage yet, but we are working toward a professional business setup. Contact us for current service availability, job details, and booking information before scheduling.",
  },
  {
    q: "What areas do you serve?",
    a: "CurbLift is based near Allen, Texas and serves nearby North Texas cities including McKinney, Plano, Frisco, Fairview, Lucas, Murphy, Wylie, and more.",
  },
];

const earlyResults = [
  {
    quote:
      "The sidewalk and concrete looked completely different after the cleaning. The before and after was night and day.",
    name: "Early Project Result",
    city: "Allen, TX",
  },
];

function Logo() {
  return (
    <a href="#home" className="flex items-center gap-3">
      <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500 text-white shadow-lg shadow-cyan-500/25">
        <Droplets className="h-7 w-7" />
        <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[9px] font-black text-cyan-600">
          CL
        </span>
      </div>
      <div>
        <p className="text-lg font-black leading-5 tracking-tight text-slate-950">
          {business.shortName}
        </p>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-600">
          Exterior Cleaning
        </p>
      </div>
    </a>
  );
}

function SectionHeader({ eyebrow, title, text, light = false }) {
  return (
    <div className="mx-auto mb-12 max-w-3xl text-center">
      <p className="mb-3 text-sm font-black uppercase tracking-[0.22em] text-cyan-600">
        {eyebrow}
      </p>
      <h2
        className={`text-3xl font-black tracking-tight md:text-5xl ${
          light ? "text-white" : "text-slate-950"
        }`}
      >
        {title}
      </h2>
      {text && (
        <p
          className={`mt-4 text-base leading-8 md:text-lg ${
            light ? "text-slate-300" : "text-slate-600"
          }`}
        >
          {text}
        </p>
      )}
    </div>
  );
}

function CTAButtons({ dark = true }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <a
        href="#quote"
        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-6 py-4 text-base font-extrabold text-white shadow-lg shadow-cyan-500/25 transition hover:-translate-y-0.5 hover:bg-cyan-600"
      >
        Get a Free Quote <ChevronRight className="h-5 w-5" />
      </a>
      <a
        href={business.phoneLink}
        className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-6 py-4 text-base font-extrabold shadow-lg transition hover:-translate-y-0.5 ${
          dark
            ? "border-white/20 bg-white text-slate-950 hover:bg-slate-100"
            : "border-slate-200 bg-slate-950 text-white hover:bg-slate-800"
        }`}
      >
        <Phone className="h-5 w-5" /> Call Now
      </a>
    </div>
  );
}

function BeforeAfterCard({ compact = false }) {
  return (
    <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl shadow-slate-950/10">
      <div className="grid grid-cols-2">
        <div className="relative aspect-[4/3] overflow-hidden bg-slate-200">
          <img
            src={beforeAfter.before}
            alt="Before power washing sidewalk"
            className="h-full w-full object-cover"
          />
          <div className="absolute left-3 top-3 rounded-full bg-slate-950 px-3 py-1 text-xs font-black uppercase tracking-widest text-white">
            Before
          </div>
        </div>
        <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
          <img
            src={beforeAfter.after}
            alt="After power washing sidewalk"
            className="h-full w-full object-cover"
          />
          <div className="absolute right-3 top-3 rounded-full bg-cyan-500 px-3 py-1 text-xs font-black uppercase tracking-widest text-white">
            After
          </div>
        </div>
      </div>
      {!compact && (
        <div className="p-6">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-cyan-600">
            Real Result
          </p>
          <h3 className="mt-2 text-2xl font-black text-slate-950">
            Sidewalk surface cleaning
          </h3>
          <p className="mt-3 leading-7 text-slate-600">
            A simple before-and-after proof point customers can understand
            immediately: cleaner concrete, better curb appeal, and a property
            that feels cared for.
          </p>
        </div>
      )}
    </div>
  );
}

function QuoteForm() {
  const [state, handleSubmit] = useForm("meedvvbl");

  if (state.succeeded) {
    return (
      <div className="bg-white p-8 md:p-12">
        <div className="flex min-h-[520px] flex-col items-center justify-center rounded-3xl border border-cyan-200 bg-cyan-50 p-8 text-center">
          <CheckCircle2 className="mb-5 h-14 w-14 text-cyan-600" />
          <h3 className="text-3xl font-black text-slate-950">
            Quote request sent!
          </h3>
          <p className="mt-4 max-w-md leading-7 text-slate-600">
            Thanks for reaching out to CurbLift. We received your request and
            will follow up as soon as possible.
          </p>
          <a
            href={business.phoneLink}
            className="mt-6 rounded-2xl bg-slate-950 px-6 py-4 font-extrabold text-white hover:bg-slate-800"
          >
            Need it faster? Call {business.phone}
          </a>
        </div>
      </div>
    );
  }

  return (
    <form className="bg-white p-8 md:p-12" onSubmit={handleSubmit}>
      <input type="hidden" name="_subject" value="New CurbLift Quote Request" />
      <input type="hidden" name="business" value="CurbLift Exterior Cleaning" />

      <div className="grid gap-4">
        <div>
          <label className="mb-2 block text-sm font-black text-slate-700">
            Name
          </label>
          <input
            className="w-full rounded-2xl border border-slate-200 px-4 py-4 outline-none focus:border-cyan-500"
            name="name"
            placeholder="Your name"
            required
          />
          <ValidationError
            field="name"
            errors={state.errors}
            className="mt-2 block text-sm font-bold text-red-600"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-black text-slate-700">
              Phone
            </label>
            <input
              className="w-full rounded-2xl border border-slate-200 px-4 py-4 outline-none focus:border-cyan-500"
              name="phone"
              type="tel"
              placeholder="Phone number"
              required
            />
            <ValidationError
              field="phone"
              errors={state.errors}
              className="mt-2 block text-sm font-bold text-red-600"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-black text-slate-700">
              Email
            </label>
            <input
              className="w-full rounded-2xl border border-slate-200 px-4 py-4 outline-none focus:border-cyan-500"
              name="email"
              type="email"
              placeholder="Email address"
              required
            />
            <ValidationError
              field="email"
              errors={state.errors}
              className="mt-2 block text-sm font-bold text-red-600"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-black text-slate-700">
              City
            </label>
            <input
              className="w-full rounded-2xl border border-slate-200 px-4 py-4 outline-none focus:border-cyan-500"
              name="city"
              placeholder="Allen, McKinney, Plano..."
              required
            />
            <ValidationError
              field="city"
              errors={state.errors}
              className="mt-2 block text-sm font-bold text-red-600"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-black text-slate-700">
              Service Needed
            </label>
            <select
              className="w-full rounded-2xl border border-slate-200 px-4 py-4 outline-none focus:border-cyan-500"
              name="service"
              required
            >
              <option value="">Choose a service</option>
              <option>Driveway / concrete cleaning</option>
              <option>House washing</option>
              <option>Fence / deck / patio cleaning</option>
              <option>Commercial pressure washing</option>
              <option>Not sure yet</option>
            </select>
            <ValidationError
              field="service"
              errors={state.errors}
              className="mt-2 block text-sm font-bold text-red-600"
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-black text-slate-700">
            Project Details
          </label>
          <textarea
            rows="5"
            className="w-full rounded-2xl border border-slate-200 px-4 py-4 outline-none focus:border-cyan-500"
            name="message"
            placeholder="Tell us what you need cleaned, approximate size, and any problem areas. You can also text photos for a faster quote."
            required
          />
          <ValidationError
            field="message"
            errors={state.errors}
            className="mt-2 block text-sm font-bold text-red-600"
          />
        </div>

        <button
          className="rounded-2xl bg-cyan-500 px-6 py-4 text-base font-extrabold text-white shadow-lg shadow-cyan-500/25 transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-60"
          type="submit"
          disabled={state.submitting}
        >
          {state.submitting ? "Sending..." : "Request My Free Quote"}
        </button>

        <ValidationError
          errors={state.errors}
          className="text-center text-sm font-bold text-red-600"
        />

        <p className="text-center text-xs leading-5 text-slate-500">
          Your request will be sent directly through Formspree. For the fastest
          quote, you can also text photos to {business.phone}.
        </p>
      </div>
    </form>
  );
}

export default function PowerWashingWebsite() {
  const [open, setOpen] = useState(false);
  const nav = ["About", "Services", "Pricing", "Results", "Areas", "FAQ", "Quote"];

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <Logo />

          <nav className="hidden items-center gap-7 lg:flex">
            {nav.map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase()}`}
                className="text-sm font-black uppercase tracking-wide text-slate-600 hover:text-cyan-600"
              >
                {item}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            <a
              href={business.smsLink}
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-extrabold text-slate-700 hover:bg-slate-50"
            >
              Text Photos
            </a>
            <a
              href={business.phoneLink}
              className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-extrabold text-white hover:bg-slate-800"
            >
              {business.phone}
            </a>
          </div>

          <button
            onClick={() => setOpen(!open)}
            className="rounded-xl border border-slate-200 p-3 lg:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {open && (
          <div className="border-t border-slate-200 bg-white px-5 py-4 lg:hidden">
            <div className="flex flex-col gap-3">
              {nav.map((item) => (
                <a
                  key={item}
                  href={`#${item.toLowerCase()}`}
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-3 py-3 font-bold text-slate-700 hover:bg-slate-50"
                >
                  {item}
                </a>
              ))}
              <a
                href={business.phoneLink}
                className="rounded-xl bg-slate-950 px-4 py-3 text-center font-extrabold text-white"
              >
                Call {business.phone}
              </a>
            </div>
          </div>
        )}
      </header>

      <main id="home">
        <section className="relative overflow-hidden bg-slate-950 text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.35),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.24),transparent_35%)]" />
          <div className="absolute inset-0 opacity-10 [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:44px_44px]" />

          <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 py-20 lg:grid-cols-2 lg:px-8 lg:py-28">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-sm font-bold text-cyan-100">
                <Sparkles className="h-4 w-4" /> {business.serviceLine}
              </div>
              <h1 className="text-5xl font-black tracking-tight md:text-7xl">
                Restore your home.{" "}
                <span className="text-cyan-300">Boost your curb appeal.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
                {business.name} helps homeowners and small businesses across
                Allen and North Texas remove dirt, grime, algae, and stains from
                exterior surfaces.
              </p>
              <div className="mt-8">
                <CTAButtons />
              </div>
              <div className="mt-8 grid gap-4 text-sm font-bold text-slate-200 sm:grid-cols-3">
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-cyan-300" /> Locally owned
                </div>
                <div className="flex items-center gap-2">
                  <Camera className="h-5 w-5 text-cyan-300" /> Photo quotes
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-cyan-300" /> Fast scheduling
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="relative"
            >
              <BeforeAfterCard />

              <div className="mt-5 rounded-3xl bg-white p-5 text-slate-950 shadow-xl">
                <div className="flex items-center gap-1 text-yellow-500">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-current" />
                  ))}
                </div>
                <p className="mt-2 font-black">
                  Real results. Local service.
                </p>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="bg-cyan-50 px-5 py-8 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-3">
            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <ShieldCheck className="mb-3 h-7 w-7 text-cyan-600" />
              <h3 className="font-black">Surface-safe approach</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                The right cleaning method for each surface, not just maximum
                pressure everywhere.
              </p>
            </div>
            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <ClipboardCheck className="mb-3 h-7 w-7 text-cyan-600" />
              <h3 className="font-black">Clear quotes</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Simple estimates, clear scope, and no surprise add-ons after the
                job starts.
              </p>
            </div>
            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <Camera className="mb-3 h-7 w-7 text-cyan-600" />
              <h3 className="font-black">Photo-friendly estimates</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Customers can send photos for faster quotes before scheduling
                service.
              </p>
            </div>
          </div>
        </section>

        <section id="about" className="px-5 py-20 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <p className="mb-3 text-sm font-black uppercase tracking-[0.22em] text-cyan-600">
                About CurbLift
              </p>
              <h2 className="text-4xl font-black tracking-tight text-slate-950 md:text-5xl">
                A locally owned exterior cleaning service built on clear
                communication and visible results.
              </h2>
            </div>
            <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-7 shadow-sm">
              <p className="text-lg leading-8 text-slate-700">
                CurbLift Exterior Cleaning is a locally owned exterior cleaning
                service based near Allen, Texas. We help homeowners and small
                businesses improve curb appeal with driveway cleaning, sidewalk
                cleaning, patio cleaning, house washing, and surface cleaning.
              </p>
              <p className="mt-5 text-lg leading-8 text-slate-700">
                Our goal is simple: clear communication, dependable scheduling,
                careful cleaning methods, and results customers can see right
                away.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-white p-4 font-black text-slate-700 shadow-sm">
                  Local Service
                </div>
                <div className="rounded-2xl bg-white p-4 font-black text-slate-700 shadow-sm">
                  Fast Quotes
                </div>
                <div className="rounded-2xl bg-white p-4 font-black text-slate-700 shadow-sm">
                  Real Results
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="services" className="bg-slate-50 px-5 py-20 lg:px-8">
          <SectionHeader
            eyebrow="Services"
            title="Exterior cleaning services built for curb appeal."
            text="Whether it is concrete, siding, patios, fences, or business entryways, CurbLift focuses on results customers can see right away."
          />
          <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-2 lg:grid-cols-4">
            {services.map((service) => {
              const Icon = service.icon;
              return (
                <div
                  key={service.title}
                  className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
                >
                  <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-700">
                    <Icon className="h-7 w-7" />
                  </div>
                  <h3 className="text-xl font-black">{service.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    {service.text}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <section id="pricing" className="px-5 py-20 lg:px-8">
          <SectionHeader
            eyebrow="Starting Prices"
            title="Simple starting prices for common cleaning jobs."
            text="Every property is different, so final pricing depends on size, surface condition, stains, access, and the amount of buildup. These starting prices give customers a clear idea before requesting a quote."
          />
          <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-2 lg:grid-cols-4">
            {pricing.map((item) => (
              <div
                key={item.service}
                className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-700">
                  <DollarSign className="h-7 w-7" />
                </div>
                <p className="text-sm font-black uppercase tracking-[0.18em] text-cyan-600">
                  Starting at
                </p>
                <h3 className="mt-2 text-4xl font-black text-slate-950">
                  {item.price}
                </h3>
                <p className="mt-3 text-lg font-black text-slate-800">
                  {item.service}
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  {item.note}
                </p>
              </div>
            ))}
          </div>
          <div className="mx-auto mt-8 flex max-w-4xl gap-3 rounded-3xl border border-cyan-200 bg-cyan-50 p-5 text-slate-700">
            <Info className="mt-1 h-6 w-6 shrink-0 text-cyan-700" />
            <p className="leading-7">
              Final quotes may be higher for large areas, heavy staining, oil
              spots, algae buildup, multi-story homes, or jobs requiring extra
              prep. Texting photos is the fastest way to get an accurate quote.
            </p>
          </div>
        </section>

        <section className="bg-slate-950 px-5 py-20 text-white lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-2">
            <div>
              <p className="mb-3 text-sm font-bold uppercase tracking-[0.22em] text-cyan-300">
                How it works
              </p>
              <h2 className="text-4xl font-black tracking-tight md:text-5xl">
                Simple. Fast. Professional.
              </h2>
              <p className="mt-5 max-w-xl text-lg leading-8 text-slate-300">
                A clear process builds trust before customers ever call. This
                makes booking feel easy and low-risk.
              </p>
            </div>
            <div className="grid gap-4">
              {process.map((step, index) => (
                <div
                  key={step.title}
                  className="flex gap-4 rounded-3xl border border-white/10 bg-white/5 p-5"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-500 font-black text-white">
                    {index + 1}
                  </div>
                  <div>
                    <h3 className="font-black text-white">{step.title}</h3>
                    <p className="mt-1 leading-7 text-slate-300">
                      {step.text}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="results" className="px-5 py-20 lg:px-8">
          <SectionHeader
            eyebrow="Early Results"
            title="Real results are the best proof."
            text="CurbLift is just getting started, so this section will grow with more real project photos and customer feedback over time."
          />
          <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <BeforeAfterCard />
            <div className="grid gap-5">
              {earlyResults.map((result) => (
                <div
                  key={result.quote}
                  className="rounded-3xl bg-cyan-50 p-7 shadow-sm"
                >
                  <div className="mb-4 flex text-yellow-500">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-5 w-5 fill-current" />
                    ))}
                  </div>
                  <p className="text-lg font-bold leading-8 text-slate-800">
                    “{result.quote}”
                  </p>
                  <p className="mt-5 text-sm font-black text-slate-950">
                    {result.name}
                  </p>
                  <p className="text-sm font-bold text-cyan-700">
                    {result.city}
                  </p>
                </div>
              ))}

              {[
                "Cleaner sidewalks and walkways",
                "Brighter concrete and entryways",
                "Better first impression before guests arrive",
                "Great photo proof for future customers",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <CheckCircle2 className="h-6 w-6 shrink-0 text-cyan-600" />
                  <p className="font-bold text-slate-700">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="areas" className="bg-slate-50 px-5 py-20 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <p className="mb-3 text-sm font-bold uppercase tracking-[0.22em] text-cyan-600">
                Service Areas
              </p>
              <h2 className="text-4xl font-black tracking-tight md:text-5xl">
                Proudly serving Allen and nearby North Texas communities.
              </h2>
              <p className="mt-5 text-lg leading-8 text-slate-600">
                Local service area pages can help later with Google searches
                like “pressure washing in Allen TX” and “driveway cleaning near
                me.”
              </p>
              <div className="mt-8 flex items-center gap-3 rounded-3xl border border-slate-200 bg-white p-5">
                <MapPin className="h-7 w-7 text-cyan-600" />
                <p className="font-bold text-slate-700">
                  Based near {business.location}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {serviceAreas.map((area) => (
                <div
                  key={area}
                  className="rounded-2xl border border-slate-200 bg-white p-4 text-center font-black shadow-sm"
                >
                  {area}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="px-5 py-20 lg:px-8">
          <SectionHeader
            eyebrow="FAQ"
            title="Questions customers usually ask before booking."
          />
          <div className="mx-auto grid max-w-4xl gap-4">
            {faqs.map((faq) => (
              <div
                key={faq.q}
                className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <h3 className="text-lg font-black">{faq.q}</h3>
                <p className="mt-3 leading-7 text-slate-600">{faq.a}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="quote" className="px-5 py-20 lg:px-8">
          <div className="mx-auto grid max-w-7xl overflow-hidden rounded-[2rem] bg-slate-950 shadow-2xl lg:grid-cols-2">
            <div className="p-8 text-white md:p-12">
              <p className="mb-3 text-sm font-bold uppercase tracking-[0.22em] text-cyan-300">
                Free Quote
              </p>
              <h2 className="text-4xl font-black tracking-tight md:text-5xl">
                Ready to lift the dirt?
              </h2>
              <p className="mt-5 text-lg leading-8 text-slate-300">
                Fill out the form, call, or text to request an estimate. For the
                fastest quote, include the service you need and a few clear
                photos.
              </p>
              <div className="mt-8 grid gap-4">
                <a
                  href={business.phoneLink}
                  className="flex items-center gap-3 rounded-2xl bg-white/10 p-4 font-black text-white hover:bg-white/15"
                >
                  <Phone className="h-5 w-5 text-cyan-300" /> {business.phone}
                </a>
                <a
                  href={business.smsLink}
                  className="flex items-center gap-3 rounded-2xl bg-white/10 p-4 font-black text-white hover:bg-white/15"
                >
                  <MessageSquare className="h-5 w-5 text-cyan-300" /> Text
                  photos for a quote
                </a>
                <a
                  href={`mailto:${business.email}`}
                  className="flex items-center gap-3 rounded-2xl bg-white/10 p-4 font-black text-white hover:bg-white/15"
                >
                  <Mail className="h-5 w-5 text-cyan-300" /> {business.email}
                </a>
              </div>
            </div>

            <QuoteForm />
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white px-5 py-10 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xl font-black">{business.name}</p>
            <p className="mt-2 text-sm text-slate-500">{business.tagline}</p>
          </div>
          <div className="flex flex-col gap-2 text-sm font-bold text-slate-600 sm:flex-row sm:gap-5">
            <a href={business.phoneLink}>Call {business.phone}</a>
            <a href={`mailto:${business.email}`}>{business.email}</a>
            <a href="#quote">Free Quote</a>
          </div>
        </div>
      </footer>
    </div>
  );
}