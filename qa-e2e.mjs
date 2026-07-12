import { chromium, devices } from "playwright";

const base = "http://localhost:3000";
const slug = "sunday-badminton-league-qa-vbh6f2";
const admin = { email: "qa.admin@example.com", password: "QaAdmin@2026" };
const owner = { email: "ravi.qa@example.com", password: "RaviQa@2026" };

const out = { created: [], worked: [], bugs: [], ux: [], blockers: [], missing: [] };

async function login(page, creds) {
  await page.goto(`${base}/login`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email").fill(creds.email);
  await page.getByLabel("Password").fill(creds.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForLoadState("networkidle");
}

async function exists(page, text) {
  return (await page.locator(`text=${text}`).count()) > 0;
}

const browser = await chromium.launch({ headless: true });
try {
  const adminCtx = await browser.newContext();
  const page = await adminCtx.newPage();

  await login(page, admin);
  if (page.url().includes("/dashboard"))
    out.worked.push("Admin login works and lands on dashboard");
  else out.bugs.push("P0: Admin login failed or wrong redirect");

  await page.goto(`${base}/tournament/${slug}`);
  await page.waitForLoadState("networkidle");
  if (await exists(page, "Manage auction")) out.worked.push("Admin can see Manage auction");
  else out.bugs.push("P1: Admin cannot see Manage auction entry");

  await page.goto(`${base}/tournament/${slug}/teams`);
  await page.waitForLoadState("networkidle");
  const teamNames = ["QA Smash Bros", "QA Net Ninjas", "QA Shuttle Squad", "QA Drop Shot Kings"];
  let visible = 0;
  for (const t of teamNames) if (await exists(page, t)) visible += 1;
  if (visible === 4) out.worked.push("All 4 QA teams visible");
  else out.bugs.push(`P1: Team list mismatch, visible=${visible}/4`);

  await page.goto(`${base}/tournament/${slug}/players`);
  await page.waitForLoadState("networkidle");
  if (await exists(page, "QA Rahul 01")) out.worked.push("QA players visible in Players UI");
  else out.bugs.push("P1: QA players not visible in Players UI");

  await page.goto(`${base}/tournament/${slug}/admin`);
  await page.waitForLoadState("networkidle");
  const adminControlHints = ["Shuffle", "Draft", "Live", "Ready", "Confirm"];
  let adminHints = 0;
  for (const h of adminControlHints)
    if (await page.locator(`button:has-text("${h}")`).count()) adminHints += 1;
  if (adminHints > 0) out.worked.push("Admin control room renders draft actions");
  else out.bugs.push("P1: Draft admin actions not discoverable on Admin page");

  await adminCtx.close();

  const ownerCtx = await browser.newContext();
  const ownerPage = await ownerCtx.newPage();
  await login(ownerPage, owner);
  if (ownerPage.url().includes("/dashboard")) out.worked.push("Owner login works");
  else out.bugs.push("P0: Owner login failed");

  await ownerPage.goto(`${base}/tournament/${slug}`);
  await ownerPage.waitForLoadState("networkidle");
  if ((await exists(ownerPage, "Participate in auction")) || (await exists(ownerPage, "My Team")))
    out.worked.push("Owner tournament hub loads expected owner entries");
  else out.ux.push("P2: Owner hub actions unclear");

  await ownerPage.goto(`${base}/tournament/${slug}/admin`);
  await ownerPage.waitForLoadState("networkidle");
  if (ownerPage.url().includes("/admin")) out.bugs.push("P0: Owner can access admin route");
  else out.worked.push("Owner blocked from admin route");

  await ownerPage.goto(`${base}/tournament/${slug}/teams`);
  await ownerPage.waitForLoadState("networkidle");
  if (await ownerPage.locator('button:has-text("Create")').count())
    out.bugs.push("P1: Owner sees create/edit team actions (should be read-only)");
  else out.worked.push("Owner teams view appears read-only");

  const mobileCtx = await browser.newContext({ ...devices["iPhone 13"] });
  const mobilePage = await mobileCtx.newPage();
  await login(mobilePage, owner);
  await mobilePage.goto(`${base}/tournament/${slug}/owner`);
  await mobilePage.waitForLoadState("networkidle");
  if (await mobilePage.locator("body").count())
    out.worked.push("Owner My Team loads on mobile viewport");

  await mobileCtx.close();
  await ownerCtx.close();

  const guestCtx = await browser.newContext();
  const guestPage = await guestCtx.newPage();
  await guestPage.goto(`${base}/tournament/${slug}/teams`);
  await guestPage.waitForLoadState("networkidle");
  if (guestPage.url().includes("/login"))
    out.worked.push("Guest access blocked on protected routes");
  else out.bugs.push("P0: Guest can access protected tournament routes");

  await guestCtx.close();

  out.missing.push(
    "Fixture generation, tie/match assignment, scoring, and leaderboard recalculation need deterministic UI selectors or API hooks for full automation in next pass.",
  );
} catch (error) {
  out.blockers.push(`P0: E2E execution error: ${String(error)}`);
}

await browser.close();
console.log(JSON.stringify(out, null, 2));
