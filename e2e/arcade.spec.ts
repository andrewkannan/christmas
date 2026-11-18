import { expect, test, type Page } from '@playwright/test';
import { ACTIVE_ARCADE_GAMES } from '../src/types.ts';
import { GAME_RULES } from '../src/games/rules.ts';

const GAME_TITLES = ACTIVE_ARCADE_GAMES.map((g) => g.title);
const END_HEADING = /time's up|match point|out of lives|out of moves/i;

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
  if (title === 'Starlight Hockey') {
    await expect(page.getByRole('heading', { name: 'Starlight Air Hockey' })).toBeVisible();
    await page.getByRole('button', { name: /Play Solo vs Elf Bot/ }).click();
  }
}

async function playToResults(page: Page, title: string) {
  await expect(page.getByLabel(/seconds left/)).toBeVisible();
  await page.clock.runFor(fastForwardMsFor(title));
  await expect(page.getByRole('heading', { name: END_HEADING })).toBeVisible();
}

test('player page has no Team/admin entry point and displays CCC JB Bilingual', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Christmas Arcade' })).toBeVisible();
  await expect(page.getByText('CCC JB Bilingual')).toBeVisible();
  await expect(page.getByRole('button', { name: /team/i })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /team|admin|console/i })).toHaveCount(0);
});

for (const title of GAME_TITLES) {
  test(`${title}: countdown → HUD → round ends → results with score + 3-slot podium → retry`, async ({ page }) => {
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
    } else if (title === 'Starlight Hockey') {
      await expect(page.getByLabel(/^Goals: You \d+, .+ \d+$/)).toBeVisible();
    } else {
      await expect(page.getByLabel(/of 3 lives left/)).toBeVisible();
    }

    await playToResults(page, title);

    // Results: final score, best chip, rank spotlight, and 3-slot Champion Board (#1, #2, #3).
    await expect(page.getByLabel(/You scored \d+ points/)).toBeVisible();
    await expect(page.getByText(/New best!|Best \d+/)).toBeVisible();
    await expect(page.getByRole('heading', { name: new RegExp(`${title} · Champion Board`) })).toBeVisible();
    const podium = page.getByRole('list', { name: `${title} top 3` });
    await expect(podium.getByRole('listitem')).toHaveCount(3);
    await expect(page.getByText(/Checking your rank/)).toHaveCount(0);

    // Retry starts a brand-new round with full lives/moves.
    await page.getByRole('button', { name: /Play again/ }).click();
    await expect(page.getByLabel(/^Score 0$/)).toBeVisible();
    await expect(page.getByRole('heading', { name: END_HEADING })).toHaveCount(0);

    expect(consoleErrors).toEqual([]);
  });
}

