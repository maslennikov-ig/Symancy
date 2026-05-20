/**
 * Symancy — OpenRouter cost report generator.
 *
 * Pulls rows from `analysis_history` in the production Supabase project and
 * emits a Markdown report covering totals, per-analysis-type breakdown,
 * per-model breakdown, top-3 most expensive analyses, and basic performance
 * stats. Output is written to `docs/reports/costs/YYYY-MM.md` (month derived
 * from the `--to` boundary).
 *
 * Usage:
 *   pnpm tsx scripts/generate-cost-report.ts [--from YYYY-MM-DD] [--to YYYY-MM-DD]
 *
 * Defaults: last 30 days, ending today (UTC).
 *
 * Env:
 *   SUPABASE_URL          (or VITE_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY  (or SUPABASE_SERVICE_KEY — new naming)
 *
 * Sources searched, in order: process.env, ./.env, ./symancy-backend/.env.
 * Existing process.env wins; .env files only fill in missing keys.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { lookupPricing, averagePricePer1M, OPENROUTER_PRICING } from "./openrouter-pricing.js";

// -----------------------------------------------------------------------------
// Path resolution — script lives in <repo>/scripts, so repo root is one up.
// -----------------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..");

// -----------------------------------------------------------------------------
// Minimal .env loader (avoids pulling in `dotenv` as a dependency).
// Parses `KEY=value` lines, ignores blanks/comments, strips matching quotes.
// -----------------------------------------------------------------------------
function loadEnvFile(path: string): void {
  if (!existsSync(path)) return;
  const raw = readFileSync(path, "utf8");
  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(resolve(REPO_ROOT, ".env"));
loadEnvFile(resolve(REPO_ROOT, "symancy-backend/.env"));
// When running from inside .claude/worktrees/<branch>/, also look at the
// original repo root four levels up (worktrees are fresh checkouts that don't
// carry .env files).
loadEnvFile(resolve(REPO_ROOT, "../../../.env"));
loadEnvFile(resolve(REPO_ROOT, "../../../symancy-backend/.env"));

// -----------------------------------------------------------------------------
// CLI argument parsing — minimal regex over process.argv.
// -----------------------------------------------------------------------------
function parseArg(name: string): string | undefined {
  const re = new RegExp(`^--${name}(?:=(.*))?$`);
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    const m = arg.match(re);
    if (!m) continue;
    if (m[1] !== undefined) return m[1];
    // `--from 2026-01-01` form (value in next argv slot).
    const next = process.argv[i + 1];
    if (next && !next.startsWith("--")) return next;
    return "";
  }
  return undefined;
}

function isIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

const toArg = parseArg("to");
const fromArg = parseArg("from");

const now = new Date();
const toDate = toArg && isIsoDate(toArg) ? new Date(`${toArg}T23:59:59.999Z`) : new Date(now);
const fromDate = fromArg && isIsoDate(fromArg)
  ? new Date(`${fromArg}T00:00:00.000Z`)
  : new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000);

if (Number.isNaN(toDate.getTime()) || Number.isNaN(fromDate.getTime())) {
  console.error("ERROR: invalid --from or --to (expected YYYY-MM-DD).");
  process.exit(1);
}
if (fromDate > toDate) {
  console.error("ERROR: --from must be <= --to.");
  process.exit(1);
}

const fromIso = fromDate.toISOString();
const toIso = toDate.toISOString();
const fromDay = fromIso.slice(0, 10);
const toDay = toIso.slice(0, 10);

// Report filename uses the YYYY-MM of the `to` boundary.
const reportMonth = toIso.slice(0, 7); // e.g. "2026-05"

// -----------------------------------------------------------------------------
// Supabase client.
// -----------------------------------------------------------------------------
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY; // backend uses the new naming

if (!SUPABASE_URL) {
  console.error(
    "ERROR: SUPABASE_URL (or VITE_SUPABASE_URL) not set. Add it to .env or symancy-backend/.env.",
  );
  process.exit(1);
}
if (!SUPABASE_KEY) {
  console.error(
    "ERROR: SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY) not set. " +
      "Add it to .env or symancy-backend/.env. Service-role/secret key is required to bypass RLS.",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// -----------------------------------------------------------------------------
// Row shape (subset of analysis_history columns we care about).
// -----------------------------------------------------------------------------
interface AnalysisRow {
  id: string;
  analysis_type: string;
  vision_model_used: string | null;
  vision_tokens_used: number | null;
  model_used: string | null;
  tokens_used: number | null;
  processing_time_ms: number | null;
  status: string;
  created_at: string;
  completed_at: string | null;
  error_message: string | null;
}

// -----------------------------------------------------------------------------
// Cost math.
// -----------------------------------------------------------------------------
const USD_TO_RUB = 90;
const UNKNOWN_MODELS = new Set<string>();

function costForTokens(modelId: string | null | undefined, tokens: number | null | undefined): number {
  if (!modelId || !tokens || tokens <= 0) return 0;
  const pricing = lookupPricing(modelId);
  if (!pricing) {
    UNKNOWN_MODELS.add(modelId);
    return 0;
  }
  return (averagePricePer1M(pricing) * tokens) / 1_000_000;
}

function rowCost(row: AnalysisRow): { vision: number; llm: number; total: number } {
  const vision = costForTokens(row.vision_model_used, row.vision_tokens_used);
  const llm = costForTokens(row.model_used, row.tokens_used);
  return { vision, llm, total: vision + llm };
}

// -----------------------------------------------------------------------------
// Pagination over Supabase rows (in case the window grows past 1k).
// -----------------------------------------------------------------------------
async function fetchAllRows(): Promise<AnalysisRow[]> {
  const pageSize = 1000;
  let from = 0;
  const acc: AnalysisRow[] = [];
  for (;;) {
    const { data, error } = await supabase
      .from("analysis_history")
      .select(
        "id, analysis_type, vision_model_used, vision_tokens_used, model_used, tokens_used, processing_time_ms, status, created_at, completed_at, error_message",
      )
      .gte("created_at", fromIso)
      .lte("created_at", toIso)
      .order("created_at", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Supabase query failed: ${error.message}`);
    if (!data || data.length === 0) break;
    acc.push(...(data as AnalysisRow[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return acc;
}

// -----------------------------------------------------------------------------
// Formatting helpers.
// -----------------------------------------------------------------------------
function fmtUsd(n: number, digits = 4): string {
  return `$${n.toFixed(digits)}`;
}
function fmtPct(num: number, denom: number): string {
  if (denom === 0) return "0.0%";
  return `${((100 * num) / denom).toFixed(1)}%`;
}
function fmtInt(n: number): string {
  return n.toLocaleString("en-US");
}
function fmtAvg(total: number, count: number, digits = 0): string {
  if (count === 0) return "—";
  return (total / count).toFixed(digits);
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

// -----------------------------------------------------------------------------
// Report builder.
// -----------------------------------------------------------------------------
interface TypeBucket {
  count: number;
  visionTokens: number;
  llmTokens: number;
  totalCost: number;
}
interface ModelBucket {
  count: number;
  totalTokens: number;
  totalCost: number;
}

function buildReport(rows: AnalysisRow[]): string {
  const total = rows.length;
  const completed = rows.filter((r) => r.status === "completed").length;
  const failed = rows.filter((r) => r.status === "failed").length;

  // Aggregations.
  const byType = new Map<string, TypeBucket>();
  const byModel = new Map<string, ModelBucket>();
  let grandTotalUsd = 0;
  const procTimes: number[] = [];

  type Scored = AnalysisRow & { _vision: number; _llm: number; _cost: number };
  const scored: Scored[] = [];

  for (const row of rows) {
    const c = rowCost(row);
    grandTotalUsd += c.total;
    scored.push({ ...row, _vision: c.vision, _llm: c.llm, _cost: c.total });

    if (row.processing_time_ms && row.processing_time_ms > 0) {
      procTimes.push(row.processing_time_ms);
    }

    // By type — count every row (success + failure) but cost is naturally
    // tiny for failures that never reached the LLM step.
    const tBucket = byType.get(row.analysis_type) ?? {
      count: 0,
      visionTokens: 0,
      llmTokens: 0,
      totalCost: 0,
    };
    tBucket.count += 1;
    tBucket.visionTokens += row.vision_tokens_used ?? 0;
    tBucket.llmTokens += row.tokens_used ?? 0;
    tBucket.totalCost += c.total;
    byType.set(row.analysis_type, tBucket);

    // By model — separate buckets for vision vs interpretation calls.
    if (row.vision_model_used) {
      const m = byModel.get(row.vision_model_used) ?? { count: 0, totalTokens: 0, totalCost: 0 };
      m.count += 1;
      m.totalTokens += row.vision_tokens_used ?? 0;
      m.totalCost += c.vision;
      byModel.set(row.vision_model_used, m);
    }
    if (row.model_used) {
      const m = byModel.get(row.model_used) ?? { count: 0, totalTokens: 0, totalCost: 0 };
      m.count += 1;
      m.totalTokens += row.tokens_used ?? 0;
      m.totalCost += c.llm;
      byModel.set(row.model_used, m);
    }
  }

  const top3 = [...scored].sort((a, b) => b._cost - a._cost).slice(0, 3);

  const avgMs = procTimes.length === 0 ? 0 : procTimes.reduce((a, b) => a + b, 0) / procTimes.length;
  const p95Ms = percentile(procTimes, 95);

  const rubTotal = grandTotalUsd * USD_TO_RUB;

  // ---------------------- Markdown assembly ----------------------
  const lines: string[] = [];
  lines.push(`# Cost Report: Symancy — period ${fromDay} → ${toDay}`);
  lines.push("");
  lines.push(`_Generated: ${new Date().toISOString()}_`);
  lines.push("");

  // Summary.
  lines.push("## Summary");
  lines.push(`- Total analyses: ${fmtInt(total)}`);
  lines.push(`- Successful: ${fmtInt(completed)} (${fmtPct(completed, total)})`);
  lines.push(`- Failed: ${fmtInt(failed)} (${fmtPct(failed, total)})`);
  lines.push(
    `- Total cost: ${fmtUsd(grandTotalUsd, 4)} (~${rubTotal.toFixed(2)}₽ at ${USD_TO_RUB} ₽/USD)`,
  );
  lines.push("");

  // By analysis type.
  lines.push("## By Analysis Type");
  lines.push("");
  lines.push("| Type | Count | Avg Vision Tokens | Avg LLM Tokens | Avg Cost USD | Total Cost USD |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  const typesSorted = [...byType.entries()].sort((a, b) => b[1].totalCost - a[1].totalCost);
  if (typesSorted.length === 0) {
    lines.push("| _(no data)_ | 0 | — | — | — | — |");
  } else {
    for (const [type, b] of typesSorted) {
      lines.push(
        `| ${type} | ${fmtInt(b.count)} | ${fmtAvg(b.visionTokens, b.count, 0)} | ${fmtAvg(b.llmTokens, b.count, 0)} | ${fmtUsd(b.totalCost / Math.max(1, b.count), 4)} | ${fmtUsd(b.totalCost, 4)} |`,
      );
    }
  }
  lines.push("");

  // By model.
  lines.push("## By Model");
  lines.push("");
  lines.push("| Model | Count | Total Tokens | Total Cost USD |");
  lines.push("| --- | --- | --- | --- |");
  const modelsSorted = [...byModel.entries()].sort((a, b) => b[1].totalCost - a[1].totalCost);
  if (modelsSorted.length === 0) {
    lines.push("| _(no data)_ | 0 | 0 | — |");
  } else {
    for (const [model, b] of modelsSorted) {
      const unknown = UNKNOWN_MODELS.has(model) ? " ⚠️" : "";
      lines.push(
        `| \`${model}\`${unknown} | ${fmtInt(b.count)} | ${fmtInt(b.totalTokens)} | ${fmtUsd(b.totalCost, 4)} |`,
      );
    }
  }
  lines.push("");

  // Top 3 most expensive.
  lines.push("## Top 3 Most Expensive Analyses");
  if (top3.length === 0 || top3[0]._cost === 0) {
    lines.push("");
    lines.push("_No analyses with measurable cost in this window._");
  } else {
    for (let i = 0; i < top3.length; i++) {
      const r = top3[i];
      const visionTok = r.vision_tokens_used ?? 0;
      const llmTok = r.tokens_used ?? 0;
      lines.push(
        `${i + 1}. id=\`${r.id}\` (type=${r.analysis_type}, vision=${fmtInt(visionTok)} tok, llm=${fmtInt(llmTok)} tok, cost=${fmtUsd(r._cost, 4)})`,
      );
    }
  }
  lines.push("");

  // Performance.
  lines.push("## Performance");
  lines.push(`- Avg processing time: ${avgMs === 0 ? "—" : `${avgMs.toFixed(0)}ms`}`);
  lines.push(`- p95 processing time: ${p95Ms === 0 ? "—" : `${p95Ms.toFixed(0)}ms`}`);
  lines.push(`- Samples (rows with processing_time_ms > 0): ${fmtInt(procTimes.length)}`);
  lines.push("");

  // Notes.
  lines.push("## Notes");
  lines.push(`- Курс USD/RUB: ${USD_TO_RUB} (hardcoded for now)`);
  lines.push("- Vision и LLM tokens разделены: vision_tokens_used + tokens_used");
  lines.push(
    "- Цены OpenRouter актуальны на дату генерации, см. `scripts/openrouter-pricing.ts`",
  );
  lines.push(
    "- Поскольку `analysis_history.tokens_used` не делит prompt/completion, стоимость считается по среднему: `(prompt + completion) / 2 * tokens / 1_000_000`",
  );
  if (UNKNOWN_MODELS.size > 0) {
    lines.push("");
    lines.push("### ⚠️ Unknown models (cost counted as 0)");
    for (const m of UNKNOWN_MODELS) {
      lines.push(`- \`${m}\` — add to \`scripts/openrouter-pricing.ts\` to include in cost totals`);
    }
  }
  const approxModels = Object.entries(OPENROUTER_PRICING)
    .filter(([id, p]) => p.approximate && (byModel.has(id) || UNKNOWN_MODELS.has(id)))
    .map(([id]) => id);
  if (approxModels.length > 0) {
    lines.push("");
    lines.push("### ℹ️ Approximate pricing");
    lines.push("These model IDs appeared in the window and use approximate pricing (verify against OpenRouter):");
    for (const m of approxModels) lines.push(`- \`${m}\``);
  }
  lines.push("");

  return lines.join("\n");
}

// -----------------------------------------------------------------------------
// Main.
// -----------------------------------------------------------------------------
async function main() {
  console.log(`[cost-report] window: ${fromIso} → ${toIso}`);
  console.log("[cost-report] fetching analysis_history...");
  const rows = await fetchAllRows();
  console.log(`[cost-report] fetched ${rows.length} rows`);

  console.log("[cost-report] computing...");
  const md = buildReport(rows);

  const outDir = resolve(REPO_ROOT, "docs/reports/costs");
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, `${reportMonth}.md`);
  writeFileSync(outPath, md, "utf8");
  console.log(`[cost-report] done — wrote ${outPath}`);

  if (UNKNOWN_MODELS.size > 0) {
    console.warn(
      `[cost-report] WARNING: ${UNKNOWN_MODELS.size} unknown model id(s) — counted as 0 cost: ${[...UNKNOWN_MODELS].join(", ")}`,
    );
  }
}

main().catch((err) => {
  console.error("[cost-report] FAILED:", err);
  process.exit(1);
});
