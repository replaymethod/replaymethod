import Link from "next/link";
import type { ReactNode } from "react";
import { ReplayMark } from "./ReplayMark";

type CustomerHeaderProps = {
  compact?: boolean;
  current?: "product" | "method" | "report";
  right?: ReactNode;
};

export function CustomerHeader({ compact = false, current, right }: CustomerHeaderProps) {
  return <header className={`rm-header${compact ? " rm-header-compact" : ""}`}>
    <div className="rm-shell rm-header-inner">
      <Link className="rm-wordmark" href="/" aria-label="Replay Method home">
        <span className="rm-wordmark-glyph" aria-hidden="true"><ReplayMark /></span>
        <span>Replay Method</span>
      </Link>
      {!compact && <nav className="rm-main-nav" aria-label="Main navigation">
        <Link aria-current={current === "product" ? "page" : undefined} href="/#product">Product demo</Link>
        <Link aria-current={current === "method" ? "page" : undefined} href="/#method">How it works</Link>
        <Link href="/#why">Why Replay Method</Link>
        <Link href="/guides/rocket-league-replay-review-checklist">Replay guide</Link>
      </nav>}
      <div className="rm-header-action">{right || <><Link className="rm-header-login" aria-current={current === "report" ? "page" : undefined} href="/reports">My reports</Link><Link className="rm-header-cta" href="/analyze">Start free</Link></>}</div>
    </div>
  </header>;
}

export function CustomerFooter() {
  return <footer className="rm-footer">
    <div className="rm-shell rm-footer-grid">
      <div className="rm-footer-brand"><span className="rm-footer-wordmark"><span className="rm-wordmark-glyph" aria-hidden="true"><ReplayMark /></span><b>Replay Method</b></span></div>
      <nav aria-label="Product links"><span>Product</span><Link href="/analyze">Analyze 10 .replay files</Link><Link href="/replay-upload">Find .replay files</Link><Link href="/guides/rocket-league-replay-review-checklist">How to review a replay</Link></nav>
      <nav aria-label="Method links"><span>How it works</span><Link href="/#method">Three simple steps</Link><Link href="/#why">Why Replay Method</Link><Link href="/reports">My reports</Link></nav>
      <nav aria-label="Company links"><span>Company</span><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/beta-terms">Beta terms</Link><a href="mailto:contact@replaymethod.xyz">Contact</a></nav>
      <small>Independent product. Not affiliated with Epic Games or Psyonix.</small>
    </div>
  </footer>;
}
