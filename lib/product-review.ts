export const PRODUCT_REVIEW_VERSION = "product-review.v1";

export type ProductReviewKind = "commercial" | "ux";

export type ProductReviewSection = {
  key: string;
  label: string;
  prompt: string;
};

export const PRODUCT_REVIEW_SECTIONS: Record<ProductReviewKind, ProductReviewSection[]> = {
  commercial: [
    { key: "purchase_intent", label: "Purchase intent", prompt: "Is the first paid outcome valuable and believable enough to buy?" },
    { key: "conversion", label: "Conversion", prompt: "Where does interest strengthen or collapse before the primary action?" },
    { key: "free_to_paid", label: "Free → paid", prompt: "Does the free diagnosis naturally create demand for continued improvement?" },
    { key: "pricing", label: "Pricing", prompt: "Are packaging, price anchors and perceived risk commercially coherent?" },
    { key: "retention", label: "Retention", prompt: "What gives a player a reason to return after the first result?" },
    { key: "ltv", label: "LTV", prompt: "Which repeat-value mechanism could sustain customer lifetime value?" },
    { key: "acquisition", label: "Acquisition", prompt: "Can the promise and proof travel credibly through a concrete channel?" },
    { key: "ai_defensibility", label: "AI defensibility", prompt: "What compounds into a defensible evidence or learning advantage?" },
    { key: "commercial_risk", label: "Commercial risks", prompt: "Which claim, dependency or behavior could make the business fail?" }
  ],
  ux: [
    { key: "comprehension", label: "Comprehension", prompt: "Can a new player explain what happens and why it matters?" },
    { key: "decisions_clicks", label: "Decisions & clicks", prompt: "Which decision or click is unnecessary on the main path?" },
    { key: "feedback_speed", label: "Feedback speed", prompt: "Does every action receive immediate, truthful feedback?" },
    { key: "narrative", label: "Red thread", prompt: "Does one coherent improvement story connect entry, evidence and next action?" },
    { key: "friction", label: "Friction", prompt: "Where is progress slowed, confused or made to feel risky?" },
    { key: "app_feel", label: "App feel", prompt: "Does the product feel like a responsive tool instead of a marketing page?" },
    { key: "high_octane_simplicity", label: "High-octane simplicity", prompt: "Is the shortest honest path also the most obvious path?" }
  ]
};

export function isProductReviewKind(value: unknown): value is ProductReviewKind {
  return value === "commercial" || value === "ux";
}
