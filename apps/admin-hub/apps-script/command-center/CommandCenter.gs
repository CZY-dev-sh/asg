/**
 * ASG OS Command Center — aggregator API
 * ============================================================
 * One Apps Script web app that fans out to every measurement
 * source the Command Center dashboard needs:
 *
 *   1.  Pipeline Stats (existing TeamStats endpoint)
 *   2.  Follow Up Boss (FUB API — direct, with key from Script Properties)
 *   3.  Usage Log Sheet (page views, clicks, hub visits)
 *   4.  Asana (marketing requests — open/done/turnaround)
 *   5.  Acuity (upcoming marketing bookings)
 *   6.  GitHub (recent commits to the ASG OS repo)
 *   7.  Static ownership map (from this script's config)
 *
 * Each integration degrades gracefully: if the relevant Script
 * Property isn't set, that section is empty and `meta.sources`
 * reports the connection state so the UI can show "not connected".
 *
 * ------------------------------------------------------------
 * SCRIPT PROPERTIES (all optional except FUB_API_KEY for the FUB section)
 * ------------------------------------------------------------
 *   FUB_API_KEY                   FUB API key (same property the FUB proxy uses)
 *   PIPELINE_STATS_URL            Full URL of the deployed TeamStats web app
 *
 *   USAGE_LOG_SHEET_ID            Google Sheet that UsageLog.gs writes events to
 *   USAGE_LOG_TAB                 Tab name (defaults to "Events")
 *   DIRECTORY_SHEET_ID            (optional) Sheet holding the team Directory tab.
 *                                 Falls back to USAGE_LOG_SHEET_ID if not set, so
 *                                 you can either share one sheet or keep the Events
 *                                 log separate from the existing team directory.
 *   DIRECTORY_TAB                 (optional) Directory tab name; tries
 *                                 "Directory", "Team Directory", "team_directory"
 *                                 by default to match HubData.gs.
 *
 *   ASANA_TOKEN                   Asana Personal Access Token
 *   ASANA_WORKSPACE_GID           Asana workspace GID (e.g. 1234567890)
 *   ASANA_MARKETING_PROJECT_GID   Marketing project GID
 *
 *   ACUITY_USER_ID                Acuity API user ID (numeric)
 *   ACUITY_API_KEY                Acuity API key
 *   ACUITY_CALENDAR_IDS           Optional comma-separated calendar IDs
 *
 *   GITHUB_TOKEN                  GitHub PAT with `repo` scope (or empty for public repos)
 *   GITHUB_REPO                   "owner/repo" format (e.g. "tim-urmanczy/asg-admin-hub")
 *
 *   COMMAND_CENTER_CACHE_TTL      Seconds to cache the full payload (default 90)
 *
 * ------------------------------------------------------------
 * QUERY PARAMS
 * ------------------------------------------------------------
 *   ?view=all          (default) full payload
 *   ?view=executive
 *   ?view=adoption
 *   ?view=marketing
 *   ?view=system
 *   ?period=7d|30d|ytd|all   (default 30d)
 *   ?refresh=1         bypass the cache
 */

var CC_DEFAULTS = {
  cacheTtlSeconds: 90,
  fubApiBaseUrl: "https://api.followupboss.com/v1",
  asanaApiBaseUrl: "https://app.asana.com/api/1.0",
  acuityApiBaseUrl: "https://acuityscheduling.com/api/v1",
  githubApiBaseUrl: "https://api.github.com",
  pipelineStatsUrl: "https://script.google.com/macros/s/AKfycbz-dZlLjHKgcN-UmVF3O3252VCFDTiMgxtsiW1f-KGxny6F0PI37ntpZQsWni1LxnBLAg/exec",
  usageLogTab: "Events",
  defaultPeriod: "30d"
};

var CC_OWNERSHIP = [
  { system: "Admin Hub",      owner: "Tim",           backup: "Ellie", cadence: "Weekly" },
  { system: "Agent Hubs",     owner: "Tim",           backup: "Ellie", cadence: "Monthly" },
  { system: "FUB Tracker",    owner: "Ellyn",         backup: "Tim",   cadence: "Weekly" },
  { system: "Listing Hub",    owner: "Bridget / Tim", backup: "Ellie", cadence: "Weekly" },
  { system: "IDX Website",    owner: "Tim",           backup: "Ellie", cadence: "Weekly" },
  { system: "Team Stats",     owner: "Tim",           backup: "Ellyn", cadence: "Monthly" },
  { system: "Training Hub",   owner: "Tim",           backup: "Ellyn", cadence: "Quarterly" },
  { system: "Marketing Ops",  owner: "Tim / Ellie",   backup: "Tim",   cadence: "Weekly" },
  { system: "Command Center", owner: "Tim",           backup: "Ellyn", cadence: "Weekly" }
];

var CC_MARKETING_REQUEST_GOALS = {
  // Goal turnaround in days, by request type. Used for the turnaround chart.
  "Listing Marketing": 3,
  "Listing Photos":    2,
  "Listing Video":     5,
  "Email Campaign":    3,
  "Social Post":       2,
  "Print":             5,
  "Website Update":    3,
  "Brand / Identity":  10
};

