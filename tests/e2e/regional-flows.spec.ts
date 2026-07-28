import { expect, test } from "@playwright/test";

async function signInWithDummy(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in to test dashboard" }).click();
}

test("state map uses official state geometry and selectable metrics", async ({
  page,
}) => {
  await signInWithDummy(page);
  await page.getByRole("button", { name: "State signals" }).click();
  const map = page.getByRole("group", {
    name: "United States map by Business applications",
  });
  await expect(map).toBeVisible();
  await expect(page.locator(".real-state-shape")).toHaveCount(51);

  await page.getByRole("button", { name: /Real GDP growth BEA/ }).click();
  await expect(
    page.getByRole("group", {
      name: "United States map by Real GDP growth",
    }),
  ).toBeVisible();

  const california = page.getByRole("button", { name: /California:/ });
  await california.click();
  await expect(california).toHaveClass(/selected/);
});

test("state search filters the official ranking", async ({ page }) => {
  await signInWithDummy(page);
  await page.getByRole("button", { name: "State signals" }).click();
  await page.getByLabel("Find a state").fill("Maryland");
  await expect(
    page.getByText("1 result · Business applications"),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /MD Maryland/ })).toBeVisible();
});
