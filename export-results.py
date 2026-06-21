#!/usr/bin/env python3
"""
Stage 03 -> 06 bridge: export-results.py

Reads Playwright's JSON reporter output (test-results/results.json) and
inserts one row per test into fact_testrun, matching schema.sql.

This script does NOT care how the test code was written (Stage 02) or
whether it's a UI test or REST-API test — it just reads whatever Playwright
reports and writes rows. test_case_id is derived from the test title for now;
once Stage 01/02 exist, you'll map real TC-SF-XXXX ids instead (see NOTE below).

Usage:
    python3 export-results.py --results test-results/results.json --db qa.db --ci-pipeline "sf-login-tests.yml" --branch main

Requires: Python 3.8+, no external packages (uses built-in sqlite3 + json).
"""

import argparse
import json
import sqlite3
import sys
import uuid
from datetime import datetime, timezone


def flatten_specs(suites, parent_titles=None):
    """
    Playwright's JSON report nests suites inside suites inside suites.
    This walks the tree and yields (full_title, test_result) pairs,
    flattening the nesting into a single list.
    """
    if parent_titles is None:
        parent_titles = []

    for suite in suites:
        titles = parent_titles + [suite.get("title", "")]

        for spec in suite.get("specs", []):
            spec_title = spec.get("title", "untitled")
            for test in spec.get("tests", []):
                # A test can be retried; results is a list, take the LAST
                # attempt as the final outcome (matches what Playwright shows you).
                results = test.get("results", [])
                if not results:
                    continue
                final_result = results[-1]
                was_retried = len(results) > 1

                yield {
                    "full_title": " > ".join(titles + [spec_title]),
                    "spec_title": spec_title,
                    "status": final_result.get("status", "unknown"),
                    "duration_ms": final_result.get("duration", 0),
                    "was_retried": was_retried,
                }

        # Recurse into nested suites
        if suite.get("suites"):
            yield from flatten_specs(suite["suites"], titles)


def map_status(pw_status: str, was_retried: bool) -> str:
    """
    Maps Playwright's status values to the schema's allowed values:
    Pass / Fail / Flaky / Skipped

    A test that failed at least once but ultimately passed after retry
    is classified as Flaky -- per the rule defined in powerbi-data-model.md:
    "failed, then passed on an immediate retry against the same commit."
    This script can only see the FINAL result per test from the JSON as
    structured above; if you enable Playwright retries in CI, the richer
    flaky detection (checking ALL attempts, not just the last) is the
    next improvement -- flagged in the NOTE at the bottom of this file.
    """
    mapping = {
        "passed": "Pass",
        "failed": "Fail",
        "timedOut": "Fail",
        "skipped": "Skipped",
        "interrupted": "Fail",
    }
    base_status = mapping.get(pw_status, "Fail")
    if was_retried and base_status == "Pass":
        return "Flaky"
    return base_status


def derive_test_case_id(full_title: str) -> str:
    """
    TEMPORARY: derives a stable-ish test_case_id from the test title since
    Stage 01 (spec-to-testcases) doesn't exist yet to assign real TC-SF-XXXX
    ids. Once Stage 01/02 exist, replace this with a real lookup -- e.g. a
    title -> test_case_id mapping table, or tags embedded in the test itself
    (test.describe with a tag like @TC-SF-0001).
    """
    slug = (
        full_title.lower()
        .replace(" > ", "-")
        .replace(" ", "-")
        .replace("'", "")
    )
    slug = "".join(c for c in slug if c.isalnum() or c == "-")[:40]
    return f"TC-SF-AUTO-{slug}"


def ensure_testcase_exists(cur, test_case_id: str, title: str, test_layer: str):
    """
    Inserts a minimal dim_testcase row if one doesn't already exist, so the
    foreign key on fact_testrun doesn't fail. This is a placeholder until
    Stage 01 properly owns dim_testcase population.
    """
    cur.execute(
        "SELECT 1 FROM dim_testcase WHERE test_case_id = ?", (test_case_id,)
    )
    if cur.fetchone() is None:
        cur.execute(
            """
            INSERT INTO dim_testcase
                (test_case_id, title, suite, test_layer, automation_status)
            VALUES (?, ?, ?, ?, 'Automated')
            """,
            (test_case_id, title, "Login Tests", test_layer),
        )


def main():
    parser = argparse.ArgumentParser(description="Export Playwright JSON results into fact_testrun")
    parser.add_argument("--results", required=True, help="Path to Playwright results.json")
    parser.add_argument("--db", required=True, help="Path to SQLite database (schema.sql already applied)")
    parser.add_argument("--ci-pipeline", default="local-run", help="CI workflow name")
    parser.add_argument("--branch", default="main", help="Git branch")
    parser.add_argument("--org-id", default=None, help="Optional dim_org.org_id to attach to these runs")
    args = parser.parse_args()

    try:
        with open(args.results, "r") as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"ERROR: results file not found at {args.results}", file=sys.stderr)
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"ERROR: results file is not valid JSON: {e}", file=sys.stderr)
        sys.exit(1)

    suites = data.get("suites", [])
    if not suites:
        print("WARNING: no suites found in results.json -- nothing to export.")
        sys.exit(0)

    conn = sqlite3.connect(args.db)
    cur = conn.cursor()

    inserted = 0
    status_counts = {"Pass": 0, "Fail": 0, "Flaky": 0, "Skipped": 0}

    for entry in flatten_specs(suites):
        test_case_id = derive_test_case_id(entry["full_title"])
        status = map_status(entry["status"], entry["was_retried"])
        status_counts[status] = status_counts.get(status, 0) + 1

        ensure_testcase_exists(cur, test_case_id, entry["spec_title"], "UI")

        run_id = f"RUN-{uuid.uuid4().hex[:12]}"
        cur.execute(
            """
            INSERT INTO fact_testrun
                (run_id, test_case_id, org_id, run_timestamp, status,
                 duration_ms, ci_pipeline, branch, locator_strategy, http_status_code)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)
            """,
            (
                run_id,
                test_case_id,
                args.org_id,
                datetime.now(timezone.utc).isoformat(),
                status,
                entry["duration_ms"],
                args.ci_pipeline,
                args.branch,
            ),
        )
        inserted += 1

    conn.commit()
    conn.close()

    print(f"Exported {inserted} test run(s) into {args.db}")
    print(f"Status breakdown: {status_counts}")


if __name__ == "__main__":
    main()
