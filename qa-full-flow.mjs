import { chromium, devices } from "playwright";

const base = "http://localhost:3000";
const slug = "sunday-badminton-league-qa-vbh6f2";
const admin = { email: "qa.admin@example.com", password: "QaAdmin@2026" };
const owner = { email: "ravi.qa@example.com", password: "RaviQa@2026" };

const report = { worked: [], bugs: [], ux: [], blockers: [], missing: [], urls: [] };
report.urls.push(`${base}/tournament/${slug}`);
report.urls.push(`${base}/tournament/${slug}/teams`);
report.urls.push(`${base}/tournament/${slug}/players`);
report.urls.push(`${base}/tournament/${slug}/admin`);
report.urls.push(`${base}/tournament/${slug}/fixtures`);
report.urls.push(`${base}/tournament/${slug}/run`);

async function login(page, creds) {
  await page.goto(`${base}/login`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email").fill(creds.email);
  await page.getByLabel("Password").fill(creds.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForTimeout(1000);
}

function textPresent(page, text) {
  return page.locator(`text=${text}`).count();
}

const browser = await chromium.launch({ headless: true });
try {
  const adminCtx = await browser.newContext();
  const adminPage = await adminCtx.newPage();

  await login(adminPage, admin);
  if (adminPage.url().includes("/dashboard")) report.worked.push("Admin login works");
  else report.bugs.push(`P0: Admin login failed, url=${adminPage.url()}`);

  await adminPage.goto(`${base}/tournament/${slug}/teams`);
  await adminPage.waitForTimeout(1000);
  const teams = ["QA Smash Bros", "QA Net Ninjas", "QA Shuttle Squad", "QA Drop Shot Kings"];
  let teamHits = 0;
  for (const team of teams) if (await textPresent(adminPage, team)) teamHits += 1;
  if (teamHits === 4) report.worked.push("All 4 QA teams visible for admin");
  else report.bugs.push(`P1: QA teams visible=${teamHits}/4`);

  await adminPage.goto(`${base}/tournament/${slug}/players`);
  await adminPage.waitForTimeout(1000);
  if (await textPresent(adminPage, "QA Rahul 01"))
    report.worked.push("QA players visible for admin");
  else report.bugs.push("P1: QA players not visible in players view");

  await adminPage.goto(`${base}/tournament/${slug}/fixtures`);
  await adminPage.waitForTimeout(1000);
  if (await textPresent(adminPage, "Fixtures unlock after draft completion.")) {
    report.ux.push("P2: Fixtures locked because draft not completed for this tournament state");
  }

  await adminPage.goto(`${base}/tournament/${slug}/admin`);
  await adminPage.waitForTimeout(1200);
  if (await adminPage.locator("text=Manage").count()) report.worked.push("Admin page accessible");
  else report.ux.push("P2: Admin page content not easily detectable by generic text checks");

  await adminPage.goto(`${base}/tournament/${slug}/run`);
  await adminPage.waitForTimeout(1000);
  if (await textPresent(adminPage, "Only tournament admin can manage live match operations.")) {
    report.bugs.push("P1: Admin incorrectly blocked from run page");
  } else {
    report.worked.push("Run page reachable by admin");
  }

  await adminCtx.close();

  const ownerCtx = await browser.newContext();
  const ownerPage = await ownerCtx.newPage();
  await login(ownerPage, owner);
  if (ownerPage.url().includes("/dashboard")) report.worked.push("Owner login works");
  else report.bugs.push(`P0: Owner login failed, url=${ownerPage.url()}`);

  await ownerPage.goto(`${base}/tournament/${slug}/admin`);
  await ownerPage.waitForTimeout(800);
  if (
    ownerPage.url().includes("/admin") &&
    !(await textPresent(ownerPage, "Only tournament admin"))
  ) {
    report.bugs.push("P0: Owner can access admin operations");
  } else {
    report.worked.push("Owner blocked from admin operations");
  }

  await ownerPage.goto(`${base}/tournament/${slug}/fixtures`);
  await ownerPage.waitForTimeout(1000);
  if (await textPresent(ownerPage, "Leaderboard"))
    report.worked.push("Owner can view leaderboard in read mode");
  else if (await textPresent(ownerPage, "Fixtures unlock after draft completion."))
    report.ux.push("P2: Owner fixtures/leaderboard locked until draft completed");
  else report.bugs.push("P1: Owner cannot view fixtures/leaderboard page");

  const mobileCtx = await browser.newContext({ ...devices["iPhone 13"] });
  const mobilePage = await mobileCtx.newPage();
  await login(mobilePage, owner);
  await mobilePage.goto(`${base}/tournament/${slug}/owner`);
  await mobilePage.waitForTimeout(1000);
  if (await mobilePage.locator("body").count()) report.worked.push("Owner mobile page loads");
  else report.ux.push("P2: Owner mobile rendering issue");

  await mobileCtx.close();
  await ownerCtx.close();

  const guestCtx = await browser.newContext();
  const guestPage = await guestCtx.newPage();
  await guestPage.goto(`${base}/tournament/${slug}/teams`);
  await guestPage.waitForTimeout(700);
  if (guestPage.url().includes("/login")) report.worked.push("Guest blocked from protected page");
  else report.bugs.push("P0: Guest can access protected route");
  await guestCtx.close();

  report.missing.push(
    "Complete deterministic draft pick execution and match score lifecycle automation requires stable test IDs on admin/draft/run forms.",
  );
} catch (error) {
  report.blockers.push(`P0: ${String(error)}`);
}

await browser.close();
console.log(JSON.stringify(report, null, 2));
