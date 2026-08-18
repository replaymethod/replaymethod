export const DETECTOR_LIFECYCLE = Object.freeze([
  "discovery",
  "candidate",
  "calibrating",
  "shadow",
  "enabled",
]);

export const DETECTOR_CATEGORIES = Object.freeze({
  boost: "Boost economy",
  rotation: "Positioning and rotation",
  challenge: "Challenges and decisions",
  recovery: "Recovery and tempo",
  possession: "Ball control and possession",
  offense: "Offense and creation",
  defense: "Defense and risk control",
  kickoff: "Kickoffs",
  teamplay: "Team coordination",
});

const definitions = [
  ["boost.low_exposure", "boost", "Low-boost exposure in a critical window", 1],
  ["boost.supersonic_waste", "boost", "Boost used while already supersonic", 1],
  ["boost.zero_duration", "boost", "Extended time at zero boost", 1],
  ["boost.overfill", "boost", "Boost-pad overfill and route inefficiency", 1],
  ["boost.large_pad_detour", "boost", "Large-pad detour that abandons the play", 2],
  ["boost.small_pad_blindness", "boost", "Small-pad route opportunity missed", 2],
  ["boost.teammate_starvation", "boost", "Boost route starves teammate coverage", 3],
  ["boost.defensive_reserve", "boost", "Insufficient reserve before defensive transition", 2],

  ["rotation.caught_ahead", "rotation", "Caught ahead of the ball during transition", 1],
  ["rotation.third_overextension", "rotation", "Last-player overextension", 1],
  ["rotation.cut", "rotation", "Rotation cut removes teammate's turn", 2],
  ["rotation.same_lane", "rotation", "Teammates occupy the same lane", 2],
  ["rotation.spacing_too_close", "rotation", "Spacing collapses reaction time", 1],
  ["rotation.spacing_too_far", "rotation", "Spacing removes useful support", 2],
  ["rotation.back_post_bypass", "rotation", "Defensive rotation bypasses back post", 2],
  ["rotation.goal_side_loss", "rotation", "Goal-side position is surrendered", 2],
  ["rotation.backboard_uncovered", "rotation", "Backboard threat is left uncovered", 3],

  ["challenge.dive", "challenge", "Low-coverage dive challenge", 1],
  ["challenge.late", "challenge", "Late challenge concedes space and options", 2],
  ["challenge.fake_opportunity", "challenge", "Fake-challenge opportunity missed", 3],
  ["challenge.teammate_coverage", "challenge", "Challenge taken without teammate coverage", 2],
  ["challenge.low_probability_aerial", "challenge", "Low-probability aerial commitment", 3],
  ["challenge.last_player", "challenge", "Last-player challenge creates open net risk", 1],
  ["challenge.advantage_state", "challenge", "Challenge choice ignores score/time state", 3],

  ["recovery.landing_orientation", "recovery", "Landing orientation delays the next action", 1],
  ["recovery.post_aerial_exit", "recovery", "Slow exit after aerial involvement", 2],
  ["recovery.wall_to_ground", "recovery", "Wall-to-ground recovery loses tempo", 2],
  ["recovery.demolition_reentry", "recovery", "Respawn route fails to restore coverage", 3],
  ["recovery.momentum_loss", "recovery", "Unforced momentum loss", 2],
  ["recovery.play_reentry", "recovery", "Recovery path delays useful re-entry", 2],

  ["possession.first_touch", "possession", "First touch removes control", 1],
  ["possession.giveaway", "possession", "Possession is returned without pressure", 1],
  ["possession.panic_clear", "possession", "Panic clear feeds the opponent", 2],
  ["possession.control_space", "possession", "Available control space is not used", 2],
  ["possession.touch_frequency", "possession", "Extra touch reduces the next option", 3],
  ["possession.wall_control", "possession", "Wall possession breaks down early", 3],

  ["offense.shot_quality", "offense", "Low-threat shot ends a stronger possession", 2],
  ["offense.open_net_execution", "offense", "Open-net opportunity is not converted", 2],
  ["offense.pass_lane", "offense", "Higher-value pass lane is missed", 3],
  ["offense.center_to_opponent", "offense", "Centering touch favors the opponent", 2],
  ["offense.follow_up", "offense", "Shot follow-up structure breaks down", 2],
  ["offense.backboard_use", "offense", "Backboard creation opportunity is missed", 3],

  ["defense.clear_direction", "defense", "Clear direction sustains opponent pressure", 1],
  ["defense.near_post_trap", "defense", "Near-post positioning limits save options", 2],
  ["defense.corner_overcommit", "defense", "Defensive-corner overcommit opens the middle", 2],
  ["defense.goal_line_congestion", "defense", "Goal-line congestion duplicates coverage", 2],
  ["defense.shadow_distance", "defense", "Shadow distance gives away the decisive option", 3],
  ["defense.post_save_recovery", "defense", "Post-save action fails to relieve pressure", 2],

  ["kickoff.speed", "kickoff", "Kickoff arrival is consistently late", 2],
  ["kickoff.contact", "kickoff", "Kickoff contact loses goal-side leverage", 2],
  ["kickoff.cheat_distance", "kickoff", "Cheat distance misses the likely outcome", 3],
  ["kickoff.role_compliance", "kickoff", "Kickoff role leaves an immediate coverage gap", 2],

  ["teamplay.double_commit", "teamplay", "Double commit removes layered coverage", 1],
  ["teamplay.support_angle", "teamplay", "Support angle removes pass or challenge options", 2],
  ["teamplay.role_overlap", "teamplay", "Role overlap leaves useful space empty", 2],
  ["teamplay.trust_break", "teamplay", "Intervention overrides a covered teammate", 3],
  ["teamplay.transition_balance", "teamplay", "Transition lacks attack-defense balance", 3],
];

export const ROCKET_LEAGUE_DETECTOR_CATALOG = Object.freeze(definitions.map(
  ([id, category, title, phase]) => Object.freeze({
    id,
    category,
    title,
    phase,
    lifecycle: "discovery",
    public: false,
    requirements: Object.freeze([
      "frame-state",
      "episode-segmentation",
      "timestamp-verification",
      "expert-labels",
      "rank-mode-baseline",
    ]),
  }),
));

export function detectorCatalogSummary(catalog = ROCKET_LEAGUE_DETECTOR_CATALOG) {
  const byCategory = Object.fromEntries(Object.keys(DETECTOR_CATEGORIES).map((key) => [key, 0]));
  const byLifecycle = Object.fromEntries(DETECTOR_LIFECYCLE.map((key) => [key, 0]));
  for (const detector of catalog) {
    byCategory[detector.category] = (byCategory[detector.category] ?? 0) + 1;
    byLifecycle[detector.lifecycle] = (byLifecycle[detector.lifecycle] ?? 0) + 1;
  }
  return {
    total: catalog.length,
    public: catalog.filter((detector) => detector.public).length,
    byCategory,
    byLifecycle,
  };
}
