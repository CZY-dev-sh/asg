/**
 * Follow Up Boss -> Agent Hub API
 * ------------------------------------------------------------
 * Secure proxy for Squarespace code blocks.
 *
 * Script Properties (required):
 * - FUB_API_KEY               : Follow Up Boss API key
 *
 * Script Properties (optional):
 * - FUB_API_BASE_URL          : Defaults to https://api.followupboss.com/v1
 * - FUB_ADMIN_USER_IDS        : Comma-separated Follow Up Boss user IDs considered "Admin"
 * - FUB_DEFAULT_LIMIT         : Max contacts returned when no explicit limit is provided
 *
 * Query params:
 * - ?agentEmail=alex@...      : Filter contacts by assigned agent email
 * - ?agentName=Alex Stoykov   : Filter contacts by assigned agent name (fallback)
 * - ?limit=10                 : Max contacts to return (1-25)
 *
 * Response contract:
 * {
 *   ok: true,
 *   meta: { generatedAt, contactCount, dealCount, todoCount, doneCount },
 *   contacts: [{ id, name, email, phone, deals, adminTasks, dealTasks }],
 *   summary: {
 *     deals: { total, open, won, lost, archived, unknown },
 *     adminTasks: { doneCount, todoCount },
 *     taskStatus: { doneCount, todoCount }
 *   }
 * }
 */
var FUB_DEFAULTS = {
  apiBaseUrl: "https://api.followupboss.com/v1",
  maxLimit: 25,
  defaultLimit: 10,
  maxPeopleScan: 80,
  targetSmartListId: 172,
  targetSmartListName: "Current Deals"
};

