import { test as base, expect, type Page, type TestInfo } from "@playwright/test";

type SafeDiagnostics = {
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: string[];
  serverResponses: string[];
};

function safeText(value: string) {
  return value
    .replace(/Bearer\s+[^\s]+/gi, "Bearer [redacted]")
    .replace(/(api[-_]?key|token|private[-_]?key|authorization)\s*[:=]\s*[^,\s}]+/gi, "$1=[redacted]")
    .slice(0, 600);
}

function safeUrl(value: string) {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return "[unparseable-url]";
  }
}

export function attachDiagnostics(page: Page): SafeDiagnostics {
  const diagnostics: SafeDiagnostics = {
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    serverResponses: [],
  };

  page.on("console", (message) => {
    if (message.type() === "error") diagnostics.consoleErrors.push(safeText(message.text()));
  });
  page.on("pageerror", (error) => diagnostics.pageErrors.push(safeText(error.message)));
  page.on("requestfailed", (request) => {
    diagnostics.failedRequests.push(`${request.method()} ${safeUrl(request.url())}: ${safeText(request.failure()?.errorText || "request failed")}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 500) diagnostics.serverResponses.push(`${response.status()} ${response.request().method()} ${safeUrl(response.url())}`);
  });

  return diagnostics;
}

export function diagnosticsText(diagnostics: SafeDiagnostics) {
  return JSON.stringify(diagnostics, null, 2);
}

export async function attachDiagnosticsArtifact(diagnostics: SafeDiagnostics, testInfo: TestInfo) {
  await testInfo.attach("runtime-diagnostics.json", {
    body: Buffer.from(diagnosticsText(diagnostics), "utf8"),
    contentType: "application/json",
  });
}

export function assertNoDeploymentErrors(diagnostics: SafeDiagnostics) {
  const text = diagnosticsText(diagnostics);
  const expectedAbort = /net::ERR_ABORTED/.test(text);
  const unexpectedFailedRequests = diagnostics.failedRequests.filter((request) => !(/net::ERR_ABORTED/.test(request) && (/firestore\.googleapis\.com\/google\.firestore\.v1\.Firestore\/Listen/.test(request) || /memory-map-lyart\.vercel\.app\/memorymaps\//.test(request))));
  expect(diagnostics.consoleErrors, "Unexpected console errors").toEqual([]);
  expect(diagnostics.pageErrors, "Unexpected page errors").toEqual([]);
  expect(unexpectedFailedRequests, "Unexpected failed network requests").toEqual([]);
  expect(diagnostics.serverResponses, "Unexpected server responses").toEqual([]);
  expect(expectedAbort ? text.replace(/net::ERR_ABORTED/g, "") : text).not.toMatch(/FUNCTION_INVOCATION_FAILED|ERR_REQUIRE_ESM|unauthorized-domain|permission-denied|500|503/i);
}

export const test = base.extend<{ diagnostics: SafeDiagnostics }>({
  diagnostics: async ({ page }, use, testInfo) => {
    const diagnostics = attachDiagnostics(page);
    const provideFixture = use;
    await provideFixture(diagnostics);
    await attachDiagnosticsArtifact(diagnostics, testInfo);
  },
});

export { expect };
