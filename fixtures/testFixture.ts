import { test as base, expect } from '@playwright/test';
import { LoginPage } from '../pages/02 - LoginPage';


type MyFixtures = {
  loginPage: LoginPage;
};

export const test = base.extend<MyFixtures>({
  loginPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await use(loginPage);
  },
});

export { expect };