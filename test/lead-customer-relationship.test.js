import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const api = readFileSync(new URL("../src/crm/api.js", import.meta.url), "utf8");

test("lead queries disambiguate the primary customer relationship", () => {
  const matches = api.match(/customer:customers!leads_customer_id_fkey\(/g) || [];
  assert.ok(matches.length >= 2, "Dashboard and Leads queries must name leads_customer_id_fkey explicitly");

  const directLeadQueries = api
    .split("\n")
    .filter((line) => line.includes("leads?select") && line.includes("customer:customers("));

  assert.deepEqual(
    directLeadQueries,
    [],
    "Direct lead queries must not use an ambiguous customer:customers embed",
  );
});
