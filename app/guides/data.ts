export type Guide = {
  slug: string;
  game: string;
  gamePath: string;
  title: string;
  description: string;
  readTime: string;
  opening: string;
  scorecard: { label: string; question: string }[];
  sections: { title: string; body: string; bullets: string[] }[];
  nextRule: string;
  faq: { q: string; a: string }[];
};

export const guides: Guide[] = [
  {
    slug: "league-replay-review-checklist",
    game: "League of Legends",
    gamePath: "/league",
    title: "The League of Legends replay review checklist for hardstuck players",
    description: "Review a League loss in 15 minutes: lane conversion, objective setup, death quality and the 14–20 minute transition.",
    readTime: "8 MIN READ",
    opening: "Do not start with the final teamfight. Most League losses become difficult several minutes earlier through wave state, recall timing, vision and untraded deaths. This checklist finds the first repeatable decision you can change.",
    scorecard: [
      { label: "LEAD", question: "What did my first advantage change on the map?" },
      { label: "TEMPO", question: "Did I arrive before the objective decision or after it?" },
      { label: "DEATH", question: "What did the enemy gain, and what did my team trade?" },
      { label: "FOCUS", question: "What one rule would have prevented two or more mistakes?" }
    ],
    sections: [
      { title: "1. Review the first eight minutes at 2× speed", body: "You are not looking for every missed CS. Find the first decision that changed your options: a bad trade before a wave crashed, a recall that lost tempo, or a roam without a wave advantage.", bullets: ["Pause at the first recall and compare gold, wave and next objective.", "Mark deaths caused by a decision before the mechanical mistake.", "Ignore isolated micro errors unless the same setup appears repeatedly."] },
      { title: "2. Ask what your lane lead actually bought", body: "A CS lead is not yet map impact. Review the first tower plates, river movement, jungle entrance and objective setup. A useful lead creates priority, vision, a safe reset or pressure elsewhere.", bullets: ["Did you push before leaving lane?", "Did your movement force a response or only share farm?", "Was your shutdown risk justified by the play available?"] },
      { title: "3. Slow down the 14–20 minute transition", body: "This is where many winning lanes stop producing value. Side waves become unclear, teammates group without a reason and isolated river fights decide the next objective.", bullets: ["Check where the next two waves were before every group play.", "Pause 60 seconds before dragon or Herald and inspect recalls.", "Mark face-checks or fights with no objective trade available."] },
      { title: "4. Grade death quality, not just death count", body: "A death that secures Baron or a winning cross-map trade is different from a death 40 seconds before an objective. Label each death as traded, necessary, avoidable or late.", bullets: ["What information did you have five seconds earlier?", "Could a ward, wave or teammate have changed the decision?", "Did the same death setup happen twice?"] }
    ],
    nextRule: "For the next five games, start every objective plan 60 seconds early: fix the wave, recall, route, place vision, then choose the fight.",
    faq: [
      { q: "Should I review wins too?", a: "Yes. Review one close win after two losses. Wins reveal mistakes that were not punished and stop you from learning only from the result." },
      { q: "How many mistakes should I work on?", a: "One repeated decision at a time. A short rule you can recognize in-game is more useful than ten notes you forget in champion select." }
    ]
  },
  {
    slug: "valorant-vod-review-checklist",
    game: "VALORANT",
    gamePath: "/valorant",
    title: "A 15-minute VALORANT VOD review for ranked players",
    description: "Review first contact, tradeability, utility value and decisions after losing streaks without watching an entire VALORANT match.",
    readTime: "7 MIN READ",
    opening: "You do not need to rewatch all 24 rounds. Review the rounds with the highest information value: first deaths, man-advantage losses, failed retakes and the first round after a losing streak.",
    scorecard: [
      { label: "CONTACT", question: "Was my first fight planned, tradeable and escapable?" },
      { label: "UTILITY", question: "What decision did the ability enable or deny?" },
      { label: "ADVANTAGE", question: "Did we simplify after gaining numbers?" },
      { label: "ADAPT", question: "What changed after the enemy read our opener?" }
    ],
    sections: [
      { title: "1. Start with every first death", body: "Pause three seconds before first contact. Check teammate line of sight, trade distance, your escape route and the utility available. The aim duel is the final step of a setup.", bullets: ["Was the peek necessary for the plan?", "Could a teammate trade within two seconds?", "Did you repeat an opener the enemy had already seen?"] },
      { title: "2. Review man-advantage rounds", body: "Losing a 5v4 or 4v3 is usually more actionable than losing an even retake. Look for the moment the team stopped making the round smaller.", bullets: ["Who took the next isolated duel?", "Was utility saved for contact or spent without pressure?", "Did the spike and crossfires force the enemy to act?"] },
      { title: "3. Give every key ability a job", body: "Do not grade utility by whether it hit someone. Grade whether it took space, denied timing, enabled a trade or protected the conversion.", bullets: ["Was a teammate ready to act on the ability?", "Did it remove a dangerous angle or only make noise?", "What useful utility remained when you died?"] },
      { title: "4. Compare calm rounds with streak rounds", body: "After two losses, players often rush, re-peek or force hero plays. Compare your first three rounds with the first round after each losing streak.", bullets: ["Did your pace change without team agreement?", "Did you keep using the same opening position?", "Was the next duel lower quality than your earlier fights?"] }
    ],
    nextRule: "Before every barrier drop, name three things: my first job, my trade partner and my exit. If one is missing, choose a lower-variance opener.",
    faq: [
      { q: "Should I review aim mistakes?", a: "Only after checking fight quality. Aim training helps execution, but positioning, trade distance and timing decide how difficult the shot becomes." },
      { q: "What if I cannot record a full match?", a: "Clip first deaths, man-advantage losses and failed retakes. A small set of high-value rounds is enough to find a repeated pattern." }
    ]
  },
  {
    slug: "rocket-league-replay-review-checklist",
    game: "Rocket League",
    gamePath: "/rocket-league",
    title: "The Rocket League replay review checklist for hardstuck ranked players",
    description: "Review spacing, challenges, boost paths, recoveries and goals conceded in a focused Rocket League replay session.",
    readTime: "8 MIN READ",
    opening: "Do not watch only from your own camera and do not begin with missed mechanics. The best replay review asks why the play became mechanically difficult in the first place.",
    scorecard: [
      { label: "SPACE", question: "Did I preserve a useful layer behind my teammate?" },
      { label: "CHALLENGE", question: "What outcome was my challenge trying to create?" },
      { label: "BOOST", question: "Did my route keep me relevant to the play?" },
      { label: "RECOVERY", question: "What was my first action after the mistake?" }
    ],
    sections: [
      { title: "1. Review every goal from a wide camera", body: "Start five to eight seconds before the goal and watch all cars. The final miss is often less important than spacing, a boost detour or an unnecessary second-man commit.", bullets: ["Pause when your teammate crosses the ball line.", "Check whether anyone still protected the next dangerous touch.", "Mark two players occupying the same lane or height."] },
      { title: "2. Label each challenge by purpose", body: "A challenge can win possession, force the ball, buy time or prevent control. A challenge with no clear purpose often removes you and gives the opponent the next touch.", bullets: ["Was a teammate ready for the forced ball?", "Could a fake challenge have bought more time?", "Did the challenge leave a controlled recovery path?"] },
      { title: "3. Trace the boost route, not the boost number", body: "Low boost is not automatically a mistake. Leaving the play for a full pad can be worse than arriving with 36 boost through small pads.", bullets: ["Count full-boost detours that made you late.", "Look for small-pad routes through the rotation.", "Check whether you collected boost while facing the next play."] },
      { title: "4. Watch five seconds after every failed touch", body: "The recovery often decides whether one mistake becomes a goal. Grade landing direction, powerslide use, first turn and whether your route crossed a teammate.", bullets: ["Did you land wheels-down with useful momentum?", "Did you look at the ball before stabilizing the car?", "Was the shortest route also the safest rotation?"] }
    ],
    nextRule: "When your teammate commits beyond the ball, hold one useful layer deeper until possession is clear. Speed matters after spacing is correct.",
    faq: [
      { q: "How many replays should I review?", a: "Start with three close ranked games. One replay can be noisy; three are enough to test whether a spacing, challenge or boost habit repeats." },
      { q: "Should I review from the opponent's camera?", a: "Yes. It shows when you gave free control, telegraphed a challenge or applied pressure without needing to touch the ball." }
    ]
  }
];

export const guideBySlug = Object.fromEntries(guides.map(guide => [guide.slug, guide])) as Record<string, Guide>;
