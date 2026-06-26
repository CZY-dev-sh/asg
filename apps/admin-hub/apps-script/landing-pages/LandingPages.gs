/**
 * ASG Landing Pages API
 * ------------------------------------------------------------
 * Sheet-backed endpoint for agent marketing landing pages.
 *
 * Tabs expected:
 * - Agents
 * - Stats
 * - Reviews
 * - PageSections
 * - IDXConfig
 * - ListingsCurated (optional)
 *
 * Query params:
 * - ?view=agent&slug=alex-stoykov&page=general|seller|buyer
 * - ?view=reviews&slug=alex-stoykov&persona=buyer|seller|investor
 * - ?view=idx&slug=alex-stoykov&page=general|seller|buyer
 * - ?view=all&slug=alex-stoykov&page=general|seller|buyer
 */

var LP_TAB_CANDIDATES = {
  agents: ["Agents", "agents"],
  agentContent: ["AgentContent", "agent_content", "agentcontent"],
  directory: ["Directory", "Team Directory", "team_directory"],
  stats: ["Stats", "stats"],
  reviews: ["Reviews", "reviews"],
  sections: ["PageSections", "page_sections", "sections"],
  idx: ["IDXConfig", "idx_config", "idx"],
  listings: ["ListingsCurated", "listings_curated", "listings"]
};

function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var params = e && e.parameter ? e.parameter : {};
    var view = _lpResolveView_(params.view);
    var slug = _lpSlug_(params.slug || params.agent || "");
    var page = _lpResolvePage_(params.page);
    var persona = _lpResolvePersona_(params.persona);
    var payload = {
      success: true,
      meta: {
        view: view,
        slug: slug,
        page: page,
        persona: persona,
        generatedAt: new Date().toISOString()
      }
    };

    if (!slug && view !== "schema") {
      return _lpJson_({
        success: false,
        error: "Missing required parameter: slug"
      });
    }

    if (view === "schema") {
      payload.data = _lpBuildSchemaResponse_();
      return _lpJson_(payload);
    }

    if (view === "reviews") {
      payload.data = {
        reviews: _lpReadReviewsForAgent_(ss, slug, persona)
      };
      return _lpJson_(payload);
    }

    if (view === "idx") {
      payload.data = {
        idx: _lpReadIdxConfigForAgent_(ss, slug, page)
      };
      return _lpJson_(payload);
    }

    if (view === "agent" || view === "all") {
      payload.data = _lpReadAgentPageBundle_(ss, slug, page, persona);
      return _lpJson_(payload);
    }

    return _lpJson_({
      success: false,
      error: "Unsupported view: " + view
    });
  } catch (err) {
    return _lpJson_({
      success: false,
      error: err && err.message ? err.message : String(err)
    });
  }
}

function _lpBuildSchemaResponse_() {
  return {
    tabs: {
      agents: [
        "agent_slug", "name", "title", "bio_short", "bio_long", "headshot_url",
        "phone", "email", "instagram_url", "facebook_url", "linkedin_url",
        "primary_market", "secondary_markets", "cta_primary_label", "cta_primary_url",
        "cta_secondary_label", "cta_secondary_url", "active"
      ],
      stats: [
        "agent_slug", "page", "metric_key", "metric_label", "metric_value", "metric_subtext",
        "sort_order", "active"
      ],
      reviews: [
        "agent_slug", "source", "persona", "reviewer_name", "rating", "quote",
        "source_url", "featured", "sort_order", "active"
      ],
      sections: [
        "agent_slug", "page", "section_key", "headline", "body", "chip_1", "chip_2",
        "chip_3", "cta_label", "cta_url", "sort_order", "enabled"
      ],
      idxConfig: [
        "agent_slug", "page", "widget_title", "embed_script", "fallback_text",
        "enabled", "sort_order"
      ],
      listingsCurated: [
        "agent_slug", "page", "listing_type", "address", "price", "beds", "baths",
        "image_url", "status", "details_url", "sort_order", "active"
      ]
    }
  };
}

