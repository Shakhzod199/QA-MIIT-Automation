import { test, expect } from "@playwright/test";
import { BASE_URL } from "./helpers";
import { createProject1tip, formItem, fillDate } from "./project-form";

// ---------------------------------------------------------------------------
// XMI variant of the 1-tip update. Flow: create a 1-tip project, then on its
// update page enter the "Hukumat kafolati ostidagi xorijiy kreditlar" indicator
// (Prognoz/Fakt) — which converts the project to XMI and unlocks the
// "Komponent va tenderlar" + "Bitimlar" tabs — then update passport, location,
// components, tasks, and deals.
//
// Built incrementally. WORKING so far: create + passport (dates) update + save.
// TODO (each needs its own live build, see notes below):
//   - Indicators: amounts grid is two tables ("2026-yilda o'zlashtirish Prognoz"
//     / "...Fakt"). "Hukumat kafolati" is column data-col-key="source_4".
//     Entering a value requires the amounts section's own pencil-edit, then
//     activating that funding source (checkbox) so month-row inputs appear.
//   - Location: Leaflet map click + image upload (placeholder fixture).
//   - Komponent va tenderlar: create a component + lot.
//   - Vazifalar: create a step tied to the created lot.
//   - Bitimlar: create one deal (required fields).
// ---------------------------------------------------------------------------

test.describe("PMI — Loyihalar CRUD", () => {
  test("XMI: converts a 1-tip project to XMI via indicators and updates it", async ({
    page,
  }) => {
    test.setTimeout(180000);

    const { year, id } = await createProject1tip(page);
    const updateUrl = `${BASE_URL}/app/projects/update/${year}/${id}`;

    // ── Passport: enter edit mode and update the start/end dates ───────────
    await page.goto(`${updateUrl}?tab=base`);
    await page.getByRole("button", { name: "Tahrirlash", exact: true }).click();
    await expect(formItem(page, "Loyiha nomi")).toBeVisible({ timeout: 20000 });

    // Create set start=today / end=+1yr, so update with a different end (+2yr)
    // to make a real change. fillDate converts yyyy-MM-dd → the dd.MM.yyyy the
    // picker expects.
    const today = new Date();
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const endPlus2 = new Date(today);
    endPlus2.setFullYear(today.getFullYear() + 2);
    await fillDate(page, "Boshlanish sanasi", iso(today));
    await fillDate(page, "Tugallanish sanasi", iso(endPlus2));

    const saveResponse = page.waitForResponse(
      (resp) =>
        ["PATCH", "PUT", "POST"].includes(resp.request().method()) &&
        /\/project\//i.test(resp.url())
    );
    await page.getByRole("button", { name: "Saqlash", exact: true }).click();
    expect((await saveResponse).status()).toBe(200);

    // TODO: indicators (XMI trigger) → location → components → tasks → deals.
  });
});
