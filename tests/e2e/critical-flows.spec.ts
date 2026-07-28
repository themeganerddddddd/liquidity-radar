import { expect, test } from "@playwright/test";

async function signInWithDummy(page: import("@playwright/test").Page) {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Sign in to Liquidity Radar" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign in to test dashboard" }).click();
}

test("real-only public record explorer loads its official data surfaces", async ({
  page,
}) => {
  await signInWithDummy(page);
  await expect(
    page.getByRole("heading", {
      name: "See what the public record says—without invented profiles.",
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Real records only", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Compare official signals across the United States",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Live signals, clearly separated" }),
  ).toBeVisible();
  await expect(
    page.getByText("EDGAR current filings", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("Form ADV adviser roster", { exact: true }).first(),
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