function _lpReadAgentPageBundle_(ss, slug, page, persona) {
  var agent = _lpReadAgentBySlug_(ss, slug);
  var stats = _lpReadStatsForAgent_(ss, slug, page);
  var reviews = _lpReadReviewsForAgent_(ss, slug, persona);
  var sections = _lpReadSectionsForAgent_(ss, slug, page);
  var idx = _lpReadIdxConfigForAgent_(ss, slug, page);
  var listings = _lpReadCuratedListingsForAgent_(ss, slug, page);
  return {
    agent: agent,
    stats: stats,
    reviews: reviews,
    sections: sections,
    idx: idx,
    listings: listings
  };
}

function _lpReadAgentBySlug_(ss, slug) {
  var fromDirectory = _lpReadAgentFromDirectoryBySlug_(ss, slug);
  var fromAgentContent = _lpReadAgentFromAgentContentBySlug_(ss, slug);
  var rows = _lpReadRowsByCandidates_(ss, LP_TAB_CANDIDATES.agents);
  var fromAgents = null;

  if (rows.success) {
    for (var i = 0; i < rows.items.length; i++) {
      var row = rows.items[i];
      if (_lpSlug_(row.agent_slug || row.slug) !== slug) continue;
      if (!_lpIsEnabled_(row.active, true)) continue;
      fromAgents = _lpBuildAgentItemFromAgentsRow_(row);
      break;
    }
  }

  var merged = null;
  if (fromDirectory && fromDirectory.success && fromDirectory.item) merged = fromDirectory.item;
  if (fromAgentContent && fromAgentContent.success && fromAgentContent.item) merged = merged ? _lpMergeAgentItems_(merged, fromAgentContent.item) : fromAgentContent.item;
  if (fromAgents) merged = merged ? _lpMergeAgentItems_(merged, fromAgents) : fromAgents;
  if (merged) return { success: true, item: merged };
  if (fromDirectory && fromDirectory.success) return fromDirectory;
  return { success: false, error: "Agent not found for slug: " + slug };
}

function _lpBuildAgentItemFromAgentsRow_(row) {
  return {
    slug: _lpSlug_(row.agent_slug || row.slug),
    name: _lpSafe_(row.name),
    title: _lpSafe_(row.title),
    bioShort: _lpSafe_(row.bio_short),
    bioLong: _lpSafe_(row.bio_long),
    headshotUrl: _lpSafe_(row.headshot_url),
    phone: _lpSafe_(row.phone),
    email: _lpSafe_(row.email),
    socials: {
      instagram: _lpSafe_(row.instagram_url),
      facebook: _lpSafe_(row.facebook_url),
      linkedin: _lpSafe_(row.linkedin_url)
    },
    markets: {
      primary: _lpSafe_(row.primary_market),
      secondary: _lpSplitCsv_(row.secondary_markets)
    },
    ctas: {
      primary: { label: _lpSafe_(row.cta_primary_label), url: _lpSafe_(row.cta_primary_url) },
      secondary: { label: _lpSafe_(row.cta_secondary_label), url: _lpSafe_(row.cta_secondary_url) }
    }
  };
}

