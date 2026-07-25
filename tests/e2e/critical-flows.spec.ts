import { expect, test } from "@playwright/test";

async function login(
  page: import("@playwright/test").Page,
  account = "customer@liquidityradar.local",
) {
  await page.goto("/");
  const submit = page.getByRole("button", {
    name: "Open demonstration workspace",
  });
  await expect(submit).toBeEnabled();
  await page.getByLabel("Email").selectOption(account);
  await submit.click();
}

test("customer can sign in, search, inspect evidence, save, alert, match, and export", async ({
  page,
}) => {
  await login(page);
  await expect(page.getByText("Good afternoon, Maya.")).toBeVisible();
  await page.getByRole("button", { name: "People" }).click();
  await page
    .getByPlaceholder("Search by person, company, metro…")
    .fill("Amara");
  await page.getByText("Amara Voss", { exact: true }).click();
  await expect(page.getByText("Estimate, not a bank balance.")).toBeVisible();
  await page
    .getByRole("button", { name: "estimated Founder ownership" })
    .click();
  await expect(
    page.getByText("Financing history + beneficial ownership filing"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Create alert" }).click();
  await expect(page.getByText("Alert created for Amara Voss")).toBeVisible();
  await page.getByRole("button", { name: "Capital match" }).click();
  await page
    .getByRole("button", { name: "Generate explained matches" })
    .click();
  await expect(
    page.getByText("qualified matches", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "People" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Export \d+ results/ }).click();
  await downloadPromise;
});

test("analyst can review and publish an event", async ({ page }) => {
  await login(page, "analyst@liquidityradar.local");
  await expect(page.getByText("Review queue", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Approve & publish" }).click();
  await expect(page.getByText("Event approved and published")).toBeVisible();
});

test("administrator can change plan, create API key, inspect jobs, and open privacy workflow", async ({
  page,
}) => {
  await login(page, "admin@liquidityradar.local");
  await page
    .getByRole("button", { name: "MS Maya Singh Platform admin" })
    .click();
  await page.getByLabel("Simulate plan change").selectOption("Enterprise");
  await expect(
    page.getByText("Workspace plan changed to Enterprise"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Create API key" }).click();
  await expect(page.getByText("Copy this secret now")).toBeVisible();
  await page.getByRole("button", { name: "Data operations" }).click();
  await expect(page.getByText("Ingestion & jobs")).toBeVisible();
  await page.getByRole("button", { name: "Privacy requests" }).click();
  await expect(
    page.getByText("Submit a correction or privacy request"),
  ).toBeVisible();
});
