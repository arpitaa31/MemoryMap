import { test, expect, assertNoDeploymentErrors } from "./support/fixtures";
import { assertNoHorizontalOverflow } from "./support/helpers";

const viewports = [
  [1440, 900], [1280, 800], [1024, 768], [768, 1024], [430, 932], [390, 844], [360, 800],
] as const;

for (const [width, height] of viewports) {
  test(`public layout remains usable at ${width}x${height}`, async ({ page, diagnostics }, testInfo) => {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await expect(page.getByText("MemoryMap", { exact: true }).first()).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath(`home-${width}x${height}.png`), fullPage: true });

    await page.getByRole("link", { name: /Make your MemoryMap/i }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath(`login-${width}x${height}.png`), fullPage: true });
    assertNoDeploymentErrors(diagnostics);
  });
}
