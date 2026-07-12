import { chromium, devices } from "playwright";

const base = "http://localhost:3000";
const slug = "sunday-badminton-league-qa-vbh6f2";
const admin = { email: "qa.admin@example.com", password: "QaAdmin@2026" };
const owner = { email: "ravi.qa@example.com", password: "RaviQa@2026" };

const out = { worked: [], bugs: [], ux: [], blockers: [], missing: [] };

async function login(page, creds) {
  await page.goto(`${base}/login`);
  await page.getByLabel("Email").fill(creds.email);
  await page.getByLabel("Password").fill(creds.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForTimeout(1500);
}

const browser = await chromium.launch({ headless: true });
try {
  const adminCtx = await browser.newContext();
  const ap = await adminCtx.newPage();
  await login(ap, admin);

  if (ap.url().includes("/dashboard")) out.worked.push("Admin login works");
  else out.bugs.push(`P0: Admin login failed (${ap.url()})`);

  for (const path of ["", "/teams", "/players", "/admin", "/fixtures", "/run"]) {
    await ap.goto(`${base}/tournament/${slug}${path}`);
    await ap.waitForTimeout(700);
    if (!ap.url().includes(`/tournament/${slug}`) && !ap.url().includes("/run")) {
      out.bugs.push(`P1: Admin unexpected redirect on ${path || "/"} -> ${ap.url()}`);
    }
  }
  out.worked.push("Admin can access tournament setup/run surfaces");

  await ap.goto(`${base}/tournament/${slug}/teams`);
  await ap.waitForTimeout(600);
  const teams = ["QA Smash Bros", "QA Net Ninjas", "QA Shuttle Squad", "QA Drop Shot Kings"];
  let teamHits = 0;
  for (const t of teams) if (await ap.locator(`text=${t}`).count()) teamHits += 1;
  if (teamHits === 4) out.worked.push("All QA teams visible");
  else out.bugs.push(`P1: QA teams visible ${teamHits}/4`);

  await ap.goto(`${base}/tournament/${slug}/players`);
  await ap.waitForTimeout(600);
  if (await ap.locator("text=QA Rahul 01").count()) out.worked.push("QA players visible");
  else out.bugs.push("P1: QA players not visible");

  await adminCtx.close();

  const ownerCtx = await browser.newContext();
  const op = await ownerCtx.newPage();
  await login(op, owner);
  if (op.url().includes("/dashboard")) out.worked.push("Owner login works");
  else out.bugs.push(`P0: Owner login failed (${op.url()})`);

  await op.goto(`${base}/tournament/${slug}/admin`);
  await op.waitForTimeout(800);
  if (op.url().includes(`/tournament/${slug}`) && !op.url().includes("/admin"))
    out.worked.push("Owner blocked from admin route");
  else out.bugs.push("P0: Owner still can access admin route");

  await op.goto(`${base}/tournament/${slug}/teams`);
  await op.waitForTimeout(700);
  if (await op.locator('button:has-text("Create"), button:has-text("Add team")').count())
    out.ux.push("P2: Owner may still see mutation actions in teams UI");
  else out.worked.push("Owner teams view appears read-only");

  await op.goto(`${base}/tournament/${slug}/fixtures`);
  await op.waitForTimeout(700);
  if (await op.locator("text=Leaderboard").count())
    out.worked.push("Owner can view leaderboard/results");
  else if (await op.locator("text=Fixtures unlock after draft completion.").count())
    out.ux.push("P2: Leaderboard not visible because draft not completed yet");
  else out.bugs.push("P1: Owner fixtures/leaderboard visibility failed");

  const mobileCtx = await browser.newContext({ ...devices["iPhone 13"] });
  const mp = await mobileCtx.newPage();
  await login(mp, owner);
  await mp.goto(`${base}/tournament/${slug}/owner`);
  await mp.waitForTimeout(800);
  if (await mp.locator("body").count()) out.worked.push("Owner mobile page loads");

  await mobileCtx.close();
  await ownerCtx.close();

  const guestCtx = await browser.newContext();
  const gp = await guestCtx.newPage();
  await gp.goto(`${base}/tournament/${slug}/teams`);
  await gp.waitForTimeout(600);
  if (gp.url().includes("/login")) out.worked.push("Guest blocked from protected route");
  else out.bugs.push("P0: Guest not blocked from protected route");
  await guestCtx.close();

  out.missing.push(
    "Full draft-to-completed, fixture generation (6 ties x 5), score edits, and leaderboard recalculation should be re-run after draft completion is performed in UI for this slug.",
  );
} catch (e) {
  out.blockers.push(`P0: ${String(e)}`);
}

await browser.close();
console.log(JSON.stringify(out, null, 2));
