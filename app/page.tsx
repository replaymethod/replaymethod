import Landing from "./components/Landing";
import { paidCheckoutReadiness, subsystemEnabled } from "../lib/subsystem-controls.mjs";

export default async function Home(){
  let checkoutOpen = false;
  let engineOpen = false;
  let calibrationOpen = false;
  let earlyAccessOpen = false;
  try {
    const { env } = await import("cloudflare:workers");
    const runtime = env as unknown as Record<string, unknown> & { RL_ENGINE_ENABLED?: string; RL_CALIBRATION_INTAKE_ENABLED?: string; RL_EARLY_ACCESS_OUTPUT_ENABLED?: string };
    checkoutOpen = paidCheckoutReadiness(runtime).ready;
    engineOpen = subsystemEnabled(runtime.RL_ENGINE_ENABLED);
    calibrationOpen = subsystemEnabled(runtime.RL_CALIBRATION_INTAKE_ENABLED);
    earlyAccessOpen = subsystemEnabled(runtime.RL_EARLY_ACCESS_OUTPUT_ENABLED);
  } catch { /* Local and static previews keep checkout safely closed. */ }
  return <Landing checkoutOpen={checkoutOpen} engineOpen={engineOpen} calibrationOpen={calibrationOpen} earlyAccessOpen={earlyAccessOpen}/>;
}
