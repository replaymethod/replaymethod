import type { GameId, NormalizedMatch, StructuredFinding } from "./core/contracts";

export type RiotGameId = Extract<GameId, "league" | "valorant">;

export type AuthorizedRiotAccount = {
  game: RiotGameId;
  puuid: string;
  routingRegion: string;
};

export type RiotMatchReference = {
  providerMatchId: string;
  routingRegion: string;
  occurredAt?: string;
};

/**
 * Boundary for data returned by approved official APIs. Payloads remain
 * unknown until a game-specific validator accepts the production schema.
 */
export type OfficialRiotMatchBundle = {
  account: AuthorizedRiotAccount;
  matches: readonly RiotMatchReference[];
  matchPayloads: readonly unknown[];
  timelinePayloads: readonly unknown[];
};

export type RiotAdapterOutput = {
  normalized: readonly NormalizedMatch[];
  findings: readonly StructuredFinding[];
};

export interface RiotIngestionClient {
  fetchAuthorizedMatches(account: AuthorizedRiotAccount, signal: AbortSignal): Promise<OfficialRiotMatchBundle>;
}
