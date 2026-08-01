"use client";

import { collection, getDocs, query, Timestamp, where } from "firebase/firestore";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import CreateMemoryMapModal from "../../components/CreateMemoryMapModal";
import MemoryMapLogo from "../components/MemoryMapLogo";
import MemoryMapWordmark from "../components/MemoryMapWordmark";
import DashboardDecorations from "./components/DashboardDecorations";
import { useAuth } from "../providers/AuthProvider";
import { assertFirebaseConfig, auth, db } from "../../lib/firebase/client";
import { signOut } from "firebase/auth";

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
  const [mapsLoading, setMapsLoading] = useState(true);
  const [mapsError, setMapsError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login?next=/dashboard");
    }
  }, [loading, router, user]);

  useEffect(() => {
    if (loading || !user) return;

    let cancelled = false;

    const loadMemoryMaps = async () => {
      try {
        assertFirebaseConfig();
        if (!db) throw new Error("Firestore is unavailable.");
        const memoryMapsQuery = query(collection(db, "memoryMaps"), where("ownerId", "==", user.uid));
        const snapshot = await getDocs(memoryMapsQuery);
        if (cancelled) return;

        const nextMaps = snapshot.docs.map((document) => {
          const data = document.data() as Record<string, unknown>;
          return {
            id: document.id,
            name: typeof data.name === "string" && data.name.trim() ? data.name : "Untitled MemoryMap",
            schoolName: typeof data.schoolName === "string" ? data.schoolName : undefined,
            ownerId: user.uid,
            privacy: "private" as const,
            roomCount: countOrDefault(data.roomCount, 0),
            memoryCount: countOrDefault(data.memoryCount, 0),
            memberCount: countOrDefault(data.memberCount, 1),
            status: data.status === "active" ? "active" as const : "setup" as const,
            createdAt: timestampOrUndefined(data.createdAt),
            updatedAt: timestampOrUndefined(data.updatedAt),
          } satisfies MemoryMapSummary;
        });

        nextMaps.sort((a, b) => (b.updatedAt?.toMillis() ?? 0) - (a.updatedAt?.toMillis() ?? 0));
        setMemoryMaps(nextMaps);
      } catch {
        if (!cancelled) setMapsError(true);
      } finally {
        if (!cancelled) setMapsLoading(false);
      }
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

  if (loading) return <DashboardLoadingState message="Checking your session…" />;
  if (!user) return <DashboardLoadingState message="Redirecting to sign in…" />;

  const displayName = user.displayName || "MemoryMap member";
  const initials = getInitials(user.displayName, user.email);
  const userHasVisibleName = Boolean(user.displayName || user.email);

  return (
    <main className="mm-dashboard-page">
      <header className="mm-dashboard-header">
        <Link href="/" className="mm-brand mm-dashboard-header__brand" aria-label="MemoryMap home">
          <MemoryMapLogo size={30} variant="dark" />
          <MemoryMapWordmark />
        </Link>
        <nav className="mm-dashboard-nav" aria-label="Dashboard navigation">
          <Link href="/dashboard" aria-current="page">Home</Link>
          <a href="#memorymaps-title">Your MemoryMaps</a>
        </nav>
        <div className="mm-dashboard-user">
          {user.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="mm-dashboard-user__photo" src={user.photoURL} alt={`${displayName} profile`} referrerPolicy="no-referrer" />
          ) : (
            <span className="mm-dashboard-user__initials" aria-hidden={userHasVisibleName}>{initials}</span>
          )}
          <div className="mm-dashboard-user__details">
            <strong>{displayName}</strong>
            {user.email && <span>{user.email}</span>}
          </div>
          <button type="button" className="mm-dashboard-signout" onClick={handleSignOut} disabled={isSigningOut} aria-busy={isSigningOut} aria-label={isSigningOut ? "Signing out" : "Sign out"}>
            {isSigningOut ? "Signing out…" : "Sign out"}
          </button>
          <span className="sr-only" role="status" aria-live="polite">{isSigningOut ? "Signing out" : ""}</span>
        </div>
      </header>

      <DashboardDecorations />
      <div className="mm-dashboard-main mm-frame">
        <section className="mm-dashboard-intro" aria-labelledby="dashboard-title">
          <p className="mm-eyebrow mm-eyebrow--moss">Your private archive</p>
          <h1 id="dashboard-title">Welcome back, {getFirstName(user.displayName, user.email)}.</h1>
          <p>Your private campuses and shared memories live here.</p>
          <span>Start a new campus or return to one you have already created.</span>
        </section>

        <section className="mm-dashboard-create" aria-labelledby="create-memorymap-title">
          <div className="mm-dashboard-create__copy">
            <p className="mm-eyebrow mm-eyebrow--ochre">Start with a place</p>
            <h2 id="create-memorymap-title">Create your MemoryMap</h2>
            <p>Build a private campus, add its familiar rooms and invite the people who shared those places with you.</p>
            <button type="button" className="mm-button mm-button--coral" onClick={() => setIsCreateOpen(true)}>Create your MemoryMap</button>
          </div>
          <CreateCampusPreview />
        </section>

        <section className="mm-dashboard-list" aria-labelledby="memorymaps-title">
          <div className="mm-dashboard-list__heading">
            <div>
              <p className="mm-eyebrow mm-eyebrow--moss">Your archive</p>
              <h2 id="memorymaps-title">Your MemoryMaps</h2>
              <p>Campuses you create will remain private unless you invite other members.</p>
            </div>
            {!mapsLoading && !mapsError && memoryMaps.length > 0 && <span className="mm-dashboard-list__count">{memoryMaps.length} {memoryMaps.length === 1 ? "campus" : "campuses"}</span>}
          </div>

          {mapsLoading && (
            <div className="mm-dashboard-list__loading" aria-busy="true">
              <span className="sr-only">Loading your MemoryMaps</span>
              <div className="mm-dashboard-map-skeleton" aria-hidden="true" />
              <div className="mm-dashboard-map-skeleton" aria-hidden="true" />
            </div>
          )}

          {!mapsLoading && mapsError && (
            <div className="mm-dashboard-empty mm-dashboard-empty--error" role="alert">
              <div><h3>We could not load your MemoryMaps.</h3><p>Your account is still signed in. Try loading your campuses again.</p></div>
              <button type="button" className="mm-button mm-button--outline" onClick={() => { setMapsLoading(true); setMapsError(false); setRetryCount((count) => count + 1); }}>Try again</button>
            </div>
          )}

          {!mapsLoading && !mapsError && memoryMaps.length === 0 && (
            <div className="mm-dashboard-empty">
              <div className="mm-dashboard-empty__copy">
                <p className="mm-eyebrow mm-eyebrow--ochre">A blank place to begin</p>
                <h3>No MemoryMaps yet.</h3>
                <p>Create your first private campus and begin saving the places your group will want to revisit later.</p>
                <button type="button" className="mm-button mm-button--coral" onClick={() => setIsCreateOpen(true)}>Create your first MemoryMap</button>
              </div>
              <EmptyCampusIllustration />
            </div>
          )}

          {!mapsLoading && !mapsError && memoryMaps.length > 0 && (
            <div className="mm-dashboard-map-grid">
              {memoryMaps.map((memoryMap, index) => (
                <Link className="mm-dashboard-map-card" key={memoryMap.id} href={`/memorymaps/${memoryMap.id}${memoryMap.status === "setup" ? "/setup" : ""}`}>
                  <div className="mm-dashboard-map-card__heading">
                    <div><h3>{memoryMap.name}</h3>{memoryMap.schoolName && <p>{memoryMap.schoolName}</p>}</div>
                    <span className="mm-dashboard-private">{memoryMap.status === "setup" ? "Setup incomplete" : "Private campus"}</span>
                  </div>
                  <MiniCampusPreview variant={index % 3} />
                  <div className="mm-dashboard-map-card__stats" aria-label={`${memoryMap.roomCount} rooms, ${memoryMap.memoryCount} memories, ${memoryMap.memberCount} members`}>
                    <span><b>{memoryMap.roomCount}</b> rooms</span>
                    <span><b>{memoryMap.memoryCount}</b> memories</span>
                    <span><b>{memoryMap.memberCount}</b> members</span>
                  </div>
                  <div className="mm-dashboard-map-card__footer"><span>{formatUpdatedDate(memoryMap.updatedAt)}</span><small>{memoryMap.status === "setup" ? "Continue setup" : "Open campus"}</small></div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {signOutError && <p className="mm-auth-message mm-auth-message--error mm-dashboard-signout-message" role="alert" aria-live="polite">{signOutError}</p>}
      </div>
      <CreateMemoryMapModal open={isCreateOpen} user={user} onClose={() => setIsCreateOpen(false)} />
    </main>
  );
}
