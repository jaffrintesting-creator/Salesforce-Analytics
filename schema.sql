-- ============================================================
-- QA Automation Pipeline — Data Model
-- Example platform: Salesforce (REST API + UI layers)
-- Engine: SQLite (portable; swap to Postgres/MySQL with minor edits)
-- ============================================================
-- Star schema: fact_testrun and fact_defect are facts;
-- dim_testcase and dim_org are dimensions.
-- Power BI (or any BI tool) connects directly to this file,
-- or to CSV/JSON exports generated from these tables.
-- ============================================================

PRAGMA foreign_keys = ON;

-- ------------------------------------------------------------
-- DIMENSION: dim_testcase
-- Populated by Stage 01 (spec-to-testcases) and updated by
-- Stage 02 (testcases-to-code) when automation_status changes.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dim_testcase (
    test_case_id        TEXT PRIMARY KEY,        -- e.g. 'TC-SF-0087'
    title                TEXT NOT NULL,
    suite                TEXT NOT NULL,           -- e.g. 'Opportunity Management'
    module               TEXT,                    -- e.g. 'Lightning Sales Console'
    object_type           TEXT,                    -- e.g. 'Account', 'Opportunity', 'Invoice__c'
    test_layer           TEXT NOT NULL CHECK (test_layer IN ('UI', 'REST-API', 'Integration')),
    api_endpoint         TEXT,                    -- e.g. '/services/data/v60.0/sobjects/Opportunity' (nullable, REST-API only)
    http_method          TEXT CHECK (http_method IN ('GET','POST','PATCH','PUT','DELETE') OR http_method IS NULL),
    priority             TEXT CHECK (priority IN ('High','Medium','Low')),
    automation_status    TEXT NOT NULL DEFAULT 'Manual' CHECK (automation_status IN ('Manual','Automated','Planned')),
    created_date          DATE NOT NULL DEFAULT (date('now'))
);

-- ------------------------------------------------------------
-- DIMENSION: dim_org
-- Tracks which Salesforce org/sandbox a test ran against.
-- sf_release matters because Salesforce ships 3x/year and
-- UI locators / behavior can shift after each release.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dim_org (
    org_id      TEXT PRIMARY KEY,                 -- e.g. 'SBX-UAT-01'
    org_type    TEXT NOT NULL CHECK (org_type IN ('Sandbox','Scratch Org','Production','Dev Org')),
    sf_release  TEXT,                              -- e.g. 'Spring ''26'
    edition     TEXT                               -- e.g. 'Enterprise', 'Unlimited'
);

-- ------------------------------------------------------------
-- FACT: fact_testrun
-- One row per test execution. Populated by Stage 03 (execution).
-- locator_strategy only applies when test_layer = 'UI'
-- http_status_code only applies when test_layer = 'REST-API'
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fact_testrun (
    run_id              TEXT PRIMARY KEY,
    test_case_id        TEXT NOT NULL REFERENCES dim_testcase(test_case_id),
    org_id              TEXT REFERENCES dim_org(org_id),
    run_timestamp       DATETIME NOT NULL DEFAULT (datetime('now')),
    status               TEXT NOT NULL CHECK (status IN ('Pass','Fail','Flaky','Skipped')),
    duration_ms          INTEGER,
    ci_pipeline          TEXT,                     -- e.g. GitHub Actions workflow name
    branch               TEXT,
    locator_strategy     TEXT,                      -- e.g. 'Shadow DOM', 'data-* attribute', 'ARIA' (UI only)
    http_status_code     TEXT                       -- e.g. '200', '401', '400' (REST-API only)
);

-- ------------------------------------------------------------
-- FACT: fact_defect
-- One row per defect. Populated by Stage 04 (triage) / 05 (bug report).
-- root_cause categories are deliberately specific to Salesforce
-- failure modes so the dashboard can separate "our bug" from
-- "platform changed underneath us."
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fact_defect (
    defect_id       TEXT PRIMARY KEY,               -- Jira ticket key if synced
    test_case_id    TEXT REFERENCES dim_testcase(test_case_id),
    run_id          TEXT REFERENCES fact_testrun(run_id),
    severity        TEXT CHECK (severity IN ('Critical','High','Medium','Low')),
    root_cause      TEXT CHECK (root_cause IN (
                        'Real bug',
                        'Flaky test',
                        'Lightning DOM change',
                        'REST API contract change',
                        'Sharing & permissions',
                        'Test data issue',
                        'Auth/token expiry'
                    )),
    status          TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open','In Progress','Resolved')),
    created_date    DATE NOT NULL DEFAULT (date('now')),
    resolved_date   DATE
);

-- ------------------------------------------------------------
-- Helpful indexes for Power BI query performance
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_testrun_testcase ON fact_testrun(test_case_id);
CREATE INDEX IF NOT EXISTS idx_testrun_timestamp ON fact_testrun(run_timestamp);
CREATE INDEX IF NOT EXISTS idx_defect_testcase ON fact_defect(test_case_id);
CREATE INDEX IF NOT EXISTS idx_defect_run ON fact_defect(run_id);

-- ------------------------------------------------------------
-- Example seed rows (delete once real pipeline data flows in)
-- ------------------------------------------------------------
INSERT OR IGNORE INTO dim_org (org_id, org_type, sf_release, edition) VALUES
    ('SBX-UAT-01', 'Sandbox', 'Spring ''26', 'Enterprise');

INSERT OR IGNORE INTO dim_testcase (test_case_id, title, suite, module, object_type, test_layer, api_endpoint, http_method, priority, automation_status) VALUES
    ('TC-SF-0001', 'Verify Opportunity creation via REST', 'Opportunity Management', 'Sales Console', 'Opportunity', 'REST-API', '/services/data/v60.0/sobjects/Opportunity', 'POST', 'High', 'Automated'),
    ('TC-SF-0002', 'Verify Opportunity stage update triggers Account rollup', 'Opportunity Management', 'Lightning Sales Console', 'Opportunity', 'UI', NULL, NULL, 'High', 'Manual');

INSERT OR IGNORE INTO fact_testrun (run_id, test_case_id, org_id, status, duration_ms, ci_pipeline, branch, locator_strategy, http_status_code) VALUES
    ('RUN-0001', 'TC-SF-0001', 'SBX-UAT-01', 'Pass', 842, 'sf-api-tests.yml', 'main', NULL, '201'),
    ('RUN-0002', 'TC-SF-0002', 'SBX-UAT-01', 'Fail', 5310, 'sf-ui-tests.yml', 'main', 'Shadow DOM', NULL);

INSERT OR IGNORE INTO fact_defect (defect_id, test_case_id, run_id, severity, root_cause, status) VALUES
    ('DEF-0001', 'TC-SF-0002', 'RUN-0002', 'Medium', 'Lightning DOM change', 'Open');
