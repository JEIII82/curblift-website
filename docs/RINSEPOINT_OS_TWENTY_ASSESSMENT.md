# RinsePoint OS — Twenty CRM Reference Assessment
_Date: 2026-10-01_

## Executive conclusion

RinsePoint OS should remain the primary system. Do not replace it with Twenty and do not run a second CRM beside it.

Twenty is most useful to RinsePoint as a reference for CRM primitives and interaction patterns: flexible record views, saved filters, activity timelines, fast search, command-driven navigation, extensible objects/fields, workflows, permissions, and a consistent record-detail experience.

RinsePoint already has the more important business-specific foundation that Twenty does not provide out of the box: customer → property → quote → approval → job → schedule → completion → invoice → Stripe payment → review/retention.

Supabase/PostgreSQL should remain the source of truth.

## What exists today

### Frontend
- React 19 + Vite 8 + Tailwind CSS 4
- Public RinsePoint marketing website
- Owner-only /app workspace
- Dashboard
- Leads
- Customers
- Quotes
- Jobs
- Calendar
- Invoices
- Pricebook
- Public quote and invoice experiences

### Backend / data
- Supabase Auth
- PostgreSQL
- Organization + membership model
- Organization-scoped RLS policies
- Customers
- Properties
- Leads
- Services
- Quotes + quote items + quote revisions
- Jobs
- Appointments
- Invoices + invoice items + invoice revisions
- Payments
- Communications
- Files
- Tasks
- Reviews
- Activity events
- Automation events
- Integration settings
- Organization settings
- Lead intake attempts

### Server-side functions
- lead-intake
- claim-owner
- quote-admin
- quote-public
- job-admin
- invoice-admin
- invoice-public
- stripe-payment-sync
- invoice-checkout

### Working lifecycle
Website inquiry → customer/property/lead → quote → send → public approval → job → scheduling → job field states → completion → invoice → Stripe Checkout → payment sync → paid invoice.

This is the correct core domain model for RinsePoint and should be extended rather than replaced.

---

## What RinsePoint already does well

1. **Industry lifecycle over generic CRM stages.** The data model already reflects how an exterior-cleaning business actually operates.
2. **Property is first-class.** This is important for home-service work and is more useful than a generic company/contact CRM model.
3. **Quote approval converts naturally to operational work.**
4. **Invoice and payment are native to the workflow.**
5. **Public customer experiences are connected to the same database.**
6. **Historical lead snapshots preserve what was submitted at that point in time.**
7. **Organization-scoped RLS and authenticated edge functions provide a credible security base.**
8. **Automation integration already exists rather than being an afterthought.**
9. **Quote and invoice revisions already have dedicated tables, which is a good foundation for version history.**
10. **Activity, communication, task, file, review, and automation-event tables already exist, so the schema is ahead of the UI.**

## What Twenty does better today

Twenty's strongest advantages are not RinsePoint-specific workflows; they are mature CRM interaction primitives:

- metadata-driven objects and fields
- first-class relationships
- reusable table / list / kanban / calendar views
- powerful filtering, grouping, sorting, and saved views
- global search
- favorites and fast navigation
- command menu / keyboard workflow
- consistent record pages
- tasks and notes as reusable CRM primitives
- workflows with record, schedule, manual, and webhook triggers
- REST + GraphQL APIs
- granular roles and permissions
- audit/activity patterns
- extensibility through SDK-defined objects, fields, views, logic, UI components, and agents

Twenty's current open-source stack is a large Nx monorepo with React on the frontend and NestJS/PostgreSQL/Redis/BullMQ on the server. RinsePoint does not need to copy that infrastructure scale.

Official references:
- https://github.com/twentyhq/twenty
- https://github.com/twentyhq/twenty/blob/main/packages/twenty-docs/getting-started/core-concepts/data-model.mdx
- https://github.com/twentyhq/twenty/blob/main/packages/twenty-docs/getting-started/core-concepts/workflows.mdx
- https://github.com/twentyhq/twenty/blob/main/packages/twenty-docs/developers/extend/apps/layout/views.mdx
- https://github.com/twentyhq/twenty/blob/main/packages/twenty-docs/getting-started/core-concepts/layout.mdx

---

## Feature decisions: A/B/C/D/E

Legend:
- **A** already sufficiently covered
- **B** improve existing implementation
- **C** build a native RinsePoint version
- **D** integrate an external service
- **E** ignore/defer because it does not materially help now

