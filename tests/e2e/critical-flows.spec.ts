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
  ).toBeVisible({ timeout: 20_000 });
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
    page.getByRole("heading", { name: "Top 10 Contacts This Week" }),
  ).toBeVisible();
  await expect(page.getByLabel("Geography")).toHaveValue("CHICAGO_METRO");
  await expect(page.locator(".top-contacts-row:not(.heading)")).toHaveCount(10);
  await expect(
    page.getByRole("heading", { name: "State activity pulse" }),
  ).toBeVisible();

  await expect(page.getByRole("button", { name: "SEC filings" })).toHaveCount(
    0,
  );

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
  await page.getByLabel("Search capital events").fill(person.name);
  const directoryMatch = page
    .locator(".sales-directory-row:not(.heading)")
    .filter({ hasText: person.name })
    .first();
  await expect(directoryMatch).toBeVisible();
  await directoryMatch
    .getByRole("button", { name: `Open profile for ${person.name}` })
    .click();
  await expect(page.getByRole("heading", { name: person.name })).toBeVisible();
  await expect(page.getByText("Estimate, not bank balance")).toBeVisible();
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

  await expect(page.getByText("Ada Tester", { exact: true })).toBeVisible({
    timeout: 20_000,
  });
  await page.reload();
  await expect(page.getByText("Ada Tester", { exact: true })).toBeVisible({
    timeout: 20_000,
  });

  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByLabel("Email").fill("ada@example.test");
  await page.locator('input[name="password"]').fill("TestRadar2026");
  await page.getByRole("button", { name: "Sign in to test dashboard" }).click();
  await expect(page.getByText("Ada Tester", { exact: true })).toBeVisible({
    timeout: 20_000,
  });
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

test("the combined capital directory exposes event details and source health", async ({
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
  await expect(
    page.locator(".side-nav").getByRole("button", { name: "Capital events" }),
  ).toHaveCount(0);
  await expect(
    page.locator(".side-nav").getByRole("button", { name: "SEC filings" }),
  ).toHaveCount(0);
  const filters = page.getByLabel("Capital directory filters");
  await expect(filters.getByLabel("Search event locations")).toBeVisible();
  await expect(filters.getByLabel("Date range")).toBeVisible();
  await expect(filters.getByLabel("Minimum transaction value")).toBeVisible();
  await expect(filters.getByLabel("Maximum transaction value")).toBeVisible();
  await expect(
    filters
      .getByLabel("Type")
      .locator('option[value="TRANSPORT_ASSET_TRANSFER"]'),
  ).toHaveCount(0);
  const headings = page.locator(".sales-directory-row.heading");
  await expect(headings).toContainText("Name");
  await expect(headings).toContainText("Sale / proposed value");
  await expect(headings).toContainText("Location");
  await expect(headings).toContainText("Date");
  await expect(headings).toContainText("Type");
  await expect(headings).toContainText("Event description");
  for (const label of [
    "Name",
    "Sale / proposed value",
    "Location",
    "Date",
    "Type",
    "Event description",
  ]) {
    await expect(
      headings.getByRole("button", { name: new RegExp(`Sort by ${label}`) }),
    ).toBeVisible();
  }
  const rows = page.locator(".sales-directory-row:not(.heading)");
  await expect(rows.first()).toBeVisible();
  const cellBoxes = await rows
    .first()
    .locator(":scope > span")
    .evaluateAll((cells) =>
      cells.map((cell) => {
        const box = cell.getBoundingClientRect();
        return { left: box.left, right: box.right };
      }),
    );
  for (let index = 0; index < cellBoxes.length - 1; index += 1) {
    expect(cellBoxes[index].right).toBeLessThanOrEqual(
      cellBoxes[index + 1].left + 0.5,
    );
  }
  const dates = await rows.evaluateAll((items) =>
    items
      .slice(0, 20)
      .map((item) => item.getAttribute("data-event-date") || ""),
  );
  expect(dates).toEqual(
    [...dates].sort((left, right) => right.localeCompare(left)),
  );
  await headings
    .getByRole("button", { name: "Sort by Date ascending" })
    .click();
  const ascendingDates = await rows.evaluateAll((items) =>
    items
      .slice(0, 20)
      .map((item) => item.getAttribute("data-event-date") || ""),
  );
  expect(ascendingDates).toEqual(
    [...ascendingDates].sort((left, right) => left.localeCompare(right)),
  );
  await rows
    .first()
    .getByRole("button", { name: /Open event details/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Public capital events" }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "← Capital directory" }).click();

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

test("the directory value range and full-width property map controls are usable", async ({
  page,
}) => {
  await signInWithDummy(page);
  await page
    .locator(".side-nav")
    .getByRole("button", { name: "Search directory" })
    .click();
  const filters = page.getByLabel("Capital directory filters");
  await filters.getByLabel("Minimum transaction value").fill("1000000");
  await filters.getByLabel("Maximum transaction value").fill("5000000");
  const rows = page.locator(".sales-directory-row:not(.heading)");
  await expect(rows.first()).toBeVisible();
  const values = await rows.evaluateAll((items) =>
    items
      .slice(0, 20)
      .map((item) => Number(item.getAttribute("data-proceeds"))),
  );
  expect(
    values.every((value) => value >= 1_000_000 && value <= 5_000_000),
  ).toBe(true);

  await page
    .locator(".side-nav")
    .getByRole("button", { name: "Chicago property" })
    .click();
  await page.getByRole("button", { name: "Map", exact: true }).click();
  await expect(page.locator(".chicago-leaflet-map")).toBeVisible();
  await expect(page.locator(".chicago-map-note")).toHaveCount(0);
  await expect(
    page
      .locator(".chicago-map-actions")
      .getByRole("button", { name: /Filters/ }),
  ).toBeVisible();
});

test("the capital directory searches every source with one event UI", async ({
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
  await filters
    .getByLabel("Type", { exact: true })
    .selectOption("PATENT_ASSIGNMENT");
  await expect(
    page.locator(".sales-directory-row:not(.heading)").first(),
  ).toBeVisible();
  await expect(
    page.locator(".sales-directory-row:not(.heading)").first(),
  ).toContainText("Patent sale or transfer");
  await expect(
    page.locator(".sales-directory-row:not(.heading)").first(),
  ).toContainText("USPTO assignment record does not state consideration");
  await page
    .locator(".sales-directory-row:not(.heading)")
    .first()
    .getByRole("button", { name: /Open profile for/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Public capital events" }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("legacy fictional workspace routes are unavailable", async ({ page }) => {
  const response = await page.goto("/people");
  expect(response?.status()).toBe(404);
  await expect(page.getByText("404")).toBeVisible();
});
