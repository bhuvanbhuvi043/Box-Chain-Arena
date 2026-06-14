import {copyFile, readdir} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public");
const files = (await readdir(publicDir)).filter((name) =>
  /\.(?:html|css|js|json|png|jpg|jpeg|svg|webp|ico|txt|xml)$/i.test(name)
);

await Promise.all(
  files.map((name) => copyFile(path.join(publicDir, name), path.join(root, name)))
);

console.log(`Synced ${files.length} Firebase Hosting files to GitHub Pages.`);
