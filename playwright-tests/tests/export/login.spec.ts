/**
 * Login flow E2E tests for export.miit.uz (new-export frontend)
 *
 * Read directly from the frontend source (no frontend files were modified):
 *  - src/modules/auth/index.vue        -> route "/login" (route name "auth")
 *  - src/modules/auth/components/LoginModal.vue
 *  - src/modules/auth/components/Login.vue
 *  - src/modules/auth/components/LoginOneId.vue
 *  - src/store/auth.store.ts           -> login()/getUser() flow + "act" cookie
 *  - src/services/auth/auth.service.ts -> POST /auth/login, /auth/refresh
 *  - src/services/user/users.service.ts-> GET users/me
 *  - src/router/index.ts               -> auth guard, getDefaultRoute()
 *
 * Key facts that shape these tests:
 *  1. "/login" does NOT show a login form directly. It shows a landing page
 *     with an OneID button and a *visually hidden* (opacity-0) "Kirish"
 *     button. Clicking that hidden button 5 times within 1 second
 *     (fiveTimeClickOpen) opens the LoginModal containing the
 *     username/password form (Login.vue).
 *  2. Default i18n locale is "uz" (no localStorage["language"] in a fresh
 *     browser context -> falls back to "uz"). All visible strings below are
 *     the "uz" locale strings taken from src/locales/uz.json:
 *       - form.login            = "Kirish"
 *       - form.login_with_oneid = "OneID orqali kirish"
 *       - form.username         = "Login"   (label + placeholder)
 *       - form.password         = "Parol"   (label + placeholder)
 *       - messages.login_success= "Muvaffaqiyatli kirdingiz!"
 *       - validation.required_field -> "{field} maydoni to'ldirilishi shart"
 *  3. POST /auth/login response body shape (auth.service.ts -> loginService):
 *       { data: { user, access_token, expires_at } }
 *     On success authStore sets cookie "act" then calls GET users/me which
 *     must respond: { data: <UserDto> } (auth.store.ts -> getUser()).
 *  4. Successful login redirects via getDefaultRoute(role) -> "/dashboard"
 *     for any role that is not LOGISTICS/IMPORT (utils/roles.ts).
 *  5. Unauthenticated users hitting any requiresAuth route are redirected to
 *     "/login" by the router.beforeEach guard (router/index.ts).
 */

import { test, expect, type Page, type Route } from "@playwright/test";

// uz locale strings (src/locales/uz.json)
const TEXT = {
  loginTrigger: "Kirish",
  oneId: "OneID orqali kirish",
  usernamePlaceholder: "Login",
  passwordPlaceholder: "Parol",
  loginSuccess: "Muvaffaqiyatli kirdingiz!",
  usernameRequired: "Login maydoni to'ldirilishi shart",
  passwordRequired: "Parol maydoni to'ldirilishi shart",
};

const VALID_USER = {
  username: "admin",
  password: "newexport26",
};

const MOCK_USER_DTO = {
  id: 1,
  username: VALID_USER.username,
  first_name: "QA",
  last_name: "Admin",
  middle_name: null,
  full_name: "QA Admin",
  pinfl: null,
  role: "ADMIN",
  allowed_apps: [],
  birth_date: null,
  gender: null,
  email: null,
  phone: null,
  internal_phone: null,
  photo: null,
  permissions: [],
  is_active: true,
  region_id: null,
  country_id: null,
  district_id: null,
  sphere_id: null,
};

/**
 * Background calls that fire on every page load (App.vue / auth/index.vue
 * onMounted -> authStore.refresh()). Mocked so the app doesn't keep retrying
 * against a real backend during tests.
 */
async function mockBackgroundCalls(page: Page) {
  await page.route("**/auth/refresh", (route: Route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ message: "Unauthenticated" }),
    }),
  );

  await page.route("**/sidebar", (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [] }),
    }),
  );

  await page.route("**/monitoring/ping", (route: Route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: true }) }),
  );
}

/** Mocks POST /auth/login. */
async function mockLogin(page: Page, opts: { ok: boolean; message?: string }) {
  await page.route("**/auth/login", (route: Route) => {
    if (opts.ok) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            user: MOCK_USER_DTO,
            access_token: "mock-access-token",
            expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          },
        }),
      });
    }

    return route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ message: opts.message ?? "Login yoki parol xato" }),
    });
  });
}

/** Mocks GET users/me (called right after a successful login). */
async function mockCurrentUser(page: Page) {
  await page.route("**/users/me", (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: MOCK_USER_DTO }),
    }),
  );
}

/**
 * Opens the login modal via the visually-hidden "Kirish" trigger button.
 * fiveTimeClickOpen() requires consecutive clicks within 1 second of each other.
 */
