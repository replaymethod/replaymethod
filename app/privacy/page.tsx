import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy — Replay Method",
  description: "How Replay Method handles beta analyses, match evidence, waitlist and website data."
};

export default function PrivacyPage() {
  return <main className="legal-shell">
    <nav className="legal-nav"><Link className="brand" href="/" aria-label="Replay Method home"><span className="logo">↻</span><span>replay<span>method</span></span></Link><Link href="/">← Back to Replay Method</Link></nav>
    <header><span>PRIVACY</span><h1>Your data should never be another hidden system.</h1><p>This notice explains what Replay Method collects when you submit a match, receive a beta report or join product updates—and how you stay in control.</p><small>Last updated: 19 August 2026</small></header>
    <div className="legal-grid">
      <aside><b>Quick version</b><p>We use the match evidence you submit to create your private report. Product-update email is optional. We do not sell your data or use advertising cookies.</p><a href="mailto:contact@replaymethod.xyz?subject=Replay%20Method%20privacy%20request">Make a privacy request →</a></aside>
      <article>
        <section><h2>1. Who is responsible?</h2><p>Replay Method is an early-stage project operated by Rafael Westin in Sweden. For access, correction, deletion or other privacy questions, email <a href="mailto:contact@replaymethod.xyz?subject=Replay%20Method%20privacy%20request">contact@replaymethod.xyz</a>.</p></section>
        <section><h2>2. What we collect</h2><p>For a beta analysis we store your email, selected game, rank and goal, player context you choose to provide, your match/replay/VOD link or uploaded Rocket League replay, optional notes, the resulting report, workflow status and any feedback. Evidence can contain gaming usernames or the names, voices and chat of other players; submit only material you are permitted to share. We also record referral data and basic funnel events with a temporary anonymous session identifier. Optional product-update consent is stored separately.</p><p>Private report ownership uses a one-time email verification token. After verification, an essential HttpOnly session cookie keeps your report history available on that device for up to 90 days. Only a one-way hash of each token is stored; these essential credentials are not used for advertising.</p></section>
        <section><h2>3. Why we use it</h2><ul><li>Secure, parse and analyze the match evidence you requested us to process.</li><li>Create, publish and improve your private Replay Method report and current training focus.</li><li>Compare later matches when you choose to return.</li><li>Notify you about report status when transactional email is available.</li><li>Send product and founding updates only when you separately opt in.</li><li>Measure the beta funnel, prevent abuse and improve reliability.</li></ul><p>Analysis processing is based on your request and explicit submission consent. Optional marketing email is based on separate consent. Security and limited anonymous measurement rely on our legitimate interest in operating and improving the beta.</p></section>
        <section><h2>4. Who receives it</h2><p>Data is available only to Replay Method and providers necessary for hosting, private file storage, automated replay or match processing, AI-assisted language synthesis, security and transactional email. The AI language layer receives compact structured findings rather than an entire raw replay where practical. Selected beta reports may be reviewed by an authorized Replay Method operator or expert reviewer for accuracy. We do not sell or rent personal data and do not publish a report or quote without separate permission.</p></section>
        <section><h2>5. How long we keep it</h2><p>Beta submissions and reports are retained while needed to deliver the service, compare later reports and improve the method. We review inactive analysis data for deletion within 12 months. Raw uploaded replay files may be deleted earlier when no longer needed. Waitlist records remain until you withdraw consent or they are no longer needed for beta and launch. You may request deletion at any time.</p></section>
        <section><h2>6. Your choices and rights</h2><p>You may withdraw consent at any time. You may also request access, correction, deletion, restriction or portability of your personal data, and object where processing relies on legitimate interest. Contact us using the email above. Withdrawing consent does not affect processing that was lawful before withdrawal.</p></section>
        <section><h2>7. International processing</h2><p>Infrastructure providers may process data outside the European Economic Area. Where required, transfers must use recognized safeguards such as an adequacy decision or approved contractual clauses.</p></section>
        <section><h2>8. Complaints and changes</h2><p>You may complain to the Swedish Authority for Privacy Protection, <a href="https://www.imy.se/" rel="noreferrer">IMY</a>. We may update this notice as the beta develops. Material changes affecting your choice will be communicated before they take effect.</p></section>
      </article>
    </div>
  </main>;
}
