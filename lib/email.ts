import { gameLabels, type AnalysisGame } from "./analysis";

type EmailEnv = {
  RESEND_API_KEY?: string;
  ANALYSIS_FROM_EMAIL?: string;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]!);
}

async function sendEmail(to: string, subject: string, html: string) {
  const { env } = await import("cloudflare:workers");
  const emailEnv = env as unknown as EmailEnv;
  if (!emailEnv.RESEND_API_KEY || !emailEnv.ANALYSIS_FROM_EMAIL) return false;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${emailEnv.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: emailEnv.ANALYSIS_FROM_EMAIL,
      to: [to],
      reply_to: "contact@replaymethod.xyz",
      subject,
      html
    })
  });
  return response.ok;
}

function shell(content: string) {
  return `<!doctype html><html><body style="margin:0;background:#050711;color:#f7f8ff;font-family:Arial,sans-serif"><div style="max-width:620px;margin:auto;padding:42px 24px"><div style="font-weight:900;font-size:21px;margin-bottom:34px">↻ replay<span style="color:#29dfff">method</span></div>${content}<p style="margin-top:38px;color:#69738d;font-size:12px;line-height:1.6">Replay Method is an independent beta and is not affiliated with Riot Games, Psyonix or Epic Games.</p></div></body></html>`;
}

export async function sendAnalysisReceived(input: { email: string; game: AnalysisGame; url: string }) {
  return sendEmail(
    input.email,
    `We received your ${gameLabels[input.game]} analysis`,
    shell(`<p style="color:#61ebb1;font-weight:800;letter-spacing:.08em">MATCH RECEIVED</p><h1 style="font-size:34px;line-height:1.05">Your evidence is in the queue.</h1><p style="color:#a4acc0;line-height:1.7">Replay Method will process the match for one repeated, high-impact decision and stop safely if the available evidence is insufficient.</p><p style="color:#7f899f;line-height:1.6;font-size:13px">This one-time link verifies report ownership and keeps your Replay Method history available on this device. It expires after seven days.</p><a href="${escapeHtml(input.url)}" style="display:inline-block;margin-top:18px;padding:16px 21px;border-radius:9px;background:#6f54ff;color:white;text-decoration:none;font-weight:800">Verify and track my analysis →</a>`)
  );
}

export async function sendAnalysisReady(input: { email: string; game: AnalysisGame; url: string; mistake: string }) {
  return sendEmail(
    input.email,
    `Your Replay Method report is ready`,
    shell(`<p style="color:#61ebb1;font-weight:800;letter-spacing:.08em">REPORT READY · ${escapeHtml(gameLabels[input.game].toUpperCase())}</p><h1 style="font-size:34px;line-height:1.05">We found the pattern.</h1><p style="color:#a4acc0;line-height:1.7"><b style="color:#fff">Your highest-impact mistake:</b><br>${escapeHtml(input.mistake)}</p><a href="${escapeHtml(input.url)}" style="display:inline-block;margin-top:18px;padding:16px 21px;border-radius:9px;background:#6f54ff;color:white;text-decoration:none;font-weight:800">Open my report →</a>`)
  );
}
