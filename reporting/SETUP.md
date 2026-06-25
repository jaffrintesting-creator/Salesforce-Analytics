# reporting/ — merged setup

This folder now contains both pipeline scripts, sharing one `package.json`
and one `tsconfig.json`. Verified working end-to-end together: schema apply
-> export-results -> export-to-csv, run as a sequence, no conflicts between
the two scripts.

## Files

- `export-results.ts` — reads Playwright JSON (`test-results/results.json`)
  -> writes rows into `qa.db`
- `export-to-csv.ts` — reads `qa.db` -> writes CSVs for Power BI
- `package.json` — one shared dependency list (`sql.js`) for both scripts
- `tsconfig.json` — compiles both `.ts` files in one step

## Setup (replaces both earlier separate setups)

If you previously created an `export/` folder for `export-results.ts` --
delete it, this replaces it:
```powershell
Remove-Item -Recurse -Force C:\Salesforce-Analytics\export
```

Put these 4 files into your existing `reporting/` folder (replacing the
`package.json` and `tsconfig.json` that were already there from the
CSV-export-only setup):

```powershell
cd C:\Salesforce-Analytics\reporting
npm install
npm run build
```

This compiles BOTH scripts at once -- you'll see `export-results.js` and
`export-to-csv.js` appear side by side after the build.

## Running the full pipeline

**Step 1 — copy fresh results in (after running your Playwright tests):**
```powershell
Copy-Item ..\test-results\results.json .\test-results.json
Copy-Item ..\qa.db .\qa.db
```

**Step 2 — export JSON results into the database:**
```powershell
node export-results.js --results test-results.json --db qa.db --ci-pipeline "local-test" --branch main --org-id SBX-UAT-01
```

**Step 3 — export the database to CSV:**
```powershell
node export-to-csv.js --db qa.db --out ./csv-export
```

Or use the npm shortcuts (same commands, just shorter):
```powershell
npm run export-results -- --results test-results.json --db qa.db --ci-pipeline "local-test" --branch main --org-id SBX-UAT-01
npm run export-csv
```

## What changed from the two separate folders

- One `npm install` instead of two (faster, less disk space)
- One `npm run build` compiles both scripts together
- Both scripts now live next to each other since they're really one
  pipeline (JSON -> DB -> CSV), not two unrelated tools
