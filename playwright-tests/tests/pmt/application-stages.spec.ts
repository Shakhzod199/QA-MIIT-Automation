import { test, expect } from "@playwright/test";
import { login, BASE_URL } from "./helpers";

// ---------------------------------------------------------------------------
// PMT settings/application-stages: the "Yangi bosqich" (add stage) modal.
// Stages define the application workflow used across the whole environment,
// so this only validates the modal's fields/required-field behaviour rather
// than actually creating a stage in a shared environment.
// ---------------------------------------------------------------------------

test.describe("PMT — Ariza bosqichlari (settings/application-stages)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/settings/application-stages`);
    await expect(page.getByText("ID", { exact: true })).toBeVisible({ timeout: 20000 });
  });

  test("Add-stage modal exposes Nomi, Tartib raqami, Asosiy bosqich and Rad etilganda qaytish bosqichi", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Yangi bosqich" }).click();
    const modal = page.locator(".n-card.n-modal").filter({ hasText: "Yangi bosqich" });
    await expect(modal).toBeVisible();

    await expect(modal.getByPlaceholder("Masalan: Korxonani o'rganish")).toBeVisible();
    await expect(modal.getByText("Tartib raqami")).toBeVisible();
    await expect(modal.getByText("Asosiy bosqich", { exact: true })).toBeVisible();
    await expect(modal.getByText("Rad etilganda qaytish bosqichi")).toBeVisible();

    await modal.getByRole("button", { name: "Bekor qilish" }).click();
    await expect(modal).toBeHidden();
  });

  test("Yaratish without a name keeps the modal open", async ({ page }) => {
    await page.getByRole("button", { name: "Yangi bosqich" }).click();
    const modal = page.locator(".n-card.n-modal").filter({ hasText: "Yangi bosqich" });
    await expect(modal).toBeVisible();

    await modal.getByRole("button", { name: "Yaratish" }).click();

    // A required-name submission is rejected client-side; the modal stays open.
    await expect(modal).toBeVisible();
  });
});
