import Link from "next/link";
import { CustomerFooter, CustomerHeader } from "./components/CustomerChrome";

export default function NotFound() {
  return <main className="not-found-page">
    <CustomerHeader compact right={<Link className="rm-header-cta" href="/analyze">Analyze <span aria-hidden="true">↗</span></Link>} />
    <section>
      <span>404 · PAGE NOT FOUND</span>
      <h1>That link missed the queue.</h1>
      <p>The address may be old, incomplete or mistyped. Your private replay and report links are never searchable.</p>
      <div><Link href="/">Return home →</Link><Link href="/reports">Open my reports</Link></div>
    </section>
    <CustomerFooter />
  </main>;
}
