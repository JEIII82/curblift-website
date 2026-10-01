import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const quoteAdmin = readFileSync(new URL("../supabase/functions/quote-admin/index.ts", import.meta.url), "utf8");
const invoiceAdmin = readFileSync(new URL("../supabase/functions/invoice-admin/index.ts", import.meta.url), "utf8");
const invoiceCheckout = readFileSync(new URL("../supabase/functions/invoice-checkout/index.ts", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20261001225000_public_base_url.sql", import.meta.url), "utf8");

test("customer quote and invoice links use centralized public_base_url", () => {
  assert.match(quoteAdmin, /select\("public_base_url"\)/);
  assert.match(quoteAdmin, /\/quote\/\?token=/);
  assert.doesNotMatch(quoteAdmin, /PUBLIC_QUOTE_BASE/);

  assert.match(invoiceAdmin, /select\("public_base_url"\)/);
  assert.match(invoiceAdmin, /\/invoice\/\?token=/);
  assert.doesNotMatch(invoiceAdmin, /PUBLIC_INVOICE_BASE/);
});

test("checkout falls back to configured production base URL rather than preview URL", () => {
  assert.match(invoiceCheckout, /select\("public_base_url"\)/);
  assert.match(invoiceCheckout, /const returnOrigin = origin && ALLOWED\.has\(origin\) \? origin : publicBaseUrl/);
  assert.doesNotMatch(
    invoiceCheckout,
    /returnOrigin[\s\S]{0,120}curblift-website-git-rinsepoint-os-jojo-s-projects82\.vercel\.app/,
  );
});

test("public URL migration defaults to the stable RinsePoint domain", () => {
  assert.match(migration, /public_base_url/);
  assert.match(migration, /https:\/\/rinsepoint\.com/);
  assert.match(migration, /set not null/);
});
