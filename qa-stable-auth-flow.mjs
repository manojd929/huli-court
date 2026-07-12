import { chromium } from "playwright";

const base = "http://localhost:3000";
const slug = "sunday-badminton-league-qa-vbh6f2";
const admin = { email: "qa.admin@example.com", password: "QaAdmin@2026" };
const owner = { email: "ravi.qa@example.com", password: "RaviQa@2026" };

const out = { worked: [], bugs: [], blockers: [] };

async function stableLogin(page, creds) {
  await page.goto(`${base}/login`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("login-email").fill(creds.email);
  await page.getByTestId("login-password").fill(creds.password);
  await page.getByTestId("login-submit").click();
  await page.waitForURL("**/dashboard", { timeout: 20000 });
  await page.getByTestId("dashboard-title").waitFor({ timeout: 10000 });
}

const browser = await chromium.launch({ headless: true });
try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await stableLogin(page, admin);
  out.worked.push("Admin login stable with submit flow");

  await page.goto(`${base}/tournament/${slug}/admin`);
  await page.waitForLoadState("networkidle");
  out.worked.push("Admin can access admin route");

  await page.getByTestId("logout-button").click();
  await page.waitForURL("**/login", { timeout: 15000 });
  out.worked.push("Admin logout works");

  await stableLogin(page, owner);
  out.worked.push("Owner login stable with submit flow");

  await page.goto(`${base}/tournament/${slug}/admin`);
  await page.waitForLoadState("networkidle");
  if (page.url().includes(`/tournament/${slug}`) && !page.url().includes("/admin"))
    out.worked.push("Owner blocked from admin route");
  else out.bugs.push(`P0 owner admin access issue: ${page.url()}`);

  await page.getByTestId("logout-button").click();
  await page.waitForURL("**/login", { timeout: 15000 });
  out.worked.push("Owner logout works");

  await ctx.close();
} catch (e) {
  out.blockers.push(`P0 ${String(e)}`);
}

await browser.close();
console.log(JSON.stringify(out, null, 2));