function _lpReadAgentFromDirectoryBySlug_(ss, slug) {
  var rows = _lpReadRowsByCandidates_(ss, LP_TAB_CANDIDATES.directory);
  if (!rows.success) return rows;
  for (var i = 0; i < rows.items.length; i++) {
    var row = rows.items[i];
    var candidateSlug = _lpAgentSlugFromDirectoryRow_(row);
    if (candidateSlug !== slug) continue;
    return {
      success: true,
      item: {
        slug: candidateSlug,
        name: _lpSafe_(_lpPickAny_(row, ["name", "display_name", "agent_name"])),
        title: _lpSafe_(_lpPickAny_(row, ["title", "role", "position", "tier", "role_group"])),
        bioShort: _lpSafe_(_lpPickAny_(row, ["bio_short", "bio", "short_bio"])),
        bioLong: _lpSafe_(_lpPickAny_(row, ["bio_long", "long_bio", "about"])),
        headshotUrl: _lpSafe_(_lpPickAny_(row, ["headshot_url", "image_url", "photo", "profile_photo", "icon_photo_url"])),
        phone: _lpSafe_(_lpPickAny_(row, ["phone_number", "phone", "mobile", "cell", "cell_phone", "work_phone"])),
        email: _lpSafe_(_lpPickAny_(row, ["email", "agent_email"])),
        socials: {
          instagram: _lpSafe_(_lpPickAny_(row, ["instagram_url", "instagram", "ig_url", "ig"])),
          facebook: _lpSafe_(_lpPickAny_(row, ["facebook_url", "facebook", "fb_url", "fb"])),
          linkedin: _lpSafe_(_lpPickAny_(row, ["linkedin_url", "linkedin", "linkedin_profile"]))
        },
        markets: {
          primary: _lpSafe_(_lpPickAny_(row, ["primary_market", "market", "market_area"])),
          secondary: _lpSplitCsv_(_lpPickAny_(row, ["secondary_markets", "markets", "other_markets"]))
        },
        ctas: {
          primary: {
            label: _lpSafe_(_lpPickAny_(row, ["cta_primary_label", "book_cta_label", "book_label"])),
            url: _lpSafe_(_lpPickAny_(row, ["cta_primary_url", "book", "booking_url", "book_url"]))
          },
          secondary: {
            label: _lpSafe_(_lpPickAny_(row, ["cta_secondary_label", "secondary_cta_label"])),
            url: _lpSafe_(_lpPickAny_(row, ["cta_secondary_url", "landing", "landing_url", "secondary_cta_url"]))
          }
        }
      }
    };
  }
  return { success: false, error: "Agent not found in Directory for slug: " + slug };
}

function _lpReadAgentFromAgentContentBySlug_(ss, slug) {
  var rows = _lpReadRowsByCandidates_(ss, LP_TAB_CANDIDATES.agentContent);
  if (!rows.success) return rows;
  for (var i = 0; i < rows.items.length; i++) {
    var row = rows.items[i];
    if (_lpSlug_(row.agent_slug || row.slug) !== slug) continue;
    if (!_lpIsEnabled_(row.active, true)) continue;
    return {
      success: true,
      item: {
        slug: _lpSlug_(row.agent_slug || row.slug),
        name: _lpSafe_(_lpPickAny_(row, ["name", "display_name", "agent_name"])),
        title: _lpSafe_(_lpPickAny_(row, ["title", "role", "position"])),
        bioShort: _lpSafe_(row.bio_short),
        bioLong: _lpSafe_(row.bio_long),
        headshotUrl: _lpSafe_(_lpPickAny_(row, ["headshot_url", "image_url", "photo"])),
        phone: _lpSafe_(_lpPickAny_(row, ["phone", "phone_number", "mobile"])),
        email: _lpSafe_(_lpPickAny_(row, ["email", "agent_email"])),
        socials: {
          instagram: _lpSafe_(row.instagram_url),
          facebook: _lpSafe_(row.facebook_url),
          linkedin: _lpSafe_(row.linkedin_url)
        },
        markets: {
          primary: _lpSafe_(row.primary_market),
          secondary: _lpSplitCsv_(row.secondary_markets)
        },
        ctas: {
          primary: { label: _lpSafe_(row.cta_primary_label), url: _lpSafe_(row.cta_primary_url) },
          secondary: { label: _lpSafe_(row.cta_secondary_label), url: _lpSafe_(row.cta_secondary_url) }
        },
        reviewProfiles: {
          zillow: _lpSafe_(row.zillow_url),
          google: _lpSafe_(row.google_url)
        }
      }
    };
  }
  return { success: false, error: "Agent not found in AgentContent for slug: " + slug };
}

