"use client";

import { useState } from "react";

export default function DeleteLeadButton({ id, email }: { id: number; email: string }) {
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!window.confirm(`Remove ${email} from the Replay Method waitlist?`)) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/waitlist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      if (!response.ok) throw new Error("Delete failed");
      window.location.reload();
    } catch {
      window.alert("Could not remove this signup. Please try again.");
      setBusy(false);
    }
  }

  return <button className="admin-delete" type="button" onClick={remove} disabled={busy}>{busy ? "Removing…" : "Remove"}</button>;
}
