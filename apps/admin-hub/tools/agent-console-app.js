/* ASG Agent Hub — shell logic: Google/email auth, pill navigation, and per-agent
   personalization. After login it resolves the signed-in agent from the Supabase
   directory and publishes `window.ASG_AGENT`, which the embedded Overview (the
   personal-hub component) and Marketing surface read to render for that agent. */
(function () {
  var B = window.ASG_API_BASE;
  var app = document.getElementById("asgc-app");
  var loginMsg = document.getElementById("asgcLoginMsg");
  var state = { session: null, token: null, profile: null, mode: "login", photo: null };
  var overviewInited = false;
  var marketingInited = false;

  /* ---- Supabase client ---- */
  var supa = null;
  if (window.supabase && window.ASG_SUPABASE_URL && window.ASG_SUPABASE_ANON_KEY) {
    supa = window.supabase.createClient(window.ASG_SUPABASE_URL, window.ASG_SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }

  /* ---- helpers ---- */
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
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
  window.ASGConsole = {
    apiBase: B,
    authHeaders: authHeaders,
    token: function () { return state.token; },
    profile: function () { return state.profile; },
    toast: toast,
    _surfaceCbs: [],
    onSurface: function (cb) { if (typeof cb === "function") this._surfaceCbs.push(cb); },
    _emitSurface: function (name) {
      for (var i = 0; i < this._surfaceCbs.length; i++) { try { this._surfaceCbs[i](name); } catch (e) {} }
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
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: type, page: "agent-hub", label: label, url: location.href,
          agent_email: state.profile && state.profile.email,
          agent_name: state.profile && state.profile.fullName,
          session_id: state.session && state.session.user && state.session.user.id,
          meta: meta || {},
        }),
        keepalive: true,
      }).catch(function () {});
    } catch (e) {}
  }

  /* ---- per-agent identity (feeds window.ASG_AGENT) ---- */
  function digits(s) { return String(s || "").replace(/[^0-9]/g, ""); }
  function buildBookUrl(name, email, phone) {
    var parts = String(name || "").trim().split(/\s+/);
    var first = parts.shift() || "";
    var last = parts.join(" ");
    var q = "firstName=" + encodeURIComponent(first) +
      "&lastName=" + encodeURIComponent(last) +
      "&email=" + encodeURIComponent(email || "") +
      "&phone=" + encodeURIComponent(digits(phone)) +
      "&field:18245579=" + encodeURIComponent(name || "") +
      "&field:18245580=" + encodeURIComponent("Agent Hub");
    return "https://asgmarketing.as.me/?" + q;
  }
  function matchTokensFor(name, fubName) {
    var set = {};
    [name, fubName].forEach(function (n) {
      if (!n) return;
      var low = String(n).toLowerCase().trim();
      set[low] = 1;
      set[low.replace(/\s+/g, "")] = 1;
      var toks = low.split(/\s+/);
      if (toks.length) set[toks[toks.length - 1]] = 1; // last name
    });
    return Object.keys(set).filter(Boolean);
  }
  async function resolveAgent() {
    var p = state.profile;
    var me = null;
    try {
      var res = await fetch(B + "/api/directory");
      var data = await res.json();
      var list = data.directory || [];
      me = list.filter(function (m) {
        return String(m.email || "").toLowerCase() === String(p.email || "").toLowerCase();
      })[0] || null;
    } catch (e) { /* fall back to auth profile below */ }

    var name = (me && me.name) || p.fullName || p.email;
    var email = (me && me.email) || p.email;
    var phone = (me && me.phone) || p.phone || "";
    // Rule: agent avatars always come from the directory icon_photo_url.
    var photo = (me && (me.iconPhotoUrl || me.headshot)) || null;
    var landing = (me && me.landingPageUrl) || null;
    var request = (me && me.marketingRequestUrl) || null;
    var fubName = (me && me.fubName) || name;
    state.photo = photo;

    window.ASG_AGENT = {
      profile: {
        name: name, tier: (me && me.role) || "Agent", email: email, phone: phone,
        photo: photo, landing: landing,
        book: buildBookUrl(name, email, phone),
        request: request,
      },
      // convenience mirrors used by the Marketing surface
      name: name, email: email, photo: photo, landing: landing,
      book: buildBookUrl(name, email, phone), request: request,
      fubName: fubName,
      matchTokens: matchTokensFor(name, fubName),
      marketingFolder: (me && me.marketingDriveUrl) || null,
      sellerWizard: window.ASG_SELLER_WIZARD_URL || null,
      branding: {
        marketingDriveUrl: (me && me.marketingDriveUrl) || null,
        buyerGuideUrl: (me && me.buyerGuideUrl) || null,
        sellerGuideUrl: (me && me.sellerGuideUrl) || null,
        listingPresentationUrl: (me && me.listingPresentationUrl) || null,
        businessCardUrl: (me && me.businessCardUrl) || null,
        buyerGuideUpdatedAt: (me && me.buyerGuideUpdatedAt) || null,
        sellerGuideUpdatedAt: (me && me.sellerGuideUpdatedAt) || null,
        listingPresentationUpdatedAt: (me && me.listingPresentationUpdatedAt) || null,
        businessCardUpdatedAt: (me && me.businessCardUpdatedAt) || null,
      },
    };
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
      if (role === "client" || (role !== "agent" && role !== "admin")) {
        showLoginMsg("This account isn't an ASG agent account.", "err");
        await supa.auth.signOut();
        return;
      }
      state.profile = data.profile;
      await resolveAgent();
      enterApp();
    } catch (e) {
      showLoginMsg("Could not verify your account. " + (e.message || ""), "err");
    }
  }

  function bindAuth() {
    var googleBtn = document.getElementById("asgcGoogle");
    var form = document.getElementById("asgcEmailForm");
    var toggle = document.getElementById("asgcToggleMode");
    var nameField = document.getElementById("asgcNameField");
    var submitBtn = document.getElementById("asgcEmailSubmit");
    var toggleText = document.getElementById("asgcToggleText");

    if (!supa) showLoginMsg("Auth library not loaded. Check the Supabase config.", "err");

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

  function enterApp() {
    app.setAttribute("data-ready", "1");
    app.setAttribute("data-state", "");
    paintProfile();
    setSurface(surfaceFromHash(), { fromHash: true });
    logEvent("action", "login", { role: state.profile.role });
    setTimeout(function () { window.dispatchEvent(new Event("resize")); }, 200);
  }

  /* ---- avatar / profile ---- */
  function setAvatar(el, url, name, email) {
    if (!el) return;
    if (url) el.innerHTML = '<img src="' + escapeHtml(url) + '" alt="' + escapeHtml(name || email || "") + '">';
    else el.textContent = initials(name, email);
  }
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

  /* ---- surface navigation ---- */
  var SURFACES = ["overview", "listings", "deals", "marketing", "resources", "account"];

  function initSurfaceScripts(name) {
    // Overview and Marketing render from window.ASG_AGENT; init them lazily the
    // first time they're shown (after the agent identity is resolved).
    if (name === "overview" && !overviewInited && typeof window.__asgInitOverview === "function") {
      overviewInited = true;
      try { window.__asgInitOverview(); } catch (e) {}
    }
    if (name === "marketing" && !marketingInited && typeof window.__asgInitMarketing === "function") {
      marketingInited = true;
      try { window.__asgInitMarketing(); } catch (e) {}
    }
  }

  function setSurface(name, opts) {
    if (SURFACES.indexOf(name) === -1) name = "overview";
    var surfaces = app.querySelectorAll(".asgc-surface");
    for (var i = 0; i < surfaces.length; i++) surfaces[i].hidden = surfaces[i].getAttribute("data-surface") !== name;
    var items = document.querySelectorAll(".asgc-nav-link, .asgc-mlink");
    for (var j = 0; j < items.length; j++) items[j].classList.toggle("is-active", items[j].getAttribute("data-go") === name);
    try { window.scrollTo({ top: 0, behavior: "auto" }); } catch (e) { window.scrollTo(0, 0); }
    initSurfaceScripts(name);
    window.dispatchEvent(new Event("resize"));
    if (!opts || !opts.fromHash) {
      var target = "#" + name;
      if (location.hash !== target) {
        try { history.replaceState(null, "", target); } catch (e) { location.hash = name; }
      }
    }
    if (name === "account") loadAccount();
    if (window.ASGConsole) window.ASGConsole._emitSurface(name);
    logEvent("view", name);
  }

  function surfaceFromHash() {
    var h = (location.hash || "").replace(/^#/, "").toLowerCase();
    return SURFACES.indexOf(h) !== -1 ? h : "overview";
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
    window.addEventListener("hashchange", function () {
      if (app.getAttribute("data-ready") === "1") setSurface(surfaceFromHash(), { fromHash: true });
    });
    var so = document.getElementById("asgcSignOutM");
    if (so) so.addEventListener("click", doSignOut);
    bindNavChrome();
  }

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
      box.innerHTML = rows.length ? rows.join("") : '<p style="color:rgba(0,0,0,.4);font-size:13px">No recent activity yet.</p>';
    } catch (e) {
      box.innerHTML = '<p style="color:rgba(0,0,0,.4);font-size:13px">Activity unavailable.</p>';
    }
  }
  function bindAccount() {
    var save = document.getElementById("asgcSaveProfile");
    if (save) save.addEventListener("click", async function () {
      var body = {
        fullName: document.getElementById("asgcPfName").value.trim(),
        phone: document.getElementById("asgcPfPhone").value.trim(),
      };
      save.disabled = true;
      try {
        var res = await fetch(B + "/api/auth/me", { method: "PATCH", headers: authHeaders(), body: JSON.stringify(body) });
        var data = await res.json();
        if (!data.ok) throw new Error(data.error || "save failed");
        state.profile.fullName = body.fullName; state.profile.phone = body.phone;
        paintProfile();
        toast("Profile saved.");
      } catch (e) { toast(e.message || "Could not save.", true); }
      finally { save.disabled = false; }
    });
    var so = document.getElementById("asgcSignOut");
    if (so) so.addEventListener("click", doSignOut);
  }

  /* ---- init ---- */
  function init() {
    bindAuth();
    bindNav();
    bindAccount();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
