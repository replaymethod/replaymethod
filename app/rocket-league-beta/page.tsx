import type { Metadata } from "next";
import Link from "next/link";
import { subsystemEnabled } from "../../lib/subsystem-controls.mjs";
import ReplayContribution from "./ReplayContribution";

export const metadata: Metadata = {
  title: "Contribute a Rocket League replay — Replay Method",
  description: "Privately contribute one Rocket League PC replay to Replay Method’s evidence-engine calibration.",
  alternates: { canonical: "/rocket-league-beta" },
  robots: { index: false, follow: true }
};

export default async function RocketLeagueBetaPage() {
  let intakeOpen = false;
  try {
    const { env } = await import("cloudflare:workers");
    intakeOpen = subsystemEnabled((env as unknown as { RL_CALIBRATION_INTAKE_ENABLED?: string }).RL_CALIBRATION_INTAKE_ENABLED);
  } catch { /* Local and static previews stay fail-closed. */ }

  return <main className="rl-beta-page">
    <nav className="rl-beta-nav shell"><Link className="brand" href="/" aria-label="Replay Method home"><span className="logo">↻</span><span>replay<span>method</span></span></Link><Link href="/rocket-league">Why Replay Method?</Link></nav>
    <div className="rl-beta-shell shell"><ReplayContribution intakeOpen={intakeOpen} /><aside className="rl-beta-trust"><span>WHAT THIS IS</span><b>A research contribution, not a fake analysis.</b><p>Your replay helps us test whether detector moments are correct, useful and repeatable before anything is shown to players.</p><ul><li>Original PC .replay only</li><li>Private object storage</li><li>Two independent qualified reviewers required</li><li>Public detectors remain off until every quality gate passes</li></ul></aside></div>
  </main>;
}
