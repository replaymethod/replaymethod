"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ProductReviewerAccessForm({ reviewer }: { reviewer: { id: number; status: string; reviewKind: string | null } }) {
  const router = useRouter();
  const [reviewKind, setReviewKind] = useState(reviewer.reviewKind ?? "commercial");
  const [state, setState] = useState("idle");

  async function update(status: "active" | "revoked") {
    setState("saving");
    const response = await fetch("/api/admin/product-reviewers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: reviewer.id, status, reviewKind })
    });
    setState(response.ok ? "saved" : "error");
    if (response.ok) router.refresh();
  }

  async function remove() {
    if (!window.confirm("Permanently delete this product reviewer, review drafts, final submission and private evidence files?")) return;
    setState("saving");
    const response = await fetch("/api/admin/product-reviewers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: reviewer.id, confirmation: "DELETE" })
    });
    setState(response.ok ? "saved" : "error");
    if (response.ok) router.refresh();
  }

  return <div className="product-reviewer-access-form"><label><span>Review lane</span><select aria-label="Product review lane" value={reviewKind} onChange={event => setReviewKind(event.target.value)}><option value="commercial">Commercial</option><option value="ux">UX / funnel</option></select></label>{reviewer.status !== "active" ? <button type="button" disabled={state === "saving"} onClick={() => update("active")}>Approve</button> : <button type="button" disabled={state === "saving"} onClick={() => update("revoked")}>Revoke</button>}<button className="danger" type="button" disabled={state === "saving"} onClick={remove}>Delete data</button><small>{state === "error" ? "Could not save" : state === "saved" ? "Saved" : ""}</small></div>;
}
