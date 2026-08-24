import Link from "next/link";

export const OWNER_VERIFICATION_REQUIRED_MESSAGE = "Owner QA requires a verified owner session on this device.";

export default function OwnerVerificationRequired() {
  return <section className="owner-verification-required" role="alert" aria-labelledby="owner-verification-title"><span>OWNER QA VERIFICATION</span><h3 id="owner-verification-title">{OWNER_VERIFICATION_REQUIRED_MESSAGE}</h3><p>No file was uploaded and no analysis allowance was used.</p><div><Link href="/owner-qa">Verify owner access →</Link><Link href="/reports">Open reports</Link></div></section>;
}