// ============================================================
// ENTRY POINT
// ============================================================
function doGet(e) {
  try {
    var params = (e && e.parameter) ? e.parameter : {};
    var view = String(params.view || "all").toLowerCase();
    var period = _ccResolvePeriod_(params.period);
    var refresh = String(params.refresh || "") === "1";

    var props = PropertiesService.getScriptProperties();
    var ttl = _ccToInt_(props.getProperty("COMMAND_CENTER_CACHE_TTL"), CC_DEFAULTS.cacheTtlSeconds);
    var cacheKey = "cc:" + view + ":" + period;
    var cache = CacheService.getScriptCache();

    if (!refresh && ttl > 0) {
      var cached = cache.get(cacheKey);
      if (cached) {
        return _ccJson_(_ccParseJson_(cached, null) || {});
      }
    }

    var payload = _ccBuildPayload_(view, period);

    if (ttl > 0) {
      try { cache.put(cacheKey, JSON.stringify(payload), ttl); } catch (errCache) {}
    }
    return _ccJson_(payload);
  } catch (err) {
    return _ccJson_({
      ok: false,
      errorMessage: err && err.message ? err.message : String(err),
      meta: { generatedAt: new Date().toISOString(), sources: {} }
    });
  }
}

function _ccResolvePeriod_(raw) {
  var v = String(raw || "").trim().toLowerCase();
  if (v === "7d" || v === "30d" || v === "90d" || v === "ytd" || v === "all") return v;
  return CC_DEFAULTS.defaultPeriod;
}

function _ccPeriodStartDate_(period) {
  var now = new Date();
  switch (period) {
    case "7d":  return new Date(now.getTime() - 7  * 86400000);
    case "30d": return new Date(now.getTime() - 30 * 86400000);
    case "90d": return new Date(now.getTime() - 90 * 86400000);
    case "ytd": return new Date(now.getFullYear(), 0, 1);
    case "all":
    default:    return new Date(now.getFullYear() - 5, 0, 1);
  }
}

// ============================================================
// PAYLOAD BUILDER
// ============================================================
function _ccBuildPayload_(view, period) {
  var props = PropertiesService.getScriptProperties();
  var sources = {};
  var executive = null;
  var adoption  = null;
  var marketing = null;
  var system    = null;

  if (view === "all" || view === "executive") {
    var execResult = _ccBuildExecutive_(props, period);
    executive = execResult.payload;
    sources.pipelineStats = execResult.sources.pipelineStats;
    sources.fub = execResult.sources.fub;
  }
  if (view === "all" || view === "adoption") {
    var adoptResult = _ccBuildAdoption_(props, period);
    adoption = adoptResult.payload;
    sources.usageLog = adoptResult.sources.usageLog;
    if (sources.fub == null) sources.fub = adoptResult.sources.fub;
  }
  if (view === "all" || view === "marketing") {
    var mktResult = _ccBuildMarketing_(props, period);
    marketing = mktResult.payload;
    sources.asana  = mktResult.sources.asana;
    sources.acuity = mktResult.sources.acuity;
  }
  if (view === "all" || view === "system") {
    var sysResult = _ccBuildSystem_(props, period);
    system = sysResult.payload;
    sources.github = sysResult.sources.github;
  }

  return {
    ok: true,
    meta: {
      view: view,
      period: period,
      generatedAt: new Date().toISOString(),
      sources: sources
    },
    executive: executive,
    adoption: adoption,
    marketing: marketing,
    system: system
  };
}

