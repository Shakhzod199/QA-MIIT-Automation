import { test, expect } from "@playwright/test";
import { BASE_URL, USERNAME, PASSWORD } from "./helpers";

test.describe("Login", () => {
  test("OneID button is visible", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);

    await expect(page.getByRole("button", { name: "OneID orqali kirish" })).toBeVisible();
  });

  test("Login redirects to dashboard", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);

    // OneID button should be visible
    await expect(page.getByRole("button", { name: "OneID orqali kirish" })).toBeVisible();

    // Click the hidden trigger 5 times within 1s to open the login modal
    const trigger = page.locator("#shaxzod_id");
    await expect(trigger).toBeAttached();
    for (let i = 0; i < 5; i++) {
      await trigger.click();
    }

    // Modal opens
    const modal = page.locator(".n-card.n-modal");
    await expect(modal).toBeVisible();

    // Fill in credentials and submit
    await modal.getByPlaceholder("Login").fill(USERNAME);
    await modal.getByPlaceholder("Parol").fill(PASSWORD);
    await modal.getByRole("button", { name: "Kirish", exact: true }).click();

    // Should redirect to the project dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
  });
});
