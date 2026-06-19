import { test, expect } from "@playwright/test";

const URL = "https://export.miit.uz";
const USERNAME = process.env.TEST_USERNAME ?? "admin";
const PASSWORD = process.env.TEST_PASSWORD ?? "newexport26";

test.describe("Login flow - export.miit.uz", () => {
  test("OneID button is visible on the login page", async ({ page }) => {
    await page.goto(`${URL}/login`);

    await expect(page.getByRole("button", { name: "OneID orqali kirish" })).toBeVisible();
  });

  test("Login via #shaxzod_id → credentials → redirects to dashboard", async ({ page }) => {
    await page.goto(`${URL}/login`);

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
