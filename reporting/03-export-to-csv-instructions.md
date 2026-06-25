# Exporting qa.db to CSV for Power BI (TypeScript version)

This replaces the earlier Python approach entirely — everything here is
TypeScript, run through Node, no Python involved.

## Files in this folder

- `export-to-csv.ts` — the export script
- `package.json` — dependencies (`sql.js`) and two npm scripts
- `tsconfig.json` — compiler settings, so you never need to remember flags

`sql.js` is a pure WASM build of SQLite — it has **zero native compilation
step**, unlike some other SQLite npm packages. That matters because native
modules can fail to install on some machines (missing build tools, restricted
networks); `sql.js` avoids that whole category of problem.

## Setup (one-time)

1. Copy all 4 files in this folder into your `Salesforce-Analytics` project,
   into a new subfolder e.g. `reporting/`.

2. Copy your existing `qa.db` into that same `reporting/` folder (or adjust
   the `--db` path in step 4 below to point at wherever it actually is).

3. Install dependencies:
   ```powershell
   cd reporting
   npm install
   ```

## Running it

**Step 1 — Compile TypeScript to JavaScript:**
```powershell
npm run build
```
This runs `tsc` and produces `export-to-csv.js` in the same folder.

**Step 2 — Run the export:**
```powershell
npm run export
```
This runs `node export-to-csv.js --db qa.db --out ./csv-export`.

You should see:
```
Exported tables to ./csv-export:
  dim_testcase: 11 row(s) -> dim_testcase.csv
  dim_org: 1 row(s) -> dim_org.csv
  fact_testrun: 11 row(s) -> fact_testrun.csv
  fact_defect: 0 row(s) -> fact_defect.csv
```
(Numbers will match whatever's actually in your `qa.db` at the time.)

If you ever change the db path or output folder, run the underlying command
directly instead of the npm script:
```powershell
node export-to-csv.js --db ..\qa.db --out .\csv-export
```

## A note on why this doesn't use ts-node

You might expect to just run `npx ts-node export-to-csv.ts` directly without
a separate compile step. In testing, `ts-node` produced unreliable behavior —
the script would sometimes exit silently with no output and no files written,
with no error shown. Compiling with `tsc` first, then running the plain `.js`
output with `node`, was completely reliable by comparison. That's why this
setup uses the two-step `build` then `export` rather than one `ts-node` command.

## Loading the CSVs into Power BI

Once `csv-export/` contains the 4 CSV files:

1. Open Power BI Desktop
2. **Get Data** → **Text/CSV**
3. Select `dim_testcase.csv` → click **Load**
4. Repeat for `dim_org.csv`, `fact_testrun.csv`, `fact_defect.csv`

## Telling Power BI how the tables relate

After loading all 4, go to the **Model** view (left sidebar icon that looks
like connected boxes). Power BI usually auto-detects relationships from
matching column names, but verify these exist (drag to create if missing):

- `fact_testrun.test_case_id` → `dim_testcase.test_case_id`
- `fact_testrun.org_id` → `dim_org.org_id`
- `fact_defect.test_case_id` → `dim_testcase.test_case_id`
- `fact_defect.run_id` → `fact_testrun.run_id`

This is what makes panels like "pass rate by suite" possible — Power BI
needs to know how to join `fact_testrun` back to `dim_testcase` to pull in
`suite`, `title`, etc.

## First panel to try

Once loaded and related, drag onto a blank report canvas:
- A **stacked bar chart**: Axis = `dim_testcase.title`, Values = count of
  `fact_testrun.status`, Legend = `fact_testrun.status`

That alone will show you Pass/Fail per test, which is the simplest possible
proof the whole pipeline → dashboard chain works.
