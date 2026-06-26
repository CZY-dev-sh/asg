/* ASG Admin Console — runtime config. Runs BEFORE the embedded surface
   scripts so their window.* API constants resolve to the Supabase backend.
   Override any of these by defining them earlier on the page. */
(function () {
  // Base URL of the ASG backend (Fastify). Change here or set window.ASG_API_BASE.
  window.ASG_API_BASE = (window.ASG_API_BASE || "__API_BASE__").replace(/\/+$/, "");
  var B = window.ASG_API_BASE;

  // Supabase Auth (publishable/anon key — safe for the browser).
  window.ASG_SUPABASE_URL = window.ASG_SUPABASE_URL || "__SUPABASE_URL__";
  window.ASG_SUPABASE_ANON_KEY = window.ASG_SUPABASE_ANON_KEY || "__SUPABASE_ANON__";

  // Repoint every embedded surface at the new backend (same JSON contracts).
  window.ASG_LISTINGS_API        = window.ASG_LISTINGS_API        || B + "/api/listings";
  window.ASG_HUB_DATA_API        = window.ASG_HUB_DATA_API        || B + "/api/hub-data";
  window.ASG_PIPELINE_STATS_API  = window.ASG_PIPELINE_STATS_API  || B + "/api/pipeline-stats";
  window.ASG_RECENT_FOLDERS_API  = window.ASG_RECENT_FOLDERS_API  || B + "/api/recent-folders";
  window.ASG_COMMAND_CENTER_API  = window.ASG_COMMAND_CENTER_API  || B + "/api/command-center";
  window.ASG_FUB_HUB_API         = window.ASG_FUB_HUB_API         || B + "/api/fub-hub";
  window.DEAL_TRACKER_API        = window.DEAL_TRACKER_API        || B + "/api/fub-hub?view=dealTracker";
  window.ASG_MARKETING_OUTPUT_API= window.ASG_MARKETING_OUTPUT_API|| B + "/api/marketing-output";
  window.ASG_USAGE_LOG_API       = window.ASG_USAGE_LOG_API       || B + "/api/usage-log";

  // Pipeline workbook CSVs feed the Overview leaderboard. They are public
  // Google Sheets exports (not Apps Script); leave as-is unless overridden.
  window.ASG_BUYERS_CSV  = window.ASG_BUYERS_CSV  || "";
  window.ASG_SELLERS_CSV = window.ASG_SELLERS_CSV || "";
})();
