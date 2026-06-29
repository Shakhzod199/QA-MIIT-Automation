import { test, expect } from "@playwright/test";
import { login, BASE_URL } from "./helpers";

// ---------------------------------------------------------------------------
// PMT settings/users page: the "Foydalanuvchi qo'shish" (add user) modal and
// the toolbar filters (Izlash, JSHSHIR, Roli). We only validate the modal's
// fields/required-field behaviour and the filters' effect on the table — we
// don't submit a real user here, to avoid leaving test accounts behind in a
// shared environment.
// ---------------------------------------------------------------------------

test.describe("PMT — Foydalanuvchilar (settings/users)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/settings/users`);
    await expect(page.locator("table")).toBeVisible({ timeout: 20000 });
    // ant-table also renders a hidden "measure" row before the real ones
    // (used to compute column widths) — exclude it so .first() lands on data.
    await expect(page.locator("table tbody tr.ant-table-row").first()).toBeVisible({
      timeout: 20000,
    });
  });

  test("Add-user modal exposes JSHSHIR, Ism, Familiya, Roli, Telefon, Login, Lavozim, Departament and Tashabbuskor", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Qo'shish" }).click();
    const modal = page.locator(".ant-modal-wrap").filter({ hasText: "Foydalanuvchi qo'shish" });
    await expect(modal).toBeVisible();

    await expect(modal.getByPlaceholder("JSHSHIR")).toBeVisible();
    await expect(modal.getByPlaceholder("Ismni kiriting")).toBeVisible();
    await expect(modal.getByPlaceholder("Familiyani kiriting")).toBeVisible();
    await expect(modal.getByText("Roli", { exact: true }).first()).toBeVisible();
    await expect(modal.getByPlaceholder("+998 90 123-45-67")).toBeVisible();
    await expect(modal.getByPlaceholder("Loginni kiriting")).toBeVisible();
    await expect(modal.getByText("Lavozimni tanlang")).toBeVisible();
    await expect(modal.getByText("Departamentni tanlang")).toBeVisible();
    await expect(modal.getByText("Tashabbuskorni tanlang")).toBeVisible();

    await modal.getByRole("button", { name: "Bekor qilish" }).click();
    await expect(modal).toBeHidden();
  });

  test("Qo'shish without required fields keeps the modal open and flags JSHSHIR", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Qo'shish" }).click();
    const modal = page.locator(".ant-modal-wrap").filter({ hasText: "Foydalanuvchi qo'shish" });
    await expect(modal).toBeVisible();

    await modal.getByRole("button", { name: "Qo'shish" }).click();

    await expect(modal).toBeVisible();
    await expect(modal.getByPlaceholder("JSHSHIR")).toHaveClass(/ant-input-status-error/);
  });

  test("Izlash filters the table and clearing restores it", async ({ page }) => {
    const rows = page.locator("table tbody tr.ant-table-row");
    const initialCount = await rows.count();
    expect(initialCount).toBeGreaterThan(0);

    const search = page.getByPlaceholder("Izlash...");
    await search.fill("zzz_no_such_user_zzz");
    await expect.poll(() => rows.count(), { timeout: 10000 }).toBeLessThan(initialCount);

    await search.fill("");
    await expect.poll(() => rows.count(), { timeout: 10000 }).toBe(initialCount);
  });
});