// ============================================================
// EXECUTIVE — pipeline stats + FUB activity rollup
// ============================================================
function _ccBuildExecutive_(props, period) {
  var sources = { pipelineStats: "down", fub: "down" };
  var payload = {
    summary: {},
    agents: [],
    alerts: [],
    funnel: {},
    mix: { listings: {} },
    fub: {},
    fubByAgent: {}
  };

  // 1) Pipeline Stats
  try {
    var statsUrl = String(props.getProperty("PIPELINE_STATS_URL") || CC_DEFAULTS.pipelineStatsUrl).trim();
    if (statsUrl) {
      var stats = _ccFetchJson_(statsUrl, { method: "get", muteHttpExceptions: true });
      if (stats && stats.success !== false) {
        var s = stats.summary || {};
        payload.summary = {
          totalVolume:   s.totalVolume   || s.grandTotal || 0,
          totalDeals:    s.totalTransactions || s.totalDeals || 0,
          closedVolume:  s.closedVolume  || 0,
          closedDeals:   s.closedDeals   || 0,
          pendingVolume: s.pendingVolume || 0,
          pendingDeals:  s.pendingDeals  || 0
        };
        payload.agents = (stats.agents || []).map(function(a){
          return {
            name: a.name,
            tier: a.tier || "Agent",
            grandTotal: a.grandTotal || 0,
            totalDeals: a.totalDeals || 0,
            closedVolume: a.closedVolume || 0,
            closedDeals: a.closedDeals || 0,
            pendingVolume: a.pendingVolume || 0,
            pendingDeals: a.pendingDeals || 0
          };
        });
        sources.pipelineStats = "ok";
      }
    }
  } catch (errStats) {
    sources.pipelineStats = "down";
    payload.alerts.push({
      severity: "amber",
      title: "Pipeline Stats unreachable",
      text: String(errStats && errStats.message ? errStats.message : errStats)
    });
  }

  // 2) FUB rollup (period-scoped) — events, leads, appointments, deals won
  try {
    var apiKey = String(props.getProperty("FUB_API_KEY") || "").trim();
    if (apiKey) {
      var fubBase = String(props.getProperty("FUB_API_BASE_URL") || CC_DEFAULTS.fubApiBaseUrl).trim();
      var startDate = _ccPeriodStartDate_(period);
      var fubAgg = _ccFetchFubAggregates_(apiKey, fubBase, startDate);
      payload.fub = fubAgg.summary;
      payload.fubByAgent = fubAgg.byAgent;
      payload.funnel = fubAgg.funnel;
      payload.mix = fubAgg.mix;
      sources.fub = "ok";

      // Surface high-signal alerts from FUB
      if (fubAgg.summary && fubAgg.summary.overdueTasks > 0) {
        payload.alerts.push({
          severity: fubAgg.summary.overdueTasks > 10 ? "red" : "amber",
          title: "Overdue FUB tasks",
          text: fubAgg.summary.overdueTasks + " task(s) past due across the team."
        });
      }
      if (fubAgg.summary && fubAgg.summary.staleLeads > 0) {
        payload.alerts.push({
          severity: "amber",
          title: "Stale leads (no contact in 7+ days)",
          text: fubAgg.summary.staleLeads + " lead(s) with no recent activity."
        });
      }
    } else {
      sources.fub = "down";
    }
  } catch (errFub) {
    sources.fub = "down";
    payload.alerts.push({
      severity: "amber",
      title: "FUB sync failed",
      text: String(errFub && errFub.message ? errFub.message : errFub)
    });
  }

  if (sources.pipelineStats === "down") {
    payload.alerts.unshift({
      severity: "amber",
      title: "Pipeline Stats not connected",
      text: "Set PIPELINE_STATS_URL in Script Properties."
    });
  }
  if (sources.fub === "down") {
    payload.alerts.push({
      severity: "amber",
      title: "FUB not connected",
      text: "Set FUB_API_KEY in Script Properties to populate leads, appointments, and per-agent activity."
    });
  }
  if (!payload.alerts.length) {
    payload.alerts.push({ severity: "green", title: "All systems green", text: "Nothing requires attention right now." });
  }

  return { payload: payload, sources: sources };
}

function _ccFetchFubAggregates_(apiKey, base, startDate) {
  var summary = {
    newLeads: 0,
    appointments: 0,
    signed: 0,
    overdueTasks: 0,
    staleLeads: 0
  };
  var byAgent = {};
  var funnel = {
    newLeads: 0,
    appointments: 0,
    buyerConsults: 0,
    sellerConsults: 0,
    signed: 0,
    closed: 0
  };
  var mix = { buy: 0, sell: 0, cash: 0, listings: { secured: 0, media: 0, live: 0, underContract: 0, closed: 0 } };

  // ---- /events: created since startDate -> "newLeads"
  // FUB /events is paginated; cap pulls so we don't spend the daily quota.
  var sinceIso = startDate.toISOString();
  var nowIso = new Date().toISOString();

  try {
    var events = _ccFubFetchAll_(base + "/events?createdAfter=" + encodeURIComponent(sinceIso) + "&limit=100", apiKey, { maxPages: 5 });
    summary.newLeads = events.length;
    funnel.newLeads = events.length;
  } catch (e1) {}

  // ---- /appointments: starts in window (past + next 30d)
  try {
    var apptStart = new Date(startDate.getTime());
    var appts = _ccFubFetchAll_(base + "/appointments?startsAfter=" + encodeURIComponent(apptStart.toISOString()) + "&limit=100", apiKey, { maxPages: 5 });
    summary.appointments = appts.length;
    funnel.appointments = appts.length;
    appts.forEach(function(ap){
      var t = String((ap && ap.title) || "").toLowerCase();
      if (/buyer/.test(t)) funnel.buyerConsults++;
      if (/seller|listing/.test(t)) funnel.sellerConsults++;
    });
  } catch (e2) {}

  // ---- /deals: count by status / side
  try {
    var deals = _ccFubFetchAll_(base + "/deals?limit=100&fields=allFields", apiKey, { maxPages: 8 });
    deals.forEach(function(d){
      var status = String((d && d.status) || "").toLowerCase();
      var stage = String((d && d.stage && d.stage.name) || (d && d.stageName) || "").toLowerCase();
      var side = String((d && d.dealType) || (d && d.side) || "").toLowerCase();
      if (side.indexOf("sell") !== -1) mix.sell++;
      else if (side.indexOf("cash") !== -1) mix.cash++;
      else mix.buy++;

      if (status === "won" || /closed/.test(stage)) {
        funnel.closed++;
      }
      if (/under contract|signed|active/.test(stage)) {
        funnel.signed++;
      }
      if (/secur/.test(stage)) mix.listings.secured++;
      if (/media|photo|shoot/.test(stage)) mix.listings.media++;
      if (/active|live|on market/.test(stage)) mix.listings.live++;
      if (/under contract/.test(stage)) mix.listings.underContract++;
      if (/closed/.test(stage)) mix.listings.closed++;
    });
    summary.signed = funnel.signed;
  } catch (e3) {}

  // ---- /tasks: overdue
  try {
    var todayStart = new Date(); todayStart.setHours(0,0,0,0);
    var tasks = _ccFubFetchAll_(base + "/tasks?completed=false&limit=100", apiKey, { maxPages: 6 });
    tasks.forEach(function(t){
      var due = t && t.dueDate ? new Date(t.dueDate) : null;
      if (due && !isNaN(due.getTime()) && due.getTime() < todayStart.getTime()) {
        summary.overdueTasks++;
      }
      var assigneeName = String((t && t.assignedUserName) || (t && t.userName) || "").trim();
      if (assigneeName) {
        if (!byAgent[assigneeName]) byAgent[assigneeName] = { notesLast7: 0, tasksTodo: 0, tasksOverdue: 0 };
        byAgent[assigneeName].tasksTodo++;
        if (due && !isNaN(due.getTime()) && due.getTime() < todayStart.getTime()) byAgent[assigneeName].tasksOverdue++;
      }
    });
  } catch (e4) {}

  // ---- /textMessages or /notes: per-agent activity in last 7 days
  try {
    var weekAgo = new Date(Date.now() - 7 * 86400000);
    var notes = _ccFubFetchAll_(base + "/notes?createdAfter=" + encodeURIComponent(weekAgo.toISOString()) + "&limit=100", apiKey, { maxPages: 5 });
    notes.forEach(function(n){
      var byName = String((n && n.createdByName) || (n && n.userName) || "").trim();
      if (byName) {
        if (!byAgent[byName]) byAgent[byName] = { notesLast7: 0, tasksTodo: 0, tasksOverdue: 0 };
        byAgent[byName].notesLast7++;
      }
    });
  } catch (e5) {}

  // Stale leads: people last contacted > 7 days ago, status = lead
  try {
    var staleCutoff = new Date(Date.now() - 7 * 86400000);
    var people = _ccFubFetchAll_(base + "/people?stage=Lead&limit=100", apiKey, { maxPages: 4 });
    people.forEach(function(p){
      var last = p && (p.lastCommunication || p.updated) ? new Date(p.lastCommunication || p.updated) : null;
      if (last && !isNaN(last.getTime()) && last.getTime() < staleCutoff.getTime()) summary.staleLeads++;
    });
  } catch (e6) {}

  return { summary: summary, byAgent: byAgent, funnel: funnel, mix: mix };
}

