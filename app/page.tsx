import Link from "next/link";

const rooms = [
  {
    number: "ROOM 01",
    name: "Chemistry Lab",
    memories: 22,
  },
  {
    number: "ROOM 02",
    name: "Library",
    memories: 10,
  },
  {
    number: "ROOM 03",
    name: "Auditorium",
    memories: 19,
  },
  {
    number: "ROOM 04",
    name: "Sports Court",
    memories: 48,
  },
];

const steps = [
  {
    number: "01",
    title: "Build your campus",
    description:
      "Create the floors, rooms, courts, corridors and corners that made your school feel familiar.",
  },
  {
    number: "02",
    title: "Invite your people",
    description:
      "Share a private invite with selected friends, classmates or members of your school community.",
  },
  {
    number: "03",
    title: "Place every memory",
    description:
      "Add photographs, stories and funny incidents directly to the room where each moment happened.",
  },
];

const privacyPoints = [
  {
    title: "Private by default",
    description:
      "New campuses remain hidden and cannot be discovered publicly.",
  },
  {
    title: "Invite-only access",
    description:
      "Only people with your invitation can request or receive access.",
  },
  {
    title: "Separate memory spaces",
    description:
      "Every campus keeps its members, rooms and memories completely separate.",
  },
];

const stripItems = [
  "Chemistry practical",
  "Annual day backstage",
  "The library corner",
  "Sports day parade",
  "Lunch break stories",
  "Classroom chaos",
];

export default function HomePage() {
  return (
    <main className="memory-page">
      <header className="site-header">
        <div className="page-shell header-inner">
          <Link href="/" className="brand" aria-label="MemoryMap homepage">
            <span className="brand-mark">MM</span>
            <span className="brand-name">MemoryMap</span>
          </Link>

          <nav className="header-nav" aria-label="Main navigation">
            <a href="#idea">The idea</a>
            <a href="#how-it-works">How it works</a>
            <a href="#privacy">Privacy</a>
          </nav>

          <div className="header-actions">
            <Link href="/login" className="text-button">
              Log in
            </Link>

            <Link href="/login" className="primary-button">
              Create a campus
            </Link>
          </div>
        </div>
      </header>

      <section className="hero" id="idea">
        <div className="page-shell hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">A place-based memory archive</p>

            <h1 className="hero-title">
              You remember school by{" "}
              <span className="highlight-word">where</span> it happened.
            </h1>

            <p className="hero-description">
              Rebuild the places that shaped your school life, invite the
              people who shared them and preserve every story inside the room
              where it belongs.
            </p>

            <div className="hero-actions">
              <Link href="/login" className="primary-button">
                Create your MemoryMap
                <span aria-hidden="true">↗</span>
              </Link>

              <a href="#how-it-works" className="secondary-button">
                See how it works
              </a>
            </div>

            <div className="hero-note">
              <div className="note-avatars" aria-hidden="true">
                <span className="note-avatar">A</span>
                <span className="note-avatar">R</span>
                <span className="note-avatar">S</span>
              </div>

              <span>Made for private groups, friends and classmates.</span>
            </div>
          </div>

          <CampusPreview />
        </div>
      </section>

      <div className="memory-strip" aria-hidden="true">
        <div className="strip-track">
          {[...stripItems, ...stripItems].map((item, index) => (
            <span className="strip-item" key={`${item}-${index}`}>
              {item}
            </span>
          ))}
        </div>
      </div>

      <section className="story-section" id="how-it-works">
        <div className="page-shell">
          <div className="section-heading">
            <p className="section-label">How MemoryMap works</p>

            <h2 className="section-title">
              Not another photo album. A place you can return to.
            </h2>

            <p className="section-description">
              Instead of saving memories only by date, MemoryMap connects them
              to classrooms, laboratories, courts and corridors.
            </p>
          </div>

          <div className="steps-list">
            {steps.map((step) => (
              <article className="step-card" key={step.number}>
                <span className="step-number">{step.number}</span>

                <h3 className="step-title">{step.title}</h3>

                <p className="step-description">{step.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="private-section" id="privacy">
        <div className="page-shell">
          <div className="private-card">
            <div>
              <p className="section-label">Private means private</p>

              <h2 className="private-title">
                Your memories are not public content.
              </h2>

              <p className="private-description">
                MemoryMap is designed as a shared private archive rather than a
                social-media feed. You choose who enters and who contributes.
              </p>
            </div>

            <div className="private-list">
              {privacyPoints.map((point) => (
                <article className="private-item" key={point.title}>
                  <span className="private-check">✓</span>

                  <div>
                    <strong>{point.title}</strong>
                    <p>{point.description}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="final-section">
        <div className="page-shell">
          <p className="section-label">Start with one familiar place</p>

          <h2 className="final-title">
            Every classroom has a story worth keeping.
          </h2>

          <p className="final-copy">
            Create a private campus, name its rooms and begin saving the
            memories your group never wants to lose.
          </p>

          <Link href="/login" className="primary-button">
            Start building your map
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      <footer className="site-footer">
        <div className="page-shell footer-inner">
          <Link href="/" className="brand">
            <span className="brand-mark">MM</span>
            <span className="brand-name">MemoryMap</span>
          </Link>

          <p className="footer-line">Every place holds a memory.</p>

          <p className="footer-year">© 2026 MemoryMap</p>
        </div>
      </footer>
    </main>
  );
}

function CampusPreview() {
  return (
    <div className="campus-wrap">
      <svg
        className="doodle-arrow"
        viewBox="0 0 120 120"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M14 21C73 16 95 50 83 90"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="6 7"
        />

        <path
          d="M70 78L83 92L94 76"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      <div className="campus-board">
        <div className="board-top">
          <div>
            <p className="board-kicker">Our Campus</p>
            <h2 className="board-title">Ground Floor</h2>
          </div>

          <span className="board-count">267 memories</span>
        </div>

        <div className="room-grid">
          {rooms.slice(0, 2).map((room) => (
            <RoomCard key={room.name} room={room} />
          ))}

          <div className="corridor">
            <span>Main corridor</span>
          </div>

          {rooms.slice(2).map((room) => (
            <RoomCard key={room.name} room={room} />
          ))}
        </div>

        <div className="board-footer">
          <span className="map-key">
            <span className="map-key-dot" />
            Private campus
          </span>

          <span>Click a room to enter</span>
        </div>
      </div>

      <aside className="memory-sticker">
        <span className="sticker-label">Latest memory</span>

        <p className="sticker-title">The test tube incident</p>

        <p className="sticker-meta">
          Chemistry Lab
          <br />
          16 July 2026 · 17 reactions
        </p>
      </aside>
    </div>
  );
}

type Room = {
  number: string;
  name: string;
  memories: number;
};

function RoomCard({ room }: { room: Room }) {
  return (
    <button className="room-card" type="button">
      <span className="room-top">

        <span className="room-number">{room.number}</span>
      </span>

      <span className="room-name">{room.name}</span>

      <span className="room-memory-count">
        {room.memories} memories inside
      </span>

      <span className="room-arrow" aria-hidden="true">
        →
      </span>
    </button>
  );
}