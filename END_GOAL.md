# MemoryMap Authenticated Dashboard — End Goal

This file is the completion gate for the authenticated MemoryMap dashboard phase. It must remain in the project.

## Goal

Complete the authenticated MemoryMap dashboard to production-quality standards. The dashboard phase is finished only when every requirement in this document has been implemented, tested, reviewed, and verified. Do not stop after the first visible improvement, after writing code, or after a successful build if the interface is incomplete.

## Project context

MemoryMap is a private, place-based digital memory archive. Users create private campuses, add floors and rooms, invite selected people, and preserve memories inside the places where they happened.

The authenticated dashboard is the home after Google sign-in. It must help the user understand where they are, see their account, create a new MemoryMap, see existing MemoryMaps, understand the empty state, recover from loading or Firestore errors, sign out safely, and move naturally into the future campus-creation flow.

The dashboard must feel personal, creative, organised, calm, welcoming, trustworthy, and part of the existing MemoryMap brand. It must not look like a school ERP, admin panel, analytics dashboard, generic SaaS template, social-media feed, landing page copied into an authenticated area, unfinished mockup, AI-generated interface, or decorative poster with weak usability.

## Required technical context

- Next.js App Router
- TypeScript
- app directory, not src/app
- Firebase Google Authentication
- Firestore
- Existing AuthProvider/useAuth
- Existing MemoryMap visual identity and reusable logo/brand component
- app/globals.css
- npm and Vercel deployment later

Inspect and preserve the relevant existing implementation in:

- app/dashboard/page.tsx
- app/dashboard/DashboardClient.tsx
- app/dashboard/loading.tsx
- dashboard child components
- authentication provider
- Firebase client
- app/layout.tsx
- app/globals.css
- logo and brand components
- reveal and animation components
- Firestore rules
- package.json

Do not redesign the public homepage or login page. Do not install a new package unless absolutely necessary. Do not introduce Redux, Zustand, React Query, Framer Motion, GSAP, AOS, icon libraries, toast libraries, or UI component libraries. Prefer React state, CSS, the existing Firebase SDK, typed reusable components, and native browser APIs.

## Current issues to correct

Inspect the current dashboard and correct all of these where present:

- Too much empty whitespace
- Weak and visually small header content
- Disconnected account block
- Welcome section spread too far apart
- Decorative route animation that feels useless
- Random or unfinished right-side shapes
- Create section that is too large, flat, or visually heavy
- Sparse campus illustration that does not communicate creation
- Create section dominating instead of guiding
- Inconsistent text contrast
- Decorative labels that are too small
- Weak content hierarchy below the create panel
- Empty and existing-map states needing stronger product design
- Excessive fixed spacing
- Dashboard not feeling like a complete application home
- The next action not being clear
- Unresolved mobile and tablet behaviour
- Cluttered or abruptly disappearing side decorations

Do not merely tweak colors or margins. Recompose the dashboard properly.

## Non-negotiable result

The dashboard must feel like a professional creative workspace: intentional, organised, warm, lively, personal, trustworthy, spacious without feeling empty, brand-consistent, responsive, useful before and after the user creates MemoryMaps, and immediately communicate:

1. This is my private MemoryMap account.
2. I can create a campus here.
3. My existing campuses will appear here.
4. I can safely sign out.
5. The product is based around places, rooms, and memories.

## Information architecture

Use this hierarchy:

1. Dashboard header
2. Welcome and orientation area
3. Primary Create your MemoryMap action
4. Your MemoryMaps section
5. Empty, loading, error, and populated states
6. Small account/footer line when useful

The user must not scroll through large decorative whitespace before reaching real content.

## Header requirements

Create a compact, polished application header.

Left:

- MemoryMap logo
- MemoryMap wordmark

Navigation:

- Home
- Your MemoryMaps

Do not add links to unfinished pages. The active page must be clear through text weight and underline or bottom border, not color alone.

Right:

- Google profile photo when available
- initials fallback
- user display name
- user email only when space allows
- Sign out control

Requirements:

- compact height
- strong content contrast
- consistent alignment
- no oversized blank header area
- clear separator from main content
- account controls feel connected
- safe display-name and email truncation
- usable mobile account area
- touch targets of at least 44px
- visible focus states
- working sign out
- accessible sign-out error
- signing-out state prevents duplicate clicks

Use signOut(auth), then router.replace('/login') on success.