function _ccFubFetchAll_(url, apiKey, opts) {
  var maxPages = (opts && opts.maxPages) || 5;
  var headers = {
    "Authorization": "Basic " + Utilities.base64Encode(apiKey + ":"),
    "X-System": "ASG-Command-Center",
    "X-System-Key": "asg-cc-1"
  };
  var all = [];
  var nextUrl = url;
  for (var p = 0; p < maxPages && nextUrl; p++) {
    var res = UrlFetchApp.fetch(nextUrl, { method: "get", headers: headers, muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) break;
    var body = _ccParseJson_(res.getContentText(), null);
    if (!body) break;
    var key = _ccDetectListKey_(body);
    var items = key ? body[key] : [];
    if (Array.isArray(items)) all = all.concat(items);
    var next = body && body._metadata && body._metadata.next;
    nextUrl = next || null;
    Utilities.sleep(75);
  }
  return all;
}

function _ccDetectListKey_(body) {
  var candidates = ["events", "appointments", "deals", "tasks", "notes", "people"];
  for (var i = 0; i < candidates.length; i++) {
    if (Array.isArray(body[candidates[i]])) return candidates[i];
  }
  return null;
}

// ============================================================
// ADOPTION — usage log + FUB-by-agent + roster
// ============================================================
function _ccBuildAdoption_(props, period) {
  var sources = { usageLog: "down", fub: "down" };
  var payload = {
    summary: { activeAgents: 0, pageViews: 0, uniqueVisitors: 0, fubCompliance: 0, coldCount: 0 },
    agents: [],
    cold: [],
    topResources: []
  };

  // 1) Usage log from Sheet
  var usage = _ccReadUsageLog_(props, period);
  if (usage.ok) {
    sources.usageLog = "ok";
    payload.summary.pageViews = usage.totalEvents;
    payload.summary.uniqueVisitors = Object.keys(usage.byVisitor).length;
    payload.topResources = usage.topResources;
  } else {
    sources.usageLog = "down";
  }

  // 2) Roster comes from the FUB-by-agent map if we have FUB, otherwise from the
  // pipeline stats endpoint (already cached upstream by the caller for view=all).
  var roster = _ccLoadRoster_(props);
  var coldCutoff = new Date(Date.now() - 7 * 86400000);
  var rosterScored = roster.map(function(person){
    var key = (person.email || person.name || "").toLowerCase();
    var hubVisits = (usage.byAgentEmail[key] || usage.byAgentName[(person.name||"").toLowerCase()] || { count: 0 }).count;
    var lastSeen  = (usage.byAgentEmail[key] || usage.byAgentName[(person.name||"").toLowerCase()] || { lastSeen: null }).lastSeen;

    // crude scoring — replace with real FUB compliance/training as data lights up
    var hubScore   = Math.min(100, hubVisits * 6);
    var fubScore   = person.fubScore != null ? person.fubScore : null;
    var trainScore = person.trainingScore != null ? person.trainingScore : null;
    var mrScore    = person.marketingHygiene != null ? person.marketingHygiene : null;
    var availableScores = [hubScore, fubScore, trainScore, mrScore].filter(function(x){ return x != null; });
    var compositeScore = availableScores.length
      ? Math.round(availableScores.reduce(function(a,b){ return a+b; }, 0) / availableScores.length)
      : hubScore;

    return {
      name: person.name,
      email: person.email,
      tier: person.tier || "Agent",
      hubVisits: hubVisits,
      lastSeen: lastSeen,
      fubCompliance: fubScore,
      training: trainScore,
      marketingHygiene: mrScore,
      score: compositeScore
    };
  });

  payload.agents = rosterScored;
  payload.summary.activeAgents = rosterScored.filter(function(a){
    return a.lastSeen && new Date(a.lastSeen).getTime() > coldCutoff.getTime();
  }).length;
  payload.cold = rosterScored
    .filter(function(a){ return !a.lastSeen || new Date(a.lastSeen).getTime() <= coldCutoff.getTime(); })
    .map(function(a){ return { name: a.name, lastSeen: a.lastSeen }; });
  payload.summary.coldCount = payload.cold.length;
  var fubScores = rosterScored.map(function(a){ return a.fubCompliance; }).filter(function(x){ return x != null; });
  payload.summary.fubCompliance = fubScores.length
    ? Math.round(fubScores.reduce(function(a,b){ return a+b; }, 0) / fubScores.length)
    : 0;

  return { payload: payload, sources: sources };
}

function _ccReadUsageLog_(props, period) {
  var result = { ok: false, totalEvents: 0, byAgentEmail: {}, byAgentName: {}, byVisitor: {}, topResources: [] };
  var sheetId = String(props.getProperty("USAGE_LOG_SHEET_ID") || "").trim();
  if (!sheetId) return result;

  try {
    var ss = SpreadsheetApp.openById(sheetId);
    var tabName = String(props.getProperty("USAGE_LOG_TAB") || CC_DEFAULTS.usageLogTab).trim();
    var sheet = ss.getSheetByName(tabName) || ss.getSheets()[0];
    if (!sheet) return result;
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    if (lastRow < 2 || lastCol < 1) return Object.assign(result, { ok: true });
    var headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0].map(function(h){ return String(h||"").trim().toLowerCase(); });
    var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    var idx = {
      ts:    headers.indexOf("timestamp"),
      type:  headers.indexOf("type"),
      page:  headers.indexOf("page"),
      label: headers.indexOf("label"),
      visitor: headers.indexOf("visitor_id"),
      email: headers.indexOf("agent_email"),
      name:  headers.indexOf("agent_name"),
      url:   headers.indexOf("url")
    };
    if (idx.ts === -1) return result;

    var since = _ccPeriodStartDate_(period).getTime();
    var resourceCounts = {};
    for (var r = 0; r < values.length; r++) {
      var row = values[r];
      var t = row[idx.ts];
      var ts = (t instanceof Date) ? t.getTime() : new Date(t).getTime();
      if (isNaN(ts) || ts < since) continue;
      result.totalEvents++;
      var visitor = idx.visitor >= 0 ? String(row[idx.visitor] || "") : "";
      var email   = idx.email   >= 0 ? String(row[idx.email]   || "").toLowerCase() : "";
      var name    = idx.name    >= 0 ? String(row[idx.name]    || "").toLowerCase() : "";
      var label   = idx.label   >= 0 ? String(row[idx.label]   || "") : "";
      var type    = idx.type    >= 0 ? String(row[idx.type]    || "") : "view";
      var url     = idx.url     >= 0 ? String(row[idx.url]     || "") : "";

      if (visitor && !result.byVisitor[visitor]) result.byVisitor[visitor] = true;
      if (email) {
        if (!result.byAgentEmail[email]) result.byAgentEmail[email] = { count: 0, lastSeen: null };
        result.byAgentEmail[email].count++;
        if (!result.byAgentEmail[email].lastSeen || ts > new Date(result.byAgentEmail[email].lastSeen).getTime()) {
          result.byAgentEmail[email].lastSeen = new Date(ts).toISOString();
        }
      }
      if (name) {
        if (!result.byAgentName[name]) result.byAgentName[name] = { count: 0, lastSeen: null };
        result.byAgentName[name].count++;
        if (!result.byAgentName[name].lastSeen || ts > new Date(result.byAgentName[name].lastSeen).getTime()) {
          result.byAgentName[name].lastSeen = new Date(ts).toISOString();
        }
      }
      if (type.toLowerCase() === "click" && (label || url)) {
        var resourceKey = label || url;
        if (!resourceCounts[resourceKey]) resourceCounts[resourceKey] = { label: resourceKey, kind: type, clicks: 0 };
        resourceCounts[resourceKey].clicks++;
      }
    }
    result.topResources = Object.keys(resourceCounts)
      .map(function(k){ return resourceCounts[k]; })
      .sort(function(a,b){ return b.clicks - a.clicks; })
      .slice(0, 8);
    result.ok = true;
    return result;
  } catch (err) {
    return result;
  }
}