test('claim after a round → VIP Celebration Invitation, countdown, Maps+Waze, 1-click Calendar, Friend Challenge & unlimited rankings dialog', async ({
  page,
}) => {
  await openGame(page, 'Starlight Hockey');
  await playToResults(page, 'Starlight Hockey');

  await page.getByRole('button', { name: /Claim my gift/ }).click();
  await page.getByLabel('Name').fill('Mei Ling Tan');
  await page.getByLabel('WhatsApp Number').fill('012 345 6789');
  await page.getByRole('button', { name: /Get Gift/ }).click();

  await expect(page.getByRole('heading', { name: 'Mei Ling Tan' })).toBeVisible();

  // Show code / XMAS-XXXX is removed; Christmas Blessing Gift asks to show our team to collect with us.
  await expect(page.getByText(/XMAS-[A-Z0-9]{4}/)).toHaveCount(0);
  await expect(page.getByText(/SHOW CODE TO COLLECT/i)).toHaveCount(0);
  await expect(page.getByText('Christmas Blessing Gift', { exact: true })).toBeVisible();
  await expect(page.getByText('Show our team to collect with us')).toBeVisible();

  // VIP Celebration Invitation + CCC JB Bilingual + Greatest Gift + Live Countdown Tab + Google Maps & Waze + 1-click Calendar.
  const invite = page.getByRole('article', { name: 'VIP Celebration Service Invitation' });
  await expect(invite).toBeVisible();
  await expect(invite.getByText(/CCC JB Bilingual/i)).toBeVisible();
  await expect(invite.getByText(/Greatest Gift/)).toBeVisible();
  await expect(invite.getByRole('link', { name: /Google Maps/ })).toBeVisible();
  await expect(invite.getByRole('link', { name: /Waze/ })).toBeVisible();
  await expect(page.getByRole('timer')).toBeVisible();
  await expect(page.getByRole('link', { name: /Add to Calendar/ })).toHaveCount(1);

  // Save Invitation uses Blob/Share API, never an <a href="data:..."> link that hijacks Safari's URL bar.
  await expect(page.locator('a[href^="data:"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Save Invitation/ })).toBeVisible();

  // Goal-driven WhatsApp friend challenge link invites friends to play & beat score.
  const shareCard = page.getByRole('link', { name: /Challenge Friends to Play/ });
  await expect(shareCard).toBeVisible();
  await expect(shareCard).toHaveAttribute('href', /wa\.me\/\?text=.*friend%3DMei/);

  const ranks = page.getByRole('region', { name: /My Ranks & Champions/ });
  await expect(ranks).toBeVisible();
  for (const title of GAME_TITLES) {
    await expect(
      ranks.getByRole('button', { name: `View full player rankings for ${title}` })
    ).toBeVisible();
  }

  // Clicking a game row opens the unlimited full player rankings modal (<dialog>).
  await ranks.getByRole('button', { name: 'View full player rankings for Starlight Hockey' }).click();
  const dialog = page.locator('dialog.leaderboard-dialog[open]');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Starlight Hockey Rankings' })).toBeVisible();
  await expect(dialog.getByText(/Best personal score per player · Unlimited full history/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Close rankings' }).click();
  await expect(dialog).toHaveCount(0);

  // Tapping Play directly inside My Ranks launches that game immediately.
  await ranks.getByRole('button', { name: 'Play Block Stack' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Block Stack' })).toBeVisible();
});

test('2-phone live versus: guest generates 4-digit code, evangelist joins on 2nd phone, live match pairs & protects guest-only leaderboard', async ({
  browser,
}) => {
  const guestContext = await browser.newContext();
  const evangelistContext = await browser.newContext();
  const guestPage = await guestContext.newPage();
  const evangelistPage = await evangelistContext.newPage();

  try {
    // 1. Guest opens Starlight Hockey and receives a live 4-digit room code
    await guestPage.goto('/');
    await guestPage.getByRole('button', { name: /Starlight Hockey/ }).click();
    const codeRegion = guestPage.locator('.hockey-code-tiles');
    await expect(codeRegion).toHaveAttribute('data-room-code', /^\d{4}$/);
    const roomCode = (await codeRegion.getAttribute('data-room-code')) ?? '';
    expect(roomCode).toMatch(/^\d{4}$/);

    // 2. Evangelist opens Starlight Hockey on Phone 2, validates 4-digit input, and enters the code
    await evangelistPage.goto('/');
    await evangelistPage.getByRole('button', { name: /Starlight Hockey/ }).click();
    await evangelistPage.getByRole('tab', { name: 'Enter 4-Digit Code' }).click();

    const codeInput = evangelistPage.getByLabel('4-Digit Room Code');
    await codeInput.fill('12');
    await codeInput.blur();
    await expect(codeInput).toHaveAttribute('aria-invalid', 'true');

    await codeInput.fill(roomCode);
    await expect(codeInput).toHaveAttribute('aria-invalid', 'false');
    await evangelistPage.getByLabel(/Your Display Name/).fill('Daniel');
    await evangelistPage.getByRole('button', { name: 'Join Live Match' }).click();

    // 3. Both phones automatically pair and transition into live Starlight Hockey!
    await expect(guestPage.getByLabel(/^Goals: You \d+, Daniel \d+$/)).toBeVisible();
    await expect(evangelistPage.getByLabel(/^Goals: You \d+, Guest Player \d+$/)).toBeVisible();

    // Wait past the 2.4s countdown so live physics are running
    await guestPage.waitForTimeout(2600);

    // Evangelist pulls striker to the side corner while Guest sweeps center ice to score goals!
    const evCanvas = evangelistPage.locator('canvas.game-canvas');
    const evBox = await evCanvas.boundingBox();
    if (evBox) {
      await evangelistPage.mouse.move(evBox.x + 28, evBox.y + evBox.height - 40);
      await evangelistPage.mouse.down();
      await evangelistPage.mouse.move(evBox.x + 26, evBox.y + evBox.height - 45);
      await evangelistPage.mouse.up();
    }

    const guestCanvas = guestPage.locator('canvas.game-canvas');
    const gBox = await guestCanvas.boundingBox();
    expect(gBox).not.toBeNull();

    // Sweep Guest striker upward repeatedly until 7-goal knockout or match end (fast, real physics!)
    for (let cycle = 0; cycle < 45; cycle++) {
      const done = await guestPage
        .getByRole('heading', { name: END_HEADING })
        .isVisible()
        .catch(() => false);
      if (done) break;

      if (gBox) {
        const cx = gBox.x + gBox.width * (0.35 + ((cycle % 5) * 0.075));
        await guestPage.mouse.move(cx, gBox.y + gBox.height * 0.84);
        await guestPage.mouse.down();
        await guestPage.mouse.move(gBox.x + gBox.width * 0.5, gBox.y + gBox.height * 0.28, {
          steps: 5,
        });
        await guestPage.mouse.up();
      }
      await guestPage.waitForTimeout(320);
    }

    // Ensure both phones reach results (wait for remaining clock if <7 goals were scored)
    await expect(guestPage.getByRole('heading', { name: END_HEADING })).toBeVisible({
      timeout: 42_000,
    });
    await expect(evangelistPage.getByRole('heading', { name: END_HEADING })).toBeVisible({
      timeout: 15_000,
    });

    // 4. Evangelist sees Challenger summary (NOT the guest Claim Gift form, NOT ranked on public board!)
    await expect(evangelistPage.getByText('Challenger Mode · Guest Ranked Only')).toBeVisible();
    await expect(
      evangelistPage.getByRole('button', { name: 'Join Next 4-Digit Code' })
    ).toBeVisible();
    await expect(evangelistPage.getByRole('button', { name: /Claim my gift/ })).toHaveCount(0);

    // 5. Guest claims gift & VIP invitation -> ranked on public Starlight Hockey board with Daniel credited!
    await guestPage.getByRole('button', { name: /Claim my gift/ }).click();
    await guestPage.getByLabel('Name').fill('Rachel Lim');
    await guestPage.getByLabel('WhatsApp Number').fill('016 888 4321');
    await guestPage.getByRole('button', { name: /Get Gift/ }).click();

    await expect(guestPage.getByRole('heading', { name: 'Rachel Lim' })).toBeVisible();
    await expect(
      guestPage
        .getByRole('article', { name: 'VIP Celebration Service Invitation' })
        .getByText(/CCC JB Bilingual/)
    ).toBeVisible();
  } finally {
    await guestContext.close();
    await evangelistContext.close();
  }
});

test('friend challenge link displays personalized Beat Friend banner on the lobby', async ({ page }) => {
  await page.goto('/?friend=Andrew&target=135');
  await expect(page.getByText(/Challenge · Beat Andrew \(135 pts\)/)).toBeVisible();
});

test('a registered player keeps playing from the pass without re-entering details', async ({ page }) => {
  await openGame(page, 'Berry Slash');
  await playToResults(page, 'Berry Slash');
  await page.getByRole('button', { name: /Claim my gift/ }).click();
  await page.getByLabel('Name').fill('Aaron Lee');
  await page.getByLabel('WhatsApp Number').fill('012 777 1234');
  await page.getByRole('button', { name: /Get Gift/ }).click();
  await expect(page.getByRole('heading', { name: 'Aaron Lee' })).toBeVisible();

  await page.getByRole('button', { name: /Play More Arcade Games/ }).click();
  await page.getByRole('button', { name: /Santa Dash/ }).click();
  await playToResults(page, 'Santa Dash');

  // With a pass, results offer Play again + VIP Invitation & Ranks instead of the claim form.
  await expect(page.getByRole('button', { name: /Claim my gift/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /VIP Invitation & Ranks/ })).toBeVisible();
});

test('/team Command Center displays 6 official campaign targets (1500/500/500/500/100/100) and saves live contact remarks + RSVP pipeline', async (
  { page },
  testInfo
) => {
  const consoleErrors: string[] = [];
  page.on('pageerror', (err) => consoleErrors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  const isPixel = testInfo.project.name === 'pixel-7';
  const guestName = isPixel ? 'Hannah Pixel' : 'Hannah Galaxy';
  const guestPhone = isPixel ? '012-998 7766' : '012-998 7767';
  const uniqueNoteKeyword = isPixel ? 'City Square' : 'Mount Austin';
  const visitorId = `vis-hannah-${testInfo.project.name}-${Date.now()}`;

  // Ensure a distinct contact + Google Maps & Waze clicks exist for each browser profile
  const leadCreateRes = await page.request.post('/api/leads', {
    data: {
      name: guestName,
      phone: guestPhone,
      countryCode: '60',
      gamePlayed: 'santa-dash',
      score: 44,
      targetScore: 18,
      volunteerName: 'Andrew',
      visitorId,
      clientRequestId: `e2e-hannah-${testInfo.project.name}-${Date.now()}`,
    },
  });
  const { claim } = (await leadCreateRes.json()) as { claim: { claimToken: string } };

  await page.request.post('/api/events', {
    data: {
      visitorId,
      claimToken: claim.claimToken,
      eventType: 'maps_click',
      isPostInteraction: true,
      volunteerName: 'Andrew',
    },
  });
  await page.request.post('/api/events', {
    data: {
      visitorId,
      claimToken: claim.claimToken,
      eventType: 'waze_click',
      isPostInteraction: true,
      volunteerName: 'Andrew',
    },
  });

  await page.goto('/team');
  await expect(
    page.getByRole('heading', { name: 'Team Command Center Sign-In' })
  ).toBeVisible();

  await page.getByLabel('Team Access PIN').fill('2468');
  await page.getByRole('button', { name: 'Unlock Command Center' }).click();

  await expect(
    page.getByRole('heading', { name: /CCC JB Bilingual Command Center/ })
  ).toBeVisible();
  await expect(page.locator('.storage-status-pill')).toBeVisible();

  // Verify all 6 official campaign targets render with their exact benchmarks
  await expect(
    page.getByRole('heading', { name: 'Official Evangelism Campaign Targets (6 Goals)' })
  ).toBeVisible();
  for (const [goalTitle, targetLabel] of [
    ['Total QR Scans & Page Views', '/ 1,500 target'],
    ['Games Started', '/ 500 target'],
    ['Registered Contacts (Name + Phone)', '/ 500 target'],
    ['Physical Gifts Handed Out', '/ 500 target'],
    ['Games Played AFTER Street Interaction', '/ 100 target'],
    ['Shared Invites + Saved Tickets + Calendar Adds', '/ 100 target'],
  ] as const) {
    const card = page.locator('article.target-card', { hasText: goalTitle });
    await expect(card).toBeVisible();
    await expect(card.getByText(targetLabel)).toBeVisible();
  }

  // Click Maps & Waze Clicks in Mission Control -> inspect who clicked Google Maps vs Waze
  await page.getByRole('button', { name: /Maps & Waze Clicks/ }).click();
  const logDialog = page.locator('dialog.activity-log-dialog[open]');
  await expect(logDialog).toBeVisible();
  await expect(
    logDialog.getByRole('heading', { name: 'Google Maps & Waze Venue Clicks' })
  ).toBeVisible();
  await expect(logDialog.getByText(guestName).first()).toBeVisible();
  await expect(logDialog.getByText('Google Maps Click').first()).toBeVisible();
  await expect(logDialog.getByText('Waze Click').first()).toBeVisible();
  await logDialog.getByRole('button', { name: 'Close Log' }).click();
  await expect(logDialog).toHaveCount(0);

  // Switch to Live Contacts CRM and open guest's Remarks & Follow-Up modal
  await page.locator('.tab-bar').getByRole('button', { name: /Live Contacts/ }).click();
  await page.getByRole('button', { name: `Add remark for ${guestName}` }).click();

  const crmDialog = page.locator('dialog.crm-dialog:not(.activity-log-dialog)[open]');
  await expect(crmDialog).toBeVisible();
  await expect(crmDialog.getByRole('heading', { name: guestName })).toBeVisible();
  await expect(
    crmDialog.getByRole('heading', { name: /Complete Click & Activity Log/ })
  ).toBeVisible();
  await expect(crmDialog.getByText('Waze Click')).toBeVisible();
  await expect(crmDialog.getByText('Google Maps Click')).toBeVisible();

  // Apply a 1-tap quick tag + custom remark + Confirmed Coming RSVP stage
  await crmDialog.getByRole('button', { name: /\+ Coming with family/ }).click();
  const notesField = crmDialog.getByLabel(/Evangelism & Pastoral Remarks/);
  await expect(notesField).toHaveValue('Coming with family');
  await notesField.fill(
    `Coming with family · Met near ${uniqueNoteKeyword}, speaks Mandarin & English`
  );

  await crmDialog.getByRole('radio', { name: /Confirmed Coming/ }).check();
  await crmDialog.getByRole('button', { name: 'Save Remarks & Status' }).click();
  await expect(crmDialog).toHaveCount(0);

  // Verify inline remark cell, Confirmed RSVP badge, and pipeline filter + remarks search
  await expect(
    page.getByRole('button', { name: `Edit remarks for ${guestName}` })
  ).toContainText(`Met near ${uniqueNoteKeyword}`);
  await expect(
    page.getByRole('button', { name: new RegExp(`Follow-up stage for ${guestName}: Confirmed Coming`) })
  ).toBeVisible();

  await page.getByRole('button', { name: /Confirmed RSVP/ }).click();
  await expect(page.getByText(guestName)).toBeVisible();

  await page.getByLabel('Search Guest, Phone, Code, or Remarks').fill(uniqueNoteKeyword);
  await expect(page.getByText(guestName)).toBeVisible();

  // Open Team Members tab, add team member with personal passcode, then sign in with passcode only
  await page.locator('.tab-bar').getByRole('button', { name: /Team Members/ }).click();
  await expect(
    page.getByRole('heading', { name: 'Outreach Team Members & Passcode Access' })
  ).toBeVisible();

  const memberName = isPixel ? 'Andrew Kannan' : 'Grace Lim';
  const memberPasscode = isPixel ? 'AK2708' : 'GL1905';
  const expectedRoleBadge = isPixel ? 'Leader' : 'Evangelist';

  await page.getByLabel('Full Name').fill(memberName);
  await page.getByLabel('Personal Login Passcode').fill(memberPasscode);
  if (isPixel) {
    await page.getByRole('radio', { name: /Team Leader \/ Admin/ }).check();
  } else {
    await page.getByRole('radio', { name: /Evangelist \/ Team Member/ }).check();
  }
  await page.getByRole('button', { name: 'Add Team Member' }).click();

  await expect(page.getByText(`${memberName} added to the team!`)).toBeVisible();
  await expect(page.locator('.passcode-issued-banner__code')).toHaveText(memberPasscode);
  await expect(page.locator('.team-roster-table').getByText(memberName)).toBeVisible();

  // Lock console and sign back in using ONLY the personal passcode (lowercase to test case-insensitivity)
  await page.getByRole('button', { name: 'Lock Console' }).click();
  await expect(
    page.getByRole('heading', { name: 'Team Command Center Sign-In' })
  ).toBeVisible();

  await page.getByLabel('Team Access PIN').fill(memberPasscode.toLowerCase());
  await page.getByRole('button', { name: 'Unlock Command Center' }).click();

  await expect(page.locator('.signed-in-user-pill')).toContainText(
    `${memberName} · ${expectedRoleBadge}`
  );

  // Verify QR Board Maker pre-fills the signed-in team member's name
  await page.locator('.tab-bar').getByRole('button', { name: /QR Board Maker/ }).click();
  await expect(page.getByLabel('Evangelist / Challenger Name')).toHaveValue(memberName);

  expect(consoleErrors).toEqual([]);
});

test('/storyboard renders Vintage Car → Mirror Smile → JESUS "Yes Appa!" promo script, 3 story continuations, and live JESUS Calling phone prop', async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on('pageerror', (err) => consoleErrors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.goto('/storyboard');
  await expect(
    page.getByRole('heading', { name: /“Yes Appa!” — Street Christmas Arcade Storyboard/ })
  ).toBeVisible();

  // Verify the 3 opening frames + street QR + 2-phone hockey beats
  const shotGrid = page.locator('.sb-shot-grid');
  await expect(shotGrid.getByRole('heading', { name: 'Vintage Classic Entrance' })).toBeVisible();
  await expect(
    shotGrid.getByRole('heading', { name: 'Centre Mirror Eye-Lock & Smile' })
  ).toBeVisible();
  await expect(
    shotGrid.getByRole('heading', { name: /Incoming Call: JESUS — “Yes Appa!”/ })
  ).toBeVisible();
  await expect(
    shotGrid.getByRole('heading', { name: /2-Phone Live Starlight Hockey Duel/ })
  ).toBeVisible();

  // Switch between the 3 creative story continuation tabs
  await page.getByRole('button', { name: /Cut B: “One Classic Car, Whole Evangelism Squad”/ }).click();
  await expect(shotGrid.getByRole('heading', { name: 'Rapid Curbside Squad Pickups!' })).toBeVisible();

  await page.getByRole('button', { name: /Cut C: “From Grey Scroll to Christmas Gold”/ }).click();
  await expect(
    shotGrid.getByRole('heading', { name: 'One QR Scan Bursts the Frame Into Color!' })
  ).toBeVisible();

  // Mark Shot 1 as filmed and verify Shoot Progress updates
  await page.getByRole('button', { name: /Mark Shot 1 \(Vintage Classic Entrance\) as filmed/ }).click();
  await expect(page.getByText('1 / 8 Shots')).toBeVisible();

  // Launch the built-in On-Set "JESUS Calling" Screen Prop modal and answer the call
  await page.getByRole('button', { name: /Launch “JESUS Calling” Screen Prop/ }).click();
  const propModal = page.locator('dialog.sb-prop-dialog[open]');
  await expect(propModal).toBeVisible();
  await expect(propModal.locator('.sb-call-name')).toHaveText('JESUS');

  await propModal.getByRole('button', { name: 'Answer incoming call from Jesus' }).click();
  await expect(propModal.getByText(/“Yes Appa! Ready to bring Christmas joy!”/)).toBeVisible();

  await propModal.getByRole('button', { name: 'Close Prop' }).click();
  await expect(propModal).toHaveCount(0);

  expect(consoleErrors).toEqual([]);
});

test('/register, /present, and /admin flow: church member registers souls, King of Glory Crown fills from bottom to top, and admin sets Crown goal & checks in Christmas attendance', async ({
  page,
}, testInfo) => {
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  const artifactDir =
    'C:/Users/andrewkannan/.gemini/antigravity/brain/51b63e48-b75f-463f-b008-5ea1870cf2ef';
  const isPixel = testInfo.project.name === 'pixel-7';

  // 1. Church member opens /register and registers a family of 3 new souls
  await page.goto('/register');
  await expect(
    page.getByRole('heading', { name: 'Register Your New Soul for Christmas' })
  ).toBeVisible();

  await page.getByLabel(/Church Member Name/i).fill('Andrew Kannan');
  await page.getByLabel(/Church Member Phone Number/i).fill('012-778 2708');
  await page
    .getByLabel(/Home Church Zone/i)
    .selectOption('Zone 2 · Mount Austin & Tebrau');

  await page.getByLabel(/New Soul Name/i).fill('Mr. & Mrs. Rajan');
  await page.getByLabel(/New Soul Phone Number/i).fill('016-889 4455');
  await page.getByRole('button', { name: '3 Souls' }).click();
  await page.getByLabel(/Address/i).fill('28 Jalan Austin Heights 8/2, JB');

  if (isPixel) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `${artifactDir}/v180-1-register-form.png`,
      fullPage: true,
    });
  }

  await page
    .getByRole('button', { name: /Register Soul \(\+3 to King of Glory Crown\)/i })
    .click();

  await expect(
    page.getByRole('heading', { name: /👑 \+3 Souls Added to the King of Glory Crown!/i })
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: /Send Personal WhatsApp Invite to Mr\. & Mrs\. Rajan/i })
  ).toHaveAttribute('href', /https:\/\/wa\.me\/60168894455/);

  // 2. Open /present big-screen King of Glory Christmas Crown visualizer
  await page.getByRole('button', { name: /Watch Crown Rise on \/present/i }).click();
  await expect(
    page.getByRole('heading', { name: 'Crown the King of Glory with Souls' })
  ).toBeVisible();
  await expect(page.getByText('Mr. & Mrs. Rajan').first()).toBeVisible();

  if (isPixel) {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.getByRole('button', { name: /Demo Crown Fill/i }).click();
    await page.waitForTimeout(850);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `${artifactDir}/v180-2-present-crown-desktop.png`,
      fullPage: true,
    });
  }

  // 3. Navigate to /admin, sign in, set Final Full Crown target, and mark Mr. & Mrs. Rajan as Attended on Christmas
  await page.goto('/admin');
  await page.getByLabel(/Team Passcode or Team Access PIN/i).fill('2468');
  await page.getByRole('button', { name: /Unlock Command Center/i }).click();

  await expect(
    page.getByRole('heading', {
      name: /King of Glory Crown, Soul Registrations & Christmas Attendance/i,
    })
  ).toBeVisible();

  // Update Final Full Crown target to 100 souls
  await page.getByRole('button', { name: '100', exact: true }).click();
  await page.getByRole('button', { name: /Save Final Full Crown Number/i }).click();
  await expect(page.getByText(/Final Full Crown is now set to 100 souls/i)).toBeVisible();

  // Verify the registered soul appears in the unified table with WhatsApp link & check-in attendance toggle
  const rajanRow = page.locator('tr', { hasText: 'Mr. & Mrs. Rajan' }).first();
  await expect(rajanRow).toBeVisible();
  await expect(rajanRow.getByText('3 Members')).toBeVisible();
  await expect(rajanRow.getByText('Zone 2 · Mount Austin & Tebrau')).toBeVisible();

  const attendBtn = rajanRow.getByRole('button', {
    name: /Mark Mr\. & Mrs\. Rajan as attended on Christmas/i,
  });
  await attendBtn.click();

  await expect(
    rajanRow.getByRole('button', {
      name: /Mark Mr\. & Mrs\. Rajan as not attended/i,
    })
  ).toHaveAttribute('aria-pressed', 'true');

  if (isPixel) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `${artifactDir}/v180-3-admin-console-desktop.png`,
      fullPage: true,
    });

    await page.goto('/winners');
    await expect(
      page.getByRole('heading', { name: /Step 1: Pick Any Game to Play & Win Instantly/i })
    ).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `${artifactDir}/v180-4-winners-booth-hub.png`,
      fullPage: true,
    });
  }

  expect(consoleErrors).toEqual([]);
});




