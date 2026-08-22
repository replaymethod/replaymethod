import { parentPort } from "node:worker_threads";
import { analyzeReplay } from "./analyzer.mjs";
import { initializeParser, inspectReplay } from "./parser.mjs";

if (!parentPort) {
  throw new Error("The replay analysis worker must run in a worker thread.");
}

initializeParser();
parentPort.postMessage({ type: "ready" });

parentPort.on("message", ({ jobId, operation, bytes, player, rank, publicOutputEnabled }) => {
  try {
    const result = operation === "inspect"
      ? { kind: "inspection", normalized: inspectReplay(bytes, player, rank) }
      : analyzeReplay(bytes, player, rank, { publicOutputEnabled });
    parentPort.postMessage({ jobId, ok: true, result });
  } catch (error) {
    parentPort.postMessage({
      jobId,
      ok: false,
      error: {
        name: error?.name,
        code: error?.code,
        publicMessage: error?.publicMessage,
        candidatePlayers: error?.candidatePlayers,
        replayContext: error?.replayContext,
        message: error instanceof Error ? error.message : "Unknown replay worker failure.",
      },
    });
  }
});
