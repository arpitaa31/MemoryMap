import { test, expect, assertNoDeploymentErrors } from "./support/fixtures";
import { closeGuestUpgrade, deleteCampusFromDashboard } from "./support/helpers";

test.describe("guest production flow", () => {
  test("creates, edits, restricts, finishes and deletes a guest campus", async ({ page, diagnostics }) => {
    const campusName = `E2E-Guest-Campus-${Date.now()}`;
    const uploadRequests: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST" && request.url().includes("/api/memorymaps/") && request.url().endsWith("/images")) uploadRequests.push(request.url().split("?")[0]);
    });
    let campusCreated = false;
    try {
      await page.goto("/login?guest=1");
      await page.getByRole("button", { name: "Try as guest" }).click();
      await expect(page).toHaveURL(/\/dashboard/);
      await expect(page.getByText("Guest session", { exact: true }).first()).toBeVisible();
      await expect(page.getByRole("heading", { name: "Welcome, Guest." })).toBeVisible();

      await page.getByRole("button", { name: "Start building" }).click();
      const createDialog = page.getByRole("dialog", { name: /What place are we remembering/i });
      await createDialog.getByLabel("Campus or place name").fill(campusName);
      await createDialog.getByRole("button", { name: "Start building" }).click();
      await expect(page).toHaveURL(/\/memorymaps\/[^/]+\/setup/);
      campusCreated = true;

      await expect(page.getByRole("tab", { name: "Ground Floor" })).toBeVisible();
      await expect(page.getByLabel("Campus builder tools")).toBeVisible();
      await expect(page.getByRole("button", { name: /Add room/ }).first()).toBeVisible();

      await page.getByRole("button", { name: /Add members/ }).click();
      await expect(page.getByRole("dialog", { name: /Save and share/i })).toBeVisible();
      await closeGuestUpgrade(page);

      await page.getByRole("button", { name: /Add room/ }).first().click();
      const room = page.locator("button.mm-builder-room").first();
      await expect(room).toBeVisible();
      await expect(page.getByLabel("Room name")).toBeVisible();
      await page.getByLabel("Room name").fill("E2E Guest Room");
      await page.getByLabel("Room name").press("Enter");
      await expect(room).toContainText("E2E Guest Room");

      const beforeMove = await room.boundingBox();
      if (!beforeMove) throw new Error("Guest room has no bounding box.");
      await page.mouse.move(beforeMove.x + beforeMove.width / 2, beforeMove.y + beforeMove.height / 2);
      await page.mouse.down();
      await page.mouse.move(beforeMove.x + beforeMove.width / 2 + 24, beforeMove.y + beforeMove.height / 2 + 18);
      await page.mouse.up();
      await page.waitForTimeout(600);
      const afterMove = await room.boundingBox();
      expect(afterMove?.x).not.toBe(beforeMove.x);

      const resizeHandle = room.locator(".mm-builder-room__resize");
      const beforeResize = await room.boundingBox();
      await resizeHandle.hover();
      const handleBox = await resizeHandle.boundingBox();
      if (!beforeResize || !handleBox) throw new Error("Guest room resize handle is unavailable.");
      await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(handleBox.x + 80, handleBox.y + 60, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(600);
      const afterResize = await room.boundingBox();
      expect(afterResize?.width).not.toBe(beforeResize.width);

      await page.getByRole("button", { name: /Add corridor/ }).click();
      const canvas = page.locator(".mm-builder__canvas");
      const canvasBox = await canvas.boundingBox();
      if (!canvasBox) throw new Error("Builder canvas has no bounding box.");
      await page.mouse.click(canvasBox.x + 130, canvasBox.y + 160);
      await page.mouse.click(canvasBox.x + 340, canvasBox.y + 210);
      await page.keyboard.press("Enter");
      await expect(page.locator("polyline.mm-builder-corridor")).toHaveCount(1);

      await page.getByRole("button", { name: "Complete setup" }).click();
      const doneDialog = page.getByRole("dialog", { name: /Finish setting up/i });
      await doneDialog.getByRole("button", { name: "Finish and open campus" }).click();
      await expect(page).toHaveURL(/\/memorymaps\/[^/]+$/);
      await expect(page.getByRole("heading", { name: "Ground Floor" })).toBeVisible();

      const viewerRoom = page.locator("button.mm-viewer-room").first();
      await viewerRoom.click();
      await expect(page.getByText("Room memories", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Add image" }).click();
      const imageDialog = page.getByRole("dialog", { name: /Add a photo memory/i });
      await expect(imageDialog).toBeVisible();
      await imageDialog.getByLabel("Image").setInputFiles({
        name: "E2E-guest-image.jpg",
        mimeType: "image/jpeg",
        buffer: Buffer.from("/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAEFAqf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/AYf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/AYf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCf/9k=", "base64"),
      });
      await imageDialog.getByLabel("Title").fill("E2E Guest Image");
      await imageDialog.getByRole("button", { name: "Upload image" }).click();
      await expect(page.getByRole("dialog", { name: /Save and share/i })).toBeVisible();
      expect(uploadRequests).toHaveLength(0);
      await closeGuestUpgrade(page);
      await expect(page.getByRole("button", { name: "Invite" })).toHaveCount(0);

      await page.goto("/join/not-a-real-e2e-invite");
      await expect(page.getByRole("heading", { name: "Guest sessions stay private" })).toBeVisible();

      await page.goto("/dashboard");
      await expect(page.getByText(campusName, { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Start building" }).click();
      const secondDialog = page.getByRole("dialog", { name: /What place are we remembering/i });
      await secondDialog.getByLabel("Campus or place name").fill(`${campusName}-Second`);
      await secondDialog.getByRole("button", { name: "Start building" }).click();
      await expect(secondDialog).toContainText("Guest mode allows one campus");
      await secondDialog.getByRole("button", { name: "Cancel" }).click();

      expect(await deleteCampusFromDashboard(page, campusName)).toBeTruthy();
      await page.reload();
      await expect(page.getByText(campusName, { exact: true })).toHaveCount(0);
      assertNoDeploymentErrors(diagnostics);
    } finally {
      if (campusCreated) await deleteCampusFromDashboard(page, campusName).catch(() => false);
    }
  });
});
