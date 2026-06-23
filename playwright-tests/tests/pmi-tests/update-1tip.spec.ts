import { test, expect } from "@playwright/test";
import { BASE_URL } from "./helpers";
import { createProject1tip, formItem } from "./project-form";

test.describe("PMI — Loyihalar CRUD", () => {
  test("updates a '1-tip' project passport (dates) and saves with 200", async ({
    page,
  }) => {
    test.setTimeout(120000);

    // ── Create a fresh 1-tip project to update (lands on the update page) ──
    const { year, id } = await createProject1tip(page);
    const updateUrl = `${BASE_URL}/app/projects/update/${year}/${id}`;

    // ── Passport: opens read-only; "Tahrirlash" enters edit mode ──────────
    await page.goto(`${updateUrl}?tab=base`);
    await page.getByRole("button", { name: "Tahrirlash", exact: true }).click();
    await expect(formItem(page, "Loyiha nomi")).toBeVisible({ timeout: 20000 });

    // The picker commits typed input in dd.MM.yyyy. The create step already set
    // start=today / end=+1yr, so the update must use a DIFFERENT end date
    // (+2yr) — otherwise nothing changes, the form isn't dirty, and Saqlash
    // fires no PATCH to assert on.
    const today = new Date();
    const fmt = (d: Date) =>
      `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
    const endDate = new Date(today);
    endDate.setFullYear(today.getFullYear() + 2);

    const typeDate = async (label: string, value: string) => {
      const input = formItem(page, label).locator("input").first();
      await input.click();
      await input.fill(value);
      await page.keyboard.press("Enter");
      await page.keyboard.press("Escape");
    };
    await typeDate("Boshlanish sanasi", fmt(today));
    await typeDate("Tugallanish sanasi", fmt(endDate));

    // Verify both committed before saving.
    expect(
      await formItem(page, "Boshlanish sanasi").locator("input").first().inputValue()
    ).not.toBe("");
    expect(
      await formItem(page, "Tugallanish sanasi").locator("input").first().inputValue()
    ).not.toBe("");

    const saveResponse = page.waitForResponse(
      (resp) =>
        ["PATCH", "PUT", "POST"].includes(resp.request().method()) &&
        /\/project\//i.test(resp.url())
    );
    await page.getByRole("button", { name: "Saqlash", exact: true }).click();
    expect((await saveResponse).status()).toBe(200);
  });
});
