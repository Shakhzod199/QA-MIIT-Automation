import { test, expect } from "@playwright/test";
import { BASE_URL } from "./helpers";
import { createProject3tip, formItem } from "./project-form";

// ---------------------------------------------------------------------------
// 3-tip ("Yangi (Istiqbolli) loyiha") update. Creates a 3-tip project, then on
// its update page updates the passport (Loyiha qiymati) and reaches the
// Vazifalar tab. Step creation there is permission-blocked for the automation
// account (see the note below) — the flow is kept as a ready-to-enable TODO.
// ---------------------------------------------------------------------------

test.describe("PMI — Loyihalar CRUD", () => {
  test("updates a '3-tip' (Yangi Istiqbolli) project passport and reaches Vazifalar", async ({
    page,
  }) => {
    test.setTimeout(150000);

    const { year, id } = await createProject3tip(page);
    const updateUrl = `${BASE_URL}/app/projects/update/${year}/${id}`;

    // ── Passport: edit mode → change Loyiha qiymati → Saqlash (200) ───────
    await page.goto(`${updateUrl}?tab=base`);
    await page.getByRole("button", { name: "Tahrirlash", exact: true }).click();
    await expect(formItem(page, "Loyiha nomi")).toBeVisible({ timeout: 20000 });

    const qiymati = formItem(page, "Loyiha qiymati").locator("input").first();
    await qiymati.fill("");
    await qiymati.fill("2.5");
    await expect(qiymati).toHaveValue("2.5");

    const saveResponse = page.waitForResponse(
      (resp) =>
        ["PATCH", "PUT", "POST"].includes(resp.request().method()) &&
        /\/project\//i.test(resp.url())
    );
    await page.getByRole("button", { name: "Saqlash", exact: true }).click();
    expect((await saveResponse).status()).toBe(200);

    // ── Vazifalar: verify the tasks tab loads with its seeded main tasks ──
    // NOTE: creating a step ("Qadam qo'shish") is BLOCKED for the automation
    // account. After selecting a main task the steps panel activates, but the
    // add-step button is gated by `canUpdate('tasks.general') &&
    // canCreate('tasks.general')` — permissions this PMI_USERNAME lacks, so the
    // button never renders. Re-enable the step-creation flow below once the test
    // account is granted those permissions. For now, assert the tab + a seeded
    // main task are present so the test still covers reaching Vazifalar.
    await page.goto(`${updateUrl}?tab=tasks`);
    await expect(page.getByText("Asosiy vazifalar", { exact: true })).toBeVisible({
      timeout: 20000,
    });
    await expect(
      page.getByText("Muzokara olib borish", { exact: true }).first()
    ).toBeVisible();

    /* TODO (needs tasks.general create permission on the test account):
    await page.getByText("Muzokara olib borish", { exact: true }).first().click();
    await page.getByRole("button", { name: /Qadam qo.shish/ }).click();
    const modal = page.locator(".n-modal").filter({ hasText: "Qadam" }).last();
    const stepSelect = modal.locator(".n-form-item")
      .filter({ has: page.locator(".n-form-item-label", { hasText: "Qadamlar" }) })
      .locator(".n-base-selection").first();
    await stepSelect.click();
    await page.locator(".n-base-select-menu:visible .n-base-select-option").first().click();
    await page.keyboard.press("Escape");
    await fillDate(page, "Ijro muddati", new Date().toISOString().slice(0, 10));
    const taskResponse = page.waitForResponse(
      (r) => r.request().method() === "POST" && /\/task/i.test(r.url()));
    await modal.getByRole("button", { name: "Saqlash", exact: true }).click();
    expect((await taskResponse).status()).toBe(200);
    */
  });
});