function doGet(e) {
  try {
    var props = PropertiesService.getScriptProperties();
    var apiKey = String(props.getProperty("FUB_API_KEY") || "").trim();
    if (!apiKey) {
      return _json_({
        ok: false,
        errorMessage: "Missing Script Property: FUB_API_KEY",
        contacts: [],
        summary: _emptySummary_()
      });
    }

    var apiBase = String(props.getProperty("FUB_API_BASE_URL") || FUB_DEFAULTS.apiBaseUrl).trim();
    var adminUserIds = _parseCsvNumbers_(props.getProperty("FUB_ADMIN_USER_IDS"));
    var configuredDefaultLimit = _toInt_(props.getProperty("FUB_DEFAULT_LIMIT"), FUB_DEFAULTS.defaultLimit);
    var requestedLimit = _clamp_(
      _toInt_(e && e.parameter ? e.parameter.limit : "", configuredDefaultLimit),
      1,
      FUB_DEFAULTS.maxLimit
    );
    var maxPeopleScan = _clamp_(
      _toInt_(props.getProperty("FUB_MAX_PEOPLE_SCAN"), FUB_DEFAULTS.maxPeopleScan),
      requestedLimit,
      200
    );
    var requestedSmartListId = _toInt_(
      (e && e.parameter && e.parameter.smartListId) || props.getProperty("FUB_TARGET_SMART_LIST_ID"),
      FUB_DEFAULTS.targetSmartListId
    );
    var requestedSmartListName = _clean_(
      (e && e.parameter && e.parameter.smartListName) || props.getProperty("FUB_TARGET_SMART_LIST_NAME") || FUB_DEFAULTS.targetSmartListName
    );
    var filters = _buildFilters_(e && e.parameter ? e.parameter : {});
    var agentUserIds = _resolveAgentUserIds_(apiKey, apiBase, filters);

    var smartListLookup = _resolveSmartListReference_(apiKey, apiBase, requestedSmartListId, requestedSmartListName);
    if (!smartListLookup.ok) {
      return _json_({
        ok: false,
        errorMessage: smartListLookup.error || "Unable to resolve Smart List reference",
        contacts: [],
        summary: _emptySummary_(),
        meta: {
          generatedAt: new Date().toISOString(),
          appliedFilters: {
            smartListMode: true,
            requestedSmartListId: requestedSmartListId,
            requestedSmartListName: requestedSmartListName
          }
        }
      });
    }
    var resolvedSmartListId = smartListLookup.id;
    var resolvedSmartListName = smartListLookup.name;

    // Strict smart-list mode: only return contacts explicitly resolved as members of the target list.
    var smartListResult = _fetchPeopleFromSmartList_(apiKey, apiBase, resolvedSmartListId, requestedLimit, resolvedSmartListName);
    if (!smartListResult.ok) {
      return _json_({
        ok: false,
        errorMessage: smartListResult.error || "Unable to resolve Smart List members",
        contacts: [],
        summary: _emptySummary_(),
        meta: {
          generatedAt: new Date().toISOString(),
          appliedFilters: {
            smartListMode: true,
            requestedSmartListId: requestedSmartListId,
            requestedSmartListName: requestedSmartListName,
            smartListId: resolvedSmartListId,
            smartListName: resolvedSmartListName,
            smartListSource: smartListResult.source || "unresolved"
          }
        }
      });
    }
    var people = smartListResult.people;
    var candidatePeople = _filterPeople_(people, filters, agentUserIds);

    var contacts = [];
    var maxScan = Math.min(candidatePeople.length, _safeInt_(maxPeopleScan, requestedLimit));
    for (var i = 0; i < maxScan; i++) {
      var person = candidatePeople[i];
      var contact = _normalizeContact_(person);
      var dealsPayload = _fetchDealsForPerson_(apiKey, apiBase, contact.id);
      var tasksPayload = _fetchTasksForPerson_(apiKey, apiBase, contact.id);

      var deals = _normalizeDeals_(dealsPayload && dealsPayload.deals ? dealsPayload.deals : [], person);
      var dealTasks = _normalizeDealTasks_(
        tasksPayload && tasksPayload.tasks ? tasksPayload.tasks : [],
        adminUserIds,
        agentUserIds
      );

      contact.deals = deals;
      contact.dealTasks = {
        doneCount: dealTasks.doneCount,
        todoCount: dealTasks.todoCount,
        tasks: dealTasks.tasks
      };
      contact.adminTasks = {
        doneCount: dealTasks.admin.doneCount,
        todoCount: dealTasks.admin.todoCount,
        tasks: dealTasks.tasks.filter(function(t) { return t.assigneeRole === "admin"; })
      };
      contacts.push(contact);
      if (contacts.length >= requestedLimit) {
        break;
      }
    }

    contacts.sort(function(a, b) {
      return (b.lastActivityTs || 0) - (a.lastActivityTs || 0);
    });
    if (contacts.length > requestedLimit) {
      contacts = contacts.slice(0, requestedLimit);
    }

    var summary = _buildSummary_(contacts);
    return _json_({
      ok: true,
      meta: {
        generatedAt: new Date().toISOString(),
        contactCount: contacts.length,
        dealCount: summary.deals.total,
        todoCount: summary.taskStatus.todoCount,
        doneCount: summary.taskStatus.doneCount,
        appliedFilters: {
          agentEmail: filters.agentEmail || "",
          agentName: filters.agentName || "",
          resolvedAgentUserIds: agentUserIds,
          smartListMembersBeforeAgentFilter: people.length,
          smartListMembersAfterAgentFilter: candidatePeople.length,
          peopleScanned: maxScan,
          requestedLimit: requestedLimit,
          maxPeopleScan: maxPeopleScan,
          filterProvided: !!(filters.agentId || filters.agentEmail || filters.agentName),
          smartListMode: true,
          requestedSmartListId: requestedSmartListId,
          requestedSmartListName: requestedSmartListName,
          smartListId: resolvedSmartListId,
          smartListName: resolvedSmartListName,
          smartListSource: smartListResult.source,
          smartListPeopleCount: people.length,
          returningSmartListDirectly: true
        }
      },
      contacts: contacts,
      summary: summary
    });
  } catch (err) {
    return _json_({
      ok: false,
      errorMessage: err && err.message ? err.message : String(err),
      contacts: [],
      summary: _emptySummary_()
    });
  }
}

function _buildFilters_(params) {
  return {
    agentId: _toInt_(params.agentId || params.userId || "", 0),
    agentEmail: _normalizeLower_(params.agentEmail || params.email),
    agentName: _normalizeLower_(params.agentName)
  };
}

function _filterPeople_(people, filters, agentUserIds) {
  if (!filters.agentId && !filters.agentEmail && !filters.agentName && !(agentUserIds && agentUserIds.length)) {
    return people;
  }

  var userIds = [];
  if (filters.agentId > 0) userIds.push(filters.agentId);
  if (Array.isArray(agentUserIds)) {
    userIds = userIds.concat(agentUserIds);
  }
  userIds = _dedupeNumbers_(userIds);

  return people.filter(function(person) {
    var assignments = _extractAssignees_(person);
    var assignmentIds = _extractAssigneeIds_(person, assignments);
    if (userIds.length && _hasOverlap_(assignmentIds, userIds)) {
      return true;
    }

    for (var i = 0; i < assignments.length; i++) {
      var assignee = assignments[i] || {};
      var assigneeEmail = _normalizeLower_(assignee.email);
      var assigneeName = _normalizeLower_(assignee.name);
      if (filters.agentEmail && assigneeEmail === filters.agentEmail) return true;
      if (filters.agentName && assigneeName.indexOf(filters.agentName) !== -1) return true;
    }
    return false;
  });
}

