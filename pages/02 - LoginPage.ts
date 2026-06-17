import { Page, Locator } from '@playwright/test';
import { BasePage } from '../pages/01 - BasePage';

export class LoginPage extends BasePage {

    readonly url = 'https://login.salesforce.com';

    // ----------Locators--------------------

    private readonly usernameInput: Locator;
    private readonly passwordInput: Locator;
    private readonly loginButton: Locator;
    private readonly rememberMeCheckbox: Locator;
    private readonly forgotPasswordLink: Locator;
    private readonly errorMessage: Locator;

    constructor(page: Page) {

        super(page);

        this.usernameInput = page.locator('#username');
        this.passwordInput = page.locator('#password');
        this.loginButton = page.locator('#Login');
        this.rememberMeCheckbox = page.locator('#rememberUn');
        this.forgotPasswordLink = page.locator('#forgot_password_link');
        this.errorMessage = page.locator('#error');
    }

    // ----------Actions---------------------

    /**
     * Navigates to Login page
     */
    async open(): Promise<void> {

        await this.navigateTo(this.url);
    }

    /**
     * Enters username
     *
     * @param username User login name
     */
    async enterUsername(username: string): Promise<void> {

        await this.enterText(this.usernameInput, username);
    }

    /**
     * Enters password
     *
     * @param password User password
     */
    async enterPassword(password: string): Promise<void> {

        await this.enterText(this.passwordInput, password);
    }

    /**
     * Clicks Login button
     */
    async clickLogin(): Promise<void> {

        await this.click(this.loginButton);
    }

    /**
     * Selects Remember Me checkbox
     */
    async selectRememberMe(): Promise<void> {

        await this.check(this.rememberMeCheckbox);
    }

    /**
     * Unselects Remember Me checkbox
     */
    async unselectRememberMe(): Promise<void> {

        await this.uncheck(this.rememberMeCheckbox);
    }


    /**
     * Performs login action
     *
     * @param username User login name
     * @param password User password
     * @param rememberMe Select remember me if true
     */
    async login(username: string, password: string, rememberMe: boolean = false): Promise<void> {

        await this.enterUsername(username);
        await this.enterPassword(password);

        if (rememberMe) {
            await this.selectRememberMe();
        }

        await this.clickLogin();
    }

    /**
     * Returns the saved username from the username input field
     *
     * @returns Saved username text
     */
    async getSavedUsername(): Promise<string> {

        const value = await this.usernameInput.inputValue();
        return value.trim();

    }

    /**
     * Returns Login error message
     *
     * @returns Error message text
     */
    async getErrorMessage() {

        return await this.getText(this.errorMessage);
    }

    /**
     * Clicks Forgot Password link
     */
    async clickForgotPassword(): Promise<void> {

        await this.click(this.forgotPasswordLink);
    }

    
}