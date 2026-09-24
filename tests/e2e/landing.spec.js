import { test, expect } from '@playwright/test';

// Smoke coverage for the signed-out landing experience: no auth, no
// database, no AI call — just "does the marketing page render and route
// people to the right place."

test.describe('landing page (signed out)', () => {
  test('renders the hero and routes an unauthenticated visitor to sign up', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: /Study less\.\s*Remember more\./ })).toBeVisible();

    const getStarted = page.getByRole('link', { name: 'Get started free' }).first();
    await expect(getStarted).toBeVisible();
    await expect(getStarted).toHaveAttribute('href', '/login?mode=signup');

    const haveAccount = page.getByRole('link', { name: 'I have an account' });
    await expect(haveAccount).toHaveAttribute('href', '/login');
  });

  test('links to the interactive demo, reachable with no login', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'try a 30-second demo' }).click();
    await expect(page).toHaveURL(/\/demo$/);
    await expect(page.getByRole('heading', { name: 'Try a flashcard' })).toBeVisible();
  });

  test('navigating to the login page directly renders the auth form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  });

  test('an unknown route renders the app-level not-found page instead of a raw error', async ({ page }) => {
    const res = await page.goto('/this-route-does-not-exist');
    expect(res.status()).toBe(404);
    await expect(page.getByRole('link', { name: 'Back to my decks' })).toBeVisible();
  });
});