function _ccLoadRoster_(props) {
  // Try DIRECTORY_SHEET_ID first (the existing team directory sheet that HubData.gs
  // reads from), then fall back to the usage log sheet if the directory lives there
  // alongside the Events tab.
  var rosterSheetId = String(
    props.getProperty("DIRECTORY_SHEET_ID")
    || props.getProperty("USAGE_LOG_SHEET_ID")
    || props.getProperty("DEAL_TRACKER_SHEET_ID")
    || ""
  ).trim();
  if (!rosterSheetId) return [];
  try {
    var ss = SpreadsheetApp.openById(rosterSheetId);
    var explicitTab = String(props.getProperty("DIRECTORY_TAB") || "").trim();
    var sheet = null;
    if (explicitTab) sheet = ss.getSheetByName(explicitTab);
    if (!sheet) sheet = ss.getSheetByName("Directory")
      || ss.getSheetByName("Team Directory")
      || ss.getSheetByName("team_directory")
      || null;
    if (!sheet) return [];
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    if (lastRow < 2 || lastCol < 1) return [];
    var headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0].map(function(h){ return String(h||"").trim().toLowerCase(); });
    var idx = {
      name: headers.indexOf("name"),
      email: headers.indexOf("email"),
      tier: headers.indexOf("tier")
    };
    if (idx.name === -1) return [];
    var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getDisplayValues();
    return values
      .map(function(row){
        return {
          name: idx.name >= 0 ? String(row[idx.name] || "").trim() : "",
          email: idx.email >= 0 ? String(row[idx.email] || "").trim().toLowerCase() : "",
          tier: idx.tier >= 0 ? String(row[idx.tier] || "").trim() : "Agent"
        };
      })
      .filter(function(r){ return r.name; });
  } catch (err) {
    return [];
  }
}