function _resolveAgentUserIds_(apiKey, apiBase, filters) {
  var ids = [];
  if (filters.agentId > 0) ids.push(filters.agentId);
  if (!filters.agentEmail && !filters.agentName) return ids;

  try {
    var usersPayload = _fubRequest_(apiKey, apiBase, "/users", { limit: 200 });
    var users = Array.isArray(usersPayload && usersPayload.users) ? usersPayload.users : [];
    for (var i = 0; i < users.length; i++) {
      var user = users[i] || {};
      var userEmail = _normalizeLower_(user.email);
      var userName = _normalizeLower_(user.name);
      var userId = _toInt_(user.id, 0);
      if (userId <= 0) continue;
      if (filters.agentEmail && userEmail === filters.agentEmail) {
        ids.push(userId);
        continue;
      }
      if (filters.agentName && userName.indexOf(filters.agentName) !== -1) {
        ids.push(userId);
      }
    }
  } catch (err) {
    // Non-fatal: we can still try direct assignment matching.
  }

  return _dedupeNumbers_(ids);
}

function _resolveSmartListReference_(apiKey, apiBase, requestedId, requestedName) {
  if (requestedName) {
    var allListsPayload = _fetchAllSmartLists_(apiKey, apiBase);
    var lists = Array.isArray(allListsPayload && allListsPayload.smartlists) ? allListsPayload.smartlists : [];
    var nameMatch = _matchSmartListByName_(lists, requestedName);
    if (nameMatch) {
      return {
        ok: true,
        id: _toInt_(nameMatch.id, 0),
        name: _clean_(nameMatch.name)
      };
    }
    return {
      ok: false,
      error: 'Could not find Smart List named "' + requestedName + '"'
    };
  }

  if (requestedId > 0) {
    var byId = _tryFubRequest_(apiKey, apiBase, "/smartLists/" + encodeURIComponent(String(requestedId)), {});
    if (byId) {
      return {
        ok: true,
        id: requestedId,
        name: _clean_((byId && byId.name) || (byId && byId.smartList && byId.smartList.name) || "")
      };
    }
    return {
      ok: false,
      error: "Could not load Smart List with id=" + requestedId
    };
  }

  return {
    ok: false,
    error: "No smart list id or name provided"
  };
}

function _fetchAllSmartLists_(apiKey, apiBase) {
  var all = [];
  var next = "";
  var guard = 0;
  do {
    var query = { limit: 100, all: true, fub2: true };
    if (next) query.next = next;
    var payload = _tryFubRequest_(apiKey, apiBase, "/smartLists", query);
    if (!payload) break;

    var chunk = Array.isArray(payload.smartlists) ? payload.smartlists : [];
    all = all.concat(chunk);

    var metadata = payload._metadata || {};
    next = _clean_(metadata.next || "");
    guard++;
  } while (next && guard < 20);

  return { smartlists: all };
}

function _matchSmartListByName_(lists, requestedName) {
  var target = _normalizeSmartListName_(requestedName);
  if (!target) return null;

  var exact = null;
  var contains = null;

  for (var i = 0; i < lists.length; i++) {
    var list = lists[i] || {};
    var norm = _normalizeSmartListName_(list.name);
    if (!norm) continue;
    if (norm === target) {
      exact = list;
      break;
    }
    if (!contains && (norm.indexOf(target) !== -1 || target.indexOf(norm) !== -1)) {
      contains = list;
    }
  }
  return exact || contains;
}

function _normalizeSmartListName_(value) {
  var raw = _normalizeLower_(value || "");
  if (!raw) return "";
  // Accept UI labels like "9 - Under Contract" by stripping numeric prefix.
  raw = raw.replace(/^\d+\s*[-.)]\s*/, "");
  raw = raw.replace(/\s+/g, " ").trim();
  return raw;
}

