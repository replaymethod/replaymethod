import type { Metadata } from "next";
import Link from "next/link";
import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { playerClaims } from "../../../db/schema";
import { hashPlayerToken, playerTokenPattern } from "../../../lib/player-identity.mjs";

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

  return <main className="access-page"><nav className="tool-nav shell"><Link className="brand" href="/"><span className="logo">↻</span><span>replay<span>method</span></span></Link><Link href="/reports">My reports</Link></nav><section className="access-card shell"><div className="access-mark" aria-hidden="true">{unavailable ? "!" : "✓"}</div><span>PRIVATE REPORT OWNERSHIP</span><h1>{unavailable ? "This verification link is no longer active." : "Keep your reports connected."}</h1><p>{unavailable ? "One-time ownership links expire after seven days and stop working after use. If you already verified on this device, your secure history is still available." : "Continue to verify the email address that received this link. Replay Method will remember your report history on this device without a password or public profile."}</p>{unavailable ? <Link className="access-primary" href="/reports">Open my report history →</Link> : <form action="/api/player/claim" method="post"><input type="hidden" name="token" value={token} /><button>VERIFY AND OPEN MY REPORT <span>→</span></button></form>}<small>Essential session only · HttpOnly · 90-day expiry · Sign-in links are one-time use</small></section></main>;
}
