import type { Metadata } from "next";
/* eslint-disable @next/next/no-html-link-for-pages */
import { notFound } from "next/navigation";
import { guideBySlug, guides } from "../data";

export function generateStaticParams() { return guides.map(guide => ({ slug: guide.slug })); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const guide = guideBySlug[slug];
  if (!guide) return {};
  return { title: `${guide.title} | Replay Method`, description: guide.description, alternates: { canonical: `/guides/${slug}` }, openGraph: { title: guide.title, description: guide.description, type: "article" } };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = guideBySlug[slug];
  if (!guide) notFound();
  const analysisHref = `/analyze?game=${guide.gamePath.slice(1)}&hypothesis=${encodeURIComponent(guide.nextRule.slice(0, 120).trim())}`;
  const schema = { "@context": "https://schema.org", "@type": "Article", headline: guide.title, description: guide.description, author: { "@type": "Organization", name: "Replay Method" }, publisher: { "@type": "Organization", name: "Replay Method" }, mainEntityOfPage: `https://replaymethod.xyz/guides/${guide.slug}` };
  const faqSchema = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: guide.faq.map(item => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a } })) };
  return <main className="guide-page">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
    <nav className="tool-nav shell"><a className="brand" href="/"><span className="logo">↻</span><span>replay<span>method</span></span></a><div><a href="/climb-check">Free check</a><a href="/guides">All guides</a></div></nav>
    <article className="guide-article shell">
      <header><span>{guide.game} · {guide.readTime}</span><h1>{guide.title}</h1><p>{guide.opening}</p><div><a href={analysisHref}>Carry this rule into beta intake →</a><small>The intake states the current evidence and access limits</small></div></header>
      <section className="guide-scorecard"><span>THE FOUR-QUESTION SCORECARD</span>{guide.scorecard.map((item, index) => <div key={item.label}><b>0{index + 1}</b><small>{item.label}</small><p>{item.question}</p></div>)}</section>
      <div className="guide-body"><aside><span>15-MINUTE REVIEW</span><ol><li>Pick one close loss</li><li>Review only high-value moments</li><li>Write one repeated pattern</li><li>Queue with one rule</li></ol><a href="/climb-check">Run the free Climb Check →</a></aside><div>{guide.sections.map(section => <section key={section.title}><h2>{section.title}</h2><p>{section.body}</p><ul>{section.bullets.map(item => <li key={item}>{item}</li>)}</ul></section>)}<section className="next-rule"><span>USE THIS NEXT</span><h2>One rule for your next five games</h2><p>{guide.nextRule}</p><a href={analysisHref}>Carry this rule into beta intake →</a></section><section className="guide-faq"><span>QUICK ANSWERS</span>{guide.faq.map(item => <div key={item.q}><h2>{item.q}</h2><p>{item.a}</p></div>)}</section></div></div>
    </article>
    <footer className="tool-footer shell"><p>Replay Method · Review the evidence. Change one decision.</p><div><a href="/guides">All guides</a><a href="/privacy">Privacy</a><a href="mailto:contact@replaymethod.xyz">Contact</a></div></footer>
  </main>;
}
