"use client";

import { collection, getDocs, query, Timestamp, where } from "firebase/firestore";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MemoryMapLogo from "../components/MemoryMapLogo";
import MemoryMapWordmark from "../components/MemoryMapWordmark";
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

export function DashboardLoadingState({ message }: { message: string }) {
  return (
    <main className="mm-dashboard-page" aria-busy="true">
      <div className="mm-dashboard-loading" role="status" aria-live="polite">
        <span className="mm-eyebrow mm-eyebrow--moss">MemoryMap</span>
        <p>{message}</p>
        <div className="mm-dashboard-loading__skeletons" aria-hidden="true">
          <span />
          <span />
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
  const [createMessage, setCreateMessage] = useState("");
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

  const showCreateMessage = useCallback(() => {
    setCreateMessage("The campus creation flow is coming next.");
  }, []);

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
        <div className="mm-dashboard-user">
          {user.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="mm-dashboard-user__photo" src={user.photoURL} alt={`${displayName} profile`} />
          ) : (
            <span className="mm-dashboard-user__initials" aria-hidden={userHasVisibleName}>{initials}</span>
          )}
          <div className="mm-dashboard-user__details">
            <strong>{displayName}</strong>
            {user.email && <span>{user.email}</span>}
          </div>
          <button type="button" className="mm-dashboard-signout" onClick={handleSignOut} disabled={isSigningOut}>
            {isSigningOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </header>

      <div className="mm-dashboard-main mm-frame">
        <section className="mm-dashboard-intro" aria-labelledby="dashboard-title">
          <p className="mm-eyebrow mm-eyebrow--moss">Your private archive</p>
          <h1 id="dashboard-title">Welcome back, {getFirstName(user.displayName, user.email)}.</h1>
          <p>Your private campuses and shared memories will appear here.</p>
        </section>

        <section className="mm-dashboard-create" aria-labelledby="create-memorymap-title">
          <div>
            <p className="mm-eyebrow mm-eyebrow--ochre">Start with a place</p>
            <h2 id="create-memorymap-title">Create your MemoryMap</h2>
            <p>Build a private campus, add its familiar rooms and invite the people who shared those places with you.</p>
          </div>
          <div className="mm-dashboard-create__action">
            <button type="button" className="mm-button mm-button--coral" onClick={showCreateMessage}>Create your MemoryMap</button>
            {createMessage && <p className="mm-auth-message" role="status" aria-live="polite">{createMessage}</p>}
          </div>
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
              <h3>We could not load your MemoryMaps.</h3>
              <button type="button" className="mm-button mm-button--outline" onClick={() => { setMapsLoading(true); setMapsError(false); setRetryCount((count) => count + 1); }}>Retry</button>
            </div>
          )}

          {!mapsLoading && !mapsError && memoryMaps.length === 0 && (
            <div className="mm-dashboard-empty">
              <span className="mm-dashboard-empty__mark" aria-hidden="true">+</span>
              <h3>No MemoryMaps yet.</h3>
              <p>Create your first private campus and begin adding the places your group remembers.</p>
              <button type="button" className="mm-button mm-button--coral" onClick={showCreateMessage}>Create your MemoryMap</button>
              {createMessage && <p className="mm-auth-message" role="status" aria-live="polite">{createMessage}</p>}
            </div>
          )}

          {!mapsLoading && !mapsError && memoryMaps.length > 0 && (
            <div className="mm-dashboard-map-list">
              {memoryMaps.map((memoryMap) => (
                <article className="mm-dashboard-map-row" key={memoryMap.id}>
                  <div className="mm-dashboard-map-row__title">
                    <span className="mm-dashboard-map-row__marker" aria-hidden="true" />
                    <div>
                      <h3>{memoryMap.name}</h3>
                      {memoryMap.schoolName && <p>{memoryMap.schoolName}</p>}
                    </div>
                  </div>
                  <span className="mm-dashboard-private">Private</span>
                  <div className="mm-dashboard-map-row__stats" aria-label={`${memoryMap.roomCount} rooms, ${memoryMap.memoryCount} memories, ${memoryMap.memberCount} members`}>
                    <span>{memoryMap.roomCount} rooms</span>
                    <span>{memoryMap.memoryCount} memories</span>
                    <span>{memoryMap.memberCount} members</span>
                  </div>
                  <div className="mm-dashboard-map-row__updated">
                    <span>{formatUpdatedDate(memoryMap.updatedAt)}</span>
                    <small>Campus view coming next</small>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {signOutError && <p className="mm-auth-message mm-auth-message--error mm-dashboard-signout-message" role="alert" aria-live="polite">{signOutError}</p>}
      </div>
    </main>
  );
}
