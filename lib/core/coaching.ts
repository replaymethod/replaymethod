import { deterministicReport, type CoachingReport, type StructuredFinding } from "./contracts";
import { operationalErrorCode } from "../request-security.mjs";

type CoachingEnv = {
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  OPENAI_INPUT_COST_PER_MILLION?: string;
  OPENAI_OUTPUT_COST_PER_MILLION?: string;
};

const reportSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    primaryFindingId: { type: "string" },
    highestImpactMistake: { type: "string" },
    whyItCosts: { type: "string" },
    evidenceMoments: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 5 },
    nextQueueRule: { type: "string" },
    practicePlan: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 5 },
    coachNote: { type: "string" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    confidenceLabel: { type: "string", enum: ["high", "medium", "low", "insufficient"] },
    limitations: { type: "array", items: { type: "string" } }
  },
  required: ["primaryFindingId", "highestImpactMistake", "whyItCosts", "evidenceMoments", "nextQueueRule", "practicePlan", "coachNote", "confidence", "confidenceLabel", "limitations"]
} as const;

function responseText(payload: unknown) {
  const response = payload as { output?: { type?: string; content?: { type?: string; text?: string }[] }[] };
  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && content.text) return content.text;
    }
  }
  return "";
}

/**
 * The deterministic report is always valid on its own. The optional LLM only
 * improves prioritization language and must preserve finding/evidence IDs.
 */
export async function synthesizeCoaching(findings: StructuredFinding[], env: CoachingEnv): Promise<{ report: CoachingReport; costMicros: number; model: string }> {
  const fallback = deterministicReport(findings);
  if (!env.OPENAI_API_KEY) return { report: fallback, costMicros: 0, model: "deterministic" };

  const model = env.OPENAI_MODEL || "gpt-5.6";
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        store: false,
        max_output_tokens: 1200,
        input: [
          {
            role: "system",
            content: "You are Replay Method: concise, calm, rank-aware and evidence-first. Use only supplied findings. Never add gameplay facts, timestamps, causal claims or certainty. Select one primary leak. Keep every evidence sentence traceable to the supplied evidence. If support is weak, preserve the limitation."
          },
          { role: "user", content: JSON.stringify({ findings, deterministicDraft: fallback }) }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "replay_method_coaching_report",
            strict: true,
            schema: reportSchema
          }
        }
      })
    });
    if (!response.ok) throw new Error(`Coaching synthesis failed with HTTP ${response.status}.`);
    const payload = await response.json() as {
      output?: { type?: string; content?: { type?: string; text?: string }[] }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const text = responseText(payload);
    if (!text) throw new Error("Coaching synthesis returned no structured output.");
    const report = JSON.parse(text) as CoachingReport;
    const sourceIds = new Set(findings.map(finding => finding.id));
    if (!sourceIds.has(report.primaryFindingId)) throw new Error("Coaching selected a finding that does not exist.");
    const source = findings.find(finding => finding.id === report.primaryFindingId);
    if (!source) throw new Error("Coaching source finding could not be resolved.");
    // Evidence, confidence and actions remain deterministic detector output.
    // The language layer may explain and prioritize, never manufacture them.
    report.evidenceMoments = source.evidence.slice(0, 5).map(item => item.description);
    report.nextQueueRule = source.recommendation.queueRule;
    report.practicePlan = source.recommendation.practiceSteps.slice(0, 5);
    report.confidence = source.confidence;
    report.confidenceLabel = source.confidenceLabel;
    report.limitations = source.limitations;
    const inputRate = Number(env.OPENAI_INPUT_COST_PER_MILLION || 0);
    const outputRate = Number(env.OPENAI_OUTPUT_COST_PER_MILLION || 0);
    const costMicros = Math.max(0, Math.round(
      (payload.usage?.input_tokens || 0) * (Number.isFinite(inputRate) ? inputRate : 0) +
      (payload.usage?.output_tokens || 0) * (Number.isFinite(outputRate) ? outputRate : 0)
    ));
    return { report, costMicros, model };
  } catch (error) {
    console.warn("evidence-grounded coaching synthesis unavailable; using deterministic report", { code: operationalErrorCode(error) });
    return { report: fallback, costMicros: 0, model: `${model}-fallback` };
  }
}
