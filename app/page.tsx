import Landing from "./components/Landing";
import { subsystemEnabled } from "../lib/subsystem-controls.mjs";

export default async function Home(){
  let checkoutOpen = false;
  let engineOpen = false;
  try {
    const { env } = await import("cloudflare:workers");
    const runtime = env as unknown as { BILLING_CHECKOUT_ENABLED?: string; RL_ENGINE_ENABLED?: string };
    checkoutOpen = subsystemEnabled(runtime.BILLING_CHECKOUT_ENABLED);
    engineOpen = subsystemEnabled(runtime.RL_ENGINE_ENABLED);
  } catch { /* Local and static previews keep checkout safely closed. */ }
  return <Landing checkoutOpen={checkoutOpen} engineOpen={engineOpen}/>;
}
