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

  await page.getByRole("button", { name: "Sources & methodology" }).click();
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
  if (person.kind === "Entity") {
    await page
      .getByLabel("Filter by reporting party type")
      .selectOption("All reporting parties");
  }
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

test("legacy fictional workspace routes are unavailable", async ({ page }) => {
  const response = await page.goto("/people");
  expect(response?.status()).toBe(404);
  await expect(page.getByText("404")).toBeVisible();
});
