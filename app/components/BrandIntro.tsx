"use client";

import { useEffect, useRef, useState } from "react";
import MemoryMapLogo from "./MemoryMapLogo";
import MemoryMapWordmark from "./MemoryMapWordmark";

export default function BrandIntro() {
  const [status, setStatus] = useState<"hidden" | "active" | "exiting">("active");
  const timers = useRef<number[]>([]);
  const previousOverflowRef = useRef("");

  useEffect(() => {
    const clearTimers = () => timers.current.forEach((timer) => window.clearTimeout(timer));
    const previousOverflow = document.body.style.overflow;
    previousOverflowRef.current = previousOverflow;
    const finish = () => {
      clearTimers();
      document.body.removeAttribute("data-intro-visible");
      document.body.style.overflow = previousOverflow;
      setStatus("hidden");
    };

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.body.setAttribute("data-intro-visible", "true");
    const activeTimer = window.setTimeout(() => setStatus("active"), 0);
    const exitTimer = window.setTimeout(() => setStatus("exiting"), prefersReducedMotion ? 250 : 1250);
    const finishTimer = window.setTimeout(finish, prefersReducedMotion ? 650 : 1800);
    timers.current = [activeTimer, exitTimer, finishTimer];

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setStatus("exiting");
    };
    window.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      clearTimers();
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      document.body.removeAttribute("data-intro-visible");
    };
  }, []);

  useEffect(() => {
    if (status !== "exiting") return;
    const finishTimer = window.setTimeout(() => {
      document.body.removeAttribute("data-intro-visible");
      document.body.style.overflow = previousOverflowRef.current;
      setStatus("hidden");
    }, 550);
    return () => window.clearTimeout(finishTimer);
  }, [status]);

  if (status === "hidden") return null;

  return (
    <div
      className={`mm-intro${status === "exiting" ? " mm-intro--exiting" : ""}`}
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">Loading MemoryMap</span>
      <div className="mm-intro__content" aria-hidden="true">
        <span className="mm-route-loading__kicker">Private campus archive</span>
        <div className="mm-intro__brand"><MemoryMapLogo size={38} variant="dark" /><MemoryMapWordmark className="mm-intro__wordmark" /></div>
        <p className="mm-route-loading__label">Returning to your places</p>
        <span className="mm-loading-line" aria-hidden="true"><i /><i /><i /></span>
      </div>
      <div className="mm-intro__wipe" aria-hidden="true" />
    </div>
  );
}
