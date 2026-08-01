import type { Metadata } from "next";
import Link from "next/link";
import MemoryMapLogo from "../components/MemoryMapLogo";
import MemoryMapWordmark from "../components/MemoryMapWordmark";
import Reveal from "../components/Reveal";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign in — MemoryMap",
  description: "Return to your private MemoryMap campuses.",
};

export default function LoginPage() {
  return (
    <main className="mm-login-page">
      <aside className="mm-login-brand">
        <Link href="/" className="mm-login-brand__logo" aria-label="MemoryMap home"><MemoryMapLogo size={30} variant="light" /><MemoryMapWordmark /></Link>
        <div className="mm-login-brand__copy">
          <Reveal variant="mask" as="p" className="mm-eyebrow mm-eyebrow--light">Private campus archives</Reveal>
          <Reveal variant="mask" delay={80} as="h1">Your school is more than a building.</Reveal>
          <Reveal variant="up" delay={150} as="p">Return to the rooms, courts and corridors where your stories happened.</Reveal>
        </div>
        <Reveal variant="fade" delay={220} className="mm-campus-line" aria-hidden="true">
          <svg viewBox="0 0 420 190" fill="none">
            <path d="M18 150H402M40 150V69H145V150M166 150V34H274V150M294 150V82H380V150M40 99H145M166 75H274M294 111H380" />
            <path d="M81 69V39H111V69M211 34V15H240V34M322 82V55H350V82" />
            <path className="is-accent" d="M274 75H294V111" />
            <circle className="is-node" cx="274" cy="75" r="6" />
          </svg>
        </Reveal>
        <p className="mm-login-brand__footer">Every place holds a memory.</p>
      </aside>
      <section className="mm-login-form-area" aria-labelledby="login-title">
        <div className="mm-login-form-wrap">
          <Reveal variant="mask">
            <p className="mm-eyebrow mm-eyebrow--moss">Your private archive</p>
            <h2 id="login-title">Welcome back</h2>
            <p className="mm-login-intro">Continue with Google to access your private campuses.</p>
          </Reveal>
          <Reveal variant="up" delay={120}><LoginForm /></Reveal>
        </div>
      </section>
    </main>
  );
}
