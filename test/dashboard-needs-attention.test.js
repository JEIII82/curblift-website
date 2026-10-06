import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const crm = readFileSync(new URL("../src/crm/CrmApp.jsx", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("../supabase/migrations/20261006152500_lead_attention_progression.sql", import.meta.url),
  "utf8",
);

test("dashboard work queue includes untouched new leads", () => {
  assert.match(crm, /data\.recentLeads\.filter\(\(lead\) => lead\.status === "new"\)/);
  assert.match(crm, /kind: "lead"/);
  assert.match(crm, /onOpenCustomer\?\.\(action\.customerId\)/);
  assert.match(crm, /No new leads, draft invoices/);
});

test("sent quotes advance lead state and close the initial review task", () => {
  assert.match(migration, /progress_lead_when_quote_sent/);
  assert.match(migration, /new\.status = 'sent'/);
  assert.match(migration, /set status = 'qualified'/);
  assert.match(migration, /title = 'Review new website quote request'/);
  assert.match(migration, /set status = 'completed'/);
});
