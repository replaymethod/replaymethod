import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Find your Rocket League replay file | Replay Method",
  description: "Find the original Rocket League .replay file on Windows PC, choose a useful match and return to secure replay analysis.",
  alternates: { canonical: "/replay-upload" }
};

const replayPath = String.raw`%USERPROFILE%\Documents\My Games\Rocket League\TAGame\Demos`;

export default function ReplayUploadPage() {
  return <main className="replay-upload-page">
    <nav className="tool-nav shell"><Link className="brand" href="/"><span className="logo" aria-hidden="true" /><span>replay<span>method</span></span></Link><Link href="/#ten-replay-start">Back to upload</Link></nav>
    <section className="replay-upload-hero shell">
      <div className="replay-upload-copy">
        <span className="kicker">ROCKET LEAGUE · WINDOWS PC</span>
        <h1>Find the file.<br /><em>Keep your upload moving.</em></h1>
        <p>You need the original match file ending in <strong>.replay</strong>—not a video, screenshot or tracker link. The automated beta currently accepts PC replay files only.</p>
        <div className="replay-requirements" aria-label="Replay requirements"><span><b>.replay</b> original format</span><span><b>16 MB</b> maximum</span><span><b>Private</b> analysis link</span></div>
      </div>
      <aside className="replay-upload-route" aria-label="Replay upload path"><span>YOUR ROUTE</span><ol><li className="active"><i>01</i><b>Find ten files</b></li><li><i>02</i><b>Upload &amp; resume</b></li><li><i>03</i><b>Verify 10/10</b></li><li><i>04</i><b>Cross-match report</b></li></ol></aside>
    </section>

    <section className="replay-find shell" aria-labelledby="replay-find-title">
      <header><span>3 QUICK STEPS</span><h2 id="replay-find-title">Open the replay folder.</h2><p>No install, account or file conversion required.</p></header>
      <div className="replay-find-grid">
        <article><i>01</i><div><span>OPEN RUN</span><h3>Press Windows + R</h3><p>This opens the Windows Run box. Close Rocket League first if you are moving or copying replay files.</p></div></article>
        <article><i>02</i><div><span>PASTE THE FOLDER</span><h3>Use the replay location</h3><code>{replayPath}</code><p>Paste the path into Run, then press Enter. The <strong>Demos</strong> folder contains saved replay files.</p></div></article>
        <article><i>03</i><div><span>CHOOSE TEN MATCHES</span><h3>Sort by “Date modified”</h3><p>Pick ten recent ranked matches from the same playlist and player. Leave every file in its original <strong>.replay</strong> format.</p></div></article>
      </div>
      <div className="replay-folder-note"><i>?</i><div><b>Folder empty?</b><p>After the final scoreboard, use Rocket League&apos;s <strong>Save Replay</strong> action before leaving the post-match screen, then open this folder again. Console replay export is not supported by the automated beta.</p></div></div>
    </section>

    <section className="replay-next shell">
      <div><span>READY WHEN YOU ARE</span><h2>Return with ten representative matches.</h2><p>Use the same player and ranked playlist. Invalid, duplicate or mismatched files are excluded and replaced without consuming a valid slot.</p></div>
      <Link href="/analyze">Start the 10-replay upload <span>→</span></Link>
    </section>

    <section className="replay-review-separate shell"><div><span>DIFFERENT JOB</span><h2>Want to review the gameplay yourself?</h2><p>Finding the file gets evidence into Replay Method. The separate review checklist teaches you how to inspect spacing, challenges, boost paths and recoveries.</p></div><Link href="/guides/rocket-league-replay-review-checklist">Open the gameplay review checklist →</Link></section>
    <div className="replay-source shell"><p>Folder guidance checked against <a href="https://www.epicgames.com/help/c-202300000001619/c-0/a202300000009655?lang=en-US" target="_blank" rel="noreferrer">Epic Games Rocket League Support</a>.</p></div>
    <footer className="tool-footer shell"><p>Replay Method · Ten matches. Recurrence first. One plan.</p><div><Link href="/guides">Free guides</Link><Link href="/privacy">Privacy</Link><a href="mailto:contact@replaymethod.xyz">Contact</a></div></footer>
  </main>;
}
