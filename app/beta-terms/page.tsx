import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Beta analysis terms — Replay Method", description: "Terms for submitting a match to the Replay Method beta.", alternates: { canonical: "/beta-terms" } };

export default function BetaTermsPage() {
  return <main className="legal-shell">
    <nav className="legal-nav"><Link className="brand" href="/"><span className="logo">↻</span><span>replay<span>method</span></span></Link><Link href="/analyze">← Back to analysis</Link></nav>
    <header><span>BETA ANALYSIS TERMS</span><h1>One real match. No fake promise.</h1><p>These terms explain the free beta analysis, what you may submit and what Replay Method can—and cannot—promise.</p><small>Last updated: 20 August 2026</small></header>
    <div className="legal-grid"><aside><b>The deal today</b><p>Replay intake is free when open. No card is collected, and intake may remain closed during quality validation.</p><Link href="/privacy">Read our privacy notice →</Link></aside><article>
      <section><h2>1. The beta service</h2><p>You may submit a supported match reference, an original Rocket League .replay file, or gameplay video/VOD only when the relevant intake is shown as open. A PC replay can support frame-exact telemetry; video is assessed only from what is visible and audible in the supplied footage. League and VALORANT automation requires approved, opt-in Riot access. Replay Method may reject unsupported or insufficient evidence. Capacity and turnaround are not guaranteed.</p></section>
      <section><h2>2. Automated analysis and quality review</h2><p>The target service parses supported match data, produces versioned findings and may use an AI language layer to explain them. It stops when evidence is insufficient. Selected reports may be reviewed by an authorized human for calibration and safety, but routine delivery is not promised to include a human coach.</p></section>
      <section><h2>3. Your submission</h2><p>You confirm that you may share the evidence and that it does not contain unlawful, malicious or unnecessarily sensitive material. You retain ownership and grant Replay Method limited permission to store, review and transform it only to deliver and improve the requested beta service.</p></section>
      <section><h2>4. Private report link</h2><p>Your report uses a high-entropy private link instead of a public profile. Anyone who obtains that link may be able to view the report, so keep it private and contact us if you believe it was exposed.</p></section>
      <section><h2>5. No rank guarantee</h2><p>The report is educational feedback, not a guarantee of rank, rating, win rate or competitive result. Outcomes depend on the evidence, game, other players and how you apply the plan.</p></section>
      <section><h2>6. Feedback and case studies</h2><p>You may rate a completed report. Replay Method will use your words publicly only when you separately authorize an anonymous quotation. We do not create or publish fake player reviews.</p></section>
      <section><h2>7. Publishers and contact</h2><p>Replay Method is independent and is not affiliated with, endorsed by or sponsored by Riot Games, Psyonix or Epic Games. Game names identify compatibility only. Commercial Rocket League functionality remains closed until platform and intellectual-property clearance is complete. Questions or deletion requests can be sent to <a href="mailto:contact@replaymethod.xyz?subject=Replay%20Method%20beta">contact@replaymethod.xyz</a>. Swedish law applies without limiting mandatory consumer rights.</p></section>
    </article></div>
  </main>;
}
