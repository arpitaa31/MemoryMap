import Link from "next/link";

type Room = {
  name: string;
  code: string;
  memories: number;
  area: string;
};

type Memory = {
  date: string;
  title: string;
  description: string;
  meta: string;
};

const floorNavigation = [
  "Ground Floor",
  "First Floor",
  "Second Floor",
  "Sports Area",
];

const rooms: Room[] = [
  { name: "Chemistry Lab", code: "CH", memories: 72, area: "chemistry" },
  { name: "Physics Lab", code: "PH", memories: 48, area: "physics" },
  { name: "Library", code: "LB", memories: 108, area: "library" },
  { name: "Reception", code: "RC", memories: 24, area: "reception" },
];

const heroMemories: Memory[] = [
  {
    date: "16 JUL 2026",
    title: "The test tube incident",
    description: "Churu somehow managed to break another test tube during practical.",
    meta: "4 comments · 8 reactions",
  },
  {
    date: "04 MAR 2026",
    title: "The last practical",
    description: "Everyone suddenly remembered the salt analysis procedure.",
    meta: "2 comments · 5 reactions",
  },
];

const walkthroughMemories: Memory[] = [
  {
    date: "16 July 2026",
    title: "The test tube incident",
    description: "Churu somehow managed to break another test tube during practical.",
    meta: "4 comments · 8 reactions",
  },
  {
    date: "Teacher’s Day",
    title: "The microphone that stopped working",
    description: "Decorations, rehearsals and one very determined announcer.",
    meta: "6 comments · 12 reactions",
  },
  {
    date: "Practical Exam",
    title: "Salt analysis, eventually",
    description: "Everyone suddenly forgot the salt analysis procedure.",
    meta: "3 comments · 9 reactions",
  },
];

const steps = [
  {
    number: "01",
    title: "Create your campus",
    description: "Add floors, areas and familiar spaces.",
  },
  {
    number: "02",
    title: "Invite your people",
    description: "Share private access with selected members.",
  },
  {
    number: "03",
    title: "Save memories by place",
    description: "Attach every story to the room where it happened.",
  },
];

export function MemoryMapLogo({ size = 44 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      className="memorymap-logo"
      width={size}
      height={size}
      viewBox="0 0 44 44"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      focusable="false"
    >
      <path
        d="M5.5 32V11L14 19.5L22 11V32"
        stroke="currentColor"
        strokeWidth="3.1"
        strokeLinecap="square"
        strokeLinejoin="round"
      />
      <path
        d="M22 32V11L30.5 19.5L38.5 11V32"
        stroke="var(--amber)"
        strokeWidth="3.1"
        strokeLinecap="square"
        strokeLinejoin="round"
      />
      <circle cx="22" cy="11" r="3.25" fill="var(--blue)" stroke="var(--surface)" strokeWidth="1.5" />
    </svg>
  );
}

function Header() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link href="/" className="brand" aria-label="MemoryMap home">
          <MemoryMapLogo />
          <span>MemoryMap</span>
        </Link>

        <nav className="site-nav" aria-label="Primary navigation">
          <a href="#product">Product</a>
          <a href="#how-it-works">How it works</a>
          <a href="#privacy">Privacy</a>
          <a href="#demo">Demo</a>
        </nav>

        <div className="site-header__actions">
          <Link href="/login" className="text-link">
            Log in
          </Link>
          <Link href="/login" className="button button--small button--blue">
            Create a map
          </Link>
        </div>
      </div>
    </header>
  );
}

function RoomCard({ room, active = false }: { room: Room; active?: boolean }) {
  return (
    <button
      type="button"
      className={`room-card room-card--${room.area}${active ? " room-card--active" : ""}`}
      aria-label={`${room.name}, ${room.memories} memories`}
      aria-pressed={active}
    >
      <span className="room-card__topline">
        <span className="room-card__code">{room.code}</span>
        <span className="room-card__count">{room.memories}</span>
      </span>
      <span className="room-card__name">{room.name}</span>
      <span className="room-card__meta">{room.memories} memories</span>
    </button>
  );
}

function MemoryEntry({ memory }: { memory: Memory }) {
  return (
    <article className="memory-entry">
      <p className="memory-entry__date">{memory.date}</p>
      <h4>{memory.title}</h4>
      <p className="memory-entry__description">{memory.description}</p>
      <p className="memory-entry__meta">{memory.meta}</p>
    </article>
  );
}

