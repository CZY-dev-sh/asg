/* === Listing Hub sell detail (synced from master dashboard) === */
function resolveLhAgentPhoto(name){return resolveAgentPhotoByName(name)||"";}
function normalizeAgentName(name){return String(name||"").toLowerCase().replace(/\s+/g," ").trim();}
function normalizeAgentKey(name){
  var full=String(name||"").toLowerCase().replace(/\s+/g," ").trim();
  var aliases={
    "nico":"nicolas gamboa wills","nicolas":"nicolas gamboa wills","matt":"matthew clevenger",
    "gabe":"gabriel rendon","angie":"angela engelbrecht","alex 2.0":"alex valladares","alex v":"alex valladares"
  };
  full=aliases[full]||full;
  if(full.indexOf("andrea koed")===0)return"andrea koedjikova";
  if(full.indexOf("andrea mir")===0)return"andrea mirchef";
  if(full.indexOf("myriam elkhoury")===0||full.indexOf("myriam el-khoury")===0)return"myriam el-khoury";
  return full;
}
function normalizeAgentLookup(name){
  var full=normalizeAgentKey(name);
  var aliases={"nico":"nicolas gamboa wills","matt":"matthew clevenger","gabe":"gabriel rendon","angie":"angela engelbrecht","alex 2.0":"alex valladares","alex v":"alex valladares"};
  if(aliases[full])full=aliases[full];
  return full;
}
const lhSellDetail={
  photoIndexByAddress:{},
  photoCacheByAddress:{},
  photoLoadingAddress:"",
  qCopied:{},
  stageOverride:{}
};
var AMD_CAROUSEL_CHEV_L='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>';
var AMD_CAROUSEL_CHEV_R='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>';

/* resolveAgent */
    function resolveAgentLinks(name) {
      var full = normalizeAgentLookup(name);
      if (AGENT_LINKS[full]) return AGENT_LINKS[full];
      var first = (full.split(" ")[0] || "").trim();
      if (!first) return { book: "", request: "" };
      var keys = Object.keys(AGENT_LINKS);
      for (var i = 0; i < keys.length; i++) {
        if (keys[i].split(" ")[0] === first) return AGENT_LINKS[keys[i]];
      }
      return { book: "", request: "" };
    }
/* agentQ */
    var AGENT_LINKS = {
      "alex stoykov": {
        book: "https://asgmarketing.as.me/?firstName=Alex&lastName=Stoykov&email=alex.stoykov%40compass.com&phone=3125933110&field:18245579=Alex%20Stoykov&field:18245580=Admin%20Hub",
        request: "https://form.asana.com/?k=pt7tbwwT4JUDdxLj2fbm5Q&d=7720513273924"
      },
      "sam abadi": {
        book: "https://asgmarketing.as.me/?firstName=Sam&lastName=Abadi&email=sam.abadi%40compass.com&phone=8473344778&field:18245579=Sam%20Abadi&field:18245580=Admin%20Hub",
        request: "https://form.asana.com/?k=5GNV6fln0YFlMiZrsAJ2Kw&d=7720513273924"
      },
      "shelly channey": {
        book: "https://asgmarketing.as.me/?firstName=Shelly&lastName=Channey&email=shelly.kapoor%40compass.com&phone=6303624041&field:18245579=Shelly%20Channey&field:18245580=Admin%20Hub",
        request: "https://form.asana.com/?k=7BkpF9s9vX9oGTsiYl-ftg&d=7720513273924"
      },
      "nicolas gamboa wills": {
        book: "https://asgmarketing.as.me/?firstName=Nicolas&lastName=Gamboa%20Wills&email=nicolas.gamboawills%40compass.com&phone=3126100301&field:18245579=Nicolas%20Gamboa%20Wills&field:18245580=Admin%20Hub",
        request: "https://form.asana.com/?k=8Lw82C2zcajV-xHYEw_75w&d=7720513273924"
      },
      "julian levit": {
        book: "https://asgmarketing.as.me/?firstName=Julian&lastName=Levit&email=julianlevit%40compass.com&phone=8473028804&field:18245579=Julian%20Levit&field:18245580=Admin%20Hub",
        request: "https://form.asana.com/?k=RJKIMRElm8E7ppFlclt_fA&d=7720513273924"
      },
      "mino conenna": {
        book: "https://asgmarketing.as.me/?firstName=Mino&lastName=Conenna&email=mino.conenna%40compass.com&phone=8474777779&field:18245579=Mino%20Conenna&field:18245580=Admin%20Hub",
        request: "https://form.asana.com/?k=3-JUPCfHN838A8krYo9isQ&d=7720513273924"
      },
      "angela engelbrecht": {
        book: "https://asgmarketing.as.me/?firstName=Angela&lastName=Engelbrecht&email=angela.engelbrecht%40compass.com&phone=3122139916&field:18245579=Angela%20Engelbrecht&field:18245580=Admin%20Hub",
        request: "https://form.asana.com/?k=PA4Y8j5F1YR8dzSfesDe6A&d=7720513273924"
      },
      "layne zagorin": {
        book: "https://asgmarketing.as.me/?firstName=Layne&lastName=Zagorin&email=layne.zagorin%40compass.com&phone=7734250039&field:18245579=Layne%20Zagorin&field:18245580=Admin%20Hub",
        request: "https://form.asana.com/?k=kZ8ielvYc-6DkzJ0Cej_qQ&d=7720513273924"
      },
      "barbara laken": {
        book: "https://asgmarketing.as.me/?firstName=Barbara&lastName=Laken&email=barbara.laken%40compass.com&phone=3122821087&field:18245579=Barbara%20Laken&field:18245580=Admin%20Hub",
        request: "https://form.asana.com/?k=espwfceO9_elFbLyN8iBbw&d=7720513273924"
      },
      "gabriel rendon": {
        book: "https://asgmarketing.as.me/?firstName=Gabriel&lastName=Rendon&email=gabriel.rendon%40compass.com&phone=8478137507&field:18245579=Gabriel%20Rendon&field:18245580=Admin%20Hub",
        request: "https://form.asana.com/?k=Dn1_kKOAfdejXCnkIIEktA&d=7720513273924"
      },
      "matthew clevenger": {
        book: "https://asgmarketing.as.me/?firstName=Matthew&lastName=Clevenger&email=matthew.clevenger%40compass.com&phone=6197084420&field:18245579=Matthew%20Clevenger&field:18245580=Admin%20Hub",
        request: "https://form.asana.com/?k=EqgNKJpvBteZLA1laayeAQ&d=7720513273924"
      },
      "justin curran": {
        book: "https://asgmarketing.as.me/?firstName=Justin&lastName=Curran&email=justin.curran%40compass.com&phone=8475077753&field:18245579=Justin%20Curran&field:18245580=Admin%20Hub",
        request: ""
      }
    };
    // Per-agent seller questionnaire links. Sourced from the Team Directory
    // (`team-directory.html` → person.request) — same Asana form the agent
    // hands their new seller. Keep this list in sync with the directory.
    var AGENT_QUESTIONNAIRE_LINKS = {
      "alex stoykov": "https://form.asana.com/?k=EFcJ61aAKXCrMf_iEkbPFg&d=7720513273924",
      "sam abadi": "https://form.asana.com/?k=T39wL3gqPVG3R62sbGLY9Q&d=7720513273924",
      "shelly channey": "https://form.asana.com/?k=_PuAEWqmrh6Z6CsUJE6ztg&d=7720513273924",
      "nicolas gamboa wills": "https://form.asana.com/?k=bxl6UyBcYxbpDslZ7ZkNkQ&d=7720513273924",
      "julian levit": "https://form.asana.com/?k=FC_lxXSCyr-TvyVPRhylgA&d=7720513273924",
      "mino conenna": "https://form.asana.com/?k=CcNmPwIB3ARfyWOxLd1FUg&d=7720513273924",
      "angela engelbrecht": "https://form.asana.com/?k=iAJkMMZ0j3oZw2BVQmiMuw&d=7720513273924",
      "layne zagorin": "https://form.asana.com/?k=fW8VDNYYSL3vWmD-jNhO4w&d=7720513273924",
      "barbara laken": "https://form.asana.com/?k=WzA9i1p-T3T5AiseM_SC5Q&d=7720513273924",
      "gabriel rendon": "https://form.asana.com/?k=ZsDRdyHI1w-VVCBqCnKaJQ&d=7720513273924",
      "matthew clevenger": "https://form.asana.com/?k=u-68Hp9w1zgi0dT14ATiBA&d=7720513273924",
      "justin curran": "",
      "alex valladares": ""
    };
    function resolveAgentQuestionnaireLink(name) {
      var full = String(name || "").toLowerCase().trim();
      if (AGENT_QUESTIONNAIRE_LINKS[full]) return AGENT_QUESTIONNAIRE_LINKS[full];
      var first = full.split(" ")[0];
      var keys = Object.keys(AGENT_QUESTIONNAIRE_LINKS);
      for (var i = 0; i < keys.length; i++) {
        if (keys[i].split(" ")[0] === first && AGENT_QUESTIONNAIRE_LINKS[keys[i]]) return AGENT_QUESTIONNAIRE_LINKS[keys[i]];
      }
      return "";
    }
    // Listing-detail bento-box icon glyphs.
    // SVG paths are designed to render with the .amd-lh-ico / .amd-lh-stat-ico /
    // .amd-lh-asset-ico CSS (currentColor stroke, no fill, ~1.6 stroke width).
    var BENTO_ICONS = {
      // Main bento section icons.
      status:       '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.8 8.6 8 4l5.2 4.6V13a.8.8 0 0 1-.8.8H3.6A.8.8 0 0 1 2.8 13V8.6Z"/><path d="M6.5 13.6V10h3v3.6"/></svg>',
      photos:       '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 5.4h1.8l1.1-1.6h4.2l1.1 1.6H13c.55 0 1 .45 1 1V12c0 .55-.45 1-1 1H3a1 1 0 0 1-1-1V6.4c0-.55.45-1 1-1Z"/><circle cx="8" cy="9.2" r="2.2"/></svg>',
      matterport:   '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.6 13.4 5v6L8 13.4 2.6 11V5Z"/><path d="M2.6 5 8 7.8m5.4-2.8L8 7.8m0 0v5.6"/></svg>',
      marketing:    '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.4 6.4h2.2l5-3v9.2l-5-3H3.4a.8.8 0 0 1-.8-.8V7.2a.8.8 0 0 1 .8-.8Z"/><path d="M12.5 6.4c.6.5.9 1.05.9 1.8 0 .75-.3 1.3-.9 1.8"/></svg>',
      // Status-grid cell icons.
      pin:          '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 13.6s4.2-4 4.2-7.1A4.2 4.2 0 0 0 3.8 6.5c0 3.1 4.2 7.1 4.2 7.1Z"/><circle cx="8" cy="6.4" r="1.5"/></svg>',
      ruler:        '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.4" y="6.2" width="11.2" height="3.6" rx="0.6"/><path d="M4.8 6.2v1.4m2-1.4v1.8m2-1.8v1.4m2-1.8v1.8"/></svg>',
      chart:        '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.6 13.4h10.8"/><path d="M4.6 11V8.4M7.4 11V6M10.2 11V7.2"/></svg>',
      // Marketing-asset tile icons.
      camera:       '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 5.4h1.8l1.1-1.6h4.2l1.1 1.6H13c.55 0 1 .45 1 1V12c0 .55-.45 1-1 1H3a1 1 0 0 1-1-1V6.4c0-.55.45-1 1-1Z"/><circle cx="8" cy="9.2" r="2.2"/></svg>',
      cube:         '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.6 13.4 5v6L8 13.4 2.6 11V5Z"/><path d="M2.6 5 8 7.8m5.4-2.8L8 7.8m0 0v5.6"/></svg>',
      video:        '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.4" y="4.4" width="8.4" height="7.2" rx="1.2"/><path d="m10.8 6.6 2.6-1.4v5.6l-2.6-1.4Z"/></svg>',
      plan:         '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.4" y="2.6" width="11.2" height="10.8" rx="1.4"/><path d="M5.8 2.6v6.8m-3.4-3h6.8m.4 0H13.6M5.8 9.4v4"/></svg>',
      doc:          '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.4 2.6h5l2.6 2.6V13a.8.8 0 0 1-.8.8H4.4a.8.8 0 0 1-.8-.8V3.4a.8.8 0 0 1 .8-.8Z"/><path d="M9.4 2.6v2.6H12M5.6 8.4h4.8m-4.8 2h4.8m-4.8 2h3"/></svg>',
      book:         '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3.4h4.4c.7 0 1.2.5 1.2 1.2v8.8a1 1 0 0 0-1-1H3Z"/><path d="M13 3.4H8.6c-.7 0-1.2.5-1.2 1.2v8.8a1 1 0 0 1 1-1H13Z"/></svg>',
      flyer:        '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="2.6" width="10" height="10.8" rx="1.2"/><path d="M5.2 5.4h5.6M5.2 7.6h5.6M5.2 9.8h3.6"/></svg>',
      sign:         '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.6v10.8"/><path d="M3.6 5.4h7.6l1.6 1.6-1.6 1.6H3.6Zm9 4H4.8L3.2 11l1.6 1.6h7.6"/></svg>'
    };
    // Map a marketing-asset label to its tile icon kind.
    var MARKETING_ASSET_ICONS = {
      "Photos": "camera",
      "Matterport": "cube",
      "Video": "video",
      "Floor Plan": "plan",
      "Fact Sheet": "doc",
      "Open House Materials": "flyer"
    };
    // For empty marketing-asset tiles, decide whether the fallback CTA is
    // "Book" (Acuity scheduling) or "Request" (Asana design request form).
    // Photos / Matterport / Video are booked services; the rest are requested.
    var MARKETING_ASSET_ACTION = {
      "Photos": "book",
      "Matterport": "book",
      "Video": "book",
      "Floor Plan": "book",
      "Fact Sheet": "request",
      "Open House Materials": "request"
    };
    // Map each marketing-asset tile label to the service-state machine key
    // used by getCaptureServiceState() / getMarketingMaterialsState(). The
    // four request-based tiles share a single Marketing-Materials state.
    var MARKETING_ASSET_SERVICE_KEY = {
      "Photos": "photos",
      "Matterport": "matterport",
      "Video": "video",
      "Floor Plan": "floor_plan",
      "Fact Sheet": "fact_sheet",
      "Open House Materials": "open_house_materials"
    };

