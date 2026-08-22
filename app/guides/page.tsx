import type { Metadata } from "next";
/* eslint-disable @next/next/no-html-link-for-pages */
import { guides } from "./data";

export const metadata: Metadata = {
  title: "Free ranked improvement guides — Replay Method",
  description: "Practical replay and VOD review checklists for League of Legends, VALORANT and Rocket League players who want to stop grinding blind.",
  alternates: { canonical: "/guides" }
};

export default function GuidesPage() {
  return <main className="guide-library">
    <nav className="tool-nav shell"><a className="brand" href="/"><span className="logo" aria-hidden="true" /><span>replay<span>method</span></span></a><a href="/climb-check">Free Climb Check</a></nav>
    <header className="guide-library-hero shell"><span className="kicker">REPLAY METHOD FIELD NOTES</span><h1>Stop rewatching.<br /><em>Start reviewing.</em></h1><p>Fast, game-specific systems for finding the repeated decision behind a bad ranked session. No filler and no requirement to join the waitlist.</p></header>
    <section className="guide-library-grid shell">{guides.map((guide, index) => <a href={`/guides/${guide.slug}`} key={guide.slug}><div><span>0{index + 1}</span><small>{guide.game} · {guide.readTime}</small></div><h2>{guide.title}</h2><p>{guide.description}</p><b>Open the guide →</b></a>)}</section>
    <section className="library-cta shell"><div><span>FREE INTERACTIVE TOOL</span><h2>Not sure which guide matches your leak?</h2><p>Run the 60-second Climb Leak Check and leave with one starting hypothesis.</p></div><a href="/climb-check">Run the free check →</a></section>
    <footer className="tool-footer shell"><p>Replay Method · A better way to get better.</p><div><a href="/">Home</a><a href="/privacy">Privacy</a><a href="mailto:contact@replaymethod.xyz">Contact</a></div></footer>
  </main>;
}