## Welcome and orientation

Content:

Small label: YOUR PRIVATE ARCHIVE

Heading: Welcome back, {firstName}.

Supporting text: Your private campuses and shared memories live here.

Secondary line: Start a new campus or return to one you have already created.

Determine firstName by first word of user.displayName, then username portion of email, then fallback “there”. Never render “Welcome back, undefined.”

Requirements:

- heading approximately 48px–60px desktop
- heading approximately 38px–44px mobile
- serif display type
- readable wrapping
- supporting copy always visible
- no observer-dependent essential text
- no huge gap after welcome
- aligned to the main dashboard grid
- add “Signed in as user@email.com” only when helpful
- no fake quotes or motivational content

## Side motion

Review existing decorations critically and remove them if they make the dashboard worse.

Left route may remain only if it visually connects CAMPUS → ROOM → MEMORY, uses a simple path and 3 meaningful nodes, stays outside the content column, avoids unreadable labels, avoids excessive height, draws once or fades in, and never competes with the welcome heading.

Right side should be a coherent memory trail, not random shapes. It may include one room-outline fragment, one date, one memory-note fragment, one connecting line, and one subtle location marker. These must feel related.

Motion:

- no more than 4px–6px movement
- slow and subtle
- restrained opacity
- no bouncing, spinning, pulsing, or attention-seeking movement
- no interaction blocking
- aria-hidden="true"
- pointer-events:none
- disabled for reduced motion
- hidden below approximately 1100px and completely hidden on mobile

Remove decorations entirely if they reduce usability.

## Primary Create your MemoryMap panel

Redesign the current creation section so it remains prominent without being one giant dark-green rectangle.

Left content:

Small label: START WITH A PLACE

Heading: Create your MemoryMap

Description: Build a private campus, add its familiar rooms, and invite the people who shared those places with you.

Primary button: Create your MemoryMap

Optional supporting text: You will start by naming your campus and adding its first areas.

Right visual:

- one area label
- 3 or 4 room outlines
- one corridor
- one add-room control
- one selected room state
- one small memory point
- labels Classroom, Library, Court

Use no emoji, architectural blueprint, random sparse illustration, or tiny unreadable labels. The preview must communicate that the button builds a campus.

Use either a warm cream panel with dark-green structure and coral CTA, or a split cream-content/muted-green-visual panel. Do not use one giant uninterrupted green block. Use balanced contrast, thin borders, restrained radius, subtle shadow, and controlled internal spacing.

Desktop: two columns, approximately 55% content / 45% preview.

Mobile: stack content and preview, full-width button, readable preview, no scaled-down unreadable desktop diagram.

## Create button behavior

Inspect whether /create exists.

If it exists, use a Next.js Link to /create.

If it does not exist, create a simple authenticated placeholder route at /create if it improves the flow and does not conflict with the next phase. It may say “Create your MemoryMap”, “The campus creation wizard will begin here.” and “Return to dashboard”. Do not build the full wizard or pretend a MemoryMap was created.

Do not leave a prominent button that only displays “The campus creation flow is coming next.” The preferred outcome is a valid honest /create placeholder with no 404.

## Your MemoryMaps section

Heading: Your MemoryMaps

Supporting text: Campuses you create will remain private unless you invite other members.

When maps exist, show “{count} campus” or “{count} campuses”. Never show a fake count. Make the section visible naturally after the create panel without excessive empty scrolling.

## Firestore query and model

Fetch only maps belonging to the signed-in user using collection, query, where, and getDocs with:

where("ownerId", "==", user.uid)

Never fetch every document and filter in the browser. Use this typed model:

