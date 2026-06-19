import {execFileSync} from "node:child_process";
import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public");
const publicFiles = await readdir(publicDir);
const pageFiles = publicFiles.filter((name) => name.endsWith(".html"));
const errors = [];

async function exists(file) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

for (const name of publicFiles) {
  if (!/\.(?:html|css|js|json|png|jpg|jpeg|svg|webp|ico|txt|xml)$/i.test(name)) {
    continue;
  }
  const hosted = await readFile(path.join(publicDir, name));
  const pagesPath = path.join(root, name);
  if (!(await exists(pagesPath))) {
    errors.push(`GitHub Pages mirror is missing ${name}`);
    continue;
  }
  const pages = await readFile(pagesPath);
  if (!hosted.equals(pages)) {
    errors.push(`${name} differs between public/ and the repository root`);
  }
}

for (const name of pageFiles) {
  const html = await readFile(path.join(publicDir, name), "utf8");
  for (const match of html.matchAll(/href="([^"]+)"/g)) {
    const href = match[1];
    if (/^(?:https?:|mailto:|#)/.test(href)) continue;
    const target = path.resolve(publicDir, href.split(/[?#]/)[0]);
    if (!(await exists(target))) errors.push(`${name} links to missing ${href}`);
  }
}

const indexHtml = await readFile(path.join(publicDir, "index.html"), "utf8");
const ids = [...indexHtml.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
if (duplicateIds.length) errors.push(`Duplicate HTML IDs: ${duplicateIds.join(", ")}`);

const aiPowerMatch = indexHtml.match(/function aiPowerForStage\(id\)\{([\s\S]*?)\n  \}/);
if (!aiPowerMatch || !/if\(id<=1\) return \.62;[\s\S]*return 1;/.test(aiPowerMatch[1])) {
  errors.push("AI power contract changed: Stage 1 should be friendly, Stage 2+ should be full power");
}

if (!indexHtml.includes("function chooseNoMercyCapture(captures,lookahead=24)")) {
  errors.push("No-mercy capture chooser is missing");
}

if (!indexHtml.includes("captureContinuation(x.e,lookahead)*360")) {
  errors.push("AI capture continuation must be rewarded, not penalized");
}

if (!indexHtml.includes("remaining!==2") || !indexHtml.includes("projectedGap<-1")) {
  errors.push("Hard-hearted handout guard must only allow controlled two-box gifts");
}

const moduleMatch = indexHtml.match(/<script type="module">([\s\S]*?)<\/script>/);
if (!moduleMatch) {
  errors.push("Frontend module script was not found");
} else {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "box-chain-arena-"));
  const moduleFile = path.join(tempDir, "frontend.mjs");
  try {
    await writeFile(moduleFile, moduleMatch[1]);
    execFileSync(process.execPath, ["--check", moduleFile], {stdio: "inherit"});
  } finally {
    await rm(tempDir, {recursive: true, force: true});
  }
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(
  `Checked ${pageFiles.length} public pages, ${ids.length} IDs, local links, mirrors, and frontend syntax.`
);
