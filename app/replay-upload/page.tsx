import type { Metadata } from "next";
import Link from "next/link";
import { CustomerFooter, CustomerHeader } from "../components/CustomerChrome";

export const metadata: Metadata = {
  title: "Find your Rocket League replay file | Replay Method",
  description: "Find the original Rocket League .replay file on Windows PC, choose a useful match and return to secure replay analysis.",
  alternates: { canonical: "/replay-upload" }
};

const replayPath = String.raw`%USERPROFILE%\Documents\My Games\Rocket League\TAGame\Demos`;

export default function ReplayUploadPage() {
  return <main className="replay-upload-page">
    <CustomerHeader current="product" right={<Link className="rm-header-cta" href="/analyze">Back to upload <span aria-hidden="true">↗</span></Link>} />
    <section className="replay-upload-hero shell">
      <div className="replay-upload-copy"><span className="kicker">Rocket League · Windows PC</span><h1>Your replay files are already on your PC.</h1></div>
      <aside className="replay-upload-intro"><p>Open one folder, choose ten recent ranked matches and return to the upload. Keep every file in its original <strong>.replay</strong> format.</p><div><a href="#find-replays">Show me where</a><Link href="/analyze">Back to upload</Link></div><small>No install · No conversion · Private processing</small></aside>
    </section>

    <section className="replay-find shell" id="find-replays" aria-labelledby="replay-find-title">
      <nav className="replay-sandbox-tabs" aria-label="Find replay steps"><span className="active">01 · Open</span><span>02 · Choose</span><span>03 · Upload</span><small>Original PC files</small></nav>
      <header><span>The fastest route</span><h2 id="replay-find-title">Open the folder. Pick ten. Done.</h2><p>The path below takes you straight to Rocket League&apos;s saved PC replays.</p></header>
      <div className="replay-find-grid">
        <article><i>01</i><div><span>OPEN RUN</span><h3>Press Windows + R</h3><p>This opens the Windows Run box. Close Rocket League first if you are moving or copying replay files.</p></div></article>
        <article><i>02</i><div><span>PASTE THE FOLDER</span><h3>Use the replay location</h3><code>{replayPath}</code><p>Paste the path into Run, then press Enter. The <strong>Demos</strong> folder contains saved replay files.</p></div></article>
        <article><i>03</i><div><span>CHOOSE TEN MATCHES</span><h3>Sort by “Date modified”</h3><p>Pick ten recent ranked matches from the same playlist and player. Leave every file in its original <strong>.replay</strong> format.</p></div></article>
      </div>
      <div className="replay-folder-note"><i>?</i><div><b>Folder empty?</b><p>After the final scoreboard, use Rocket League&apos;s <strong>Save Replay</strong> action before leaving the post-match screen, then open this folder again. Console replay export is not supported by the automated beta.</p></div></div>
    </section>

    <section className="replay-next shell">
      <div><span>READY WHEN YOU ARE</span><h2>Got the files? Let&apos;s find your pattern.</h2><p>Use the same player and ranked playlist. Invalid, duplicate or mismatched files are explained and never consume a valid slot.</p></div>
      <Link href="/analyze">Return to the upload <span>→</span></Link>
    </section>

    <div className="replay-source shell"><p>Folder guidance checked against <a href="https://www.epicgames.com/help/c-202300000001619/c-0/a202300000009655?lang=en-US" target="_blank" rel="noreferrer">Epic Games Rocket League Support</a>.</p></div>
    <CustomerFooter />
  </main>;
}