// ============================================================
// MARKETING — Asana + Acuity
// ============================================================
function _ccBuildMarketing_(props, period) {
  var sources = { asana: "down", acuity: "down" };
  var payload = {
    summary: { openCount: 0, completed30: 0, avgTurnaroundDays: null, upcomingBookings: 0 },
    asana: [],
    acuity: [],
    workload: [],
    bottlenecks: [],
    turnaround: { byType: [] }
  };

  // Asana
  var asanaToken = String(props.getProperty("ASANA_TOKEN") || "").trim();
  var asanaProject = String(props.getProperty("ASANA_MARKETING_PROJECT_GID") || "").trim();
  if (asanaToken && asanaProject) {
    try {
      var asanaTasks = _ccFetchAsanaTasks_(asanaToken, asanaProject, period);
      sources.asana = "ok";
      payload.asana = asanaTasks.openTasks;
      payload.summary.openCount = asanaTasks.openTasks.length;
      payload.summary.completed30 = asanaTasks.completedCount;
      payload.summary.avgTurnaroundDays = asanaTasks.avgTurnaroundDays;
      payload.workload = asanaTasks.workload;
      payload.bottlenecks = asanaTasks.bottlenecks;
      payload.turnaround.byType = asanaTasks.turnaroundByType;
    } catch (errAsana) {
      sources.asana = "down";
    }
  }

  // Acuity
  var acuityUserId = String(props.getProperty("ACUITY_USER_ID") || "").trim();
  var acuityKey = String(props.getProperty("ACUITY_API_KEY") || "").trim();
  if (acuityUserId && acuityKey) {
    try {
      var bookings = _ccFetchAcuityBookings_(acuityUserId, acuityKey, props);
      sources.acuity = "ok";
      payload.acuity = bookings;
      payload.summary.upcomingBookings = bookings.filter(function(b){
        return b.startsAt && new Date(b.startsAt).getTime() > Date.now()
          && new Date(b.startsAt).getTime() < Date.now() + 14 * 86400000;
      }).length;
    } catch (errAcuity) {
      sources.acuity = "down";
    }
  }

  return { payload: payload, sources: sources };
}

