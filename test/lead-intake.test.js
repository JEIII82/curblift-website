import test from "node:test";
import assert from "node:assert/strict";

import {
  buildLeadIntakePayload,
  collectLeadAttribution,
  submitLeadIntake,
} from "../src/leadIntake.js";

test("collectLeadAttribution extracts structured campaign fields", () => {
  const attribution = collectLeadAttribution({
    href: "https://rinsepoint.com/contact/?utm_source=google&utm_medium=cpc&utm_campaign=fall-clean&utm_content=driveway&utm_term=pressure%20washing&gclid=abc123&fbclid=fb456",
    referrer: "https://www.google.com/",
  });

  assert.equal(attribution.utmSource, "google");
  assert.equal(attribution.utmMedium, "cpc");
  assert.equal(attribution.utmCampaign, "fall-clean");
  assert.equal(attribution.utmContent, "driveway");
  assert.equal(attribution.utmTerm, "pressure washing");
  assert.equal(attribution.gclid, "abc123");
  assert.equal(attribution.fbclid, "fb456");
  assert.equal(attribution.referrer, "https://www.google.com/");
});

test("buildLeadIntakePayload creates the complete intake contract", () => {
  const form = new FormData();
  form.set("name", "  Test Customer  ");
  form.set("phone", "(972) 555-0100");
  form.set("email", " test@example.com ");
  form.set("addressLine1", "123 Main St");
  form.set("city", "Allen");
  form.set("state", "TX");
  form.set("postalCode", "75002");
  form.set("service", "Driveway / concrete cleaning");
  form.set("message", "Driveway and front walk");
  form.set("package", "Driveway + Front Walkway");
  form.set("smsConsent", "yes");

  const payload = buildLeadIntakePayload(form, {
    requestId: "request-123",
    submittedAt: "2026-10-01T22:45:00.000Z",
    attribution: {
      landingPage: "https://rinsepoint.com/contact/",
      referrer: "",
      utmSource: "google",
      utmMedium: "cpc",
      utmCampaign: "fall-clean",
      utmContent: "",
      utmTerm: "",
      gclid: "gclid-1",
      fbclid: "",
    },
  });

  assert.deepEqual(payload, {
    contractVersion: 1,
    name: "Test Customer",
    phone: "(972) 555-0100",
    email: "test@example.com",
    addressLine1: "123 Main St",
    city: "Allen",
    state: "TX",
    postalCode: "75002",
    service: "Driveway / concrete cleaning",
    message: "Driveway and front walk",
    package: "Driveway + Front Walkway",
    preferredContact: "sms",
    smsConsent: true,
    website: "",
    submittedAt: "2026-10-01T22:45:00.000Z",
    requestId: "request-123",
    landingPage: "https://rinsepoint.com/contact/",
    referrer: "",
    utmSource: "google",
    utmMedium: "cpc",
    utmCampaign: "fall-clean",
    utmContent: "",
    utmTerm: "",
    gclid: "gclid-1",
    fbclid: "",
  });
});

test("submitLeadIntake treats CRM persistence as the only success signal", async () => {
  let request;
  const result = await submitLeadIntake(
    { requestId: "stable-id" },
    {
      endpoint: "https://example.test/lead-intake",
      fetchImpl: async (url, options) => {
        request = { url, options };
        return new Response(JSON.stringify({ ok: true, leadId: "lead-1" }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  );

  assert.equal(result.leadId, "lead-1");
  assert.equal(request.options.headers["Idempotency-Key"], "stable-id");
});

test("submitLeadIntake surfaces CRM failure instead of showing success", async () => {
  await assert.rejects(
    submitLeadIntake(
      { requestId: "stable-id" },
      {
        fetchImpl: async () =>
          new Response(JSON.stringify({ error: "Missing required fields" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }),
      },
    ),
    /Missing required fields/,
  );
});
