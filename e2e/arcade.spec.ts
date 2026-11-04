import { expect, test, type Page } from '@playwright/test';
import { ACTIVE_ARCADE_GAMES } from '../src/types.ts';
import { GAME_RULES } from '../src/games/rules.ts';

const GAME_TITLES = ACTIVE_ARCADE_GAMES.map((g) => g.title);
const END_HEADING = /time's up|out of lives|out of moves/i;

/** Round cap + countdown + life-lost pauses + end banner, with margin. */
function fastForwardMsFor(title: string): number {
  const game = ACTIVE_ARCADE_GAMES.find((g) => g.title === title);
  if (!game) throw new Error(`Unknown game ${title}`);
  return (GAME_RULES[game.id].timeLimitSec + 9) * 1000;
}

async function openGame(page: Page, title: string) {
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button', { name: new RegExp(title) }).click();
}

async function playToResults(page: Page, title: string) {
  await expect(page.getByLabel(/seconds left/)).toBeVisible();
  await page.clock.runFor(fastForwardMsFor(title));
  await expect(page.getByRole('heading', { name: END_HEADING })).toBeVisible();
}

test('player page has no Team/admin entry point', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Christmas Arcade' })).toBeVisible();
  await expect(page.getByRole('button', { name: /team/i })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /team|admin|console/i })).toHaveCount(0);
});

for (const title of GAME_TITLES) {
  test(`${title}: countdown → HUD → round ends → results with score + top 3 → retry`, async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => consoleErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await openGame(page, title);

    // Countdown overlay shows the game and its one-line control hint.
    await expect(page.getByRole('status').filter({ hasText: title })).toBeVisible();
    await expect(page.getByLabel(/^Score \d+$/)).toBeVisible();
    if (title === 'Candy Match') {
      await expect(page.getByLabel(/moves left/)).toBeVisible();
    } else {
      await expect(page.getByLabel(/of 3 lives left/)).toBeVisible();
    }

    await playToResults(page, title);

    // Results: final score, best chip, rank line, and the game's all-time top 3 section.
    await expect(page.getByLabel(/You scored \d+ points/)).toBeVisible();
    await expect(page.getByText(/New best!|Best \d+/)).toBeVisible();
    await expect(page.getByRole('heading', { name: new RegExp(`${title} · Top 3`) })).toBeVisible();
    await expect(page.getByText(/Checking your rank/)).toHaveCount(0);

    // Retry starts a brand-new round with full lives/moves.
    await page.getByRole('button', { name: /Play again/ }).click();
    await expect(page.getByLabel(/^Score 0$/)).toBeVisible();
    await expect(page.getByRole('heading', { name: END_HEADING })).toHaveCount(0);

    expect(consoleErrors).toEqual([]);
  });
}

test('claim after a round → pass shows the gift code and My ranks for all 5 games', async ({ page }) => {
  await openGame(page, 'Claw Grab');
  await playToResults(page, 'Claw Grab');

  await page.getByRole('button', { name: /Claim my gift/ }).click();
  await page.getByLabel('Name').fill('Mei Ling Tan');
  await page.getByLabel('WhatsApp Number').fill('012 345 6789');
  await page.getByRole('button', { name: /Get Gift/ }).click();

  await expect(page.getByRole('heading', { name: 'Mei Ling Tan' })).toBeVisible();
  await expect(page.getByText(/XMAS-[A-Z0-9]{4}/)).toBeVisible();
  const ranks = page.getByRole('region', { name: /My ranks/ });
  await expect(ranks).toBeVisible();
  for (const title of GAME_TITLES) {
    await expect(ranks.getByText(title)).toBeVisible();
  }
});

test('a registered player keeps playing from the pass without re-entering details', async ({ page }) => {
  await openGame(page, 'Candy Match');
  await playToResults(page, 'Candy Match');
  await page.getByRole('button', { name: /Claim my gift/ }).click();
  await page.getByLabel('Name').fill('Aaron Lee');
  await page.getByLabel('WhatsApp Number').fill('012 777 1234');
  await page.getByRole('button', { name: /Get Gift/ }).click();
  await expect(page.getByRole('heading', { name: 'Aaron Lee' })).toBeVisible();

  await page.getByRole('button', { name: /Play All 5 Games/ }).click();
  await page.getByRole('button', { name: /Santa Dash/ }).click();
  await playToResults(page, 'Santa Dash');

  // With a pass, results offer Play again + My pass instead of the claim form.
  await expect(page.getByRole('button', { name: /Claim my gift/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /My pass/ })).toBeVisible();
});
