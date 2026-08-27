import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";

const defaultPort = 5176;
const requestedPort = Number.parseInt(process.env.RL_LOCAL_REVIEW_PORT || String(defaultPort), 10);
const port = Number.isInteger(requestedPort) && requestedPort >= 1024 && requestedPort <= 65535
  ? requestedPort
  : defaultPort;

function accessCode(configured) {
  return configured && configured.length >= 32 ? configured : randomBytes(32).toString("hex");
}

const ownerToken = accessCode(process.env.RL_LOCAL_REVIEW_OWNER_TOKEN);
let reviewerToken = accessCode(process.env.RL_LOCAL_REVIEWER_TOKEN);
while (reviewerToken === ownerToken) reviewerToken = randomBytes(32).toString("hex");

const environment = {
  ...process.env,
  RL_LOCAL_REVIEW_ENABLED: "true",
  RL_LOCAL_REVIEW_OWNER_TOKEN: ownerToken,
  RL_LOCAL_REVIEWER_TOKEN: reviewerToken,
  RL_LOCAL_REVIEW_STATE_PATH: process.env.RL_LOCAL_REVIEW_STATE_PATH || ".wrangler/local-review-state",
};

console.log(`\nReplay Method private Review Lab: http://127.0.0.1:${port}/local-review-access`);
console.log(`OWNER CODE (do not share): ${ownerToken}`);
console.log(`REVIEWER CODE (share only with invited reviewers): ${reviewerToken}`);
console.log("Codes live only for this local server process. They are never written to disk or placed in a URL.\n");

const child = spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(port)], {
  env: environment,
  stdio: "inherit",
  shell: false,
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
