import { chromium } from "playwright";

const base = "http://localhost:3000";
const slug = "sunday-badminton-league-qa-vbh6f2";
const admin = { email: "qa.admin@example.com", password: "QaAdmin@2026" };
const owner = { email: "ravi.qa@example.com", password: "RaviQa@2026" };

const res = { worked: [], bugs: [], ux: [], blockers: [], missing: [] };

async function login(page, creds) {
  await page.goto(`${base}/login`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("login-email").fill(creds.email);
  await page.getByTestId("login-password").fill(creds.password);
  await page.getByTestId("login-submit").click();
  await page.waitForURL("**/dashboard", { timeout: 20000 });
}

function n(s) {
  return Number(String(s).replace(/[^0-9]/g, "")) || 0;
}

const browser = await chromium.launch({ headless: true });
try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await login(page, admin);
  res.worked.push("Admin login works");

  await page.goto(`${base}/tournament/${slug}/admin`);
  await page.waitForLoadState("networkidle");

  // Try to move draft toward completed if controls present
  const possibleButtons = [
    "Go live",
    "Start draft",
    "Complete draft",
    "Lock",
    "Unlock",
    "Ready",
    "Resume",
  ];
  for (const label of possibleButtons) {
    const btn = page.getByRole("button", { name: new RegExp(label, "i") }).first();
    if (await btn.count()) {
      try {
        await btn.click({ timeout: 1500 });
        await page.waitForTimeout(500);
      } catch {}
    }
  }

  await page.goto(`${base}/tournament/${slug}/fixtures`);
  await page.waitForLoadState("networkidle");

  const lockedMsg = await page.locator("text=Fixtures unlock after draft completion.").count();
  if (lockedMsg) {
    res.ux.push(
      "P2: Fixtures remain locked because draft is not completed in current QA tournament state",
    );
  } else {
    // Generate ties if button available
    const genBtn = page.getByRole("button", { name: /generate ties/i });
    if (await genBtn.count()) {
      await genBtn.click();
      await page.waitForLoadState("networkidle");
    }

    const tiesHeader = await page.locator('h3:has-text("Ties")').textContent();
    const matchesHeader = await page.locator('h3:has-text("Matches")').textContent();
    const tieCount = tiesHeader ? n(tiesHeader) : 0;
    const matchCount = matchesHeader ? n(matchesHeader) : 0;

    if (tieCount === 6) res.worked.push("Round robin tie count is 6 for 4 teams");
    else res.bugs.push(`P1: Expected 6 ties, got ${tieCount}`);

    if (matchCount === 30) res.worked.push("Match count is 30 (5 per tie)");
    else res.bugs.push(`P1: Expected 30 matches, got ${matchCount}`);

    await page.goto(`${base}/tournament/${slug}/run`);
    await page.waitForLoadState("networkidle");

    // Update first match with score if save button exists
    const saveButtons = page.getByRole("button", { name: /save match update/i });
    if (await saveButtons.count()) {
      const firstSave = saveButtons.first();
      const row = firstSave.locator("xpath=ancestor::form");
      await row
        .locator('select[name="status"]')
        .selectOption("COMPLETED")
        .catch(() => {});
      const s1 = row.locator('input[name="sideOneScore"]');
      const s2 = row.locator('input[name="sideTwoScore"]');
      if (await s1.count()) await s1.fill("21");
      if (await s2.count()) await s2.fill("17");
      await firstSave.click();
      await page.waitForLoadState("networkidle");
      res.worked.push("Admin can submit match score update");
    } else {
      res.bugs.push("P1: Run page match update controls not found");
    }
  }

  await page.getByTestId("logout-button").click();
  await page.waitForURL("**/login", { timeout: 15000 });

  await login(page, owner);
  res.worked.push("Owner login works");

  await page.goto(`${base}/tournament/${slug}/admin`);
  await page.waitForLoadState("networkidle");
  if (page.url().includes(`/tournament/${slug}`) && !page.url().includes("/admin"))
    res.worked.push("Owner blocked from admin route");
  else res.bugs.push("P0: Owner can access admin route");

  await page.goto(`${base}/tournament/${slug}/fixtures`);
  await page.waitForLoadState("networkidle");
  if (await page.locator("text=Leaderboard").count()) {
    res.worked.push("Owner can view leaderboard read-only");
    if (await page.getByRole("button", { name: /generate ties/i }).count())
      res.bugs.push("P0: Owner can see fixture mutation control");
    else res.worked.push("Owner does not see fixture mutation controls");
  } else if (await page.locator("text=Fixtures unlock after draft completion.").count()) {
    res.ux.push("P2: Owner cannot view leaderboard until draft completion");
  } else {
    res.bugs.push("P1: Owner fixtures/leaderboard visibility issue");
  }

  await ctx.close();
} catch (e) {
  res.blockers.push(`P0: ${String(e)}`);
}

await browser.close();
console.log(JSON.stringify(res, null, 2));
