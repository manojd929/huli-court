import { chromium } from "playwright";

const base = "http://localhost:3000";
const slug = "sunday-badminton-league-qa-vbh6f2";
const admin = { email: "qa.admin@example.com", password: "QaAdmin@2026" };
const owner = { email: "ravi.qa@example.com", password: "RaviQa@2026" };
const out = { worked: [], bugs: [], ux: [], blockers: [] };

async function goto(p, u) {
  await p.goto(u, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(500);
}
async function logoutIfPossible(p) {
  const b = p.getByTestId("logout-button");
  if (await b.count()) {
    await b.click();
    await p.waitForTimeout(1000);
  }
}
async function login(p, c) {
  await goto(p, `${base}/login`);
  await p.getByTestId("login-email").fill(c.email);
  await p.getByTestId("login-password").fill(c.password);
  await p.getByTestId("login-submit").click();
  await p.waitForTimeout(2000);
}

const browser = await chromium.launch({ headless: true });
try {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();

  await goto(p, `${base}/dashboard`);
  await logoutIfPossible(p);
  await login(p, admin);
  if (p.url().includes("/dashboard")) out.worked.push("Admin login works after forced logout");
  else out.bugs.push(`P0 admin login failed: ${p.url()}`);

  await goto(p, `${base}/tournament/${slug}/fixtures`);
  if (await p.locator("text=Fixtures unlock after draft completion.").count())
    out.ux.push("P2 fixtures locked until draft completion");
  else {
    const gen = p.getByRole("button", { name: /generate ties/i });
    if (await gen.count()) {
      await gen.click();
      await p.waitForTimeout(1200);
    }
    const ties = (await p.locator('h3:has-text("Ties")').textContent()) || "";
    const matches = (await p.locator('h3:has-text("Matches")').textContent()) || "";
    const tn = Number((ties.match(/\d+/) || ["0"])[0]);
    const mn = Number((matches.match(/\d+/) || ["0"])[0]);
    if (tn === 6) out.worked.push("6 ties present");
    else out.bugs.push(`P1 expected 6 ties got ${tn}`);
    if (mn === 30) out.worked.push("30 matches present");
    else out.bugs.push(`P1 expected 30 matches got ${mn}`);

    await goto(p, `${base}/tournament/${slug}/run`);
    const save = p.getByRole("button", { name: /save match update/i }).first();
    if (await save.count()) {
      const form = save.locator("xpath=ancestor::form");
      await form
        .locator('select[name="status"]')
        .selectOption("COMPLETED")
        .catch(() => {});
      const s1 = form.locator('input[name="sideOneScore"]');
      const s2 = form.locator('input[name="sideTwoScore"]');
      if (await s1.count()) await s1.fill("21");
      if (await s2.count()) await s2.fill("18");
      await save.click();
      await p.waitForTimeout(1200);
      out.worked.push("Admin score update submitted");
    } else out.bugs.push("P1 no score update control found");
  }

  await logoutIfPossible(p);
  await login(p, owner);
  if (p.url().includes("/dashboard")) out.worked.push("Owner login works after logout");
  else out.bugs.push(`P0 owner login failed: ${p.url()}`);

  await goto(p, `${base}/tournament/${slug}/admin`);
  if (p.url().includes(`/tournament/${slug}`) && !p.url().includes("/admin"))
    out.worked.push("Owner blocked from admin");
  else out.bugs.push("P0 owner can access admin");

  await goto(p, `${base}/tournament/${slug}/fixtures`);
  if (await p.locator("text=Leaderboard").count())
    out.worked.push("Owner can view leaderboard read-only");
  else if (await p.locator("text=Fixtures unlock after draft completion.").count())
    out.ux.push("P2 owner leaderboard locked until draft completion");
  else out.bugs.push("P1 owner fixtures/leaderboard issue");
  if (await p.getByRole("button", { name: /generate ties/i }).count())
    out.bugs.push("P0 owner can mutate fixtures");

  await ctx.close();
} catch (e) {
  out.blockers.push(`P0 ${String(e)}`);
}
await browser.close();
console.log(JSON.stringify(out, null, 2));
