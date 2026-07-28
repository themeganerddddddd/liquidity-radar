import { expect, test } from "@playwright/test";

async function loginAt(page: import("@playwright/test").Page, path = "/") {
  await page.goto(path);
  const submit = page.getByRole("button", {
    name: "Open demonstration workspace",
  });
  if (await submit.isVisible()) {
    await expect(submit).toBeEnabled();
    await page
      .getByLabel("Email")
      .selectOption("customer@liquidityradar.local");
    await submit.click();
  }
}

test("map marker opens a region, relevant person, and region-relative affinity", async ({
  page,
}) => {
  await loginAt(page, "/map?metric=controlled&period=90d");
  await expect(
    page.getByLabel(
      "Interactive United States map of regional capital metrics",
    ),
  ).toBeVisible();
  await expect(
    page.getByText(
      "OpenStreetMap supplies recognizable state, road, city, and regional context without a proprietary token.",
    ),
  ).toBeVisible();
  const marker = page.getByRole("button", {
    name: /Montgomery County, Maryland, Estimated remaining/,
  });
  await expect(marker).toBeVisible({ timeout: 15_000 });
  await marker.click();
  await page.getByRole("button", { name: "View region" }).click();
  await expect(page).toHaveURL(
    /\/regions\/montgomery-county-md\?.*metric=controlled.*period=90d/,
  );
  await expect(
    page.getByRole("heading", { name: "Relevant people" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Relevant events" }),
  ).toBeVisible();
  await page.getByRole("row", { name: /Elena Park/ }).click();
  await expect(page).toHaveURL(/\/people\/elena-park/);
  await expect(
    page.getByRole("heading", {
      name: /Affinity to Montgomery County, Maryland: \d+\/100/,
    }),
  ).toBeVisible();
  const initialAffinity = await page
    .getByRole("heading", {
      name: /Affinity to Montgomery County, Maryland: \d+\/100/,
    })
    .textContent();
  await page
    .getByLabel("Profile affinity comparison region")
    .selectOption("new-york");
  await expect(
    page.getByRole("heading", { name: /Affinity to New York Metro: \d+\/100/ }),
  ).toBeVisible();
  const changedAffinity = await page
    .getByRole("heading", { name: /Affinity to New York Metro: \d+\/100/ })
    .textContent();
  expect(changedAffinity).not.toBe(initialAffinity);
  await page.getByRole("button", { name: "Why this score?" }).click();
  await expect(
    page.getByText(/supporting evidence item|No documented geographic/).first(),
  ).toBeVisible();
});

test("event search combines person, location, industry, region, URL, and back state", async ({
  page,
}) => {
  await loginAt(page, "/events");
  const search = page.getByLabel("Search events");
  await search.fill("Elena Park");
  await expect(
    page.getByText("Elena Park", { exact: true }).first(),
  ).toBeVisible();
  await expect.poll(() => page.url()).toContain("q=Elena+Park");

  await page.getByRole("button", { name: "Clear search" }).click();
  await search.fill("Maryland");
  await expect(
    page.getByRole("button", { name: "Montgomery County, Maryland" }).first(),
  ).toBeVisible();

  await search.fill("biotechnology Maryland");
  await page.getByLabel("Event region").selectOption("montgomery-county-md");
  await expect(
    page.getByText("Elena Park", { exact: true }).first(),
  ).toBeVisible();
  await expect(page).toHaveURL(/region=montgomery-county-md/);
  await page.reload();
  await expect(page.getByLabel("Search events")).toHaveValue(
    "biotechnology Maryland",
  );
  await expect(page.getByLabel("Event region")).toHaveValue(
    "montgomery-county-md",
  );

  await page.getByLabel("Event status").selectOption("Completed");
  await expect(page).toHaveURL(/status=Completed/);
  await page.goBack();
  await expect(page.getByLabel("Event status")).toHaveValue("");

  await page
    .getByRole("button", { name: "Montgomery County, Maryland" })
    .first()
    .click();
  await expect(page).toHaveURL(/\/regions\/montgomery-county-md/);
  await page.getByRole("button", { name: /High-confidence people/ }).click();
  await expect(page).toHaveURL(/\/people\?.*region=montgomery-county-md/);
  await page.goBack();
  await page.getByRole("button", { name: /^Events/ }).click();
  await expect(page).toHaveURL(/\/events\?.*region=montgomery-county-md/);
});

test("map state survives refresh and browser Back restores prior filters", async ({
  page,
}) => {
  await loginAt(page, "/map");
  await page.getByLabel("Map metric").selectOption("deployed");
  await page.getByLabel("Map period").selectOption("12m");
  await page.getByLabel("Map industry").selectOption("Biotechnology");
  await expect(page).toHaveURL(
    /metric=deployed.*period=12m.*industry=Biotechnology/,
  );
  await page.reload();
  await expect(page.getByLabel("Map metric")).toHaveValue("deployed");
  await expect(page.getByLabel("Map period")).toHaveValue("12m");
  await expect(page.getByLabel("Map industry")).toHaveValue("Biotechnology");
  await page.getByRole("button", { name: "Event feed" }).click();
  await expect(page).toHaveURL(/\/events/);
  await page.goBack();
  await expect(page).toHaveURL(/\/map\?/);
  await expect(page.getByLabel("Map metric")).toHaveValue("deployed");
});

test("mobile event filters expose advanced regional controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAt(page, "/events");
  await page.getByText("More filters").click();
  await expect(page.getByLabel("State")).toBeVisible();
  await page.getByLabel("State").fill("Maryland");
  await page.getByLabel("Search events").fill("biotechnology");
  await expect(
    page.getByText("Elena Park", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear all filters" }).click();
  await expect(page.getByLabel("State")).toHaveValue("");
});
