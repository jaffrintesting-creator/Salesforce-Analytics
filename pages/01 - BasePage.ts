import { Page, Locator, expect } from '@playwright/test';

export class BasePage {

    constructor(protected page: Page) {}

    // ----------- Common Actions -------------

    /**
     * Clicks an element.
     *
     * Performs click action
     *
     * @param locator Target element locator
     */
    async click( locator: Locator ): Promise<void> {

        await locator.click();

    }

    /**
     * Enters text into a textbox.
     *
     * Steps:
     * 1. Clears existing text
     * 2. Enters new value
     *
     * @param locator Target element locator
     * @param text Value to enter
     */
    async enterText( locator: Locator, text: string ): Promise<void> {

        await locator.clear();
        await locator.fill(text);

    }

    /**
     * Searches a value in a search box.
     *
     * Steps:
     * 1. Clears existing value
     * 2. Enters search text
     * 3. Presses Enter
     *
     * @param locator Search box locator
     * @param value Search value
     */
    async search( locator: Locator, value: string ): Promise<void> {

        await locator.clear();
        await locator.fill(value);
        await locator.press('Enter');

    }

        /**
     * Selects an option from dropdown using visible text.
     *
     * Steps:
     * 1. Selects option by label
     *
     * @param locator Dropdown locator
     * @param value Dropdown visible text
     */ 
    async selectDropdownByText( locator: Locator, value: string ): Promise<void> {

        await locator.selectOption( { label: value});

    }

    /**
     * Performs hover action on an element.
     *
     * Moves mouse over element
     *
     * @param locator Target element locator
     */
    async hover( locator: Locator ): Promise<void> {

        await locator.hover();

    }

    /**
     * Scrolls page until element becomes visible.
     *
     * Scrolls into view if required
     *
     * @param locator Target element locator
     */
    async scrollToElement( locator: Locator ): Promise<void> {

        await locator.scrollIntoViewIfNeeded();

    }

    /**
     * Checks a checkbox.
     *
     * Checks the checkbox
     *
     * @param locator Checkbox locator
     */
    async check( locator: Locator ): Promise<void> {

        await locator.check();

    }

    /**
     * Unchecks a checkbox element.
     *
     * Removes checkbox selection
     *
     * @param locator Checkbox locator
     */
    async uncheck( locator: Locator ): Promise<void> {

        await locator.uncheck();

    }

    /**
     * Gets the text content of an element.
     *
     * Returns the text
     *
     * @param locator Target element locator
     * @returns Visible text value
     */
    async getText( locator: Locator ): Promise<string> {

        const text = await locator.textContent();
        return text ? text.trim() : '';

    }

    /**
     * Gets the value of a specified attribute from an element.
     *
     * Returns the attribute value
     *
     * @param locator Target element locator
     * @param attributeName Name of the attribute to retrieve
     * @returns Attribute value or null if not found
     */
    async getAttribute( locator: Locator, attributeName: string ): Promise<string | null> {

        return await locator.getAttribute(attributeName);

    }

    /**
     * Checks if an element is visible.
     *
     * Steps:
     * 1. Waits for visibility
     * 2. Returns the visibility status
     *
     * @param locator Target element locator
     * @returns True if visible, false otherwise
     */
    async isVisible( locator: Locator ): Promise<boolean> {

        return await locator.isVisible();

    }

    /**
     * Returns current page title.
     *
     * @returns Browser page title
     */
    async getPageTitle(): Promise<string> {

        return await this.page.title();
    }

    /**
     * Waits for a specified number of seconds.
     * 
     * Note:
     * Use only when unavoidable.
     * Prefer Playwright auto waiting whenever possible.
     * 
     * @param seconds Number of seconds to wait
     */
    async waitForSeconds( seconds: number ): Promise<void> {
 
        await this.page.waitForTimeout(seconds * 1000);
    }

    /**
     * Navigates to specified URL
     *
     * @param url Application URL
     */
    async navigateTo(url: string): Promise<void> {

        await this.page.goto(url);
    }

}