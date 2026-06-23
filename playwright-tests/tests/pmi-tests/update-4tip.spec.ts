import { test, expect } from "@playwright/test";
import { BASE_URL } from "./helpers";
import { createProject4tip, formItem } from "./project-form";

// ---------------------------------------------------------------------------
// 4-tip ("Qo‘shimcha loyiha") update. Creates a 4-tip project, then on its
// update page updates the passport (Loyiha qiymati) and reaches the Vazifalar
// and Ko'rsatkichlar tabs.
//
// Permission/complexity notes (kept as ready-to-enable TODOs below):
//   - Vazifalar step creation is BLOCKED for the automation account (the
//     "Qadam qo'shish" button is gated by tasks.general create/update perms).
//   - Ko'rsatkichlar: the FDI amounts grid is two tables ("2026-yilda
//     o'zlashtirish Prognoz" / "Fakt") with funding-source columns
//     ("To‘g‘ridan-to‘g‘ri xorijiy investitsiyalar" = data-col-key="source_2").
//     Entering a value needs the amounts section's pencil-edit, then activating
//     that funding source (checkbox) so month-row inputs appear.
//   - Joylashuvi: Leaflet map click + image upload (placeholder fixture).
// ---------------------------------------------------------------------------

test.describe("PMI — Loyihalar CRUD", () => {
  test("updates a '4-tip' (Qo‘shimcha) project passport and reaches its tabs", async ({
    page,
  }) => {
    test.setTimeout(150000);

    const { year, id } = await createProject4tip(page);
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

    // ── Vazifalar: tab loads with its seeded main tasks ──────────────────
    // (Step creation is permission-blocked — see header note + TODO.)
    await page.goto(`${updateUrl}?tab=tasks`);
    await expect(page.getByText("Asosiy vazifalar", { exact: true })).toBeVisible({
      timeout: 20000,
    });

    // ── Ko'rsatkichlar: amounts grid loads with the FDI funding-source column
    await page.goto(`${updateUrl}?tab=indicators`);
    await expect(
      page.getByText("To‘g‘ridan-to‘g‘ri xorijiy investitsiyalar").first()
    ).toBeVisible({ timeout: 20000 });

    /* TODO — Ko'rsatkichlar FDI value entry (amounts grid):
       1. Click the amounts section's pencil edit ("Tahrirlash").
       2. Activate the "To‘g‘ridan-to‘g‘ri xorijiy investitsiyalar" funding
          source (its checkbox) so the month-row inputs render.
       3. Fill the source_2 input in the "Fakt" table, then Saqlash → PATCH 200.

       TODO — Vazifalar step (needs tasks.general create perm):
       select main task → "Qadam qo'shish" → fill Qadamlar + Ijro muddati → save.

       TODO — Joylashuvi: click map point + upload placeholder image.
    */
  });
});
