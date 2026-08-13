import { test, expect } from "@playwright/test";
import { BASE_URL, USERNAME, PASSWORD, openLoginModal } from "./helpers";

test.describe("Login", () => {
  test("OneID button is visible", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);

    await expect(page.getByRole("button", { name: "OneID orqali kirish" })).toBeVisible();
  });

  test("Login redirects to dashboard", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);

    // OneID button should be visible
    await expect(page.getByRole("button", { name: "OneID orqali kirish" })).toBeVisible();

    // Press and hold the OneID button for 5s to reveal the login modal
    const modal = await openLoginModal(page);

    // Fill in credentials and submit
    await modal.getByPlaceholder("Login").fill(USERNAME);
    await modal.getByPlaceholder("Parol").fill(PASSWORD);
    await modal.getByRole("button", { name: "Kirish", exact: true }).click();

    // Should redirect to the project dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
  });
});