function CampusSidebar({ walkthrough = false }: { walkthrough?: boolean }) {
  return (
    <aside className="campus-sidebar" aria-label="Campus navigation">
      <div className="campus-sidebar__heading">
        <span className="eyebrow">Campus</span>
        <span className="campus-sidebar__dot" aria-hidden="true" />
      </div>
      <div className="floor-list">
        {floorNavigation.map((floor, index) => (
          <button
            type="button"
            className={`floor-link${index === 0 ? " floor-link--active" : ""}`}
            key={floor}
          >
            <span>{floor}</span>
            {index === 0 && <span className="floor-link__marker" aria-hidden="true" />}
          </button>
        ))}
      </div>
      <div className="campus-sidebar__bottom">
        <button type="button" className="sidebar-link">
          <span className="sidebar-link__icon" aria-hidden="true">+</span>
          Members <span className="sidebar-link__count">14</span>
        </button>
        <button type="button" className="sidebar-link">
          <span className="sidebar-link__icon sidebar-link__icon--settings" aria-hidden="true" />
          Settings
        </button>
        {walkthrough && <span className="sidebar-note">Last edited today</span>}
      </div>
    </aside>
  );
}

function AppTopbar({ walkthrough = false }: { walkthrough?: boolean }) {
  return (
    <div className="app-topbar">
      <div className="app-topbar__brand">
        <span className="app-topbar__campus">APS Memories</span>
        <span className="status-label"><span aria-hidden="true" /> Private</span>
      </div>
      <div className="app-topbar__actions">
        <span className="search-label" aria-label="Search memories">
          <span className="search-icon" aria-hidden="true" />
          <span className="search-label__text">Search</span>
        </span>
        <button type="button" className="app-action-button">
          {walkthrough ? "New memory" : "Add memory"}
        </button>
      </div>
    </div>
  );
}

function CampusMap({ walkthrough = false }: { walkthrough?: boolean }) {
  return (
    <div className={`campus-map${walkthrough ? " campus-map--walkthrough" : ""}`}>
      <div className="campus-map__heading">
        <div>
          <span className="eyebrow">APS Memories / Ground Floor</span>
          <h3>Ground Floor</h3>
        </div>
        <span className="map-total">267 memories</span>
      </div>

      <div className="floor-tabs" aria-label="Floor selection">
        {floorNavigation.map((floor, index) => (
          <button type="button" className={index === 0 ? "floor-tab floor-tab--active" : "floor-tab"} key={floor}>
            {floor.replace(" Floor", "")}
          </button>
        ))}
      </div>

      <div className="map-canvas" aria-label="Ground Floor room map">
        <span className="map-axis map-axis--horizontal" aria-hidden="true" />
        <span className="map-axis map-axis--vertical" aria-hidden="true" />
        <span className="map-canvas__north" aria-hidden="true">N</span>
        <span className="map-canvas__corridor-label">Main corridor</span>
        {rooms.map((room, index) => (
          <RoomCard key={room.name} room={room} active={index === 0} />
        ))}
        <div className="map-entrance"><span aria-hidden="true" /> Entrance</div>
      </div>
    </div>
  );
}

function MemoryPanel({ walkthrough = false }: { walkthrough?: boolean }) {
  const memories = walkthrough ? walkthroughMemories : heroMemories;

  return (
    <aside className={`memory-panel${walkthrough ? " memory-panel--timeline" : ""}`} aria-label="Chemistry Lab memories">
      <div className="memory-panel__header">
        <div>
          <span className="eyebrow">Selected room</span>
          <h3>Chemistry Lab</h3>
        </div>
        <span className="memory-panel__total">72 memories</span>
      </div>
      <div className="memory-tabs" role="tablist" aria-label="Memory types">
        <button type="button" className="memory-tab memory-tab--active" role="tab" aria-selected="true">All</button>
        <button type="button" className="memory-tab" role="tab" aria-selected="false">Photos</button>
        <button type="button" className="memory-tab" role="tab" aria-selected="false">Stories</button>
      </div>
      <div className="memory-list">
        {memories.map((memory) => <MemoryEntry key={`${memory.date}-${memory.title}`} memory={memory} />)}
      </div>
      {walkthrough && <button type="button" className="memory-panel__link">View all memories <span aria-hidden="true">↗</span></button>}
    </aside>
  );
}

