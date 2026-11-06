import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "screenshots");

const PAGES = [
  { name: "01-endpoint-key", path: "/dashboard/endpoint" },
  { name: "02-providers", path: "/dashboard/providers" },
  { name: "03-combos", path: "/dashboard/combos" },
  { name: "04-usage", path: "/dashboard/usage" },
  { name: "05-quota", path: "/dashboard/quota" },
  { name: "06-token-saver", path: "/dashboard/token-saver" },
  { name: "07-mcp-server", path: "/dashboard/mcp" },
  { name: "08-cli-tools", path: "/dashboard/cli-tools" },
  { name: "09-proxy-pools", path: "/dashboard/proxy-pools" },
  { name: "10-media-web", path: "/dashboard/media-providers/web" },
  { name: "11-skills", path: "/dashboard/skills" },
  { name: "12-console-log", path: "/dashboard/console-log" },
  { name: "13-settings", path: "/dashboard/settings" },
];

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  console.log("Acessando página de login...");
  await page.goto("http://localhost:20127/login");
  await page.fill('input[type="password"]', "123456");
  await page.click('button[type="submit"]');

  await page.waitForURL("**/dashboard**", { timeout: 15000 });
  console.log("Login realizado com sucesso!");

  for (const p of PAGES) {
    const url = `http://localhost:20127${p.path}`;
    console.log(`Capturando ${p.name} em ${url}...`);
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
    } catch {
      await page.goto(url, { timeout: 15000 });
    }
    await page.waitForTimeout(1000); // aguarda renders de cards/recharts
    const filePath = path.join(OUT_DIR, `${p.name}.png`);
    await page.screenshot({ path: filePath, fullPage: false });
    console.log(`✓ Salvo: ${filePath}`);
  }

  await browser.close();
  console.log("Todas as capturas foram concluídas com sucesso!");
}

main().catch((err) => {
  console.error("Erro no script:", err);
  process.exit(1);
});