function _lpAgentSlugFromDirectoryRow_(row) {
  var explicit = _lpPickAny_(row, ["agent_slug", "slug"]);
  if (explicit) return _lpSlug_(explicit);
  var fromEmail = _lpSafe_(_lpPickAny_(row, ["email", "agent_email"])).split("@")[0];
  if (fromEmail) return _lpSlug_(fromEmail);
  return _lpSlug_(_lpPickAny_(row, ["name", "display_name", "agent_name"]));
}

function _lpMergeAgentItems_(baseItem, overrideItem) {
  return {
    slug: _lpFirstNonEmpty_([overrideItem.slug, baseItem.slug]),
    name: _lpFirstNonEmpty_([overrideItem.name, baseItem.name]),
    title: _lpFirstNonEmpty_([overrideItem.title, baseItem.title]),
    bioShort: _lpFirstNonEmpty_([overrideItem.bioShort, baseItem.bioShort]),
    bioLong: _lpFirstNonEmpty_([overrideItem.bioLong, baseItem.bioLong]),
    headshotUrl: _lpFirstNonEmpty_([overrideItem.headshotUrl, baseItem.headshotUrl]),
    phone: _lpFirstNonEmpty_([overrideItem.phone, baseItem.phone]),
    email: _lpFirstNonEmpty_([overrideItem.email, baseItem.email]),
    socials: {
      instagram: _lpFirstNonEmpty_([overrideItem.socials && overrideItem.socials.instagram, baseItem.socials && baseItem.socials.instagram]),
      facebook: _lpFirstNonEmpty_([overrideItem.socials && overrideItem.socials.facebook, baseItem.socials && baseItem.socials.facebook]),
      linkedin: _lpFirstNonEmpty_([overrideItem.socials && overrideItem.socials.linkedin, baseItem.socials && baseItem.socials.linkedin])
    },
    markets: {
      primary: _lpFirstNonEmpty_([overrideItem.markets && overrideItem.markets.primary, baseItem.markets && baseItem.markets.primary]),
      secondary: (overrideItem.markets && overrideItem.markets.secondary && overrideItem.markets.secondary.length) ? overrideItem.markets.secondary : (baseItem.markets && baseItem.markets.secondary ? baseItem.markets.secondary : [])
    },
    ctas: {
      primary: {
        label: _lpFirstNonEmpty_([overrideItem.ctas && overrideItem.ctas.primary && overrideItem.ctas.primary.label, baseItem.ctas && baseItem.ctas.primary && baseItem.ctas.primary.label]),
        url: _lpFirstNonEmpty_([overrideItem.ctas && overrideItem.ctas.primary && overrideItem.ctas.primary.url, baseItem.ctas && baseItem.ctas.primary && baseItem.ctas.primary.url])
      },
      secondary: {
        label: _lpFirstNonEmpty_([overrideItem.ctas && overrideItem.ctas.secondary && overrideItem.ctas.secondary.label, baseItem.ctas && baseItem.ctas.secondary && baseItem.ctas.secondary.label]),
        url: _lpFirstNonEmpty_([overrideItem.ctas && overrideItem.ctas.secondary && overrideItem.ctas.secondary.url, baseItem.ctas && baseItem.ctas.secondary && baseItem.ctas.secondary.url])
      }
    }
  };
}

function _lpReadStatsForAgent_(ss, slug, page) {
  var rows = _lpReadRowsByCandidates_(ss, LP_TAB_CANDIDATES.stats);
  if (!rows.success) return [];
  return rows.items
    .filter(function(row) {
      return _lpSlug_(row.agent_slug) === slug &&
        _lpPageMatches_(row.page, page) &&
        _lpIsEnabled_(row.active, true);
    })
    .sort(function(a, b) {
      return _lpNum_(a.sort_order, 9999) - _lpNum_(b.sort_order, 9999);
    })
    .map(function(row) {
      return {
        key: _lpSafe_(row.metric_key),
        label: _lpSafe_(row.metric_label),
        value: _lpSafe_(row.metric_value),
        subtext: _lpSafe_(row.metric_subtext)
      };
    });
}