| Area | Decision | RinsePoint direction |
|---|---|---|
| Customers / contacts | B | Keep native customer object; improve 360 workspace |
| Companies/accounts | E now | Add only when commercial accounts justify it |
| Properties | C | Core RinsePoint object; expand heavily |
| Relationships | B | Existing FKs are good; improve UI/navigation |
| Tags | B | Already on customers; expose consistently |
| Notes | B | Customer/property/job notes exist; improve structured UI |
| Tasks | B | Table exists; build operational task UI |
| Reminders/follow-ups | C | Native task + due-date/follow-up system |
| Activity timeline | C | Unify existing events/communications/payments/reviews |
| Email history | B/D | Store native history; use Gmail/Make/provider for delivery |
| SMS | D + native history | Twilio/provider for delivery, communications table for truth |
| Table/list views | C | Shared reusable list-view system |
| Kanban | C | Lead pipeline first; maybe jobs later |
| Filters/sorting | C | Shared filter model |
| Saved views | C | User-defined/common operational views |
| Global search | C | Search customers, properties, phones, quotes, jobs, invoices |
| Favorites | C later | Useful once saved views/search exist |
| Bulk actions | C later | Follow-up/status/archive actions |
| Import/export | C later | CSV customers/leads; export operational data |
| Dashboard/KPIs | B | Operational + financial decision metrics |
| Workflows | B/C | Keep Make where useful; native event model and rules over time |
| Webhooks | B | Existing Make hooks; formalize event contracts |
| API | B | Existing REST/edge functions; add stable service layer |
| Permissions | B | Membership roles exist; add action/field constraints as team grows |
| Audit history | B | Activity events exist; make systematic |
| Notifications | C/D | Native notification records later; external delivery |
| Command menu | C later | High-value UX once navigation stabilizes |
| AI agents | C later | Structured, permissioned actions only |
| Custom objects | E for now | Domain objects already known; don't add metadata complexity prematurely |
| Generic custom fields | C later | Add a controlled custom-field system only when real need appears |
| Calendar sync | D later | Google/Microsoft integration only if useful |
| Generic opportunity pipeline | E | Use RinsePoint lead/quote/job lifecycle instead |

---

## Database/schema assessment

### Strong foundation
- Core domain relationships are already explicit.
- Quote and invoice version tables already exist.
- Communications/files/tasks/reviews/activity_events are already linked to multiple workflow entities.
- Membership roles and organization scoping exist.
- Organization settings already hold quote/invoice/tax/review/automation settings.

### High-value schema gaps

#### Lead pipeline
Add gradually:
- stage_entered_at
- last_contacted_at
- next_follow_up_at
- estimated_value
- source_detail / campaign
- lost_reason taxonomy
- lead_stage_history table

Existing first_contacted_at, qualified_at, closed_at, lost_reason already reduce the amount of new work needed.

#### Property
Add a clean property-profile layer:
- property_type
- preferred_service_window
- gate/access details
- pets
- water source
- recurring interval
- general condition/risk notes

Do **not** add dozens of nullable columns for every possible cleaning surface. Use related structures for measurements/surfaces.

Recommended later:
- property_surfaces
- property_measurements

Examples:
- surface type: driveway / sidewalk / patio / siding / fence / roof / gutter
- material: concrete / brick / vinyl / stucco / wood
- measurement type: square feet / linear feet / count
- measurement value
- condition / stain notes

#### Job
Later add:
- estimated_duration_minutes
- crew/assignment abstraction
- weather snapshot
- completion checklist
- equipment/chemical notes

#### Follow-up
Tasks already provide the base. Avoid a second follow-up table unless a real workflow requires it.

#### CRM views
Later add:
- saved_views
- saved_view_filters
or a single JSONB view definition if the UX stays simple.

### Data integrity improvements
- Add explicit unique/dedupe strategy for customer identity rather than ad-hoc matching.
- Add indexes around common operational filters: org + status + created/due/scheduled dates.
- Add systematic event creation for important state transitions.
- Keep historical snapshots where a mutable customer profile should not rewrite old documents/work records.

---

## UI/UX assessment

### Current strengths
- Brand is coherent.
- Quote/job/invoice flows are understandable.
- Public quote/invoice experiences are connected.
- Rows are becoming navigable rather than button-only.
- Customer history is now represented.

### Current technical/UX debt
- CRM frontend is concentrated in a small number of very large components:
  - CrmApp.jsx ~31 KB
  - CustomerPage.jsx ~36 KB
  - QuotePage.jsx ~28 KB
  - JobPage.jsx ~19 KB
  - InvoicePage.jsx ~15 KB
  - api.js ~20 KB
- No true route model yet; navigation is primarily component state.
- Many list/table/status patterns are repeated rather than shared.
- The organization ID is currently hard-coded in the client.
- Frontend reads many tables directly through PostgREST; this is acceptable for a small owner app with RLS, but important mutations should stay behind validated server actions.
- There is no unit/e2e CRM test suite yet.
- Search/filtering is page-local and inconsistent.
- Status semantics are spread across components rather than centralized.
- There is not yet a reusable record shell, command system, filter engine, or saved-view model.

### Recommended frontend structure
Incrementally extract:
- components/DataTable
- components/StatusBadge
- components/RecordHeader
- components/RecordTabs
- components/EmptyState
- components/MetricCard
- components/Timeline
- components/FilterBar
- components/QuickActions
- domain/customer
- domain/lead
- domain/quote
- domain/job
- domain/invoice
- domain/property
- domain/schedule

