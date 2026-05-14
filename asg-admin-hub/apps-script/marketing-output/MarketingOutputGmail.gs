// MarketingOutputGmail.gs - ASG marketing output (Gmail + web app JSON / JSONP / HTML).
// Repo: asg-admin-hub/apps-script/marketing-output/
// ?format=html uses HtmlService. UI template is motGetBuiltinEmbedTemplate_() below.
// (Do not paste Code.gs into an HTML file — MarketingOutputEmbed.html in the repo is HTML only.)
// Deploy web app as "Execute as: Me". See docs/API-ENDPOINTS.md.

var MOT_DEFAULTS = {
  ellieEmail: "ellie.ngassa@compass.com",
  maxThreads: 2000,
  searchBatch: 100
};

var MOT_CATEGORIES = [
  {
    name: "Listing Assets",
    keywords: [
      "photos,",
      "photos for",
      "photos and",
      "photos &",
      "3d walkthrough",
      "3d walk",
      "walkthrough",
      "floor plan",
      "floorplan",
      "virtual staging",
      "virtually staged",
      "drone",
      "aerial",
      "matterport",
      "- photos",
      "rental photos"
    ],
    color: "#2563eb"
  },
  {
    name: "Agent Portraits",
    keywords: ["portrait", "headshot", "head shot", "team photo", "portraits are ready"],
    color: "#9333ea"
  },
  {
    name: "Video",
    keywords: [
      "video",
      "episode",
      "elevating state",
      "youtube",
      "yt.mov",
      "reel",
      "reels",
      "walkthrough video",
      "property tour video",
      "testimonial video",
      "recap video",
      "final episode"
    ],
    color: "#dc2626"
  },
  {
    name: "Events",
    keywords: [
      "invitation",
      "invite",
      "rsvp",
      "booking",
      "booked",
      "book marketing",
      "calendar invite",
      "open house",
      "oh materials",
      "broker tour",
      "broker open",
      "event",
      "happy hour",
      "networking",
      "lunch and learn",
      "seminar",
      "workshop",
      "client appreciation",
      "housewarming",
      "photo shoot",
      "photoshoot",
      "shoot scheduled"
    ],
    color: "#ca8a04"
  },
  {
    name: "Design",
    keywords: [
      "mailer",
      "postcard",
      "flyer",
      "brochure",
      "business card",
      "biz card",
      "fact sheet",
      "factsheet",
      "brag book",
      "bragbook",
      "listing presentation",
      "listing pres",
      "buyer guide",
      "buyer's guide",
      "seller guide",
      "seller's guide",
      "graphic",
      "graphics",
      "design",
      "logo",
      "signage",
      "sign rider",
      "door hanger",
      "rack card",
      "newsletter design",
      "template",
      "social media post",
      "instagram post",
      "facebook post",
      "banner",
      "yard sign",
      "qr code",
      "qr",
      "white logo",
      "logo png",
      "oh sign",
      "open house sign"
    ],
    color: "#ea580c"
  },
  {
    name: "Marketing Collateral",
    keywords: [
      "just sold",
      "just listed",
      "just leased",
      "just closed",
      "coming soon",
      "price reduction",
      "price drop",
      "new listing",
      "new on market",
      "email blast",
      "e-blast",
      "market update",
      "market report",
      "cma",
      "comp analysis"
    ],
    color: "#16a34a"
  },
  {
    name: "Onboarding",
    keywords: [
      "seller questionnaire",
      "buyer questionnaire",
      "questionnaire",
      "intake form",
      "onboarding",
      "welcome packet",
      "new agent",
      "converted to project"
    ],
    color: "#0d9488"
  },
  {
    name: "Operations",
    keywords: [
      "invoice",
      "payment",
      "receipt",
      "asana error",
      "hub",
      "bug fix",
      "login",
      "access issue",
      "password reset",
      "fwd:",
      "forwarded"
    ],
    color: "#64748b"
  }
];

/**
 * Safe JSON for embedding inside HtmlService <script> (breaks </script> and line separators).
 * Called from MarketingOutputEmbed.html as <?!= motEmbedJson_(payload) ?>
 */
