"use client";

import { KeyboardEvent, useEffect, useId, useMemo, useState } from "react";

export type ReplayMoment = {
  candidateKey: string;
  replayFingerprint: string;
  detectorId: string;
  centerTimeSeconds: number;
  durationSeconds: number;
  sampleRateHz: number;
  roster: Array<{ id: string; team: number; subject: boolean }>;
  frames: Array<{
    t: number;
    r: number | null;
    b: [number | null, number | null, number | null];
    p: Array<[number | null, number | null, number | null, number | null, number | null, number | null]>;
  }>;
};

const field = { width: 820, height: 1020, inset: 30 };
const teamColor = (team: number) => team === 0 ? "#28bfff" : "#ff9a3c";
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function point(x: number | null, y: number | null) {
  if (x == null || y == null) return null;
  return {
    x: field.inset + ((x + 4096) / 8192) * (field.width - field.inset * 2),
    y: field.inset + (1 - ((y + 5120) / 10240)) * (field.height - field.inset * 2),
  };
}

function clock(seconds: number | null) {
  if (seconds == null) return "—";
  const safe = Math.max(0, Math.round(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

export default function ReplayMomentViewer({ moment }: { moment: ReplayMoment }) {
  const [frameIndex, setFrameIndex] = useState(() => Math.max(0, moment.frames.findIndex((frame) => frame.t >= 0)));
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const markerId = useId().replaceAll(":", "");
  const eventFrameIndex = useMemo(() => {
    const index = moment.frames.findIndex((frame) => frame.t >= 0);
    return index < 0 ? Math.max(0, moment.frames.length - 1) : index;
  }, [moment.frames]);

  useEffect(() => {
    if (!playing || moment.frames.length < 2) return;
    const timer = window.setInterval(() => {
      setFrameIndex((current) => current >= moment.frames.length - 1 ? 0 : current + 1);
    }, 1000 / (moment.sampleRateHz * speed));
    return () => window.clearInterval(timer);
  }, [playing, speed, moment.frames.length, moment.sampleRateHz]);

  const frame = moment.frames[frameIndex] ?? moment.frames[0];
  const ball = point(frame?.b[0] ?? null, frame?.b[1] ?? null);
  const trailStart = Math.max(0, frameIndex - 8);
  const ballTrail = moment.frames.slice(trailStart, frameIndex + 1)
    .map((item) => point(item.b[0], item.b[1]))
    .filter((item): item is { x: number; y: number } => Boolean(item));

  function keyboard(event: KeyboardEvent<HTMLElement>) {
    if (event.key === " ") {
      event.preventDefault();
      setPlaying((value) => !value);
    }
    if (event.key === "ArrowLeft") setFrameIndex((value) => Math.max(0, value - 1));
    if (event.key === "ArrowRight") setFrameIndex((value) => Math.min(moment.frames.length - 1, value + 1));
  }

  return <section className="rl-moment-viewer" tabIndex={0} onKeyDown={keyboard} aria-label="Interactive anonymized Rocket League replay moment">
    <header><div><span>ANONYMIZED REPLAY MOMENT</span><b>{(frame?.t ?? 0) >= 0 ? "+" : ""}{(frame?.t ?? 0).toFixed(1)}s from detector event</b></div><div><span>MATCH CLOCK</span><b>{clock(frame?.r ?? null)}</b></div></header>
    <div className="rl-field-wrap">
      <svg viewBox={`0 0 ${field.width} ${field.height}`} role="img" aria-label="Top-down Rocket League field showing the ball and anonymized players">
        <defs><marker id={markerId} markerWidth="8" markerHeight="8" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" fill="currentColor" /></marker></defs>
        <rect className="rl-field" x="30" y="30" width="760" height="960" rx="42" />
        <path className="rl-field-line" d="M30 510H790M410 30V990" />
        <circle className="rl-field-line" cx="410" cy="510" r="92" />
        <path className="rl-field-line" d="M315 30V94H505V30M315 990V926H505V990" />
        <path className="rl-goal-blue" d="M342 30V7H478V30" />
        <path className="rl-goal-orange" d="M342 990V1013H478V990" />
        {ballTrail.length > 1 && <polyline className="rl-ball-trail" points={ballTrail.map((item) => `${item.x},${item.y}`).join(" ")} />}
        {frame?.p.map((player, index) => {
          const mapped = point(player[0], player[1]);
          if (!mapped) return null;
          const roster = moment.roster[index];
          const color = teamColor(roster?.team ?? 0);
          const velocity = Math.hypot(player[4] ?? 0, player[5] ?? 0);
          const lineScale = Math.min(46, velocity / 45);
          const lineEnd = point(
            player[0] == null ? null : player[0] + ((player[4] ?? 0) / Math.max(1, velocity)) * lineScale * 10,
            player[1] == null ? null : player[1] + ((player[5] ?? 0) / Math.max(1, velocity)) * lineScale * 10,
          );
          return <g key={roster?.id ?? index} style={{ color }}>
            {lineEnd && <line className="rl-player-vector" x1={mapped.x} y1={mapped.y} x2={lineEnd.x} y2={lineEnd.y} markerEnd={`url(#${markerId})`} />}
            {roster?.subject && <circle className="rl-subject-ring" cx={mapped.x} cy={mapped.y} r="26" />}
            <circle className="rl-player" cx={mapped.x} cy={mapped.y} r="17" />
            <text className="rl-player-label" x={mapped.x} y={mapped.y + 4}>{roster?.id ?? `P${index + 1}`}</text>
            <rect className="rl-boost-track" x={mapped.x - 20} y={mapped.y + 23} width="40" height="5" rx="2.5" />
            <rect className="rl-boost-fill" x={mapped.x - 20} y={mapped.y + 23} width={40 * clamp((player[3] ?? 0) / 100, 0, 1)} height="5" rx="2.5" />
          </g>;
        })}
        {ball && <g><circle className="rl-ball-shadow" cx={ball.x + 4} cy={ball.y + 6} r="16" /><circle className="rl-ball" cx={ball.x} cy={ball.y} r={14 + clamp((frame.b[2] ?? 0) / 500, 0, 7)} /><text className="rl-ball-height" x={ball.x + 23} y={ball.y - 17}>{Math.max(0, Math.round(frame.b[2] ?? 0))}u</text></g>}
      </svg>
      <div className="rl-field-legend"><span><i className="subject" /> Focus player</span><span><i className="blue" /> Blue</span><span><i className="orange" /> Orange</span><span>Arrow = movement</span><span>Bar = boost</span></div>
    </div>
    <div className="rl-playback-controls">
      <button type="button" onClick={() => setPlaying((value) => !value)}>{playing ? "Pause" : "Play"}</button>
      <button type="button" onClick={() => { setPlaying(false); setFrameIndex(eventFrameIndex); }}>Event</button>
      <input aria-label="Replay timeline" type="range" min="0" max={Math.max(0, moment.frames.length - 1)} value={frameIndex} onChange={(event) => { setPlaying(false); setFrameIndex(Number(event.target.value)); }} />
      <select aria-label="Playback speed" value={speed} onChange={(event) => setSpeed(Number(event.target.value))}><option value="0.5">0.5×</option><option value="1">1×</option><option value="2">2×</option></select>
    </div>
    <footer><span>{frameIndex + 1} / {moment.frames.length} frames</span><span>Space: play/pause · ← →: step frame</span><span>Player identities removed</span></footer>
  </section>;
}
