import { test, expect } from "@playwright/test";
import { BASE_URL, USERNAME, PASSWORD, login } from "./helpers";

test.describe("PMI login flow", () => {
  test("Shows OneID and performs login via credentials", async ({ page }) => {
    await page.goto(`${BASE_URL}/auth`);

    // OneID is a separate entry point that redirects to an external provider,
    // so we only assert it is offered — we do not click it here.
    await expect(
      page.getByRole("button", { name: "OneID orqali kirish" })
    ).toBeVisible();

    // The credential modal is opened by the "Kirish" button, NOT the OneID one.
    await page.getByRole("button", { name: "Kirish", exact: true }).click();

    const loginModal = page.locator(".n-card.n-modal");
    await expect(loginModal).toBeVisible();

    await loginModal.getByPlaceholder("Login").fill(USERNAME);
    await loginModal.getByPlaceholder("Parol").fill(PASSWORD);
    await loginModal
      .getByRole("button", { name: "Kirish", exact: true })
      .click();

    await expect(page).toHaveURL(/\/app\/dashboard/, { timeout: 15000 });
  });

  test("login() helper lands on the dashboard", async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/app\/dashboard/);
  });
});
