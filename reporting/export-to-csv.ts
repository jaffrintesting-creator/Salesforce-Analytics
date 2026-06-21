/**
 * export-to-csv.ts
 *
 * Reads qa.db (the SQLite database built from schema.sql + export-results.py)
 * and exports each table to its own CSV file, ready for Power BI's
 * "Get Data -> Text/CSV" import.
 *
 * Uses sql.js (a WASM build of SQLite) instead of better-sqlite3 -- this
 * avoids native compilation entirely, which can fail on some machines
 * (missing build tools, restricted networks, etc.). sql.js is pure
 * JS/WASM and installs cleanly everywhere with a plain `npm install`.
 *
 * Usage:
 *   npx ts-node export-to-csv.ts --db qa.db --out ./csv-export
 *
 * Requires: npm install sql.js
 *           npm install -D typescript @types/node ts-node
 */

import initSqlJs from "sql.js";
import * as fs from "fs";
import * as path from "path";

interface CliArgs {
  db: string;
  out: string;
}

function parseArgs(argv: string[]): CliArgs {
  const args: Partial<CliArgs> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--db") args.db = argv[++i];
    if (argv[i] === "--out") args.out = argv[++i];
  }
  if (!args.db) {
    console.error("ERROR: --db <path> is required (e.g. --db qa.db)");
    process.exit(1);
  }
  return {
    db: args.db,
    out: args.out ?? "./csv-export",
  };
}

/**
 * Escapes a single CSV field per RFC 4180: wraps in quotes if the value
 * contains a comma, quote, or newline, and doubles any internal quotes.
 * Null/undefined become an empty string, not the literal text "null".
 */
function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function rowsToCsv(columns: string[], rows: unknown[][]): string {
  const headerLine = columns.map(escapeCsvField).join(",");
  const dataLines = rows.map((row) => row.map(escapeCsvField).join(","));
  return [headerLine, ...dataLines].join("\n");
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(args.db)) {
    console.error(`ERROR: database file not found at ${args.db}`);
    process.exit(1);
  }

  if (!fs.existsSync(args.out)) {
    fs.mkdirSync(args.out, { recursive: true });
  }

  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync(args.db);
  const db = new SQL.Database(fileBuffer);

  const tables = ["dim_testcase", "dim_org", "fact_testrun", "fact_defect"];
  const summary: Record<string, number> = {};

  for (const table of tables) {
    try {
      const result = db.exec(`SELECT * FROM ${table}`);
      if (result.length === 0) {
        // Table exists but has zero rows -- still write an empty CSV
        // with no header, since we don't have column names without a row.
        // Better: query the schema directly for column names even when empty.
        const pragma = db.exec(`PRAGMA table_info(${table})`);
        const columns = pragma[0]?.values.map((row) => row[1] as string) ?? [];
        const csv = columns.length > 0 ? columns.map(escapeCsvField).join(",") : "";
        fs.writeFileSync(path.join(args.out, `${table}.csv`), csv, "utf-8");
        summary[table] = 0;
        continue;
      }
      const { columns, values } = result[0];
      const csv = rowsToCsv(columns, values);
      fs.writeFileSync(path.join(args.out, `${table}.csv`), csv, "utf-8");
      summary[table] = values.length;
    } catch (err) {
      console.error(`WARNING: could not export table "${table}": ${(err as Error).message}`);
      summary[table] = -1;
    }
  }

  db.close();

  console.log(`Exported tables to ${args.out}:`);
  for (const [table, count] of Object.entries(summary)) {
    if (count === -1) {
      console.log(`  ${table}: FAILED (see warning above)`);
    } else {
      console.log(`  ${table}: ${count} row(s) -> ${table}.csv`);
    }
  }
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});

