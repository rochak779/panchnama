#!/usr/bin/env node
// implementation.md §14 Session 19: "check performance and reduce
// oversized client bundles/artifacts." Runs `next build` and parses its
// own "First Load JS" column per route (the same de-duplicated metric
// Next reports in its terminal output) rather than re-summing raw chunk
// files from the build manifest — a naive per-route sum of
// app-build-manifest.json's file lists double-counts chunks shared across
// routes and produces numbers 3-4x too high (verified while writing this
// script: a manifest-summing approach read ~343-440 KB per route, while
// `next build`'s own reported First Load JS for the same build was
// 102-129 KB — this script uses the latter, correct figure).
import { execSync } from "node:child_process";

// Measured directly from a real `next build`'s own terminal output at the
// time this script was written (2026-09-03): every route's First Load JS
// falls between 102 KB and 129 KB, with /portals/[portalId]/share-experience
// the largest at 129 KB. 250 KB is set as a regression ceiling with
// meaningful headroom above that real measured max — not a target to grow
// into, and not loosened just to make a failing page pass; if a future
// change pushes a route over 250 KB, investigate what grew before raising
// this number.
const BUDGET_KB = 250;

// Runs the real `build` script (build:exports && next build), not a bare
// `next build`, so this measures the same app that actually ships —
// `next build` alone would skip build:exports and could measure a
// different bundle than production.
const output = execSync("pnpm run build", { cwd: process.cwd(), encoding: "utf8" });
console.info(output);

// Matches lines like:
//   ├ ○ /                                                          782 B         106 kB
//   └ ● /portals/[portalId]/share-experience                     4.63 kB         129 kB
// Route-symbol lines only (○/●/ƒ) — nested sub-path lines (e.g.
// "├   ├ /portals/portal-agri-assam") have no trailing size and are
// correctly skipped since they don't match this pattern.
const routeLinePattern = /[○●ƒ]\s+(\S+)\s+.*?(\d+(?:\.\d+)?)\s*(kB|B)\s*$/;

let anyOverBudget = false;
let matchedAnyRoute = false;
for (const line of output.split("\n")) {
  const match = routeLinePattern.exec(line.trimEnd());
  if (!match) continue;
  const [, route, sizeStr, unit] = match;
  const firstLoadKb = unit === "kB" ? Number(sizeStr) : Number(sizeStr) / 1024;
  matchedAnyRoute = true;
  const overBudget = firstLoadKb > BUDGET_KB;
  if (overBudget) anyOverBudget = true;
  console.info(
    `${overBudget ? "❌" : "✅"} ${route}: ${firstLoadKb.toFixed(1)} kB First Load JS` +
      (overBudget ? ` (budget: ${BUDGET_KB} kB)` : ""),
  );
}

if (!matchedAnyRoute) {
  console.error(
    "Bundle-size check: parsed zero routes from `next build` output — its table format may have changed; update routeLinePattern.",
  );
  process.exit(1);
}
if (anyOverBudget) {
  console.error("\nOne or more routes exceed the bundle-size budget.");
  process.exit(1);
}
console.info("\nAll routes within the bundle-size budget.");
