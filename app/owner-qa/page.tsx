import Link from "next/link";
import { requireChatGPTUser } from "../chatgpt-auth";
import OwnerQaActivate from "./OwnerQaActivate";

export const dynamic = "force-dynamic";

export default async function OwnerQaPage() {
  const user = await requireChatGPTUser("/owner-qa");
  return <main className="owner-qa-page"><section><span>SERVER-VERIFIED OWNER ACCESS</span><h1>Activate owner QA.</h1><p>You are signed in as <b>{user.email}</b>. Activation binds this verified account’s stable user ID to the internal owner player record and creates a secure device session.</p><ul><li>Unlimited QA analyses without Stripe</li><li>Normal security, file-size and abuse limits remain active</li><li>Excluded from product metrics and calibration by default</li></ul><OwnerQaActivate /><Link href="/">Return without activating</Link></section></main>;
}
