"use client";

import { CSSProperties, ElementType, HTMLAttributes, ReactNode, useEffect, useId, useState } from "react";

type RevealProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  as?: ElementType;
  delay?: number;
  variant?: "fade-up" | "mask" | "scale-soft" | "up" | "left" | "right" | "fade";
};

type RevealRecord = {
  reveal: () => void;
};

const revealRecords = new Map<Element, RevealRecord>();
let sharedObserver: IntersectionObserver | null = null;

function getSharedObserver() {
  if (sharedObserver || typeof IntersectionObserver === "undefined") {
    return sharedObserver;
  }

  sharedObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        const record = revealRecords.get(entry.target);
        record?.reveal();
      });
    },
    {
      threshold: 0.01,
      rootMargin: "0px 0px 220px 0px",
    },
  );

  return sharedObserver;
}

function observeReveal(element: Element, reveal: () => void) {
  const observer = getSharedObserver();
  if (!observer) return () => undefined;

  revealRecords.set(element, { reveal });
  observer.observe(element);

  return () => {
    revealRecords.delete(element);
    observer.unobserve(element);
  };
}

export default function Reveal({
  children,
  as: Tag = "div",
  className = "",
  delay = 0,
  style,
  variant = "fade-up",
  ...rest
}: RevealProps) {
  const revealId = useId();
  const [prepared, setPrepared] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // The class is an explicit progressive-enhancement opt-in. Without it,
    // the base CSS keeps every server-rendered element fully visible.
    document.documentElement.classList.add("mm-js-ready");

    const element = document.querySelector<HTMLElement>(`[data-reveal-id="${revealId}"]`);
    if (!element) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let stopped = false;
    let stopObserving: () => void = () => undefined;
    let fallbackTimer = 0;

    const reveal = () => {
      if (stopped) return;
      stopped = true;
      window.clearTimeout(fallbackTimer);
      stopObserving();
      setVisible(true);
    };

    const prepareTimer = window.setTimeout(() => setPrepared(true), 0);

    if (reducedMotion || !getSharedObserver()) {
      window.setTimeout(reveal, 0);
    } else {
      stopObserving = observeReveal(element, reveal);
      const rect = element.getBoundingClientRect();

      // This catches content already visible, content above the viewport, and
      // pages restored to a previous scroll position before the observer ran.
      if (rect.top <= window.innerHeight + 220) {
        window.setTimeout(reveal, 0);
      }

      // No animation should ever be able to keep meaningful content hidden.
      fallbackTimer = window.setTimeout(reveal, 1000);
    }

    return () => {
      window.clearTimeout(prepareTimer);
      window.clearTimeout(fallbackTimer);
      stopObserving();
      stopped = true;
    };
  }, [revealId]);

  const state = visible ? "visible" : prepared ? "pending" : "base";

  return (
    <Tag
      {...rest}
      className={`mm-reveal mm-reveal--${variant} ${className}`.trim()}
      data-reveal-id={revealId}
      data-reveal-state={state}
      style={{ "--reveal-delay": `${delay}ms`, ...style } as CSSProperties}
    >
      {children}
    </Tag>
  );
}
