import { test, expect } from '@playwright/test';

// The login page's actual sign-up/sign-in round trip goes through Supabase
// Auth, which needs a real project (see tests/e2e/README.md for why that's
// out of scope here). What we CAN exercise end to end, against the real
// running app, is every bit of client-side behavior that happens before
// that network call: mode switching, field wiring, and validation that
// blocks a bad submit before it ever reaches the network.

test.describe('login/signup form — client-side behavior', () => {
  test('defaults to "Log in" mode', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('tab', { name: 'Log in' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tab', { name: 'Sign up' })).toHaveAttribute('aria-selected', 'false');
  });

  test('?mode=signup deep link opens straight into signup mode', async ({ page }) => {
    await page.goto('/login?mode=signup');
    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Sign up' })).toHaveAttribute('aria-selected', 'true');
  });

  test('switching to Sign up reveals the optional referral code field', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel('Referral code (optional)')).toHaveCount(0);
    await page.getByRole('tab', { name: 'Sign up' }).click();
    await expect(page.getByLabel('Referral code (optional)')).toBeVisible();
  });

  test('switching back to Log in hides the referral code field again', async ({ page }) => {
    await page.goto('/login?mode=signup');
    await page.getByRole('tab', { name: 'Log in' }).click();
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    await expect(page.getByLabel('Referral code (optional)')).toHaveCount(0);
  });

  test('a ?ref= code pre-fills the referral field on the signup form', async ({ page }) => {
    await page.goto('/login?mode=signup&ref=AB12CD3');
    await expect(page.getByLabel('Referral code (optional)')).toHaveValue('AB12CD3');
  });

  test('rejects a too-short password before ever attempting to submit', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email', { exact: true }).fill('student@example.com');
    await page.getByLabel('Password', { exact: true }).fill('123');
    await page.getByRole('button', { name: 'Log in' }).click();

    await expect(page.getByText('Password needs to be at least 6 characters.')).toBeVisible();
    // The submit button must not be left in a stuck loading state.
    await expect(page.getByRole('button', { name: 'Log in' })).toBeEnabled();
  });

  test('the show/hide password toggle actually changes the input type', async ({ page }) => {
    await page.goto('/login');
    const passwordInput = page.getByLabel('Password', { exact: true });
    await expect(passwordInput).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: 'Show password' }).click();
    await expect(passwordInput).toHaveAttribute('type', 'text');
    await page.getByRole('button', { name: 'Hide password' }).click();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('"Forgot your password?" requires an email first', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Forgot your password?' }).click();
    await expect(page.getByText('Enter your email above first, then click this again.')).toBeVisible();
  });
});
