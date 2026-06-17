/* ASG Admin Console — shell logic: Google/email auth, chip navigation,
   account management, the write drawer (-> /api/admin/*), and usage tracking. */
(function () {
  var B = window.ASG_API_BASE;
  var app = document.getElementById("asgc-app");
  var loginMsg = document.getElementById("asgcLoginMsg");
  var state = { session: null, token: null, profile: null, mode: "login" };

  /* ---- Supabase client ---- */
  var supa = null;
  if (window.supabase && window.ASG_SUPABASE_URL && window.ASG_SUPABASE_ANON_KEY) {
    supa = window.supabase.createClient(window.ASG_SUPABASE_URL, window.ASG_SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }

  /* ---- helpers ---- */
  function toast(msg, isErr) {
    var t = document.getElementById("asgc-toast");
    t.textContent = msg;
    t.className = "is-show" + (isErr ? " is-err" : "");
    clearTimeout(t._t);
    t._t = setTimeout(function () { t.className = ""; }, 3200);
  }
  function authHeaders() {
    var h = { "Content-Type": "application/json" };
    if (state.token) h.Authorization = "Bearer " + state.token;
    return h;
  }
  /* Bridge so injected surfaces (e.g. the Listings workshop) can make
     authenticated calls and react to becoming visible without reaching into
     this closure. */
  window.ASGConsole = {
    apiBase: B,
    authHeaders: authHeaders,
    token: function () { return state.token; },
    profile: function () { return state.profile; },
    toast: toast,
    _surfaceCbs: [],
    onSurface: function (cb) { if (typeof cb === "function") this._surfaceCbs.push(cb); },
    _emitSurface: function (name) {
      for (var i = 0; i < this._surfaceCbs.length; i++) {
        try { this._surfaceCbs[i](name); } catch (e) {}
      }
    },
  };
  function initials(name, email) {
    var s = (name || email || "?").trim();
    var parts = s.split(/[\s@.]+/).filter(Boolean);
    return ((parts[0] || "")[0] || "" + (parts[1] ? parts[1][0] : "")).toUpperCase().slice(0, 2) ||
      s.slice(0, 2).toUpperCase();
  }
  function logEvent(type, label, meta) {
    if (!window.ASG_USAGE_LOG_API) return;
    try {
      fetch(window.ASG_USAGE_LOG_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: type, page: "admin-console", label: label,
          url: location.href,
          agent_email: state.profile && state.profile.email,
          agent_name: state.profile && state.profile.fullName,
          session_id: state.session && state.session.user && state.session.user.id,
          meta: meta || {},
        }),
        keepalive: true,
      }).catch(function () {});
    } catch (e) {}
  }

  /* ---- auth ---- */
  function showLoginMsg(msg, kind) {
    loginMsg.textContent = msg || "";
    loginMsg.className = "asgc-msg" + (kind ? " is-" + kind : "");
  }

  async function handleSession(session) {
    if (!session) { state.session = null; state.token = null; state.profile = null; return; }
    state.session = session;
    state.token = session.access_token;
    try {
      var res = await fetch(B + "/api/auth/me", { headers: authHeaders() });
      var data = await res.json();
      if (!data.ok || !data.profile) throw new Error("no profile");
      var role = data.profile.role;
      if (role !== "admin" && role !== "agent") {
        showLoginMsg("This account is not an ASG staff account.", "err");
        await supa.auth.signOut();
        return;
      }
      state.profile = data.profile;
      enterApp();
    } catch (e) {
      showLoginMsg("Could not verify your account. " + (e.message || ""), "err");
    }
  }

  function enterApp() {
    app.setAttribute("data-ready", "1");
    app.setAttribute("data-state", "");
    var p = state.profile;
    paintProfile();
    setSurface("overview");
    logEvent("action", "login", { role: p.role });
    loadHeadshot();
    setTimeout(function () { window.dispatchEvent(new Event("resize")); }, 200);
  }

  /* ---- team-directory headshot ---- */
  function setAvatar(el, url, name, email) {
    if (!el) return;
    if (url) el.innerHTML = '<img src="' + escapeHtml(url) + '" alt="' + escapeHtml(name || email || "") + '">';
    else el.textContent = initials(name, email);
  }
  async function loadHeadshot() {
    var p = state.profile;
    if (!p || !p.email) return;
    try {
      var res = await fetch(B + "/api/directory");
      var data = await res.json();
      var list = data.directory || [];
      var me = list.filter(function (m) { return String(m.email || "").toLowerCase() === p.email.toLowerCase(); })[0];
      state.photo = me && me.headshot ? me.headshot : null;
      if (state.photo) {
        paintProfile();
        setAvatar(document.getElementById("asgcAcctBig"), state.photo, p.fullName, p.email);
      }
    } catch (e) { /* keep initials */ }
  }

  function bindAuth() {
    var googleBtn = document.getElementById("asgcGoogle");
    var form = document.getElementById("asgcEmailForm");
    var toggle = document.getElementById("asgcToggleMode");
    var nameField = document.getElementById("asgcNameField");
    var submitBtn = document.getElementById("asgcEmailSubmit");
    var toggleText = document.getElementById("asgcToggleText");

    if (!supa) { showLoginMsg("Auth library not loaded. Check the Supabase config.", "err"); }

    googleBtn.addEventListener("click", function () {
      if (!supa) return;
      showLoginMsg("Redirecting to Google…");
      supa.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: location.href.split("#")[0], queryParams: { hd: "compass.com" } },
      });
    });

    toggle.addEventListener("click", function () {
      state.mode = state.mode === "login" ? "signup" : "login";
      var signup = state.mode === "signup";
      nameField.hidden = !signup;
      submitBtn.textContent = signup ? "Create account" : "Sign in";
      toggleText.textContent = signup ? "Already have an account?" : "Need an account?";
      toggle.textContent = signup ? "Sign in" : "Create one";
      document.getElementById("asgcPassword").setAttribute("autocomplete", signup ? "new-password" : "current-password");
      showLoginMsg("");
    });

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      if (!supa) return;
      var email = document.getElementById("asgcEmail").value.trim().toLowerCase();
      var password = document.getElementById("asgcPassword").value;
      var name = document.getElementById("asgcName").value.trim();
      submitBtn.disabled = true;
      try {
        if (state.mode === "signup") {
          showLoginMsg("Creating account…");
          var r = await supa.auth.signUp({ email: email, password: password, options: { data: { full_name: name } } });
          if (r.error) throw r.error;
          if (!r.data.session) { showLoginMsg("Account created. Check your email to confirm, then sign in.", "ok"); state.mode = "login"; }
        } else {
          showLoginMsg("Signing in…");
          var s = await supa.auth.signInWithPassword({ email: email, password: password });
          if (s.error) throw s.error;
        }
      } catch (err) {
        showLoginMsg(err.message || "Sign in failed.", "err");
      } finally {
        submitBtn.disabled = false;
      }
    });

    supa && supa.auth.onAuthStateChange(function (_evt, session) { handleSession(session); });
    supa && supa.auth.getSession().then(function (r) { if (r.data.session) handleSession(r.data.session); });
  }

  /* ---- surface navigation ---- */
  function setSurface(name) {
    var surfaces = app.querySelectorAll(".asgc-surface");
    for (var i = 0; i < surfaces.length; i++) surfaces[i].hidden = surfaces[i].getAttribute("data-surface") !== name;
    var items = document.querySelectorAll(".asgc-nav-link, .asgc-mlink");
    for (var j = 0; j < items.length; j++) items[j].classList.toggle("is-active", items[j].getAttribute("data-go") === name);
    try { window.scrollTo({ top: 0, behavior: "auto" }); } catch (e) { window.scrollTo(0, 0); }
    window.dispatchEvent(new Event("resize"));
    if (name === "account") loadAccount();
    if (window.ASGConsole) window.ASGConsole._emitSurface(name);
    logEvent("view", name);
  }

  function bindNav() {
    function go(e) {
      var it = e.target.closest("[data-go]");
      if (!it) return;
      setSurface(it.getAttribute("data-go"));
      closeMobile();
    }
    document.getElementById("asgcChips").addEventListener("click", go);
    document.getElementById("asgcMpanel").addEventListener("click", go);
    document.getElementById("asgcLogoBtn").addEventListener("click", function () { setSurface("overview"); closeMobile(); });
    document.getElementById("asgcAcctBtn").addEventListener("click", function () { setSurface("account"); });
    var so = document.getElementById("asgcSignOutM");
    if (so) so.addEventListener("click", doSignOut);
    bindNavChrome();
  }

  /* ---- nav chrome: scroll state, hover ghost pill, mobile menu ---- */
  function bindNavChrome() {
    var nav = document.getElementById("asgcNav");
    var frost = document.getElementById("asgcNavFrost");
    var last = false;
    function onScroll() {
      var s = (window.scrollY || 0) > 24;
      if (s !== last) { nav.classList.toggle("is-scrolled", s); frost.classList.toggle("is-scrolled", s); last = s; }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    var wrap = document.getElementById("asgcChips");
    var ghost = document.getElementById("asgcNavGhost");
    wrap.querySelectorAll(".asgc-nav-link").forEach(function (link) {
      link.addEventListener("mouseenter", function () {
        var wb = wrap.getBoundingClientRect(), b = link.getBoundingClientRect();
        ghost.style.left = (b.left - wb.left) + "px";
        ghost.style.width = b.width + "px";
        ghost.classList.add("is-on");
      });
    });
    wrap.addEventListener("mouseleave", function () { ghost.classList.remove("is-on"); });

    var burger = document.getElementById("asgcBurger");
    var panel = document.getElementById("asgcMpanel");
    burger.addEventListener("click", function () {
      var open = !panel.classList.contains("is-open");
      panel.classList.toggle("is-open", open);
      burger.classList.toggle("is-open", open);
      burger.setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeMobile(); });
  }
  function closeMobile() {
    var panel = document.getElementById("asgcMpanel");
    if (!panel) return;
    panel.classList.remove("is-open");
    var burger = document.getElementById("asgcBurger");
    if (burger) { burger.classList.remove("is-open"); burger.setAttribute("aria-expanded", "false"); }
  }

  /* ---- profile chrome (nav + mobile panel) ---- */
  function paintProfile() {
    var p = state.profile; if (!p) return;
    var name = p.fullName || p.email || "Account";
    document.getElementById("asgcAcctName").firstChild.textContent = name + " ";
    document.getElementById("asgcAcctRole").textContent = p.role || "";
    var mn = document.getElementById("asgcMname"); if (mn) mn.firstChild.textContent = name + " ";
    var mr = document.getElementById("asgcMrole"); if (mr) mr.textContent = p.role || "";
    setAvatar(document.getElementById("asgcAvatar"), state.photo, name, p.email);
    setAvatar(document.getElementById("asgcAvatarM"), state.photo, name, p.email);
  }
  async function doSignOut() {
    logEvent("action", "logout", {});
    if (supa) await supa.auth.signOut();
    location.reload();
  }

  /* ---- account surface ---- */
  async function loadAccount() {
    var p = state.profile; if (!p) return;
    setAvatar(document.getElementById("asgcAcctBig"), state.photo, p.fullName, p.email);
    document.getElementById("asgcAcctH2").textContent = p.fullName || "Your account";
    document.getElementById("asgcPfName").value = p.fullName || "";
    document.getElementById("asgcPfPhone").value = p.phone || "";
    document.getElementById("asgcPfEmail").value = p.email || "";
    document.getElementById("asgcPfRole").value = p.role || "";
    var box = document.getElementById("asgcActivity");
    box.innerHTML = '<p style="color:rgba(0,0,0,.4);font-size:13px">Loading activity…</p>';
    try {
      var res = await fetch(B + "/api/admin/activity?limit=40&email=" + encodeURIComponent(p.email || ""), { headers: authHeaders() });
      var data = await res.json();
      var rows = (data.events || []).map(function (ev) {
        var when = ev.ts ? new Date(ev.ts).toLocaleString() : "";
        var lbl = (ev.type === "action" ? "● " : "") + (ev.label || ev.type || "event");
        return '<div class="asgc-act-row"><span class="lbl">' + escapeHtml(lbl) + '</span><span class="ts">' + escapeHtml(when) + "</span></div>";
      });
      box.innerHTML = rows.length ? rows.join("") : '<p style="color:rgba(0,0,0,.4);font-size:13px">No activity yet.</p>';
    } catch (e) {
      box.innerHTML = '<p style="color:rgba(0,0,0,.4);font-size:13px">Could not load activity.</p>';
    }
  }

  function bindAccount() {
    document.getElementById("asgcSaveProfile").addEventListener("click", async function () {
      var body = {
        fullName: document.getElementById("asgcPfName").value.trim(),
        phone: document.getElementById("asgcPfPhone").value.trim(),
      };
      try {
        var res = await fetch(B + "/api/auth/me", { method: "PATCH", headers: authHeaders(), body: JSON.stringify(body) });
        var data = await res.json();
        if (!data.ok) throw new Error(data.error || "save failed");
        state.profile.fullName = data.profile.full_name; state.profile.phone = data.profile.phone;
        paintProfile();
        toast("Profile saved");
        logEvent("action", "profile.update", {});
      } catch (e) { toast(e.message || "Save failed", true); }
    });
    document.getElementById("asgcSignOut").addEventListener("click", doSignOut);
  }

  /* ---- write drawer ---- */
  var FORMS = {
    listing: {
      title: "New listing", action: "listing.create", reloadAfter: true,
      hint: "Creates a listing in Supabase. Loose values like \"$1.25M\" are accepted.",
      fields: [
        { k: "address", label: "Address", required: true },
        { k: "status", label: "Status", type: "select", opts: ["Active", "Under Contract", "Closed", "Coming Soon"] },
        { k: "listPrice", label: "List price" },
        { k: "beds", label: "Beds" }, { k: "baths", label: "Baths" },
        { k: "neighborhood", label: "Neighborhood" },
        { k: "agentName", label: "Agent name" },
      ],
      submit: function (v) { return { method: "POST", path: "/api/admin/listings", body: v }; },
    },
    listingEdit: {
      title: "Edit listing", action: "listing.update", reloadAfter: true,
      hint: "Pick a listing, then change any field. Blank fields are left unchanged.",
      fields: [
        { k: "id", label: "Listing", type: "listingSelect", required: true },
        { k: "status", label: "Status", type: "select", opts: ["", "Active", "Under Contract", "Closed", "Coming Soon"] },
        { k: "phaseKey", label: "Phase", type: "select", opts: ["", "secured", "media", "live", "underContract", "closed"] },
        { k: "listPrice", label: "List price" },
        { k: "coverImageUrl", label: "Cover image URL" },
        { k: "archived", label: "Archived", type: "check" },
      ],
      submit: function (v) { var id = v.id; delete v.id; return { method: "PATCH", path: "/api/admin/listings/" + id, body: v }; },
    },
    workflow: {
      title: "Deal workflow", action: "dealWorkflow.upsert", reloadAfter: false,
      hint: "Update the Deal Tracker checklist for a FUB deal id.",
      fields: [
        { k: "dealId", label: "FUB deal id", required: true },
        { k: "inspectionScheduled", label: "Inspection scheduled", type: "check", grp: "checklist" },
        { k: "inspectionDone", label: "Inspection done", type: "check", grp: "checklist" },
        { k: "appraisalDone", label: "Appraisal done", type: "check", grp: "checklist" },
        { k: "mortgageCommitment", label: "Mortgage commitment", type: "check", grp: "checklist" },
        { k: "finalWalkScheduled", label: "Final walk scheduled", type: "check", grp: "checklist" },
        { k: "finalWalkDone", label: "Final walk done", type: "check", grp: "checklist" },
        { k: "closingStatement", label: "Closing statement", type: "check", grp: "checklist" },
        { k: "reviewSent", label: "Review sent", type: "check", grp: "checklist" },
        { k: "commissionStatement", label: "Commission statement", type: "check", grp: "checklist" },
        { k: "socialPost", label: "Social post", type: "check", grp: "checklist" },
        { k: "followUp3wk", label: "3-week follow up", type: "check", grp: "checklist" },
      ],
      submit: function (v) {
        var checklist = {}; var body = { dealId: v.dealId, checklist: checklist };
        Object.keys(v).forEach(function (k) { if (k !== "dealId") checklist[k] = v[k]; });
        return { method: "POST", path: "/api/admin/deal-workflow", body: body };
      },
    },
    agent: {
      title: "Team member", action: "agent.create", reloadAfter: true,
      hint: "Adds a new agent to the directory.",
      fields: [
        { k: "name", label: "Name", required: true },
        { k: "email", label: "Email" },
        { k: "tier", label: "Tier", type: "select", opts: ["junior", "senior", "admin"] },
        { k: "phone", label: "Phone" },
        { k: "role", label: "Role / title" },
      ],
      submit: function (v) { return { method: "POST", path: "/api/admin/agents", body: v }; },
    },
    update: {
      title: "Announcement", action: "update.create", reloadAfter: false,
      hint: "Posts a team announcement.",
      fields: [
        { k: "title", label: "Title", required: true },
        { k: "body", label: "Body", type: "textarea" },
        { k: "pinned", label: "Pin to top", type: "check" },
      ],
      submit: function (v) { return { method: "POST", path: "/api/admin/updates", body: v }; },
    },
  };
  var currentForm = "listing";
  var listingCache = null;

  function escapeHtml(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  async function ensureListings() {
    if (listingCache) return listingCache;
    try {
      var res = await fetch(window.ASG_LISTINGS_API + (window.ASG_LISTINGS_API.indexOf("?") >= 0 ? "&" : "?") + "view=all");
      var data = await res.json();
      var arr = data.listings || data.items || [];
      listingCache = arr.map(function (l) { return { id: l.id || l.listingId || "", address: l.address || l.title || "(no address)" }; }).filter(function (l) { return l.id; });
    } catch (e) { listingCache = []; }
    return listingCache;
  }

  async function renderForm(key) {
    currentForm = key;
    var def = FORMS[key];
    var body = document.getElementById("asgcDrawerBody");
    var html = '<p class="asgc-hint">' + escapeHtml(def.hint) + "</p>";
    for (var i = 0; i < def.fields.length; i++) {
      var f = def.fields[i];
      var id = "asgcF_" + f.k;
      if (f.type === "check") {
        html += '<label class="asgc-check"><input type="checkbox" id="' + id + '"> ' + escapeHtml(f.label) + "</label>";
      } else if (f.type === "textarea") {
        html += '<div class="asgc-form-row"><label>' + escapeHtml(f.label) + '</label><textarea class="asgc-input" id="' + id + '" rows="4"></textarea></div>';
      } else if (f.type === "select") {
        var opts = f.opts.map(function (o) { return '<option value="' + escapeHtml(o) + '">' + escapeHtml(o || "—") + "</option>"; }).join("");
        html += '<div class="asgc-form-row"><label>' + escapeHtml(f.label) + '</label><select class="asgc-input" id="' + id + '">' + opts + "</select></div>";
      } else if (f.type === "listingSelect") {
        html += '<div class="asgc-form-row"><label>' + escapeHtml(f.label) + '</label><select class="asgc-input" id="' + id + '"><option value="">Loading listings…</option></select></div>';
      } else {
        html += '<div class="asgc-form-row"><label>' + escapeHtml(f.label) + (f.required ? " *" : "") + '</label><input class="asgc-input" id="' + id + '" type="text"></div>';
      }
    }
    body.innerHTML = html;
    var sel = def.fields.filter(function (f) { return f.type === "listingSelect"; })[0];
    if (sel) {
      var listings = await ensureListings();
      var el = document.getElementById("asgcF_" + sel.k);
      if (el) el.innerHTML = '<option value="">Select a listing…</option>' + listings.map(function (l) { return '<option value="' + escapeHtml(l.id) + '">' + escapeHtml(l.address) + "</option>"; }).join("");
    }
  }

  async function submitForm() {
    var def = FORMS[currentForm];
    var v = {};
    var missing = null;
    def.fields.forEach(function (f) {
      var el = document.getElementById("asgcF_" + f.k);
      if (!el) return;
      var val = f.type === "check" ? el.checked : el.value.trim();
      if (f.required && (val === "" || val === false)) missing = f.label;
      if (f.type === "check") { if (val) v[f.k] = true; else if (currentForm === "listingEdit" || currentForm === "workflow") v[f.k] = false; }
      else if (val !== "") v[f.k] = val;
    });
    if (missing) { toast(missing + " is required", true); return; }
    var req = def.submit(v);
    var saveBtn = document.getElementById("asgcDrawerSave");
    saveBtn.disabled = true;
    try {
      var res = await fetch(B + req.path, { method: req.method, headers: authHeaders(), body: JSON.stringify(req.body) });
      var data = await res.json();
      if (!res.ok || data.ok === false) throw new Error(data.error || ("HTTP " + res.status));
      logEvent("action", def.action, { path: req.path });
      listingCache = null;
      toast("Saved");
      closeAction();
      if (def.reloadAfter) { toast("Saved. Refreshing…"); setTimeout(function () { location.reload(); }, 900); }
    } catch (e) {
      toast(e.message || "Save failed", true);
    } finally {
      saveBtn.disabled = false;
    }
  }

  /* ---- action center (FAB + glass bento modal) ---- */
  var ACTION_ICONS = {
    listing: '<svg viewBox="0 0 24 24" fill="none"><path d="M3 11l9-7 9 7M5 10v9h5v-5h4v5h5v-9" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/></svg>',
    listingEdit: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 20h16M5 15.5l9.5-9.5 3.5 3.5L8.5 19 4 20l1-4.5z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/></svg>',
    workflow: '<svg viewBox="0 0 24 24" fill="none"><path d="M9 6h11M9 12h11M9 18h11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M4 6l1 1 1.5-2M4 12l1 1 1.5-2M4 18l1 1 1.5-2" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/></svg>',
    agent: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.4" stroke="currentColor" stroke-width="1.8"/><path d="M5.5 20a6.5 6.5 0 0113 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    update: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 9v6h3l8 4V5L7 9H4zM18 9a3 3 0 010 6" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  };
  var ACTION_SUB = {
    listing: "Add a new property to the hub.",
    listingEdit: "Update status, phase, price or cover.",
    workflow: "Advance the deal tracker checklist.",
    agent: "Add a member to the team directory.",
    update: "Post a team-wide announcement.",
  };

  function buildBento() {
    var bento = document.getElementById("asgcBento");
    bento.innerHTML = Object.keys(FORMS).map(function (key) {
      var d = FORMS[key];
      return '<button class="asgc-tile" data-form="' + key + '" type="button">' +
        '<span class="asgc-tile-ic">' + (ACTION_ICONS[key] || "") + "</span>" +
        '<span><span class="asgc-tile-tt">' + escapeHtml(d.title) + "</span>" +
        '<span class="asgc-tile-sb">' + escapeHtml(ACTION_SUB[key] || d.hint) + "</span></span>" +
        "</button>";
    }).join("");
  }
  function showPicker() {
    document.getElementById("asgcActionPicker").hidden = false;
    document.getElementById("asgcActionForm").hidden = true;
  }
  function showActionForm(key) {
    document.getElementById("asgcActionFormTitle").textContent = FORMS[key].title;
    document.getElementById("asgcActionPicker").hidden = true;
    document.getElementById("asgcActionForm").hidden = false;
    renderForm(key);
  }
  function openAction() {
    buildBento();
    showPicker();
    document.getElementById("asgc-action").classList.add("is-open");
    app.setAttribute("data-state", "open");
  }
  function closeAction() {
    document.getElementById("asgc-action").classList.remove("is-open");
    app.setAttribute("data-state", "");
  }

  function bindAction() {
    document.getElementById("asgc-fab").addEventListener("click", openAction);
    document.getElementById("asgcActionX").addEventListener("click", closeAction);
    document.getElementById("asgcActionScrim").addEventListener("click", closeAction);
    document.getElementById("asgcActionBack").addEventListener("click", showPicker);
    document.getElementById("asgcDrawerSave").addEventListener("click", submitForm);
    document.getElementById("asgcBento").addEventListener("click", function (e) {
      var tile = e.target.closest(".asgc-tile");
      if (tile) showActionForm(tile.getAttribute("data-form"));
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && document.getElementById("asgc-action").classList.contains("is-open")) closeAction();
    });
  }

  /* ---- boot ---- */
  function boot() { bindAuth(); bindNav(); bindAccount(); bindAction(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
