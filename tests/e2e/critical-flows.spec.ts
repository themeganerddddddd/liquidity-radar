import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { buildRealPeople } from "../../app/RealPeople";
import type { PublicDataSnapshot } from "../../lib/public-data";

const snapshotJson = JSON.parse(
  readFileSync(
    new URL("../../public/data/public-signals.json", import.meta.url),
    "utf8",
  ),
) as PublicDataSnapshot;

async function signInWithDummy(page: import("@playwright/test").Page) {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Sign in to Liquidity Radar" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign in to test dashboard" }).click();
}

test("the restored workspace shell loads its official dashboard", async ({
  page,
}) => {
  await signInWithDummy(page);
  await expect(
    page.getByRole("heading", { name: "Liquidity Radar" }),
  ).toBeVisible();
  await expect(
    page.getByText("Real records only", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("navigation", { name: "Product navigation" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "People with recent capital events" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "State activity pulse" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "SEC filings" }).click();
  await expect(
    page.getByRole("heading", { name: "Current public filings" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Methodology", exact: true }).click();
  await expect(
    page.getByText("EDGAR insider transactions", { exact: true }).first(),
  ).toBeVisible();
});

test("real SEC names are searchable and open evidence-linked profiles", async ({
  page,
}) => {
  const liquidityEvent = snapshotJson.liquidity.events.find(
    (event) => event.eventType === "completed_public_share_sale",
  );
  if (!liquidityEvent)
    throw new Error("The official snapshot has no completed sale.");
  const person = buildRealPeople(snapshotJson).find((record) =>
    record.liquidityEvents.some((event) => event.id === liquidityEvent.id),
  );
  if (!person) throw new Error("The completed sale has no directory profile.");

  await signInWithDummy(page);
  await page.getByLabel("Search people and public records").fill(person.name);
  await page.getByRole("option").first().click();

  await expect(page.getByRole("heading", { name: person.name })).toBeVisible();
  await expect(page.getByText("Estimate, not bank balance")).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "When liquidity was received or proposed",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open latest supporting record ↗" }),
  ).toHaveAttribute("href", liquidityEvent.sourceUrl);

  await page
    .locator(".side-nav")
    .getByRole("button", { name: "Search directory" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Capital directory" }),
  ).toBeVisible();
  await page
    .getByLabel("Search people and reporting parties")
    .fill(person.name);
  await expect(
    page.getByRole("button", {
      name: `Open profile for ${person.name}`,
    }),
  ).toBeVisible();
});

test("a browser-local test account can register and retain its session", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Create test account" }).click();
  await page.getByLabel("Display name").fill("Ada Tester");
  await page.getByLabel("Test email").fill("ada@example.test");
  await page.locator('input[name="password"]').fill("TestRadar2026");
  await page.getByLabel("Confirm password").fill("TestRadar2026");
  await page
    .getByLabel(/I understand this is a device-local test account/)
    .check();
  await page
    .getByRole("button", { name: "Create account and continue" })
    .click();

  await expect(page.getByText("Ada Tester", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Ada Tester", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByLabel("Email").fill("ada@example.test");
  await page.locator('input[name="password"]').fill("TestRadar2026");
  await page.getByRole("button", { name: "Sign in to test dashboard" }).click();
  await expect(page.getByText("Ada Tester", { exact: true })).toBeVisible();
});

test("confirmed exits, owner attribution, and saved metro alerts are usable", async ({
  page,
}) => {
  await signInWithDummy(page);
  await page
    .locator(".side-nav")
    .getByRole("button", { name: "Business sales" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Completed exits and deal watch" }),
  ).toBeVisible();
  await expect(
    page.getByText("Confirmed close", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Mario Alberto Accardi", { exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: /Deal watch/ }).click();
  await expect(
    page.getByText("Deal signal—not cash evidence", { exact: true }),
  ).toBeVisible();

  await page
    .locator(".side-nav")
    .getByRole("button", { name: "Territories & alerts" })
    .click();
  const metro = page.getByLabel("Territory city or metro center");
  await metro.selectOption({ index: 1 });
  await page.getByRole("button", { name: "Save territory and alert" }).click();
  await expect(
    page.getByRole("heading", { name: "1 active territories" }),
  ).toBeVisible();
  await expect(page.getByText("Stored on this device")).toBeVisible();
});

test("Capital events exposes multi-source filters, evidence, and source health", async ({
  page,
}) => {
  await signInWithDummy(page);
  await page
    .locator(".side-nav")
    .getByRole("button", { name: "Capital events" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Capital events" }),
  ).toBeVisible();
  await expect(page.getByText("Estimate, not a bank balance.")).toBeVisible();
  await expect(page.getByLabel("Capital event filters")).toBeVisible();
  await expect(page.locator(".motion-card").first()).toBeVisible();
  await page
    .locator(".motion-card")
    .first()
    .getByRole("button", { name: "View profile →" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Transaction" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Source timeline" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close evidence" }).click();

  await page
    .locator(".side-nav")
    .getByRole("button", { name: "Source status" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Source status" }),
  ).toBeVisible();
  await expect(page.getByText("CMS change of ownership")).toBeVisible();
  await expect(page.getByText("FCC Universal Licensing System")).toBeVisible();
});

test("the capital directory searches every source with one profile UI", async ({
  page,
}) => {
  await signInWithDummy(page);
  await page
    .locator(".side-nav")
    .getByRole("button", { name: "Search directory" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Capital directory" }),
  ).toBeVisible();
  const filters = page.getByLabel("Capital directory filters");
  await expect(filters).toBeVisible();
  await filters.getByLabel("Date", { exact: true }).selectOption("");
  await filters
    .getByLabel("Source", { exact: true })
    .selectOption("uspto_assignments");
  await expect(page.locator("button.people-motion-row").first()).toBeVisible();
  await expect(page.locator("button.people-motion-row").first()).toContainText(
    "USPTO patent transfers",
  );
  await page.locator("button.people-motion-row").first().click();
  await expect(
    page.getByRole("heading", { name: "Profile summary" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "How the score works" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close profile" }).click();
});

test("legacy fictional workspace routes are unavailable", async ({ page }) => {
  const response = await page.goto("/people");
  expect(response?.status()).toBe(404);
  await expect(page.getByText("404")).toBeVisible();
});
