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
    <nav className="tool-nav shell"><Link className="brand" href="/"><span className="logo">↻</span><span>replay<span>method</span></span></Link><Link href="/rocket-league#replay-upload">Back to upload</Link></nav>
    <section className="replay-upload-hero shell">
      <div className="replay-upload-copy">
        <span className="kicker">ROCKET LEAGUE · WINDOWS PC</span>
        <h1>Find the file.<br /><em>Keep your upload moving.</em></h1>
        <p>You need the original match file ending in <strong>.replay</strong>—not a video, screenshot or tracker link. The automated beta currently accepts PC replay files only.</p>
        <div className="replay-requirements" aria-label="Replay requirements"><span><b>.replay</b> original format</span><span><b>16 MB</b> maximum</span><span><b>Private</b> analysis link</span></div>
      </div>
      <aside className="replay-upload-route" aria-label="Replay upload path"><span>YOUR ROUTE</span><ol><li className="active"><i>01</i><b>Find file</b></li><li><i>02</i><b>Upload</b></li><li><i>03</i><b>Verify evidence</b></li><li><i>04</i><b>Private report</b></li></ol></aside>
    </section>

    <section className="replay-find shell" aria-labelledby="replay-find-title">
      <header><span>3 QUICK STEPS</span><h2 id="replay-find-title">Open the replay folder.</h2><p>No install, account or file conversion required.</p></header>
      <div className="replay-find-grid">
        <article><i>01</i><div><span>OPEN RUN</span><h3>Press Windows + R</h3><p>This opens the Windows Run box. Close Rocket League first if you are moving or copying replay files.</p></div></article>
        <article><i>02</i><div><span>PASTE THE FOLDER</span><h3>Use the replay location</h3><code>{replayPath}</code><p>Paste the path into Run, then press Enter. The <strong>Demos</strong> folder contains saved replay files.</p></div></article>
        <article><i>03</i><div><span>CHOOSE ONE MATCH</span><h3>Sort by “Date modified”</h3><p>Pick a recent ranked match that represents the problem you want to fix. Leave the file in its original <strong>.replay</strong> format.</p></div></article>
      </div>
      <div className="replay-folder-note"><i>?</i><div><b>Folder empty?</b><p>Save a replay in Rocket League after a completed match, then open this folder again. Console replay export is not supported by the automated beta.</p></div></div>
    </section>

    <section className="replay-next shell">
      <div><span>READY WHEN YOU ARE</span><h2>Return with one representative match.</h2><p>The upload checks format, file size and match structure before any gameplay finding is shown. Replay Method stops when the evidence is insufficient.</p></div>
      <Link href="/rocket-league#replay-upload">Return to replay upload <span>→</span></Link>
    </section>

    <section className="replay-review-separate shell"><div><span>DIFFERENT JOB</span><h2>Want to review the gameplay yourself?</h2><p>Finding the file gets evidence into Replay Method. The separate review checklist teaches you how to inspect spacing, challenges, boost paths and recoveries.</p></div><Link href="/guides/rocket-league-replay-review-checklist">Open the gameplay review checklist →</Link></section>
    <div className="replay-source shell"><p>Folder guidance checked against <a href="https://www.epicgames.com/help/c-202300000001619/c-0/a202300000009655?lang=en-US" target="_blank" rel="noreferrer">Epic Games Rocket League Support</a>.</p></div>
    <footer className="tool-footer shell"><p>Replay Method · One match. One pattern. One plan.</p><div><Link href="/guides">Free guides</Link><Link href="/privacy">Privacy</Link><a href="mailto:contact@replaymethod.xyz">Contact</a></div></footer>
  </main>;
}
