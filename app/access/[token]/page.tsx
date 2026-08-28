import type { Metadata } from "next";
import Link from "next/link";
import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { playerClaims } from "../../../db/schema";
import { hashPlayerToken, playerTokenPattern } from "../../../lib/player-identity.mjs";
import { CustomerFooter, CustomerHeader } from "../../components/CustomerChrome";
import { ReplayMark } from "../../components/ReplayMark";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Verify report ownership — Replay Method", robots: { index: false, follow: false } };

export default async function AccessPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ state?: string }> }) {
  const { token } = await params;
  const { state } = await searchParams;
  let available = false;
  if (playerTokenPattern.test(token)) {
    const db = await getDb();
    const claim = await db.select({ id: playerClaims.id }).from(playerClaims).where(and(
      eq(playerClaims.tokenHash, await hashPlayerToken(token)),
      isNull(playerClaims.consumedAt),
      sql`datetime(${playerClaims.expiresAt}) > datetime('now')`
    )).get();
    available = Boolean(claim);
  }
  const unavailable = state === "expired" || state === "invalid" || !available;

  return <main className={`access-page${unavailable ? " access-page-unavailable" : ""}`}>
    <CustomerHeader compact right={<Link className="rm-header-cta" href="/reports">My reports</Link>} />
    <section className="access-card rm-shell">
      <div className="access-copy">
        <span className="access-kicker">PRIVATE REPORT OWNERSHIP</span>
        <h1>{unavailable ? "This link has finished its job." : "Keep every report in one place."}</h1>
        <p>{unavailable ? "Ownership links work once and expire after seven days. If you already verified on this device, your private report history is still here." : "Verify the inbox that received this link. Your private Rocket League reports will stay connected on this device—without a password or public profile."}</p>
        {unavailable ? <Link className="access-primary" href="/reports">Open my reports <span aria-hidden="true">→</span></Link> : <form action="/api/player/claim" method="post"><input type="hidden" name="token" value={token} /><button>Verify and open my report <span aria-hidden="true">→</span></button></form>}
        <small>Essential session only · one-time link · 90-day device access</small>
      </div>
      <aside className="access-visual" aria-label={unavailable ? "Verification link inactive" : "Private report access ready"}>
        <span className="access-mark" aria-hidden="true"><ReplayMark /></span>
        <small>{unavailable ? "LINK COMPLETE" : "PRIVATE BY DEFAULT"}</small>
        <strong>{unavailable ? "Your files stay private." : "No account wall."}</strong>
        <p>{unavailable ? "Use your report history or request a fresh ownership link when you need one." : "The link proves ownership. The local device session keeps your reports within reach."}</p>
      </aside>
    </section>
    <CustomerFooter />
  </main>;
}
