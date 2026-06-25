/**
 * fixtures/apiFixture.ts
 *
 * Mirrors the pattern of testFixture.ts (UI tests), but for API tests.
 * Calls generateToken() from apiUtility.ts ONCE PER WORKER (not once per
 * test) -- the token is generated the first time any test in that worker
 * needs it, then reused for every subsequent test in the same worker.
 * This avoids hitting Salesforce's token endpoint on every single test,
 * which would be slower and adds unnecessary load against your org.
 *
 * Usage in a test file:
 *   import { test, expect } from '../../fixtures/apiFixture';
 *
 *   test('create a lead', async ({ instanceUrl }) => {
 *     const leadId = await createLeadAPI({ LastName: 'Smith', Company: 'Acme' });
 *     // instanceUrl is available if you need to build a custom request,
 *     // but the existing utility functions (createLeadAPI, fetchLeadAPI, etc.)
 *     // already use it internally -- you usually won't need it directly.
 *   });
 *
 * Note: because generateToken() in apiUtility.ts stores the token in a
 * module-level variable (via setToken() in headerUtility.ts) rather than
 * returning it, this fixture doesn't need to pass the token around itself
 * -- it just needs to guarantee generateToken() has been called before
 * any test runs. The existing utility functions pick up the token
 * automatically via getHeaders().
 */

import { test as base, expect } from '@playwright/test';
import { generateToken, getInstanceUrl } from '../utils/apiUtility';

interface ApiFixtures {
  instanceUrl: string;
}

interface ApiWorkerFixtures {
  tokenReady: void;
}

export const test = base.extend<ApiFixtures, ApiWorkerFixtures>({
  // Worker-scoped: runs once per worker process, shared across all tests
  // that run in that worker -- this is what makes the token "once per
  // worker" rather than "once per test."
  tokenReady: [
    async ({}, use) => {
      await generateToken();
      await use();
    },
    { scope: 'worker' },
  ],

  // Test-scoped: depends on tokenReady, so it's guaranteed the token
  // already exists by the time any test asks for instanceUrl.
  instanceUrl: async ({ tokenReady }, use) => {
    await use(getInstanceUrl());
  },
});

export { expect };
