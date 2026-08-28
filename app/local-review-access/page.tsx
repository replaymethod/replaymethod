import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { localReviewAvailable, readLocalReviewSession } from "../../lib/local-review-auth.mjs";
import { LocalReviewLoginForm, LocalReviewLogoutButton } from "./LocalReviewAccessForm";

export const dynamic = "force-dynamic";

export default async function LocalReviewAccessPage() {
  const requestHeaders = await headers();
  const { env } = await import("cloudflare:workers");
  if (!localReviewAvailable(env, requestHeaders)) notFound();
  const session = await readLocalReviewSession(env, requestHeaders);

  return <main className="local-review-access"><section>
    <span>LOCAL REVIEW LAB · LOOPBACK ONLY</span>
    <h1>{session ? "Local identity active." : "Enter the private review room."}</h1>
    <p>{session
      ? `${session.displayName} · ${session.email} · ${session.localRole}`
      : "The access code stays in this local server session. It is never placed in a URL or accepted outside localhost."}</p>
    {session ? <>
      <a href={session.localRole === "owner" ? "/local-review-owner" : "/admin/rl-review"}>CONTINUE TO REVIEW LAB <b>→</b></a>
      <LocalReviewLogoutButton />
    </> : <LocalReviewLoginForm />}
    <aside><b>Fail-closed by design.</b><p>This route exists only when explicitly enabled on a loopback host. Production Sites authentication remains unchanged.</p></aside>
  </section></main>;
}
