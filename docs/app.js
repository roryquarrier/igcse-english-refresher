(function () {
  "use strict";

  var DATA = (window.COURSE && window.COURSE.sections) || [];
  var LS_DONE = "igcse-english.done.v1";
  var LS_LAST = "igcse-english.last.v1";
  var LS_THEME = "igcse-english.theme";

  var els = {
    navList: document.getElementById("navList"),
    search: document.getElementById("search"),
    searchHint: document.getElementById("searchHint"),
    group: document.getElementById("sectionGroup"),
    title: document.getElementById("sectionTitle"),
    blurb: document.getElementById("sectionBlurb"),
    emoji: document.getElementById("sectionEmoji"),
    body: document.getElementById("sectionBody"),
    done: document.getElementById("doneToggle"),
    pill: document.getElementById("progressPill"),
    bar: document.getElementById("progressBar"),
    barFill: document.querySelector("#progressBar span"),
    themeBtn: document.getElementById("themeBtn"),
    prev: document.getElementById("prevBtn"),
    next: document.getElementById("nextBtn"),
    sidebar: document.getElementById("sidebar"),
    menuBtn: document.getElementById("menuBtn"),
    scrim: document.getElementById("scrim"),
    content: document.getElementById("content")
  };

  /* ---------- theme ---------- */
  function currentTheme() { return document.documentElement.dataset.theme || "dark"; }
  function applyTheme(t, save) {
    document.documentElement.dataset.theme = t;
    if (els.themeBtn) {
      els.themeBtn.textContent = (t === "dark") ? "\u2600\uFE0F" : "\u{1F319}";
      els.themeBtn.setAttribute("aria-label", (t === "dark") ? "Switch to light theme" : "Switch to dark theme");
    }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", (t === "dark") ? "#0e1420" : "#f4f7fb");
    if (save) { try { localStorage.setItem(LS_THEME, t); } catch (e) {} }
  }
  els.themeBtn.addEventListener("click", function () {
    applyTheme(currentTheme() === "dark" ? "light" : "dark", true);
  });
  applyTheme(currentTheme(), false);

  /* ---------- state ---------- */
  var groupOrder = [];
  DATA.forEach(function (s) { if (groupOrder.indexOf(s.group) === -1) groupOrder.push(s.group); });
  var byId = {};
  DATA.forEach(function (s, i) { s._index = i; byId[s.id] = s; });

  var done = loadDone();
  function loadDone() {
    try { var a = JSON.parse(localStorage.getItem(LS_DONE) || "[]"); return Array.isArray(a) ? a : []; }
    catch (e) { return []; }
  }
  function saveDone() { try { localStorage.setItem(LS_DONE, JSON.stringify(done)); } catch (e) {} }
  function isDone(id) { return done.indexOf(id) !== -1; }
  function setDone(id, v) {
    var i = done.indexOf(id);
    if (v && i === -1) done.push(id);
    if (!v && i !== -1) done.splice(i, 1);
    saveDone();
  }

  function textOf(html) {
    var d = document.createElement("div");
    d.innerHTML = html;
    return (d.textContent || "").toLowerCase();
  }
  DATA.forEach(function (s) { s._text = textOf(s.html); });

  /* ---------- friendly emoji on headings ---------- */
  var HEAD_EMOJI = [
    [/^practice/i, "\u270F\uFE0F"],
    [/mini[-\s]?tasks?/i, "\u{1F3AF}"],
    [/^marking guide/i, "\u{1F9ED}"],
    [/^learning goals/i, "\u{1F3AF}"],
    [/^worked example/i, "\u{1F4A1}"],
    [/^lesson\b/i, "\u{1F4D8}"],
    [/^the method/i, "\u{1F9E9}"],
    [/^traps?\b/i, "\u26A0\uFE0F"],
    [/^materials\b/i, "\u{1F9F0}"],
    [/plan\b/i, "\u{1F5FA}\uFE0F"],
    [/^register/i, "\u{1F3AD}"],
    [/^structures for/i, "\u{1F3D7}\uFE0F"],
    [/^part \d/i, "\u{1F538}"],
    [/^the two written papers|^the components|^what the numbering/i, "\u{1F5C2}\uFE0F"],
    [/^week\b/i, "\u{1F5D3}\uFE0F"],
    [/^the core mistake/i, "\u{1F6AB}"],
    [/^what to look for/i, "\u{1F50E}"],
    [/^the senses frame/i, "\u{1F440}"],
    [/^how to use/i, "\u{1F9ED}"],
    [/^the mark schemes/i, "\u{1F3AF}"],
    [/^ground rules/i, "\u2696\uFE0F"],
    [/banding/i, "\u{1F39A}\uFE0F"],
    [/^section [a-d]\b/i, "\u{1F4CC}"],
    [/^text [a-b]\b/i, "\u{1F4C4}"],
    [/^sitting \d/i, "\u23F3"],
    [/^the \d+-minute plan|^the \d+ minute plan/i, "\u{1F5FA}\uFE0F"],
    [/^the method/i, "\u{1F9E9}"],
    [/^how to use these files/i, "\u{1F5C2}\uFE0F"]
  ];
  var HAS_LEAD_EMOJI = /^\s*[\u{1F000}-\u{1FAFF}\u2190-\u2BFF\u2600-\u27BF\uFE0F\u200D]/u;

  function decorateHeadings(root) {
    var heads = root.querySelectorAll("h2, h3");
    Array.prototype.forEach.call(heads, function (h) {
      var t = (h.textContent || "").trim();
      if (!t || HAS_LEAD_EMOJI.test(t)) return;
      for (var i = 0; i < HEAD_EMOJI.length; i++) {
        if (HEAD_EMOJI[i][0].test(t)) { h.insertBefore(document.createTextNode(HEAD_EMOJI[i][1] + " "), h.firstChild); return; }
      }
    });
  }

  function wrapTables(root) {
    Array.prototype.forEach.call(root.querySelectorAll("table"), function (t) {
      if (t.parentElement && t.parentElement.classList.contains("table-wrap")) return;
      var w = document.createElement("div");
      w.className = "table-wrap";
      t.parentNode.insertBefore(w, t);
      w.appendChild(t);
    });
  }

  /* ---------- nav ---------- */
  function buildNav() {
    els.navList.innerHTML = "";
    groupOrder.forEach(function (g) {
      var items = DATA.filter(function (s) { return s.group === g; });
      if (!items.length) return;
      var label = document.createElement("p");
      label.className = "nav-group";
      label.textContent = (items[0].groupEmoji || "") + " " + g;
      els.navList.appendChild(label);
      items.forEach(function (s) {
        var a = document.createElement("a");
        a.className = "nav-item";
        a.href = "#" + s.id;
        a.dataset.id = s.id;
        a.title = s.title;
        var em = document.createElement("span");
        em.className = "nav-emoji"; em.setAttribute("aria-hidden", "true"); em.textContent = s.emoji || "";
        var lbl = document.createElement("span");
        lbl.className = "lbl"; lbl.textContent = s.label;
        var tk = document.createElement("span");
        tk.className = "tick"; tk.setAttribute("aria-hidden", "true"); tk.textContent = "\u2713";
        a.appendChild(em); a.appendChild(lbl); a.appendChild(tk);
        els.navList.appendChild(a);
      });
    });
    decorateNav();
  }

  function decorateNav() {
    Array.prototype.forEach.call(els.navList.querySelectorAll(".nav-item"), function (a) {
      a.classList.toggle("done", isDone(a.dataset.id));
    });
  }

  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  function filterNav(term) {
    term = (term || "").trim();
    var low = term.toLowerCase();
    var links = els.navList.querySelectorAll(".nav-item");
    var groups = els.navList.querySelectorAll(".nav-group");
    var visible = 0, hits = 0;
    Array.prototype.forEach.call(links, function (a) {
      var s = byId[a.dataset.id];
      var lbl = a.querySelector(".lbl");
      lbl.textContent = s.label;
      if (!term) { a.hidden = false; a.classList.remove("text-match"); visible++; return; }
      var labelHit = (s.label + " " + s.title).toLowerCase().indexOf(low) !== -1;
      var textHit = s._text.indexOf(low) !== -1;
      a.hidden = !(labelHit || textHit);
      a.classList.toggle("text-match", !labelHit && textHit);
      if (labelHit) {
        var re = new RegExp("(" + escapeRe(term) + ")", "i");
        lbl.innerHTML = s.label.replace(re, "<mark>$1</mark>");
      }
      if (!a.hidden) visible++;
      if (textHit) hits++;
    });
    Array.prototype.forEach.call(groups, function (g) {
      var any = false, n = g.nextElementSibling;
      while (n && n.classList.contains("nav-item")) { if (!n.hidden) { any = true; break; } n = n.nextElementSibling; }
      g.hidden = !any;
    });
    if (!term) els.searchHint.textContent = "";
    else if (!visible) els.searchHint.textContent = "No section contains \u201C" + term + "\u201D.";
    else els.searchHint.textContent = visible + " of " + DATA.length + " shown \u00B7 text hits in " + hits + ".";
  }

  /* ---------- render ---------- */
  function show(id, opts) {
    opts = opts || {};
    var s = byId[id] || DATA[0];
    els.emoji.textContent = s.emoji || "\u{1F4D8}";
    els.group.textContent = s.group;
    els.title.textContent = s.title;
    els.blurb.textContent = s.blurb || "";
    els.blurb.hidden = !s.blurb;
    document.title = s.title + " \u00B7 IGCSE English Refresher";
    els.body.innerHTML = s.html;
    wrapTables(els.body);
    decorateHeadings(els.body);

    els.done.checked = isDone(s.id);
    els.prev.disabled = s._index === 0;
    els.next.disabled = s._index === DATA.length - 1;

    Array.prototype.forEach.call(els.navList.querySelectorAll(".nav-item"), function (a) {
      var on = a.dataset.id === s.id;
      a.classList.toggle("active", on);
      if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });

    try { localStorage.setItem(LS_LAST, s.id); } catch (e) {}
    if (!opts.silent) els.content.focus();
    window.scrollTo(0, 0);
    closeDrawer();
  }

  function currentId() {
    var h = (location.hash || "").replace(/^#/, "");
    return byId[h] ? h : null;
  }
  function navigate() {
    var id = currentId(), last = null;
    if (!id) {
      try { last = localStorage.getItem(LS_LAST); } catch (e) {}
      id = (last && byId[last]) ? last : DATA[0].id;
      history.replaceState(null, "", "#" + id);
    }
    show(id);
  }
  function go(offset) {
    var s = byId[currentId() || DATA[0].id];
    var t = s._index + offset;
    if (t < 0 || t >= DATA.length) return;
    if (location.hash === "#" + DATA[t].id) show(DATA[t].id); else location.hash = DATA[t].id;
  }

  /* ---------- progress ---------- */
  function updatePill() {
    els.pill.textContent = "";
    els.pill.appendChild(document.createTextNode(done.length + " / " + DATA.length));
    var long = document.createElement("span");
    long.className = "pill-long";
    long.textContent = done.length === DATA.length ? " complete \u{1F3C6}" : " complete";
    els.pill.appendChild(long);
    var pct = DATA.length ? Math.round((done.length / DATA.length) * 100) : 0;
    if (els.barFill) els.barFill.style.width = pct + "%";
    if (els.bar) els.bar.setAttribute("aria-valuenow", String(done.length));
  }

  /* ---------- drawer ---------- */
  function openDrawer() {
    els.sidebar.classList.add("open");
    els.menuBtn.setAttribute("aria-expanded", "true");
    els.scrim.hidden = false;
  }
  function closeDrawer() {
    els.sidebar.classList.remove("open");
    els.menuBtn.setAttribute("aria-expanded", "false");
    els.scrim.hidden = true;
  }

  /* ---------- wire up ---------- */
  els.menuBtn.addEventListener("click", function () {
    if (els.sidebar.classList.contains("open")) closeDrawer(); else openDrawer();
  });
  els.scrim.addEventListener("click", closeDrawer);
  window.addEventListener("resize", function () { if (window.innerWidth > 899) closeDrawer(); });
  els.navList.addEventListener("click", function () { closeDrawer(); });
  els.search.addEventListener("input", function () { filterNav(els.search.value); });
  els.search.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { els.search.value = ""; filterNav(""); }
  });
  els.done.addEventListener("change", function () {
    setDone(currentId() || DATA[0].id, els.done.checked);
    decorateNav(); updatePill();
  });
  els.prev.addEventListener("click", function () { go(-1); });
  els.next.addEventListener("click", function () { go(1); });
  window.addEventListener("hashchange", navigate);
  document.addEventListener("keydown", function (e) {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.altKey && e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
    if (e.altKey && e.key === "ArrowRight") { e.preventDefault(); go(1); }
  });

  buildNav();
  updatePill();
  navigate();
})();
