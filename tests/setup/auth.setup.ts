import { test } from '@playwright/test';
import { LoginPage } from '../../pages/02 - LoginPage';
import { env } from '../../utils/env.helper';
import path from 'path/win32';

test('Authenticate User', async ({ page }) => {

    const loginPage = new LoginPage(page);

    await loginPage.open();

    await loginPage.login(
        env.username!,
        env.password!
    );

    await page.context().storageState({
        path: path.resolve(process.cwd(), 'auth', 'storageState.json'),
    });

});