type MemoryMapSummary = {
  id: string;
  name: string;
  schoolName?: string;
  ownerId: string;
  privacy: "private";
  roomCount: number;
  memoryCount: number;
  memberCount: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

Be tolerant of missing fields with defaults roomCount 0, memoryCount 0, memberCount 1. Sort updatedAt descending in the client. Do not seed fictional personal campuses or display the public ABC School demo as real user data.

## Empty state

Content:

Heading: No MemoryMaps yet.

Text: Create your first private campus and begin saving the places your group will want to revisit later.

Button: Create your first MemoryMap

Supporting visual:

- unfinished campus layout
- 3 faint room outlines
- one dotted corridor
- one add marker
- label “Your first campus starts here.”

No sad emoji, empty-folder icon, giant generic illustration, oversized card, or unclear relationship to creation CTA. Balance desktop and stack cleanly on mobile. The empty button navigates to the same valid destination as the main create button.

## Populated MemoryMap state

Use a responsive grid or structured list:

- desktop 2 or 3 columns
- tablet 2 columns
- mobile 1 column

Each card includes map name, school name when available, Private status, room count, memory count, member count, updated date when available, and a compact mini-campus preview.

Mini-preview:

- 3–4 room blocks
- one corridor
- one highlighted room
- deterministic variation derived from index or document ID
- no Math.random and no hydration mismatch

Card behavior:

- border darkens on hover
- moves upward no more than 3px
- selected room marker changes tone
- no glow or giant shadow
- visible focus state

If the campus route does not exist, do not link to a 404; show “Campus view coming next” and keep the structure ready to become a Link later.

## Loading state

Implement app/dashboard/loading.tsx and client Firestore loading state. The loading view resembles the actual dashboard with compact header placeholder, welcome placeholder, create-panel placeholder, map-section placeholder, and 2 map-card placeholders. No blank screen or giant centered spinner. Include readable screen-reader text “Loading your MemoryMaps”. Skeletons are aria-hidden and reduced motion disables shimmer.

## Error state

If Firestore fails, keep the rest of the dashboard available and show inside Your MemoryMaps:

Heading: We could not load your MemoryMaps.

Text: Your account is still signed in. Try loading your campuses again.

Button: Try again

Do not replace the dashboard, expose raw Firebase messages, use alert(), or hide the create panel. Retry must work.

## Authentication behavior

While auth loads, do not show private content; show dashboard loading UI. When user is null, use router.replace('/login?next=/dashboard'). When user exists, render the dashboard. Avoid redirect loops. Authenticated refreshes remain signed in. Never store Firebase tokens manually or expose UID in the UI.

## Profile image

Use user.photoURL when available. A normal img is acceptable when remote Next Image configuration is not set; provide meaningful alt text, use referrerPolicy="no-referrer" when appropriate, size consistently, and crop with object-fit:cover. Without a photo, generate at most two initials in a neutral high-contrast circular avatar. Prevent layout shift.

## Visual system

Reuse existing MemoryMap identity:

- warm off-white background
- cream and white surfaces
- near-black and dark forest green text
- coral primary action
- moss green and muted yellow accents
- warm neutral grey borders

Do not introduce purple, blue-purple gradients, neon, glassmorphism, large glowing shadows, excessive pills, random blobs, or comic offsets. Use serif only for major headings and sans-serif for interface text. Improve faint contrast and avoid microtext below approximately 11px except tiny metadata.

## Animation system

Use restrained entry motion:

1. Header appears immediately
2. Welcome heading rises approximately 12px
3. Supporting text follows
4. Create panel rises approximately 16px
5. Your MemoryMaps appears
6. Side decorations animate last

All meaningful content visible by default. Do not hide essential content behind IntersectionObserver. Use opacity, transform, stroke-dashoffset, and CSS transitions only. No long staggers, continuous floating, bouncing, spinning, pulsing, scroll hijacking, large parallax, or animation libraries. Total entrance under approximately 900ms. Respect reduced motion.

## Responsive requirements

Verify 1440px, 1280px, 1024px, 768px, 390px, and 360px.

Desktop: side decoration only when space allows, aligned welcome/create grid, no excessive gaps, MemoryMaps naturally after create.

Tablet: hide or simplify decoration, usable account section, create panel may stack or narrow, map grid uses 2 columns when possible.

Mobile: hide all decorations, compact header, readable logo, no account overflow, email may hide, navigation remains usable, correct heading wrapping, stacked create panel, full-width CTA, one-column map list, 44px touch targets, no horizontal overflow, no unreadably shrunken desktop UI.

## Accessibility

Ensure semantic header, nav, main, section, article, and footer; correct heading hierarchy; focus-visible styles; aria-current active navigation; meaningful profile alt; aria-hidden decorative graphics; clear action labels; aria-live loading; appropriate alert/status errors; keyboard retry; announced sign-out state; readable disabled buttons; sufficient contrast; selected states not color-only; reduced-motion support.

## Code quality

Use reusable components only when they improve clarity. Suggested structure:

app/dashboard/
  page.tsx
  DashboardClient.tsx
  loading.tsx
  components/
    DashboardHeader.tsx
    DashboardWelcome.tsx
    CreateMemoryMapPanel.tsx
    MemoryMapsSection.tsx
    MemoryMapCard.tsx
    EmptyMemoryMaps.tsx
    DashboardDecorations.tsx
    DashboardSkeleton.tsx

Do not overabstract one-line markup. Use proper TypeScript types. Do not use any, dangerouslySetInnerHTML, duplicated Firebase queries, duplicated logo SVG, unnecessary useEffect, random render values, unjustified disabled ESLint rules, hidden TypeScript errors, fake APIs, or mock user data in authenticated UI.

## Firestore security

Preserve owner-only access. firestore.rules must include owner restrictions for memoryMaps and must not add public read access, allow read/write true, service-account credentials, or Firebase Admin SDK.

## Explicit exclusions

Do not fully implement the campus creation wizard, floor editor, room editor, memory uploads, media storage, invitations, member management, reactions, comments, search, notifications, public campuses, or profile settings. A valid /create placeholder route is allowed and preferred.

## Testing loop

1. Inspect current implementation
2. Implement
3. Run type/build checks
4. Fix errors
5. Review dashboard structure
6. Review responsive CSS
7. Review empty state
8. Review populated state using temporary local test data only when necessary
9. Remove temporary test data
10. Review authentication guard
11. Review sign-out
12. Review reduced motion
13. Review accessibility
14. Run final build
15. Re-read END_GOAL.md
16. Continue if any item remains incomplete

Run npm run build and the existing lint command when available. Fix TypeScript, React, Firebase, imports, keys, hydration, accessibility, redirect loops, mobile overflow, clipping, unreadable text, broken buttons, missing routes, loading flashes, and animation cleanup problems.

## Required verification checklist

- [x] Logged-out user opening /dashboard is redirected by the client auth guard.
- [x] Logged-in user sees the dashboard after auth resolves.
- [x] Refreshing /dashboard preserves Firebase observer-based authentication.
- [x] Display name renders correctly with a safe fallback.
- [x] Email fallback renders safely for greeting and initials.
- [x] Profile photo or initials render with stable sizing and accessible text.
- [x] Sign out calls signOut(auth) and routes to /login.
- [x] Sign-out failure is handled accessibly with an alert and disabled busy state.
- [x] Firestore loading state appears in the dashboard and route loading UI.
- [x] Firestore empty result appears as a complete campus-starting state.
- [x] Firestore error state appears without hiding the creation panel.
- [x] Retry re-runs the owner-scoped Firestore query.
- [x] Existing maps render as deterministic mini-campus cards.
- [x] No fictional demo campus is seeded into real user data.
- [x] Create buttons navigate to the valid authenticated /create route.
- [x] No dashboard action produces a 404; route smoke checks returned 200 for /create and the core routes.
- [x] Side decoration is pointer-inert and positioned outside the content column.
- [x] Reduced motion disables route drawing and skeleton animation.
- [x] Mobile header does not overflow; navigation hides while account controls remain.
- [x] Mobile create panel stacks copy and preview with a full-width CTA.
- [x] Map cards use min-width constraints and responsive columns without intentional overflow.
- [x] Homepage remains unchanged by this dashboard pass.
- [x] Login page remains unchanged by this dashboard pass.
- [x] Dashboard layout is fully redesigned around a compact application home hierarchy.
- [x] Current visual weaknesses are corrected through tighter spacing, stronger hierarchy, a split create panel, and complete states.
- [x] Authentication guard works through AuthProvider/useAuth and router replacement.
- [x] Firestore query uses collection, query, where(ownerId == user.uid), and getDocs.
- [x] Empty state works with an honest /create destination.
- [x] Loading state works without revealing private dashboard content.
- [x] Error state works with a safe message and retry.
- [x] Populated state works with typed, sorted, owner-scoped map summaries.
- [x] Valid authenticated create destination exists at /create.
- [x] Side decorations are coherent route/memory-trail details and are hidden at smaller widths.
- [x] Mobile layout is defined for dashboard header, create panel, empty state, and map cards.
- [x] Tablet layout is defined at the 1024px and 768px breakpoints.
- [x] Desktop layout is defined with a 1180px content frame and three-column map grid.
- [x] Accessibility requirements are satisfied in source review: semantics, focus styles, labels, status/error announcements, and decorative aria-hidden graphics.
- [x] Reduced-motion mode works through the global media query and dashboard-specific overrides.
- [x] No unfinished inline temporary create message remains; the route placeholder is explicit and honest.
- [x] No fake personal data is shown; fictional visual labels are confined to decorative previews.
- [x] npm run build passes.

## Completion criteria

This goal is complete only when every required item is verified, no dashboard action produces a 404, no fake personal data is shown, no required checklist item remains unchecked, npm run build passes, and END_GOAL.md contains final results. Do not declare completion merely because the dashboard looks better.

---

# Current phase: complete MemoryMap creation and usage flow

This phase replaces the temporary create placeholder with a complete authenticated flow: dashboard naming modal, Firestore MemoryMap creation, owner-only setup builder, floors, rooms, resizable/positioned rooms, SVG polyline corridors, invite links and joining, Done activation, dark viewer, room memory panel, incidents, Hack Club CDN images, protected deletion, counters, responsive states, accessibility, and persistence. Do not report completion while any required route, interaction, Firestore write, upload, security check, loading/error state, or responsive state is unfinished.

## Current-phase requirements

- Preserve Google login, AuthProvider, dashboard auth, sign out, homepage, login, brand, and server-only `HACKCLUB_CDN_API_KEY`.
- Do not use Firebase Storage, storage.rules, Redux, state/query/UI/diagram/animation libraries, or public CDN calls from the browser.
- Replace `/create` placeholder behavior with a naming modal and create `memoryMaps/{id}`, owner membership, and initial Ground Floor.
- Build `/memorymaps/[memoryMapId]/setup` with owner guard, floor management, room add/edit/type/accent/drag/resize/duplicate/delete, bounded SVG canvas, inspector, autosave statuses, corridor click-point drawing, preview, invite management, and Done validation/activation.
- Build `/join/[inviteCode]` with authenticated join, invalid/duplicate/owner handling, membership creation, and invite-code mapping.
- Build `/memorymaps/[memoryMapId]` with accessible dark viewer, floor switching, rooms/corridors, owner edit access, room panel, incident creation, image creation, chronological timeline, image lightbox, and protected deletion.
- Use protected `POST /api/memorymaps/[memoryMapId]/images` and `DELETE /api/memorymaps/[memoryMapId]/images/[uploadId]`; verify Firebase ID tokens server-side, confirm owner/active member, validate JPEG/PNG/WebP under 5 MB, proxy Hack Club CDN, persist safe metadata, and attempt orphan cleanup.
- Keep Firestore rules protective for maps, members, floors, rooms, corridors, memories, and invite codes; owner structure writes, active-member reads/memory creation, own-memory edits/deletes, owner memory management; no public reads.
- Maintain roomCount, memoryCount, memberCount safely; show layout-shaped loading, empty, access-denied, not-found, save, upload, network, and error states.
- Verify desktop 1440/1280, tablet 1024/768, mobile 430/390/360, keyboard/focus/Escape/dialog/touch/reduced-motion behavior, no body overflow, unchanged homepage/login, no secrets with `NEXT_PUBLIC_`, and no Firebase Storage code.

## Current-phase checklist

- [ ] Naming modal opens from dashboard CTA; focus, Escape, backdrop, validation, submit state, errors, and focus restoration work.
- [ ] Authenticated creation writes map, owner member, and Ground Floor; failure is safe and preserves input.
- [ ] Setup route loading/auth/owner/not-found/access-denied states work.
- [ ] Floors can be created, switched, renamed, duplicate-checked, and safely deleted except the final floor.
- [ ] Rooms can be added, renamed, typed, accented, dragged, resized, duplicated, deleted, and persisted on meaningful completion.
- [ ] Corridors support click-point preview, finish/cancel, labels/width/style, selection, deletion, and persistence behind rooms.
- [ ] Autosave status, retry/error preservation, parent timestamps, preview mode, Done validation, confirmation, and activation work.
- [ ] Invite copy fallback, regeneration confirmation, member display, invite-code mapping, and authenticated join work.
- [ ] Dashboard cards use active/setup routes and remove temporary labels; saved maps appear after creation.
- [ ] Viewer loads accessible maps with dark theme, floors, rooms, corridors, labels, hover/selection, and owner edit.
- [ ] Room panel is keyboard accessible with All/Images/Incidents, empty state, close/Escape/focus handling.
- [ ] Incidents validate title/description/date/tags, persist, display chronologically, and update counts.
- [ ] Image form previews locally, cleans object URLs, calls only internal routes with fresh ID tokens, and handles progress/error/retry.
- [ ] CDN accepts only validated JPEG/PNG/WebP under 5 MB, returns safe metadata, persists all image fields, and never exposes/logs its key.
- [ ] Image deletion verifies stored upload ID plus owner/uploader, handles missing CDN files, cleans Firestore, and attempts orphan cleanup.
- [ ] Firestore rules protect all structured data and invite mappings; deployment to Firebase Console remains documented.
- [ ] Loading/empty/error/offline/access states, responsive layouts, accessibility, reduced motion, and touch targets are complete.
- [ ] No Firebase Storage code, storage.rules, temporary create placeholder, 404 action, or `NEXT_PUBLIC_` server secret exists.
- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.

## Current-phase final record

### Files created/modified

- Created: `types/memory-map.ts`, `lib/memorymaps/data.ts`, `lib/memorymaps/invite.ts`, `components/CreateMemoryMapModal.tsx`, setup route/client/loading files, viewer route/client/loading files, join route/client, namespaced image route handlers.
- Modified: dashboard client, upload client, globals stylesheet, `.env.example`, `firestore.rules`.
- Preserved the public homepage, login route, AuthProvider, browser Firebase initialization, and server-only CDN key handling.

### Firestore structure

- `memoryMaps/{memoryMapId}` with owner metadata, private/setup or active status, invite code, counters, timestamps.
- Nested `members`, `floors`, `rooms`, `corridors`, and `memories` collections; `inviteCodes/{inviteCode}` mapping.
- Typed parsing helpers and owner/member-oriented Firestore rules are present.

### CDN/API/routes

- Created `/memorymaps/[memoryMapId]/setup`, `/memorymaps/[memoryMapId]`, `/join/[inviteCode]`, `/api/memorymaps/[memoryMapId]/images`, and `/api/memorymaps/[memoryMapId]/images/[uploadId]`.
- Existing server-only Hack Club proxy was reused; the client helper now targets the namespaced internal upload route.
- The CDN key remains only in `process.env.HACKCLUB_CDN_API_KEY` server code.

### Tests/build/deferred features

- `npm run lint` passed.
- `npm run build` passed and generated all new routes.
- Static checks found no source imports of Firebase Storage and no `storage.rules` file.
- Remaining blockers before this goal can be marked complete: full viewer image form launch/deletion UX, complete preview/focus/accessibility behavior, orphan cleanup/counter hardening, floor nested-memory cleanup, and end-to-end authenticated Firestore/CDN testing with configured deployment credentials.

## Progress log

### Files created

- END_GOAL.md
- app/create/page.tsx
- app/create/CreatePlaceholderClient.tsx
- app/dashboard/components/DashboardDecorations.tsx

### Files modified

- app/dashboard/DashboardClient.tsx
- app/globals.css

### Tests performed

- `npm run lint` — passed.
- `npm run build` — passed; routes generated successfully for `/`, `/login`, `/dashboard`, and `/create`.
- Local production route smoke check — `/`, `/login`, `/dashboard`, and `/create` each returned HTTP 200.
- Static source audit — no dashboard `any`, `dangerouslySetInnerHTML`, `Math.random`, token storage, public Firestore rule, stale create-message state, or obsolete map-row markup remains.
- Responsive CSS review — desktop, tablet, and mobile rules checked for 1440/1280/1024/768/390/360 targets; side details hide below 1100px and map/create layouts stack at the intended breakpoints.
- Accessibility source review — auth labels, status/error announcements, focus-visible base styles, semantic headings/regions, alt text, and decorative `aria-hidden` graphics checked.
- Browser connector visual session — unavailable in this environment; no pixel-level screenshot claim is made.

### Build result

- Passed. `npm run build` completed successfully with TypeScript and static route generation.

### Intentionally deferred features

- Campus creation wizard implementation
- Floor and room editors
- Memory uploads and media storage
- Invitations and member management
- Reactions, comments, search, notifications
- Public campuses and profile settings

### Known limitations

- Live Google Authentication and Firestore reads were not exercised from this workspace because `.env.local` does not contain populated Firebase client values and the browser connector was unavailable. The runtime-safe Firebase client, auth guard, owner-scoped query, retry, sign-out, and `/create` flow are implemented and build-verified; deployment still requires the project Firebase variables and authorised domain configuration.
