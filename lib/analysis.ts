export const analysisGames = ["league", "valorant", "rocket-league"] as const;
export type AnalysisGame = (typeof analysisGames)[number];
export type AnalysisStatus = "received" | "analyzing" | "blocked" | "failed" | "ready";

export const gameLabels: Record<AnalysisGame, string> = {
  league: "League of Legends",
  valorant: "VALORANT",
  "rocket-league": "Rocket League"
};

export const isAnalysisGame = (value: string): value is AnalysisGame =>
  analysisGames.includes(value as AnalysisGame);

export const cleanText = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

export const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const publicIdPattern = /^[a-f0-9]{32}$/;

export function parseLines(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter(item => typeof item === "string").slice(0, 12) : [];
  } catch {
    return value.split("\n").map(line => line.trim()).filter(Boolean).slice(0, 12);
  }
}

export const reportUrl = (origin: string, publicId: string) =>
  new URL(`/report/${publicId}`, origin).toString();
