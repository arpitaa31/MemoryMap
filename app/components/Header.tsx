import Link from "next/link";
import MemoryMapLogo from "./MemoryMapLogo";
import MemoryMapWordmark from "./MemoryMapWordmark";

export default function Header() {
  return (
    <header className="mm-header">
      <div className="mm-header__inner">
        <Link href="/" className="mm-brand" aria-label="MemoryMap home"><MemoryMapLogo size={30} variant="light" /><MemoryMapWordmark /></Link>
        <nav className="mm-header__nav" aria-label="Primary navigation"><a href="#product">Product</a><a href="#demo">Demo</a><a href="#how-it-works">How it works</a><a href="#privacy">Privacy</a></nav>
        <div className="mm-header__actions"><Link href="/login" className="mm-text-link">Log in</Link><Link href="/login" className="mm-button mm-button--small mm-button--coral">Create a campus</Link></div>
      </div>
    </header>
  );
}