/* icons */
    var BENTO_ICONS = {
      // Main bento section icons.
      status:       '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.8 8.6 8 4l5.2 4.6V13a.8.8 0 0 1-.8.8H3.6A.8.8 0 0 1 2.8 13V8.6Z"/><path d="M6.5 13.6V10h3v3.6"/></svg>',
      photos:       '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 5.4h1.8l1.1-1.6h4.2l1.1 1.6H13c.55 0 1 .45 1 1V12c0 .55-.45 1-1 1H3a1 1 0 0 1-1-1V6.4c0-.55.45-1 1-1Z"/><circle cx="8" cy="9.2" r="2.2"/></svg>',
      matterport:   '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.6 13.4 5v6L8 13.4 2.6 11V5Z"/><path d="M2.6 5 8 7.8m5.4-2.8L8 7.8m0 0v5.6"/></svg>',
      marketing:    '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.4 6.4h2.2l5-3v9.2l-5-3H3.4a.8.8 0 0 1-.8-.8V7.2a.8.8 0 0 1 .8-.8Z"/><path d="M12.5 6.4c.6.5.9 1.05.9 1.8 0 .75-.3 1.3-.9 1.8"/></svg>',
      // Status-grid cell icons.
      pin:          '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 13.6s4.2-4 4.2-7.1A4.2 4.2 0 0 0 3.8 6.5c0 3.1 4.2 7.1 4.2 7.1Z"/><circle cx="8" cy="6.4" r="1.5"/></svg>',
      ruler:        '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.4" y="6.2" width="11.2" height="3.6" rx="0.6"/><path d="M4.8 6.2v1.4m2-1.4v1.8m2-1.8v1.4m2-1.8v1.8"/></svg>',
      chart:        '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.6 13.4h10.8"/><path d="M4.6 11V8.4M7.4 11V6M10.2 11V7.2"/></svg>',
      // Marketing-asset tile icons.
      camera:       '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 5.4h1.8l1.1-1.6h4.2l1.1 1.6H13c.55 0 1 .45 1 1V12c0 .55-.45 1-1 1H3a1 1 0 0 1-1-1V6.4c0-.55.45-1 1-1Z"/><circle cx="8" cy="9.2" r="2.2"/></svg>',
      cube:         '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.6 13.4 5v6L8 13.4 2.6 11V5Z"/><path d="M2.6 5 8 7.8m5.4-2.8L8 7.8m0 0v5.6"/></svg>',
      video:        '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.4" y="4.4" width="8.4" height="7.2" rx="1.2"/><path d="m10.8 6.6 2.6-1.4v5.6l-2.6-1.4Z"/></svg>',
      plan:         '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.4" y="2.6" width="11.2" height="10.8" rx="1.4"/><path d="M5.8 2.6v6.8m-3.4-3h6.8m.4 0H13.6M5.8 9.4v4"/></svg>',
      doc:          '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.4 2.6h5l2.6 2.6V13a.8.8 0 0 1-.8.8H4.4a.8.8 0 0 1-.8-.8V3.4a.8.8 0 0 1 .8-.8Z"/><path d="M9.4 2.6v2.6H12M5.6 8.4h4.8m-4.8 2h4.8m-4.8 2h3"/></svg>',
      book:         '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3.4h4.4c.7 0 1.2.5 1.2 1.2v8.8a1 1 0 0 0-1-1H3Z"/><path d="M13 3.4H8.6c-.7 0-1.2.5-1.2 1.2v8.8a1 1 0 0 1 1-1H13Z"/></svg>',
      flyer:        '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="2.6" width="10" height="10.8" rx="1.2"/><path d="M5.2 5.4h5.6M5.2 7.6h5.6M5.2 9.8h3.6"/></svg>',
      sign:         '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.6v10.8"/><path d="M3.6 5.4h7.6l1.6 1.6-1.6 1.6H3.6Zm9 4H4.8L3.2 11l1.6 1.6h7.6"/></svg>'
    };
    // Map a marketing-asset label to its tile icon kind.
    var MARKETING_ASSET_ICONS = {
      "Photos": "camera",
      "Matterport": "cube",
      "Video": "video",
      "Floor Plan": "plan",
      "Fact Sheet": "doc",
      "Open House Materials": "flyer"
    };
    // For empty marketing-asset tiles, decide whether the fallback CTA is
    // "Book" (Acuity scheduling) or "Request" (Asana design request form).
    // Photos / Matterport / Video are booked services; the rest are requested.
    var MARKETING_ASSET_ACTION = {
      "Photos": "book",
      "Matterport": "book",
      "Video": "book",
      "Floor Plan": "book",
      "Fact Sheet": "request",
      "Open House Materials": "request"
    };
    // Map each marketing-asset tile label to the service-state machine key
    // used by getCaptureServiceState() / getMarketingMaterialsState(). The
    // four request-based tiles share a single Marketing-Materials state.
    var MARKETING_ASSET_SERVICE_KEY = {
      "Photos": "photos",
      "Matterport": "matterport",
      "Video": "video",
      "Floor Plan": "floor_plan",
      "Fact Sheet": "fact_sheet",
      "Open House Materials": "open_house_materials"
    };

/* post */
    function postListingUpdate(address, updates) {
      var body = JSON.stringify({ action: "updatelisting", address: address, updates: updates });
      return fetch(LISTINGS_API, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: body,
        redirect: "follow"
      }).then(function (r) {
        if (!r.ok) throw new Error("Update failed (" + r.status + ")");
        return r.json();
      });
    }

    // Allowed phase + type options for the inline edit chips. The current
    // sheet value is always merged in as the first option so we never lose
    // an off-spec custom value the admin already entered.
    var LISTING_PHASE_OPTIONS = [
      "Pre-Listing",
      "Coming Soon",
      "Live",
      "Under Contract",
      "Pending",
      "Closed",
      "Sold",
      "Off-Market",
      "Withdrawn",
      "Expired"
    ];
    var LISTING_TYPE_OPTIONS = [
      "Sale",
      "Lease",
      "Sale + Lease",
      "Land"
    ];
    function listingPhaseLabel(row) {
      var raw = String((row && (row.phaseKey || row.status || row.phase)) || "").trim();
      if (!raw) return "—";
      var key = raw.toLowerCase().replace(/[\s_\-]+/g, "");
      if (/prelisting|prelist/.test(key) || (key.indexOf("pre") === 0 && key.indexOf("list") > -1)) return "Coming Soon";
      return raw
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/[_\-]+/g, " ")
        .replace(/\s+/g, " ")
        .replace(/\b\w/g, function (c) { return c.toUpperCase(); });
    }
    function buildOptionList(options, current, formatLabel) {
      var seen = {};
      var out = [];
      var trimmed = String(current || "").trim();
      function push(displayLabel, value) {
        var key = String(value || "").toLowerCase().trim();
        if (!key || seen[key]) return;
        seen[key] = true;
        var sel = trimmed && trimmed.toLowerCase() === key ? " selected" : "";
        out.push('<option value="' + esc(value) + '"' + sel + ">" + esc(displayLabel) + "</option>");
      }
      if (trimmed) {
        var disp = formatLabel ? formatLabel(trimmed) : trimmed;
        push(disp, trimmed);
      }
      for (var i = 0; i < options.length; i++) {
        push(options[i], options[i]);
      }
      return out.join("");
    }
    function formatListingTypeDisplay(raw) {
      var s = String(raw || "").trim();
      if (!s) return s;
      return s.replace(/\b\w/g, function (c) { return c.toUpperCase(); });
    }
    var RENTAL_UNAVAILABLE_NOTE = "Not offered on lease listings — photos only";
    var RENTAL_EXCLUDED_ASSET_LABELS = {
      "Matterport": true,
      "Video": true,
      "Floor Plan": true,
      "Fact Sheet": true
    };
    var RENTAL_EXCLUDED_ROADMAP_KEYS = {
      questionnaire: true,
      matterport: true,
      floor_plan: true,
      video: true
    };
    function isRentalOnlyListing(row) {
      var t = String((row && row.listingType) || "").trim().toLowerCase().replace(/\s+/g, " ");
      return t === "lease" || t === "rental" || t === "rent";
    }
    function isRentalExcludedAssetLabel(label) {
      return !!RENTAL_EXCLUDED_ASSET_LABELS[String(label || "").trim()];
    }

