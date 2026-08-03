import { expect, type Page } from "@playwright/test";

export async function deleteCampusFromDashboard(page: Page, campusName: string) {
  await page.goto("/dashboard");
  const card = page.locator("article.mm-dashboard-map-card").filter({ hasText: campusName }).first();
  await page.getByRole("heading", { name: /Welcome/i }).waitFor({ state: "visible", timeout: 30_000 }).catch(() => undefined);
  if (!(await card.isVisible().catch(() => false))) {
    await expect(card).toBeVisible({ timeout: 30_000 }).catch(() => undefined);
  }
  if (!(await card.isVisible().catch(() => false))) return false;
  await card.getByRole("button", { name: "Campus actions" }).click();
  await card.getByRole("menuitem", { name: "Delete campus" }).click();
  const dialog = page.getByRole("dialog", { name: /Delete/i });
  await dialog.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page.locator("article.mm-dashboard-map-card").filter({ hasText: campusName })).toHaveCount(0, { timeout: 30_000 });
  return true;
}

export async function closeGuestUpgrade(page: Page) {
  const dialog = page.getByRole("dialog", { name: /Save and share/i });
  if (await dialog.isVisible().catch(() => false)) await dialog.getByRole("button", { name: "Not now" }).click();
}

export async function assertNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    body: document.body.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  if (dimensions.body > dimensions.viewport + 1) throw new Error(`Horizontal overflow: body ${dimensions.body}px, viewport ${dimensions.viewport}px`);
}
