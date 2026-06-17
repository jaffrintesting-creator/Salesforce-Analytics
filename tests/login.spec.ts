import { test, expect } from '../fixtures/testFixture';
import { env } from '../utils/env.helper';


test.describe('Login Tests', () => {

    test('Valid login should succeed', async ({ loginPage, page }) => {

        await loginPage.open();
        await loginPage.login(env.username!, env.password!);

        await expect(page).toHaveURL(/dashboard/);
    });

    test('Invalid username should show error message', async ({ loginPage }) => {
        await loginPage.open();
        await loginPage.login('invalid_user', env.password!);

        expect(await loginPage.getErrorMessage()).toContain('Error: Please check your username and password. If you still can\'t log in, contact your Salesforce administrator.');
    });

    test('Invalid password should show error message', async ({ loginPage }) => {
        await loginPage.open(); 
        await loginPage.login(env.username!, 'invalid_password');

        expect(await loginPage.getErrorMessage()).toContain('Error: Please check your username and password. If you still can\'t log in, contact your Salesforce administrator.');
    });

    test('Without username should show error message', async ({ loginPage }) => {
        await loginPage.open();
        await loginPage.login('', env.password!);

        expect(await loginPage.getErrorMessage()).toContain('Error: Please enter your username.');
    });

    test('Without password should show error message', async ({ loginPage }) => {
        await loginPage.open();
        await loginPage.login(env.username!, '');

        expect(await loginPage.getErrorMessage()).toContain('Error: Please enter your password.');
    });

    test('Remember Me option should retain login', async ({ loginPage, page }) => {
        await loginPage.open();
        await loginPage.login(env.username!, env.password!, true);

        // logout flow if applicable, for example:
        // await page.click('text=Logout'); // Adjust the selector as needed
        await page.reload();

        expect(await loginPage.getSavedUsername()).toBe(env.username);
    });

    test('Unselect Remember Me option should not retain login', async ({ loginPage, page }) => {
        await loginPage.open();
        await loginPage.login(env.username!, env.password!, false);

        // logout flow if applicable, for example:
        // await page.click('text=Logout'); // Adjust the selector as needed
        await page.reload();
        expect(await loginPage.getSavedUsername()).toBe('');
    });

    test('Forgot Password link should navigate to password reset page', async ({ loginPage, page }) => {
        await loginPage.open();
        await loginPage.clickForgotPassword();
        await expect(page).toHaveURL(/forgotpassword/);
    });    
});