function _fetchPeopleFromSmartList_(apiKey, apiBase, smartListId, requestedLimit, smartListName) {
  if (smartListId <= 0) {
    return { ok: false, people: [], source: "none", error: "Missing or invalid smartListId" };
  }

  var pullLimit = Math.max(100, requestedLimit * 10);

  // Resolve membership from list detail first (trusted source of membership).
  var smartListPayload = _tryFubRequest_(apiKey, apiBase, "/smartLists/" + encodeURIComponent(String(smartListId)), {});
  if (!smartListPayload) {
    return {
      ok: false,
      people: [],
      source: "smartLists.id.error",
      error: "Could not load /smartLists/" + smartListId + " from Follow Up Boss API"
    };
  }

  var personIds = _extractPersonIdsDeep_(smartListPayload);
  if (personIds.length) {
    var hydrated = _tryFubRequest_(apiKey, apiBase, "/people", {
      ids: personIds.join(","),
      limit: pullLimit,
      sort: "updated",
      direction: "desc"
    });
    var hydratedPeople = _extractPeopleArray_(hydrated);
    if (hydratedPeople.length) {
      return { ok: true, people: hydratedPeople, source: "smartLists.id.personIds" };
    }
    return {
      ok: false,
      people: [],
      source: "smartLists.id.personIds.emptyHydrate",
      error: "Resolved person IDs from Smart List, but could not hydrate people records"
    };
  }

  var embeddedPeople = _extractPeopleArray_(smartListPayload);
  if (embeddedPeople.length) {
    return { ok: true, people: embeddedPeople, source: "smartLists.id.embeddedPeople" };
  }

  var fallbackResult = _fetchPeopleBySmartListQueryFallback_(
    apiKey,
    apiBase,
    smartListId,
    requestedLimit,
    smartListName,
    smartListPayload
  );
  if (fallbackResult.people.length) {
    return {
      ok: true,
      people: fallbackResult.people,
      source: fallbackResult.source
    };
  }

  return {
    ok: false,
    people: [],
    source: "smartLists.id.noMembershipData",
    error: "Smart List returned no member IDs/people in API response. Cannot safely return list members."
  };
}

function _fetchPeopleBySmartListQueryFallback_(apiKey, apiBase, smartListId, requestedLimit, smartListName, smartListPayload) {
  var pullLimit = Math.max(100, requestedLimit * 10);
  var criteria = _deriveSmartListCriteria_(smartListName, smartListPayload);
  var attempts = [
    { smartListId: smartListId, limit: pullLimit, sort: "updated", direction: "desc", includeTrash: false },
    { listId: smartListId, limit: pullLimit, sort: "updated", direction: "desc", includeTrash: false }
  ];

  var bestRaw = [];
  for (var i = 0; i < attempts.length; i++) {
    var payload = _tryFubRequest_(apiKey, apiBase, "/people", attempts[i]);
    var people = _extractPeopleArray_(payload);
    if (!people.length) continue;
    if (!bestRaw.length) bestRaw = people;

    var strict = _applySmartListCriteria_(people, criteria, true);
    if (strict.length) {
      return { people: strict, source: "people.smartListQueryFallback.strictCriteria" };
    }

    var relaxed = _applySmartListCriteria_(people, criteria, false);
    if (relaxed.length) {
      return { people: relaxed, source: "people.smartListQueryFallback.relaxedCriteria" };
    }
  }
  if (bestRaw.length) {
    return { people: bestRaw, source: "people.smartListQueryFallback.rawQuery" };
  }
  return { people: [], source: "people.smartListQueryFallback.empty" };
}

function _deriveSmartListCriteria_(smartListName, smartListPayload) {
  var description = _clean_(
    (smartListPayload && smartListPayload.description) ||
    (smartListPayload && smartListPayload.smartList && smartListPayload.smartList.description) ||
    ""
  );
  var text = _normalizeLower_([smartListName, description].join(" "));

  var criteria = {
    stageHint: "",
    minHoursSinceCommunication: 0
  };

  if (text.indexOf("under contract") !== -1) criteria.stageHint = "under contract";
  else if (text.indexOf("pending") !== -1) criteria.stageHint = "pending";
  else if (text.indexOf("closed") !== -1) criteria.stageHint = "closed";

  // Matches phrases like "no communication in over 48 hours".
  var hoursMatch = text.match(/over\s+(\d+)\s*hours?/);
  if (hoursMatch && hoursMatch[1]) {
    criteria.minHoursSinceCommunication = _toInt_(hoursMatch[1], 0);
  }

  return criteria;
}

function _applySmartListCriteria_(people, criteria, strictComm) {
  if (!Array.isArray(people) || !people.length) return [];
  var nowTs = new Date().getTime();
  var stageHint = _normalizeLower_(criteria && criteria.stageHint);
  var minHours = _toInt_(criteria && criteria.minHoursSinceCommunication, 0);

  return people.filter(function(person) {
    if (stageHint) {
      var stage = _normalizeLower_(person && person.stage);
      if (stage.indexOf(stageHint) === -1) return false;
    }

    if (minHours > 0) {
      var lastCommTs = _extractLastCommunicationTs_(person);
      if (!lastCommTs) return strictComm ? false : true;
      var ageHours = (nowTs - lastCommTs) / 3600000;
      if (ageHours < minHours) return false;
    }

    return true;
  });
}

function _extractLastCommunicationTs_(person) {
  var candidates = [
    person && person.lastCommunicationAt,
    person && person.lastCommunication,
    person && person.lastTextAt,
    person && person.lastEmailAt,
    person && person.lastCallAt
  ];
  for (var i = 0; i < candidates.length; i++) {
    var ts = _toTimestamp_(candidates[i]);
    if (ts > 0) return ts;
  }
  return 0;
}

