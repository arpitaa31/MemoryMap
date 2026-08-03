import { test, expect, assertNoDeploymentErrors } from "./support/fixtures";

test.describe("public production site", () => {
  test("homepage and login surface work", async ({ page, diagnostics }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/MemoryMap/i);
    await expect(page.getByText("MemoryMap", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Make your MemoryMap/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Try the demo/i })).toBeVisible();
    expect(new URL(page.url()).hostname).toBe("memory-map-lyart.vercel.app");
    await expect(page.locator("body")).not.toContainText(/Vercel login|Log in to Vercel/i);

    await page.getByRole("link", { name: /Make your MemoryMap/i }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Try as guest" })).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/unauthori[sz]ed domain/i);
    assertNoDeploymentErrors(diagnostics);
  });

  test("Google flow opens without an app auth configuration error", async ({ page, context, diagnostics }) => {
    await page.goto("/login");
    const popupPromise = page.waitForEvent("popup", { timeout: 10_000 }).catch(() => null);
    await page.getByRole("button", { name: "Continue with Google" }).click();
    const popup = await popupPromise;
    await page.waitForTimeout(2_000);
    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/unauthori[sz]ed domain|FUNCTION_INVOCATION_FAILED|ERR_REQUIRE_ESM/i);
    if (popup) {
      expect(new URL(popup.url()).hostname).not.toContain("vercel");
      await popup.close().catch(() => undefined);
    }
    for (const openedPage of context.pages()) {
      if (openedPage !== page) await openedPage.close().catch(() => undefined);
    }
    assertNoDeploymentErrors(diagnostics);
  });
});
