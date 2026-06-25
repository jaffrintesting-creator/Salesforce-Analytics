import { test, expect } from '../../fixtures/apiFixture';
import { request } from '@playwright/test';
import { getHeaders } from '../../utils/headerUtility';
import { createLeadAPI, deleteLeadAPI } from '../../utils/apiUtility';
import { faker } from '@faker-js/faker';

/**
 * Negative test cases for the Lead API. Unlike the happy-path tests in
 * lead.api.spec.ts, these call the raw Playwright request API directly
 * rather than the createLeadAPI/fetchLeadAPI utility functions -- those
 * utility functions call validateStatusCode() internally expecting a
 * SUCCESS status (e.g. 201, 200), so they'd throw before we ever got to
 * inspect the actual error response. These tests need to inspect the
 * error body itself, so they bypass that and assert directly.
 *
 * All three error shapes below were captured from this project's real
 * Salesforce org (not assumed from documentation) -- see the diagnostic
 * test files used to confirm them before writing these assertions.
 */

test.describe('Lead API Negative Tests', () => {

    test('should reject Lead creation with missing required field (Company)', async ({ instanceUrl }) => {

        const apiContext = await request.newContext();

        const response = await apiContext.post(
            `${instanceUrl}/services/data/v65.0/sobjects/Lead`,
            {
                headers: getHeaders(),
                data: {
                    LastName: faker.person.lastName()
                    // Company intentionally omitted -- required field
                }
            }
        );

        expect(response.status()).toBe(400);

        const body = await response.json();
        expect(body[0].errorCode).toBe('REQUIRED_FIELD_MISSING');
        expect(body[0].fields).toContain('Company');
    });

    test('should reject fetching a Lead with a malformed ID', async ({ instanceUrl }) => {

        const apiContext = await request.newContext();

        // A well-formed-looking but invalid Salesforce ID. Confirmed
        // against the real org: this produces MALFORMED_ID, not NOT_FOUND.
        const response = await apiContext.get(
            `${instanceUrl}/services/data/v65.0/sobjects/Lead/00Q000000000000AAA`,
            {
                headers: getHeaders()
            }
        );

        expect(response.status()).toBe(400);

        const body = await response.json();
        expect(body[0].errorCode).toBe('MALFORMED_ID');
    });

    test('should return NOT_FOUND when fetching a deleted Lead', async ({ instanceUrl }) => {

        const apiContext = await request.newContext();

        // Create a real Lead, delete it, then immediately try to fetch
        // the same ID. This is the only way to get a genuinely valid-
        // format ID that legitimately no longer exists.
        const leadId = await createLeadAPI({
            LastName: faker.person.lastName(),
            Company: faker.company.name(),
        });

        await deleteLeadAPI(leadId);

        const response = await apiContext.get(
            `${instanceUrl}/services/data/v65.0/sobjects/Lead/${leadId}`,
            {
                headers: getHeaders()
            }
        );

        expect(response.status()).toBe(404);

        const body = await response.json();
        expect(body[0].errorCode).toBe('NOT_FOUND');
    });

    test('should reject Lead creation with an invalid email format', async ({ instanceUrl }) => {

        const apiContext = await request.newContext();

        const response = await apiContext.post(
            `${instanceUrl}/services/data/v65.0/sobjects/Lead`,
            {
                headers: getHeaders(),
                data: {
                    LastName: faker.person.lastName(),
                    Company: faker.company.name(),
                    Email: 'not-a-valid-email-format'
                }
            }
        );

        expect(response.status()).toBe(400);

        const body = await response.json();
        expect(body[0].errorCode).toBe('INVALID_EMAIL_ADDRESS');
        expect(body[0].fields).toContain('Email');
    });
});
