#!/usr/bin/env node
/* Builds asg-admin-console.html — a single Squarespace-ready file that composes
   the existing admin surfaces under one Google-login + chip-bar shell, repointed
   at the Supabase backend. Re-run after editing any source surface or shell asset.

   Usage:  node asg-admin-hub/tools/build-admin-console.mjs
*/
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const comp = resolve(here, "..", "components");
const read = (p) => readFileSync(p, "utf8");

/* --- defaults (override on the page via window.* before this loads) --- */
const DEFAULTS = {
  API_BASE: "https://asg-production.up.railway.app",
  SUPABASE_URL: "https://ikaeggxiazzwtofntqji.supabase.co",
  SUPABASE_ANON: "sb_publishable_y6o4SQQf9430Nl24W53TBA_aLP3t82Z",
};
const SUPABASE_CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js";

/* --- repoint hardcoded Apps Script constants to window.* overrides --- */
function overridable(src, declKeyword, name, windowVar) {
  // const NAME="http..."  ->  const NAME=String(window.WINDOWVAR||"http...").trim();
  const re = new RegExp(declKeyword + "\\s+" + name + '\\s*=\\s*"([^"]*)"\\s*;');
  return src.replace(re, (_m, url) =>
    `${declKeyword} ${name}=String(window.${windowVar}||"${url}").trim();`);
}

function patchOverview(src) {
  src = overridable(src, "const", "STATS_API", "ASG_PIPELINE_STATS_API");
  src = overridable(src, "const", "FOLDERS_API", "ASG_RECENT_FOLDERS_API");
  src = overridable(src, "const", "BUYERS_CSV", "ASG_BUYERS_CSV");
  src = overridable(src, "const", "SELLERS_CSV", "ASG_SELLERS_CSV");
  return src;
}
function patchListings(src) {
  return overridable(src, "var", "LISTINGS_API", "ASG_LISTINGS_API");
}

/* --- load + patch the five surfaces --- */
const surfaces = {
  overview: patchOverview(read(resolve(comp, "admin-dashboard.html"))),
  deals: read(resolve(comp, "deal-tracker.html")),
  // Listings surface is the Supabase-backed Listing Workshop (reads window.ASGConsole).
  listings: read(resolve(comp, "listing-workshop.html")),
  directory: read(resolve(comp, "team-directory.html")),
  command: read(resolve(comp, "command-center.html")),
};

function section(name, content, hidden) {
  return `  <section class="asgc-surface" data-surface="${name}"${hidden ? " hidden" : ""}>\n${content}\n  </section>`;
}

/* --- shell assets --- */
const css = read(resolve(here, "console-shell.css"));
let body = read(resolve(here, "console-body.html"));
const appJs = read(resolve(here, "console-app.js"));
let configJs = read(resolve(here, "console-config.js"))
  .replace("__API_BASE__", DEFAULTS.API_BASE)
  .replace("__SUPABASE_URL__", DEFAULTS.SUPABASE_URL)
  .replace("__SUPABASE_ANON__", DEFAULTS.SUPABASE_ANON);

/* inject surfaces into the body placeholders. Use function replacements so the
   component source (which contains $', $`, ${ ...} sequences) is inserted
   verbatim and not interpreted as String.replace special patterns. */
const inject = (placeholder, name, hidden) => {
  body = body.replace(placeholder, () => section(name, surfaces[name], hidden));
};
inject("    <!--SURFACE:overview-->", "overview", false);
inject("    <!--SURFACE:deals-->", "deals", true);
inject("    <!--SURFACE:listings-->", "listings", true);
inject("    <!--SURFACE:directory-->", "directory", true);
inject("    <!--SURFACE:command-->", "command", true);

/* --- assemble --- */
const out = `<!-- ════════════════════════════════════════════════════════════════
     ASG ADMIN CONSOLE  —  GENERATED FILE, DO NOT EDIT BY HAND
     Source: asg-admin-hub/tools/* + the live surface components.
     Rebuild: node asg-admin-hub/tools/build-admin-console.mjs

     One Squarespace code block. Composes Overview (admin dashboard), Deals,
     Listings, Team Directory and Command Center behind a Google login, with a
     write drawer wired to the Supabase backend and per-admin usage tracking.

     Configure (optional) BEFORE this block:
       <script>
         window.ASG_API_BASE = "https://your-backend";
         window.ASG_SUPABASE_URL = "https://xxxx.supabase.co";
         window.ASG_SUPABASE_ANON_KEY = "sb_publishable_...";
       </script>
     ════════════════════════════════════════════════════════════════ -->
<script src="${SUPABASE_CDN}"></script>
<script>
${configJs}
</script>

<style>
${css}
</style>

${body}

<script>
${appJs}
</script>
`;

const target = resolve(comp, "asg-admin-console.html");
writeFileSync(target, out, "utf8");
const kb = (out.length / 1024).toFixed(0);
console.log(`Wrote ${target} (${kb} KB)`);
