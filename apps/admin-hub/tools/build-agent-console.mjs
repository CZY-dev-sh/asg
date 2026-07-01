#!/usr/bin/env node
/* Builds asg-agent-console.html — a single Squarespace-ready file that gives every
   ASG agent an authenticated hub. The Overview surface is the EXISTING personal-hub
   component (agent-personal-hub-alex-stoykov.html), sliced out and parameterized so
   it renders for whoever is logged in: the hardcoded per-agent constants become reads
   of `window.ASG_AGENT`, which the shell publishes after resolving the signed-in agent
   from the Supabase directory. The Overview's data endpoints (Apps Script) are left
   untouched, so it stays byte-identical to the personal hub agents already use.

   Usage:  node apps/admin-hub/tools/build-agent-console.mjs
*/
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const comp = resolve(here, "..", "components");
const read = (p) => readFileSync(p, "utf8");

const DEFAULTS = {
  API_BASE: "https://asg-production.up.railway.app",
  SUPABASE_URL: "https://ikaeggxiazzwtofntqji.supabase.co",
  SUPABASE_ANON: "sb_publishable_y6o4SQQf9430Nl24W53TBA_aLP3t82Z",
};
const SUPABASE_CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js";

/* --- Overview: slice the personal-hub component (div + style + first <script>) and
   parameterize the per-agent constants so it renders from window.ASG_AGENT. --- */
function buildOverview() {
  const full = read(resolve(comp, "agent-personal-hub-alex-stoykov.html"));
  const end = full.indexOf("</script>");
  if (end === -1) throw new Error("could not find end of personal-hub Overview script");
  let src = full.slice(0, end + "</script>".length);

  // Auto-running IIFE -> a named init the shell calls after login.
  src = src.replace(/(<script>\s*)\(function\s*\(\)\s*\{/, "$1window.__asgInitOverview=function(){");
  const lastClose = src.lastIndexOf("})();");
  if (lastClose === -1) throw new Error("could not find IIFE close in Overview");
  src = src.slice(0, lastClose) + "};" + src.slice(lastClose + "})();".length);

  // Per-agent constants -> window.ASG_AGENT (each keeps the original as a fallback so
  // the source file still works standalone).
  src = src.replace(
    /const FUB_AGENT_NAME=("[^"]*");/,
    "const FUB_AGENT_NAME=(window.ASG_AGENT&&window.ASG_AGENT.fubName)||$1;",
  );
  src = src.replace(
    /const SAM_MARKETING_FOLDER=("[^"]*");/,
    "const SAM_MARKETING_FOLDER=(window.ASG_AGENT&&window.ASG_AGENT.marketingFolder)||$1;",
  );
  src = src.replace(
    /const AGENT_PROFILE=(\{[\s\S]*?\});/,
    "const AGENT_PROFILE=(window.ASG_AGENT&&window.ASG_AGENT.profile)||$1;",
  );
  src = src.replace(
    /const AGENT_MATCH_TOKENS=(\[[\s\S]*?\])\.map\(normalize\)\.filter\(Boolean\);/,
    "const AGENT_MATCH_TOKENS=((window.ASG_AGENT&&window.ASG_AGENT.matchTokens)||$1).map(normalize).filter(Boolean);",
  );

  // Sanity: the replacements must have happened.
  for (const marker of ["__asgInitOverview", "window.ASG_AGENT.profile", "window.ASG_AGENT.fubName", "window.ASG_AGENT.matchTokens"]) {
    if (!src.includes(marker)) throw new Error("Overview parameterization failed: missing " + marker);
  }
  return src;
}

const surfaces = {
  overview: buildOverview(),
  listings: read(resolve(comp, "agent-hub-listings.html")),
  deals: read(resolve(comp, "agent-hub-deals.html")),
  marketing: read(resolve(comp, "agent-hub-marketing.html")),
  resources: read(resolve(comp, "agent-hub-resources.html")),
};

function section(name, content, hidden) {
  return `  <section class="asgc-surface" data-surface="${name}"${hidden ? " hidden" : ""}>\n${content}\n  </section>`;
}

/* --- shell assets (shared CSS with the admin console) --- */
const css = read(resolve(here, "console-shell.css"));
let body = read(resolve(here, "agent-console-body.html"));
const appJs = read(resolve(here, "agent-console-app.js"));
const configJs = read(resolve(here, "console-config.js"))
  .replace("__API_BASE__", DEFAULTS.API_BASE)
  .replace("__SUPABASE_URL__", DEFAULTS.SUPABASE_URL)
  .replace("__SUPABASE_ANON__", DEFAULTS.SUPABASE_ANON);

const inject = (placeholder, name, hidden) => {
  body = body.replace(placeholder, () => section(name, surfaces[name], hidden));
};
inject("    <!--SURFACE:overview-->", "overview", false);
inject("    <!--SURFACE:listings-->", "listings", true);
inject("    <!--SURFACE:deals-->", "deals", true);
inject("    <!--SURFACE:marketing-->", "marketing", true);
inject("    <!--SURFACE:resources-->", "resources", true);

const out = `<!-- ════════════════════════════════════════════════════════════════
     ASG AGENT HUB  —  GENERATED FILE, DO NOT EDIT BY HAND
     Source: apps/admin-hub/tools/agent-console-* + the personal-hub component.
     Rebuild: node apps/admin-hub/tools/build-agent-console.mjs

     One Squarespace code block. Overview is the personal-hub, rendered for the
     signed-in agent; plus My Listings, Deals, Marketing and Resources behind a
     Compass login.

     Configure (optional) BEFORE this block:
       <script>
         window.ASG_API_BASE = "https://your-backend";
         window.ASG_SUPABASE_URL = "https://xxxx.supabase.co";
         window.ASG_SUPABASE_ANON_KEY = "sb_publishable_...";
         window.ASG_SELLER_WIZARD_URL = "https://.../seller-wizard"; // optional
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

const target = resolve(comp, "asg-agent-console.html");
writeFileSync(target, out, "utf8");
const kb = (out.length / 1024).toFixed(0);
console.log(`Wrote ${target} (${kb} KB)`);
