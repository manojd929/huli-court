import { chromium } from "playwright";

const base = "http://localhost:3000";
const creds = {
  admin: { email: "qa.admin@example.com", password: "QaAdmin@2026" },
  owner: { email: "ravi.qa@example.com", password: "RaviQa@2026" },
};

async function login(page, account) {
  await page.goto(`${base}/login`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForLoadState("networkidle");
}

async function logout(page) {
  const signOutButton = page
    .locator('button:has-text("Sign out"), button:has-text("Logout")')
    .first();
  if (await signOutButton.count()) {
    await signOutButton.click();
    await page.waitForLoadState("networkidle");
    return true;
  }
  return false;
}

const result = { worked: [], issues: [] };
const browser = await chromium.launch({ headless: true });

try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await login(page, creds.admin);
  if (page.url().includes("/dashboard")) result.worked.push("Admin login redirected to dashboard");
  else result.issues.push(`Admin login redirect mismatch: ${page.url()}`);

  const adminLogoutWorked = await logout(page);
  if (adminLogoutWorked) {
    if (page.url().includes("/login")) result.worked.push("Admin logout returned to login");
    else result.issues.push(`Admin logout did not return to login: ${page.url()}`);
  } else {
    result.issues.push("Admin logout control not found in current UI state");
  }

  await login(page, creds.owner);
  if (page.url().includes("/dashboard")) result.worked.push("Owner login redirected to dashboard");
  else result.issues.push(`Owner login redirect mismatch: ${page.url()}`);

  const ownerLogoutWorked = await logout(page);
  if (ownerLogoutWorked) {
    if (page.url().includes("/login")) result.worked.push("Owner logout returned to login");
    else result.issues.push(`Owner logout did not return to login: ${page.url()}`);
  } else {
    result.issues.push("Owner logout control not found in current UI state");
  }

  await ctx.close();
} catch (error) {
  result.issues.push(`Flow error: ${String(error)}`);
}

await browser.close();
console.log(JSON.stringify(result, null, 2));
