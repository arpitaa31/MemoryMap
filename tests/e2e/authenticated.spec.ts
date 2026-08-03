import { test, expect, assertNoDeploymentErrors } from "./support/fixtures";

const hasGoogleCredentials = Boolean(process.env.E2E_GOOGLE_EMAIL && process.env.E2E_GOOGLE_PASSWORD);

test.describe("authenticated owner flow", () => {
  test("requires secure E2E_GOOGLE_EMAIL and E2E_GOOGLE_PASSWORD", async ({ page, diagnostics }) => {
    test.skip(!hasGoogleCredentials, "Skipped: secure Google E2E credentials are not available in the environment.");
    await page.goto("/login");
    await page.getByRole("button", { name: "Continue with Google" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: /Welcome back/i })).toBeVisible();
    assertNoDeploymentErrors(diagnostics);
  });
});
