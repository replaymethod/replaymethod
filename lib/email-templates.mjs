export function escapeEmailHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character]);
}

function shell(content, preview) {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width"><meta name="color-scheme" content="dark"><title>${escapeEmailHtml(preview)}</title></head><body style="margin:0;background:#050711;color:#f7f8ff;font-family:Arial,sans-serif"><div style="display:none;max-height:0;overflow:hidden">${escapeEmailHtml(preview)}</div><div style="max-width:620px;margin:auto;padding:42px 24px"><div style="font-weight:900;font-size:21px;margin-bottom:34px">replay<span style="color:#29dfff">method</span></div>${content}<p style="margin-top:38px;color:#69738d;font-size:12px;line-height:1.6">This is a transactional message about an analysis you requested. It is separate from optional product updates.</p><p style="color:#69738d;font-size:12px;line-height:1.6">Replay Method is an independent beta and is not affiliated with Riot Games, Psyonix or Epic Games. Questions: <a href="mailto:contact@replaymethod.xyz" style="color:#8eeeff">contact@replaymethod.xyz</a>.</p></div></body></html>`;
}

export function analysisReceivedEmail({ gameLabel, url }) {
  const safeGame = String(gameLabel).slice(0, 80);
  const safeUrl = escapeEmailHtml(url);
  return {
    subject: `We received your ${safeGame} analysis`,
    text: `MATCH RECEIVED\n\nYour evidence is in the queue. Replay Method will look for one repeated, high-impact decision and stop safely if the evidence is insufficient.\n\nVerify ownership and track the analysis using this one-time link (expires after seven days):\n${url}\n\nThis transactional message is separate from optional product updates.`,
    html: shell(`<p style="color:#61ebb1;font-weight:800;letter-spacing:.08em">MATCH RECEIVED</p><h1 style="font-size:34px;line-height:1.05">Your evidence is in the queue.</h1><p style="color:#a4acc0;line-height:1.7">Replay Method will process the match for one repeated, high-impact decision and stop safely if the available evidence is insufficient.</p><p style="color:#7f899f;line-height:1.6;font-size:13px">This one-time link verifies report ownership and keeps your Replay Method history available on this device. It expires after seven days.</p><a href="${safeUrl}" style="display:inline-block;margin-top:18px;padding:16px 21px;border-radius:9px;background:#6f54ff;color:white;text-decoration:none;font-weight:800">Verify and track my analysis →</a>`, `Your ${safeGame} evidence is in the queue.`),
  };
}

export function analysisReadyEmail({ gameLabel, url, mistake }) {
  const safeGame = escapeEmailHtml(String(gameLabel).slice(0, 80));
  const safeUrl = escapeEmailHtml(url);
  const safeMistake = escapeEmailHtml(String(mistake).slice(0, 500));
  return {
    subject: "Your Replay Method report is ready",
    text: `REPORT READY · ${String(gameLabel).toUpperCase()}\n\nWe found the pattern.\n\nYour highest-impact mistake:\n${mistake}\n\nOpen your private report:\n${url}\n\nThis transactional message is separate from optional product updates.`,
    html: shell(`<p style="color:#61ebb1;font-weight:800;letter-spacing:.08em">REPORT READY · ${safeGame.toUpperCase()}</p><h1 style="font-size:34px;line-height:1.05">We found the pattern.</h1><p style="color:#a4acc0;line-height:1.7"><b style="color:#fff">Your highest-impact mistake:</b><br>${safeMistake}</p><a href="${safeUrl}" style="display:inline-block;margin-top:18px;padding:16px 21px;border-radius:9px;background:#6f54ff;color:white;text-decoration:none;font-weight:800">Open my report →</a>`, "Your Replay Method report is ready."),
  };
}

export function replayBatchReceivedEmail({ url }) {
  const safeUrl = escapeEmailHtml(url);
  return {
    subject: "Your free 10-replay baseline is saved",
    text: `TEN-REPLAY BASELINE STARTED\n\nYour private batch is saved and resumable. The report is released only after ten valid Rocket League replays from the same player and playlist. Invalid or duplicate files can be replaced without consuming a valid slot.\n\nContinue your private batch:\n${url}\n\nNo card or payment is required.`,
    html: shell(`<p style="color:#61ebb1;font-weight:800;letter-spacing:.08em">TEN-REPLAY BASELINE STARTED</p><h1 style="font-size:34px;line-height:1.05">Your private batch is saved.</h1><p style="color:#a4acc0;line-height:1.7">Your report unlocks at exactly ten valid Rocket League replays from the same player and playlist. Invalid or duplicate files can be replaced without consuming a valid slot.</p><a href="${safeUrl}" style="display:inline-block;margin-top:18px;padding:16px 21px;border-radius:9px;background:#6f54ff;color:white;text-decoration:none;font-weight:800">Continue my 10-replay baseline →</a>`, "Your free ten-replay baseline is saved and resumable."),
  };
}

export function replayBatchReadyEmail({ url, focus, hasPlan }) {
  const safeUrl = escapeEmailHtml(url);
  const safeFocus = escapeEmailHtml(String(focus).slice(0, 500));
  return {
    subject: "Your 10-match Replay Method report is ready",
    text: `TEN-MATCH REPORT READY\n\n${hasPlan ? `Recurring focus:\n${focus}` : "No coaching pattern cleared the cross-match evidence gate. Your complete facts-only baseline is ready."}\n\nOpen your private report:\n${url}\n\nThe complete ten-match report is free. There is no checkout.`,
    html: shell(`<p style="color:#61ebb1;font-weight:800;letter-spacing:.08em">TEN-MATCH REPORT READY</p><h1 style="font-size:34px;line-height:1.05">${hasPlan ? "One recurring focus cleared the gate." : "The honest result is facts only."}</h1><p style="color:#a4acc0;line-height:1.7">${hasPlan ? `<b style="color:#fff">Recurring focus:</b><br>${safeFocus}` : "No coaching pattern recurred strongly enough across all ten matches. Your verified baseline still remains complete."}</p><a href="${safeUrl}" style="display:inline-block;margin-top:18px;padding:16px 21px;border-radius:9px;background:#6f54ff;color:white;text-decoration:none;font-weight:800">Open my 10-match report →</a>`, "Your ten-match Replay Method report is ready."),
  };
}
