import { test, expect, type Page } from "@playwright/test";

type Diagnostics = { consoleErrors: string[]; pageErrors: string[]; requestFailures: string[]; badResponses: string[] };

function collectDiagnostics(page: Page): Diagnostics {
  const diagnostics: Diagnostics = { consoleErrors: [], pageErrors: [], requestFailures: [], badResponses: [] };
  page.on("console", (message) => { if (message.type() === "error") diagnostics.consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => diagnostics.pageErrors.push(error.message));
  page.on("requestfailed", (request) => diagnostics.requestFailures.push(`${request.method()} ${request.url()} — ${request.failure()?.errorText || "failed"}`));
  page.on("response", (response) => { if (response.status() >= 400 && !response.url().includes("favicon")) diagnostics.badResponses.push(`${response.status()} ${response.request().method()} ${response.url()}`); });
  return diagnostics;
}

async function report(name: string, diagnostics: Diagnostics) {
  console.log(`\n[${name}]\n${JSON.stringify(diagnostics, null, 2)}`);
}

test("production public pages and responsive shell", async ({ page }) => {
  const diagnostics = collectDiagnostics(page);
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: "C:\\tmp\\memorymap-production-home.png", fullPage: true });
  await expect(page).toHaveTitle(/MemoryMap/i);
  await expect(page.getByRole("link", { name: /start|sign in|get started|try/i }).first()).toBeVisible();
  await expect(page.locator("body")).toContainText(/MemoryMap/i);
  for (const width of [1440, 1024, 768, 430, 390, 360]) {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 800 });
    const overflow = await page.evaluate(() => ({ body: document.body.scrollWidth, viewport: window.innerWidth }));
    expect(overflow.body, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(overflow.viewport + 1);
  }
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "C:\\tmp\\memorymap-production-login.png", fullPage: true });
  await expect(page.getByRole("button", { name: /google/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /guest|demo|try/i })).toBeVisible();
  await report("public", diagnostics);
});

test("production guest session, create, setup route and cleanup", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const diagnostics = collectDiagnostics(page);
  await page.goto("/login", { waitUntil: "networkidle" });
  const guestButton = page.getByRole("button", { name: /guest|demo|try/i }).first();
  await expect(guestButton).toBeVisible();
  await guestButton.click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
  await expect(page.locator("body")).toContainText(/guest/i);
  const create = page.getByRole("button", { name: /create|start building|try another/i }).first();
  await expect(create).toBeVisible();
  await create.click();
  const modal = page.getByRole("dialog");
  await expect(modal).toBeVisible();
  const testName = `E2E-Campus-${Date.now()}`;
  await modal.getByLabel(/campus|place name/i).fill(testName);
  await modal.getByRole("button", { name: /start building|create/i }).click();
  await page.waitForURL(/\/memorymaps\/[^/]+\/setup/, { timeout: 30_000 });
  await expect(page.getByRole("button", { name: /add room/i })).toBeVisible({ timeout: 30_000 });
  await page.screenshot({ path: "C:\\tmp\\memorymap-production-setup.png", fullPage: true });
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page.locator("body")).toContainText(/dashboard|campus|guest/i, { timeout: 30_000 });
  await expect(page.locator("body")).toContainText(testName);
  await page.screenshot({ path: "C:\\tmp\\memorymap-production-dashboard.png", fullPage: true });
  const card = page.locator("article").filter({ hasText: testName }).first();
  const menu = card.getByRole("button", { name: /actions/i });
  await menu.click();
  await page.getByRole("menuitem", { name: /delete/i }).click();
  const deleteDialog = page.getByRole("dialog");
  await expect(deleteDialog).toContainText(testName);
  await deleteDialog.getByRole("button", { name: /delete permanently|delete campus/i }).click();
  await expect(page.locator("body")).not.toContainText(testName, { timeout: 30_000 });
  await report("guest", diagnostics);
  await context.close();
});

test("production guest builder completion and viewer restrictions", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 430, height: 932 } });
  const page = await context.newPage();
  const diagnostics = collectDiagnostics(page);
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /guest|demo|try/i }).first().click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
  await page.getByRole("button", { name: /create|start building|try another/i }).first().click();
  const modal = page.getByRole("dialog");
  const testName = `E2E-Campus-${Date.now()}`;
  await modal.getByLabel(/campus|place name/i).fill(testName);
  await modal.getByRole("button", { name: /start building|create/i }).click();
  await page.waitForURL(/\/memorymaps\/[^/]+\/setup/, { timeout: 30_000 });
  await page.getByRole("button", { name: /add room/i }).click();
  await expect(page.getByLabel(/room name/i)).toBeVisible({ timeout: 20_000 });
  await page.getByLabel(/room name/i).fill("E2E Room");
  await page.getByLabel(/room name/i).press("Enter");
  await page.getByRole("button", { name: /complete setup/i }).click();
  const finishDialog = page.getByRole("dialog");
  await expect(finishDialog).toContainText(/finish setting up/i);
  await finishDialog.getByRole("button", { name: /finish and open/i }).click();
  await page.waitForURL(/\/memorymaps\/[^/]+$/, { timeout: 30_000 });
  await expect(page.getByRole("button", { name: /e2e room/i })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: /e2e room/i }).click();
  await expect(page.getByRole("button", { name: /add incident/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /add image/i })).toBeVisible();
  await page.getByRole("button", { name: /add image/i }).click();
  await expect(page.getByRole("dialog")).toContainText(/sign in|guest|google/i);
  await page.keyboard.press("Escape");
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page.locator("body")).toContainText(testName, { timeout: 30_000 });
  const card = page.locator("article").filter({ hasText: testName }).first();
  await card.getByRole("button", { name: /actions/i }).click();
  await page.getByRole("menuitem", { name: /delete/i }).click();
  const deleteDialog = page.getByRole("dialog");
  await deleteDialog.getByRole("button", { name: /delete permanently|delete campus/i }).click();
  await expect(page.locator("body")).not.toContainText(testName, { timeout: 30_000 });
  await report("guest-active", diagnostics);
  await context.close();
});

test("production invite route waits for authentication and handles invalid invite", async ({ page }) => {
  const diagnostics = collectDiagnostics(page);
  await page.goto("/join/E2E-INVALID", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await expect(page.locator("body")).toContainText(/sign in|invite|invalid|expired/i);
  await report("invite", diagnostics);
});