function _extractPeopleArray_(payload) {
  if (!payload || typeof payload !== "object") return [];
  if (Array.isArray(payload.people)) return payload.people;
  if (Array.isArray(payload.contacts)) return payload.contacts;
  if (Array.isArray(payload.results)) return payload.results;
  if (payload.data && Array.isArray(payload.data.people)) return payload.data.people;
  return [];
}

function _extractPersonIds_(payload) {
  var out = [];
  if (!payload || typeof payload !== "object") return out;

  var direct = [payload.personIds, payload.peopleIds, payload.ids];
  for (var i = 0; i < direct.length; i++) {
    var arr = direct[i];
    if (!Array.isArray(arr)) continue;
    for (var j = 0; j < arr.length; j++) {
      var id = _toInt_(arr[j], 0);
      if (id > 0) out.push(id);
    }
  }

  if (payload.smartList && typeof payload.smartList === "object") {
    var nested = _extractPersonIds_(payload.smartList);
    out = out.concat(nested);
  }

  return _dedupeNumbers_(out);
}

function _extractPersonIdsDeep_(payload) {
  var out = [];
  var visited = [];

  function walk(node) {
    if (!node || typeof node !== "object") return;
    if (visited.indexOf(node) !== -1) return;
    visited.push(node);

    if (Array.isArray(node)) {
      for (var i = 0; i < node.length; i++) {
        walk(node[i]);
      }
      return;
    }

    // Common list membership fields.
    var directKeys = ["personIds", "peopleIds", "ids", "contactIds"];
    for (var k = 0; k < directKeys.length; k++) {
      var key = directKeys[k];
      if (Array.isArray(node[key])) {
        for (var j = 0; j < node[key].length; j++) {
          var directId = _toInt_(node[key][j], 0);
          if (directId > 0) out.push(directId);
        }
      }
    }

    // Common nested row/object patterns.
    if (node.personId !== undefined) {
      var pid = _toInt_(node.personId, 0);
      if (pid > 0) out.push(pid);
    }
    if (node.contactId !== undefined) {
      var cid = _toInt_(node.contactId, 0);
      if (cid > 0) out.push(cid);
    }
    if (node.person && typeof node.person === "object") {
      var personObjId = _toInt_(node.person.id, 0);
      if (personObjId > 0) out.push(personObjId);
    }

    for (var prop in node) {
      if (!node.hasOwnProperty(prop)) continue;
      walk(node[prop]);
    }
  }

  walk(payload);
  return _dedupeNumbers_(out);
}

function _extractAssignees_(person) {
  var out = [];
  if (!person) return out;

  var fields = [person.assignedTo, person.assignees, person.assignedUser, person.owner, person.agent];
  for (var i = 0; i < fields.length; i++) {
    var value = fields[i];
    if (!value) continue;
    if (Array.isArray(value)) {
      for (var j = 0; j < value.length; j++) {
        if (value[j] && typeof value[j] === "object") out.push(value[j]);
      }
    } else if (typeof value === "object") {
      out.push(value);
    }
  }
  return out;
}

function _extractAssigneeIds_(person, assignees) {
  var ids = [];
  var scalarFields = [person && person.assignedToId, person && person.assignedUserId, person && person.ownerId];
  for (var i = 0; i < scalarFields.length; i++) {
    var scalarId = _toInt_(scalarFields[i], 0);
    if (scalarId > 0) ids.push(scalarId);
  }
  for (var j = 0; j < assignees.length; j++) {
    var assigneeId = _toInt_(assignees[j] && assignees[j].id, 0);
    if (assigneeId > 0) ids.push(assigneeId);
  }
  return _dedupeNumbers_(ids);
}

function _normalizeContact_(person) {
  var firstName = _clean_(person && person.firstName);
  var lastName = _clean_(person && person.lastName);
  var fullName = _clean_([firstName, lastName].join(" ")) || _clean_(person && person.name) || "Unknown Contact";
  var emails = Array.isArray(person && person.emails) ? person.emails : [];
  var phones = Array.isArray(person && person.phones) ? person.phones : [];

  return {
    id: person && person.id ? String(person.id) : "",
    name: fullName,
    email: emails.length ? _clean_(emails[0].value || emails[0].email) : "",
    phone: phones.length ? _clean_(phones[0].value || phones[0].number) : "",
    lastActivityAt: _latestPersonActivityIso_(person),
    lastActivityTs: _latestPersonActivityTs_(person),
    deals: [],
    dealTasks: { doneCount: 0, todoCount: 0, tasks: [] },
    adminTasks: { doneCount: 0, todoCount: 0, tasks: [] }
  };
}