function motEmbedJson_(obj) {
  var s = JSON.stringify(obj);
  return s
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function _motBuildPayload_(params) {
  var days = _motParseInt_(params.days, 30);
  if (days < 0) days = 0;
  if (days > 3650) days = 3650;

  var props = PropertiesService.getScriptProperties();
  var ellie = String(props.getProperty("MARKETING_OUTPUT_ELLIE_EMAIL") || MOT_DEFAULTS.ellieEmail).trim();
  var maxThreads = _motParseInt_(
    props.getProperty("MARKETING_OUTPUT_MAX_THREADS"),
    MOT_DEFAULTS.maxThreads
  );
  if (maxThreads < 50) maxThreads = 50;
  if (maxThreads > 5000) maxThreads = 5000;

  var timePart = days === 0 ? "" : " newer_than:" + days + "d";
  var sentQuery = "in:sent" + timePart;
  var ellieQuery = "from:" + ellie + timePart;

  var sentThreads = _motSearchThreads_(sentQuery, maxThreads);
  var ellieThreads = _motSearchThreads_(ellieQuery, maxThreads);

  var sentEmails = _motProcessSentLeg_(sentThreads);
  var ellieEmails = _motProcessEllieLeg_(ellieThreads, ellie);

  var merged = sentEmails.concat(ellieEmails);
  var seen = {};
  var deduped = [];
  for (var i = 0; i < merged.length; i++) {
    var row = merged[i];
    if (seen[row.id]) continue;
    seen[row.id] = true;
    deduped.push(row);
  }
  deduped.sort(function(a, b) {
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  var stats = _motComputeStats_(deduped);

  return {
    ok: true,
    meta: {
      days: days,
      ellieEmail: ellie,
      generatedAt: new Date().toISOString(),
      threadCounts: {
        sent: sentThreads.length,
        ellie: ellieThreads.length
      },
      messageCounts: {
        sentLeg: sentEmails.length,
        ellieLeg: ellieEmails.length,
        merged: deduped.length
      }
    },
    emails: deduped,
    stats: stats
  };
}

function motGetBuiltinEmbedTemplate_() {
  return [
    "<!DOCTYPE html>",
    "<html>",
    "  <head>",
    "    <meta charset=\"utf-8\" />",
    "    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />",
    "    <title>Marketing Output Tracker</title>",
    "    <link",
    "      href=\"https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap\"",
    "      rel=\"stylesheet\"",
    "    />",
    "    <style>",
    "      :root {",
    "        --ink: #111;",
    "        --muted: #666;",
    "        --line: rgba(17, 17, 17, 0.12);",
    "        --track: rgba(17, 17, 17, 0.08);",
    "      }",
    "      * {",
    "        box-sizing: border-box;",
    "      }",
    "      body {",
    "        margin: 0;",
    "        padding: 20px;",
    "        font-family: \"Outfit\", system-ui, sans-serif;",
    "        color: var(--ink);",
    "        background: linear-gradient(180deg, #f8f8f8 0%, #f1f1f1 100%);",
    "        min-height: 100vh;",
    "      }",
    "      .mot-e__warn {",
    "        padding: 14px 18px;",
    "        border-radius: 14px;",
    "        background: rgba(254, 226, 226, 0.75);",
    "        border: 1px solid rgba(220, 38, 38, 0.28);",
    "        color: #991b1b;",
    "        font-weight: 600;",
    "        margin-bottom: 16px;",
    "      }",
    "      .mot-e__kpis {",
    "        display: flex;",
    "        flex-wrap: wrap;",
    "        gap: 12px;",
    "        margin-bottom: 16px;",
    "      }",
    "      .mot-e__kpi {",
    "        flex: 1;",
    "        min-width: 130px;",
    "        padding: 14px 16px;",
    "        background: #fff;",
    "        border: 1px solid var(--line);",
    "        border-radius: 18px;",
    "        box-shadow: 0 8px 20px rgba(17, 17, 17, 0.06);",
    "      }",
    "      .mot-e__kpi-l {",
    "        font-size: 10px;",
    "        font-weight: 700;",
    "        letter-spacing: 0.08em;",
    "        text-transform: uppercase;",
    "        color: var(--muted);",
    "        margin-bottom: 6px;",
    "      }",
    "      .mot-e__kpi-v {",
    "        font-size: 26px;",
    "        font-weight: 800;",
    "        letter-spacing: -0.03em;",
    "      }",
    "      .mot-e__kpi-s {",
    "        font-size: 12px;",
    "        font-weight: 600;",
    "        color: var(--muted);",
    "        margin-top: 4px;",
    "      }",
    "      .mot-e__tabs {",
    "        display: inline-flex;",
    "        flex-wrap: wrap;",
    "        gap: 4px;",
    "        padding: 4px;",
    "        margin-bottom: 14px;",
    "        border-radius: 999px;",
    "        border: 1px solid var(--line);",
    "        background: #f0f0f0;",
    "      }",
    "      .mot-e__tab {",
    "        border: 0;",
    "        border-radius: 999px;",
    "        padding: 8px 14px;",
    "        font: inherit;",
    "        font-size: 11px;",
    "        font-weight: 700;",
    "        letter-spacing: 0.06em;",
    "        text-transform: uppercase;",
    "        cursor: pointer;",
    "        background: transparent;",
    "        color: #444;",
    "      }",
    "      .mot-e__tab.is-on {",
    "        background: var(--ink);",
    "        color: #fff;",
    "        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.14);",
    "      }",
    "      .mot-e__panels {",
    "        display: flex;",
    "        flex-direction: column;",
    "        gap: 14px;",
    "      }",
    "      .mot-e__row2 {",
    "        display: flex;",
    "        flex-wrap: wrap;",
    "        gap: 14px;",
    "      }",
    "      .mot-e__panel {",
    "        flex: 1;",
    "        min-width: 240px;",
    "        padding: 18px;",
    "        background: #fff;",
    "        border: 1px solid var(--line);",
    "        border-radius: 22px;",
    "        box-shadow: 0 8px 20px rgba(17, 17, 17, 0.06);",
    "      }",
    "      .mot-e__pt {",
    "        font-size: 10px;",
    "        font-weight: 700;",
    "        letter-spacing: 0.1em;",
    "        text-transform: uppercase;",
    "        color: var(--muted);",
    "        margin: 0 0 14px;",
    "      }",
    "      .mot-e__bar {",
    "        margin-bottom: 10px;",
    "      }",
    "      .mot-e__bh {",
    "        display: flex;",
    "        justify-content: space-between;",
    "        margin-bottom: 4px;",
    "        font-size: 12px;",
    "        font-weight: 600;",
    "      }",
    "      .mot-e__bt {",
    "        height: 6px;",
    "        border-radius: 999px;",
    "        background: var(--track);",
    "        overflow: hidden;",
    "      }",
    "      .mot-e__bf {",
    "        height: 100%;",
    "        border-radius: 999px;",
    "        transition: width 0.45s ease;",
    "      }",
    "      .mot-e__feed {",
    "        max-height: 70vh;",
    "        overflow: auto;",
    "      }",
    "      .mot-e__fr {",
    "        display: flex;",
    "        gap: 12px;",
    "        padding: 12px 0;",
    "        border-bottom: 1px solid rgba(17, 17, 17, 0.08);",
    "        align-items: flex-start;",
    "      }",
    "      .mot-e__fd {",
    "        font-size: 11px;",
    "        font-weight: 700;",
    "        color: var(--muted);",
    "        min-width: 64px;",
    "        padding-top: 2px;",
    "      }",
    "      .mot-e__fc {",
    "        font-size: 10px;",
    "        font-weight: 700;",
    "        padding: 3px 9px;",
    "        border-radius: 999px;",
    "        min-width: 100px;",
    "        text-align: center;",
    "        white-space: nowrap;",
    "      }",
    "      .mot-e__fb {",
    "        flex: 1;",
    "        min-width: 0;",
    "      }",
    "      .mot-e__fs {",
    "        font-size: 14px;",
    "        font-weight: 600;",
    "        margin: 0 0 4px;",
    "        line-height: 1.35;",
    "        word-break: break-word;",
    "      }",
    "      .mot-e__fm {",
    "        font-size: 12px;",
    "        font-weight: 600;",
    "        color: var(--muted);",
    "        margin: 0;",
    "        word-break: break-word;",
    "      }",
    "    </style>",
    "  </head>",
    "  <body>",
    "    <div id=\"mot-e-root\"></div>",
    "    <script>",
    "      var BOOT = <?!= motEmbedJson_(payload) ?>;",
    "    </script>",
    "    <script>",
    "      (function () {",
    "        var root = document.getElementById(\"mot-e-root\");",
    "        if (!root || !BOOT) {",
    "          return;",
    "        }",
    "        if (!BOOT.ok) {",
    "          root.innerHTML =",
    "            '<div class=\"mot-e__warn\">' +",
    "            (BOOT.error ? String(BOOT.error) : \"Something went wrong.\") +",
    "            \"</div>\";",
    "          return;",
    "        }",
    "",
    "        var emails = BOOT.emails || [];",
    "        var stats = BOOT.stats || {};",
    "        var meta = BOOT.meta || {};",
    "        var days = meta.days != null ? meta.days : 30;",
    "        var colors = stats.categoryColors || {};",
    "        var view = \"overview\";",
    "",
    "        function esc(s) {",
    "          return String(s == null ? \"\" : s)",
    "            .replace(/&/g, \"&amp;\")",
    "            .replace(/</g, \"&lt;\")",
    "            .replace(/>/g, \"&gt;\")",
    "            .replace(/\"/g, \"&quot;\");",
    "        }",
    "        function catColor(n) {",
    "          return colors[n] || \"#334155\";",
    "        }",
    "        function maxObj(o) {",
    "          var n = 1;",
    "          for (var k in o) {",
    "            if (Object.prototype.hasOwnProperty.call(o, k) && o[k] > n) n = o[k];",
    "          }",
    "          return n;",
    "        }",
    "        function senderShort(s) {",
    "          var raw = String(s || \"\");",
    "          var m = raw.match(/<([^>]+)>/);",
    "          var email = m ? m[1].trim() : raw.trim();",
    "          var at = email.indexOf(\"@\");",
    "          if (at === -1) return raw.replace(/<[^>]+>/g, \"\").trim() || \"-\";",
    "          return email.slice(0, at);",
    "        }",
    "        function recShort(a) {",
    "          var x = String(a || \"\");",
    "          var i = x.indexOf(\"@\");",
    "          return i === -1 ? x : x.slice(0, i);",
    "        }",
    "        function bar(label, val, max, col) {",
    "          var pct = max > 0 ? (val / max) * 100 : 0;",
    "          return (",
    "            '<div class=\"mot-e__bar\"><div class=\"mot-e__bh\"><span style=\"color:#666\">' +",
    "            esc(label) +",
    "            '</span><span style=\"font-weight:800\">' +",
    "            esc(val) +",
    "            '</span></div><div class=\"mot-e__bt\"><div class=\"mot-e__bf\" style=\"width:' +",
    "            pct +",
    "            \"%;background:\" +",
    "            esc(col) +",
    "            '\"></div></div></div>'",
    "          );",
    "        }",
    "",
    "        function render() {",
    "          var rangeLabel = days === 0 ? \"All Time\" : \"Last \" + days + \" days\";",
    "          var wk = Object.keys(stats.byWeek || {});",
    "          var avgW = wk.length ? Math.round((stats.total || 0) / wk.length) : 0;",
    "          var cats = Object.keys(stats.byCategory || {}).filter(function (c) {",
    "            return c !== \"Other\";",
    "          });",
    "",
    "          var kpis =",
    "            '<div class=\"mot-e__kpis\">' +",
    "            '<div class=\"mot-e__kpi\"><div class=\"mot-e__kpi-l\">Total Emails</div><div class=\"mot-e__kpi-v\">' +",
    "            esc(stats.total || 0) +",
    "            '</div><div class=\"mot-e__kpi-s\">' +",
    "            esc(rangeLabel) +",
    "            \"</div></div>\" +",
    "            '<div class=\"mot-e__kpi\"><div class=\"mot-e__kpi-l\">Properties</div><div class=\"mot-e__kpi-v\">' +",
    "            esc((stats.properties || []).length) +",
    "            '</div><div class=\"mot-e__kpi-s\">Unique addresses</div></div>' +",
    "            '<div class=\"mot-e__kpi\"><div class=\"mot-e__kpi-l\">Categories</div><div class=\"mot-e__kpi-v\">' +",
    "            esc(cats.length) +",
    "            '</div><div class=\"mot-e__kpi-s\">Content types</div></div>' +",
    "            '<div class=\"mot-e__kpi\"><div class=\"mot-e__kpi-l\">Avg / Week</div><div class=\"mot-e__kpi-v\">' +",
    "            esc(avgW) +",
    "            '</div><div class=\"mot-e__kpi-s\">Emails per week</div></div></div>';",
    "",
    "          var tabs =",
    "            '<div class=\"mot-e__tabs\" id=\"mot-e-tabs\">' +",
    "            '<button type=\"button\" class=\"mot-e__tab' +",
    "            (view === \"overview\" ? \" is-on\" : \"\") +",
    "            '\" data-v=\"overview\">Overview</button>' +",
    "            '<button type=\"button\" class=\"mot-e__tab' +",
    "            (view === \"person\" ? \" is-on\" : \"\") +",
    "            '\" data-v=\"person\">By person</button>' +",
    "            '<button type=\"button\" class=\"mot-e__tab' +",
    "            (view === \"feed\" ? \" is-on\" : \"\") +",
    "            '\" data-v=\"feed\">Feed</button></div>';",
    "",
    "          var body = \"\";",
    "          if (view === \"overview\") {",
    "            var maxC = maxObj(stats.byCategory || {});",
    "            var useM = Object.keys(stats.byWeek || {}).length > 12;",
    "            var td = useM ? stats.byMonth || {} : stats.byWeek || {};",
    "            var maxT = maxObj(td);",
    "            var keys = Object.keys(td)",
    "              .sort(function (a, b) {",
    "                return b.localeCompare(a);",
    "              })",
    "              .slice(0, 20);",
    "            body += '<div class=\"mot-e__row2\"><div class=\"mot-e__panel\"><p class=\"mot-e__pt\">By Category</p>';",
    "            var cs = Object.keys(stats.byCategory || {}).sort(function (a, b) {",
    "              return (stats.byCategory[b] || 0) - (stats.byCategory[a] || 0);",
    "            });",
    "            for (var i = 0; i < cs.length; i++) {",
    "              var c = cs[i];",
    "              body += bar(c, stats.byCategory[c], maxC, catColor(c));",
    "            }",
    "            body += '</div><div class=\"mot-e__panel\"><p class=\"mot-e__pt\">';",
    "            body += useM ? \"Monthly Volume\" : \"Weekly Volume\";",
    "            body += \"</p>\";",
    "            for (var j = 0; j < keys.length; j++) {",
    "              var key = keys[j];",
    "              var cnt = td[key];",
    "              var d = new Date(key + (useM ? \"-01\" : \"\"));",
    "              var lab = useM",
    "                ? d.toLocaleDateString(\"en-US\", { month: \"short\", year: \"numeric\" })",
    "                : \"Wk of \" + d.toLocaleDateString(\"en-US\", { month: \"short\", day: \"numeric\" });",
    "              body += bar(lab, cnt, maxT, \"#0d9488\");",
    "            }",
    "            body += \"</div></div>\";",
    "          } else if (view === \"person\") {",
    "            var maxP = maxObj(stats.byPerson || {});",
    "            var ps = Object.keys(stats.byPerson || {}).sort(function (a, b) {",
    "              return (stats.byPerson[b] || 0) - (stats.byPerson[a] || 0);",
    "            });",
    "            var pal = [\"#2563eb\", \"#9333ea\", \"#16a34a\", \"#ea580c\"];",
    "            body += '<div class=\"mot-e__panel\" style=\"max-width:520px\"><p class=\"mot-e__pt\">Output by Person</p>';",
    "            for (var p = 0; p < ps.length; p++) {",
    "              var nm = ps[p];",
    "              var pretty = nm",
    "                .replace(/\\./g, \" \")",
    "                .replace(/\\b\\w/g, function (ch) {",
    "                  return ch.toUpperCase();",
    "                });",
    "              body += bar(pretty, stats.byPerson[nm], maxP, pal[p % 4]);",
    "            }",
    "            body += \"</div>\";",
    "          } else {",
    "            body += '<div class=\"mot-e__panel mot-e__feed\">';",
    "            for (var f = 0; f < Math.min(80, emails.length); f++) {",
    "              var e = emails[f];",
    "              var d2 = new Date(e.date);",
    "              var ds = d2.toLocaleDateString(\"en-US\", { month: \"short\", day: \"numeric\" });",
    "              var col = catColor(e.category);",
    "              var rec = (e.recipients || []).slice(0, 3).map(recShort).join(\", \");",
    "              var more = (e.recipients || []).length > 3 ? \" +\" + (e.recipients.length - 3) : \"\";",
    "              body +=",
    "                '<div class=\"mot-e__fr\"><div class=\"mot-e__fd\">' +",
    "                esc(ds) +",
    "                '</div><div class=\"mot-e__fc\" style=\"color:' +",
    "                esc(col) +",
    "                \";background:\" +",
    "                esc(col) +",
    "                '18\">' +",
    "                esc(e.category) +",
    "                '</div><div class=\"mot-e__fb\"><p class=\"mot-e__fs\">' +",
    "                esc(e.subject) +",
    "                '</p><p class=\"mot-e__fm\">' +",
    "                esc(senderShort(e.sender)) +",
    "                \" &rarr; \" +",
    "                esc(rec) +",
    "                esc(more) +",
    "                \"</p></div></div>\";",
    "            }",
    "            body += \"</div>\";",
    "          }",
    "",
    "          root.innerHTML = kpis + tabs + '<div class=\"mot-e__panels\" id=\"mot-e-panels\">' + body + \"</div>\";",
    "",
    "          var tb = document.getElementById(\"mot-e-tabs\");",
    "          if (tb) {",
    "            tb.onclick = function (ev) {",
    "              var b = ev.target && ev.target.closest ? ev.target.closest(\".mot-e__tab\") : null;",
    "              if (!b || !tb.contains(b)) return;",
    "              var v = b.getAttribute(\"data-v\");",
    "              if (v === \"person\") view = \"person\";",
    "              else if (v === \"feed\") view = \"feed\";",
    "              else view = \"overview\";",
    "              render();",
    "            };",
    "          }",
    "        }",
    "",
    "        render();",
    "      })();",
    "    </script>",
    "  </body>",
    "</html>",
    ""
  ].join(String.fromCharCode(10));
}
function _motHtmlFromEmbed_(payload) {
  var tpl = HtmlService.createTemplate(motGetBuiltinEmbedTemplate_());
  tpl.payload = payload;
  return tpl
    .evaluate()
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .setTitle("Marketing output");
}
function doGet(e) {
  try {
    var params = (e && e.parameter) || {};
    var fmt = String(params.format || "").toLowerCase();

    if (!_motAuthOk_(params)) {
      if (fmt === "html" || fmt === "embed") {
        return _motHtmlFromEmbed_({ ok: false, error: "unauthorized" });
      }
      return motRespond_(params, { ok: false, error: "unauthorized" });
    }

    var payload = _motBuildPayload_(params);

    if (fmt === "html" || fmt === "embed") {
      return _motHtmlFromEmbed_(payload);
    }

    return motRespond_(params, payload);
  } catch (err) {
    var params2 = (e && e.parameter) || {};
    var fmt2 = String(params2.format || "").toLowerCase();
    var errObj = {
      ok: false,
      error: err && err.message ? err.message : String(err)
    };
    if (fmt2 === "html" || fmt2 === "embed") {
      return _motHtmlFromEmbed_(errObj);
    }
    return motRespond_(params2, errObj);
  }
}

function motJson_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// JSON when no callback; otherwise name(JSON) for cross-origin script src.
function motRespond_(params, obj) {
  var cb = _motSanitizeJsonpCallback_(params && params.callback);
  if (cb) {
    return ContentService.createTextOutput(cb + "(" + JSON.stringify(obj) + ");").setMimeType(
      "application/javascript"
    );
  }
  return motJson_(obj);
}

// Safe global function name for JSONP only.
function _motSanitizeJsonpCallback_(raw) {
  var s = String(raw || "").trim();
  if (s.length < 1 || s.length > 64) return "";
  if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(s)) return "";
  return s;
}

function _motAuthOk_(params) {
  var props = PropertiesService.getScriptProperties();
  var secret = String(props.getProperty("MARKETING_OUTPUT_SECRET") || "").trim();
  if (!secret) return true;
  var given = String(params.secret || params.token || "").trim();
  return given === secret;
}

function _motParseInt_(raw, def) {
  var n = parseInt(String(raw || ""), 10);
  return isNaN(n) ? def : n;
}

// Paginates GmailApp.search (max 500 per call; batches of searchBatch).
function _motSearchThreads_(query, maxTotal) {
  var batch = MOT_DEFAULTS.searchBatch;
  var out = [];
  var start = 0;
  while (out.length < maxTotal) {
    var take = Math.min(batch, maxTotal - out.length);
    var page = GmailApp.search(query, start, take);
    if (!page || page.length === 0) break;
    for (var i = 0; i < page.length; i++) out.push(page[i]);
    if (page.length < take) break;
    start += page.length;
  }
  return out;
}

/** Emails the web app runs as (primary + Gmail send-as aliases). */
function _motMySendFromAddresses_() {
  var set = {};
  try {
    var primary = Session.getActiveUser().getEmail();
    if (primary) set[String(primary).toLowerCase()] = true;
  } catch (e0) {}
  try {
    var aliases = GmailApp.getAliases();
    for (var a = 0; a < aliases.length; a++) {
      var ad = String(aliases[a] || "").toLowerCase();
      if (ad) set[ad] = true;
    }
  } catch (e1) {}
  return set;
}

function _motProcessSentLeg_(threads) {
  var results = [];
  var me = _motMySendFromAddresses_();
  for (var t = 0; t < threads.length; t++) {
    var msgs = threads[t].getMessages();
    for (var m = 0; m < msgs.length; m++) {
      var msg = msgs[m];
      var from = _motExtractEmail_(msg.getFrom() || "").toLowerCase();
      if (!me[from]) continue;
      if (typeof msg.isDraft === "function" && msg.isDraft()) continue;
      results.push(_motRowFromMessage_(msg));
    }
  }
  return results;
}

function _motProcessEllieLeg_(threads, ellieEmail) {
  var hint = String(ellieEmail || "").toLowerCase().trim();
  var results = [];
  for (var t = 0; t < threads.length; t++) {
    var msgs = threads[t].getMessages();
    for (var m = 0; m < msgs.length; m++) {
      var msg = msgs[m];
      var fromRaw = msg.getFrom() || "";
      if (hint && fromRaw.toLowerCase().indexOf(hint) === -1) continue;
      results.push(_motRowFromMessage_(msg));
    }
  }
  return results;
}

function _motRowFromMessage_(msg) {
  var fromRaw = msg.getFrom() || "";
  var senderEmail = _motExtractEmail_(fromRaw).toLowerCase();
  var snippet = _motMessageSnippet_(msg);
  var subject = msg.getSubject() || "(no subject)";
  var toList = _motParseRecipientList_(msg.getTo());
  var ccList = _motParseRecipientList_(msg.getCc());
  var recipients = [];
  for (var i = 0; i < toList.length; i++) {
    if (toList[i] && toList[i] !== senderEmail) recipients.push(toList[i]);
  }
  for (var j = 0; j < ccList.length; j++) {
    if (ccList[j] && ccList[j] !== senderEmail) recipients.push(ccList[j]);
  }

  return {
    id: msg.getId(),
    date: msg.getDate().toISOString(),
    subject: subject,
    snippet: snippet,
    sender: fromRaw,
    recipients: recipients,
    category: _motCategorize_(subject, snippet),
    address: _motExtractAddress_(subject)
  };
}

function _motExtractEmail_(header) {
  var h = String(header || "");
  var m = h.match(/<([^>]+)>/);
  if (m) return m[1].trim();
  var t = h.trim();
  if (/^[^\s<]+@[^\s>]+$/.test(t)) return t;
  return t.toLowerCase();
}

function _motParseRecipientList_(csv) {
  if (!csv) return [];
  var parts = String(csv).split(/[,;]/);
  var out = [];
  for (var i = 0; i < parts.length; i++) {
    var e = _motExtractEmail_(parts[i]).toLowerCase();
    if (e.indexOf("@") !== -1) out.push(e);
  }
  return out;
}

function _motMessageSnippet_(msg) {
  try {
    var p = msg.getPlainBody();
    if (!p) return "";
    return String(p)
      .replace(/\s+/g, " ")
      .trim()
      .substring(0, 240);
  } catch (e) {
    return "";
  }
}

function _motCategorize_(subject, snippet) {
  var text = (String(subject || "") + " " + String(snippet || "")).toLowerCase();
  for (var c = 0; c < MOT_CATEGORIES.length; c++) {
    var cat = MOT_CATEGORIES[c];
    for (var k = 0; k < cat.keywords.length; k++) {
      if (text.indexOf(cat.keywords[k]) !== -1) return cat.name;
    }
  }
  return "Other";
}

function _motExtractAddress_(subject) {
  var s = String(subject || "");
  var re = /\d{2,5}\s+[NSEW]?\.?\s*[\w\s]+(?:Ave|St|Dr|Blvd|Rd|Ct|Ln|Way|Pl|Pkwy)[\w\s,#.]*?(?=\s*[-(]|$)/i;
  var match = s.match(re);
  return match ? String(match[0]).trim() : null;
}

function _motComputeStats_(emails) {
  var byCategory = {};
  var byWeek = {};
  var byMonth = {};
  var byPerson = {};
  var properties = [];

  for (var i = 0; i < emails.length; i++) {
    var e = emails[i];
    var cat = e.category || "Other";
    byCategory[cat] = (byCategory[cat] || 0) + 1;

    var d = new Date(e.date);
    var ws = new Date(d.getTime());
    ws.setDate(d.getDate() - d.getDay());
    var wk = ws.toISOString().split("T")[0];
    byWeek[wk] = (byWeek[wk] || 0) + 1;

    var mk =
      d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2);
    byMonth[mk] = (byMonth[mk] || 0) + 1;

    var from = e.sender || "";
    var person = _motExtractEmail_(from).split("@")[0] || "unknown";
    byPerson[person] = (byPerson[person] || 0) + 1;

    if (e.address) properties.push(e.address);
  }

  var uniq = [];
  var seen = {};
  for (var p = 0; p < properties.length; p++) {
    if (seen[properties[p]]) continue;
    seen[properties[p]] = true;
    uniq.push(properties[p]);
  }

  return {
    byCategory: byCategory,
    byWeek: byWeek,
    byMonth: byMonth,
    byPerson: byPerson,
    properties: uniq,
    total: emails.length,
    categoryColors: _motCategoryColorsMap_()
  };
}

function _motCategoryColorsMap_() {
  var o = {};
  for (var i = 0; i < MOT_CATEGORIES.length; i++) {
    o[MOT_CATEGORIES[i].name] = MOT_CATEGORIES[i].color;
  }
  o["Other"] = "#334155";
  return o;
}

// Manual test: Run motSmokeTest in the editor (days=14).
function motSmokeTest() {
  var fake = { parameter: { days: "14" } };
  var out = doGet(fake);
  var txt = out.getContent();
  var j = JSON.parse(txt);
  Logger.log("ok=" + j.ok + " total=" + (j.stats && j.stats.total));
  return j;
}
