import { test, expect } from "@playwright/test";
import { BASE_URL } from "./helpers";
import { createProject2tip, formItem } from "./project-form";

// ---------------------------------------------------------------------------
// 2-tip ("Yo‘l xaritasidagi loyiha") update. Creates a 2-tip project, then on
// its update page updates the passport and saves.
//
// WORKING: create + passport update (Loyiha qiymati) + save (200).
// TODO (each needs its own live build):
//   - Joylashuvi: Leaflet map click + image upload (placeholder fixture).
//   - Vazifalar: create 1–2 steps.
//   - Kelishuvlar: add 1 agreement.
// ---------------------------------------------------------------------------

test.describe("PMI — Loyihalar CRUD", () => {
  test("updates a '2-tip' (Yo‘l xaritasi) project passport and saves with 200", async ({
    page,
  }) => {
    test.setTimeout(150000);

    // ── Create a fresh 2-tip project to update (lands on the update page) ──
    const { year, id } = await createProject2tip(page);
    const updateUrl = `${BASE_URL}/app/projects/update/${year}/${id}`;

    // ── Passport: read-only by default; "Tahrirlash" enters edit mode ─────
    await page.goto(`${updateUrl}?tab=base`);
    await page.getByRole("button", { name: "Tahrirlash", exact: true }).click();
    await expect(formItem(page, "Loyiha nomi")).toBeVisible({ timeout: 20000 });

    // 2-tip has no date fields, so change a value that's always present:
    // Loyiha qiymati 1.2 → 2.5, making the form dirty so the save really fires.
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

    // TODO: location (map + image) → tasks (steps) → kelishuvlar (agreement).
  });
});
