import { test, expect } from '../../fixtures/apiFixture';
import { createLeadAPI, fetchLeadAPI, updateLeadAPI, deleteLeadAPI } from '../../utils/apiUtility';
import { faker } from '@faker-js/faker';

test.describe('Lead API Tests', () => {

    test.describe.configure({ mode: 'serial' });

    let createdLeadId: string;
    let leadLastName: string;
    let leadCompany: string;

    test('should create a new Lead', async ({ instanceUrl }) => {

        leadLastName = faker.person.lastName();
        leadCompany = faker.company.name();

        createdLeadId = await createLeadAPI({
            LastName: leadLastName,
            Company: leadCompany,
            Email: faker.internet.email()
        });

        expect(createdLeadId).toBeTruthy();
    });

    test('should retrieve the created Lead', async () => {

        const lead = await fetchLeadAPI(createdLeadId);

        expect(lead.LastName).toBe(leadLastName);
        expect(lead.Company).toBe(leadCompany);
    });

    test('should update the Lead status', async () => {

        await updateLeadAPI(createdLeadId, {
            Status: 'Working - Contacted'
        });
    });

    test('should delete the created Lead', async () => {

        await deleteLeadAPI(createdLeadId);
    });
});