function _normalizeDeals_(deals, person) {
  var normalized = deals.map(function(deal) {
    var stage = _clean_(deal && (deal.stageName || deal.stage || deal.status || deal.pipelineStage || deal.dealStage));
    var status = _deriveDealStatus_(stage, deal);
    var dealSide = _normalizeLower_(deal && (deal.side || deal.type || deal.dealType || deal.deal_side || ""));
    return {
      id: deal && deal.id ? String(deal.id) : "",
      title: _clean_(deal && (deal.name || deal.title)) || "Untitled Deal",
      status: status,
      stage: stage,
      side: dealSide,
      value: _toNumber_(deal && (deal.value || deal.price || deal.amount)),
      closeDate: _isoDateString_(deal && (deal.closeDate || deal.expectedCloseDate || deal.projectedCloseDate || deal.closedDate || deal.dealCloseDate))
    };
  });

  // Some /people payloads include flattened deal fields even when /deals is empty.
  if (!normalized.length) {
    var personDealTitle = _clean_(person && (person.dealName || person.name));
    var personDealStatus = _clean_(person && (person.dealStatus || person.dealStage));
    var personDealStage = _clean_(person && (person.dealStage || person.dealStatus));
    var personDealPrice = _toNumber_(person && person.dealPrice);
    if (personDealTitle || personDealStatus || personDealPrice > 0) {
      normalized.push({
        id: "person-" + _clean_(person && person.id),
        title: personDealTitle || "Deal",
        status: _deriveDealStatus_(personDealStatus || personDealStage, person || {}),
        stage: personDealStage || personDealStatus || "Unknown",
        side: _normalizeLower_(person && person.type),
        value: personDealPrice,
        closeDate: _isoDateString_(person && person.dealCloseDate)
      });
    }
  }

  return normalized;
}

function _hasQualifyingDeals_(deals) {
  if (!deals || !deals.length) return false;
  for (var i = 0; i < deals.length; i++) {
    var status = _normalizeLower_(deals[i] && deals[i].status);
    if (!_isCurrentDealStatus_(status)) {
      continue;
    }
    var side = _normalizeLower_(deals[i] && deals[i].side);
    // If side is present, require buy/sell semantics. If absent, keep the current-status deal.
    if (!side || /buy|buyer|sell|seller/.test(side)) {
      return true;
    }
  }
  return false;
}

function _isCurrentDealStatus_(status) {
  var s = _normalizeLower_(status);
  return s === "open";
}

function _normalizeDealTasks_(tasks, adminUserIds, agentUserIds) {
  var out = [];
  var doneCount = 0;
  var todoCount = 0;
  var adminDoneCount = 0;
  var adminTodoCount = 0;
  var agentDoneCount = 0;
  var agentTodoCount = 0;

  for (var i = 0; i < tasks.length; i++) {
    var task = tasks[i] || {};
    var roleInfo = _resolveTaskRole_(task, adminUserIds, agentUserIds);
    if (!roleInfo.include) continue;

    var completed = _taskCompleted_(task);
    var taskItem = {
      id: task.id ? String(task.id) : "",
      title: _clean_(task.name || task.body || task.title || task.subject) || "Untitled Task",
      completed: completed,
      dueDate: _isoDateString_(task.dueDate || task.dueDateTime || task.remindAt || task.createdAt),
      assigneeName: roleInfo.assigneeName,
      assigneeRole: roleInfo.role
    };
    out.push(taskItem);
    if (completed) doneCount++;
    else todoCount++;

    if (roleInfo.role === "admin") {
      if (completed) adminDoneCount++;
      else adminTodoCount++;
    } else if (roleInfo.role === "agent") {
      if (completed) agentDoneCount++;
      else agentTodoCount++;
    }
  }

  return {
    doneCount: doneCount,
    todoCount: todoCount,
    tasks: out,
    admin: {
      doneCount: adminDoneCount,
      todoCount: adminTodoCount
    },
    agent: {
      doneCount: agentDoneCount,
      todoCount: agentTodoCount
    }
  };
}

function _resolveTaskRole_(task, adminUserIds, agentUserIds) {
  var assignees = _extractTaskAssignees_(task);
  if (!assignees.length) {
    return { include: true, role: "shared", assigneeName: "Unassigned" };
  }

  var bestRole = "other";
  var assigneeName = _clean_(assignees[0].name || assignees[0].firstName || "");
  for (var i = 0; i < assignees.length; i++) {
    var a = assignees[i] || {};
    var id = _toInt_(a.id, 0);
    var role = _normalizeLower_(a.role || a.type || "");
    var title = _normalizeLower_(a.title || "");
    var name = _clean_(a.name || [a.firstName, a.lastName].join(" "));
    if (name) assigneeName = name;

    if (id > 0 && adminUserIds.indexOf(id) !== -1) {
      return { include: true, role: "admin", assigneeName: assigneeName };
    }
    if (role.indexOf("admin") !== -1 || title.indexOf("admin") !== -1) {
      return { include: true, role: "admin", assigneeName: assigneeName };
    }

    if (id > 0 && agentUserIds.indexOf(id) !== -1) {
      bestRole = "agent";
      continue;
    }
    if (role.indexOf("agent") !== -1 || title.indexOf("agent") !== -1) {
      bestRole = "agent";
    }
  }

  // For deal health snapshots, include tasks even if role is not classified.
  return { include: true, role: bestRole, assigneeName: assigneeName || "Assigned" };
}

