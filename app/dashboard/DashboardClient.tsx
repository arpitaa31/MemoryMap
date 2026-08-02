"use client";

import { collection, doc, getDoc, getDocs, query, Timestamp, where } from "firebase/firestore";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import CreateMemoryMapModal from "../../components/CreateMemoryMapModal";
import MemoryMapLogo from "../components/MemoryMapLogo";
import MemoryMapWordmark from "../components/MemoryMapWordmark";
import { useAuth } from "../providers/AuthProvider";
import { assertFirebaseConfig, auth, db } from "../../lib/firebase/client";
import { signOut } from "firebase/auth";
import UpgradeModal from "../../components/UpgradeModal";
import DeleteCampusModal from "../../components/DeleteCampusModal";

export type MemoryMapSummary = {
  id: string;
  name: string;
  schoolName?: string;
  ownerId: string;
  privacy: "private";
  roomCount: number;
  memoryCount: number;
  memberCount: number;
  status: "setup" | "active";
  isShared?: boolean;
  ownerName?: string;
  ownerType?: "guest" | "registered";
  accessRole?: "owner" | "member";
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

function countOrDefault(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function timestampOrUndefined(value: unknown) {
  return value instanceof Timestamp ? value : undefined;
}

function getFirstName(displayName: string | null, email: string | null) {
  const displayFirstName = displayName?.trim().split(/\s+/)[0];
  if (displayFirstName) return displayFirstName;

  const emailName = email?.split("@")[0].trim();
  return emailName || "there";
}

function getInitials(displayName: string | null, email: string | null) {
  const source = displayName?.trim() || email?.split("@")[0].trim() || "MM";
  const words = source.split(/\s+/).filter(Boolean);
  if (words.length > 1) return `${words[0][0]}${words[1][0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function formatUpdatedDate(timestamp?: Timestamp) {
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

function MiniCampusPreview({ variant }: { variant: number }) {
  return (
    <div className={`mm-dashboard-mini-map mm-dashboard-mini-map--${variant}`} aria-hidden="true">
      <svg viewBox="0 0 300 132" fill="none">
        <path className="mm-dashboard-mini-map__corridor" d="M18 66H282M150 18V114" />
        <rect x="24" y="21" width="77" height="34" rx="2" />
        <rect x="199" y="21" width="77" height="34" rx="2" />
        <rect x="24" y="77" width="77" height="34" rx="2" />
        <rect x="199" y="77" width="77" height="34" rx="2" />
        <path className="mm-dashboard-mini-map__door" d="M101 38H117M183 94H199" />
        <circle className="mm-dashboard-mini-map__marker" cx={variant === 1 ? "222" : variant === 2 ? "70" : "150"} cy={variant === 1 ? "38" : variant === 2 ? "94" : "66"} r="4" />
      </svg>
    </div>
  );
}

function CreateCampusPreview() {
  return (
    <div className="mm-dashboard-create__visual" aria-hidden="true">
      <svg viewBox="0 0 360 220" fill="none">
        <path className="mm-dashboard-create__corridor" d="M24 110H336M180 27V193" />
        <rect className="mm-dashboard-create__room" x="38" y="37" width="94" height="52" rx="3" />
        <rect className="mm-dashboard-create__room" x="228" y="37" width="94" height="52" rx="3" />
        <rect className="mm-dashboard-create__room" x="38" y="132" width="94" height="52" rx="3" />
        <path className="mm-dashboard-create__door" d="M132 63H153M207 158H228" />
        <circle className="mm-dashboard-create__point" cx="180" cy="110" r="7" />
        <path className="mm-dashboard-create__plus" d="M180 101V119M171 110H189" />
      </svg>
      <span className="mm-dashboard-create__area">Ground floor / starting layout</span>
      <span className="mm-dashboard-create__label mm-dashboard-create__label--classroom">Classroom</span>
      <span className="mm-dashboard-create__label mm-dashboard-create__label--library">Library</span>
      <span className="mm-dashboard-create__label mm-dashboard-create__label--court">Court</span>
    </div>
  );
}

function EmptyCampusIllustration() {
  return (
    <div className="mm-dashboard-empty__illustration" aria-hidden="true">
      <svg viewBox="0 0 330 190" fill="none">
        <path className="mm-dashboard-empty__corridor" d="M20 95H310M165 24V166" />
        <rect x="33" y="39" width="86" height="45" rx="2" />
        <rect x="211" y="39" width="86" height="45" rx="2" />
        <rect x="33" y="108" width="86" height="45" rx="2" />
        <path className="mm-dashboard-empty__unfinished" d="M211 108H297V153H253" />
        <circle className="mm-dashboard-empty__point" cx="165" cy="95" r="6" />
        <path className="mm-dashboard-empty__plus" d="M165 86V104M156 95H174" />
      </svg>
      <span>Your first campus starts here.</span>
    </div>
  );
}

export function DashboardLoadingState({ message }: { message: string }) {
  return (
    <main className="mm-dashboard-page" aria-busy="true">
      <div className="mm-dashboard-loading" role="status" aria-live="polite">
        <div className="mm-dashboard-loading__header" aria-hidden="true"><span /><span /><span /></div>
        <div className="mm-dashboard-loading__intro">
          <span className="mm-eyebrow mm-eyebrow--moss">MemoryMap</span>
          <p>{message}</p>
          <i aria-hidden="true" />
        </div>
        <div className="mm-dashboard-loading__create" aria-hidden="true" />
        <div className="mm-dashboard-loading__skeletons" aria-hidden="true">
          <span /><span /><span />
        </div>
      </div>
    </main>
  );
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
  const [campusFilter, setCampusFilter] = useState<"all" | "owned" | "shared" | "setup">("all");
  const mapsLoading = ownedMapsLoading || sharedMapsLoading;

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login?next=/dashboard");
    }
  }, [loading, router, user]);

  useEffect(() => {
    if (typeof window === "undefined" || !user) return;
    if (new URLSearchParams(window.location.search).get("deleted") !== "1") return;
    window.history.replaceState({}, "", "/dashboard");
  }, [user]);

  useEffect(() => {
    if (!openMenuId) return;
    const closeMenu = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && !target.closest(".mm-dashboard-card-menu")) setOpenMenuId(null);
    };
    document.addEventListener("pointerdown", closeMenu);
    return () => document.removeEventListener("pointerdown", closeMenu);
  }, [openMenuId]);

  useEffect(() => {
    if (loading || !user) return;

    let cancelled = false;

    const loadMemoryMaps = async () => {
      const logFailure = (stage: string, error: unknown) => {
        const errorRecord = error && typeof error === "object" ? error as { code?: unknown; message?: unknown } : null;
        const code = errorRecord?.code !== undefined ? String(errorRecord.code) : "unknown";
        const message = typeof errorRecord?.message === "string" ? errorRecord.message : error instanceof Error ? error.message : String(error);
        console.error("Dashboard campus load failed", { stage, code, message });
      };

      const firestore = db;
      try {
        assertFirebaseConfig();
        if (!firestore) throw new Error("Firestore is unavailable.");
      } catch (error) {
        logFailure("configuration", error);
        if (!cancelled) {
          setOwnedMapsError(true);
          setSharedMapsError(true);
          setOwnedMapsLoading(false);
          setSharedMapsLoading(false);
        }
        return;
      }

      const loadOwnedMaps = async () => {
        try {
          const ownedQuery = query(collection(firestore, "memoryMaps"), where("ownerId", "==", user.uid));
          const ownedSnapshot = await getDocs(ownedQuery);
          const ownedMaps = ownedSnapshot.docs.map((document) => toMemoryMapSummary(document.id, document.data() as Record<string, unknown>, "owner", user.uid));
          if (!cancelled) {
            setMemoryMaps((current) => mergeMemoryMaps(current, ownedMaps));
            setOwnedMapsError(false);
          }
        } catch (error) {
          logFailure("owned campuses query", error);
          if (!cancelled) setOwnedMapsError(true);
        } finally {
          if (!cancelled) setOwnedMapsLoading(false);
        }
      };

      const loadSharedMaps = async () => {
        try {
          const membershipSnapshot = await getDocs(collection(firestore, "users", user.uid, "memoryMaps"));
          const memberships = membershipSnapshot.docs.filter((membership) => {
            const data = membership.data() as Record<string, unknown>;
            return data.role === "member" && data.status === "active";
          });
          const results = await Promise.allSettled(memberships.map(async (membership) => {
            const document = await getDoc(doc(firestore, "memoryMaps", membership.id));
            if (!document.exists()) return null;
            const data = document.data() as Record<string, unknown>;
            if (data.status !== "active" || typeof data.ownerId !== "string" || data.ownerId === user.uid) return null;
            return toMemoryMapSummary(document.id, data, "member", user.uid);
          }));
          const sharedMaps = results.filter((result): result is PromiseFulfilledResult<MemoryMapSummary | null> => result.status === "fulfilled").map((result) => result.value).filter((memoryMap): memoryMap is MemoryMapSummary => memoryMap !== null);
          if (!cancelled) {
            setMemoryMaps((current) => mergeMemoryMaps(current, sharedMaps));
            setSharedMapsError(results.some((result) => result.status === "rejected"));
          }
          results.forEach((result) => { if (result.status === "rejected") logFailure("shared campus document", result.reason); });
        } catch (error) {
          logFailure("shared membership index", error);
          if (!cancelled) setSharedMapsError(true);
        } finally {
          if (!cancelled) setSharedMapsLoading(false);
        }
      };

      await Promise.all([loadOwnedMaps(), loadSharedMaps()]);
    };
    void loadMemoryMaps();
    return () => {
      cancelled = true;
    };
  }, [loading, retryCount, user]);

  const handleSignOut = async () => {
    setSignOutError("");
    setIsSigningOut(true);

    try {
      if (!auth) throw new Error("Firebase authentication is unavailable.");
      await signOut(auth);
      router.replace("/login");
    } catch {
      setSignOutError("We could not sign you out. Please try again.");
      setIsSigningOut(false);
    }
  };

  const handleCampusDeleted = ({ failed, missing }: { failed: number; missing: number }) => {
    if (!deleteCampus) return;
    setMemoryMaps((current) => current.filter((item) => item.id !== deleteCampus.id));
    setOpenMenuId(null);
    setDeleteMessage(failed > 0 || missing > 0 ? "Campus deleted. Some image files could not be cleaned up." : "Campus deleted.");
    setDeleteCampus(null);
  };

  if (loading) return <DashboardLoadingState message="Checking your session…" />;
  if (!user) return <DashboardLoadingState message="Redirecting to sign in…" />;

  const isGuest = user.isAnonymous === true;
  const displayName = isGuest ? "Guest" : user.displayName || "MemoryMap member";
  const initials = isGuest ? "G" : getInitials(user.displayName, user.email);
  const userHasVisibleName = !isGuest && Boolean(user.displayName || user.email);
  const ownedCount = memoryMaps.filter((memoryMap) => !memoryMap.isShared).length;
  const sharedCount = memoryMaps.filter((memoryMap) => memoryMap.isShared).length;
  const totalRooms = memoryMaps.reduce((sum, memoryMap) => sum + memoryMap.roomCount, 0);
  const totalMemories = memoryMaps.reduce((sum, memoryMap) => sum + memoryMap.memoryCount, 0);
  const visibleMaps = memoryMaps.filter((memoryMap) => campusFilter === "all" || (campusFilter === "owned" && !memoryMap.isShared) || (campusFilter === "shared" && memoryMap.isShared) || (campusFilter === "setup" && !memoryMap.isShared && memoryMap.status === "setup"));
  const openCreate = () => {
    if (isGuest && memoryMaps.some((memoryMap) => memoryMap.accessRole === "owner")) {
      setIsUpgradeOpen(true);
      return;
    }
    setIsCreateOpen(true);
  };

  return (
    <main className="mm-dashboard-page">
      <header className="mm-dashboard-header">
        <Link href="/" className="mm-brand mm-dashboard-header__brand" aria-label="MemoryMap home">
          <MemoryMapLogo size={30} variant="dark" />
          <MemoryMapWordmark />
        </Link>
        <nav className="mm-dashboard-nav" aria-label="Dashboard navigation">
          <Link href="/dashboard" aria-current="page">Home</Link>
          <a href="#memorymaps-title">Your campuses</a>
        </nav>
        <div className="mm-dashboard-user">
          {user.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="mm-dashboard-user__photo" src={user.photoURL} alt={`${displayName} profile`} referrerPolicy="no-referrer" />
          ) : (
            <span className="mm-dashboard-user__initials" aria-hidden={userHasVisibleName}>{initials}</span>
          )}
          <div className="mm-dashboard-user__details">
            <strong>{isGuest ? "Guest session" : displayName}</strong>
            {!isGuest && user.email && <span>{user.email}</span>}
          </div>
          <button type="button" className="mm-dashboard-signout" onClick={handleSignOut} disabled={isSigningOut} aria-busy={isSigningOut} aria-label={isSigningOut ? "Signing out" : "Sign out"}>
            {isSigningOut ? "Signing out…" : "Sign out"}
          </button>
          <span className="sr-only" role="status" aria-live="polite">{isSigningOut ? "Signing out" : ""}</span>
        </div>
      </header>

      <div className="mm-dashboard-main mm-frame">
        <section className="mm-dashboard-intro" aria-labelledby="dashboard-title">
          <p className="mm-eyebrow mm-eyebrow--moss">Your private archive</p>
          <h1 id="dashboard-title">{isGuest ? "Welcome, Guest." : `Welcome back, ${getFirstName(user.displayName, user.email)}.`}</h1>
          <p>{isGuest ? "Explore your temporary campus and see how MemoryMap works." : "Your private campuses and shared memories live here."}</p>
          <span>Build new campuses, revisit shared places and continue preserving memories.</span>
        </section>

        {isGuest && <section className="mm-guest-banner" aria-label="Guest session limits"><strong>Guest session</strong><p>Your guest campus is saved in this browser session. Sign in with Google to keep it permanently and unlock images, invitations and shared campuses.</p><button type="button" className="mm-button mm-button--outline mm-button--small" onClick={() => setIsUpgradeOpen(true)}>Continue with Google</button></section>}

        <section className="mm-dashboard-summary" aria-label="Archive summary">
          {[['Campuses owned', ownedCount], ['Shared with you', sharedCount], ['Total rooms', totalRooms], ['Total memories', totalMemories]].map(([label, value]) => <div className="mm-dashboard-summary__item" key={String(label)}><span>{label}</span><strong>{mapsLoading ? "—" : value}</strong></div>)}
        </section>

        <section className="mm-dashboard-create" aria-labelledby="create-memorymap-title">
          <div className="mm-dashboard-create__copy">
            <p className="mm-eyebrow mm-eyebrow--ochre">Start with a place</p>
            <h2 id="create-memorymap-title">Create your MemoryMap</h2>
            <p>Build a private campus, add its familiar rooms and invite the people who shared those places with you.</p>
            <button type="button" className="mm-button mm-button--coral" onClick={openCreate}>Start building</button>
          </div>
          <CreateCampusPreview />
        </section>

        <section className="mm-dashboard-list" aria-labelledby="memorymaps-title">
          <div className="mm-dashboard-list__heading">
            <div>
              <p className="mm-eyebrow mm-eyebrow--moss">Your archive</p>
              <h2 id="memorymaps-title">Your campuses</h2>
              <p>Places you own and private campuses shared with you.</p>
            </div>
            {!mapsLoading && memoryMaps.length > 0 && <span className="mm-dashboard-list__count">{memoryMaps.length} {memoryMaps.length === 1 ? "campus" : "campuses"}</span>}
          </div>
          <div className="mm-dashboard-filters" role="tablist" aria-label="Campus filters">{([['all', 'All'], ['owned', 'Owned'], ['shared', 'Shared with you'], ['setup', 'Setup incomplete']] as const).map(([value, label]) => <button type="button" role="tab" key={value} aria-selected={campusFilter === value} onClick={() => setCampusFilter(value)}>{label}</button>)}</div>

          {ownedMapsError && <p className="mm-auth-message mm-auth-message--error" role="alert">Owned campuses could not be loaded. <button type="button" className="mm-dashboard-inline-retry" onClick={() => { setOwnedMapsLoading(true); setSharedMapsLoading(true); setOwnedMapsError(false); setSharedMapsError(false); setRetryCount((count) => count + 1); }}>Try again</button></p>}
          {sharedMapsError && <p className="mm-auth-message mm-auth-message--error" role="alert">Shared campuses could not be loaded. <button type="button" className="mm-dashboard-inline-retry" onClick={() => { setOwnedMapsLoading(true); setSharedMapsLoading(true); setOwnedMapsError(false); setSharedMapsError(false); setRetryCount((count) => count + 1); }}>Try again</button></p>}
          {deleteMessage && <p className="mm-auth-message" role="status" aria-live="polite">{deleteMessage}</p>}

          {mapsLoading && (
            <div className="mm-dashboard-list__loading" aria-busy="true">
              <span className="sr-only">Loading your MemoryMaps</span>
              <div className="mm-dashboard-map-skeleton" aria-hidden="true" />
              <div className="mm-dashboard-map-skeleton" aria-hidden="true" />
            </div>
          )}

          {!mapsLoading && ownedMapsError && sharedMapsError && (
            <div className="mm-dashboard-empty mm-dashboard-empty--error" role="alert">
              <div><h3>We could not load your MemoryMaps.</h3><p>Your account is still signed in. Try loading your campuses again.</p></div>
              <button type="button" className="mm-button mm-button--outline" onClick={() => { setOwnedMapsLoading(true); setSharedMapsLoading(true); setOwnedMapsError(false); setSharedMapsError(false); setRetryCount((count) => count + 1); }}>Try again</button>
            </div>
          )}

          {!mapsLoading && !ownedMapsError && !sharedMapsError && memoryMaps.length === 0 && (
            <div className="mm-dashboard-empty">
              <div className="mm-dashboard-empty__copy">
                <p className="mm-eyebrow mm-eyebrow--ochre">A blank place to begin</p>
                <h3>No MemoryMaps yet.</h3>
                <p>Create your first private campus and begin saving the places your group will want to revisit later.</p>
                <button type="button" className="mm-button mm-button--coral" onClick={openCreate}>Create your first MemoryMap</button>
              </div>
              <EmptyCampusIllustration />
            </div>
          )}

          {!mapsLoading && memoryMaps.length > 0 && (
            <div className="mm-dashboard-map-grid">
              {visibleMaps.map((memoryMap, index) => {
                const isOwner = memoryMap.accessRole === "owner" || memoryMap.ownerId === user.uid;
                const campusHref = `/memorymaps/${memoryMap.id}${isOwner && memoryMap.status === "setup" ? "/setup" : ""}`;
                console.log("Campus card role", {
                  campusId: memoryMap.id,
                  accessRole: memoryMap.accessRole,
                  ownerId: memoryMap.ownerId,
                  currentUserId: user?.uid,
                });
                return (
                  <article className="mm-dashboard-map-card" key={memoryMap.id}>
                    <div className="mm-dashboard-map-card__heading">
                      <Link className="mm-dashboard-map-card__link mm-dashboard-map-card__link--heading" href={campusHref}>
                        <div><h3>{memoryMap.name}</h3>{memoryMap.schoolName && <p>{memoryMap.schoolName}</p>}{memoryMap.isShared && <p>Owner: {memoryMap.ownerName || "MemoryMap owner"}</p>}</div>
                      </Link>
                      <div className="mm-dashboard-map-card__heading-actions">
                        <span className="mm-dashboard-private">{isOwner ? "Owner" : "Shared with you"}</span>
                        {isOwner && (
                          <div className="mm-dashboard-card-menu">
                            <button
                              type="button"
                              className="mm-dashboard-card-menu__trigger"
                              aria-label="Campus actions"
                              aria-haspopup="menu"
                              aria-expanded={openMenuId === memoryMap.id}
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                setOpenMenuId((current) => current === memoryMap.id ? null : memoryMap.id);
                              }}
                            >
                              <span className="mm-dashboard-card-menu__dots" aria-hidden="true">{"\u22ee"}</span>
                            </button>
                            {openMenuId === memoryMap.id && (
                              <div className="mm-dashboard-card-menu__dropdown" role="menu">
                                <Link role="menuitem" href={campusHref} onClick={() => setOpenMenuId(null)}>
                                  {memoryMap.status === "setup" ? "Continue setup" : "Open campus"}
                                </Link>
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    setDeleteMessage("");
                                    setDeleteCampus(memoryMap);
                                  }}
                                >
                                  Delete campus
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <Link className="mm-dashboard-map-card__link" href={campusHref}>
                      <MiniCampusPreview variant={index % 3} />
                      <div className="mm-dashboard-map-card__stats" aria-label={`${memoryMap.roomCount} rooms, ${memoryMap.memoryCount} memories, ${memoryMap.memberCount} members`}>
                        <span><b>{memoryMap.roomCount}</b> rooms</span>
                        <span><b>{memoryMap.memoryCount}</b> memories</span>
                        <span><b>{memoryMap.memberCount}</b> members</span>
                      </div>
                      <div className="mm-dashboard-map-card__footer"><span>{formatUpdatedDate(memoryMap.updatedAt)}</span><small>{memoryMap.status === "setup" ? "Continue setup" : "Open campus"}</small></div>
                    </Link>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {signOutError && <p className="mm-auth-message mm-auth-message--error mm-dashboard-signout-message" role="alert" aria-live="polite">{signOutError}</p>}
      </div>
      <CreateMemoryMapModal open={isCreateOpen} user={user} onClose={() => setIsCreateOpen(false)} />
      {isUpgradeOpen && <UpgradeModal onClose={() => setIsUpgradeOpen(false)} />}
      {deleteCampus && <DeleteCampusModal campusId={deleteCampus.id} campusName={deleteCampus.name} onClose={() => setDeleteCampus(null)} onDeleted={handleCampusDeleted} />}
    </main>
  );
}