/* marketing */
    function renderListingEditChips(row) {
      var phaseValue = String((row && (row.phaseKey || row.status || row.phase)) || "").trim();
      var typeValue = String((row && row.listingType) || "").trim();
      var phaseLabel = phaseValue
        ? listingPhaseLabel({ phaseKey: phaseValue, status: phaseValue, phase: phaseValue })
        : "—";
      var typeLabel = typeValue ? formatListingTypeDisplay(typeValue) : "—";
      return (
        '<div class="amd-lh-edit-chips is-readonly">' +
          '<div class="amd-lh-edit-chip-col">' +
            '<span class="amd-lh-edit-chip-title">Status</span>' +
            '<span class="amd-lh-badge is-blue amd-lh-status-chip">' + esc(phaseLabel) + "</span>" +
          "</div>" +
          '<div class="amd-lh-edit-chip-col">' +
            '<span class="amd-lh-edit-chip-title">Type</span>' +
            '<span class="amd-lh-badge is-orange amd-lh-status-chip">' + esc(typeLabel) + "</span>" +
          "</div>" +
        "</div>"
      );
    }

    function listingDetailPageUrl(addr) {
      var a = String(addr || "").trim();
      if (!a) return "#";
      var sep = LISTINGS_API.indexOf("?") >= 0 ? "&" : "?";
      return LISTINGS_API + sep + "view=detailpage&address=" + encodeURIComponent(a);
    }

    function normalizeListingAgent(row) {
      return String((row && (row.agentCanonical || row.agent)) || "").trim();
    }
    function normalizeText(v) {
      return String(v || "").toLowerCase().trim();
    }
    function listingIsClosed(row) {
      if (!row) return false;
      if (row.archived === true || String(row.archived).toLowerCase() === "true") return true;
      var key = normalizeText(row.phaseKey || row.status || row.phase || "");
      return key.indexOf("closed") > -1;
    }
    function resolveCompassListingLink(row) {
      if (!row) return "";
      return String(
        row.compassLink ||
          row.compass_link ||
          row.compassUrl ||
          row.compass_url ||
          row.listingUrl ||
          row.listing_url ||
          ""
      ).trim();
    }
    function isListingLiveForCompass(row) {
      var key = normalizeText((row && (row.status || row.phaseKey || row.phase)) || "");
      return key.indexOf("live") >= 0;
    }
    function formatNextOpenHouseLabel(row) {
      if (!row) return "";
      var d = String(row.nextOpenHouseDate || row.next_open_house_date || "").trim();
      if (!d) return "";
      var start = String(row.nextOpenHouseStart || row.next_open_house_start || "").trim();
      var end = String(row.nextOpenHouseEnd || row.next_open_house_end || "").trim();
      var time = start && end ? start + " – " + end : start || end;
      return time ? d + " · " + time : d;
    }
    function formatListPriceLabel(raw) {
      var s = String(raw || "").replace(/[^0-9.]/g, "");
      if (!s) return "";
      var n = Number(s);
      if (!n || isNaN(n)) return String(raw || "").trim();
      try {
        return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
      } catch (_fmt) {
        return "$" + String(Math.round(n));
      }
    }
    function propertyDetailMissingHtml(note) {
      return '<span class="is-muted">' + esc(note || "Not provided") + "</span>";
    }
    function propertyDetailItem(label, valueHtml) {
      return (
        '<div class="amd-lh-property-item">' +
          '<div class="amd-lh-property-k">' + esc(label) + "</div>" +
          '<div class="amd-lh-property-v">' + valueHtml + "</div>" +
        "</div>"
      );
    }
    function formatListingLongDate(raw) {
      var s = String(raw || "").trim();
      if (!s) return "";
      var d = parseDate(s);
      if (!d || isNaN(d.getTime())) return s;
      try {
        return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
      } catch (e) {
        return d.toDateString();
      }
    }
    function renderListingPropertyOverviewBento(row, specsText) {
      row = row || {};
      var hoodRaw = String(row.neighborhood || "").trim();
      var specsRaw = String(specsText || "").trim();
      var mlsRaw = String(row.mlsNumber || "").trim();
      var price = formatListPriceLabel(row.listPrice);
      var listDateRaw = String(formatListingLongDate(row.listDate) || "").trim();
      var compassLink = resolveCompassListingLink(row);
      var compassVal = compassLink
        ? '<a class="amd-lh-property-link" href="' + esc(compassLink) + '" target="_blank" rel="noopener">View on Compass</a>'
        : propertyDetailMissingHtml("Link not added");
      var rows = [
        propertyDetailItem("Neighborhood", hoodRaw ? esc(hoodRaw) : propertyDetailMissingHtml()),
        propertyDetailItem("Specs", specsRaw ? esc(specsRaw) : propertyDetailMissingHtml("No bed/bath/sqft yet")),
        propertyDetailItem("Compass listing", compassVal),
        propertyDetailItem("List price", price ? esc(price) : propertyDetailMissingHtml()),
        propertyDetailItem("MLS #", mlsRaw ? esc(mlsRaw) : propertyDetailMissingHtml()),
        propertyDetailItem("List date", listDateRaw ? esc(listDateRaw) : propertyDetailMissingHtml())
      ];
      var nextOh = formatNextOpenHouseLabel(row);
      if (nextOh) {
        rows.push(propertyDetailItem("Next open house", esc(nextOh)));
      }
      return (
        '<div class="amd-lh-stat is-property-overview">' +
          '<div class="amd-lh-stat-k">Property details</div>' +
          '<div class="amd-lh-property-grid">' +
          rows.join("") +
          "</div>" +
        "</div>"
      );
    }

    function buildSellCarouselSlideImgHtml(item, addr, className) {
      if (!item || !item.url) return "";
      var cls = "amd-sell-carousel-slide" + (className ? " " + className : "");
      return (
        '<img class="' + cls + '" src="' +
        esc(item.url) +
        '" data-backup="' +
        esc(item.backupUrl || "") +
        '" alt="' +
        esc(item.name || addr || "Listing photo") +
        '" loading="lazy" onerror="if(this.dataset.backup && this.src!==this.dataset.backup){this.src=this.dataset.backup;return;} this.onerror=null;">'
      );
    }
    function buildLhMediaPlaceholder(opts) {
      opts = opts || {};
      var kind = String(opts.kind || "photos-empty");
      var title = esc(opts.title || "No photos yet");
      var subtitle = opts.subtitle ? esc(opts.subtitle) : "";
      var icon = "";
      if (kind === "photos-loading") {
        icon = '<div class="amd-lh-media-ph-spinner" aria-hidden="true"></div>';
      } else if (kind.indexOf("matterport") === 0) {
        icon = '<div class="amd-lh-media-ph-icon is-matterport">' + (BENTO_ICONS.matterport || BENTO_ICONS.cube) + "</div>";
      } else {
        icon = '<div class="amd-lh-media-ph-icon is-photos">' + (BENTO_ICONS.photos || BENTO_ICONS.camera) + "</div>";
      }
      return (
        '<div class="amd-lh-media-placeholder is-' + kind + '" role="status">' +
          icon +
          '<p class="amd-lh-media-ph-title">' + title + "</p>" +
          (subtitle ? '<p class="amd-lh-media-ph-sub">' + subtitle + "</p>" : "") +
        "</div>"
      );
    }
    function getPhotosPlaceholderOpts(isLoading, photoBooked, bookingDateLabelStr, photosEtaLabel, rentalOnly) {
      if (isLoading) {
        return { kind: "photos-loading", title: "Loading photos", subtitle: "Pulling images from the listing folder…" };
      }
      if (photoBooked) {
        var sub = bookingDateLabelStr ? "Booked for " + bookingDateLabelStr : "Your photo shoot is on the calendar.";
        if (photosEtaLabel) sub += (sub ? " · " : "") + "Delivers " + photosEtaLabel;
        return { kind: "photos-booked", title: "Photos on the way", subtitle: sub };
      }
      return {
        kind: "photos-empty",
        title: "No photos yet",
        subtitle: rentalOnly
          ? "Book photos for this lease listing."
          : "Book marketing to schedule photos, Matterport, and video in one session."
      };
    }
    function getMatterportPlaceholderOpts(mpRaw, photoBooked, bookingDateLabelStr, matterportEtaLabel, rentalOnly) {
      if (rentalOnly && !mpRaw) {
        return {
          kind: "matterport-rental-na",
          title: "Not offered on lease listings",
          subtitle: "ASG provides photos only for lease listings. Matterport, floor plans, and video are available on sale listings."
        };
      }
      if (mpRaw) {
        return { kind: "matterport-unavailable", title: "Tour link could not load", subtitle: "A Matterport URL is saved but the embed could not be displayed. Use Open below or update the link to a my.matterport.com show URL." };
      }
      if (photoBooked) {
        var sub = bookingDateLabelStr ? "Booked for " + bookingDateLabelStr : "3D capture is included with your marketing booking.";
        if (matterportEtaLabel) sub += (sub ? " · " : "") + "Delivers " + matterportEtaLabel;
        return { kind: "matterport-booked", title: "3D tour coming soon", subtitle: sub };
      }
      return { kind: "matterport-empty", title: "No 3D tour yet", subtitle: "Book Matterport with your marketing session, or add a tour link on the listing when it is ready." };
    }
    function findListingRowByAddress(address) {
      var addr = String(address || "").trim();
      if (!addr) return null;
      var rows = lhState.rows || [];
      for (var i = 0; i < rows.length; i++) {
        if (String(rows[i].address || "").trim() === addr) return rows[i];
      }
      return null;
    }
    function buildSellCarouselStageHtml(item, addr, placeholderOpts) {
      if (item && item.url) {
        return '<div class="amd-sell-carousel-stage" data-sell-carousel-stage>' + buildSellCarouselSlideImgHtml(item, addr, "is-current") + "</div>";
      }
      return '<div class="amd-sell-carousel-stage" data-sell-carousel-stage>' + buildLhMediaPlaceholder(placeholderOpts) + "</div>";
    }
    function listingSpecsText(row) {
      var specs = [];
      if (row && row.beds) specs.push(String(row.beds) + " bd");
      if (row && row.baths) specs.push(String(row.baths) + " ba");
      if (row && row.sqFt) specs.push(String(row.sqFt) + " sf");
      return specs.join(" · ");
    }
    function listingChipLabels(row) {
      var out = [];
      var phase = listingPhaseLabel(row);
      if (phase && phase !== "—") out.push(phase);
      if (row && row.listingType) out.push(String(row.listingType).trim());
      return out.filter(Boolean);
    }
    // Determine the marketing action-plan completion + which stage the
    // listing-details popup should render. Stage 1 = action plan overlay
    // (questionnaire not sent OR marketing not booked yet). Stage 2 = full
    // marketing status / assets / media bentos visible.
    function getMarketingActionPlanState(row, address) {
      if (!row) row = {};
      var sentRaw = String(row.sellerQuestionnaireSent || row.sellerQuestionnaireSentAt || "").trim();
      var questionnaireSent = !!sentRaw && sentRaw.toLowerCase() !== "false" && sentRaw !== "0";
      var bookingDate = parseListingBookingDate(row);
      var bookedStatus = String(row.photosStatus || "").trim().toLowerCase();
      var bookedByStatus = bookedStatus.indexOf("book") >= 0 || bookedStatus.indexOf("schedul") >= 0;
      var marketingBooked = !!bookingDate || bookedByStatus;
      var hasPhotosLink = hasDeliverableAssetUrl(row.photos);
      var override = lhSellDetail.stageOverride && lhSellDetail.stageOverride[address] === 2;
      var rentalOnly = isRentalOnlyListing(row);
      var bothDone = rentalOnly ? marketingBooked : (questionnaireSent && marketingBooked);
      // Stage 2 if: photos already delivered (link on sheet), both action-plan
      // steps done, or user clicked Continue locally.
      var stage = override || bothDone || hasPhotosLink ? 2 : 1;
      return {
        stage: stage,
        questionnaireSent: questionnaireSent,
        marketingBooked: marketingBooked,
        bookingDate: bookingDate,
        bothDone: bothDone,
        hasPhotosLink: hasPhotosLink
      };
    }
    function parseListingBookingDate(row) {
      var raw = row && (row.photosDatetime || row.photoBookingAt || row.acuityDatetime);
      if (!raw) return null;
      // photosDatetime is typically an ISO string from Acuity. Parse defensively.
      var d = parseDate(raw);
      return d && !isNaN(d.getTime()) ? d : null;
    }
    function formatBookingDate(d) {
      if (!d || isNaN(d.getTime())) return "";
      try {
        return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
      } catch (e) {
        return d.toDateString();
      }
    }
    function formatBookingTime(d) {
      if (!d || isNaN(d.getTime())) return "";
      try {
        return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
      } catch (e) {
        return "";
      }
    }
    function bookingDateLabel(d) {
      var dt = formatBookingDate(d);
      var tm = formatBookingTime(d);
      if (dt && tm) return dt + " · " + tm;
      return dt || tm || "";
    }

    // Stage-1 overlay: Marketing Action Plan checklist (Send Questionnaire +
    // Book Marketing). Sits absolutely over the rest of the detail page.
    function renderMarketingActionPlan(active, address, plan, agentBookUrl, agentRequestUrl, questionnaireLink) {
      var safeAddr = String(address || "").trim();
      var rentalOnly = isRentalOnlyListing(active);
      var qSentLocal = !!(lhSellDetail.qCopied && lhSellDetail.qCopied[safeAddr]);
      var qDone = plan.questionnaireSent || qSentLocal;
      var bookDone = plan.marketingBooked;
      var continueEnabled = rentalOnly ? bookDone : (qDone && bookDone);

      function checkSvg() {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="5 12.5 10 17.5 19 7.5"></polyline></svg>';
      }
      function stepNumNode(done, n) {
        return '<div class="amd-lh-stage-step-num">' + (done ? checkSvg() : String(n)) + "</div>";
      }

      var qCta;
      if (rentalOnly) {
        qCta = '<button type="button" class="amd-lh-stage-step-cta is-secondary" disabled>Not offered</button>';
      } else if (qDone) {
        qCta = '<button type="button" class="amd-lh-stage-step-cta is-done" disabled>' +
          '<span class="amd-cta-check">' + checkSvg() + "</span>Sent</button>";
      } else if (questionnaireLink) {
        qCta = '<button type="button" class="amd-lh-stage-step-cta" data-sell-ap-copy-q="' + esc(safeAddr) + '" data-sell-ap-q-link="' + esc(questionnaireLink) + '">Copy link</button>';
      } else {
        qCta = '<button type="button" class="amd-lh-stage-step-cta is-secondary" data-sell-ap-copy-q="' + esc(safeAddr) + '" title="No questionnaire link wired for this agent yet — admin can add it in AGENT_QUESTIONNAIRE_LINKS.">Mark as sent</button>';
      }

      var bookCta;
      if (bookDone) {
        bookCta = '<button type="button" class="amd-lh-stage-step-cta is-done" disabled>' +
          '<span class="amd-cta-check">' + checkSvg() + "</span>Booked</button>';
      } else if (agentBookUrl) {
        bookCta = '<button type="button" class="amd-lh-stage-step-cta" data-sell-ap-book="' + esc(safeAddr) + '" data-sell-ap-book-url="' + esc(agentBookUrl) + '">' +
          (rentalOnly ? "Book Photos" : "Book Marketing") + "</button>";
      } else if (agentRequestUrl) {
        bookCta = '<a class="amd-lh-stage-step-cta is-secondary" href="' + esc(agentRequestUrl) + '" target="_blank" rel="noopener">Request</a>';
      } else {
        bookCta = '<button type="button" class="amd-lh-stage-step-cta is-secondary" disabled>' +
          (rentalOnly ? "Book Photos" : "Book Marketing") + "</button>";
      }

      var qMeta = rentalOnly
        ? "Seller questionnaire is not used on lease listings."
        : (qDone
            ? "Sent · seller has the questionnaire link."
            : "Copy the seller questionnaire link and send it to your seller.");
      var bookMeta = bookDone
        ? (plan.bookingDate
            ? "Booked for " + esc(bookingDateLabel(plan.bookingDate))
            : "Booking confirmed.")
        : (rentalOnly
            ? "Schedule photos for this lease listing."
            : "Schedule photos, Matterport, floor plan, and video in one session.");

      return (
        '<div class="amd-lh-stage-overlay" data-sell-ap-overlay="' + esc(safeAddr) + '">' +
          '<div class="amd-lh-stage-panel" role="region" aria-label="Marketing Action Plan">' +
            '<h3 class="amd-lh-stage-title">Marketing Action Plan</h3>' +
            '<p class="amd-lh-stage-sub">' + (rentalOnly
              ? "Book photos to unlock the marketing workspace for this lease listing."
              : "Finish these two steps to unlock the full marketing workspace for this listing.") +
            "</p>" +
            '<ol class="amd-lh-stage-steps">' +
              '<li class="amd-lh-stage-step' + (qDone ? " is-done" : "") + (rentalOnly ? " is-rental-na" : "") + '">' +
                stepNumNode(qDone, 1) +
                '<div class="amd-lh-stage-step-body">' +
                  '<div class="amd-lh-stage-step-title">Send Seller Questionnaire</div>' +
                  '<div class="amd-lh-stage-step-meta">' + qMeta + "</div>" +
                "</div>" +
                qCta +
              "</li>" +
              '<li class="amd-lh-stage-step' + (bookDone ? " is-done" : "") + '">' +
                stepNumNode(bookDone, 2) +
                '<div class="amd-lh-stage-step-body">' +
                  '<div class="amd-lh-stage-step-title">Book Marketing</div>' +
                  '<div class="amd-lh-stage-step-meta">' + bookMeta + "</div>" +
                "</div>" +
                bookCta +
              "</li>" +
            "</ol>" +
            '<button type="button" class="amd-lh-stage-continue" data-sell-ap-continue="' + esc(safeAddr) + '"' +
            (continueEnabled ? "" : " disabled") +
            ">Continue</button>" +
          "</div>" +
        "</div>"
      );
    }

    // ── Marketing delivery ETA helpers ─────────────────────────────────────
    // Photos/Matterport: booking + 1 calendar day. Floor plan: +2 business
    // days. Video: +5 business days from filming. Marketing materials: +1
    // business day from when the request is submitted. Per spec we only ever
    // surface the *date*, never the "hours" duration.
    function addCalendarDays(d, n) {
      if (!d || isNaN(d.getTime())) return null;
      var out = new Date(d.getTime());
      out.setDate(out.getDate() + n);
      return out;
    }
    function addBusinessDays(d, n) {
      if (!d || isNaN(d.getTime())) return null;
      var out = new Date(d.getTime());
      var added = 0;
      while (added < n) {
        out.setDate(out.getDate() + 1);
        var dow = out.getDay();
        if (dow !== 0 && dow !== 6) added++;
      }
      return out;
    }
    var SERVICE_DELIVERY_OFFSETS = {
      photos:               { mode: "calendar",  days: 1 },
      matterport:           { mode: "calendar",  days: 1 },
      floor_plan:           { mode: "business",  days: 2 },
      video:                { mode: "business",  days: 5 },
      marketing_materials:  { mode: "business",  days: 1 }
    };
    function computeServiceEta(serviceKey, anchorDate) {
      if (!anchorDate) return null;
      var cfg = SERVICE_DELIVERY_OFFSETS[serviceKey];
      if (!cfg) return null;
      return cfg.mode === "business"
        ? addBusinessDays(anchorDate, cfg.days)
        : addCalendarDays(anchorDate, cfg.days);
    }
    // List of services covered by the marketing booking. When Acuity wires
    // this through (description parsing on the Apps Script side), it will
    // come back as row.servicesBooked = ["photos","matterport",…]. Until
    // then we assume the standard 4-service shoot is booked together.
    var DEFAULT_BOOKED_SERVICES = ["photos", "matterport", "floor_plan", "video"];
    function listingHasService(row, key) {
      if (isRentalOnlyListing(row)) return key === "photos";
      var list = row && row.servicesBooked;
      if (Array.isArray(list) && list.length) {
        for (var i = 0; i < list.length; i++) {
          if (String(list[i]).toLowerCase().replace(/\s+/g, "_") === key) return true;
        }
        return false;
      }
      return DEFAULT_BOOKED_SERVICES.indexOf(key) >= 0;
    }
    // Derive a milestone's display state from sheet fields. Returns one of:
    //   not_booked | booked | editing | delivered
    // (for marketing materials the equivalent enum is not_requested |
    //  requested | building | delivered — we use that nomenclature on the
    //  status label only; the tone/state machine is identical).
    function getCaptureServiceState(row, key) {
      var statusField = {
        photos: "photosStatus",
        matterport: "matterportStatus",
        floor_plan: "floorPlanStatus",
        video: "videoStatus"
      }[key];
      var urlField = {
        photos: "photos",
        matterport: "matterport",
        floor_plan: "floorPlan",
        video: "video"
      }[key];
      var raw = String((row && row[statusField]) || "").trim().toLowerCase();
      var hasAsset = !!String((row && row[urlField]) || "").trim();
      var booked = !!parseListingBookingDate(row) && listingHasService(row, key);
      if (hasAsset || raw.indexOf("deliver") >= 0 || raw.indexOf("done") >= 0 || raw.indexOf("complete") >= 0 || raw.indexOf("ready") >= 0) {
        return "delivered";
      }
      if (raw.indexOf("edit") >= 0 || raw.indexOf("retouch") >= 0 || raw.indexOf("post") >= 0) return "editing";
      if (raw.indexOf("book") >= 0 || raw.indexOf("schedul") >= 0 || booked) return "booked";
      return "not_booked";
    }
    // Returns the *next* (soonest-future) open-house request from a row's
    // marketingRequests JSON array, or null. We sort future requests
    // ascending so an agent with consecutive-weekend OHs sees the closest
    // deadline first. Past requests are ignored except for status rollup.
    function getNextOpenHouseRequest(row) {
      var list = row && row.marketingRequests;
      if (!Array.isArray(list) || !list.length) return null;
      var today = new Date(); today.setHours(0, 0, 0, 0);
      var upcoming = list.filter(function (r) {
        if (!r || !r.open_house_date) return false;
        var d = parseDate(r.open_house_date);
        return d && d >= today;
      });
      if (!upcoming.length) return null;
      upcoming.sort(function (a, b) {
        return String(a.open_house_date).localeCompare(String(b.open_house_date));
      });
      return upcoming[0];
    }
    function getWeekStartDate(refDate) {
      var d = refDate ? new Date(refDate) : new Date();
      if (isNaN(d.getTime())) d = new Date();
      var dow = d.getDay();
      var delta = dow === 0 ? -6 : 1 - dow;
      d.setDate(d.getDate() + delta);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    function isTimestampInCurrentWeek(isoStr) {
      if (!isoStr) return false;
      var t = parseDate(isoStr);
      if (!t) return false;
      var ws = getWeekStartDate();
      var we = new Date(ws.getTime());
      we.setDate(we.getDate() + 7);
      return t >= ws && t < we;
    }
    function marketingRequestIncludesOpenHouse(rec) {
      if (!rec) return false;
      var mats = rec.materials;
      if (Array.isArray(mats)) {
        for (var mi = 0; mi < mats.length; mi++) {
          if (/open\s*house/i.test(String(mats[mi] || ""))) return true;
        }
      }
      var blob = String(rec.notes || "") + " " + String(rec.asana_task_url || "");
      return /open\s*house|broker\s*tour|door\s*hanger|directional/i.test(blob);
    }
    function pickCurrentWeekOpenHouseRequest(row) {
      var list = row && row.marketingRequests;
      if (!Array.isArray(list) || !list.length) return null;
      var best = null;
      var bestAt = "";
      for (var i = 0; i < list.length; i++) {
        var r = list[i] || {};
        if (!marketingRequestIncludesOpenHouse(r)) continue;
        var at = String(r.requested_at || r.open_house_date || "").trim();
        if (!isTimestampInCurrentWeek(at)) continue;
        if (!best || at > bestAt) {
          best = r;
          bestAt = at;
        }
      }
      return best;
    }
    function hasDeliverableAssetUrl(raw) {
      var u = String(raw || "").trim();
      if (!u) return false;
      if (u === "#" || u === "—" || u === "-") return false;
      return /^https?:\/\//i.test(u) || /drive\.google\.com|docs\.google\.com/i.test(u);
    }
    function getFactSheetState(row) {
      if (!row) return "not_requested";
      if (hasDeliverableAssetUrl(row.factSheet)) return "delivered";
      var raw = String(row.factSheetStatus || "").trim().toLowerCase();
      if (raw.indexOf("deliver") >= 0 || raw.indexOf("done") >= 0 || raw.indexOf("complete") >= 0) return "delivered";
      if (raw.indexOf("build") >= 0 || raw.indexOf("progress") >= 0 || raw.indexOf("on it") >= 0) return "building";
      if (raw.indexOf("request") >= 0) return "requested";
      return "not_requested";
    }
    /** Weekly open-house materials: not_requested → requested → building → delivered (resets each Monday). */
    function getOpenHouseMaterialsState(row) {
      if (!row) return "not_requested";
      if (hasDeliverableAssetUrl(row.openHouseMaterialsUrl)) return "delivered";
      var pick = pickCurrentWeekOpenHouseRequest(row);
      if (pick) {
        var ps = String(pick.status || "").trim().toLowerCase();
        if (ps === "delivered") return "delivered";
        if (ps === "building" || ps.indexOf("progress") >= 0 || ps.indexOf("on it") >= 0) return "building";
        return "requested";
      }
      var raw = String(row.openHouseMaterialsStatus || "").trim().toLowerCase();
      var requestedAt = row.openHouseMaterialsRequestedAt || "";
      var deliveredAt = row.openHouseMaterialsDeliveredAt || "";
      if (!isTimestampInCurrentWeek(requestedAt) && !isTimestampInCurrentWeek(deliveredAt)) {
        return "not_requested";
      }
      if (raw.indexOf("deliver") >= 0 || raw.indexOf("done") >= 0 || raw.indexOf("complete") >= 0) return "delivered";
      if (raw.indexOf("build") >= 0 || raw.indexOf("progress") >= 0 || raw.indexOf("on it") >= 0) return "building";
      if (raw.indexOf("request") >= 0) return "requested";
      return "not_requested";
    }
    function getMarketingMaterialsState(row) {
      // Prefer the structured request list when present — its statuses are
      // authoritative since they come from Asana custom fields.
      var list = row && row.marketingRequests;
      if (Array.isArray(list) && list.length) {
        var anyBuilding = false, anyRequested = false, anyUndelivered = false;
        for (var i = 0; i < list.length; i++) {
          var s = String(list[i].status || "").trim().toLowerCase();
          if (s === "delivered") continue;
          anyUndelivered = true;
          if (s === "building" || s === "in progress" || s.indexOf("on it") >= 0) anyBuilding = true;
          else if (s === "requested" || s === "new") anyRequested = true;
        }
        if (!anyUndelivered) return "delivered";
        if (anyBuilding) return "building";
        if (anyRequested) return "requested";
      }
      var raw = String((row && row.marketingStatus) || "").trim().toLowerCase();
      if (raw.indexOf("deliver") >= 0 || raw === "done" || raw.indexOf("complete") >= 0) return "delivered";
      if (raw.indexOf("progress") >= 0 || raw.indexOf("build") >= 0 || raw.indexOf("working") >= 0 || raw.indexOf("on it") >= 0) return "building";
      if (raw && raw.indexOf("not") < 0 && raw !== "n/a" && raw !== "none") return "requested";
      return "not_requested";
    }
    // Tone (drives roadmap dot color) for each state-machine value.
    var SERVICE_STATE_TONE = {
      not_booked:     "pending",
      not_requested:  "pending",
      booked:         "progress",
      requested:      "progress",
      editing:        "waiting",
      building:       "waiting",
      delivered:      "done"
    };
    // Human-readable label for each state, including an optional date.
    function serviceStateLabel(state, dateStr) {
      switch (state) {
        case "not_booked":    return "Not Booked";
        case "not_requested": return "Not Requested";
        case "booked":        return dateStr ? "Booked · " + dateStr : "Booked";
        case "requested":     return dateStr ? "Requested · " + dateStr : "Requested";
        case "editing":       return "Editing";
        case "building":      return "Building";
        case "delivered":     return "Delivered";
        default:              return "Not Booked";
      }
    }

    // Stage-2 "Marketing Status" section: horizontal roadmap of milestones
    // with checkpoints + dates + delivery ETAs. Driven by the Listing Hub
    // sheet (photos_status / photos_datetime / matterport_status / etc.).
    function renderMarketingStatusSection(active, address /*, agentBookUrl, agentRequestUrl */) {
      var rentalOnly = isRentalOnlyListing(active);
      var bookingDate = parseListingBookingDate(active);
      var bookingLabel = bookingDate ? formatBookingDate(bookingDate) : "";
      var sq = getSellerQuestionnaire(active);
      var qSent = !!String(active && (active.sellerQuestionnaireSent || active.sellerQuestionnaireSentAt) || "").trim() ||
                  !!(sq.answers && sq.answers.length) ||
                  !!(lhSellDetail.qCopied && lhSellDetail.qCopied[address]);

      function buildCaptureNode(key, label, icon) {
        if (rentalOnly && RENTAL_EXCLUDED_ROADMAP_KEYS[key]) {
          return {
            key: key,
            label: label,
            icon: icon,
            tone: "pending",
            statusLabel: "Not offered",
            metaLabel: RENTAL_UNAVAILABLE_NOTE,
            rentalNa: true
          };
        }
        var serviceState = getCaptureServiceState(active, key);
        var statusLabel;
        var metaLabel = "";
        if (serviceState === "delivered") {
          statusLabel = "Delivered";
        } else if (serviceState === "editing") {
          statusLabel = "Editing";
          var eta = computeServiceEta(key, bookingDate);
          if (eta) metaLabel = "Ready " + formatBookingDate(eta);
        } else if (serviceState === "booked") {
          statusLabel = bookingLabel ? "Booked · " + bookingLabel : "Booked";
          var etaB = computeServiceEta(key, bookingDate);
          if (etaB) metaLabel = "Delivers " + formatBookingDate(etaB);
        } else {
          statusLabel = "Not Booked";
        }
        return { key: key, label: label, icon: icon, tone: SERVICE_STATE_TONE[serviceState], statusLabel: statusLabel, metaLabel: metaLabel };
      }

      // Marketing Materials: weekly open-house cycle takes priority; fall back
      // to the broader materials rollup (e.g. fact sheet only).
      var matState = getOpenHouseMaterialsState(active);
      if (matState === "not_requested") matState = getMarketingMaterialsState(active);
      var nextReq = getNextOpenHouseRequest(active);
      var matLabel;
      var matMeta = "";
      if (matState === "delivered") {
        matLabel = "Delivered";
      } else if (matState === "building") {
        matLabel = "Marketing is on it";
        var matEta = computeServiceEta("marketing_materials", new Date());
        if (matEta) matMeta = "Ready " + formatBookingDate(matEta);
      } else if (matState === "requested") {
        matLabel = "Requested";
        var matEta2 = computeServiceEta("marketing_materials", new Date());
        if (matEta2) matMeta = "Delivers " + formatBookingDate(matEta2);
      } else {
        matLabel = "Planning an open house?";
        matMeta = "Request materials when you are ready";
      }
      if (nextReq && nextReq.open_house_date) {
        var ohDate = parseDate(nextReq.open_house_date);
        if (ohDate) matMeta = "Open House " + formatBookingDate(ohDate) + (matMeta ? " · " + matMeta : "");
      }

      var nodes = [
        rentalOnly
          ? {
              key: "questionnaire",
              label: "Seller Questionnaire",
              icon: "doc",
              tone: "pending",
              statusLabel: "Not offered",
              metaLabel: RENTAL_UNAVAILABLE_NOTE,
              rentalNa: true
            }
          : {
              key: "questionnaire",
              label: "Seller Questionnaire",
              icon: "doc",
              tone: qSent ? "done" : "pending",
              statusLabel: qSent ? "Sent" : "Pending",
              metaLabel: qSent ? "" : "Awaiting seller"
            },
        buildCaptureNode("photos",     "Photos",     "camera"),
        buildCaptureNode("matterport", "Matterport", "cube"),
        buildCaptureNode("floor_plan", "Floor Plan", "plan"),
        buildCaptureNode("video",      "Video",      "video"),
        {
          key: "marketing_materials",
          label: "Marketing Materials",
          icon: "doc",
          tone: SERVICE_STATE_TONE[matState],
          statusLabel: matLabel,
          metaLabel: matMeta
        }
      ];

      // Progress accumulator → drives the green→blue gradient rail width.
      var doneCount = 0;
      for (var di = 0; di < nodes.length; di++) {
        if (nodes[di].tone === "done") doneCount++;
        else if (nodes[di].tone === "waiting") doneCount += 0.66;
        else if (nodes[di].tone === "progress") doneCount += 0.5;
      }
      // --amd-roadmap-progress is a unitless 0–1 multiplier of the rail width
      // (the CSS handles dot-center offsets via --amd-roadmap-cols).
      var pct = nodes.length ? (doneCount / (nodes.length - 1)) : 0;
      if (pct < 0) pct = 0;
      if (pct > 1) pct = 1;

      function checkSvg() {
        return '<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="5 12.5 10 17.5 19 7.5"></polyline></svg>';
      }
      var nodeHtml = nodes.map(function (n) {
        var inner = n.tone === "done"
          ? checkSvg()
          : (BENTO_ICONS[n.icon] || BENTO_ICONS.doc);
        return (
          '<div class="amd-lh-roadmap-node is-' + esc(n.tone) + (n.rentalNa ? " is-rental-na" : "") + '">' +
            '<div class="amd-lh-roadmap-dot">' + inner + "</div>" +
            '<div class="amd-lh-roadmap-label">' + esc(n.label) + "</div>" +
            '<div class="amd-lh-roadmap-status">' + esc(n.statusLabel) + "</div>" +
            (n.metaLabel ? '<div class="amd-lh-roadmap-meta">' + esc(n.metaLabel) + "</div>" : "") +
          "</div>"
        );
      }).join("");
      return (
        '<article class="amd-lh-card is-marketing is-marketing-status" data-sell-marketing-status="' + esc(address || "") + '">' +
          '<div class="amd-lh-label">Marketing Status</div>' +
          '<div class="amd-lh-roadmap">' +
            '<div class="amd-lh-roadmap-track" style="--amd-roadmap-cols:' + nodes.length + ';--amd-roadmap-progress:' + pct.toFixed(3) + '">' +
              nodeHtml +
            "</div>" +
          "</div>" +
        "</article>"
      );
    }

/* sq */
    function getSellerQuestionnaire(row) {
      if (!row) return { name: "", email: "", phone: "", answers: [], raw: "" };
      var raw = String(row.sellerQuestionnaireContent || row.sellerQuestionnaireAnswers || "").trim();
      var answers = [];
      var name = String(row.sellerName || "").trim();
      var email = String(row.sellerEmail || "").trim();
      var phone = String(row.sellerPhone || "").trim();
      // Try JSON first (preferred): [{question, answer}, ...] or {q:a}.
      if (raw && (raw.charAt(0) === "[" || raw.charAt(0) === "{")) {
        try {
          var parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            for (var i = 0; i < parsed.length; i++) {
              var it = parsed[i] || {};
              var q = String(it.question || it.q || it.label || "").trim();
              var a = String(it.answer || it.a || it.value || "").trim();
              if (q || a) answers.push({ question: q || "Answer", answer: a });
            }
          } else if (typeof parsed === "object") {
            for (var k in parsed) {
              if (!parsed.hasOwnProperty(k)) continue;
              answers.push({ question: k, answer: String(parsed[k] == null ? "" : parsed[k]) });
            }
          }
        } catch (e) {
          // fall through to heuristic parser
        }
      }
      // Heuristic: parse "Question: Answer" style lines (Asana task description).
      if (!answers.length && raw) {
        var lines = raw.split(/\r?\n/);
        var current = null;
        for (var li = 0; li < lines.length; li++) {
          var line = lines[li].replace(/\s+$/, "");
          if (!line.trim()) {
            if (current) answers.push(current);
            current = null;
            continue;
          }
          var m = line.match(/^([^:]{1,80}):\s*(.*)$/);
          if (m) {
            if (current) answers.push(current);
            current = { question: m[1].trim(), answer: m[2].trim() };
          } else if (current) {
            current.answer += (current.answer ? "\n" : "") + line.trim();
          }
        }
        if (current) answers.push(current);
      }
      // Derive seller contact from common question labels if not provided as columns.
      function findAnswer(rgx) {
        for (var i = 0; i < answers.length; i++) {
          if (rgx.test(answers[i].question)) return answers[i].answer;
        }
        return "";
      }
      if (!name) name = findAnswer(/seller.*name|owner.*name|^name$|full.?name/i);
      if (!email) email = findAnswer(/email/i);
      if (!phone) phone = findAnswer(/phone|mobile|cell/i);
      answers = filterQuestionnaireAnswers_(answers);
      var displayRaw = answers.length ? "" : cleanQuestionnaireRawText_(raw);
      return { name: name, email: email, phone: phone, answers: answers, raw: displayRaw || raw };
    }
    function listingPhotosScheduled(row) {
      var v = normalizeText((row && row.photosStatus) || "").trim();
      if (!v) return false;
      // "Not scheduled" / "not yet" / "tbd" all mean we should still prompt to schedule.
      if (v.indexOf("not ") === 0 && v.indexOf("schedul") > -1) return false;
      if (v === "not scheduled" || v === "tbd" || v === "n/a" || v === "none" || v === "—") return false;
      // Any other set status (Scheduled, In Progress, Done, Complete, Delivered,
      // Received, Ready, Live, etc.) means photos work is initiated.
      return true;
    }
    function listingPhotoScheduleLink(row) {
      if (!row) return "#";
      var direct =
        row.photoScheduleUrl ||
        row.photosScheduleUrl ||
        row.acuityUrl ||
        row.schedulingUrl ||
        "";
      var cleaned = String(direct || "").trim();
      if (cleaned) return cleaned;
      return listingDetailPageUrl(row.address || "");
    }
    function makeAgentOptions(rows, selected, includeAllLabel) {
      var counts = {};
      (rows || []).forEach(function (row) {
        var name = normalizeListingAgent(row) || String(row.agent || "").trim() || "Unknown";
        if (!name) return;
        counts[name] = (counts[name] || 0) + 1;
      });
      var names = Object.keys(counts).sort(function (a, b) { return a.localeCompare(b); });
      var html = '<option value="all"' + (selected === "all" ? " selected" : "") + ">" + esc(includeAllLabel || "All Agents") + "</option>";
      for (var i = 0; i < names.length; i++) {
        var nm = names[i];
        html += '<option value="' + esc(nm) + '"' + (selected === nm ? " selected" : "") + ">" + esc(nm) + " · " + counts[nm] + "</option>";
      }
      return html;
    }
    function dealSideKey(v) {
      var s = normalizeText(v);
      if (s.indexOf("buy") > -1) return "buy";
      if (s.indexOf("sell") > -1 || s.indexOf("listing") > -1) return "sell";
      return "other";
    }
    function matchesQuery(textParts, query) {
      var q = normalizeText(query);
      if (!q) return true;
      var hay = textParts.join(" ").toLowerCase();
      return hay.indexOf(q) > -1;
    }
    function toDriveDirectImageUrl(url) {
      var raw = String(url || "").trim();
      if (!raw) return "";
      var id = driveFileIdFromUrl(raw);
      if (id) return "https://lh3.googleusercontent.com/d/" + id + "=w1600";
      return raw;
    }
    function driveFileIdFromUrl(raw) {
      var s = String(raw || "").trim();
      if (!s) return "";
      var m = s.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (m && m[1]) return m[1];
      var q = s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (q && q[1]) return q[1];
      var uc = s.match(/\/uc\?[^#]*[?&]id=([a-zA-Z0-9_-]+)/);
      if (uc && uc[1]) return uc[1];
      return "";
    }
    function driveImageBackupUrl(raw) {
      var id = driveFileIdFromUrl(raw);
      if (!id) return "";
      return "https://drive.google.com/uc?export=view&id=" + id;
    }

/* drive */
    function toDriveDirectImageUrl(url) {
      var raw = String(url || "").trim();
      if (!raw) return "";
      var id = driveFileIdFromUrl(raw);
      if (id) return "https://lh3.googleusercontent.com/d/" + id + "=w1600";
      return raw;
    }
    function driveFileIdFromUrl(raw) {
      var s = String(raw || "").trim();
      if (!s) return "";
      var m = s.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (m && m[1]) return m[1];
      var q = s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (q && q[1]) return q[1];
      var uc = s.match(/\/uc\?[^#]*[?&]id=([a-zA-Z0-9_-]+)/);
      if (uc && uc[1]) return uc[1];
      return "";
    }
    function driveImageBackupUrl(raw) {
      var id = driveFileIdFromUrl(raw);
      if (!id) return "";
      return "https://drive.google.com/uc?export=view&id=" + id;
    }
    function getSellPhotosForAddress(address) {
      var key = String(address || "").trim();
      var cached = lhSellDetail.photoCacheByAddress && lhSellDetail.photoCacheByAddress[key];
      return Array.isArray(cached) ? cached : [];
    }

    /** Updates only the Photos carousel strip so the Matterport iframe is not torn down. */
    function updateSellPhotoCarouselDOM(address, direction) {
      if (!lhWorkspace) return;
      var addr = String(address || "").trim();
      if (!addr) return;
      var carousel = lhWorkspace.querySelector(".amd-sell-detail-page .amd-sell-carousel");
      if (!carousel) return;
      var photos = getSellPhotosForAddress(addr);
      var n = photos.length;
      var idx = Number(lhSellDetail.photoIndexByAddress[addr] || 0);
      if (n) {
        idx = ((idx % n) + n) % n;
        lhSellDetail.photoIndexByAddress[addr] = idx;
      }
      var item = n ? photos[idx] : null;
      var imgWrap = carousel.querySelector(".amd-sell-carousel-img-wrap");
      var countEl = carousel.querySelector(".amd-sell-carousel-count");
      var prevBtn = carousel.querySelector("[data-sell-photo-prev]");
      var nextBtn = carousel.querySelector("[data-sell-photo-next]");
      if (countEl) countEl.textContent = n ? String(idx + 1) + " / " + String(n) : "0 / 0";
      if (prevBtn) prevBtn.disabled = !n || (imgWrap && imgWrap.classList.contains("is-animating"));
      if (nextBtn) nextBtn.disabled = !n || (imgWrap && imgWrap.classList.contains("is-animating"));
      if (!imgWrap) return;
      var loading = lhSellDetail.photoLoadingAddress === addr && !n;
      var dir = Number(direction || 0);
      var stage = imgWrap.querySelector("[data-sell-carousel-stage]");
      var current = stage ? stage.querySelector(".amd-sell-carousel-slide.is-current") : null;

      if (item && item.url && dir && current && stage && !imgWrap.classList.contains("is-animating")) {
        var incoming = document.createElement("img");
        incoming.className = "amd-sell-carousel-slide is-enter-" + (dir > 0 ? "next" : "prev");
        incoming.src = item.url;
        incoming.alt = item.name || addr || "Listing photo";
        incoming.loading = "lazy";
        if (item.backupUrl) incoming.dataset.backup = item.backupUrl;
        incoming.onerror = function () {
          if (this.dataset.backup && this.src !== this.dataset.backup) {
            this.src = this.dataset.backup;
            return;
          }
          this.onerror = null;
        };
        stage.appendChild(incoming);
        imgWrap.classList.add("is-animating");
        if (prevBtn) prevBtn.disabled = true;
        if (nextBtn) nextBtn.disabled = true;
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            incoming.classList.add("is-current");
            incoming.classList.remove("is-enter-next", "is-enter-prev");
            current.classList.remove("is-current");
            current.classList.add(dir > 0 ? "is-exit-prev" : "is-exit-next");
          });
        });
        window.setTimeout(function () {
          if (current && current.parentNode) current.parentNode.removeChild(current);
          imgWrap.classList.remove("is-animating");
          if (prevBtn) prevBtn.disabled = !n;
          if (nextBtn) nextBtn.disabled = !n;
        }, 440);
        return;
      }

      var row = findListingRowByAddress(addr);
      var photoBooked = row && (!!parseListingBookingDate(row) || String(row.photosStatus || "").toLowerCase().indexOf("book") >= 0);
      var bookingDateLabelStr = row ? formatBookingDate(parseListingBookingDate(row)) : "";
      var photosEtaLabel = row ? formatBookingDate(computeServiceEta("photos", parseListingBookingDate(row))) : "";
      var phOpts = getPhotosPlaceholderOpts(loading, photoBooked, bookingDateLabelStr, photosEtaLabel);
      imgWrap.classList.remove("is-animating");
      imgWrap.innerHTML = buildSellCarouselStageHtml(item, addr, phOpts);
    }
    function normalizePhotoItems(items) {
      var arr = Array.isArray(items) ? items : [];
      var out = [];
      for (var i = 0; i < arr.length; i++) {
        var it = arr[i] || {};
        var u = toDriveDirectImageUrl(String(it.viewUrl || it.url || it.src || "").trim());
        if (!u) continue;
        out.push({ url: u, backupUrl: driveImageBackupUrl(it.viewUrl || it.url || it.src || ""), name: String(it.name || "Photo " + (i + 1)).trim() });
      }
      return out;
    }
    function matterportEmbedUrl(rawUrl) {
      var raw = String(rawUrl || "").trim();
      if (!raw) return "";
      if (raw.indexOf("my.matterport.com/show/?m=") >= 0 || raw.indexOf("matterport.com/discover/space/") >= 0) {
        return raw.replace(/^http:/, "https:");
      }
      var m = raw.match(/m=([a-zA-Z0-9_-]+)/);
      if (m && m[1]) return "https://my.matterport.com/show/?m=" + m[1];
      var s = raw.match(/spaces\/([a-zA-Z0-9_-]+)/);
      if (s && s[1]) return "https://my.matterport.com/show/?m=" + s[1];
      return "";
    }

