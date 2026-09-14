import { spawn } from "node:child_process";
import { once } from "node:events";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const preview = args[0] === "--preview";
if ((!preview && args.length > 0) || (preview && args.length !== 2)) throw new Error("Usage: run-e2e.ts [--preview https://<preview-host>/]");
const baseUrl = preview ? new URL(args[1]!) : new URL("http://127.0.0.1:4173");
if (preview && baseUrl.protocol !== "https:") throw new Error("Preview URL must use HTTPS");
const server = preview ? undefined : spawn(process.execPath, [resolve("node_modules/vite/bin/vite.js"), "preview", "--host", "127.0.0.1", "--port", "4173", "--strictPort"], { stdio: "ignore" });

async function waitForServer(): Promise<void> {
  const attempts = preview ? 60 : 50;
  const delay = preview ? 2_000 : 100;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (server?.exitCode !== undefined && server.exitCode !== null) throw new Error(`Vite preview exited with ${server.exitCode}`);
    try { const response = await fetch(baseUrl); if (response.ok) return; } catch { /* retry */ }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, delay));
  }
  throw new Error(`${preview ? "Preview" : "Vite production preview"} did not become ready at ${baseUrl}`);
}

let exitCode = 1;
try {
  await waitForServer();
  const runner = spawn(process.execPath, [resolve("node_modules/@playwright/test/cli.js"), "test"], {
    stdio: "inherit",
    env: {
      ...process.env,
      METRO_VIEW_E2E_BASE_URL: baseUrl.href,
      ...(preview ? { METRO_VIEW_LIVE_MAP: "1", METRO_VIEW_REMOTE_PREVIEW: "1" } : {}),
    },
  });
  const [code] = await once(runner, "exit") as [number | null];
  exitCode = code ?? 1;
} finally {
  if (server?.exitCode === null) { server.kill(); await Promise.race([once(server, "exit"), new Promise((resolveDelay) => setTimeout(resolveDelay, 2_000))]); }
}
process.exitCode = exitCode;
