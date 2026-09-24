import { test, expect } from '@playwright/test';

// /demo is a no-login, no-database, no-AI walkthrough that intentionally
// mirrors the markup/classes of the real /study and /quiz pages (see the
// comment at the top of app/demo/page.js), so it's a reasonable stand-in
// smoke test for "study a deck" and "take a quiz" given that the real
// pages need a signed-in user and seeded deck data (see
// tests/e2e/README.md for why that's out of scope in this sandbox).

test.describe('demo: flashcard -> quiz -> completion loop', () => {
  // The cookie/storage ConsentNotice also has a button labeled "Got it",
  // which collides with the demo flashcard's own "Got it" button on a first
  // visit (no ack stored yet) and makes every getByRole('button', { name:
  // 'Got it' }) locator ambiguous. Pre-seed the ack, same as a returning
  // visitor, so these tests exercise the demo flow itself, not the notice.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('reclipse-consent-ack', '1'));
  });

  test('flip a card, answer the quiz correctly, and reach the completion screen', async ({ page }) => {
    await page.goto('/demo');

    // --- Flashcard stage ---
    await expect(page.getByRole('heading', { name: 'Try a flashcard' })).toBeVisible();
    await expect(page.getByText('Why does active recall beat re-reading for long-term memory?')).toBeVisible();

    // The card is a CSS 3D flip: both faces exist in the DOM (and pass a
    // basic Playwright visibility check) even before it's flipped, so the
    // real signal for "revealed or not" is the flip container's own state
    // class rather than the back face's text visibility.
    const flipCard = page.locator('.flip');
    await expect(flipCard).not.toHaveClass(/flip--revealed/);

    await page.getByRole('button', { name: 'Show answer' }).click();
    await expect(flipCard).toHaveClass(/flip--revealed/);
    await expect(page.getByText(/the "testing effect"/)).toBeVisible();

    await page.getByRole('button', { name: 'Got it' }).click();

    // --- Quiz stage ---
    await expect(page.getByRole('heading', { name: 'Try a quiz question' })).toBeVisible();
    const correctOption = page.getByRole('button', { name: 'Carbon dioxide' });
    await correctOption.click();

    await expect(page.getByText('Correct')).toBeVisible();
    await expect(page.getByText(/tiny pores called stomata/)).toBeVisible();

    await page.getByRole('button', { name: 'Finish demo' }).click();

    // --- Completion stage ---
    await expect(page.getByRole('heading', { name: "That's the whole loop" })).toBeVisible();
    const cta = page.getByRole('link', { name: 'Get started free' });
    await expect(cta).toHaveAttribute('href', '/login?mode=signup');
  });

  test('picking a wrong quiz answer still reveals the explanation and lets you continue', async ({ page }) => {
    await page.goto('/demo');
    await page.getByRole('button', { name: 'Show answer' }).click();
    await page.getByRole('button', { name: 'Still learning' }).click();

    const wrongOption = page.getByRole('button', { name: 'Oxygen' });
    await wrongOption.click();

    await expect(page.getByText('Not quite')).toBeVisible();
    // Once answered, every option becomes disabled — no changing your pick.
    await expect(wrongOption).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Finish demo' })).toBeVisible();
  });

  test('space/enter flips the flashcard via keyboard, matching the real study page', async ({ page }) => {
    await page.goto('/demo');
    const flipCard = page.locator('.flip');
    await expect(flipCard).not.toHaveClass(/flip--revealed/);
    await page.keyboard.press('Space');
    await expect(flipCard).toHaveClass(/flip--revealed/);
  });

  test('"Replay demo" resets all the way back to the flashcard stage', async ({ page }) => {
    await page.goto('/demo');
    await page.getByRole('button', { name: 'Show answer' }).click();
    await page.getByRole('button', { name: 'Got it' }).click();
    await page.getByRole('button', { name: 'Carbon dioxide' }).click();
    await page.getByRole('button', { name: 'Finish demo' }).click();

    await page.getByRole('button', { name: 'Replay demo' }).click();
    await expect(page.getByRole('heading', { name: 'Try a flashcard' })).toBeVisible();
    await expect(page.locator('.flip')).not.toHaveClass(/flip--revealed/);
  });
});