/* photos */
    function getSellPhotosForAddress(address) {
      var key = String(address || "").trim();
      var cached = lhSellDetail.photoCacheByAddress && lhSellDetail.photoCacheByAddress[key];
      return Array.isArray(cached) ? cached : [];
    }

    /** Updates only the Photos carousel strip so the Matterport iframe is not torn down. */
    function updateSellPhotoCarouselDOM(address, direction) {
      if (!lhWorkspace) return;
      var addr = String(address || "").trim();
      if (!addr) return;
      var carousel = lhWorkspace.querySelector(".amd-sell-detail-page .amd-sell-carousel");
      if (!carousel) return;
      var photos = getSellPhotosForAddress(addr);
      var n = photos.length;
      var idx = Number(lhSellDetail.photoIndexByAddress[addr] || 0);
      if (n) {
        idx = ((idx % n) + n) % n;
        lhSellDetail.photoIndexByAddress[addr] = idx;
      }
      var item = n ? photos[idx] : null;
      var imgWrap = carousel.querySelector(".amd-sell-carousel-img-wrap");
      var countEl = carousel.querySelector(".amd-sell-carousel-count");
      var prevBtn = carousel.querySelector("[data-sell-photo-prev]");
      var nextBtn = carousel.querySelector("[data-sell-photo-next]");
      if (countEl) countEl.textContent = n ? String(idx + 1) + " / " + String(n) : "0 / 0";
      if (prevBtn) prevBtn.disabled = !n || (imgWrap && imgWrap.classList.contains("is-animating"));
      if (nextBtn) nextBtn.disabled = !n || (imgWrap && imgWrap.classList.contains("is-animating"));
      if (!imgWrap) return;
      var loading = lhSellDetail.photoLoadingAddress === addr && !n;
      var dir = Number(direction || 0);
      var stage = imgWrap.querySelector("[data-sell-carousel-stage]");
      var current = stage ? stage.querySelector(".amd-sell-carousel-slide.is-current") : null;

      if (item && item.url && dir && current && stage && !imgWrap.classList.contains("is-animating")) {
        var incoming = document.createElement("img");
        incoming.className = "amd-sell-carousel-slide is-enter-" + (dir > 0 ? "next" : "prev");
        incoming.src = item.url;
        incoming.alt = item.name || addr || "Listing photo";
        incoming.loading = "lazy";
        if (item.backupUrl) incoming.dataset.backup = item.backupUrl;
        incoming.onerror = function () {
          if (this.dataset.backup && this.src !== this.dataset.backup) {
            this.src = this.dataset.backup;
            return;
          }
          this.onerror = null;
        };
        stage.appendChild(incoming);
        imgWrap.classList.add("is-animating");
        if (prevBtn) prevBtn.disabled = true;
        if (nextBtn) nextBtn.disabled = true;
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            incoming.classList.add("is-current");
            incoming.classList.remove("is-enter-next", "is-enter-prev");
            current.classList.remove("is-current");
            current.classList.add(dir > 0 ? "is-exit-prev" : "is-exit-next");
          });
        });
        window.setTimeout(function () {
          if (current && current.parentNode) current.parentNode.removeChild(current);
          imgWrap.classList.remove("is-animating");
          if (prevBtn) prevBtn.disabled = !n;
          if (nextBtn) nextBtn.disabled = !n;
        }, 440);
        return;
      }

      var row = findListingRowByAddress(addr);
      var photoBooked = row && (!!parseListingBookingDate(row) || String(row.photosStatus || "").toLowerCase().indexOf("book") >= 0);
      var bookingDateLabelStr = row ? formatBookingDate(parseListingBookingDate(row)) : "";
      var photosEtaLabel = row ? formatBookingDate(computeServiceEta("photos", parseListingBookingDate(row))) : "";
      var phOpts = getPhotosPlaceholderOpts(loading, photoBooked, bookingDateLabelStr, photosEtaLabel);
      imgWrap.classList.remove("is-animating");
      imgWrap.innerHTML = buildSellCarouselStageHtml(item, addr, phOpts);
    }
    function normalizePhotoItems(items) {
      var arr = Array.isArray(items) ? items : [];
      var out = [];
      for (var i = 0; i < arr.length; i++) {
        var it = arr[i] || {};
        var u = toDriveDirectImageUrl(String(it.viewUrl || it.url || it.src || "").trim());
        if (!u) continue;
        out.push({ url: u, backupUrl: driveImageBackupUrl(it.viewUrl || it.url || it.src || ""), name: String(it.name || "Photo " + (i + 1)).trim() });
      }
      return out;
    }
    function matterportEmbedUrl(rawUrl) {
      var raw = String(rawUrl || "").trim();
      if (!raw) return "";
      if (raw.indexOf("my.matterport.com/show/?m=") >= 0 || raw.indexOf("matterport.com/discover/space/") >= 0) {
        return raw.replace(/^http:/, "https:");
      }
      var m = raw.match(/m=([a-zA-Z0-9_-]+)/);
      if (m && m[1]) return "https://my.matterport.com/show/?m=" + m[1];
      var s = raw.match(/spaces\/([a-zA-Z0-9_-]+)/);
      if (s && s[1]) return "https://my.matterport.com/show/?m=" + s[1];
      return "";
    }
    function fetchSellPhotosForAddress(address) {
      var key = String(address || "").trim();
      if (!key) return;
      if (lhSellDetail.photoLoadingAddress === key) return;
      if (getSellPhotosForAddress(key).length) return;
      lhSellDetail.photoLoadingAddress = key;
      fetchJSON(appendApiQuery(LISTINGS_API, "view=listingphotos&address=" + encodeURIComponent(key)))
        .then(function (payload) {
          var photos = normalizePhotoItems(payload && payload.photos);
          lhSellDetail.photoCacheByAddress[key] = photos;
          if (lhSellDetail.photoIndexByAddress[key] == null) lhSellDetail.photoIndexByAddress[key] = 0;
          lhSellDetail.photoLoadingAddress = "";
          if (lhState.activeAddress === key) {
            updateSellPhotoCarouselDOM(key);
          } else {
            renderListingsHub();
          }
        })
        .catch(function () {
          lhSellDetail.photoCacheByAddress[key] = [];
          lhSellDetail.photoLoadingAddress = "";
          if (lhState.activeAddress === key) {
            updateSellPhotoCarouselDOM(key);
          } else {
            renderListingsHub();
          }
        });
    }

    function extractListingsRows(payload) {
      if (!payload || typeof payload !== "object") return [];
      if (Array.isArray(payload.listings)) return payload.listings.slice();
      if (payload.data && Array.isArray(payload.data.listings)) return payload.data.listings.slice();
      if (Array.isArray(payload.rows)) return payload.rows.slice();
      if (payload.data && Array.isArray(payload.data.rows)) return payload.data.rows.slice();
      return [];
    }
    function appendApiQuery(url, query) {
      return String(url || "") + (String(url || "").indexOf("?") >= 0 ? "&" : "?") + query;
    }
    function uniqueListingRows(rows) {
      var seen = {};
      var out = [];
      for (var i = 0; i < (rows || []).length; i++) {
        var row = rows[i] || {};
        var key = normalizeText(row.address || "") + "|" + normalizeText(normalizeListingAgent(row) || "");
        if (!key || key === "|") continue;
        if (seen[key]) continue;
        seen[key] = true;
        out.push(row);
      }
      return out;
    }
    function fetchJSON(url) {
      return fetch(url, { method: "GET", cache: "no-store" }).then(function (r) {
        if (!r.ok) throw new Error("Request failed");
        return r.json();
      });
    }