async function openLoginModal(page: Page) {
  // Before the modal opens, "Kirish" (exact) matches only this hidden
  // trigger button (the OneID button text differs, and the modal/title
  // with the same text doesn't exist in the DOM yet).
  const trigger = page.getByRole("button", { name: TEXT.loginTrigger, exact: true });
  await expect(trigger).toBeAttached();

  for (let i = 0; i < 5; i++) {
    await trigger.click();
  }

  // Modal scope: LoginModal.vue uses <n-modal preset="card">, naive-ui 2.43
  // renders the card with BOTH classes on the same element: class="n-card n-modal".
  // The descendant selector ".n-modal .n-card" never matches — use compound selector.
  const modal = page.locator(".n-card.n-modal");
  await expect(modal).toBeVisible();
  return modal;
}

test.describe("Login flow - export.miit.uz", () => {
  test.beforeEach(async ({ page }) => {
    await mockBackgroundCalls(page);
    await page.goto("/login");
  });

  test("login landing page renders OneID and hidden login entry point", async ({ page }) => {
    await expect(page).toHaveURL(/\/login$/);

    // OneID button is visible on the landing page.
    await expect(page.getByRole("button", { name: TEXT.oneId })).toBeVisible();

    // The hidden "Kirish" trigger exists in the DOM (opacity-0, not display:none).
    await expect(page.getByRole("button", { name: TEXT.loginTrigger, exact: true })).toBeAttached();

    // Login modal/form is not open yet.
    await expect(page.locator(".n-card.n-modal")).toHaveCount(0);
  });

  test("clicking the hidden login trigger 5x opens the username/password form", async ({ page }) => {
    const modal = await openLoginModal(page);

    await expect(modal.getByPlaceholder(TEXT.usernamePlaceholder)).toBeVisible();
    await expect(modal.getByPlaceholder(TEXT.passwordPlaceholder)).toBeVisible();
    await expect(modal.getByRole("button", { name: TEXT.loginTrigger, exact: true })).toBeVisible();
  });

  test("shows validation errors when submitting an empty form", async ({ page }) => {
    const modal = await openLoginModal(page);

    await modal.getByRole("button", { name: TEXT.loginTrigger, exact: true }).click();

    await expect(modal.getByText(TEXT.usernameRequired)).toBeVisible();
    await expect(modal.getByText(TEXT.passwordRequired)).toBeVisible();

    // Still on the login page - no navigation happened.
    await expect(page).toHaveURL(/\/login$/);
  });

  test("toggles password visibility", async ({ page }) => {
    const modal = await openLoginModal(page);

    const passwordInput = modal.getByPlaceholder(TEXT.passwordPlaceholder);
    await passwordInput.fill("secret123");
    await expect(passwordInput).toHaveAttribute("type", "password");

    // Eye icon lives in the password input's suffix slot (Login.vue).
    await modal.locator(".n-input__suffix").click();
    await expect(passwordInput).toHaveAttribute("type", "text");
    await expect(passwordInput).toHaveValue("secret123");
  });

  test("successful login redirects to the dashboard", async ({ page }) => {
    await mockLogin(page, { ok: true });
    await mockCurrentUser(page);

    const modal = await openLoginModal(page);

    await modal.getByPlaceholder(TEXT.usernamePlaceholder).fill(VALID_USER.username);
    await modal.getByPlaceholder(TEXT.passwordPlaceholder).fill(VALID_USER.password);
    await modal.getByRole("button", { name: TEXT.loginTrigger, exact: true }).click();

    await expect(page.getByText(TEXT.loginSuccess)).toBeVisible();
    // getDefaultRoute("ADMIN") -> "/dashboard"
    await expect(page).toHaveURL(/\/dashboard/);

    // The "act" auth cookie must be set by authStore.login().
    const cookies = await page.context().cookies();
    expect(cookies.some((c) => c.name === "act" && c.value === "mock-access-token")).toBe(true);
  });

  test("invalid credentials show an error and keep the user on the login page", async ({ page }) => {
    const errorMessage = "Login yoki parol noto'g'ri";
    await mockLogin(page, { ok: false, message: errorMessage });

    const modal = await openLoginModal(page);

    await modal.getByPlaceholder(TEXT.usernamePlaceholder).fill(VALID_USER.username);
    await modal.getByPlaceholder(TEXT.passwordPlaceholder).fill("wrong-password");
    await modal.getByRole("button", { name: TEXT.loginTrigger, exact: true }).click();

    await expect(page.getByText(errorMessage)).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);

    // No "act" cookie should be set on a failed login.
    const cookies = await page.context().cookies();
    expect(cookies.some((c) => c.name === "act")).toBe(false);
  });

  test("unauthenticated access to a protected route redirects to /login", async ({ page }) => {
    // No cookies set -> authStore.isAuth is false -> router guard redirects.
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login$/);
  });
});
