"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ReplayMark } from "./ReplayMark";

type CustomerHeaderProps = {
  compact?: boolean;
  current?: "product" | "method" | "report";
  right?: ReactNode;
};

type HomepageSection = "#start" | "#product" | "#method";

const homepageSections: HomepageSection[] = ["#product", "#method"];

export function CustomerHeader({ compact = false, current, right }: CustomerHeaderProps) {
  const pathname = usePathname();
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [activeHomepageSection, setActiveHomepageSection] = useState<HomepageSection>("#start");
  const [compactHeaderVisible, setCompactHeaderVisible] = useState(false);
  const directoryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (pathname !== "/") return;

    let animationFrame = 0;
    const syncVisibleSection = () => {
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(() => {
        const activationLine = Math.min(window.innerHeight * .32, 280);
        let nextSection: HomepageSection = "#start";

        for (const section of homepageSections) {
          const element = document.querySelector<HTMLElement>(section);
          if (element && element.getBoundingClientRect().top <= activationLine) nextSection = section;
        }

        setActiveHomepageSection((currentSection) => currentSection === nextSection ? currentSection : nextSection);

        const heroLead = document.querySelector<HTMLElement>(".rm-home-hero > p");
        const nextCompactHeaderVisible = Boolean(heroLead && heroLead.getBoundingClientRect().bottom <= 64);
        setCompactHeaderVisible((isVisible) => isVisible === nextCompactHeaderVisible ? isVisible : nextCompactHeaderVisible);
      });
    };

    syncVisibleSection();
    window.addEventListener("scroll", syncVisibleSection, { passive: true });
    window.addEventListener("resize", syncVisibleSection);
    window.addEventListener("hashchange", syncVisibleSection);
    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("scroll", syncVisibleSection);
      window.removeEventListener("resize", syncVisibleSection);
      window.removeEventListener("hashchange", syncVisibleSection);
    };
  }, [pathname]);

  useEffect(() => {
    if (!directoryOpen) return;

    const closeOnPointerDown = (event: PointerEvent) => {
      if (!directoryRef.current?.contains(event.target as Node)) setDirectoryOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDirectoryOpen(false);
    };
    const closeOnScroll = () => setDirectoryOpen(false);

    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("scroll", closeOnScroll, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("scroll", closeOnScroll);
    };
  }, [directoryOpen]);

  const closeDirectory = () => setDirectoryOpen(false);
  const activeHref = pathname === "/"
    ? `/${activeHomepageSection}`
    : pathname === "/analyze"
      ? "/analyze"
      : pathname === "/reports" || pathname.startsWith("/report/") || pathname.startsWith("/access/")
        ? "/reports"
        : pathname === "/replay-upload"
          ? "/replay-upload"
          : pathname.startsWith("/guides/")
            ? "/guides/rocket-league-replay-review-checklist"
            : ["/privacy", "/terms", "/beta-terms"].includes(pathname)
              ? pathname
              : undefined;
  const activeLabel = activeHref === "/#start"
    ? "Start"
    : activeHref === "/#product"
      ? "Product demo"
      : activeHref === "/#method"
        ? "How it works"
        : activeHref === "/analyze"
          ? "Analyze .replay files"
          : activeHref === "/reports"
            ? "My reports"
            : activeHref === "/replay-upload"
              ? "Find .replay files"
              : activeHref === "/guides/rocket-league-replay-review-checklist"
                ? "Replay guide"
                : activeHref === "/privacy"
                  ? "Privacy"
                  : activeHref === "/terms"
                    ? "Terms"
                    : activeHref === "/beta-terms"
                      ? "Beta terms"
                      : "Explore";
  const active = (href: string) => activeHref === href ? "page" as const : undefined;
  const homepageHeader = pathname === "/" && !compact;

  return <><header className={`rm-header${compact ? " rm-header-compact" : ""}${homepageHeader ? " rm-header-home" : ""}`}>
    <div className="rm-shell rm-header-inner">
      <Link className="rm-wordmark" href="/" aria-label="Replay Method home">
        <span className="rm-wordmark-glyph" aria-hidden="true"><ReplayMark /></span>
        <span>Replay Method</span>
      </Link>
      {!compact && <nav className="rm-main-nav" aria-label="Main navigation">
        <div className="rm-nav-directory" ref={directoryRef}>
          <button type="button" aria-expanded={directoryOpen} aria-controls="rm-nav-directory-panel" onClick={() => setDirectoryOpen((open) => !open)}>
            <span className="rm-nav-directory-label">{activeLabel}</span><span className="rm-nav-directory-caret" aria-hidden="true">⌄</span>
          </button>
          {directoryOpen && <div className="rm-nav-directory-panel" id="rm-nav-directory-panel">
            <section>
              <span>On this page</span>
              <Link aria-current={active("/#start")} href="/#start" onClick={closeDirectory}>Start</Link>
              <Link aria-current={active("/#product")} href="/#product" onClick={closeDirectory}>Product demo</Link>
              <Link aria-current={active("/#method")} href="/#method" onClick={closeDirectory}>How it works</Link>
            </section>
            <section>
              <span>Product</span>
              <Link aria-current={active("/analyze")} href="/analyze" onClick={closeDirectory}>Analyze .replay files</Link>
              <Link aria-current={active("/reports")} href="/reports" onClick={closeDirectory}>My reports</Link>
              <Link aria-current={active("/replay-upload")} href="/replay-upload" onClick={closeDirectory}>Find .replay files</Link>
            </section>
            <section>
              <span>Learn &amp; legal</span>
              <Link aria-current={active("/guides/rocket-league-replay-review-checklist")} href="/guides/rocket-league-replay-review-checklist" onClick={closeDirectory}>Replay guide</Link>
              <Link aria-current={active("/privacy")} href="/privacy" onClick={closeDirectory}>Privacy</Link>
              <Link aria-current={active("/terms")} href="/terms" onClick={closeDirectory}>Terms</Link>
              <Link aria-current={active("/beta-terms")} href="/beta-terms" onClick={closeDirectory}>Beta terms</Link>
            </section>
          </div>}
        </div>
      </nav>}
      <div className="rm-header-action">{right || <><Link className="rm-header-login" aria-current={current === "report" ? "page" : undefined} href="/reports">My reports</Link><Link className="rm-header-cta" href="/analyze">Start free</Link></>}</div>
    </div>
  </header><div className="rm-header-spacer" aria-hidden="true" />
    {homepageHeader && <header className={`rm-scroll-header${compactHeaderVisible ? " is-visible" : ""}`} aria-hidden={!compactHeaderVisible}>
      <div className="rm-shell rm-scroll-header-inner">
        <Link className="rm-wordmark" href="/" aria-label="Replay Method home" tabIndex={compactHeaderVisible ? undefined : -1}>
          <span className="rm-wordmark-glyph" aria-hidden="true"><ReplayMark /></span>
          <span>Replay Method</span>
        </Link>
        <div className="rm-scroll-header-action">
          <Link className="rm-header-login" href="/reports" tabIndex={compactHeaderVisible ? undefined : -1}>My reports</Link>
          <Link className="rm-header-cta" href="/analyze" tabIndex={compactHeaderVisible ? undefined : -1}>Start free</Link>
        </div>
      </div>
    </header>}
  </>;
}

export function CustomerFooter() {
  return <footer className="rm-footer">
    <div className="rm-shell rm-footer-grid">
      <div className="rm-footer-brand"><span className="rm-footer-wordmark"><span className="rm-wordmark-glyph" aria-hidden="true"><ReplayMark /></span><b>Replay Method</b></span></div>
      <nav aria-label="Product links"><span>Product</span><Link href="/analyze">Analyze 10 .replay files</Link><Link href="/replay-upload">Find .replay files</Link><Link href="/guides/rocket-league-replay-review-checklist">How to review a replay</Link></nav>
      <nav aria-label="Method links"><span>How it works</span><Link href="/#method">Three simple steps</Link><Link href="/#product">Product demo</Link><Link href="/reports">My reports</Link></nav>
      <nav aria-label="Company links"><span>Company</span><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/beta-terms">Beta terms</Link><a href="mailto:contact@replaymethod.xyz">Contact</a></nav>
      <small>Independent product. Not affiliated with Epic Games or Psyonix.</small>
    </div>
  </footer>;
}
