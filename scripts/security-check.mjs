import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

async function filesIn(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const found = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await filesIn(path)));
    else found.push(path);
  }
  return found;
}

const srcFiles = (await filesIn(join(root, "src"))).filter((path) => path.endsWith(".ts") || path.endsWith(".tsx"));
const readme = await readFile(join(root, "README.md"), "utf8");
const sources = await Promise.all(srcFiles.map(async (path) => ({ path, text: await readFile(path, "utf8") })));

function rel(path) {
  return path.slice(root.length);
}

for (const file of [...sources, { path: join(root, "README.md"), text: readme }]) {
  if (file.text.includes("joaopro9678")) failures.push(`${rel(file.path)} ainda contém o e-mail de admin`);
  if (file.text.includes("x-forwarded-for")) failures.push(`${rel(file.path)} confia em x-forwarded-for`);
  if (file.text.includes("backgroundImage")) failures.push(`${rel(file.path)} monta CSS com dado do visitante`);
  if (file.text.includes("dangerouslySetInnerHTML") || file.text.includes("new Function") || file.text.includes("child_process")) {
    failures.push(`${rel(file.path)} tem uma superfície perigosa`);
  }
}

for (const file of sources) {
  const calls = file.text.match(/[^.\w]sql\s*(?:<[^>\n]*>)?\s*\(/g) ?? [];
  const literal = /sql(?:\s*<[^>\n]*>)?\s*\(\s*(`[^`]*`|"[^"\\]*"|'[^'\\]*')/g;
  const matched = [];
  for (const found of file.text.matchAll(literal)) {
    const raw = found[1];
    const query = raw.slice(1, -1);
    const after = file.text.slice(found.index + found[0].length).trimStart();
    if (after.startsWith("+")) failures.push(`${rel(file.path)} concatena SQL`);
    if (/['"`]|--|\/\*|;|\$\{/.test(query)) failures.push(`${rel(file.path)} tem SQL fora dos parâmetros: ${query.slice(0, 80)}`);
    matched.push(found);
  }
  if (calls.length !== matched.length) {
    failures.push(`${rel(file.path)} tem sql() que não é um literal fixo (${calls.length} chamadas, ${matched.length} literais)`);
  }
}

const migrationDir = join(root, "migrations");
const migrations = await readdir(migrationDir);
for (const name of migrations) {
  if (!/^\d{3}_[a-z0-9_]+\.sql$/.test(name)) failures.push(`migrations/${name} tem nome fora do padrão`);
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`security-check: ${sources.length} arquivos, ${migrations.length} migrations`);