function _ccFetchAsanaTasks_(token, projectGid, period) {
  var headers = { "Authorization": "Bearer " + token };
  var since = _ccPeriodStartDate_(period);

  // 1) Open tasks (incomplete) in the project
  var openUrl = CC_DEFAULTS.asanaApiBaseUrl + "/projects/" + projectGid
    + "/tasks?completed_since=now"
    + "&opt_fields=name,assignee,assignee.name,assignee.email,custom_fields,created_at,due_on,modified_at,permalink_url,memberships.section.name";
  var openRes = UrlFetchApp.fetch(openUrl, { method: "get", headers: headers, muteHttpExceptions: true });
  var openBody = _ccParseJson_(openRes.getContentText(), null);
  var openTasks = (openBody && openBody.data) || [];

  // 2) Recently completed tasks for turnaround math
  var completedUrl = CC_DEFAULTS.asanaApiBaseUrl + "/projects/" + projectGid
    + "/tasks?completed_since=" + since.toISOString()
    + "&opt_fields=name,assignee,assignee.name,custom_fields,created_at,completed_at,due_on,permalink_url,memberships.section.name";
  var completedRes = UrlFetchApp.fetch(completedUrl, { method: "get", headers: headers, muteHttpExceptions: true });
  var completedBody = _ccParseJson_(completedRes.getContentText(), null);
  var completedTasks = ((completedBody && completedBody.data) || []).filter(function(t){ return t && t.completed_at; });

  // Map to our shape
  var formattedOpen = openTasks.map(function(t){ return _ccFormatAsanaTask_(t, false); });
  var formattedDone = completedTasks.map(function(t){ return _ccFormatAsanaTask_(t, true); });

  // Workload by agent (combines open + completed in window)
  var workloadMap = {};
  formattedOpen.forEach(function(t){
    var a = t.agent || "Unassigned";
    if (!workloadMap[a]) workloadMap[a] = { agent: a, open: 0, completed: 0 };
    workloadMap[a].open++;
  });
  formattedDone.forEach(function(t){
    var a = t.agent || "Unassigned";
    if (!workloadMap[a]) workloadMap[a] = { agent: a, open: 0, completed: 0 };
    workloadMap[a].completed++;
  });
  var workload = Object.keys(workloadMap).map(function(k){ return workloadMap[k]; });

  // Bottlenecks: oldest open tasks
  var bottlenecks = formattedOpen
    .filter(function(t){ return t.createdAt; })
    .map(function(t){
      var days = Math.max(0, Math.floor((Date.now() - new Date(t.createdAt).getTime()) / 86400000));
      return { title: t.title, agent: t.agent, daysOpen: days, stage: t.status };
    })
    .sort(function(a,b){ return b.daysOpen - a.daysOpen; })
    .slice(0, 6);

  // Turnaround by type
  var byType = {};
  formattedDone.forEach(function(t){
    if (!t.completedAt || !t.createdAt) return;
    var days = (new Date(t.completedAt).getTime() - new Date(t.createdAt).getTime()) / 86400000;
    if (days < 0) return;
    var typeKey = t.type || "Other";
    if (!byType[typeKey]) byType[typeKey] = { type: typeKey, samples: [] };
    byType[typeKey].samples.push(days);
  });
  var turnaroundByType = Object.keys(byType).map(function(k){
    var s = byType[k].samples.slice().sort(function(a,b){ return a-b; });
    var median = s.length ? (s.length % 2 ? s[(s.length-1)/2] : (s[s.length/2-1] + s[s.length/2]) / 2) : 0;
    return { type: k, medianDays: median, count: s.length, goalDays: CC_MARKETING_REQUEST_GOALS[k] || 5 };
  }).sort(function(a,b){ return b.count - a.count; });

  // Average turnaround across all completed
  var allDays = [];
  formattedDone.forEach(function(t){
    if (!t.completedAt || !t.createdAt) return;
    var d = (new Date(t.completedAt).getTime() - new Date(t.createdAt).getTime()) / 86400000;
    if (d >= 0) allDays.push(d);
  });
  var avgTurnaround = allDays.length ? (allDays.reduce(function(a,b){ return a+b; }, 0) / allDays.length) : null;

  return {
    openTasks: formattedOpen,
    completedCount: formattedDone.length,
    avgTurnaroundDays: avgTurnaround,
    workload: workload,
    bottlenecks: bottlenecks,
    turnaroundByType: turnaroundByType
  };
}

function _ccFormatAsanaTask_(t, isCompleted) {
  // Pull "type" from a custom field named "Type" (case-insensitive) if present;
  // otherwise fall back to the section name (Asana board column).
  var type = "";
  var status = isCompleted ? "Done" : "Open";
  if (t && t.custom_fields) {
    for (var i = 0; i < t.custom_fields.length; i++) {
      var cf = t.custom_fields[i];
      var nm = String(cf.name || "").toLowerCase();
      if (nm === "type" || nm === "request type") {
        type = (cf.display_value || cf.text_value || "").trim();
        break;
      }
    }
  }
  if (!type && t && t.memberships && t.memberships.length) {
    var sec = t.memberships[0].section;
    type = (sec && sec.name) ? sec.name : "";
  }
  if (!isCompleted && t && t.memberships && t.memberships.length) {
    var sec2 = t.memberships[0].section;
    var secName = (sec2 && sec2.name) ? String(sec2.name).toLowerCase() : "";
    if (/review|qa/.test(secName)) status = "Review";
  }
  return {
    id: t.gid,
    title: t.name || "(no title)",
    agent: (t.assignee && t.assignee.name) ? t.assignee.name : "",
    agentEmail: (t.assignee && t.assignee.email) ? String(t.assignee.email).toLowerCase() : "",
    type: type || "—",
    status: status,
    createdAt: t.created_at || null,
    completedAt: t.completed_at || null,
    dueOn: t.due_on || null,
    url: t.permalink_url || null
  };
}

