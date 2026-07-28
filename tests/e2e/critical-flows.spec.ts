import { expect, test } from "@playwright/test";

test("real-only public record explorer loads its official data surfaces", async ({
  page,
}) => {
  await page.goto("/");
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

test("legacy fictional workspace routes are unavailable", async ({ page }) => {
  const response = await page.goto("/people");
  expect(response?.status()).toBe(404);
  await expect(page.getByText("404")).toBeVisible();
});