function CampusAppPreview({ variant = "hero" }: { variant?: "hero" | "walkthrough" }) {
  const walkthrough = variant === "walkthrough";

  return (
    <div className={`app-shell app-shell--${variant}`}>
      <AppTopbar walkthrough={walkthrough} />
      <div className="app-shell__body">
        <CampusSidebar walkthrough={walkthrough} />
        <CampusMap walkthrough={walkthrough} />
        <MemoryPanel walkthrough={walkthrough} />
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="hero section-frame" aria-labelledby="hero-title">
      <div className="hero__copy">
        <p className="eyebrow eyebrow--blue">Memories, organised by place</p>
        <h1 id="hero-title">Return to the places where your stories happened.</h1>
        <p className="hero__description">
          Create a private map of your school, add its familiar rooms, and preserve memories with the people who shared them.
        </p>
        <div className="hero__actions">
          <Link href="/login" className="button button--blue">Create your MemoryMap</Link>
          <a href="#demo" className="button button--outline">View demo</a>
        </div>
        <p className="trust-line">Private by default <span>·</span> Invite-only access <span>·</span> Separate campus archives</p>
      </div>
      <div id="demo" className="hero__preview anchor-target">
        <CampusAppPreview />
      </div>
    </section>
  );
}

function CoreStatement() {
  return (
    <section className="core-statement section-frame" aria-label="MemoryMap statement">
      <div className="statement-rule" />
      <p>Most apps remember when something happened.</p>
      <h2>MemoryMap remembers where.</h2>
    </section>
  );
}

function ProductSection() {
  return (
    <section id="product" className="product-section section-frame anchor-target" aria-labelledby="product-title">
      <div className="section-intro">
        <p className="eyebrow eyebrow--blue">The product</p>
        <h2 id="product-title">Walk through the campus.<br />Open the room. Find the story.</h2>
      </div>
      <CampusAppPreview variant="walkthrough" />
      <p className="interface-caption">The map stays visible while memories open beside it, so every story remains connected to its place.</p>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how-it-works" className="how-section section-frame anchor-target" aria-labelledby="how-title">
      <div className="section-intro section-intro--compact">
        <p className="eyebrow eyebrow--blue">How it works</p>
        <h2 id="how-title">Build one place at a time.</h2>
      </div>
      <div className="steps-list">
        {steps.map((step) => (
          <article className="step" key={step.number}>
            <span className="step__number">{step.number}</span>
            <div>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function PrivacySection() {
  return (
    <section id="privacy" className="privacy-section section-frame anchor-target" aria-labelledby="privacy-title">
      <div className="privacy-copy">
        <p className="eyebrow eyebrow--blue">Private from the beginning</p>
        <h2 id="privacy-title">Your memories are not public content.</h2>
        <p>Each campus has its own members, rooms and memories. Only invited people can enter, contribute or explore the archive.</p>
        <ul className="privacy-checklist">
          <li>Hidden from public discovery</li>
          <li>Invite-only membership</li>
          <li>Separate data for every campus</li>
          <li>Owners control rooms and members</li>
        </ul>
      </div>
      <div className="access-panel" aria-label="APS Memories private campus settings">
        <div className="access-panel__top">
          <div>
            <span className="eyebrow">APS Memories</span>
            <h3>Private campus</h3>
          </div>
          <span className="lock-mark" aria-hidden="true">●</span>
        </div>
        <div className="access-stats">
          <div><strong>14</strong><span>members</span></div>
          <div><strong>267</strong><span>memories</span></div>
          <div><strong>12</strong><span>rooms</span></div>
        </div>
        <div className="invite-code">
          <span>Invite code</span>
          <strong>APS-27-K9PX</strong>
        </div>
        <div className="access-panel__actions">
          <button type="button" className="button button--outline">Copy invitation</button>
          <button type="button" className="button button--blue">Manage members</button>
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="final-cta section-frame" aria-labelledby="cta-title">
      <MemoryMapLogo size={80} />
      <p className="eyebrow eyebrow--blue">Keep the place close</p>
      <h2 id="cta-title">The building may change.<br />The stories do not have to disappear.</h2>
      <p>Create your first private campus and begin preserving the places your group will want to revisit years from now.</p>
      <Link href="/login" className="button button--blue">Create your first map</Link>
    </section>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <Link href="/" className="brand brand--footer" aria-label="MemoryMap home">
          <MemoryMapLogo size={36} />
          <span>MemoryMap</span>
        </Link>
        <nav className="footer-nav" aria-label="Footer navigation">
          <a href="#product">Product</a>
          <a href="#privacy">Privacy</a>
          <Link href="/login">Log in</Link>
        </nav>
        <p className="footer-tagline">Every place holds a memory.</p>
        <p className="footer-copyright">© 2026 MemoryMap</p>
      </div>
    </footer>
  );
}

export default function HomePage() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <CoreStatement />
        <ProductSection />
        <HowItWorks />
        <PrivacySection />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
