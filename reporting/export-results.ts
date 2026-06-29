/**
 * export-results.ts
 *
 * TypeScript rewrite of export-results.py. Reads Playwright's JSON reporter
 * output (test-results/results.json) and inserts one row per test into
 * fact_testrun, matching schema.sql. Same logic as the Python version --
 * just no Python required.
 *
 * Uses sql.js (WASM SQLite, no native compilation) -- same library as
 * export-to-csv.ts, so this whole pipeline now shares one dependency.
 *
 * IMPORTANT: sql.js loads the entire database into memory and only writes
 * changes back to disk when you explicitly export and save the buffer.
 * This script handles that automatically -- it loads qa.db, makes changes,
 * then writes the updated buffer back to the same file. Don't run two
 * instances of this script against the same qa.db at the same time, since
 * the second one would overwrite the first's changes (same risk applies
 * to the Python version too, just worth knowing either way).
 *
 * Usage:
 *   npm run build
 *   node export-results.js --results test-results/results.json --db qa.db --ci-pipeline "sf-login-tests" --branch main --org-id SBX-UAT-01
 *
 * Requires: npm install sql.js
 *           npm install -D typescript @types/node @types/sql.js
 */

import initSqlJs, { Database } from "sql.js";
import * as fs from "fs";
import * as crypto from "crypto";

interface CliArgs {
  results: string;
  db: string;
  ciPipeline: string;
  branch: string;
  orgId: string | null;
}

interface PlaywrightResult {
  status: string;
  duration: number;
}

interface PlaywrightTest {
  results: PlaywrightResult[];
}

interface PlaywrightSpec {
  title: string;
  tests: PlaywrightTest[];
}

interface PlaywrightSuite {
  title: string;
  file?: string;
  specs?: PlaywrightSpec[];
  suites?: PlaywrightSuite[];
}

interface PlaywrightReport {
  suites: PlaywrightSuite[];
}

interface FlatTestEntry {
  fullTitle: string;
  specTitle: string;
  status: string;
  durationMs: number;
  wasRetried: boolean;
  filePath: string;
  topLevelSuiteTitle: string;
}

function parseArgs(argv: string[]): CliArgs {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (key.startsWith("--")) {
      args[key.slice(2)] = argv[++i];
    }
  }
  if (!args.results) {
    console.error("ERROR: --results <path> is required");
    process.exit(1);
  }
  if (!args.db) {
    console.error("ERROR: --db <path> is required");
    process.exit(1);
  }
  return {
    results: args.results,
    db: args.db,
    ciPipeline: args["ci-pipeline"] ?? "local-run",
    branch: args.branch ?? "main",
    orgId: args["org-id"] ?? null,
  };
}

/**
 * Walks Playwright's nested suite structure recursively and yields a flat
 * list of test entries. Mirrors flatten_specs() from the Python version,
 * with one addition: tracks the top-level suite's `file` path and title
 * as it recurses, so callers can tell which file/suite each test actually
 * came from -- needed to correctly distinguish UI vs API tests instead
 * of hardcoding one value for everything.
 */
function* flattenSpecs(
  suites: PlaywrightSuite[],
  parentTitles: string[] = [],
  topLevelFile: string = "",
  topLevelSuiteTitle: string = ""
): Generator<FlatTestEntry> {
  for (const suite of suites) {
    const titles = [...parentTitles, suite.title ?? ""];
    // The file path only appears on the OUTERMOST suite in Playwright's
    // JSON (e.g. the suite representing the whole .spec.ts file). Nested
    // suites (describe blocks) don't repeat it, so once we're past the
    // top level we keep carrying forward whatever was captured there.
    const currentFile = parentTitles.length === 0 ? (suite.file ?? "") : topLevelFile;
    const currentTopLevelTitle = parentTitles.length === 0 ? (suite.title ?? "") : topLevelSuiteTitle;

    for (const spec of suite.specs ?? []) {
      const specTitle = spec.title ?? "untitled";
      for (const test of spec.tests ?? []) {
        const results = test.results ?? [];
        if (results.length === 0) continue;
        const finalResult = results[results.length - 1];
        const wasRetried = results.length > 1;

        yield {
          fullTitle: [...titles, specTitle].join(" > "),
          specTitle,
          status: finalResult.status ?? "unknown",
          durationMs: finalResult.duration ?? 0,
          wasRetried,
          filePath: currentFile,
          topLevelSuiteTitle: currentTopLevelTitle,
        };
      }
    }

    if (suite.suites) {
      yield* flattenSpecs(suite.suites, titles, currentFile, currentTopLevelTitle);
    }
  }
}

/**
 * Determines test_layer (UI vs REST-API) from the test file's path.
 * Anything under a folder literally named "api" (e.g. tests/api/lead.api.spec.ts,
 * or Windows-style tests\api\lead.api.spec.ts) is REST-API; everything
 * else defaults to UI. This is a simple, explicit convention -- if you
 * organize test files differently, update this function to match.
 */
function deriveTestLayer(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/").toLowerCase();
  if (normalized.includes("/api/") || normalized.startsWith("api/")) {
    return "REST-API";
  }
  return "UI";
}

