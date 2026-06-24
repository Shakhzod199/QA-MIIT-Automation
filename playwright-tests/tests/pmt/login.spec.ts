import { test, expect } from "@playwright/test";
import { BASE_URL, USERNAME, PASSWORD, login } from "./helpers";

test.describe("PMT login flow", () => {
  test("Shows OneID and performs login via credentials", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);

    // OneID is a separate entry point that redirects to an external provider,
    // so we only assert it is offered — we do not click it here.
    await expect(
      page.getByRole("button", { name: /OneID/i })
    ).toBeVisible();

    // The username/password button is hidden on test/prod — opened instead
    // via the invisible 5-click hatch next to the OneID button.
    const hatch = page.locator('button[aria-hidden="true"]');
    await expect(hatch).toBeAttached();
    for (let i = 0; i < 5; i++) {
      await hatch.click({ force: true });
    }

    const loginModal = page.locator(".n-card.n-modal");
    await expect(loginModal).toBeVisible();

    await loginModal.getByPlaceholder("Loginni kiriting").fill(USERNAME);
    await loginModal.getByPlaceholder("Parolni kiriting").fill(PASSWORD);
    await loginModal
      .getByRole("button", { name: "Kirish", exact: true })
      .click();

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
  });

  test("login() helper lands on the dashboard", async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
