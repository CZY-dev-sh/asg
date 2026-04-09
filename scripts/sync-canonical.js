#!/usr/bin/env node
"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (_) {
    return false;
  }
}

async function readBuffer(filePath) {
  return fs.readFile(filePath);
}

async function filesEqual(a, b) {
  const [aExists, bExists] = await Promise.all([pathExists(a), pathExists(b)]);
  if (!aExists || !bExists) return false;
  const [aBuf, bBuf] = await Promise.all([readBuffer(a), readBuffer(b)]);
  return aBuf.equals(bBuf);
}

async function copyIfDifferent(src, dst) {
  await fs.mkdir(path.dirname(dst), { recursive: true });
  if (await filesEqual(src, dst)) return false;
  await fs.copyFile(src, dst);
  return true;
}

async function listFilesByExt(dirPath, ext) {
  if (!(await pathExists(dirPath))) return [];
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && path.extname(entry.name).toLowerCase() === ext.toLowerCase())
    .map((entry) => path.join(dirPath, entry.name));
}

async function syncComponentsToPages() {
  const componentsDir = path.join(ROOT, "asg-admin-hub", "components");
  const pagesDir = path.join(ROOT, "pages");
  const componentFiles = await listFilesByExt(componentsDir, ".html");
  const pageFiles = await listFilesByExt(pagesDir, ".html");
  const pageBasenames = new Set(pageFiles.map((f) => path.basename(f)));
  let changed = 0;

  for (const src of componentFiles) {
    const name = path.basename(src);
    if (!pageBasenames.has(name)) continue;
    const dst = path.join(pagesDir, name);
    if (await copyIfDifferent(src, dst)) changed++;
  }
  return changed;
}

async function syncPagesToComponents() {
  const componentsDir = path.join(ROOT, "asg-admin-hub", "components");
  const pagesDir = path.join(ROOT, "pages");
  const pageFiles = await listFilesByExt(pagesDir, ".html");
  let changed = 0;

  for (const src of pageFiles) {
    const name = path.basename(src);
    const dst = path.join(componentsDir, name);
    if (await copyIfDifferent(src, dst)) changed++;
  }
  return changed;
}

async function syncAppsScriptToRootModules() {
  // Mirror sync is intentionally disabled to prevent recreating deduped root/apps-script duplicates.
  return 0;
}

async function syncDocsBidirectionalNewestWins() {
  const rootDocs = path.join(ROOT, "docs");
  const asgDocs = path.join(ROOT, "asg-admin-hub", "docs");
  const [rootFiles, asgFiles] = await Promise.all([
    listFilesByExt(rootDocs, ".md"),
    listFilesByExt(asgDocs, ".md")
  ]);

  const byName = new Map();
  for (const filePath of rootFiles) byName.set(path.basename(filePath), { root: filePath, asg: null });
  for (const filePath of asgFiles) {
    const key = path.basename(filePath);
    const row = byName.get(key) || { root: null, asg: null };
    row.asg = filePath;
    byName.set(key, row);
  }

  let changed = 0;
  for (const pair of byName.values()) {
    if (!pair.root || !pair.asg) continue;
    const [rootStat, asgStat] = await Promise.all([fs.stat(pair.root), fs.stat(pair.asg)]);
    const newer = rootStat.mtimeMs >= asgStat.mtimeMs ? pair.root : pair.asg;
    const older = newer === pair.root ? pair.asg : pair.root;
    if (await copyIfDifferent(newer, older)) changed++;
  }
  return changed;
}

async function main() {
  const [htmlChanged, pageToComponentChanged, appsScriptChanged, docsChanged] = await Promise.all([
    syncComponentsToPages(),
    syncPagesToComponents(),
    syncAppsScriptToRootModules(),
    syncDocsBidirectionalNewestWins()
  ]);

  console.log("Sync complete.");
  console.log(`- pages mirrors updated: ${htmlChanged}`);
  console.log(`- component mirrors updated: ${pageToComponentChanged}`);
  console.log(`- apps-script mirrors updated: ${appsScriptChanged}`);
  console.log(`- docs mirrors updated: ${docsChanged}`);
}

main().catch((err) => {
  console.error("sync-canonical failed:", err && err.message ? err.message : err);
  process.exit(1);
});