function _lpReadReviewsForAgent_(ss, slug, persona) {
  var rows = _lpReadRowsByCandidates_(ss, LP_TAB_CANDIDATES.reviews);
  if (!rows.success) return [];
  return rows.items
    .filter(function(row) {
      var rowPersona = _lpResolvePersona_(row.persona || "all");
      var personaMatch = persona === "all" || rowPersona === "all" || rowPersona === persona;
      return _lpSlug_(row.agent_slug) === slug &&
        personaMatch &&
        _lpIsEnabled_(row.active, true);
    })
    .sort(function(a, b) {
      return _lpNum_(b.featured, 0) - _lpNum_(a.featured, 0) ||
        _lpNum_(a.sort_order, 9999) - _lpNum_(b.sort_order, 9999);
    })
    .map(function(row) {
      return {
        source: _lpSafe_(row.source),
        persona: _lpResolvePersona_(row.persona || "all"),
        reviewerName: _lpSafe_(row.reviewer_name),
        rating: _lpNum_(row.rating, 0),
        quote: _lpSafe_(row.quote),
        sourceUrl: _lpSafe_(row.source_url),
        featured: _lpNum_(row.featured, 0) === 1
      };
    });
}

function _lpReadSectionsForAgent_(ss, slug, page) {
  var rows = _lpReadRowsByCandidates_(ss, LP_TAB_CANDIDATES.sections);
  if (!rows.success) return [];
  return rows.items
    .filter(function(row) {
      return _lpSlug_(row.agent_slug) === slug &&
        _lpPageMatches_(row.page, page) &&
        _lpIsEnabled_(row.enabled, true);
    })
    .sort(function(a, b) {
      return _lpNum_(a.sort_order, 9999) - _lpNum_(b.sort_order, 9999);
    })
    .map(function(row) {
      return {
        key: _lpSafe_(row.section_key),
        headline: _lpSafe_(row.headline),
        body: _lpSafe_(row.body),
        chips: [_lpSafe_(row.chip_1), _lpSafe_(row.chip_2), _lpSafe_(row.chip_3)].filter(Boolean),
        cta: {
          label: _lpSafe_(row.cta_label),
          url: _lpSafe_(row.cta_url)
        }
      };
    });
}

function _lpReadIdxConfigForAgent_(ss, slug, page) {
  var rows = _lpReadRowsByCandidates_(ss, LP_TAB_CANDIDATES.idx);
  if (!rows.success) return { items: [] };
  var items = rows.items
    .filter(function(row) {
      return _lpSlug_(row.agent_slug) === slug &&
        _lpPageMatches_(row.page, page) &&
        _lpIsEnabled_(row.enabled, true);
    })
    .sort(function(a, b) {
      return _lpNum_(a.sort_order, 9999) - _lpNum_(b.sort_order, 9999);
    })
    .map(function(row) {
      return {
        title: _lpSafe_(row.widget_title),
        embedScript: _lpSafe_(row.embed_script),
        fallbackText: _lpSafe_(row.fallback_text)
      };
    });
  return { items: items };
}

function _lpReadCuratedListingsForAgent_(ss, slug, page) {
  var rows = _lpReadRowsByCandidates_(ss, LP_TAB_CANDIDATES.listings);
  if (!rows.success) return [];
  return rows.items
    .filter(function(row) {
      return _lpSlug_(row.agent_slug) === slug &&
        _lpPageMatches_(row.page, page) &&
        _lpIsEnabled_(row.active, true);
    })
    .sort(function(a, b) {
      return _lpNum_(a.sort_order, 9999) - _lpNum_(b.sort_order, 9999);
    })
    .map(function(row) {
      return {
        listingType: _lpSafe_(row.listing_type),
        address: _lpSafe_(row.address),
        price: _lpSafe_(row.price),
        beds: _lpSafe_(row.beds),
        baths: _lpSafe_(row.baths),
        imageUrl: _lpSafe_(row.image_url),
        status: _lpSafe_(row.status),
        detailsUrl: _lpSafe_(row.details_url)
      };
    });
}

