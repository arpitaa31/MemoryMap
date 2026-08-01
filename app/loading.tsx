import MemoryMapLogo from "./components/MemoryMapLogo";
import MemoryMapWordmark from "./components/MemoryMapWordmark";

export default function Loading() {
  return (
    <main className="mm-route-loading" role="status" aria-live="polite">
      <span className="mm-route-loading__kicker">Private campus archive</span>
      <div className="mm-route-loading__brand"><MemoryMapLogo size={38} variant="dark" /><MemoryMapWordmark className="mm-route-loading__wordmark" /></div>
      <p className="mm-route-loading__label">Returning to your places</p>
      <span className="mm-loading-line" aria-hidden="true"><i /><i /><i /></span>
      <span className="sr-only">Loading MemoryMap</span>
    </main>
  );
}
