import { test, expect, type Page } from "@playwright/test";
import { login, BASE_URL } from "./helpers";

// ---------------------------------------------------------------------------
// PMT organizations map/list view (testpmt.miit.uz/dashboard?showType=0):
// the "Tashkilotni tizimga qo'shish" (add organization) modal and the
// "Korxonalar holati" status breakdown panel.
// ---------------------------------------------------------------------------

async function gotoOrganizations(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/dashboard?type=1&showType=0`);
  const table = page.locator(".project-table.n-data-table");
  await expect(table).toBeVisible({ timeout: 20000 });
}

test.describe("PMT — Tashkilotni tizimga qo'shish (add organization)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await gotoOrganizations(page);
  });

  test("Modal exposes STIR, Kategoriya, Loyiha tashabbuskori and Tarmoq fields", async ({
    page,
  }) => {
    await page.getByRole("button", { name: /Tashkilotni tizimga qo'shish/i }).click();

    const modal = page.locator(".ant-modal-wrap").filter({ hasText: "Tashkilotni tizimga qo'shish" });
    await expect(modal).toBeVisible();

    await expect(modal.getByPlaceholder("STIR")).toBeVisible();
    await expect(modal.getByText("Kategoriya", { exact: true })).toBeVisible();
    await expect(modal.getByText("Loyiha tashabbuskori (tarmoq/hudud)", { exact: true })).toBeVisible();
    await expect(modal.getByText("Tarmoq", { exact: true })).toBeVisible();

    await modal.getByRole("button", { name: "Bekor qilish" }).click();
    await expect(modal).toBeHidden();
  });

  test("Saqlash without filling required fields keeps the modal open and flags STIR", async ({
    page,
  }) => {
    await page.getByRole("button", { name: /Tashkilotni tizimga qo'shish/i }).click();
    const modal = page.locator(".ant-modal-wrap").filter({ hasText: "Tashkilotni tizimga qo'shish" });
    await expect(modal).toBeVisible();

    await modal.getByRole("button", { name: "Saqlash" }).click();

    // Submission is rejected client-side: the modal stays open and the
    // required STIR input is marked invalid instead of being cleared/closed.
    await expect(modal).toBeVisible();
    await expect(modal.getByPlaceholder("STIR")).toHaveClass(/ant-input-status-error/);
  });
});

test.describe("PMT — Korxonalar holati (organization status breakdown)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await gotoOrganizations(page);
  });

  test("Shows all five status rows, each with a numeric (ta) count", async ({
    page,
  }) => {
    const statuses = [
      "To'liq quvvat",
      "O'rta quvvat",
      "Past quvvat",
      "Faoliyatsiz",
      "Infratuzilma",
    ];

    for (const status of statuses) {
      const row = page.locator(".n-collapse-item").filter({ hasText: "Korxonalar holati" }).getByText(status, { exact: true });
      await expect(row).toBeVisible({ timeout: 20000 });

      // The (ta) count sits in the same status row as the label.
      const statusRow = row.locator(
        "xpath=ancestor::div[contains(@class,'flex') and contains(@class,'items-start')][1]"
      );
      await expect(statusRow.getByText(/\(ta\)/)).toBeVisible();
    }
  });
});
