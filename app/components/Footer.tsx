import Link from "next/link";
import MemoryMapLogo from "./MemoryMapLogo";
import MemoryMapWordmark from "./MemoryMapWordmark";

export default function Footer() {
  return (
    <footer className="mm-footer"><div className="mm-footer__inner"><div className="mm-footer__brand"><Link href="/" className="mm-brand mm-brand--footer" aria-label="MemoryMap home"><MemoryMapLogo size={26} variant="dark" /><MemoryMapWordmark /></Link></div><nav className="mm-footer__nav" aria-label="Footer navigation"><a href="#product">Product</a><a href="#demo">Demo</a><a href="#privacy">Privacy</a></nav><div className="mm-footer__right"><Link href="/login">Log in</Link><Link href="/login">Start a campus</Link><p className="mm-footer__copyright">© 2026 MemoryMap</p></div></div></footer>
  );
}
