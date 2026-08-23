import Link from "next/link";

export const FREE_ANALYSIS_USED_MESSAGE = "Den här mejladressen har redan använt sin kostnadsfria analys.";

export default function FreeAnalysisUsed() {
  return (
    <section className="free-analysis-used" role="alert" aria-labelledby="free-analysis-used-title">
      <span>ANALYSRÄTTIGHET</span>
      <h3 id="free-analysis-used-title">{FREE_ANALYSIS_USED_MESSAGE}</h3>
      <p>Ingen fil laddades upp och ingen ny analys eller allowance skapades.</p>
      <div>
        <Link href="/reports#report-history">Öppna tidigare rapport</Link>
        <Link href="/reports#verification">Verifiera eller logga in</Link>
        <Link href="/#pricing">Visa framtida planer</Link>
      </div>
    </section>
  );
}