function _extractTaskAssignees_(task) {
  var values = [task && task.assignedTo, task && task.assignees, task && task.owner];
  var out = [];
  for (var i = 0; i < values.length; i++) {
    var value = values[i];
    if (!value) continue;
    if (Array.isArray(value)) {
      for (var j = 0; j < value.length; j++) {
        if (value[j] && typeof value[j] === "object") out.push(value[j]);
      }
    } else if (typeof value === "object") {
      out.push(value);
    }
  }
  if (task && (task.assignedUserId || task.AssignedTo)) {
    out.push({
      id: task.assignedUserId || null,
      name: task.AssignedTo || ""
    });
  }
  return out;
}

function _taskCompleted_(task) {
  if (task && task.isCompleted === 1) return true;
  if (task && task.isCompleted === "1") return true;
  if (task && task.isCompleted === true) return true;
  if (task && task.completed === true) return true;
  if (task && task.completed && String(task.completed).trim() !== "") return true;
  var status = _normalizeLower_(task && task.status);
  return status === "completed" || status === "done";
}

function _buildSummary_(contacts) {
  var summary = _emptySummary_();
  for (var i = 0; i < contacts.length; i++) {
    var contact = contacts[i];
    summary.adminTasks.doneCount += _toInt_(contact && contact.adminTasks ? contact.adminTasks.doneCount : 0, 0);
    summary.adminTasks.todoCount += _toInt_(contact && contact.adminTasks ? contact.adminTasks.todoCount : 0, 0);
    summary.taskStatus.doneCount += _toInt_(contact && contact.dealTasks ? contact.dealTasks.doneCount : 0, 0);
    summary.taskStatus.todoCount += _toInt_(contact && contact.dealTasks ? contact.dealTasks.todoCount : 0, 0);

    var deals = Array.isArray(contact && contact.deals) ? contact.deals : [];
    for (var j = 0; j < deals.length; j++) {
      var status = _normalizeLower_(deals[j].status);
      summary.deals.total += 1;
      if (status === "open") summary.deals.open += 1;
      else if (status === "won") summary.deals.won += 1;
      else if (status === "lost") summary.deals.lost += 1;
      else if (status === "archived") summary.deals.archived += 1;
      else summary.deals.unknown += 1;
    }
  }
  return summary;
}

function _emptySummary_() {
  return {
    deals: {
      total: 0,
      open: 0,
      won: 0,
      lost: 0,
      archived: 0,
      unknown: 0
    },
    adminTasks: {
      doneCount: 0,
      todoCount: 0
    },
    taskStatus: {
      doneCount: 0,
      todoCount: 0
    }
  };
}

function _deriveDealStatus_(stage, deal) {
  var statusRaw = _normalizeLower_(stage || (deal && (deal.status || deal.state)));
  if (!statusRaw) return "unknown";
  if (/won|closedwon|closed_won|closed won/.test(statusRaw)) return "won";
  if (/lost|closedlost|closed_lost|closed lost/.test(statusRaw)) return "lost";
  if (/archive/.test(statusRaw)) return "archived";
  if (/open|active|new|pending|undercontract|under contract|escrow/.test(statusRaw)) return "open";
  return "unknown";
}

function _fubRequest_(apiKey, apiBase, path, query) {
  var url = _buildUrl_(apiBase, path, query);
  var auth = Utilities.base64Encode(apiKey + ":");
  var response;
  try {
    response = UrlFetchApp.fetch(url, {
      method: "get",
      muteHttpExceptions: true,
      headers: {
        Authorization: "Basic " + auth,
        Accept: "application/json"
      }
    });
  } catch (err) {
    throw new Error("Network error (" + path + "): " + (err && err.message ? err.message : String(err)));
  }

  var code = response.getResponseCode();
  var text = response.getContentText();
  var payload = {};
  if (text) {
    payload = JSON.parse(text);
  }

  if (code < 200 || code >= 300) {
    var errMessage = payload && payload.message ? payload.message : ("HTTP " + code);
    throw new Error("Follow Up Boss request failed (" + path + "): " + errMessage);
  }
  return payload;
}

