import { chromium } from "playwright";

const base = "http://localhost:3000";
const slug = "sunday-badminton-league-qa-vbh6f2";
const admin = { email: "qa.admin@example.com", password: "QaAdmin@2026" };
const owner = { email: "ravi.qa@example.com", password: "RaviQa@2026" };

const r = { worked: [], bugs: [], ux: [], blockers: [], missing: [] };

async function login(page, creds) {
  await page.goto(`${base}/login`);
  await page.getByLabel("Email").fill(creds.email);
  await page.getByLabel("Password").fill(creds.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForTimeout(2000);
}

const browser = await chromium.launch({ headless: true });
try {
  const a = await browser.newContext();
  const ap = await a.newPage();
  await login(ap, admin);
  if (ap.url().includes("/dashboard")) r.worked.push("Admin login ok");
  else r.bugs.push(`P0 admin login failed: ${ap.url()}`);

  for (const path of ["", "/teams", "/players", "/admin", "/fixtures", "/run"]) {
    await ap.goto(`${base}/tournament/${slug}${path}`);
    await ap.waitForTimeout(800);
    if (ap.url().includes("/login")) r.bugs.push(`P0 auth lost on ${path || "/"} `);
    else r.worked.push(`Admin can open ${path || "/"} page`);
  }

  const o = await browser.newContext();
  const op = await o.newPage();
  await login(op, owner);
  if (op.url().includes("/dashboard")) r.worked.push("Owner login ok");
  else r.bugs.push(`P0 owner login failed: ${op.url()}`);

  await op.goto(`${base}/tournament/${slug}/admin`);
  await op.waitForTimeout(800);
  if (op.url().includes("/admin") && !(await op.locator("text=Only tournament admin").count()))
    r.bugs.push("P0 owner accessed admin");
  else r.worked.push("Owner blocked from admin");

  await op.goto(`${base}/tournament/${slug}/fixtures`);
  await op.waitForTimeout(800);
  if (await op.locator("text=Leaderboard").count()) r.worked.push("Owner can view leaderboard");
  else if (await op.locator("text=Fixtures unlock after draft completion.").count())
    r.ux.push("P2 fixtures locked until draft complete");
  else r.bugs.push("P1 owner fixtures visibility unclear");
} catch (e) {
  r.blockers.push(`P0 ${String(e)}`);
}

await browser.close();
console.log(JSON.stringify(r, null, 2));
