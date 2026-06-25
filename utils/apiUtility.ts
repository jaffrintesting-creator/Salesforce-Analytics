import { request, expect } from '@playwright/test';
import dotenv from 'dotenv';
import { setToken, getHeaders, getFormHeaders } from '../utils/headerUtility';
import path from 'path';

const envFile = ".env.salesforce";
dotenv.config({path:path.resolve(process.cwd(),`ENV`,`${envFile}`)});

let instanceUrl = '';

export async function generateToken() {
     
    const apiContext = await request.newContext();

    const response = await apiContext.post(
        process.env.TOKEN_URL!,
        {
            headers: getFormHeaders(),

            form: {
                grant_type: 'password',
                client_id: process.env.CLIENT_ID!,
                client_secret: process.env.CLIENT_SECRET!,
                username: process.env.USERNAME_SF!,
                password: process.env.PASSWORD_SF!
            }
        }
    );
    
     
    expect(response.status()).toBe(200);
    expect(response.statusText()).toBe('OK');

    const responseBody = await response.json();

    const accessToken = responseBody.access_token;

    instanceUrl = responseBody.instance_url;

    setToken(accessToken);

    console.log('Token Generated Successfully');
}

export function getInstanceUrl() {
  return instanceUrl;
}

export async function createAccountAPI(accountName: string) {

    const apiContext = await request.newContext();

    const response = await apiContext.post(
        `${instanceUrl}/services/data/v65.0/sobjects/Account`,
        {
            headers: getHeaders(),

            data: {
                Name: accountName
            }
        }
    );

    validateStatusCode(response.status(), 201);
    validateStatusText(response.statusText(), 'Created');

    const responseBody = await response.json();

    console.log('Account Created via API');

    return responseBody.id;
}

export async function fetchAccountAPI(accountId: string) {

    const apiContext = await request.newContext();

    const response = await apiContext.get(
        `${instanceUrl}/services/data/v65.0/sobjects/Account/${accountId}`,
        {
            headers: getHeaders()
        }
    );

    validateStatusCode(response.status(), 200);
    validateStatusText(response.statusText(), 'OK');

    return await response.json();
}

export async function deleteAccountAPI(accountId: string) {

    const apiContext = await request.newContext();

    const response = await apiContext.delete(
        `${instanceUrl}/services/data/v65.0/sobjects/Account/${accountId}`,
        {
            headers: getHeaders()
        }
    );

    validateStatusCode(response.status(), 204);
    console.log('Account Deleted Successfully');
}

export async function createLeadAPI(leadData: Record<string, unknown>) {

    const apiContext = await request.newContext();

    const response = await apiContext.post(
        `${instanceUrl}/services/data/v65.0/sobjects/Lead`,
        {
            headers: getHeaders(),

            data: leadData
        }
    );

    validateStatusCode(response.status(), 201);
    validateStatusText(response.statusText(), 'Created');

    const responseBody = await response.json();

    console.log('Lead Created via API');

    return responseBody.id;
}

export async function fetchLeadAPI(leadId: string) {

    const apiContext = await request.newContext();

    const response = await apiContext.get(
        `${instanceUrl}/services/data/v65.0/sobjects/Lead/${leadId}`,
        {
            headers: getHeaders()
        }
    );

    validateStatusCode(response.status(), 200);
    validateStatusText(response.statusText(), 'OK');

    return await response.json();
}

export async function updateLeadAPI(leadId: string, leadData: Record<string, unknown>) {

    const apiContext = await request.newContext();

    const response = await apiContext.patch(
        `${instanceUrl}/services/data/v65.0/sobjects/Lead/${leadId}`,
        {
            headers: getHeaders(),

            data: leadData
        }
    );

    validateStatusCode(response.status(), 204);
    console.log('Lead Updated via API');
}

export async function deleteLeadAPI(leadId: string) {

    const apiContext = await request.newContext();

    const response = await apiContext.delete(
        `${instanceUrl}/services/data/v65.0/sobjects/Lead/${leadId}`,
        {
            headers: getHeaders()
        }
    );

    validateStatusCode(response.status(), 204);
    console.log('Lead Deleted Successfully');
}

export function validateStatusCode(actual: number, expected: number) {
    expect(actual).toBe(expected);
}

export function validateStatusText(actual: string, expected: string) {
    expect(actual).toBe(expected);
}
