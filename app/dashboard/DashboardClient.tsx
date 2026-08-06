"use client";

import { collection, doc, getDoc, getDocs, query, Timestamp, where } from "firebase/firestore";
import type { User } from "firebase/auth";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import CreateMemoryMapModal from "../../components/CreateMemoryMapModal";
import DeleteCampusModal from "../../components/DeleteCampusModal";
import UpgradeModal from "../../components/UpgradeModal";
import MemoryMapLogo from "../components/MemoryMapLogo";
import MemoryMapWordmark from "../components/MemoryMapWordmark";
import { useAuth } from "../providers/AuthProvider";
import { assertFirebaseConfig, auth, db } from "../../lib/firebase/client";

export type MemoryMapSummary = {
  id: string;
  name: string;
  schoolName?: string;
  ownerId: string;
  privacy: "private";
  roomCount: number;
  memoryCount: number;
  memberCount: number;
  floorCount?: number;
  status: "setup" | "active";
  isShared?: boolean;
  ownerName?: string;
  ownerType?: "guest" | "registered";
  accessRole?: "owner" | "member";
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

type Filter = "all" | "owned" | "shared" | "setup" | "active";
type Sort = "updated" | "created" | "name-asc" | "name-desc";

function countOrDefault(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function timestampOrUndefined(value: unknown) {
  return value instanceof Timestamp ? value : undefined;
}

function getFirstName(displayName: string | null, email: string | null) {
  return displayName?.trim().split(/\s+/)[0] || email?.split("@")[0].trim() || "there";
}

function getInitials(displayName: string | null, email: string | null) {
  const source = displayName?.trim() || email?.split("@")[0].trim() || "MM";
  const words = source.split(/\s+/).filter(Boolean);
  return (words.length > 1 ? `${words[0][0]}${words[1][0]}` : source.slice(0, 2)).toUpperCase();
}

function formatDate(timestamp?: Timestamp) {
  if (!timestamp) return "Not updated yet";
  return `Updated ${timestamp.toDate().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
}

function toMemoryMapSummary(id: string, data: Record<string, unknown>, accessRole: "owner" | "member", userId: string): MemoryMapSummary {
  return {
    id,
    name: typeof data.name === "string" && data.name.trim() ? data.name : "Untitled MemoryMap",
    schoolName: typeof data.schoolName === "string" ? data.schoolName : undefined,
    ownerId: typeof data.ownerId === "string" ? data.ownerId : userId,
    ownerName: typeof data.ownerName === "string" ? data.ownerName : undefined,
    ownerType: data.ownerType === "guest" ? "guest" : "registered",
    privacy: "private",
    roomCount: countOrDefault(data.roomCount, 0),
    memoryCount: countOrDefault(data.memoryCount, 0),
    memberCount: countOrDefault(data.memberCount, 1),
    floorCount: typeof data.floorCount === "number" ? data.floorCount : undefined,
    status: data.status === "active" ? "active" : "setup",
    isShared: accessRole === "member",
    accessRole,
    createdAt: timestampOrUndefined(data.createdAt),
    updatedAt: timestampOrUndefined(data.updatedAt),
  };
}

function mergeMemoryMaps(current: MemoryMapSummary[], incoming: MemoryMapSummary[]) {
  const maps = new Map(current.map((memoryMap) => [memoryMap.id, memoryMap]));
  incoming.forEach((memoryMap) => {
    const existing = maps.get(memoryMap.id);
    if (existing?.accessRole === "owner" && memoryMap.accessRole === "member") return;
    maps.set(memoryMap.id, memoryMap);
  });
  return [...maps.values()].sort((a, b) => (b.updatedAt?.toMillis() ?? 0) - (a.updatedAt?.toMillis() ?? 0));
}

function Icon({ name, size = 18 }: { name: "arrow" | "campus" | "check" | "clock" | "layers" | "menu" | "people" | "search" | "spark" | "user"; size?: number }) {
  const paths = {
    arrow: <path d="M4 12h15m-6-6 6 6-6 6" />,
    campus: <><path d="m3 10 9-6 9 6" /><path d="M5 10v9h14v-9M9 19v-5h6v5M8 10h.01M12 10h.01M16 10h.01" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    clock: <><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3 2" /></>,
    layers: <><path d="m12 4 8 4-8 4-8-4 8-4Z" /><path d="m4 12 8 4 8-4M4 16l8 4 8-4" /></>,
    menu: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
    people: <><circle cx="9" cy="9" r="3" /><path d="M3 19c.5-3 2.5-4.5 6-4.5s5.5 1.5 6 4.5M16 6.5a3 3 0 0 1 0 5.8M17 14.8c2.4.5 3.7 1.9 4 4.2" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
    spark: <><path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3ZM19 16l.6 2.4L22 19l-2.4.6L19 22l-.6-2.4L16 19l2.4-.6L19 16Z" /></>,
    user: <><circle cx="12" cy="8" r="3.5" /><path d="M4.5 20c.7-3.7 3.2-5.5 7.5-5.5s6.8 1.8 7.5 5.5" /></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function MiniCampusPreview({ variant, roomCount, floorCount }: { variant: number; roomCount: number; floorCount?: number }) {
  const placements = [[24, 20], [200, 20], [24, 77], [200, 77], [112, 77]];
  const visibleRooms = Math.min(5, Math.max(roomCount, 2));
  return (
    <div className={`mm-campus-preview mm-campus-preview--${variant}`} aria-hidden="true">
      <span className="mm-campus-preview__label">{floorCount ? `${floorCount} floor${floorCount === 1 ? "" : "s"}` : "Campus layout"}</span>
      <svg viewBox="0 0 300 132" fill="none">
        <path className="mm-campus-preview__corridor" d="M17 66H283M150 17V115" />
        {placements.slice(0, visibleRooms).map(([x, y], index) => <rect key={`${x}-${y}`} x={x} y={y} width="77" height="34" rx="3" className={`mm-campus-preview__room mm-campus-preview__room--${index % 3}`} />)}
        <path className="mm-campus-preview__door" d="M101 38h16M183 94h16" />
        <circle className="mm-campus-preview__marker" cx={variant === 1 ? "222" : variant === 2 ? "70" : "150"} cy={variant === 1 ? "38" : variant === 2 ? "94" : "66"} r="4" />
      </svg>
      <span className="mm-campus-preview__caption"><span /> A quiet place, mapped</span>
    </div>
  );
}

export function DashboardLoadingState({ message = "Loading your dashboard" }: { message?: string }) {
  return (
    <main className="mm-dashboard-page" aria-busy="true">
      <div className="mm-dashboard-shell mm-dashboard-skeleton-shell" role="status" aria-live="polite">
        <div className="mm-skeleton mm-skeleton--nav" aria-hidden="true" />
        <div className="mm-skeleton mm-skeleton--eyebrow" aria-hidden="true" />
        <div className="mm-skeleton mm-skeleton--title" aria-hidden="true" />
        <p className="sr-only">{message}</p>
        <div className="mm-skeleton-stats" aria-hidden="true"><span /><span /><span /><span /></div>
        <div className="mm-skeleton mm-skeleton--feature" aria-hidden="true" />
        <div className="mm-skeleton-grid" aria-hidden="true"><span /><span /><span /></div>
      </div>
    </main>
  );
}

function UserMenu({ user, displayName, initials, open, onToggle, onSignOut, isSigningOut, onSignIn }: { user: User; displayName: string; initials: string; open: boolean; onToggle: () => void; onSignOut: () => void; isSigningOut: boolean; onSignIn: () => void }) {
  const isGuest = user.isAnonymous === true;
  return (
    <div className="mm-user-menu">
      <button type="button" className="mm-user-menu__trigger" aria-haspopup="menu" aria-expanded={open} onClick={onToggle}>
        {user.photoURL ? (
          <>
            <span className="sr-only">Profile photo</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={user.photoURL} alt="" referrerPolicy="no-referrer" />
          </>
        ) : <span aria-hidden="true"><Icon name={isGuest ? "user" : "spark"} size={17} /></span>}
        <span className="mm-user-menu__summary"><strong>{isGuest ? "Guest session" : displayName}</strong><small>{isGuest ? "Explore mode" : "Google account"}</small></span>
        <span className="mm-user-menu__chevron" aria-hidden="true">⌄</span>
      </button>
      {open && <div className="mm-user-menu__panel" role="menu">
        <div className="mm-user-menu__identity"><span className="mm-user-menu__identity-avatar">{initials}</span><div><strong>{isGuest ? "Guest session" : displayName}</strong><small>{isGuest ? "Saved in this browser" : user.email || "Signed in with Google"}</small></div></div>
        <div className="mm-user-menu__status"><span />{isGuest ? "Limited guest access" : "Account connected"}</div>
        {isGuest ? <><button type="button" role="menuitem" onClick={onSignIn}><Icon name="spark" size={16} /> Sign in with Google</button><button type="button" role="menuitem" onClick={onSignOut} disabled={isSigningOut}><Icon name="arrow" size={16} /> {isSigningOut ? "Exiting guest session…" : "Exit guest session"}</button></> : <button type="button" role="menuitem" onClick={onSignOut} disabled={isSigningOut}><Icon name="arrow" size={16} /> {isSigningOut ? "Signing out…" : "Sign out"}</button>}
      </div>}
    </div>
  );
}

function DashboardHeader({ user, displayName, initials, onCreate, onSignOut, onSignIn, isSigningOut }: { user: User; displayName: string; initials: string; onCreate: () => void; onSignOut: () => void; onSignIn: () => void; isSigningOut: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="mm-dashboard-header">
      <div className="mm-dashboard-header__inner">
        <Link href="/" className="mm-dashboard-header__brand" aria-label="MemoryMap home"><MemoryMapLogo size={31} variant="dark" /><MemoryMapWordmark /></Link>
        <span className="mm-dashboard-header__section">Dashboard</span>
        <nav className="mm-dashboard-nav" aria-label="Dashboard navigation"><Link href="/dashboard" aria-current="page">Overview</Link><a href="#campuses-title">Your campuses</a></nav>
        <div className="mm-dashboard-header__actions"><button type="button" className="mm-button mm-button--coral mm-dashboard-create-button" onClick={onCreate}><span className="mm-dashboard-create-button__full">Create campus</span><span className="mm-dashboard-create-button__compact" aria-hidden="true">+ Create</span></button><UserMenu user={user} displayName={displayName} initials={initials} open={menuOpen} onToggle={() => setMenuOpen((value) => !value)} onSignOut={onSignOut} isSigningOut={isSigningOut} onSignIn={onSignIn} /></div>
      </div>
    </header>
  );
}

function WelcomeBanner({ user, onCreate, onSignIn }: { user: User; onCreate: () => void; onSignIn: () => void }) {
  const isGuest = user.isAnonymous === true;
  return <section className="mm-welcome" aria-labelledby="dashboard-title"><div><p className="mm-eyebrow mm-eyebrow--moss">{isGuest ? "A gentle first look" : "Your private archive"}</p><h1 id="dashboard-title">{isGuest ? "Explore MemoryMap as a guest" : `Welcome back, ${getFirstName(user.displayName, user.email)}`}</h1><p>{isGuest ? "You can try the campus builder before creating a full account." : "Continue building your campuses, revisit memories or explore maps shared with you."}</p></div><button type="button" className="mm-text-action" onClick={isGuest ? onSignIn : onCreate}>{isGuest ? "Sign in to unlock everything" : "Create a new campus"}<Icon name="arrow" size={16} /></button></section>;
}

function StatIcon({ name }: { name: "campus" | "people" | "clock" | "layers" }) { return <span className="mm-dashboard-stat__icon"><Icon name={name} size={17} /></span>; }

function DashboardStats({ user, maps, loading }: { user: User; maps: MemoryMapSummary[]; loading: boolean }) {
  const isGuest = user.isAnonymous === true;
  const owned = maps.filter((map) => !map.isShared).length;
  const stats = isGuest ? [
    ["Guest campuses", owned, "campus" as const],
    ["Remaining guest limit", Math.max(0, 1 - owned), "spark" as const],
    ["Setup incomplete", maps.filter((map) => map.status === "setup").length, "clock" as const],
  ] : [
    ["Total campuses", maps.length, "campus" as const],
    ["Owned by you", owned, "spark" as const],
    ["Shared with you", maps.filter((map) => map.isShared).length, "people" as const],
    ["Setup incomplete", maps.filter((map) => map.status === "setup").length, "clock" as const],
  ];
  return <section className={`mm-dashboard-stats mm-dashboard-stats--${isGuest ? "guest" : "member"}`} aria-label="Campus summary">{stats.map(([label, value, icon]) => <div className="mm-dashboard-stat" key={label as string}><StatIcon name={icon as "campus" | "people" | "clock" | "layers"} /><span>{label}</span><strong>{loading ? "—" : value}</strong></div>)}</section>;
}

function GuestModeNotice({ onSignIn }: { onSignIn: () => void }) {
  return <section className="mm-guest-notice" aria-label="Guest session information"><span className="mm-guest-notice__icon"><Icon name="spark" size={18} /></span><div><strong>You are exploring in guest mode.</strong><p>Guest campuses are limited, image uploads are unavailable and private invites require Google sign-in.</p></div><button type="button" className="mm-button mm-button--outline mm-button--small" onClick={onSignIn}>Continue with Google</button></section>;
}

function CampusFilters({ user, filter, setFilter, search, setSearch, sort, setSort }: { user: User; filter: Filter; setFilter: (value: Filter) => void; search: string; setSearch: (value: string) => void; sort: Sort; setSort: (value: Sort) => void }) {
  const isGuest = user.isAnonymous === true;
  const filters = isGuest ? [["all", "All"], ["active", "Active"], ["setup", "Setup incomplete"]] as const : [["all", "All"], ["owned", "Owned"], ["shared", "Shared with you"], ["setup", "Setup incomplete"]] as const;
  return <div className="mm-campus-controls"><div className="mm-campus-filters" role="tablist" aria-label="Campus filters">{filters.map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div><div className="mm-campus-tools"><label className="mm-campus-search"><span className="sr-only">Search campuses</span><Icon name="search" size={17} /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search campuses" /></label><label className="mm-campus-sort"><span>Sort</span><select value={sort} onChange={(event) => setSort(event.target.value as Sort)} aria-label="Sort campuses"><option value="updated">Recently updated</option><option value="created">Recently created</option><option value="name-asc">Name A–Z</option><option value="name-desc">Name Z–A</option></select></label></div></div>;
}

function CreateCampusCard({ user, limitReached, onCreate, onSignIn }: { user: User; limitReached: boolean; onCreate: () => void; onSignIn: () => void }) {
  const isGuest = user.isAnonymous === true;
  return <article className={`mm-create-campus-card${limitReached ? " is-disabled" : ""}`}><div className="mm-create-campus-card__visual" aria-hidden="true"><span>+</span><i /><i /><i /></div><div className="mm-create-campus-card__body"><p className="mm-eyebrow mm-eyebrow--ochre">{isGuest ? "Guest workspace" : "Make room for more"}</p><h3>{isGuest ? "Try another campus" : "Create a new campus"}</h3><p>{isGuest ? limitReached ? "You have used your guest campus. Sign in to keep exploring." : "Start with a sample place and see how MemoryMap works." : "Start with a blank layout and build it room by room."}</p><button type="button" className={`mm-button ${limitReached ? "mm-button--outline" : "mm-button--coral"}`} onClick={limitReached ? onSignIn : onCreate}>{limitReached ? "Sign in to create more" : "Start building"}<Icon name="arrow" size={15} /></button></div></article>;
}

function CampusCard({ memoryMap, index, user, openMenuId, setOpenMenuId, onDelete }: { memoryMap: MemoryMapSummary; index: number; user: User; openMenuId: string | null; setOpenMenuId: (id: string | null) => void; onDelete: (memoryMap: MemoryMapSummary) => void }) {
  const isGuest = user.isAnonymous === true;
  const isOwner = memoryMap.accessRole === "owner" || memoryMap.ownerId === user.uid;
  const isSetup = memoryMap.status === "setup";
  const campusHref = `/memorymaps/${memoryMap.id}${isOwner && isSetup ? "/setup" : ""}`;
  const actionLabel = isSetup ? "Continue setup" : memoryMap.isShared ? "View campus" : "Open campus";
  return <article className={`mm-campus-card mm-campus-card--${isSetup ? "setup" : "active"}${memoryMap.isShared ? " is-shared" : ""}`}><div className="mm-campus-card__top"><div className="mm-campus-card__identity"><span className={`mm-campus-card__status mm-campus-card__status--${memoryMap.isShared ? "shared" : isGuest ? "guest" : "owned"}`}><span />{memoryMap.isShared ? "Shared with you" : isGuest ? "Guest campus" : "Owned by you"}</span><h3><Link href={campusHref}>{memoryMap.name}</Link></h3>{memoryMap.schoolName && <p>{memoryMap.schoolName}</p>}{memoryMap.isShared && <p className="mm-campus-card__owner">From {memoryMap.ownerName || "a MemoryMap member"}</p>}</div>{isOwner && <div className="mm-card-menu"><button type="button" className="mm-card-menu__trigger" aria-label={`Actions for ${memoryMap.name}`} aria-haspopup="menu" aria-expanded={openMenuId === memoryMap.id} onClick={() => setOpenMenuId(openMenuId === memoryMap.id ? null : memoryMap.id)}><Icon name="menu" size={19} /></button>{openMenuId === memoryMap.id && <div className="mm-card-menu__panel" role="menu"><Link href={campusHref} role="menuitem" onClick={() => setOpenMenuId(null)}>{isSetup ? "Continue setup" : "Open campus"}</Link>{!isGuest && <Link href={`/memorymaps/${memoryMap.id}`} role="menuitem" onClick={() => setOpenMenuId(null)}>Invite people</Link>}<Link href={isSetup ? campusHref : `/memorymaps/${memoryMap.id}/setup`} role="menuitem" onClick={() => setOpenMenuId(null)}>Edit setup</Link><button type="button" role="menuitem" onClick={() => onDelete(memoryMap)}>Delete campus</button></div>}</div>}</div><Link href={campusHref} className="mm-campus-card__preview-link" aria-label={`${actionLabel}: ${memoryMap.name}`}><MiniCampusPreview variant={index % 3} roomCount={memoryMap.roomCount} floorCount={memoryMap.floorCount} /></Link><div className="mm-campus-card__metrics"><span><Icon name="layers" size={15} /><b>{memoryMap.floorCount ?? "—"}</b> floors</span><span><Icon name="campus" size={15} /><b>{memoryMap.roomCount}</b> rooms</span><span><Icon name="people" size={15} /><b>{memoryMap.memberCount}</b> members</span></div><div className="mm-campus-card__footer"><span><Icon name="clock" size={14} />{formatDate(memoryMap.updatedAt)}</span><Link href={campusHref}>{actionLabel}<Icon name="arrow" size={14} /></Link></div>{isSetup && <div className="mm-campus-card__setup-note"><Icon name="clock" size={14} />Setup incomplete</div>}</article>;
}

function DashboardEmptyState({ kind, query, onCreate, onReset, isGuest }: { kind: "none" | "shared" | "filter" | "search"; query?: string; onCreate: () => void; onReset: () => void; isGuest: boolean }) {
  const copy = kind === "none" ? (isGuest ? ["Your guest dashboard is empty.", "Create a sample campus to explore how MemoryMap works.", "Create a sample campus"] : ["You haven’t created a campus yet.", "Start by mapping a place that matters to you.", "Create your first campus"]) : kind === "shared" ? ["No campuses have been shared with you yet.", "When someone invites you, their campus will appear here.", "View all campuses"] : kind === "search" ? [`No campus found for “${query}”.`, "Try a different name or clear your search.", "Clear search"] : ["No campuses match this filter.", "Try another view to see more of your archive.", "View all campuses"];
  return <div className="mm-dashboard-empty-state"><div className="mm-dashboard-empty-state__art" aria-hidden="true"><Icon name={kind === "search" ? "search" : "campus"} size={25} /></div><div><p className="mm-eyebrow mm-eyebrow--ochre">Nothing here yet</p><h3>{copy[0]}</h3><p>{copy[1]}</p><button type="button" className="mm-button mm-button--coral" onClick={kind === "none" ? onCreate : onReset}>{copy[2]}<Icon name="arrow" size={15} /></button></div></div>;
}

function DashboardErrorState({ ownedError, sharedError, onRetry }: { ownedError: boolean; sharedError: boolean; onRetry: () => void }) {
  return <div className="mm-dashboard-error" role="alert"><span className="mm-dashboard-error__mark">!</span><div><strong>{ownedError && sharedError ? "We couldn’t load your campuses." : ownedError ? "Owned campuses couldn’t be loaded." : "Shared campuses couldn’t be loaded."}</strong><p>{ownedError && sharedError ? "Your session is still active. Please try again." : "The rest of your dashboard is still available."}</p></div><button type="button" className="mm-button mm-button--outline mm-button--small" onClick={onRetry}>Retry</button></div>;
}

export default function DashboardClient() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [memoryMaps, setMemoryMaps] = useState<MemoryMapSummary[]>([]);
  const [ownedMapsLoading, setOwnedMapsLoading] = useState(true);
  const [sharedMapsLoading, setSharedMapsLoading] = useState(true);
  const [ownedMapsError, setOwnedMapsError] = useState(false);
  const [sharedMapsError, setSharedMapsError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isUpgradeOpen, setIsUpgradeOpen] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [deleteCampus, setDeleteCampus] = useState<MemoryMapSummary | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deleteMessage, setDeleteMessage] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("deleted") === "1" ? "This campus no longer exists." : "");
  const [campusFilter, setCampusFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("updated");
  const mapsLoading = ownedMapsLoading || sharedMapsLoading;

  useEffect(() => {
    if (!loading && !user) router.replace("/login?next=/dashboard");
  }, [loading, router, user]);

  useEffect(() => {
    if (typeof window !== "undefined" && user && new URLSearchParams(window.location.search).get("deleted") === "1") window.history.replaceState({}, "", "/dashboard");
  }, [user]);

  useEffect(() => {
    if (!openMenuId) return;
    const closeMenu = (event: PointerEvent) => { const target = event.target; if (target instanceof Element && !target.closest(".mm-card-menu")) setOpenMenuId(null); };
    document.addEventListener("pointerdown", closeMenu);
    return () => document.removeEventListener("pointerdown", closeMenu);
  }, [openMenuId]);

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    const logFailure = (stage: string, error: unknown) => {
      const record = error && typeof error === "object" ? error as { code?: unknown; message?: unknown } : null;
      console.error("Dashboard campus load failed", { stage, code: record?.code ?? "unknown", message: record?.message ?? (error instanceof Error ? error.message : "Unknown error") });
    };
    const firestore = db;
    const failConfiguration = () => { if (!cancelled) { setOwnedMapsError(true); setSharedMapsError(true); setOwnedMapsLoading(false); setSharedMapsLoading(false); } };
    try { assertFirebaseConfig(); if (!firestore) throw new Error("Firestore unavailable"); } catch (error) { logFailure("configuration", error); failConfiguration(); return () => { cancelled = true; }; }
    const addFloorCounts = async (maps: MemoryMapSummary[]) => {
      const results = await Promise.allSettled(maps.map(async (map) => ({ ...map, floorCount: (await getDocs(collection(firestore, "memoryMaps", map.id, "floors"))).size })));
      results.forEach((result) => { if (result.status === "rejected") logFailure("floor count query", result.reason); });
      return results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
    };
    const loadOwnedMaps = async () => {
      try {
        const snapshot = await getDocs(query(collection(firestore, "memoryMaps"), where("ownerId", "==", user.uid)));
        const maps = await addFloorCounts(snapshot.docs.map((document) => toMemoryMapSummary(document.id, document.data() as Record<string, unknown>, "owner", user.uid)));
        if (!cancelled) { setMemoryMaps((current) => mergeMemoryMaps(current, maps)); setOwnedMapsError(false); }
      } catch (error) { logFailure("owned campuses query", error); if (!cancelled) setOwnedMapsError(true); }
      finally { if (!cancelled) setOwnedMapsLoading(false); }
    };
    const loadSharedMaps = async () => {
      try {
        const membershipSnapshot = await getDocs(collection(firestore, "users", user.uid, "memoryMaps"));
        const memberships = membershipSnapshot.docs.filter((membership) => { const data = membership.data() as Record<string, unknown>; return data.role === "member" && data.status === "active"; });
        const results = await Promise.allSettled(memberships.map(async (membership) => {
          const document = await getDoc(doc(firestore, "memoryMaps", membership.id));
          if (!document.exists()) return null;
          const data = document.data() as Record<string, unknown>;
          if (data.status !== "active" || typeof data.ownerId !== "string" || data.ownerId === user.uid) return null;
          return toMemoryMapSummary(document.id, data, "member", user.uid);
        }));
        const maps = await addFloorCounts(results.filter((result): result is PromiseFulfilledResult<MemoryMapSummary | null> => result.status === "fulfilled").map((result) => result.value).filter((map): map is MemoryMapSummary => Boolean(map)));
        if (!cancelled) { setMemoryMaps((current) => mergeMemoryMaps(current, maps)); setSharedMapsError(results.some((result) => result.status === "rejected")); }
        results.forEach((result) => { if (result.status === "rejected") logFailure("shared campus document", result.reason); });
      } catch (error) { logFailure("shared membership index", error); if (!cancelled) setSharedMapsError(true); }
      finally { if (!cancelled) setSharedMapsLoading(false); }
    };
    void Promise.all([loadOwnedMaps(), loadSharedMaps()]);
    return () => { cancelled = true; };
  }, [loading, retryCount, user]);

  const handleRetry = () => { setOwnedMapsLoading(true); setSharedMapsLoading(true); setOwnedMapsError(false); setSharedMapsError(false); setRetryCount((count) => count + 1); };
  const handleSignOut = async () => {
    setSignOutError(""); setIsSigningOut(true);
    try { if (!auth) throw new Error("Authentication unavailable"); await signOut(auth); router.replace("/login"); }
    catch { setSignOutError("We could not end this session. Please try again."); setIsSigningOut(false); }
  };
  const handleCampusDeleted = ({ failed, missing, code }: { failed: number; missing: number; code?: string }) => {
    if (!deleteCampus) return;
    setMemoryMaps((current) => current.filter((item) => item.id !== deleteCampus.id)); setOpenMenuId(null); setDeleteCampus(null);
    setDeleteMessage(code === "server-not-configured" ? "Campus deleted. Some image cleanup is not configured." : failed > 0 || missing > 0 ? "Campus deleted. Some image files could not be cleaned up." : "Campus deleted.");
  };

  const filteredMaps = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const filtered = memoryMaps.filter((map) => {
      const matchesFilter = campusFilter === "all" || (campusFilter === "owned" && !map.isShared) || (campusFilter === "shared" && map.isShared) || (campusFilter === "setup" && map.status === "setup") || (campusFilter === "active" && map.status === "active");
      const matchesSearch = !normalizedSearch || `${map.name} ${map.schoolName || ""} ${map.ownerName || ""}`.toLowerCase().includes(normalizedSearch);
      return matchesFilter && matchesSearch;
    });
    return filtered.sort((a, b) => sort === "name-asc" ? a.name.localeCompare(b.name) : sort === "name-desc" ? b.name.localeCompare(a.name) : sort === "created" ? (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0) : (b.updatedAt?.toMillis() ?? 0) - (a.updatedAt?.toMillis() ?? 0));
  }, [campusFilter, memoryMaps, search, sort]);

  if (loading) return <DashboardLoadingState message="Checking your session" />;
  if (!user) return <DashboardLoadingState message="Redirecting to sign in" />;
  const isGuest = user.isAnonymous === true;
  const displayName = isGuest ? "Guest" : user.displayName || "MemoryMap member";
  const initials = isGuest ? "G" : getInitials(user.displayName, user.email);
  const guestLimitReached = isGuest && memoryMaps.some((map) => !map.isShared && map.accessRole === "owner");
  const openCreate = () => guestLimitReached ? setIsUpgradeOpen(true) : setIsCreateOpen(true);
  const emptyKind = memoryMaps.length === 0 ? "none" : search.trim() ? "search" : campusFilter === "shared" ? "shared" : "filter";

  return <main className="mm-dashboard-page"><DashboardHeader user={user} displayName={displayName} initials={initials} onCreate={openCreate} onSignOut={() => void handleSignOut()} onSignIn={() => setIsUpgradeOpen(true)} isSigningOut={isSigningOut} /><div className="mm-dashboard-shell"><WelcomeBanner user={user} onCreate={openCreate} onSignIn={() => setIsUpgradeOpen(true)} />{isGuest && <GuestModeNotice onSignIn={() => setIsUpgradeOpen(true)} />}<DashboardStats user={user} maps={memoryMaps} loading={mapsLoading} /><section className="mm-dashboard-campuses" aria-labelledby="campuses-title"><div className="mm-dashboard-campuses__heading"><div><p className="mm-eyebrow mm-eyebrow--moss">Your places</p><h2 id="campuses-title">Campuses</h2><p>Places you own and private maps shared with you.</p></div>{!mapsLoading && memoryMaps.length > 0 && <span className="mm-dashboard-count">{filteredMaps.length} of {memoryMaps.length} shown</span>}</div><CampusFilters user={user} filter={campusFilter} setFilter={setCampusFilter} search={search} setSearch={setSearch} sort={sort} setSort={setSort} />{(ownedMapsError || sharedMapsError) && <DashboardErrorState ownedError={ownedMapsError} sharedError={sharedMapsError} onRetry={handleRetry} />}{deleteMessage && <p className="mm-dashboard-feedback" role="status" aria-live="polite">{deleteMessage}</p>}{mapsLoading && <div className="mm-dashboard-card-grid" aria-busy="true"><span className="sr-only">Loading campuses</span><div className="mm-campus-card-skeleton" /><div className="mm-campus-card-skeleton" /><div className="mm-campus-card-skeleton" /></div>}{!mapsLoading && memoryMaps.length === 0 && !ownedMapsError && !sharedMapsError && <DashboardEmptyState kind="none" isGuest={isGuest} onCreate={openCreate} onReset={() => undefined} />}{!mapsLoading && memoryMaps.length > 0 && filteredMaps.length === 0 && <DashboardEmptyState kind={emptyKind as "shared" | "filter" | "search"} query={search.trim()} isGuest={isGuest} onCreate={openCreate} onReset={() => { setCampusFilter("all"); setSearch(""); }} />}{!mapsLoading && filteredMaps.length > 0 && <div className="mm-dashboard-card-grid"><CreateCampusCard user={user} limitReached={guestLimitReached} onCreate={openCreate} onSignIn={() => setIsUpgradeOpen(true)} />{filteredMaps.map((memoryMap, index) => <CampusCard key={memoryMap.id} memoryMap={memoryMap} index={index} user={user} openMenuId={openMenuId} setOpenMenuId={setOpenMenuId} onDelete={(campus) => { setOpenMenuId(null); setDeleteMessage(""); setDeleteCampus(campus); }} />)}</div>}</section>{signOutError && <p className="mm-dashboard-feedback mm-dashboard-feedback--error" role="alert">{signOutError}</p>}</div><CreateMemoryMapModal open={isCreateOpen} user={user} onClose={() => setIsCreateOpen(false)} />{isUpgradeOpen && <UpgradeModal onClose={() => setIsUpgradeOpen(false)} />}{deleteCampus && <DeleteCampusModal campusId={deleteCampus.id} campusName={deleteCampus.name} onClose={() => setDeleteCampus(null)} onDeleted={handleCampusDeleted} />}</main>;
}
