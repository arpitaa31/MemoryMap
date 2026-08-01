import type { Metadata } from "next";
import Link from "next/link";
import BrandIntro from "./components/BrandIntro";
import Footer from "./components/Footer";
import Header from "./components/Header";
import HomeCampusDemo from "./components/HomeCampusDemo";
import MemoryMapLogo from "./components/MemoryMapLogo";
import MemoryMapWordmark from "./components/MemoryMapWordmark";
import Reveal from "./components/Reveal";
import ScrollProgress from "./components/ScrollProgress";

export const metadata: Metadata = {
  title: "MemoryMap - Build the campus. Keep the stories.",
  description: "A private map for the rooms, people and stories you still talk about.",
};

const workflow = [
  { number: "01", title: "Give the place a name", description: "Start with the campus your group still carries around." },
  { number: "02", title: "Add the rooms you remember", description: "Bring in the floors, courts and corners people still mention." },
  { number: "03", title: "Invite the people who were there", description: "Share it with classmates, teammates and friends who know the stories." },
  { number: "04", title: "Leave each memory where it happened", description: "Add a photo, a story or the small detail you nearly forgot." },
];

function HeroIntro() {
  return (
    <section className="mm-home-intro" aria-labelledby="hero-title">
      <p className="mm-eyebrow mm-eyebrow--moss">A private archive for the places you remember</p>
      <Reveal variant="mask" delay={70} as="h1" id="hero-title">Keep the places.<br />Keep the stories.</Reveal>
      <p className="mm-home-intro__copy">Map the classrooms, courts and corridors you still talk about. Invite the people who were there, then leave each story in the room where it belongs.</p>
      <div className="mm-home-intro__actions"><Link href="/login" className="mm-button mm-button--coral">Make your MemoryMap <span aria-hidden="true">→</span></Link><a href="#demo" className="mm-button mm-button--outline">See how it works <span aria-hidden="true">↓</span></a></div>
      <p className="mm-home-intro__trust">Private from the start <span>·</span> Only invited people <span>·</span> One campus at a time</p>
    </section>
  );
}

function CoreExplanation() {
  return (
    <section id="product" className="mm-core-explanation mm-place-statement mm-frame mm-anchor" aria-labelledby="core-title">
      <div className="mm-core-explanation__heading"><p>Most galleries tell you when something happened.</p><h2 id="core-title">MemoryMap helps you remember where.</h2></div>
      <div className="mm-date-place"><div className="mm-date-place__item"><span>16 July 2026</span><strong>might mean nothing on its own.</strong></div><span className="mm-date-place__line" aria-hidden="true" /><div className="mm-date-place__item mm-date-place__item--place"><span>Chemistry Lab</span><strong>brings the whole story back.</strong></div></div>
    </section>
  );
}

function WorkflowSection() {
  return (
    <section id="how-it-works" className="mm-workflow mm-frame mm-anchor" aria-labelledby="workflow-title">
      <Reveal variant="mask" className="mm-workflow__intro"><p className="mm-eyebrow mm-eyebrow--moss">A simple way in</p><h2 id="workflow-title">Start with a place you know.</h2></Reveal>
      <div className="mm-workflow__rows">{workflow.map((step) => <article key={step.number} className="mm-workflow__row"><span className="mm-workflow__number">{step.number}</span><h3>{step.title}</h3><p>{step.description}</p><span className="mm-workflow__arrow" aria-hidden="true">↗</span></article>)}</div>
    </section>
  );
}

function PrivacySection() {
  return (
    <section id="privacy" className="mm-privacy mm-frame mm-anchor" aria-labelledby="privacy-title">
      <div className="mm-privacy__copy">
        <Reveal variant="mask" className="mm-section-intro"><p className="mm-eyebrow mm-eyebrow--moss">For the people who were there</p><h2 id="privacy-title">Only the people you invite get in.</h2></Reveal>
        <p>Your campus is private from the start. Keep the rooms and memories for your group, and decide who gets to add to them.</p>
        <ul className="mm-privacy-list"><li>Nothing public by accident</li><li>You choose who comes in</li><li>Each campus stays separate</li><li>People add their own memories</li><li>Demo content is fictional</li></ul>
      </div>
      <Reveal variant="scale-soft" className="mm-member-panel" aria-label="ABC School private campus settings">
        <div className="mm-member-panel__heading"><div><span className="mm-eyebrow">ABC School</span><h3>Private campus</h3></div><span className="mm-member-panel__status"><i aria-hidden="true" /> Private</span></div>
        <div className="mm-member-panel__members"><span>Members</span><strong>14 active</strong></div>
        <div className="mm-owner"><span className="mm-member-avatar">AS</span><div><strong>Aarav Sharma</strong><small>Owner</small></div><span className="mm-owner-mark">Owner</span></div>
        <div className="mm-invite-code"><span>Invite code</span><strong>NORTH-27-K9PX</strong></div>
        <p className="mm-invite-note">Anyone with this code can request access.</p>
        <div className="mm-member-list"><span className="mm-member-avatar">AS</span><span className="mm-member-avatar">RK</span><span className="mm-member-avatar">MP</span><span className="mm-member-more">+11 more</span></div>
        <div className="mm-access-actions"><button type="button" className="mm-button mm-button--outline">Copy invitation</button><button type="button" className="mm-button mm-button--coral">Manage members</button></div>
      </Reveal>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="mm-final-cta" aria-labelledby="cta-title"><div className="mm-final-cta__inner mm-frame"><Reveal variant="scale-soft"><div className="mm-final-cta__brand"><MemoryMapLogo size={46} variant="light" /><MemoryMapWordmark className="mm-final-cta__logo" /></div><h2 id="cta-title">The building changes.<br />The stories stay.</h2><p>Start with one campus, invite your people and save the rooms you will want to find again someday.</p><div className="mm-final-cta__actions"><Link href="/login" className="mm-button mm-button--light">Start a campus <span aria-hidden="true">→</span></Link><a href="#demo" className="mm-button mm-button--dark-outline">Take a look <span aria-hidden="true">↓</span></a></div></Reveal></div></section>
  );
}

export default function HomePage() {
  return (
    <>
      <BrandIntro />
      <ScrollProgress />
      <section className="mm-hero" aria-label="MemoryMap introduction">
        <Header />
        <HeroIntro />
        <div className="mm-hero-demo"><HomeCampusDemo /></div>
      </section>
      <main><CoreExplanation /><WorkflowSection /><PrivacySection /><FinalCta /></main>
      <Footer />
    </>
  );
}
