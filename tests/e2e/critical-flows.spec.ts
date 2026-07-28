import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
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
    page.getByRole("heading", { name: "Good afternoon." }),
  ).toBeVisible();
  await expect(
    page.getByText("Real records only", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Product navigation" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Recently indexed people" }),
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
    page.getByText("EDGAR current filings", { exact: true }).first(),
  ).toBeVisible();
});

test("real SEC names are searchable and open evidence-linked profiles", async ({
  page,
}) => {
  const filing = snapshotJson.sec.filings.find(
    (record) => record.reportingParty,
  );
  if (!filing) throw new Error("The official snapshot has no reporting party.");

  await signInWithDummy(page);
  await page
    .getByLabel("Search people and public records")
    .fill(filing.reportingParty);
  await page.getByRole("option").first().click();

  await expect(
    page.getByRole("heading", { name: filing.reportingParty }),
  ).toBeVisible();
  await expect(page.getByText("Evidence boundary")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open latest SEC record ↗" }),
  ).toHaveAttribute("href", filing.url);

  await page
    .locator(".side-nav")
    .getByRole("button", { name: "People" })
    .click();
  await expect(
    page.getByRole("heading", { name: "People and reporting parties" }),
  ).toBeVisible();
  await page
    .getByLabel("Search people and reporting parties")
    .fill(filing.reportingParty);
  await expect(
    page.getByRole("button", {
      name: `Open profile for ${filing.reportingParty}`,
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