/**
 * Maps Playwright's status values to the schema's allowed values:
 * Pass / Fail / Flaky / Skipped
 *
 * A test that ultimately passed but only after a retry is classified as
 * Flaky, matching the rule in powerbi-data-model.md: "failed, then passed
 * on an immediate retry against the same commit/branch."
 */
function mapStatus(pwStatus: string, wasRetried: boolean): string {
  const mapping: Record<string, string> = {
    passed: "Pass",
    failed: "Fail",
    timedOut: "Fail",
    skipped: "Skipped",
    interrupted: "Fail",
  };
  const baseStatus = mapping[pwStatus] ?? "Fail";
  if (wasRetried && baseStatus === "Pass") {
    return "Flaky";
  }
  return baseStatus;
}

/**
 * TEMPORARY: derives a stable-ish test_case_id from the test title since
 * Stage 01 (spec-to-testcases) doesn't exist yet to assign real TC-SF-XXXX
 * ids. Once Stage 01/02 exist, replace this with a real lookup.
 */
function deriveTestCaseId(fullTitle: string): string {
  let slug = fullTitle
    .toLowerCase()
    .replace(/ > /g, "-")
    .replace(/ /g, "-")
    .replace(/'/g, "");
  slug = slug
    .split("")
    .filter((c) => /[a-z0-9-]/.test(c))
    .join("")
    .slice(0, 40);
  return `TC-SF-AUTO-${slug}`;
}

/**
 * Inserts a minimal dim_testcase row if one doesn't already exist, so the
 * foreign key on fact_testrun doesn't fail. Placeholder until Stage 01
 * properly owns dim_testcase population.
 */
function ensureTestcaseExists(
  db: Database,
  testCaseId: string,
  title: string,
  suiteName: string,
  testLayer: string
): void {
  const checkStmt = db.prepare("SELECT 1 FROM dim_testcase WHERE test_case_id = :id");
  checkStmt.bind({ ":id": testCaseId });
  const exists = checkStmt.step();
  checkStmt.free();

  if (!exists) {
    const insertStmt = db.prepare(`
      INSERT INTO dim_testcase
        (test_case_id, title, suite, test_layer, automation_status)
      VALUES (:id, :title, :suite, :layer, 'Automated')
    `);
    insertStmt.run({
      ":id": testCaseId,
      ":title": title,
      ":suite": suiteName,
      ":layer": testLayer,
    });
    insertStmt.free();
  }
}

function generateRunId(): string {
  return `RUN-${crypto.randomBytes(6).toString("hex")}`;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  let reportData: PlaywrightReport;
  try {
    const raw = fs.readFileSync(args.results, "utf-8");
    reportData = JSON.parse(raw);
  } catch (err) {
    console.error(`ERROR: could not read or parse ${args.results}: ${(err as Error).message}`);
    process.exit(1);
    return;
  }

  const suites = reportData.suites ?? [];
  if (suites.length === 0) {
    console.log("WARNING: no suites found in results.json -- nothing to export.");
    return;
  }

  if (!fs.existsSync(args.db)) {
    console.error(`ERROR: database file not found at ${args.db}`);
    process.exit(1);
    return;
  }

  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync(args.db);
  const db = new SQL.Database(fileBuffer);

  let inserted = 0;
  const statusCounts: Record<string, number> = { Pass: 0, Fail: 0, Flaky: 0, Skipped: 0 };

  const insertRunStmt = db.prepare(`
    INSERT INTO fact_testrun
      (run_id, test_case_id, org_id, run_timestamp, status,
       duration_ms, ci_pipeline, branch, locator_strategy, http_status_code)
    VALUES (:run_id, :test_case_id, :org_id, :run_timestamp, :status,
            :duration_ms, :ci_pipeline, :branch, NULL, NULL)
  `);

  for (const entry of flattenSpecs(suites)) {
    const testCaseId = deriveTestCaseId(entry.fullTitle);
    const status = mapStatus(entry.status, entry.wasRetried);
    statusCounts[status] = (statusCounts[status] ?? 0) + 1;

    ensureTestcaseExists(
      db,
      testCaseId,
      entry.specTitle,
      entry.topLevelSuiteTitle,
      deriveTestLayer(entry.filePath)
    );

    const runId = generateRunId();
    insertRunStmt.run({
      ":run_id": runId,
      ":test_case_id": testCaseId,
      ":org_id": args.orgId,
      ":run_timestamp": new Date().toISOString(),
      ":status": status,
      ":duration_ms": entry.durationMs,
      ":ci_pipeline": args.ciPipeline,
      ":branch": args.branch,
    });
    inserted++;
  }

  insertRunStmt.free();

  // sql.js keeps everything in memory -- this writes the updated database
  // back to disk, overwriting the original file with the new rows included.
  const updatedBuffer = db.export();
  fs.writeFileSync(args.db, Buffer.from(updatedBuffer));
  db.close();

  console.log(`Exported ${inserted} test run(s) into ${args.db}`);
  console.log(`Status breakdown: ${JSON.stringify(statusCounts)}`);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
