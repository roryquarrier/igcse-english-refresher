(function () {
  "use strict";

  var DATA = (window.COURSE && window.COURSE.sections) || [];
  var LS_DONE = "igcse-english.done.v1";
  var LS_LAST = "igcse-english.last.v1";

  var els = {
    navList: document.getElementById("navList"),
    search: document.getElementById("search"),
    searchHint: document.getElementById("searchHint"),
    group: document.getElementById("sectionGroup"),
    title: document.getElementById("sectionTitle"),
    body: document.getElementById("sectionBody"),
    done: document.getElementById("doneToggle"),
    pill: document.getElementById("progressPill"),
    prev: document.getElementById("prevBtn"),
    next: document.getElementById("nextBtn"),
    sidebar: document.getElementById("sidebar"),
    menuBtn: document.getElementById("menuBtn"),
    scrim: document.getElementById("scrim"),
    content: document.getElementById("content")
  };

  var groupOrder = [];
  DATA.forEach(function (s) { if (groupOrder.indexOf(s.group) === -1) groupOrder.push(s.group); });
  var byId = {};
  DATA.forEach(function (s, i) { s._index = i; byId[s.id] = s; });

  var done = loadDone();

  function loadDone() {
    try {
      var raw = localStorage.getItem(LS_DONE);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }
  function saveDone() {
    try { localStorage.setItem(LS_DONE, JSON.stringify(done)); } catch (e) {}
  }
  function isDone(id) { return done.indexOf(id) !== -1; }
  function setDone(id, v) {
    var i = done.indexOf(id);
    if (v && i === -1) done.push(id);
    if (!v && i !== -1) done.splice(i, 1);
    saveDone();
  }

  function stripHtml(html) {
    var d = document.createElement("div");
    d.innerHTML = html;
    return (d.textContent || "").toLowerCase();
  }
  DATA.forEach(function (s) { s._text = stripHtml(s.html); });

  /* ---------- nav ---------- */
  function buildNav() {
    els.navList.innerHTML = "";
    groupOrder.forEach(function (g) {
      var items = DATA.filter(function (s) { return s.group === g; });
      if (!items.length) return;
      var label = document.createElement("p");
      label.className = "nav-group";
      label.textContent = g;
      els.navList.appendChild(label);
      items.forEach(function (s) {
        var a = document.createElement("a");
        a.className = "nav-item";
        a.href = "#" + s.id;
        a.dataset.id = s.id;
        a.innerHTML = '<span class="tick" aria-hidden="true">✓</span><span class="lbl"></span>';
        a.querySelector(".lbl").textContent = s.label;
        a.title = s.title;
        els.navList.appendChild(a);
      });
    });
    decorateNav();
  }

  function decorateNav() {
    var links = els.navList.querySelectorAll(".nav-item");
    Array.prototype.forEach.call(links, function (a) {
      a.classList.toggle("done", isDone(a.dataset.id));
    });
  }

  function filterNav(term) {
    term = (term || "").trim().toLowerCase();
    var links = els.navList.querySelectorAll(".nav-item");
    var groups = els.navList.querySelectorAll(".nav-group");
    var visible = 0, textHits = 0;
    Array.prototype.forEach.call(links, function (a) {
      var s = byId[a.dataset.id];
      if (!term) { a.hidden = false; a.classList.remove("text-match"); visible++; return; }
      var labelHit = (s.label + " " + s.title).toLowerCase().indexOf(term) !== -1;
      var textHit = s._text.indexOf(term) !== -1;
      var show = labelHit || textHit;
      a.hidden = !show;
      a.classList.toggle("text-match", !labelHit && textHit);
      if (show) visible++;
      if (textHit) textHits++;
    });
    Array.prototype.forEach.call(groups, function (g) {
      var any = false, n = g.nextElementSibling;
      while (n && n.classList.contains("nav-item")) { if (!n.hidden) { any = true; break; } n = n.nextElementSibling; }
      g.hidden = !any;
    });
    if (!term) { els.searchHint.textContent = ""; }
    else if (visible === 0) { els.searchHint.textContent = "No section contains “" + term + "”."; }
    else { els.searchHint.textContent = visible + " of " + DATA.length + " sections shown · text matches in " + textHits + "."; }
  }

  /* ---------- render a section ---------- */
  function wrapTables(root) {
    var tables = root.querySelectorAll("table");
    Array.prototype.forEach.call(tables, function (t) {
      if (t.parentElement && t.parentElement.classList.contains("table-wrap")) return;
      var w = document.createElement("div");
      w.className = "table-wrap";
      t.parentNode.insertBefore(w, t);
      w.appendChild(t);
    });
  }

  function show(id, opts) {
    opts = opts || {};
    var s = byId[id] || DATA[0];
    els.group.textContent = s.group;
    els.title.textContent = s.title;
    document.title = s.title + " · IGCSE English Refresher";
    els.body.innerHTML = s.html;
    wrapTables(els.body);

    els.done.checked = isDone(s.id);
    els.prev.disabled = s._index === 0;
    els.next.disabled = s._index === DATA.length - 1;

    var links = els.navList.querySelectorAll(".nav-item");
    Array.prototype.forEach.call(links, function (a) {
      a.classList.toggle("active", a.dataset.id === s.id);
      if (a.dataset.id === s.id) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });

    try { localStorage.setItem(LS_LAST, s.id); } catch (e) {}
    if (!opts.silent) els.content.focus();
    if (!opts.keepScroll) window.scrollTo(0, 0);
    closeDrawer();
  }

  function currentId() {
    var h = (location.hash || "").replace(/^#/, "");
    return byId[h] ? h : null;
  }

  function navigate() {
    var id = currentId();
    if (!id) {
      var last = null;
      try { last = localStorage.getItem(LS_LAST); } catch (e) {}
      id = (last && byId[last]) ? last : DATA[0].id;
      history.replaceState(null, "", "#" + id);
    }
    show(id);
  }

  function go(offset) {
    var id = currentId() || DATA[0].id;
    var s = byId[id];
    var t = s._index + offset;
    if (t < 0 || t >= DATA.length) return;
    if (location.hash === "#" + DATA[t].id) { show(DATA[t].id); }
    else { location.hash = DATA[t].id; }
  }

  /* ---------- progress ---------- */
  function updatePill() {
    els.pill.innerHTML = "";
    els.pill.appendChild(document.createTextNode(done.length + " / " + DATA.length));
    var long = document.createElement("span");
    long.className = "pill-long";
    long.textContent = " complete";
    els.pill.appendChild(long);
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

  els.navList.addEventListener("click", function (e) {
    var a = e.target.closest ? e.target.closest(".nav-item") : null;
    if (a) closeDrawer();
  });

  els.search.addEventListener("input", function () { filterNav(els.search.value); });
  els.search.addEventListener("keydown", function (e) { if (e.key === "Escape") { els.search.value = ""; filterNav(""); } });

  els.done.addEventListener("change", function () {
    var id = currentId() || DATA[0].id;
    setDone(id, els.done.checked);
    decorateNav();
    updatePill();
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
