/* Header lookup: find a person or organisation and open its profile, or ask one of three fixed questions (who knows
   someone at…, who can introduce us to…, investors in…). Plain code, read-only, no model call. */
(function () {
  var H = window.H, h = H.h;
  var QUESTIONS = [
    { kind: 'route', re: /^who (?:do we know|knows?|can we reach)(?: (?:someone|anyone|somebody))? (?:at|in|from|inside) (.+)$/ },
    { kind: 'route', re: /^(?:do we know|we know) (?:someone|anyone|somebody) (?:at|in|from) (.+)$/ },
    { kind: 'route', re: /^who (?:can|could|would) (?:introduce|intro|connect)(?: (?:us|me))? (?:to|with) (.+)$/ },
    { kind: 'route', re: /^(?:intro|introduction|route|path|way in|warm intro)s? (?:to|into|for) (.+)$/ },
    { kind: 'route', re: /^how (?:do|can) (?:we|i) (?:get to|reach|meet) (.+)$/ },
    { kind: 'investors', re: /^(?:investors?|backers?) (?:in|of|behind|for) (.+)$/ },
    { kind: 'investors', re: /^who (?:invested|has invested|invests) in (.+)$/ },
    { kind: 'investors', re: /^who (?:backs|backed|funded|funds) (.+)$/ }
  ];

  function hay(n) {
    return H.norm([n.name, n.role, n._.orgName, n._.sector, (n.tags || []).join(' '), (n.aliases || []).join(' ')].join(' | '));
  }
  /* Rank nodes for free text: every word must appear; names beat roles, tags and sectors. */
  H.findNodes = function (text, limit, filter) {
    var words = H.norm(text).replace(/[?.,!]/g, ' ').split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    var q = words.join(' '), out = [];
    H.data.nodes.forEach(function (n, id) {
      if (H.isUs(id) || (filter && !filter(n))) return;
      var name = H.norm(n.name), all = hay(n), score = 0, i;
      for (i = 0; i < words.length; i++) if (all.indexOf(words[i]) < 0) return;
      if (name === q) score = 100;
      else if (name.indexOf(q) === 0) score = 80;
      else if ((' ' + name).indexOf(' ' + q) >= 0) score = 65;
      else if (words.every(function (w) { return name.indexOf(w) >= 0; })) score = 50;
      else score = 20;
      if (n._.contacted) score += 8;
      if (n._.ref) score -= 6;
      out.push({ n: n, score: score });
    });
    out.sort(function (a, b) { return b.score - a.score || (b.n._.last > a.n._.last ? 1 : b.n._.last < a.n._.last ? -1 : 0) || (a.n.id < b.n.id ? -1 : 1); });
    return out.slice(0, limit || 8).map(function (x) { return x.n; });
  };

  H.parseQuestion = function (text) {
    var q = H.norm(text).replace(/[?.!]+$/, '').replace(/\s+/g, ' ').trim();
    for (var i = 0; i < QUESTIONS.length; i++) {
      var m = QUESTIONS[i].re.exec(q);
      if (m) return { kind: QUESTIONS[i].kind, subject: m[1].replace(/^the /, '') };
    }
    return null;
  };

  H.describe = function (n) {
    var bits = [];
    if (n.type === 'person') { if (n.role) bits.push(H.clip(n.role, 60)); if (n._.orgName) bits.push(n._.orgName); }
    else bits.push(n._.sector ? H.clip(n._.sector, 50) : n.type === 'org' ? 'Organisation' : H.cap(n.type));
    if (n._.ref) bits.push('background reference');
    return bits.join(' · ');
  };
  H.investorsOf = function (id) {
    return H.data.edges.filter(function (e) { return e.kind === 'invested' && e.target === id; });
  };

  function item(label, sub, fn) {
    return h('button', { class: 'sr-item', type: 'button', onclick: function () { close(); document.getElementById('q').value = ''; fn(); } }, h('b', null, label), h('span', null, sub));
  }
  function close() { document.getElementById('search-results').hidden = true; }

  function render(text) {
    var box = H.clear(document.getElementById('search-results'));
    if (!text.trim()) { box.hidden = true; return; }
    box.hidden = false;
    if (!H.data.ready) { box.appendChild(h('p', { class: 'hint' }, 'Still loading…')); return; }
    fill(box, text);
  }
  function fill(box, text) {
    var ask = H.parseQuestion(text), hits;
    if (ask && ask.kind === 'route') {
      hits = H.findNodes(ask.subject, 6);
      box.appendChild(h('p', { class: 'hint' }, hits.length ? 'Warmest routes to…' : 'Nothing on the map called “' + ask.subject + '”.'));
      hits.forEach(function (n) { box.appendChild(item(n.name, H.describe(n), function () { H.openPaths(n.id); })); });
      return;
    }
    if (ask && ask.kind === 'investors') {
      hits = H.findNodes(ask.subject, 4, function (n) { return n.type !== 'person'; });
      var any = false;
      hits.forEach(function (n) {
        var inv = H.investorsOf(n.id), named = n.fin && Array.isArray(n.fin.investors) ? n.fin.investors : [];
        if (!inv.length && named.length) {   /* investors known by name only, not yet on the map */
          any = true;
          box.appendChild(h('p', { class: 'hint' }, 'Investors in ' + n.name + ' (named in its financials, not on the map): ' + named.join(', ') + '.'));
        }
        if (!inv.length) return;
        any = true;
        box.appendChild(h('p', { class: 'hint' }, 'Investors in ' + n.name + ' (' + inv.length + ')'));
        inv.forEach(function (e) {
          var s = H.data.nodes.get(e.source), known = H.knownAt(s.id).length || s._.contacted;
          box.appendChild(item(s.name, [e.round, H.fmtDate(e.date), known ? 'we know someone there' : 'no contact yet'].filter(Boolean).join(' · '),
            function () { H.openProfile(s.id); }));
        });
      });
      if (!any) box.appendChild(h('p', { class: 'hint' }, hits.length
        ? 'No investors recorded for ' + hits[0].name + '. '
        : 'Nothing on the map called “' + ask.subject + '”.'));
      if (hits[0]) box.appendChild(item('Open ' + hits[0].name, H.describe(hits[0]), function () { H.openProfile(hits[0].id); }));
      return;
    }
    hits = H.findNodes(text, 9);
    if (!hits.length) { box.appendChild(h('p', { class: 'hint' }, 'No person or organisation matches. For anything else, ask Claude or Grok.')); return; }
    hits.forEach(function (n) { box.appendChild(item(n.name, H.describe(n), function () { H.openProfile(n.id); })); });
    box.appendChild(item('Find a route to ' + hits[0].name, 'who can introduce us', function () { H.openPaths(hits[0].id); }));
  }

  H.initSearch = function () {
    var input = document.getElementById('q'), timer;
    input.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(function () { render(input.value); }, 90); });
    input.addEventListener('focus', function () { if (input.value) render(input.value); });
    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') { close(); input.blur(); }
      if (ev.key === 'Enter') { var first = document.querySelector('#search-results .sr-item'); if (first) first.click(); }
      if (ev.key === 'ArrowDown') { var f = document.querySelector('#search-results .sr-item'); if (f) { f.focus(); ev.preventDefault(); } }
    });
    document.addEventListener('click', function (ev) { var box = document.getElementById('search'); if (box && !box.contains(ev.target)) close(); });
  };
})();
