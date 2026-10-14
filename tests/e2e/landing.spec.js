import { test, expect } from '@playwright/test';

// Smoke coverage for the signed-out landing experience: no auth, no
// database, no AI call — just "does the marketing page render and route
// people to the right place."

test.describe('landing page (signed out)', () => {
  test('renders the hero and sends upload buttons through sign-up to the real upload page', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: /Your notes\.\s*Ready to study\./ })).toBeVisible();

    const uploads = page.getByRole('link', { name: 'Upload my notes' });
    await expect(uploads.first()).toBeVisible();
    for (const link of await uploads.all()) {
      await expect(link).toHaveAttribute('href', '/login?mode=signup&next=/upload');
    }
  });

  test('the example can be skipped to working cards, with no upload or generation request', async ({ page }) => {
    const calls = [];
    page.on('request', (r) => { if (/\/api\/(generate|extract-pdf)/.test(r.url())) calls.push(r.url()); });
    await page.goto('/');
    await page.getByRole('link', { name: 'Try an example' }).click();
    const skip = page.getByRole('button', { name: 'Skip to cards' });
    if (await skip.isVisible()) await skip.click();

    const reveal = page.getByRole('button', { name: 'Reveal answer' }).first();
    await reveal.click();
    await expect(page.getByRole('button', { name: 'Show question' }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Next card' }).first().click();
    await expect(page.getByLabel('Card 2 of 5').first()).toBeVisible();

    await page.getByRole('button', { name: 'Photo of notes' }).click();
    await expect(page.getByLabel('Card 1 of 5').first()).toBeVisible();
    await page.getByRole('button', { name: 'About this demo' }).first().click();
    await expect(page.getByText('Your files are processed when you upload them.')).toBeVisible();
    expect(calls).toEqual([]);
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
