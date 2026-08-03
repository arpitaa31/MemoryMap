# Playwright Production Test Report

## Test environment

- URL: `https://memory-map-lyart.vercel.app/`
- Browser: Chromium 151.0.7922.34
- Playwright: 1.62.1
- Project: `chromium`
- Viewports: 1440×900, 1280×800, 1024×768, 768×1024, 430×932, 390×844, 360×800
- Test command: `npx playwright test --project=chromium`
- Final result: 10 passed, 1 skipped, 0 failed

## Runtime diagnostics

The final suite collected `console`, `pageerror`, `requestfailed`, and response diagnostics. No console errors, page errors, unexpected failed requests, HTTP 500/503 responses, `FUNCTION_INVOCATION_FAILED`, `ERR_REQUIRE_ESM`, unauthorized-domain, or permission-denied errors were observed.

Expected `net::ERR_ABORTED` cancellations from navigation and Firestore realtime-listener shutdown are classified as harmless and are retained in the Playwright diagnostics attachments. No request headers, Firebase tokens, API keys, or private keys are recorded.

## Feature results

| Area | Result | Evidence |
| --- | --- | --- |
| Public homepage | Passed | Homepage loaded, MemoryMap branding and CTAs were visible, and no Vercel login page appeared. |
| Login page | Passed | Google and guest controls were visible; no unauthorized-domain warning appeared before Google was clicked. |
| Google login | Partial / skipped for full account flow | Chromium opened the Google flow without an app configuration error. No secure `E2E_GOOGLE_EMAIL`/`E2E_GOOGLE_PASSWORD` credentials were available, so account completion was not attempted. |
| Guest mode | Passed | Anonymous sign-in, Guest dashboard, unique campus creation, Ground Floor, room creation, room rename, move, resize, corridor, setup completion, viewer, and deletion all completed. |
| Guest restrictions | Passed | Guest members/invite access opened the upgrade gate; image submission opened the upgrade gate without calling the image API; guest joining showed “Guest sessions stay private”; one-campus limit was enforced. |
| Campus creation | Passed for guest mode | The E2E campus was created in Production and later deleted through the UI. |
| Builder | Passed for guest mode | Room movement, resizing, corridor drawing, and setup completion were exercised in Chromium. |
| Viewer | Passed for guest mode | Active campus opened, room selection opened Room Memories, and guest image restriction was exercised. |
| Incidents | Not run | Requires a registered authenticated account in this environment; no claim is made. |
| Image upload | Guest restriction passed; registered upload not run | Guest upload was blocked before any upload API request. Registered CDN upload requires a secure Google test account and a test fixture upload. |
| Invite flow | Not run | Requires two registered authenticated test sessions; no claim is made. |
| Shared dashboard | Not run | Requires two registered authenticated test sessions; no claim is made. |
| Delete campus | Passed for guest E2E campus | UI confirmation, Production DELETE request, card removal, and refresh persistence were verified. |
| Responsive layout | Passed | Home and login were checked at all seven requested viewports with no horizontal overflow; 14 screenshots were generated. |
| Accessibility | Partially exercised | Accessible names, labels, dialog roles, keyboard room controls, and responsive modal fit were exercised through Playwright. A full registered-session accessibility audit was not run. |

## Artifacts

- HTML report: `playwright-report/index.html`
- Responsive screenshots: 14 files under `test-results/`
- Failure screenshots and first-retry traces are enabled by `playwright.config.ts`; iterative guest failures generated the configured artifacts while the final run passed.
- The report server was started with `npx playwright show-report` and returned HTTP 200 on `127.0.0.1:9323`.

## Fixes found during testing

- Guest builder “Add members” now opens the upgrade gate instead of exposing an empty invite link.
- Anonymous users now receive the guest-private message on `/join/{inviteCode}` instead of remaining on an indefinite invite-loading state.
- Playwright-generated artifacts are excluded from ESLint and Git tracking.

## Exact unresolved limitations

1. No secure registered Google test credentials were available, so registered owner creation, incident persistence, CDN image upload/deletion, invite joining, shared-dashboard behavior, and registered-owner deletion were not exercised by Playwright.
2. The Google OAuth flow was opened and checked for app-side configuration errors, but no account sign-in was attempted without credentials.
3. The final test run proves the public and guest flows on the deployed site; it does not certify the unrun registered-only features.

## Public-sharing assessment

The public homepage, login surface, guest flow, guest restrictions, responsive public layouts, and guest campus deletion are ready based on the final Chromium run. The site should not be described as fully end-to-end certified for registered-owner, CDN-upload, or two-account invite features until secure test accounts are supplied and those tests pass.
