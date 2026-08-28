import type { Metadata } from "next";
import { subsystemEnabled } from "../../lib/subsystem-controls.mjs";
import { CustomerFooter, CustomerHeader } from "../components/CustomerChrome";
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
    <CustomerHeader />
    <section className="rl-beta-intro rm-shell">
      <div>
        <span>PRIVATE ENGINE CALIBRATION</span>
        <h1>Help teach the engine what a good decision looks like.</h1>
      </div>
      <p>Send one original Rocket League PC replay. It becomes private calibration evidence—not an instant personal analysis.</p>
    </section>
    <div className="rl-beta-shell rm-shell">
      <ReplayContribution intakeOpen={intakeOpen} />
      <aside className="rl-beta-trust">
        <span>AFTER UPLOAD</span>
        <b>Evidence first. Claims later.</b>
        <p>Every replay moves through separate checks for file quality, player identity and human agreement before it can improve a detector.</p>
        <ul>
          <li>Original PC .replay only</li>
          <li>Private storage with explicit consent</li>
          <li>Stable, revocable reviewer identities</li>
          <li>Two blind reviews before a detector can pass</li>
          <li>Never presented as finished coaching</li>
        </ul>
      </aside>
    </div>
    <CustomerFooter />
  </main>;
}