function _ccFetchAcuityBookings_(userId, apiKey, props) {
  var calendars = String(props.getProperty("ACUITY_CALENDAR_IDS") || "").trim();
  var minDate = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  var maxDate = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  var url = CC_DEFAULTS.acuityApiBaseUrl + "/appointments?max=100&minDate=" + minDate + "&maxDate=" + maxDate
    + (calendars ? "&calendarID=" + encodeURIComponent(calendars) : "");
  var headers = {
    "Authorization": "Basic " + Utilities.base64Encode(userId + ":" + apiKey),
    "Accept": "application/json"
  };
  var res = UrlFetchApp.fetch(url, { method: "get", headers: headers, muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) return [];
  var body = _ccParseJson_(res.getContentText(), null);
  if (!Array.isArray(body)) return [];
  return body
    .map(function(b){
      return {
        id: b.id,
        title: b.type || b.appointmentTypeID,
        type: b.type,
        agent: b.calendar || b.firstName || "",
        startsAt: b.datetime || b.startTime,
        endsAt: b.endTime,
        clientName: ((b.firstName || "") + " " + (b.lastName || "")).trim(),
        clientEmail: b.email || ""
      };
    })
    .sort(function(a,b){
      return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
    });
}

// ============================================================
// SYSTEM — GitHub commits + QA log + ownership
// ============================================================
function _ccBuildSystem_(props, period) {
  var sources = { github: "down" };
  var payload = {
    summary: { commits30: 0, openIssues: 0, appsScriptErrors: 0, staleDashboards: 0 },
    commits: [],
    qa: [],
    ownership: CC_OWNERSHIP
  };

  var token = String(props.getProperty("GITHUB_TOKEN") || "").trim();
  var repo  = String(props.getProperty("GITHUB_REPO")  || "").trim();
  if (repo) {
    try {
      var sinceIso = _ccPeriodStartDate_(period).toISOString();
      var url = CC_DEFAULTS.githubApiBaseUrl + "/repos/" + repo + "/commits?per_page=30&since=" + encodeURIComponent(sinceIso);
      var headers = { "User-Agent": "ASG-Command-Center", "Accept": "application/vnd.github+json" };
      if (token) headers["Authorization"] = "Bearer " + token;
      var res = UrlFetchApp.fetch(url, { method: "get", headers: headers, muteHttpExceptions: true });
      if (res.getResponseCode() === 200) {
        var commits = _ccParseJson_(res.getContentText(), []);
        payload.commits = (commits || []).map(function(c){
          return {
            sha: c.sha,
            shortSha: c.sha ? c.sha.slice(0, 7) : "",
            message: c.commit && c.commit.message ? c.commit.message.split("\n")[0] : "",
            author: c.commit && c.commit.author ? c.commit.author.name : (c.author && c.author.login) || "unknown",
            timestamp: c.commit && c.commit.author && c.commit.author.date ? c.commit.author.date : null,
            url: c.html_url
          };
        });
        payload.summary.commits30 = payload.commits.length;
        sources.github = "ok";
      }
    } catch (errGh) {
      sources.github = "down";
    }
  }

  // QA — read from a "QA" tab on the usage log sheet if present
  try {
    var sheetId = String(props.getProperty("USAGE_LOG_SHEET_ID") || "").trim();
    if (sheetId) {
      var ss = SpreadsheetApp.openById(sheetId);
      var qa = ss.getSheetByName("QA");
      if (qa) {
        var lastRow = qa.getLastRow();
        var lastCol = qa.getLastColumn();
        if (lastRow >= 2 && lastCol >= 1) {
          var headers = qa.getRange(1,1,1,lastCol).getDisplayValues()[0].map(function(h){ return String(h||"").trim().toLowerCase(); });
          var values = qa.getRange(2,1,lastRow-1,lastCol).getDisplayValues();
          var idx = {
            ts: headers.indexOf("timestamp"),
            kind: headers.indexOf("kind"),
            title: headers.indexOf("title"),
            severity: headers.indexOf("severity"),
            status: headers.indexOf("status")
          };
          values.forEach(function(row){
            var status = idx.status >= 0 ? String(row[idx.status]||"").toLowerCase() : "";
            if (status === "resolved" || status === "closed") return;
            payload.qa.push({
              kind: idx.kind >= 0 ? row[idx.kind] : "issue",
              title: idx.title >= 0 ? row[idx.title] : "(no title)",
              severity: idx.severity >= 0 ? String(row[idx.severity]||"").toLowerCase() : "amber",
              timestamp: idx.ts >= 0 ? row[idx.ts] : null
            });
          });
          payload.summary.openIssues = payload.qa.length;
        }
      }
    }
  } catch (errQa) {}

  return { payload: payload, sources: sources };
}

// ============================================================
// HELPERS
// ============================================================
function _ccJson_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function _ccParseJson_(text, fallback) {
  try { return JSON.parse(text); } catch (err) { return fallback; }
}

function _ccToInt_(value, fallback) {
  var n = parseInt(value, 10);
  return isNaN(n) ? fallback : n;
}

function _ccFetchJson_(url, opts) {
  var res = UrlFetchApp.fetch(url, opts || { method: "get", muteHttpExceptions: true });
  if (res.getResponseCode() < 200 || res.getResponseCode() >= 300) {
    throw new Error("HTTP " + res.getResponseCode() + " on " + url);
  }
  return _ccParseJson_(res.getContentText(), null);
}
