import type { Page } from "@playwright/test";

export async function deleteCampusFromDashboard(page: Page, campusName: string) {
  await page.goto("/dashboard");
  const card = page.locator("article.mm-dashboard-map-card").filter({ hasText: campusName }).first();
  if (!(await card.isVisible().catch(() => false))) return false;
  await card.getByRole("button", { name: "Campus actions" }).click();
  await card.getByRole("menuitem", { name: "Delete campus" }).click();
  const dialog = page.getByRole("dialog", { name: /Delete/i });
  await dialog.getByRole("button", { name: "Delete permanently" }).click();
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(800);
  return !(await page.locator("article.mm-dashboard-map-card").filter({ hasText: campusName }).count());
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
