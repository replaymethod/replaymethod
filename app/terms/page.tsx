import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Waitlist terms — Replay Method",
  description: "The terms for joining the Replay Method beta waitlist.",
  alternates: { canonical: "/terms" }
};

export default function TermsPage() {
  return <main className="legal-shell">
    <nav className="legal-nav"><Link className="brand" href="/" aria-label="Replay Method home"><span className="logo">↻</span><span>replay<span>method</span></span></Link><Link href="/">← Back to Replay Method</Link></nav>
    <header><span>WAITLIST TERMS</span><h1>No card. No hidden purchase.</h1><p>Joining the Replay Method waitlist records your interest in the private beta. These terms keep the offer clear before you submit.</p><small>Last updated: 19 August 2026</small></header>
    <div className="legal-grid">
      <aside><b>The deal today</b><p>You are joining a waitlist, not buying a subscription. Nothing is charged and no payment details are collected.</p><Link href="/privacy">Read our privacy notice →</Link></aside>
      <article>
        <section><h2>1. The waitlist</h2><p>A valid signup gives you priority consideration for Replay Method beta and launch access. It does not guarantee an invitation, a launch date, access to every game or a specific beta feature.</p></section>
        <section><h2>2. Selected beta pricing</h2><p>Your first completed diagnosis is free and requires no card. When paid access activates, Replay Method&apos;s selected beta plans are $12 per month or $27 every three months ($9 per month effective). Each includes four successfully completed analyses every 30 days; unused analyses do not roll over. Monthly access renews monthly and the three-month plan renews every three months until canceled. Joining the waitlist does not start either plan or create a charge.</p></section>
        <section><h2>3. Beta product</h2><p>Replay Method is under development. Supported games, inputs, reports and availability may change as we learn from beta players. Any paid plan will show its final price, included features and cancellation terms before checkout.</p></section>
        <section><h2>4. No rank guarantee</h2><p>Replay Method is designed to help players identify patterns and focus practice. Results depend on the player, game, available data and application of feedback. We do not guarantee a rank, rating, win rate or improvement.</p></section>
        <section><h2>5. Game publishers</h2><p>Replay Method is an independent project and is not affiliated with, endorsed by or sponsored by Riot Games, Psyonix, Epic Games, Valve or their respective products.</p></section>
        <section><h2>6. Leaving the waitlist</h2><p>You may leave at any time by using the unsubscribe option in a Replay Method email or contacting <a href="mailto:contact@replaymethod.xyz?subject=Leave%20Replay%20Method%20waitlist">contact@replaymethod.xyz</a>. Your waitlist record will then be removed unless retention is legally required.</p></section>
        <section><h2>7. Contact</h2><p>Questions about the waitlist can be sent to <a href="mailto:contact@replaymethod.xyz?subject=Replay%20Method%20waitlist">contact@replaymethod.xyz</a>. These waitlist terms are governed by Swedish law.</p></section>
      </article>
    </div>
  </main>;
}
