(function () {
  "use strict";

  var DATA = (window.COURSE && window.COURSE.sections) || [];
  var KEY = "igcse-english.progress.v2";
  var OLD_DONE = "igcse-english.done.v1";
  var OLD_LAST = "igcse-english.last.v1";
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
    quizHost: document.getElementById("quizHost"),
    toggleWrap: document.getElementById("toggleWrap"),
    done: document.getElementById("doneToggle"),
    doneText: document.getElementById("doneText"),
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

  /* ================= theme ================= */
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

  /* ================= store ================= */
  var store = load();
  function blank() { return { v: 2, name: "", done: {}, doneAt: {}, quiz: {}, updated: null }; }
  function load() {
    var s = blank();
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var p = JSON.parse(raw);
        var clean = sanitizeProgress(p);
        if (clean) s = clean;
      } else {
        /* migrate the old v1 completion ticks */
        var old = JSON.parse(localStorage.getItem(OLD_DONE) || "[]");
        if (Array.isArray(old)) old.forEach(function (id) { s.done[id] = true; });
      }
    } catch (e) {}
    return s;
  }
  function save() {
    store.updated = new Date().toISOString();
    try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {}
  }

  function isDone(id) { return !!store.done[id]; }
  function setSectionDone(id, v) {
    if (v) { store.done[id] = true; store.doneAt[id] = new Date().toISOString(); }
    else { delete store.done[id]; delete store.doneAt[id]; }
    save();
  }
  function quizRecord(sid) { return store.quiz[sid] || null; }
  function setAnswer(sid, qi, opt) {
    var r = store.quiz[sid] || { answers: {}, best: 0, total: 0, attempts: 0, last: 0, lastAt: null };
    r.answers[qi] = opt;
    r.total = (byId[sid] && byId[sid].quiz) ? byId[sid].quiz.questions.length : r.total;
    store.quiz[sid] = r;
    save();
  }
  function markAttempt(sid, correct, total, sig) {
    var r = store.quiz[sid] || { answers: {}, best: 0, total: total, attempts: 0, last: 0, lastAt: null };
    if (sig && r.sig === sig) return; /* this exact answer set is already recorded */
    r.sig = sig || null;
    r.total = total;
    r.last = correct;
    r.lastAt = new Date().toISOString();
    r.attempts += 1;
    r.best = Math.max(r.best || 0, correct);
    store.quiz[sid] = r;
    save();
  }
  function resetQuiz(sid) {
    if (store.quiz[sid]) { delete store.quiz[sid]; save(); }
  }
  function clearAnswers(sid) {
    if (store.quiz[sid]) { store.quiz[sid].answers = {}; store.quiz[sid].sig = null; save(); }
  }
  /* In-page messages. We deliberately never use alert()/confirm(): a modal
     dialog blocks JavaScript, so a client that cannot dismiss it (headless,
     embedded, automated) would freeze the whole page. */
  function notice(host, kind, text, actionLabel, action) {
    var box = el("div", "notice " + kind);
    box.setAttribute("role", kind === "warn" ? "status" : "status");
    var p = el("p", "notice-text", text);
    box.appendChild(p);
    var row = el("div", "notice-actions");
    if (actionLabel && action) {
      var yes = el("button", "btn danger", actionLabel);
      yes.type = "button";
      yes.addEventListener("click", function () { box.remove(); action(); });
      row.appendChild(yes);
    }
    var no = el("button", "btn", actionLabel ? "Cancel" : "OK");
    no.type = "button";
    no.addEventListener("click", function () { box.remove(); });
    row.appendChild(no);
    box.appendChild(row);
    if (host) host.insertBefore(box, host.firstChild);
    return box;
  }

  /* Normalise a candidate progress object. Returns null when it is not
     recognisably our own export, so a wrong file cannot wipe real progress. */
  function sanitizeProgress(p) {
    if (!p || typeof p !== "object" || Array.isArray(p)) return null;
    if (!("done" in p) && !("quiz" in p) && !("v" in p)) return null;
    var out = blank();
    if (typeof p.name === "string") out.name = p.name.slice(0, 40);
    if (p.done && typeof p.done === "object") {
      Object.keys(p.done).forEach(function (k) { if (p.done[k]) out.done[k] = true; });
    }
    if (p.doneAt && typeof p.doneAt === "object") {
      Object.keys(out.done).forEach(function (k) { if (typeof p.doneAt[k] === "string") out.doneAt[k] = p.doneAt[k]; });
    }
    if (p.quiz && typeof p.quiz === "object" && !Array.isArray(p.quiz)) {
      Object.keys(p.quiz).forEach(function (k) {
        var r = p.quiz[k];
        if (!r || typeof r !== "object" || Array.isArray(r)) return;
        var answers = {};
        if (r.answers && typeof r.answers === "object" && !Array.isArray(r.answers)) {
          Object.keys(r.answers).forEach(function (qi) {
            var n = Number(qi), v = r.answers[qi];
            if (isFinite(n) && n >= 0 && (typeof v === "number") && isFinite(v) && v >= 0) answers[String(n)] = Math.floor(v);
          });
        }
        var num = function (x, d) { return (typeof x === "number" && isFinite(x) && x >= 0) ? Math.floor(x) : d; };
        out.quiz[k] = {
          answers: answers,
          best: num(r.best, 0),
          last: num(r.last, 0),
          total: num(r.total, 0),
          attempts: num(r.attempts, 0),
          sig: (typeof r.sig === "string") ? r.sig : null,
          lastAt: (typeof r.lastAt === "string") ? r.lastAt : null
        };
      });
    }
    out.updated = (typeof p.updated === "string") ? p.updated : null;
    return out;
  }

  function sigOf(answers, total) {
    var keys = Object.keys(answers);
    if (keys.length !== total) return null;
    keys.sort();
    return keys.map(function (k) { return k + ":" + answers[k]; }).join(",");
  }

  /* ================= helpers ================= */
  var groupOrder = [];
  DATA.forEach(function (s) { if (groupOrder.indexOf(s.group) === -1) groupOrder.push(s.group); });
  var byId = {};
  DATA.forEach(function (s, i) { s._index = i; byId[s.id] = s; });

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function pct(a, b) { return b ? Math.round((a / b) * 100) : 0; }
  function textOf(html) { var d = document.createElement("div"); d.innerHTML = html; return (d.textContent || "").toLowerCase(); }
  DATA.forEach(function (s) { s._text = textOf(s.html); });

  /* ================= friendly heading emoji ================= */
  var HEAD_EMOJI = [
    [/^practice/i, "\u270F\uFE0F"], [/mini[-\s]?tasks?/i, "\u{1F3AF}"], [/^marking guide/i, "\u{1F9ED}"],
    [/^learning goals/i, "\u{1F3AF}"], [/^worked example/i, "\u{1F4A1}"], [/^lesson\b/i, "\u{1F4D8}"],
    [/^the method/i, "\u{1F9E9}"], [/^traps?\b/i, "\u26A0\uFE0F"], [/^materials\b/i, "\u{1F9F0}"],
    [/plan\b/i, "\u{1F5FA}\uFE0F"], [/^register/i, "\u{1F3AD}"], [/^structures for/i, "\u{1F3D7}\uFE0F"],
    [/^part \d/i, "\u{1F538}"], [/^the two written papers|^the components|^what the numbering/i, "\u{1F5C2}\uFE0F"],
    [/^week\b/i, "\u{1F5D3}\uFE0F"], [/^the core mistake/i, "\u{1F6AB}"], [/^what to look for/i, "\u{1F50E}"],
    [/^the senses frame/i, "\u{1F440}"], [/^how to use/i, "\u{1F9ED}"], [/^the mark schemes/i, "\u{1F3AF}"],
    [/^ground rules/i, "\u2696\uFE0F"], [/banding/i, "\u{1F39A}\uFE0F"], [/^section [a-d]\b/i, "\u{1F4CC}"],
    [/^text [a-b]\b/i, "\u{1F4C4}"], [/^sitting \d/i, "\u23F3"], [/^the \d+-minute plan/i, "\u{1F5FA}\uFE0F"]
  ];
  var HAS_LEAD = /^\s*[\u{1F000}-\u{1FAFF}\u2190-\u2BFF\u2600-\u27BF\uFE0F\u200D]/u;
  function decorateHeadings(root) {
    Array.prototype.forEach.call(root.querySelectorAll("h2, h3"), function (h) {
      var t = (h.textContent || "").trim();
      if (!t || HAS_LEAD.test(t)) return;
      for (var i = 0; i < HEAD_EMOJI.length; i++) {
        if (HEAD_EMOJI[i][0].test(t)) { h.insertBefore(document.createTextNode(HEAD_EMOJI[i][1] + " "), h.firstChild); return; }
      }
    });
  }
  function wrapTables(root) {
    Array.prototype.forEach.call(root.querySelectorAll("table"), function (t) {
      if (t.parentElement && t.parentElement.classList.contains("table-wrap")) return;
      var w = el("div", "table-wrap");
      t.parentNode.insertBefore(w, t); w.appendChild(t);
    });
  }

  /* ================= nav ================= */
  function buildNav() {
    els.navList.innerHTML = "";
    groupOrder.forEach(function (g) {
      var items = DATA.filter(function (s) { return s.group === g; });
      if (!items.length) return;
      els.navList.appendChild(el("p", "nav-group", (items[0].groupEmoji || "") + " " + g));
      items.forEach(function (s) {
        var a = el("a", "nav-item");
        a.href = "#" + s.id; a.dataset.id = s.id; a.title = s.title;
        var em = el("span", "nav-emoji", s.emoji || ""); em.setAttribute("aria-hidden", "true");
        var lbl = el("span", "lbl", s.label);
        var tk = el("span", "tick", "\u2713"); tk.setAttribute("aria-hidden", "true");
        a.appendChild(em); a.appendChild(lbl);
        if (s.quiz) { var q = el("span", "nav-quiz", "\u26A1"); q.setAttribute("aria-hidden", "true"); q.title = "has a quiz"; a.appendChild(q); }
        a.appendChild(tk);
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
  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  function filterNav(term) {
    term = (term || "").trim();
    var low = term.toLowerCase();
    var links = els.navList.querySelectorAll(".nav-item"), groups = els.navList.querySelectorAll(".nav-group");
    var shown = 0, hits = 0;
    Array.prototype.forEach.call(links, function (a) {
      var s = byId[a.dataset.id], lbl = a.querySelector(".lbl");
      lbl.textContent = s.label;
      if (!term) { a.hidden = false; a.classList.remove("text-match"); shown++; return; }
      var labelHit = (s.label + " " + s.title).toLowerCase().indexOf(low) !== -1;
      var textHit = s._text.indexOf(low) !== -1;
      a.hidden = !(labelHit || textHit);
      a.classList.toggle("text-match", !labelHit && textHit);
      if (labelHit) lbl.innerHTML = s.label.replace(new RegExp("(" + escRe(term) + ")", "i"), "<mark>$1</mark>");
      if (!a.hidden) shown++;
      if (textHit) hits++;
    });
    Array.prototype.forEach.call(groups, function (g) {
      var any = false, n = g.nextElementSibling;
      while (n && n.classList.contains("nav-item")) { if (!n.hidden) { any = true; break; } n = n.nextElementSibling; }
      g.hidden = !any;
    });
    if (!term) els.searchHint.textContent = "";
    else if (!shown) els.searchHint.textContent = "No section contains \u201C" + term + "\u201D.";
    else els.searchHint.textContent = shown + " of " + DATA.length + " shown \u00B7 text hits in " + hits + ".";
  }

  /* ================= quiz ================= */
  function renderQuiz(s) {
    els.quizHost.innerHTML = "";
    if (!s.quiz) { els.quizHost.hidden = true; return; }
    els.quizHost.hidden = false;

    var rec = quizRecord(s.id) || { answers: {} };
    var answers = rec.answers || {};
    var total = s.quiz.questions.length;

    var box = el("section", "quiz");
    box.setAttribute("aria-label", "Quick check quiz");
    var head = el("div", "quiz-head");
    var h = el("h2", "quiz-title", "\u26A1 Quick check");
    var sub = el("p", "quiz-sub", s.quiz.title || "");
    var score = el("span", "quiz-score");
    head.appendChild(h); head.appendChild(sub); head.appendChild(score);
    box.appendChild(head);

    var ol = el("ol", "quiz-list");
    var state = { correct: 0, answered: 0 };

    s.quiz.questions.forEach(function (qn, qi) {
      var li = el("li", "quiz-q");
      li.appendChild(el("p", "q-text", qn.q));
      var opts = el("div", "q-opts");
      var fb = el("p", "q-fb");
      fb.hidden = true;

      qn.options.forEach(function (text, oi) {
        var b = el("button", "opt", text);
        b.type = "button";
        b.dataset.q = String(qi);
        b.dataset.o = String(oi);
        opts.appendChild(b);
      });
      li.appendChild(opts); li.appendChild(fb);
      ol.appendChild(li);

      function paint(chosen) {
        var btns = opts.querySelectorAll(".opt");
        Array.prototype.forEach.call(btns, function (b) {
          var oi = Number(b.dataset.o);
          b.disabled = true;
          if (oi === qn.answer) b.classList.add("correct");
          else if (oi === chosen) b.classList.add("wrong");
          b.setAttribute("aria-pressed", oi === chosen ? "true" : "false");
        });
        li.classList.add("answered");
        li.classList.add(chosen === qn.answer ? "is-correct" : "is-wrong");
        fb.hidden = false;
        fb.className = "q-fb " + (chosen === qn.answer ? "good" : "bad");
        fb.textContent = (chosen === qn.answer ? "\u2705 Correct. " : "\u274C Not quite. ") + (qn.why || "");
      }

      Array.prototype.forEach.call(opts.querySelectorAll(".opt"), function (b) {
        b.addEventListener("click", function () {
          var chosen = Number(b.dataset.o);
          if (li.classList.contains("answered")) return;
          paint(chosen);
          if (answers[qi] === undefined) state.answered++;
          answers[qi] = chosen;
          if (chosen === qn.answer) state.correct++;
          setAnswer(s.id, qi, chosen);
          if (updateScore()) markAttempt(s.id, state.correct, total, sigOf(answers, total));
        });
      });

      if (answers[qi] !== undefined) {
        paint(answers[qi]);
        state.answered++;
        if (answers[qi] === qn.answer) state.correct++;
      }
    });

    function updateScore() {
      var line = state.correct + " / " + total + " correct";
      if (state.answered === total) {
        var p = pct(state.correct, total);
        line += p === 100 ? " \u2014 perfect! \u{1F3C6}" : (p >= 70 ? " \u2014 nice work! \u{1F44D}" : " \u2014 have another go \u{1F4AA}");
      } else {
        line += " \u00B7 " + (total - state.answered) + " to go";
      }
      score.textContent = line;
      return state.answered === total;
    }

    var actions = el("div", "quiz-actions");
    box.appendChild(ol);
    box.appendChild(actions);
    var retry = el("button", "btn", "\u{1F504} Try again");
    retry.type = "button";
    retry.addEventListener("click", function () {
      clearAnswers(s.id);
      renderQuiz(s);
      setSectionDone(s.id, false);
    });
    var mark = el("button", "btn", "\u2705 Mark section complete");
    mark.type = "button";
    mark.addEventListener("click", function () { setSectionDone(s.id, true); syncDone(); });
    actions.appendChild(retry); actions.appendChild(mark);
    box.appendChild(actions);

    els.quizHost.appendChild(box);
    updateScore();

    /* record the attempt once every question has an answer */
    if (state.answered === total) markAttempt(s.id, state.correct, total, sigOf(answers, total));
  }

  /* ================= dashboard ================= */
  function renderDashboard(s) {
    var host = els.body;
    host.innerHTML = "";
    var wrap = el("div", "dash");

    var nameRow = el("div", "dash-name");
    var lbl = el("label", "dash-name-lbl", "\u{1F464} Student name");
    lbl.setAttribute("for", "studentName");
    var inp = el("input", "dash-name-input");
    inp.id = "studentName"; inp.type = "text"; inp.value = store.name || ""; inp.placeholder = "Type your name";
    inp.maxLength = 40;
    inp.addEventListener("input", function () { store.name = inp.value.trim(); save(); renderDashboard(s); });
    nameRow.appendChild(lbl); nameRow.appendChild(inp);
    wrap.appendChild(nameRow);

    var quizzes = DATA.filter(function (x) { return x.quiz; });
    var qTotal = 0, qBest = 0, attempted = 0;
    quizzes.forEach(function (x) {
      var r = store.quiz[x.id];
      qTotal += x.quiz.questions.length;
      if (r) { qBest += Math.min(r.best || 0, x.quiz.questions.length); attempted++; }
    });
    var doneCount = Object.keys(store.done).filter(function (k) { return byId[k]; }).length;

    var cards = el("div", "stat-grid");
    function card(icon, value, label, sub) {
      var c = el("div", "stat");
      c.appendChild(el("div", "stat-ico", icon));
      c.appendChild(el("div", "stat-val", value));
      c.appendChild(el("div", "stat-lbl", label));
      if (sub) c.appendChild(el("div", "stat-sub", sub));
      return c;
    }
    cards.appendChild(card("\u2705", doneCount + " / " + DATA.length, "sections complete", pct(doneCount, DATA.length) + "%"));
    cards.appendChild(card("\u26A1", qBest + " / " + qTotal, "quiz questions correct", "best score per module"));
    cards.appendChild(card("\u{1F4DA}", attempted + " / " + quizzes.length, "quizzes tried", ""));
    cards.appendChild(card("\u{1F3C6}", pct(qBest, qTotal) + "%", "quiz mastery", ""));
    wrap.appendChild(cards);

    var ring = el("div", "dash-bar");
    var fill = el("span");
    fill.style.width = pct(doneCount, DATA.length) + "%";
    ring.appendChild(fill);
    wrap.appendChild(ring);

    var tbl = el("table", "dash-table");
    var thead = el("thead"); var tr = el("tr");
    ["Section", "Read", "Quiz", "Best", "Tries"].forEach(function (t) { tr.appendChild(el("th", null, t)); });
    thead.appendChild(tr); tbl.appendChild(thead);
    var tb = el("tbody");
    DATA.forEach(function (x) {
      if (x.id === "dashboard") return;
      var row = el("tr");
      var c1 = el("td");
      var a = el("a", "dash-link", x.emoji + " " + x.label);
      a.href = "#" + x.id; c1.appendChild(a);
      row.appendChild(c1);
      row.appendChild(el("td", isDone(x.id) ? "ok" : "no", isDone(x.id) ? "\u2705 yes" : "\u2B1C no"));
      if (x.quiz) {
        var r = store.quiz[x.id];
        var ans = r && r.answers ? Object.keys(r.answers).length : 0;
        var tot = x.quiz.questions.length;
        row.appendChild(el("td", ans === tot ? "ok" : (ans ? "part" : "no"), ans + " / " + tot + " done"));
        row.appendChild(el("td", r && r.best === tot ? "ok" : "no", r ? (r.best + " / " + tot) : "\u2014"));
        row.appendChild(el("td", "no", r && r.attempts ? String(r.attempts) : "\u2014"));
      } else {
        var dash = el("td", "no", "no quiz"); dash.colSpan = 3; row.appendChild(dash);
      }
      tb.appendChild(row);
    });
    tbl.appendChild(tb);
    wrap.appendChild(tbl);

    var tools = el("div", "dash-tools");
    var exp = el("button", "btn", "\u2B07\uFE0F Export progress");
    exp.type = "button";
    exp.addEventListener("click", function () {
      var payload = JSON.stringify(store, null, 2);
      var name = (store.name || "student").replace(/[^\w\-]+/g, "_");
      var blob = new Blob([payload], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var link = document.createElement("a");
      link.href = url; link.download = "igcse-english-progress-" + name + ".json";
      document.body.appendChild(link); link.click();
      document.body.removeChild(link); setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
    });
    var impBtn = el("button", "btn", "\u2B06\uFE0F Import progress");
    impBtn.type = "button";
    var impFile = el("input"); impFile.type = "file"; impFile.accept = "application/json,.json"; impFile.hidden = true;
    impBtn.addEventListener("click", function () { impFile.click(); });
    impFile.addEventListener("change", function () {
      var f = impFile.files && impFile.files[0];
      if (!f) return;
      var rd = new FileReader();
      rd.onload = function () {
        var clean = null;
        try { clean = sanitizeProgress(JSON.parse(String(rd.result))); } catch (e) { clean = null; }
        if (!clean) {
          renderDashboard(s);
          notice(host, "warn", "That file is not an IGCSE English progress export, so nothing was changed. Your progress is safe.");
          return;
        }
        store = clean;
        save(); decorateNav(); updatePill();
        renderDashboard(s);
        notice(el(".dash", host) || host, "ok", "Progress imported successfully.");
      };
      rd.readAsText(f);
      impFile.value = "";
    });
    var reset = el("button", "btn danger", "\u{1F5D1}\uFE0F Reset everything");
    reset.type = "button";
    reset.addEventListener("click", function () {
      notice(host, "warn", "Erase all progress, quiz answers and the student name on this device?", "Erase everything", function () {
        store = blank(); save();
        try { localStorage.removeItem(OLD_DONE); localStorage.removeItem(OLD_LAST); } catch (e) {}
        decorateNav(); updatePill();
        renderDashboard(s);
        notice(el(".dash", host) || host, "ok", "All progress on this device has been erased.");
      });
    });
    tools.appendChild(exp); tools.appendChild(impBtn); tools.appendChild(reset); tools.appendChild(impFile);
    wrap.appendChild(tools);

    var note = el("p", "dash-note");
    note.textContent = "Progress is saved in this browser on this device. Use Export after a session and Import to restore it, or to move it to another computer.";
    wrap.appendChild(note);

    host.appendChild(wrap);
  }

  /* ================= render ================= */
  function show(id, opts) {
    opts = opts || {};
    var s = byId[id] || DATA[0];
    els.emoji.textContent = s.emoji || "\u{1F4D8}";
    els.group.textContent = s.group;
    els.title.textContent = s.title;
    els.blurb.textContent = s.blurb || "";
    els.blurb.hidden = !s.blurb;
    document.title = s.title + " \u00B7 IGCSE English Refresher";

    var isDash = s.kind === "dashboard";
    els.body.hidden = isDash;
    els.toggleWrap.hidden = isDash;
    els.quizHost.hidden = true;
    els.quizHost.innerHTML = "";

    if (isDash) {
      renderDashboard(s);
    } else {
      els.body.innerHTML = s.html;
      wrapTables(els.body);
      decorateHeadings(els.body);
      els.done.checked = isDone(s.id);
      els.doneText.textContent = isDone(s.id) ? "Completed \u2014 nice!" : "Mark this section complete";
      renderQuiz(s);
    }

    els.prev.disabled = s._index === 0;
    els.next.disabled = s._index === DATA.length - 1;
    Array.prototype.forEach.call(els.navList.querySelectorAll(".nav-item"), function (a) {
      var on = a.dataset.id === s.id;
      a.classList.toggle("active", on);
      if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    try { localStorage.setItem(OLD_LAST, s.id); } catch (e) {}
    if (!opts.silent) els.content.focus();
    window.scrollTo(0, 0);
    closeDrawer();
  }

  function currentId() { var h = (location.hash || "").replace(/^#/, ""); return byId[h] ? h : null; }
  function navigate() {
    var id = currentId(), last = null;
    if (!id) {
      try { last = localStorage.getItem(OLD_LAST); } catch (e) {}
      id = (last && byId[last]) ? last : DATA[0].id;
      history.replaceState(null, "", "#" + id);
    }
    show(id);
  }
  function go(offset) {
    var s = byId[currentId() || DATA[0].id], t = s._index + offset;
    if (t < 0 || t >= DATA.length) return;
    if (location.hash === "#" + DATA[t].id) show(DATA[t].id); else location.hash = DATA[t].id;
  }

  function updatePill() {
    var doneCount = Object.keys(store.done).filter(function (k) { return byId[k]; }).length;
    els.pill.textContent = "";
    els.pill.appendChild(document.createTextNode(doneCount + " / " + DATA.length));
    var long = el("span", "pill-long", doneCount === DATA.length ? " complete \u{1F3C6}" : " complete");
    els.pill.appendChild(long);
    if (els.barFill) els.barFill.style.width = pct(doneCount, DATA.length) + "%";
    if (els.bar) els.bar.setAttribute("aria-valuenow", String(doneCount));
  }
  function syncDone() {
    var id = currentId() || DATA[0].id;
    els.done.checked = isDone(id);
    els.doneText.textContent = isDone(id) ? "Completed \u2014 nice!" : "Mark this section complete";
    decorateNav(); updatePill();
  }

  /* ================= drawer ================= */
  function openDrawer() { els.sidebar.classList.add("open"); els.menuBtn.setAttribute("aria-expanded", "true"); els.scrim.hidden = false; }
  function closeDrawer() { els.sidebar.classList.remove("open"); els.menuBtn.setAttribute("aria-expanded", "false"); els.scrim.hidden = true; }

  /* ================= wire up ================= */
  els.menuBtn.addEventListener("click", function () {
    if (els.sidebar.classList.contains("open")) closeDrawer(); else openDrawer();
  });
  els.scrim.addEventListener("click", closeDrawer);
  window.addEventListener("resize", function () { if (window.innerWidth > 899) closeDrawer(); });
  els.navList.addEventListener("click", function () { closeDrawer(); });
  els.search.addEventListener("input", function () { filterNav(els.search.value); });
  els.search.addEventListener("keydown", function (e) { if (e.key === "Escape") { els.search.value = ""; filterNav(""); } });
  els.done.addEventListener("change", function () {
    setSectionDone(currentId() || DATA[0].id, els.done.checked);
    syncDone();
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
