import { parentPort } from "node:worker_threads";
import { analyzeReplay } from "./analyzer.mjs";
import { inspectReplay } from "./parser.mjs";

if (!parentPort) {
  throw new Error("The replay analysis worker must run in a worker thread.");
}

parentPort.once("message", ({ operation, bytes, player, rank, publicOutputEnabled }) => {
  try {
    const result = operation === "inspect"
      ? { kind: "inspection", normalized: inspectReplay(bytes, player, rank) }
      : analyzeReplay(bytes, player, rank, { publicOutputEnabled });
    parentPort.postMessage({ ok: true, result });
  } catch (error) {
    parentPort.postMessage({
      ok: false,
      error: {
        name: error?.name,
        code: error?.code,
        publicMessage: error?.publicMessage,
        message: error instanceof Error ? error.message : "Unknown replay worker failure.",
      },
    });
  }
});