/* sq2 */
    function isQuestionnaireBoilerplateLine_(line) {
      var s = String(line || "").trim().toLowerCase();
      if (!s) return true;
      if (s.indexOf("this task was submitted through") >= 0) return true;
      if (s === "seller questionnaire") return true;
      return false;
    }
    function filterQuestionnaireAnswers_(answers) {
      return (answers || []).filter(function (a) {
        if (!a) return false;
        var q = String(a.question || "").trim();
        var ans = String(a.answer || "").trim();
        if (!q && !ans) return false;
        if (isQuestionnaireBoilerplateLine_(q) && !ans) return false;
        if (isQuestionnaireBoilerplateLine_(ans)) return false;
        return true;
      });
    }
    function cleanQuestionnaireRawText_(raw) {
      if (!raw) return "";
      return raw
        .split(/\r?\n/)
        .filter(function (line) {
          return !isQuestionnaireBoilerplateLine_(line);
        })
        .join("\n")
        .trim();
    }
    function hasSellerQuestionnaireDetails(row, sq) {
      if (!row) return false;
      sq = sq || getSellerQuestionnaire(row);
      if (sq.answers && sq.answers.length) return true;
      if (sq.raw) return true;
      if (String(row.sellerQuestionnaireContent || row.sellerQuestionnaireAnswers || "").trim()) return true;
      var sent = String(
        row.sellerQuestionnaireSent ||
          row.sellerQuestionnaireSentAt ||
          row.sellerQuestionnaireReceivedAt ||
          ""
      ).trim();
      if (sent && sent.toLowerCase() !== "false" && sent !== "0") return true;
      return !!(sq.name && (sq.email || sq.phone));
    }
    function buildSellerQuestionnaireContactHtml(sq) {
      if (!sq || (!sq.name && !sq.email && !sq.phone)) return "";
      var meta = [];
      if (sq.email) meta.push(esc(sq.email));
      if (sq.phone) meta.push(esc(sq.phone));
      return (
        '<div class="amd-sq-contact">' +
        (sq.name ? '<div class="amd-sq-contact-name">' + esc(sq.name) + "</div>" : "") +
        (meta.length ? '<div class="amd-sq-contact-meta">' + meta.join(" · ") + "</div>" : "") +
        "</div>"
      );
    }
    function openLhSellerQuestionnaireModal(address) {
      closeLhSellerQuestionnaireModal();
      var row = null;
      var rows = lhState.rows || [];
      for (var i = 0; i < rows.length; i++) {
        if (String(rows[i].address || "").trim() === address) { row = rows[i]; break; }
      }
      var sq = getSellerQuestionnaire(row || {});
      var contactHtml = buildSellerQuestionnaireContactHtml(sq);
      var bodyHtml;
      if (sq.answers && sq.answers.length) {
        bodyHtml =
          contactHtml +
          '<div class="amd-sq-qa">' +
          sq.answers
            .map(function (a) {
              return (
                '<div class="amd-sq-qa-item">' +
                '<div class="amd-sq-qa-q">' +
                esc(a.question || "") +
                "</div>" +
                '<div class="amd-sq-qa-a">' +
                esc(a.answer || "") +
                "</div>" +
                "</div>"
              );
            })
            .join("") +
          "</div>";
      } else if (sq.raw) {
        bodyHtml = contactHtml + '<div class="amd-sq-raw">' + esc(sq.raw) + "</div>";
      } else if (contactHtml) {
        bodyHtml =
          contactHtml +
          '<div class="amd-sq-empty">Seller contact is on file. Run Asana sync to pull full questionnaire answers.</div>';
      } else {
        bodyHtml = '<div class="amd-sq-empty">No questionnaire answers have been received yet.</div>';
      }

      var overlay = document.createElement("div");
      overlay.className = "amd-sq-modal";
      overlay.id = "amdSqModal";
      overlay.innerHTML =
        '<div class="amd-sq-card" role="dialog" aria-modal="true" aria-labelledby="amdSqTitle">' +
          '<div class="amd-sq-head">' +
            "<div>" +
              '<h3 class="amd-sq-title" id="amdSqTitle">Seller Questionnaire</h3>' +
              '<p class="amd-sq-sub">' + esc(address || "") + "</p>" +
            "</div>" +
            '<button class="amd-sq-close" type="button" aria-label="Close" data-sq-close="1">' +
              '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
            "</button>" +
          "</div>" +
          '<div class="amd-sq-body">' + bodyHtml + "</div>" +
        "</div>";
      overlay.addEventListener("click", function (evt) {
        if (evt.target === overlay) closeLhSellerQuestionnaireModal();
      });
      var closeBtn = overlay.querySelector("[data-sq-close]");
      if (closeBtn) closeBtn.addEventListener("click", closeLhSellerQuestionnaireModal);
      var mount = lhWorkspace || document.body;
      mount.appendChild(overlay);
      document.addEventListener("keydown", sqEscHandler);
    }
    function closeLhSellerQuestionnaireModal() {
      var existing = document.getElementById("amdSqModal");
      if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
      document.removeEventListener("keydown", sqEscHandler);
    }
    function sqEscHandler(evt) {
      if (evt && evt.key === "Escape") closeLhSellerQuestionnaireModal();
    }

    // Resolve a single milestone's status using {URL present → Done,
    // explicit status field, sane fallback}. Returns { label, tone } where
    // tone drives the pill color (done/progress/waiting/pending).
    function resolveMilestoneStatus(rawStatus, hasUrl, fallbackTone) {
      if (hasUrl) return { label: "Done", tone: "done" };
      var raw = String(rawStatus || "").trim();
      if (!raw) return { label: "Not Started", tone: fallbackTone || "pending" };
      var key = raw.toLowerCase();
      if (
        key === "not started" ||
        key === "not scheduled" ||
        key === "n/a" ||
        key === "none" ||
        key === "tbd" ||
        key === "—" ||
        key === "-"
      ) {
        return { label: "Not Started", tone: fallbackTone || "pending" };
      }
      if (
        key.indexOf("done") >= 0 ||
        key.indexOf("complete") >= 0 ||
        key.indexOf("delivered") >= 0 ||
        key.indexOf("received") >= 0 ||
        key.indexOf("ready") >= 0 ||
        key.indexOf("live") >= 0
      ) {
        return { label: titleCase(raw), tone: "done" };
      }
      if (key.indexOf("progress") >= 0 || key.indexOf("scheduled") >= 0 || key.indexOf("booked") >= 0) {
        return { label: titleCase(raw), tone: "progress" };
      }
      if (key.indexOf("request") >= 0 || key.indexOf("pending") >= 0 || key.indexOf("waiting") >= 0) {
        return { label: titleCase(raw), tone: "waiting" };
      }
      return { label: titleCase(raw), tone: fallbackTone || "pending" };
    }
    function titleCase(s) {
      return String(s || "")
        .replace(/[_\-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b\w/g, function (c) { return c.toUpperCase(); });
    }
    // Read the seller-questionnaire blob from the listing row. The Apps Script
    // sweep stuffs the Asana task description into seller_questionnaire_content;
    // we also support a structured seller_questionnaire_answers JSON column if
    // an integration provides one.

function buildLhSellDetailBodyHtml(active,address){
  if(!active)active={address:address};
  address=String(address||active.address||"").trim();
  lhState.activeAddress=address;
            if (!active) active = { address: lhState.activeAddress };
            var slidePhotos = getSellPhotosForAddress(lhState.activeAddress);
            var isSlideLoading = lhSellDetail.photoLoadingAddress === lhState.activeAddress;
            var slideIdx = Number(lhSellDetail.photoIndexByAddress[lhState.activeAddress] || 0);
            if (slidePhotos.length) {
              slideIdx = ((slideIdx % slidePhotos.length) + slidePhotos.length) % slidePhotos.length;
              lhSellDetail.photoIndexByAddress[lhState.activeAddress] = slideIdx;
            } else {
              slideIdx = 0;
            }
            var slideItem = slidePhotos.length ? slidePhotos[slideIdx] : null;
            var assetRows = [
              ["Photos", active.photos],
              ["Matterport", active.matterport],
              ["Video", active.video],
              ["Floor Plan", active.floorPlan],
              ["Fact Sheet", active.factSheet],
              ["Open House Materials", active.openHouseMaterialsUrl]
            ];
            var mpRaw = String(active.matterport || "").trim();
            var mpEmbed = matterportEmbedUrl(mpRaw);
            var specsText = listingSpecsText(active);
            var detailChips = listingChipLabels(active);
            var activeAgentName = normalizeListingAgent(active) || active.agent || "—";
            var agentPhoto = resolveLhAgentPhoto(activeAgentName);
            var agentLinks = resolveAgentLinks(activeAgentName) || { book: "", request: "" };
            var agentBookUrl = String(agentLinks.book || "").trim();
            var agentRequestUrl = String(agentLinks.request || "").trim();
            var photosAssetUrl = String(active.photos || "").trim();
            var agentFirstName = String(activeAgentName || "").split(" ")[0] || "";
            return (
              '<div class="amd-panel-head amd-panel-head--listing">' +
                '<h3 class="amd-panel-title amd-panel-title--listing">' + esc(lhState.activeAddress) + '</h3>' +
                '<div class="amd-sell-overlay-actions"><button class="amd-sell-overlay-x" type="button" data-sell-close="1" aria-label="Close">' +
                  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
                '</button></div>' +
              "</div>" +
              '<div class="amd-sell-detail-page">' +
                '<section class="amd-lh-status">' +
                  '<div class="amd-lh-label">Listing Overview</div>' +
                  '<div class="amd-lh-overview">' +
                    '<div class="amd-lh-agent">' +
                      (agentPhoto
                        ? '<img class="amd-lh-agent-photo" src="' + esc(agentPhoto) + '" alt="' + esc(activeAgentName) + '" loading="lazy">'
                        : '<div class="amd-lh-agent-photo" aria-hidden="true"></div>') +
                      '<div><div class="amd-lh-agent-name">' + esc(activeAgentName) + '</div><div class="amd-lh-agent-role">Listing Agent</div></div>' +
                    "</div>" +
                    renderListingEditChips(active) +
                  "</div>" +
                  (function () {
                    var rentalOnly = isRentalOnlyListing(active);
                    var sq = getSellerQuestionnaire(active);
                    var qLink = resolveAgentQuestionnaireLink(activeAgentName);
                    var sellerLine = rentalOnly
                      ? '<span style="color:rgba(60,60,67,0.6);font-weight:500;">Not offered on lease listings</span>'
                      : (sq.name
                          ? esc(sq.name)
                          : '<span style="color:rgba(60,60,67,0.6);font-weight:500;">No seller contact yet</span>');
                    var metaBits = [];
                    if (!rentalOnly && sq.email) metaBits.push(esc(sq.email));
                    if (!rentalOnly && sq.phone) metaBits.push(esc(sq.phone));
                    var metaHtml = rentalOnly
                      ? '<div class="amd-lh-stat-meta">' + esc(RENTAL_UNAVAILABLE_NOTE) + "</div>"
                      : (metaBits.length
                          ? '<div class="amd-lh-stat-meta">' + metaBits.join(" · ") + "</div>"
                          : '<div class="amd-lh-stat-meta">' +
                            (sq.raw ? "Questionnaire on file" : "Seller questionnaire not received yet.") +
                            "</div>");
                    var actions = [];
                    if (!rentalOnly && qLink) {
                      var copiedClass = (lhSellDetail.qCopied && lhSellDetail.qCopied[lhState.activeAddress]) ? " is-copied" : "";
                      actions.push(
                        '<button class="amd-lh-stat-action is-secondary is-icon' + copiedClass + '" type="button"' +
                        ' data-sell-copy-questionnaire="' + esc(lhState.activeAddress) + '"' +
                        ' data-sell-copy-questionnaire-link="' + esc(qLink) + '"' +
                        ' aria-label="Copy seller questionnaire link">' +
                          '<svg class="amd-cta-copy" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>' +
                          '<svg class="amd-cta-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="5 12.5 10 17.5 19 7.5"/></svg>' +
                          "<span>Copy link</span>" +
                        "</button>"
                      );
                    }
                    if (!rentalOnly && hasSellerQuestionnaireDetails(active, sq)) {
                      actions.push('<button class="amd-lh-stat-action" type="button" data-sell-open-sq="' + esc(lhState.activeAddress) + '">More details</button>');
                    }
                    var actionsHtml = actions.length
                      ? '<div class="amd-lh-stat-actions">' + actions.join("") + "</div>"
                      : "";
                    return (
                      '<div class="amd-lh-status-grid">' +
                        renderListingPropertyOverviewBento(active, specsText) +
                        '<div class="amd-lh-stat is-seller' + (rentalOnly ? " is-rental-na" : "") + '">' +
                          '<div class="amd-lh-stat-k">Seller Questionnaire</div>' +
                          '<div class="amd-lh-stat-v">' + sellerLine + "</div>" +
                          metaHtml +
                          '<div class="amd-lh-stat-body-spacer" aria-hidden="true"></div>' +
                          actionsHtml +
                        "</div>" +
                      "</div>"
                    );
                  })() +
                "</section>" +
                (function () {
                  var rentalOnly = isRentalOnlyListing(active);
                  var plan = getMarketingActionPlanState(active, lhState.activeAddress);
                  var questionnaireLink = resolveAgentQuestionnaireLink(activeAgentName);
                  var photoBooked = !!parseListingBookingDate(active) ||
                    String(active.photosStatus || "").toLowerCase().indexOf("book") >= 0;
                  var bookingDateLabelStr = formatBookingDate(parseListingBookingDate(active));
                  var photosEtaLabel = formatBookingDate(computeServiceEta("photos", parseListingBookingDate(active)));
                  var matterportEtaLabel = formatBookingDate(computeServiceEta("matterport", parseListingBookingDate(active)));
  
                  var photosPhOpts = getPhotosPlaceholderOpts(isSlideLoading, photoBooked, bookingDateLabelStr, photosEtaLabel, rentalOnly);
                  var matterportPhOpts = getMatterportPlaceholderOpts(mpRaw, photoBooked, bookingDateLabelStr, matterportEtaLabel, rentalOnly);
                  var matterportFootLinks;
                  if (rentalOnly) {
                    matterportFootLinks = '<span class="amd-mini-btn is-off">Not offered on lease listings</span>';
                  } else if (mpRaw && !mpEmbed) {
                    matterportFootLinks =
                      '<button class="amd-mini-btn" type="button" data-sell-copy-mp="' + esc(mpRaw) + '">Copy link</button>' +
                      '<a class="amd-mini-btn is-dark" href="' + esc(mpRaw) + '" target="_blank" rel="noopener">Open tour</a>';
                  } else if (photoBooked) {
                    matterportFootLinks = '<span class="amd-mini-btn is-off">Awaiting delivery</span>';
                  } else if (agentBookUrl) {
                    matterportFootLinks =
                      '<button type="button" class="amd-mini-btn is-dark" data-sell-milestone-action="matterport" data-sell-milestone-mode="book" data-sell-milestone-url="' + esc(agentBookUrl) + '" data-sell-milestone-address="' + esc(lhState.activeAddress) + '">Book Matterport</button>';
                  } else if (agentRequestUrl) {
                    matterportFootLinks = '<a class="amd-mini-btn" href="' + esc(agentRequestUrl) + '" target="_blank" rel="noopener">Request Matterport</a>';
                  } else {
                    matterportFootLinks = '<span class="amd-mini-btn is-off">Book Matterport</span>';
                  }
                  var matterportFootHtml =
                    '<div class="amd-lh-media-foot">' +
                      '<div class="amd-sell-links">' + matterportFootLinks + "</div>" +
                      '<div class="amd-lh-media-meta">3D tour</div>' +
                    "</div>";
  
                  var marketingStatusHtml = renderMarketingStatusSection(active, lhState.activeAddress, agentBookUrl, agentRequestUrl);
                  var marketingAssetsHtml =
                    '<article class="amd-lh-card is-marketing">' +
                      '<div class="amd-lh-label">Marketing Assets</div>' +
                      '<div class="amd-lh-fill">' +
                      '<div class="amd-lh-assets-grid">' +
                        assetRows
                          .map(function (a) {
                            var label = a[0];
                            var href = String(a[1] || "").trim();
                            var hasHref = !!href;
                            var rentalExcluded = rentalOnly && isRentalExcludedAssetLabel(label);
                            var action = MARKETING_ASSET_ACTION[label] || "request";
                            var fallbackUrl = action === "book" ? agentBookUrl : agentRequestUrl;
                            var fallbackLabel = action === "book" ? "Book →" : "Request →";
                            var serviceKey = MARKETING_ASSET_SERVICE_KEY[label];
                            var ohState = label === "Open House Materials" ? getOpenHouseMaterialsState(active) : "";
                            var btnHtml;
                            if (rentalExcluded) {
                              btnHtml = '<span class="amd-lh-asset-btn is-off">Not offered</span>';
                            } else if (label === "Photos") {
                              if (hasHref) {
                                btnHtml = '<a class="amd-lh-asset-btn" href="' + esc(href) + '" target="_blank" rel="noopener">Open Asset ↗</a>';
                              } else if (slidePhotos.length) {
                                btnHtml =
                                  '<button type="button" class="amd-lh-asset-btn" data-sell-photo-download-all="' +
                                  esc(lhState.activeAddress) +
                                  '">Open Asset ↗</button>';
                              } else if (fallbackUrl) {
                                btnHtml =
                                  '<a class="amd-lh-asset-btn is-request" href="' +
                                  esc(fallbackUrl) +
                                  '" target="_blank" rel="noopener">Book →</a>';
                              } else {
                                btnHtml = '<span class="amd-lh-asset-btn is-off">Missing</span>';
                              }
                            } else if (hasHref) {
                              btnHtml = '<a class="amd-lh-asset-btn" href="' + esc(href) + '" target="_blank" rel="noopener">Open Asset ↗</a>';
                            } else if (label === "Open House Materials" && fallbackUrl) {
                              if (ohState === "not_requested") {
                                btnHtml =
                                  '<button type="button" class="amd-lh-asset-btn is-request" data-sell-oh-request="' +
                                  esc(lhState.activeAddress) +
                                  '" data-sell-oh-request-url="' +
                                  esc(fallbackUrl) +
                                  '">Request →</button>';
                              } else {
                                var ohPick = pickCurrentWeekOpenHouseRequest(active);
                                var ohTaskUrl = (ohPick && ohPick.asana_task_url) ? ohPick.asana_task_url : fallbackUrl;
                                btnHtml =
                                  '<a class="amd-lh-asset-btn is-request" href="' +
                                  esc(ohTaskUrl) +
                                  '" target="_blank" rel="noopener">View in Asana ↗</a>';
                              }
                            } else if (fallbackUrl) {
                              btnHtml = '<a class="amd-lh-asset-btn is-request" href="' + esc(fallbackUrl) + '" target="_blank" rel="noopener" title="' + (action === "book" ? "Book service" : "Submit a request") + ' for ' + esc(agentFirstName || activeAgentName) + '">' + fallbackLabel + "</a>";
                            } else {
                              btnHtml = '<a class="amd-lh-asset-btn is-off" href="#" target="_blank" rel="noopener">Missing</a>';
                            }
                            var iconKind = MARKETING_ASSET_ICONS[label] || "doc";
                            var iconSvg = BENTO_ICONS[iconKind] || BENTO_ICONS.doc;
                            var assetMetaHtml = "";
                            if (rentalExcluded) {
                              assetMetaHtml =
                                '<div class="amd-lh-asset-meta is-rental-na">' +
                                  '<span class="amd-lh-asset-sub">' + esc(RENTAL_UNAVAILABLE_NOTE) + "</span>" +
                                "</div>";
                            } else if (serviceKey) {
                              var bookingForEta = parseListingBookingDate(active);
                              var assetState, assetStatusLabel, assetSubLabel = "", assetEtaLabel = "";
                              if (serviceKey === "open_house_materials") {
                                assetState = ohState || getOpenHouseMaterialsState(active);
                                if (assetState === "delivered") {
                                  assetStatusLabel = "Delivered";
                                } else if (assetState === "building") {
                                  assetStatusLabel = "Marketing is on it";
                                  assetEtaLabel = formatBookingDate(computeServiceEta("marketing_materials", new Date()));
                                } else if (assetState === "requested") {
                                  assetStatusLabel = "Requested";
                                  assetEtaLabel = formatBookingDate(computeServiceEta("marketing_materials", new Date()));
                                } else {
                                  assetStatusLabel = "Planning an open house?";
                                  assetSubLabel = "Request now";
                                }
                              } else if (serviceKey === "fact_sheet") {
                                assetState = getFactSheetState(active);
                                if (assetState === "delivered") {
                                  assetStatusLabel = "Delivered";
                                } else if (assetState === "building") {
                                  assetStatusLabel = "Marketing is on it";
                                  assetEtaLabel = formatBookingDate(computeServiceEta("marketing_materials", new Date()));
                                } else if (assetState === "requested") {
                                  assetStatusLabel = "Requested";
                                  assetEtaLabel = formatBookingDate(computeServiceEta("marketing_materials", new Date()));
                                } else {
                                  assetStatusLabel = "Not Requested";
                                }
                              } else if (serviceKey === "marketing_materials") {
                                assetState = getMarketingMaterialsState(active);
                                if (assetState === "delivered") {
                                  assetStatusLabel = "Delivered";
                                } else if (assetState === "building") {
                                  assetStatusLabel = "Marketing is on it";
                                  assetEtaLabel = formatBookingDate(computeServiceEta("marketing_materials", new Date()));
                                } else if (assetState === "requested") {
                                  assetStatusLabel = "Requested";
                                  assetEtaLabel = formatBookingDate(computeServiceEta("marketing_materials", new Date()));
                                } else {
                                  assetStatusLabel = "Not Requested";
                                }
                              } else {
                                assetState = getCaptureServiceState(active, serviceKey);
                                if (assetState === "delivered") {
                                  assetStatusLabel = "Delivered";
                                } else if (assetState === "editing") {
                                  assetStatusLabel = "Editing";
                                  assetEtaLabel = formatBookingDate(computeServiceEta(serviceKey, bookingForEta));
                                } else if (assetState === "booked") {
                                  assetStatusLabel = bookingForEta
                                    ? "Booked · " + formatBookingDate(bookingForEta)
                                    : "Booked";
                                  assetEtaLabel = formatBookingDate(computeServiceEta(serviceKey, bookingForEta));
                                } else {
                                  assetStatusLabel = "Not Booked";
                                }
                              }
                              var assetTone = SERVICE_STATE_TONE[assetState] || "pending";
                              assetMetaHtml =
                                '<div class="amd-lh-asset-meta is-' + esc(assetTone) + '">' +
                                  '<span class="amd-lh-asset-status">' + esc(assetStatusLabel) + "</span>" +
                                  (assetSubLabel ? '<span class="amd-lh-asset-sub">' + esc(assetSubLabel) + "</span>" : "") +
                                  (assetEtaLabel ? "Delivers " + esc(assetEtaLabel) : "") +
                                "</div>";
                            }
                            return '<div class="amd-lh-asset' + (rentalExcluded ? " is-rental-na" : "") + '">' +
                              '<div class="amd-lh-asset-head">' +
                              '<span class="amd-lh-asset-ico is-' + iconKind + '">' + iconSvg + "</span>" +
                              '<div class="amd-lh-asset-title">' + esc(label) + "</div>" +
                              "</div>" +
                              assetMetaHtml +
                              btnHtml +
                              "</div>";
                          })
                          .join("") +
                      "</div>" +
                      "</div>" +
                    "</article>";
                  var photosCardHtml =
                    '<article class="amd-lh-card">' +
                      '<div class="amd-lh-label"><span class="amd-lh-ico is-photos">' + BENTO_ICONS.photos + '</span>Photos</div>' +
                      '<div class="amd-lh-fill">' +
                      '<div class="amd-sell-carousel">' +
                        '<div class="amd-sell-carousel-view">' +
                          '<button class="amd-sell-carousel-arrow" type="button" aria-label="Previous photo" data-sell-photo-prev="' + esc(lhState.activeAddress) + '"' +
                          (!slidePhotos.length ? " disabled" : "") +
                          ">" +
                          AMD_CAROUSEL_CHEV_L +
                          "</button>" +
                          '<div class="amd-sell-carousel-img-wrap" data-sell-carousel-wrap="' + esc(lhState.activeAddress) + '">' +
                            buildSellCarouselStageHtml(slideItem, lhState.activeAddress, photosPhOpts) +
                          "</div>" +
                          '<button class="amd-sell-carousel-arrow is-next" type="button" aria-label="Next photo" data-sell-photo-next="' + esc(lhState.activeAddress) + '"' +
                          (!slidePhotos.length ? " disabled" : "") +
                          ">" +
                          AMD_CAROUSEL_CHEV_R +
                          "</button>" +
                        "</div>" +
                        '<div class="amd-sell-carousel-foot">' +
                          '<div class="amd-sell-links">' +
                            (photosAssetUrl
                              ? '<button class="amd-mini-btn" type="button" data-sell-copy-photos="' + esc(photosAssetUrl) + '">Copy link</button>'
                              : (photoBooked
                                  ? '<span class="amd-mini-btn is-off">Awaiting delivery</span>'
                                  : (agentBookUrl
                                      ? '<button type="button" class="amd-mini-btn is-dark" data-sell-milestone-action="photos" data-sell-milestone-mode="book" data-sell-milestone-url="' + esc(agentBookUrl) + '" data-sell-milestone-address="' + esc(lhState.activeAddress) + '">Book Photos</button>'
                                      : (agentRequestUrl
                                          ? '<a class="amd-mini-btn" href="' + esc(agentRequestUrl) + '" target="_blank" rel="noopener">Request photos</a>'
                                          : "")))) +
                          "</div>" +
                          '<div class="amd-sell-carousel-count">' + (slidePhotos.length ? esc((slideIdx + 1) + " / " + slidePhotos.length) : "0 / 0") + "</div>" +
                        "</div>" +
                      "</div>" +
                      '</div>' +
                    "</article>";
                  var matterportCardHtml =
                    '<article class="amd-lh-card' + (rentalOnly ? " is-rental-na" : "") + '">' +
                      '<div class="amd-lh-label"><span class="amd-lh-ico is-matterport">' + BENTO_ICONS.matterport + '</span>Matterport</div>' +
                      '<div class="amd-lh-fill">' +
                      (mpEmbed
                        ? '<div class="amd-lh-media-block">' +
                            '<div class="amd-lh-embed"><iframe src="' + esc(mpEmbed) + '" allowfullscreen loading="lazy"></iframe></div>' +
                            '<div class="amd-lh-media-foot">' +
                              '<div class="amd-sell-links">' +
                                '<button class="amd-mini-btn" type="button" data-sell-copy-mp="' + esc(mpRaw) + '">Copy link</button>' +
                                '<a class="amd-mini-btn is-dark" href="' + esc(mpRaw) + '" target="_blank" rel="noopener">Open</a>' +
                              "</div>" +
                              '<div class="amd-lh-media-meta">3D tour</div>' +
                            "</div>" +
                          "</div>"
                        : '<div class="amd-lh-matterport-panel">' +
                            buildLhMediaPlaceholder(matterportPhOpts) +
                            matterportFootHtml +
                          "</div>") +
                      '</div>' +
                    "</article>";
  
                  var stageContent =
                    '<div class="amd-lh-stage-content">' +
                      marketingStatusHtml +
                      marketingAssetsHtml +
                      '<section class="amd-lh-trio">' + photosCardHtml + matterportCardHtml + "</section>" +
                    "</div>";
                  var overlayHtml = plan.stage === 1
                    ? renderMarketingActionPlan(active, lhState.activeAddress, plan, agentBookUrl, agentRequestUrl, questionnaireLink)
                    : "";
                  return (
                    '<div class="amd-lh-stage-area" data-stage="' + plan.stage + '" data-sell-stage-address="' + esc(lhState.activeAddress) + '">' +
                      stageContent +
                      overlayHtml +
                    "</div>"
                  );
                })() +
              "</section>" +
            "</div>"
            );
}

function wireLhSellWorkspaceEvents(){
  if(!lhWorkspace)return;
  var closeSellBtn=lhWorkspace.querySelector("[data-sell-close],[data-lh-close]");
  if(closeSellBtn){
    closeSellBtn.addEventListener("click",function(){
      var prevAddr=lhState.activeAddress;
      lhState.activeAddress="";
      if(prevAddr&&lhSellDetail.qCopied)delete lhSellDetail.qCopied[prevAddr];
      closeLhSellerQuestionnaireModal();
      closeListingWorkspace();
    });
  }
        var prevPhotoBtns = lhWorkspace.querySelectorAll("[data-sell-photo-prev]");
        for (var pp = 0; pp < prevPhotoBtns.length; pp++) {
          prevPhotoBtns[pp].addEventListener("click", function (evt) {
            evt.stopPropagation();
            var addr = this.getAttribute("data-sell-photo-prev") || "";
            var photos = getSellPhotosForAddress(addr);
            if (!photos.length) return;
            var idx = Number(lhSellDetail.photoIndexByAddress[addr] || 0);
            idx = (idx - 1 + photos.length) % photos.length;
            lhSellDetail.photoIndexByAddress[addr] = idx;
            updateSellPhotoCarouselDOM(addr, -1);
          });
        }
        var nextPhotoBtns = lhWorkspace.querySelectorAll("[data-sell-photo-next]");
        for (var np = 0; np < nextPhotoBtns.length; np++) {
          nextPhotoBtns[np].addEventListener("click", function (evt) {
            evt.stopPropagation();
            var addr = this.getAttribute("data-sell-photo-next") || "";
            var photos = getSellPhotosForAddress(addr);
            if (!photos.length) return;
            var idx = Number(lhSellDetail.photoIndexByAddress[addr] || 0);
            idx = (idx + 1) % photos.length;
            lhSellDetail.photoIndexByAddress[addr] = idx;
            updateSellPhotoCarouselDOM(addr, 1);
          });
        }
        var downloadAllPhotoBtns = lhWorkspace.querySelectorAll("[data-sell-photo-download-all]");
        for (var da = 0; da < downloadAllPhotoBtns.length; da++) {
          downloadAllPhotoBtns[da].addEventListener("click", function (evt) {
            evt.stopPropagation();
            var addr = this.getAttribute("data-sell-photo-download-all") || "";
            var row = findListingRowByAddress(addr);
            var folderUrl = row ? String(row.photos || "").trim() : "";
            if (folderUrl) {
              try { window.open(folderUrl, "_blank", "noopener"); } catch (e) {}
              return;
            }
            var photos = getSellPhotosForAddress(addr);
            if (!photos.length) return;
            for (var pi = 0; pi < photos.length; pi++) {
              var p = photos[pi] || {};
              var url = String(p.url || p.backupUrl || "").trim();
              if (!url) continue;
              try {
                var link = document.createElement("a");
                link.href = url;
                link.target = "_blank";
                link.rel = "noopener";
                link.download = "";
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              } catch (e) {
                try { window.open(url, "_blank", "noopener"); } catch (e2) {}
              }
            }
          });
        }
        var copyMpBtns = lhWorkspace.querySelectorAll("[data-sell-copy-mp]");
        for (var cm = 0; cm < copyMpBtns.length; cm++) {
          copyMpBtns[cm].addEventListener("click", function (evt) {
            evt.stopPropagation();
            var link = this.getAttribute("data-sell-copy-mp") || "";
            if (!link) return;
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(link).then(function () {}, function () {});
            }
          });
        }
        var copyPhotosBtns = lhWorkspace.querySelectorAll("[data-sell-copy-photos]");
        for (var cp = 0; cp < copyPhotosBtns.length; cp++) {
          copyPhotosBtns[cp].addEventListener("click", function (evt) {
            evt.stopPropagation();
            var link = this.getAttribute("data-sell-copy-photos") || "";
            if (!link) return;
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(link).then(function () {}, function () {});
            }
          });
        }
        var photoScheduleBtns = lhWorkspace.querySelectorAll("[data-sell-schedule-photos]");
        for (var ps = 0; ps < photoScheduleBtns.length; ps++) {
          photoScheduleBtns[ps].addEventListener("click", function (evt) {
            evt.stopPropagation();
            var link = this.getAttribute("data-sell-schedule-photos") || "";
            if (!link || link === "#") return;
            window.open(link, "_blank", "noopener");
          });
        }
        // Marketing milestone Book / Request buttons: open the agent's Acuity /
        // Asana URL in a new tab, then optimistically flip the milestone status
        // in local state and POST the update to the Listing Hub sheet.
        var MILESTONE_FIELD_MAP = {
          photos:      { sheet: "photos_status",      local: "photosStatus" },
          matterport:  { sheet: "matterport_status",  local: "matterportStatus" },
          floor_plan:  { sheet: "floor_plan_status",  local: "floorPlanStatus" },
          video:       { sheet: "video_status",       local: "videoStatus" },
          marketing:   { sheet: "marketing_status",   local: "marketingStatus" }
        };
        var ohRequestBtns = lhWorkspace.querySelectorAll("[data-sell-oh-request]");
        for (var oh = 0; oh < ohRequestBtns.length; oh++) {
          ohRequestBtns[oh].addEventListener("click", function (evt) {
            evt.stopPropagation();
            var btn = this;
            var address = btn.getAttribute("data-sell-oh-request") || "";
            var url = btn.getAttribute("data-sell-oh-request-url") || "";
            if (url) {
              try { window.open(url, "_blank", "noopener"); } catch (e) {}
            }
            if (!address) return;
            var nowIso = new Date().toISOString();
            var rows = lhState.rows || [];
            var targetRow = null;
            for (var ri = 0; ri < rows.length; ri++) {
              if (String(rows[ri].address || "").trim() === address) {
                targetRow = rows[ri];
                break;
              }
            }
            var prevStatus = targetRow ? targetRow.openHouseMaterialsStatus : "";
            var prevAt = targetRow ? targetRow.openHouseMaterialsRequestedAt : "";
            if (targetRow) {
              targetRow.openHouseMaterialsStatus = "Requested";
              targetRow.openHouseMaterialsRequestedAt = nowIso;
              targetRow.openHouseMaterialsDeliveredAt = "";
            }
            btn.classList.add("is-saving");
            renderListingsHub();
            postListingUpdate(address, {
              open_house_materials_status: "Requested",
              open_house_materials_requested_at: nowIso,
              open_house_materials_delivered_at: ""
            })
              .then(function (resp) {
                if (!(resp && resp.success)) {
                  if (targetRow) {
                    targetRow.openHouseMaterialsStatus = prevStatus;
                    targetRow.openHouseMaterialsRequestedAt = prevAt;
                  }
                  console.error("Open house request update failed:", resp && resp.error);
                  renderListingsHub();
                }
              })
              .catch(function (err) {
                if (targetRow) {
                  targetRow.openHouseMaterialsStatus = prevStatus;
                  targetRow.openHouseMaterialsRequestedAt = prevAt;
                }
                console.error("Open house request update error:", err);
                renderListingsHub();
              });
          });
        }
        var milestoneBtns = lhWorkspace.querySelectorAll("[data-sell-milestone-action]");
        for (var mi = 0; mi < milestoneBtns.length; mi++) {
          milestoneBtns[mi].addEventListener("click", function (evt) {
            evt.stopPropagation();
            var btn = this;
            var key = btn.getAttribute("data-sell-milestone-action") || "";
            var mode = btn.getAttribute("data-sell-milestone-mode") || "book";
            var url = btn.getAttribute("data-sell-milestone-url") || "";
            var address = btn.getAttribute("data-sell-milestone-address") || "";
            if (url) { try { window.open(url, "_blank", "noopener"); } catch (e) {} }
            var map = MILESTONE_FIELD_MAP[key];
            if (!map || !address) return;
            var newStatus = mode === "book" ? "Booked" : "Requested";
            var rows = lhState.rows || [];
            var targetRow = null;
            for (var ri = 0; ri < rows.length; ri++) {
              if (String(rows[ri].address || "").trim() === address) { targetRow = rows[ri]; break; }
            }
            var prev = targetRow ? targetRow[map.local] : "";
            if (targetRow) targetRow[map.local] = newStatus;
            btn.classList.add("is-saving");
            renderListingsHub();
            var updates = {};
            updates[map.sheet] = newStatus;
            postListingUpdate(address, updates)
              .then(function (resp) {
                if (!(resp && resp.success)) {
                  if (targetRow) targetRow[map.local] = prev;
                  console.error("Milestone update failed:", resp && resp.error);
                  renderListingsHub();
                }
              })
              .catch(function (err) {
                if (targetRow) targetRow[map.local] = prev;
                console.error("Milestone update error:", err);
                renderListingsHub();
              });
          });
        }
        // Seller-questionnaire "More details" button.
        var sqBtns = lhWorkspace.querySelectorAll("[data-sell-open-sq]");
        for (var sqi = 0; sqi < sqBtns.length; sqi++) {
          sqBtns[sqi].addEventListener("click", function (evt) {
            evt.stopPropagation();
            var addr = this.getAttribute("data-sell-open-sq") || lhState.activeAddress || "";
            openLhSellerQuestionnaireModal(addr);
          });
        }
        // Listing Overview: persistent copy-questionnaire-link button. Animates
        // to a green ✓ Copied state and also flips seller_questionnaire_sent in
        // the sheet so the action plan stays in sync with reality.
        var ovCopyBtns = lhWorkspace.querySelectorAll("[data-sell-copy-questionnaire]");
        for (var ovc = 0; ovc < ovCopyBtns.length; ovc++) {
          ovCopyBtns[ovc].addEventListener("click", function (evt) {
            evt.stopPropagation();
            var btn = this;
            var addr = btn.getAttribute("data-sell-copy-questionnaire") || "";
            var link = btn.getAttribute("data-sell-copy-questionnaire-link") || "";
            if (link && navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(link).then(function () {}, function () {});
            }
            btn.classList.add("is-copied");
            // Replace the trailing label with "Copied" for clearer feedback.
            var label = btn.querySelector("span");
            if (label) label.textContent = "Copied";
            lhSellDetail.qCopied[addr] = true;
            var rows = lhState.rows || [];
            var targetRow = null;
            for (var ri = 0; ri < rows.length; ri++) {
              if (String(rows[ri].address || "").trim() === addr) { targetRow = rows[ri]; break; }
            }
            if (targetRow) targetRow.sellerQuestionnaireSent = new Date().toISOString();
            postListingUpdate(addr, {
              seller_questionnaire_sent: "true",
              seller_questionnaire_sent_at: new Date().toISOString()
            }).catch(function (err) { console.warn("Questionnaire-sent persist failed:", err); });
            // Refresh just the Marketing Status roadmap (Seller Questionnaire
            // ✓) without re-rendering the whole panel, so the open Matterport
            // iframe and photo carousel don't reload.
            setTimeout(function () {
              try {
                var card = document.querySelector('#asg-admin-master-dashboard [data-sell-marketing-status="' + addr.replace(/"/g, '\\"') + '"]');
                if (!card) return;
                var rows = lhState.rows || [];
                var row = null;
                for (var ri2 = 0; ri2 < rows.length; ri2++) {
                  if (String(rows[ri2].address || "").trim() === addr) { row = rows[ri2]; break; }
                }
                if (!row) return;
                var freshHtml = renderMarketingStatusSection(row, addr);
                var tmp = document.createElement("div");
                tmp.innerHTML = freshHtml;
                var fresh = tmp.firstElementChild;
                if (fresh && card.parentNode) card.parentNode.replaceChild(fresh, card);
              } catch (swapErr) { /* keep optimistic state */ }
            }, 180);
          });
        }
        // ── Marketing Action Plan (Stage 1 overlay) ───────────────────────────
        // Step 1: Copy seller questionnaire link → flips the CTA to "Sent" with
        // an animated checkmark, persists seller_questionnaire_sent in the sheet.
        var copyQBtns = lhWorkspace.querySelectorAll("[data-sell-ap-copy-q]");
        for (var cq = 0; cq < copyQBtns.length; cq++) {
          copyQBtns[cq].addEventListener("click", function (evt) {
            evt.stopPropagation();
            var btn = this;
            var addr = btn.getAttribute("data-sell-ap-copy-q") || "";
            var link = btn.getAttribute("data-sell-ap-q-link") || "";
            if (link && navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(link).then(function () {}, function () {});
            }
            lhSellDetail.qCopied[addr] = true;
            var rows = lhState.rows || [];
            var targetRow = null;
            for (var ri = 0; ri < rows.length; ri++) {
              if (String(rows[ri].address || "").trim() === addr) { targetRow = rows[ri]; break; }
            }
            if (targetRow) targetRow.sellerQuestionnaireSent = new Date().toISOString();
            renderListingsHub();
            postListingUpdate(addr, { seller_questionnaire_sent: "true", seller_questionnaire_sent_at: new Date().toISOString() })
              .catch(function (err) { console.warn("Questionnaire-sent persist failed:", err); });
          });
        }
        // Step 2: Book Marketing → opens Acuity, optimistically marks photos as
        // Booked locally and POSTs the new status so the action plan completes.
        var bookMktBtns = lhWorkspace.querySelectorAll("[data-sell-ap-book]");
        for (var bm = 0; bm < bookMktBtns.length; bm++) {
          bookMktBtns[bm].addEventListener("click", function (evt) {
            evt.stopPropagation();
            var btn = this;
            var addr = btn.getAttribute("data-sell-ap-book") || "";
            var url = btn.getAttribute("data-sell-ap-book-url") || "";
            if (url) { try { window.open(url, "_blank", "noopener"); } catch (e) {} }
            var rows = lhState.rows || [];
            var targetRow = null;
            for (var ri = 0; ri < rows.length; ri++) {
              if (String(rows[ri].address || "").trim() === addr) { targetRow = rows[ri]; break; }
            }
            if (targetRow) {
              targetRow.photosStatus = "Booked";
              targetRow.matterportStatus = targetRow.matterportStatus || "Booked";
              targetRow.floorPlanStatus = targetRow.floorPlanStatus || "Booked";
              targetRow.videoStatus = targetRow.videoStatus || "Booked";
            }
            renderListingsHub();
            postListingUpdate(addr, {
              photos_status: "Booked",
              matterport_status: "Booked",
              floor_plan_status: "Booked",
              video_status: "Booked"
            }).catch(function (err) { console.warn("Marketing booking persist failed:", err); });
          });
        }
        // Continue: flip to Stage 2 locally with a brief overlay-fade animation.
        var continueBtns = lhWorkspace.querySelectorAll("[data-sell-ap-continue]");
        for (var cc = 0; cc < continueBtns.length; cc++) {
          continueBtns[cc].addEventListener("click", function (evt) {
            evt.stopPropagation();
            if (this.disabled) return;
            var addr = this.getAttribute("data-sell-ap-continue") || "";
            var overlay = lhWorkspace.querySelector(".amd-lh-stage-overlay");
            if (overlay) overlay.classList.add("is-leaving");
            setTimeout(function () {
              lhSellDetail.stageOverride[addr] = 2;
              renderListingsHub();
            }, 420);
          });
        }
}