Do not perform a large rewrite. Extract as each touched area is improved.

---

## Automation gaps

### Already working / substantially covered
- website lead intake
- customer confirmation
- owner notification
- quote email
- quote approval → job
- schedule confirmation
- on-my-way email
- invoice delivery
- Stripe checkout/payment synchronization
- payment confirmation

### Next automations with the highest payoff
1. New lead → automatic follow-up task.
2. Quote sent → follow-up task/message if still open after a controlled delay.
3. Scheduled job → reminder before visit.
4. Paid + completed → review request.
5. Overdue invoice → owner task, then customer reminder.
6. Long-inactive completed customer → reactivation task/campaign.

Make should execute delivery/orchestration where it is useful; RinsePoint should own event state, dedupe keys, history, and business truth.

---

## RinsePoint-specific functionality Twenty does not solve

Twenty can model generic records, but it does not inherently know:
- service properties
- surface measurements
- pressure-washing pricing rules
- minimum service charges
- bundles by surface/property
- water/access constraints
- before/after photos
- job chemical/equipment requirements
- route density/travel time
- weather-sensitive scheduling
- pressure-washing completion checklist
- quote → field job → invoice flow
- property service history
- annual cleaning reactivation

These should remain native RinsePoint concepts.

---

## Prioritized roadmap

### P0 — Reliability and architecture
- keep CI green
- extract shared CRM UI primitives while touching pages
- centralize statuses and workflow state definitions
- strengthen customer dedupe rules
- add missing operational indexes
- formalize event contracts and transition logging
- add a small critical-path e2e test suite

### P1 — Lead management
- board + table toggle
- richer pipeline stages
- stage age
- next follow-up
- last contact
- estimated value
- lost reason
- source attribution
- quick actions
- saved views: New, Follow-up Today, Quotes Needed, Lost

### P2 — Customer/property 360
- polished customer record
- editable permanent profile
- properties as navigable records
- unified timeline
- communication history
- tasks/follow-ups
- files/photos
- property notes/access details

### P3 — Quote workflow
- service/package chooser
- measurement-backed pricing
- optional line items / upsells
- quote versions
- follow-up automation
- deposit option

### P4 — Scheduling/jobs
- week/day calendar
- unscheduled queue
- estimated duration
- confirmation state
- crew assignment abstraction
- job checklists
- before/after photos
- route/travel assistance

### P5 — Invoices/payments
- deposits and partial payments
- automated reminders
- payment/refund history
- tips if the business wants them
- cleaner tax reporting

### P6 — Communications/follow-ups
- unified communications log
- two-way SMS/email where provider APIs allow
- reusable templates
- scheduled task/follow-up engine

### P7 — Timeline/search/views
- unified customer/property timeline
- global search
- filters/sorts
- saved views
- favorites
- bulk actions

### P8 — Analytics
- revenue day/week/month/YTD
- open quote value
- quote close rate
- average job value
- lead-source conversion
- revenue by service
- repeat rate
- outstanding AR
- review rate
- job profitability once costs are captured

### P9 — Automation and AI
- native automation rules for high-value internal transitions
- Make for external orchestration
- structured AI tools/actions
- human approval for financial/customer-facing/high-impact actions
- AI lead qualification, quote drafting, operations summary, follow-up drafting, and analytics

---

## Changes started during this assessment

The first safe quick wins were implemented without replacing the existing stack:

1. **Customer workspace redesign**
   - permanent customer home
   - Overview / Work / Billing / Activity
   - lifetime paid + open balance
   - Call / Text / Email / Edit
   - editable profile, tags, notes
   - properties
   - jobs, quotes, invoices, payments
   - tasks, reviews, communication, timeline
   - explicit next-action card

2. **Scheduling workspace**
   - real weekly calendar
   - scheduled jobs by day/time
   - unscheduled approved-work queue
   - click-through to job

3. **Operational dashboard**
   - today's work
   - work queue / needs attention
   - draft invoice / unscheduled job / overdue invoice / quote revision surfacing
   - recent requests
   - clickable KPI cards

4. **Test-data cleanup**
   - removed fake generated contact details from historical test customer profiles
   - historical source submissions remain preserved

These changes use the existing tables and API surface rather than starting over.

---

## Architectural direction

Use Twenty as a design reference, not as the runtime.

RinsePoint should borrow:
- consistent object/list/detail patterns
- saved views
- search
- activity/timeline
- command-driven navigation
- workflow/event concepts
- permissions discipline
- extension-friendly boundaries

RinsePoint should keep:
- Supabase/Postgres
- current domain schema
- public website integration
- quote/job/invoice/payment workflows
- Make integrations where valuable
- industry-specific business rules

The product goal is not "Twenty customized for pressure washing."

The product goal is **RinsePoint OS: a purpose-built exterior-cleaning operating system with CRM-quality UX and architecture.**
