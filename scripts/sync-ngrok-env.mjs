#!/usr/bin/env node
/**
 * Reads the active ngrok tunnel URL and updates AUTH_URL in .env
 * Run: node scripts/sync-ngrok-env.mjs
 * Then restart: npm run dev
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env");

async function getNgrokUrl() {
  const res = await fetch("http://127.0.0.1:4040/api/tunnels");
  const data = await res.json();
  const tunnel = data.tunnels?.find(
    (t) => t.proto === "https" && t.public_url
  );
  if (!tunnel) throw new Error("No ngrok HTTPS tunnel found. Run: ngrok http 3000");
  return tunnel.public_url;
}

function updateEnv(url) {
  let content = fs.readFileSync(envPath, "utf8");
  const lines = content.split("\n");
  const keys = ["AUTH_URL", "NEXTAUTH_URL"];
  const updated = new Set();

  const newLines = lines.map((line) => {
    for (const key of keys) {
      if (line.startsWith(`${key}=`)) {
        updated.add(key);
        return `${key}="${url}"`;
      }
    }
    return line;
  });

  for (const key of keys) {
    if (!updated.has(key)) newLines.push(`${key}="${url}"`);
  }

  fs.writeFileSync(envPath, newLines.join("\n").replace(/\n*$/, "\n"));
}

try {
  const url = await getNgrokUrl();
  updateEnv(url);
  console.log("\n✓ Updated .env with ngrok URL:");
  console.log(`  AUTH_URL="${url}"`);
  console.log("\nNext steps:");
  console.log("  1. Restart the dev server (Ctrl+C, then npm run dev)");
  console.log(`  2. Share this link with your client:\n     ${url}\n`);
} catch (err) {
  console.error("Error:", err.message);
  process.exit(1);
}
