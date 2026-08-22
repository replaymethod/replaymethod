import type { Metadata } from "next";
import Link from "next/link";
import { subsystemEnabled } from "../../lib/subsystem-controls.mjs";
import ReplayContribution from "./ReplayContribution";

export const metadata: Metadata = {
  title: "Send a Rocket League replay — Replay Method private beta",
  description: "Securely send one original Rocket League PC replay to the Replay Method private beta.",
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
    <nav className="rl-beta-nav shell"><Link className="brand" href="/" aria-label="Replay Method home"><span className="logo" aria-hidden="true" /><span>replay<span>method</span></span></Link><Link href="/">Back to start</Link></nav>
    <div className="rl-beta-shell shell"><ReplayContribution intakeOpen={intakeOpen} /><aside className="rl-beta-trust"><span>WHAT HAPPENS AFTER UPLOAD</span><b>Your file becomes evidence only after it is checked.</b><p>The secure receipt is immediate. Parsing, player attribution and reviewer labels are separate states; none is presented as finished before it really is.</p><ul><li>Original PC .replay only</li><li>Private storage with explicit consent</li><li>Stable, revocable reviewer identities</li><li>Two blind qualified reviews before a detector can pass</li><li>Public coaching and billing remain off</li></ul></aside></div>
  </main>;
}
