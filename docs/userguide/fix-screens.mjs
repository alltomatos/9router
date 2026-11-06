import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "screenshots");

async function fixScreenshots() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  // 1. Capturar Login real sem cookie/sessão
  console.log("Navegando para /login sem sessão...");
  await page.goto("http://localhost:20127/login");
  await page.waitForSelector('input[type="password"]', { timeout: 15000 });
  await page.waitForTimeout(1000);
  const loginPath = path.join(OUT_DIR, "00-login.png");
  await page.screenshot({ path: loginPath });
  console.log("✓ 00-login.png atualizado com sucesso!");

  // 2. Fazer login para acessar a área autenticada
  console.log("Autenticando...");
  await page.fill('input[type="password"]', "123456");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard**", { timeout: 15000 });

  // 3. Capturar /dashboard/profile (Settings real)
  console.log("Navegando para /dashboard/profile (Settings)...");
  await page.goto("http://localhost:20127/dashboard/profile", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  const settingsPath = path.join(OUT_DIR, "13-settings.png");
  await page.screenshot({ path: settingsPath });
  console.log("✓ 13-settings.png atualizado com sucesso!");

  await browser.close();
}

fixScreenshots().catch((err) => {
  console.error("Erro:", err);
  process.exit(1);
});