function _lpReadRowsByCandidates_(ss, candidates) {
  var sheet = _lpFindSheet_(ss, candidates);
  if (!sheet) return { success: false, error: "Sheet not found: " + candidates.join(", "), items: [] };
  var table = _lpReadTable_(sheet);
  return { success: true, sheetName: sheet.getName(), headers: table.headers, items: table.rows };
}

function _lpReadTable_(sheet) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 1 || lastCol < 1) return { headers: [], rows: [] };
  var headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
  var keys = headers.map(function(h) { return _lpToKey_(h); });
  if (lastRow < 2) return { headers: headers, rows: [] };
  var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getDisplayValues();
  var rows = [];
  for (var r = 0; r < values.length; r++) {
    var row = values[r];
    if (_lpIsRowBlank_(row)) continue;
    var obj = { _rowNumber: r + 2 };
    for (var c = 0; c < keys.length; c++) {
      if (!keys[c]) continue;
      obj[keys[c]] = row[c];
    }
    rows.push(obj);
  }
  return { headers: headers, rows: rows };
}

function _lpResolveView_(view) {
  var v = String(view || "").trim().toLowerCase();
  if (v === "agent" || v === "reviews" || v === "idx" || v === "all" || v === "schema") return v;
  return "agent";
}

function _lpResolvePage_(page) {
  var p = String(page || "").trim().toLowerCase();
  if (p === "general" || p === "seller" || p === "buyer") return p;
  return "general";
}

function _lpResolvePersona_(persona) {
  var p = String(persona || "").trim().toLowerCase();
  if (p === "buyer" || p === "seller" || p === "investor" || p === "all") return p;
  return "all";
}

function _lpPageMatches_(rawPage, targetPage) {
  var source = String(rawPage || "").trim().toLowerCase();
  if (!source || source === "all") return true;
  return source === targetPage;
}

function _lpFindSheet_(ss, names) {
  for (var i = 0; i < names.length; i++) {
    var sheet = ss.getSheetByName(names[i]);
    if (sheet) return sheet;
  }
  return null;
}

function _lpSlug_(s) {
  return String(s || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function _lpToKey_(header) {
  return String(header || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function _lpSafe_(v) {
  return String(v || "").trim();
}

function _lpNum_(n, fallback) {
  var x = Number(n);
  if (isNaN(x)) return fallback;
  return x;
}

function _lpSplitCsv_(s) {
  return String(s || "")
    .split(",")
    .map(function(part) { return String(part || "").trim(); })
    .filter(function(part) { return !!part; });
}

function _lpPickAny_(obj, keys) {
  for (var i = 0; i < keys.length; i++) {
    var key = _lpToKey_(keys[i]);
    if (!key) continue;
    if (!obj.hasOwnProperty(key)) continue;
    var value = obj[key];
    if (String(value || "").trim() !== "") return value;
  }
  return "";
}

function _lpFirstNonEmpty_(values) {
  for (var i = 0; i < values.length; i++) {
    var v = values[i];
    if (Array.isArray(v)) {
      if (v.length) return v;
      continue;
    }
    if (String(v || "").trim() !== "") return v;
  }
  return "";
}

function _lpIsEnabled_(raw, defaultOn) {
  var v = String(raw === undefined || raw === null ? "" : raw).trim().toLowerCase();
  if (!v) return defaultOn;
  if (v === "1" || v === "true" || v === "yes" || v === "y") return true;
  if (v === "0" || v === "false" || v === "no" || v === "n") return false;
  return defaultOn;
}

function _lpIsRowBlank_(row) {
  for (var i = 0; i < row.length; i++) {
    if (String(row[i] || "").trim() !== "") return false;
  }
  return true;
}

function _lpJson_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