function _tryFubRequest_(apiKey, apiBase, path, query) {
  try {
    return _fubRequest_(apiKey, apiBase, path, query);
  } catch (err) {
    return null;
  }
}

function _fetchDealsForPerson_(apiKey, apiBase, personId) {
  if (!personId) return { deals: [] };

  // Primary route (documented query filtering).
  var payload = _tryFubRequest_(apiKey, apiBase, "/deals", {
    personId: personId,
    limit: 50,
    includeArchived: 1
  });
  if (payload && Array.isArray(payload.deals)) return payload;

  // Fallback route used by some API versions/accounts.
  payload = _tryFubRequest_(apiKey, apiBase, "/people/" + encodeURIComponent(String(personId)) + "/deals", {
    limit: 50,
    includeArchived: 1
  });
  if (payload && Array.isArray(payload.deals)) return payload;

  // Final fallback: people detail may embed deals in some payload variants.
  payload = _tryFubRequest_(apiKey, apiBase, "/people/" + encodeURIComponent(String(personId)), {});
  if (payload && Array.isArray(payload.deals)) return { deals: payload.deals };

  return { deals: [] };
}

function _fetchTasksForPerson_(apiKey, apiBase, personId) {
  if (!personId) return { tasks: [] };

  // Primary route.
  var payload = _tryFubRequest_(apiKey, apiBase, "/tasks", {
    personId: personId,
    limit: 100
  });
  if (payload && Array.isArray(payload.tasks)) return payload;

  // Fallback route used by some API versions/accounts.
  payload = _tryFubRequest_(apiKey, apiBase, "/people/" + encodeURIComponent(String(personId)) + "/tasks", {
    limit: 100
  });
  if (payload && Array.isArray(payload.tasks)) return payload;

  return { tasks: [] };
}

function _buildUrl_(base, path, query) {
  var root = String(base || "").replace(/\/+$/, "");
  var endpoint = String(path || "").replace(/^\/+/, "");
  var url = root + "/" + endpoint;
  var pairs = [];
  for (var key in query) {
    if (!query.hasOwnProperty(key)) continue;
    var value = query[key];
    if (value === "" || value === null || value === undefined) continue;
    pairs.push(encodeURIComponent(key) + "=" + encodeURIComponent(String(value)));
  }
  if (pairs.length) {
    url += "?" + pairs.join("&");
  }
  return url;
}

function _parseCsvNumbers_(raw) {
  var values = String(raw || "")
    .split(",")
    .map(function(part) { return _toInt_(part, 0); })
    .filter(function(num) { return num > 0; });
  return values;
}

function _hasOverlap_(a, b) {
  var lookup = {};
  for (var i = 0; i < b.length; i++) lookup[b[i]] = true;
  for (var j = 0; j < a.length; j++) {
    if (lookup[a[j]]) return true;
  }
  return false;
}

function _dedupeNumbers_(values) {
  var seen = {};
  var out = [];
  for (var i = 0; i < values.length; i++) {
    var n = _toInt_(values[i], 0);
    if (n <= 0 || seen[n]) continue;
    seen[n] = true;
    out.push(n);
  }
  return out;
}

function _isoDateString_(value) {
  if (!value && value !== 0) return "";
  var d = value instanceof Date ? value : new Date(value);
  if (!d || isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function _latestPersonActivityTs_(person) {
  var candidates = [
    person && person.lastActivityAt,
    person && person.lastCommunicationAt,
    person && person.lastCommunication,
    person && person.lastNoteAt,
    person && person.lastEmailAt,
    person && person.lastCallAt,
    person && person.updatedAt,
    person && person.updated
  ];
  for (var i = 0; i < candidates.length; i++) {
    var ts = _toTimestamp_(candidates[i]);
    if (ts > 0) return ts;
  }
  return 0;
}

function _latestPersonActivityIso_(person) {
  var ts = _latestPersonActivityTs_(person);
  if (!ts) return "";
  return new Date(ts).toISOString();
}

function _clean_(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function _normalizeLower_(value) {
  return _clean_(value).toLowerCase();
}

function _toInt_(value, fallback) {
  var n = parseInt(value, 10);
  return isNaN(n) ? fallback : n;
}

function _safeInt_(value, fallback) {
  var n = Number(value);
  if (!isFinite(n)) return fallback;
  return Math.floor(n);
}

function _toNumber_(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return value;
  var parsed = Number(String(value).replace(/[$,]/g, "").trim());
  return isNaN(parsed) ? 0 : parsed;
}

function _toTimestamp_(value) {
  if (!value && value !== 0) return 0;
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? 0 : value.getTime();
  }
  var d = new Date(value);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

function _clamp_(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function _json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
