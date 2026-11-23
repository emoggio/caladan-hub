/* Small helpers shared by every view. */
(function () {
  var H = window.H;
  var DAY = 86400000;
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /* h('div', {class:'x', onclick:fn}, child, 'text', [more]) -> element. Text is always set as text. */
  H.h = function (tag, attrs) {
    var el = document.createElement(tag), i, k;
    if (attrs) for (k in attrs) {
      var v = attrs[k];
      if (v == null || v === false) continue;
      if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked' || k === 'selected' || k === 'disabled' || k === 'hidden') el[k] = !!v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  };
  function add(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) return c.forEach(function (x) { add(el, x); });
    el.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
  }
  H.clear = function (el) { while (el.firstChild) el.removeChild(el.firstChild); return el; };

  H.todayISO = function () {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  };
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  /* Dates in the data are 'YYYY-MM-DD', sometimes 'YYYY-MM' or empty. */
  H.parse = function (s) {
    if (!s || typeof s !== 'string') return null;
    var m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(s);
    return m ? new Date(+m[1], +m[2] - 1, +(m[3] || 1)) : null;
  };
  H.daysSince = function (s) {
    var d = H.parse(s); if (!d) return null;
    return Math.floor((new Date(H.todayISO() + 'T00:00:00') - d) / DAY);
  };
  H.fmtDate = function (s) {
    var d = H.parse(s); if (!d) return '';
    var day = /^\d{4}-\d{2}-\d{2}/.test(s) ? d.getDate() + ' ' : '';
    return day + MONTHS[d.getMonth()] + (d.getFullYear() !== new Date().getFullYear() || !day ? ' ' + d.getFullYear() : '');
  };
  H.ago = function (s) {
    var n = H.daysSince(s);
    if (n == null) return '';
    if (n < 0) return n === -1 ? 'tomorrow' : 'in ' + (-n) + ' days';
    if (n === 0) return 'today';
    if (n === 1) return 'yesterday';
    if (n < 60) return n + ' days ago';
    if (n < 730) return Math.round(n / 30.4) + ' months ago';
    return Math.round(n / 365) + ' years ago';
  };
  H.agoTime = function (iso) {
    var t = Date.parse(iso); if (isNaN(t)) return 'never';
    var m = Math.round((Date.now() - t) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return m + ' min ago';
    if (m < 48 * 60) return Math.round(m / 60) + ' h ago';
    return Math.round(m / 1440) + ' days ago';
  };
  H.money = function (n, cur) {
    if (n == null || isNaN(n)) return '';
    var c = cur || '$', a = Math.abs(n);
    if (a >= 1e9) return c + trim(n / 1e9) + 'B';
    if (a >= 1e6) return c + trim(n / 1e6) + 'M';
    if (a >= 1e3) return c + Math.round(n / 1e3) + 'k';
    return c + n;
  };
  function trim(x) { return (Math.abs(x) >= 100 ? Math.round(x) : Math.round(x * 10) / 10).toString(); }
  H.cap = function (s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); };
  H.norm = function (s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); };
  H.clip = function (s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };
  H.plural = function (n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); };
  H.httpUrl = function (u) { return typeof u === 'string' && /^https?:\/\//i.test(u) ? u : null; };
  H.extLink = function (url, text) {
    var u = H.httpUrl(url);
    return u ? H.h('a', { href: u, target: '_blank', rel: 'noopener' }, text || hostOf(u)) : null;
  };
  function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return 'link'; } }
  H.hostOf = hostOf;

  H.store = {
    get: function (k) { try { return localStorage.getItem('hub.' + k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem('hub.' + k, v); } catch (e) { /* private window */ } }
  };
  var toastTimer;
  H.toast = function (msg) {
    var t = document.getElementById('toast');
    if (t._out) { t._out.cancel(); t._out = null; }
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () {
      if (H.calm.matches || !t.animate) { t.hidden = true; return; }
      /* leaves the way it came: a short fade and an 8px drop */
      var a = t._out = t.animate([{ opacity: 1, transform: 'translate(-50%, 0)' }, { opacity: 0, transform: 'translate(-50%, 8px)' }], { duration: 160, easing: H.easing(), fill: 'forwards' });
      a.onfinish = function () { if (t._out !== a) return; t._out = null; t.hidden = true; a.cancel(); };
    }, 3200);
  };
  /* A button that opens a person's or organisation's profile. */
  H.nodeLink = function (id, label) {
    var n = H.data.nodes.get(id);
    if (!n) return H.h('span', null, label || id);
    return H.h('button', { class: 'link', type: 'button', onclick: function () { H.openProfile(id); } }, label || n.name);
  };
  H.select = function (id, options, value, onchange) {
    return H.h('select', { id: id, onchange: onchange }, options.map(function (o) {
      var v = Array.isArray(o) ? o[0] : o, t = Array.isArray(o) ? o[1] : o;
      return H.h('option', { value: v, selected: v === value }, t);
    }));
  };
  /* days from today to a date: negative when it has passed, null when there is no date */
  H.daysTo = function (s) { var n = H.daysSince(s); return n == null ? null : -n; };
  /* a node id shown as a link when it is on the map, as plain text when someone typed a name instead */
  H.who = function (v) {
    if (!v) return null;
    if (H.data.nodes.has(v)) return H.nodeLink(v, H.shortName(H.data.nodes.get(v).name));
    return H.h('span', null, H.whoText(v));
  };
  H.whoText = function (v) { var n = v && H.data.nodes.get(v); return n ? H.shortName(n.name) : v === 'eugenio' ? 'Eugenio' : v === 'alex' ? 'Alex' : v === 'both' ? 'Both' : v === 'unassigned' ? 'Unassigned' : String(v || ''); };
  /* an investor card may name a fund that is not on the map */
  H.raiseName = function (r) { return (r && (r.name || H.idToName(r.investorId))) || 'Unnamed investor'; };
  /* names in the data often carry a note after a dash or in brackets */
  H.shortName = function (name) { var s = String(name || '').split(/ [—–-] /)[0]; return s.length > 30 ? s.split(' (')[0] : s; };
  H.evChip = function (e) {
    e = typeof e === 'string' ? (H.httpUrl(e) ? { label: H.hostOf(e), url: e } : { label: e }) : (e || {});
    var text = H.clip(e.label || e.title || 'Source', 44) + (e.date ? ' · ' + H.fmtDate(e.date) : ''), u = H.httpUrl(e.url);
    return u ? H.h('a', { class: 'chip ev', href: u, target: '_blank', rel: 'noopener' }, text, ' ↗') : H.h('span', { class: 'chip ev' }, text);
  };
  /* Evidence stays one tap away: "3 sources" opens the chips. */
  H.sources = function (list, note) {
    list = (Array.isArray(list) ? list : list ? [list] : []).filter(Boolean);
    if (!list.length) return note ? H.h('p', { class: 'kv' }, note) : null;
    return H.h('details', { class: 'src' }, H.h('summary', null, H.plural(list.length, 'source')), H.h('div', { class: 'chips' }, list.slice(0, 6).map(H.evChip)), note ? H.h('p', { class: 'kv' }, note) : null);
  };
  /* A quiet one-line row that opens the rest (used inside drill-ins). state[key] remembers it across redraws. */
  H.fold = function (state, key, label, build, hint) {
    var open = !!state[key];
    var box = H.h('section', { class: 'fold' + (open ? ' open' : '') },
      H.h('button', { class: 'fold-h', type: 'button', 'aria-expanded': String(open), onclick: function () { state[key] = !open; H.render(); } },
        H.h('span', { class: 'fold-t' }, label), hint ? H.h('span', { class: 'fold-n' }, hint) : null, H.h('span', { class: 'fold-x', 'aria-hidden': 'true' }, open ? 'Hide' : 'Show')));
    if (open) { var body = H.h('div', { class: 'fold-b' }); build(body); box.appendChild(body); }
    return box;
  };
  H.idToName = function (v) { var n = v && H.data.nodes.get(v); return n ? H.shortName(n.name) : (v || ''); };
  /* 'eugenio' | 'alex' | 'both' | 'unassigned' from any "who" the data carries */
  H.ownerOf = function (w) {
    w = H.norm(w || ''); var e = w.indexOf('eugenio') >= 0, a = /\bal(ex)?\b/.test(w);
    return w === 'both' || (e && a) ? 'both' : e ? 'eugenio' : a ? 'alex' : 'unassigned';
  };
  /* compact age: 45s, 12m, 3h, 2d */
  H.age = function (iso) {
    var t = typeof iso === 'number' ? iso : Date.parse(iso); if (isNaN(t)) return '';
    var s = Math.max(0, Math.round((Date.now() - t) / 1000));
    return s < 60 ? s + 's' : s < 3600 ? Math.round(s / 60) + 'm' : s < 172800 ? Math.round(s / 3600) + 'h' : Math.round(s / 86400) + 'd';
  };
  /* "16:53 today", "09:10 yesterday", "12 Nov": a moment in London time, as a plain phrase */
  H.londonWhen = function (iso) {
    var t = Date.parse(iso || ''); if (isNaN(t)) return '';
    var o = { timeZone: 'Europe/London' }, day = function (x) { return new Date(x).toLocaleDateString('en-GB', o); };
    var time = new Date(t).toLocaleTimeString('en-GB', Object.assign({ hour: '2-digit', minute: '2-digit' }, o));
    if (day(t) === day(Date.now())) return time + ' today';
    if (day(t) === day(Date.now() - 864e5)) return time + ' yesterday';
    return new Date(t).toLocaleDateString('en-GB', Object.assign({ day: 'numeric', month: 'short' }, o));
  };
  /* the newest updatedAt (or createdAt) across the given collections; nodes is a Map */
  H.newest = function (cols) {
    var best = '';
    cols.forEach(function (c) { var v = H.data[c]; if (!v) return; (v instanceof Map ? Array.from(v.values()) : v).forEach(function (d) { var t = d.updatedAt || d.createdAt || ''; if (typeof t === 'string' && t > best) best = t; }); });
    return best;
  };
  /* a small labelled horizontal bar: label, bar to scale, the count just after it. cls colours the fill.
     o = { k: stable key for batch 3, late: how many of n are late (a warn piece at the end), target: a dashed tick at that count }.
     The fill (.hb-f) carries the whole value, so it can be scaled from its left edge. A zero row is muted. */
  H.bar = function (label, n, max, cls, title, o) {
    o = o || {}; max = Math.max(max, 1);
    var late = Math.min(n, o.late || 0), pct = function (v) { return 'calc((100% - 32px) * ' + (v / max).toFixed(4) + ')'; };
    return H.h('li', { class: 'hb' + (cls ? ' ' + cls : '') + (n ? '' : ' zero'), title: title || null }, H.h('span', { class: 'hb-l' }, label),
      H.h('span', { class: 'hb-t' },
        n ? H.h('span', { class: 'hb-f', 'data-k': o.k ? o.k + '-bar' : null, 'data-v': n, style: 'width:' + pct(n) + ';min-width:' + (late ? 12 : 4) + 'px' },
          n - late ? H.h('i', { style: 'flex:' + (n - late) + ' 1 0' }) : null, late ? H.h('i', { class: 'hb-late', style: 'flex:' + late + ' 1 0', 'data-k': o.k ? o.k + '-late' : null, 'data-v': late }) : null) : null,
        H.h('b', { class: 'num', 'data-k': o.k ? o.k + '-n' : null, 'data-v': n }, n),
        o.target != null ? H.h('em', { class: 'hb-goal', style: 'left:' + pct(o.target), title: 'Target ' + o.target }) : null));
  };

  /* One tooltip for every chart. Any element with data-tip='{"t":"title","r":[["label","value","colour"],…]}' shows it on
     hover (or tap). tipBind(box, onHover) wires a chart container once; onHover(el|null) lets a chart dim or highlight. */
  var tipEl = null;
  function tipBox() {
    if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'chtip'; tipEl.setAttribute('role', 'tooltip'); tipEl.hidden = true; document.body.appendChild(tipEl); }
    return tipEl;
  }
  H.tipData = function (title, rows) { return JSON.stringify({ t: title, r: rows || [] }); };
  H.tipAttr = function (title, rows) { return ' data-tip="' + H.tipData(title, rows).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;') + '"'; };
  H.tipShow = function (data, x, y) {
    var t = tipBox(), d; try { d = typeof data === 'string' ? JSON.parse(data) : data; } catch (e) { return; }
    H.clear(t);
    if (d.t) t.appendChild(H.h('b', { class: 'chtip-t' }, d.t));
    (d.r || []).forEach(function (r) { t.appendChild(H.h('span', { class: 'chtip-r' }, H.h('i', r[2] ? { style: 'background:' + r[2] } : { class: 'none' }), H.h('span', null, r[0]), H.h('b', { class: 'num' }, r[1] == null ? '' : r[1]))); });
    t.hidden = false;
    var w = t.offsetWidth, hh = t.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
    var left = x + 14 + w > vw - 8 ? x - w - 14 : x + 14, top = y + 14 + hh > vh - 8 ? y - hh - 12 : y + 14;
    t.style.left = Math.max(8, Math.min(left, vw - w - 8)) + 'px'; t.style.top = Math.max(8, top) + 'px';
  };
  H.tipHide = function () { if (tipEl) tipEl.hidden = true; };
  H.tipBind = function (box, onHover) {
    var cur = null;
    function at(ev) {
      var el = ev.target.closest ? ev.target.closest('[data-tip]') : null;
      if (el && !box.contains(el)) el = null;
      if (el !== cur) { cur = el; if (onHover) onHover(el); }
      if (el) H.tipShow(el.getAttribute('data-tip'), ev.clientX, ev.clientY); else H.tipHide();
    }
    box.addEventListener('pointermove', at);
    box.addEventListener('pointerdown', at);
    box.addEventListener('pointerleave', function () { cur = null; if (onHover) onHover(null); H.tipHide(); });
    return box;
  };
  window.addEventListener('scroll', function () { H.tipHide(); }, true);

  /* a 32px sparkline: 2px line over an area, in currentColor. pts = numbers, oldest first.
     o = { k, area: 'grad' (.3 to .05) | 'flat' (6%), w, title } */
  var sparkN = 0;
  H.spark = function (pts, o) {
    o = o || {}; if (!pts || pts.length < 2) return null;
    var W = o.w || 120, Hh = 32, pad = 2, max = Math.max.apply(null, pts.concat([1])), min = Math.min(0, Math.min.apply(null, pts));
    var xy = pts.map(function (v, i) { return [pad + i / (pts.length - 1) * (W - 2 * pad), Hh - pad - (v - min) / (max - min || 1) * (Hh - 2 * pad)]; });
    var line = xy.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(''), id = 'spk' + (++sparkN);
    var area = line + 'L' + xy[xy.length - 1][0].toFixed(1) + ' ' + (Hh - pad) + 'L' + xy[0][0].toFixed(1) + ' ' + (Hh - pad) + 'Z';
    var fill = o.area === 'flat' ? 'fill="currentColor" fill-opacity=".06"' : 'fill="url(#' + id + ')"';
    var d = document.createElement('span'); d.className = 'spark'; if (o.title) d.title = o.title;
    if (o.k) { d.setAttribute('data-k', o.k); d.setAttribute('data-v', pts[pts.length - 1]); }
    d.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + Hh + '" width="' + W + '" height="' + Hh + '" aria-hidden="true">' +
      (o.area === 'flat' ? '' : '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity=".3"/><stop offset="1" stop-color="currentColor" stop-opacity=".05"/></linearGradient></defs>') +
      '<path d="' + area + '" ' + fill + '/><path d="' + line + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>';
    return d;
  };
  /* ---------- motion ----------
     Motion only explains a change. H.render() rebuilds the view, so nothing animates on a draw by itself: before the
     rebuild H.snapshot() notes every [data-k] number and bar, and after it H.settle() moves only what really changed
     (numbers count to the new value, bars grow or shrink from their old length). H.calm is the one reduced-motion
     switch: every helper checks H.calm.matches and lands on the final state. */
  H.calm = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  function token(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  /* the durations and the easing live in css/base.css (--d1 150, --d2 220, --d3 420, --ease) */
  H.dur = function (n) { var v = parseFloat(token('--d' + n)); return v > 0 ? v : [0, 150, 220, 420][n]; };
  H.easing = function () { return token('--ease') || 'cubic-bezier(.22, 1, .36, 1)'; };
  /* the same curve for requestAnimationFrame tweens: progress 0..1 in, eased 0..1 out */
  H.ease = (function (x1, y1, x2, y2) {
    function b(t, p1, p2) { var u = 1 - t; return 3 * p1 * t * u * u + 3 * p2 * t * t * u + t * t * t; }
    return function (p) {
      if (p <= 0) return 0; if (p >= 1) return 1;
      var lo = 0, hi = 1, t = p;
      for (var i = 0; i < 24; i++) { var x = b(t, x1, x2); if (Math.abs(x - p) < 1e-5) break; if (x < p) lo = t; else hi = t; t = (lo + hi) / 2; }
      return b(t, y1, y2);
    };
  })(0.22, 1, 0.36, 1);

  /* bar fills: one element each, scaled from the left (a money column from the bottom) */
  var BAR = '.hb-f, .agebar-f, .sb-f, .ga-track i, .gt-span b, .heat-t i, .ch-stack';
  var NUM = /^([^\d-]*)(-?\d+)([\s\S]*)$/;   /* the first whole number, and the text around it */
  function inBar(el) { var p = el.parentElement; return !!(p && p.closest(BAR)); }
  H.snapshot = function (root) {
    var m = {};
    (root.querySelector('.drill') || root).querySelectorAll('[data-k]').forEach(function (el) {
      var k = el.getAttribute('data-k');
      if (k in m) { m[k] = null; return; }   /* a key drawn twice cannot be compared: leave it alone */
      var o = { v: parseFloat(el.getAttribute('data-v')), bar: el.matches(BAR) };
      if (o.bar) { var r = el.getBoundingClientRect(); o.tall = el.matches('.ch-stack'); o.s = o.tall ? r.height : r.width; }
      else o.t = el._t != null ? el._t : el.textContent;   /* mid-count: the number it is counting to */
      m[k] = o;
    });
    return m;
  };
  function roll(el, a, b, pre, post) {
    var t0 = performance.now(), d = H.dur(3), fin = el.textContent;
    el._t = fin; el.textContent = pre + a + post;
    requestAnimationFrame(function step(now) {
      if (!el.isConnected) return;
      var p = Math.min(1, (now - t0) / d);
      if (p >= 1) { el.textContent = fin; el._t = null; return; }
      el.textContent = pre + Math.round(a + (b - a) * H.ease(p)) + post;
      requestAnimationFrame(step);
    });
  }
  function glow(box, calm) {
    var acc = token('--accent') || '#3987e5', on = 'inset 0 0 0 100vmax color-mix(in srgb, ' + acc + ' 18%, transparent)', off = 'inset 0 0 0 100vmax color-mix(in srgb, ' + acc + ' 0%, transparent)';
    box.animate(calm ? [{ boxShadow: on }, { boxShadow: on }] : [{ boxShadow: on }, { boxShadow: off }], { duration: calm ? 900 : 1200, easing: calm ? 'linear' : 'ease-out' });
  }
  H.settle = function (root, prev) {
    if (!prev || !root.animate) return;
    var calm = H.calm.matches, count = {}, bars = [], boxes = [];
    var all = Array.prototype.slice.call((root.querySelector('.drill') || root).querySelectorAll('[data-k]'));   /* with a sheet open, only the sheet moves */
    all.forEach(function (el) { var k = el.getAttribute('data-k'); count[k] = (count[k] || 0) + 1; });
    var changed = false;
    all.forEach(function (el) {
      var k = el.getAttribute('data-k'), p = prev[k], v = parseFloat(el.getAttribute('data-v'));
      if (!p || count[k] > 1 || isNaN(v) || isNaN(p.v)) return;   /* new, doubled or not a number: no motion */
      /* a bar is a candidate even when its own value held: if another value changed the scale, it rescales with it */
      if (el.matches(BAR)) { if (p.bar && p.s > 0) bars.push([el, p]); if (v !== p.v) changed = true; return; }
      if (v === p.v) return;
      changed = true;
      if (p.bar || inBar(el) || el.children.length || !el.textContent.trim() || !el.getClientRects().length) return;   /* pieces of a bar, markers, hidden */
      var box = el.closest('.stat, li, tr, .p-hero, .p-delta') || el;
      if (!(box instanceof SVGElement) && boxes.indexOf(box) < 0) boxes.push(box);
      if (calm) return;
      var now = NUM.exec(el.textContent), was = NUM.exec(p.t || '');
      /* count only plain whole numbers whose words around them stay the same ("3 of 5" to "4 of 5"); anything else just changes */
      if (now && was && now[1] === was[1] && now[3] === was[3] && +now[2] === v && +was[2] === p.v && v === Math.round(v) && p.v === Math.round(p.v)) roll(el, p.v, v, now[1], now[3]);
    });
    boxes.forEach(function (b) { glow(b, calm); });
    if (calm || !changed || !bars.length) return;   /* an unchanged redraw (the minute tick, a resize) never moves anything */
    var sized = bars.map(function (b) { var r = b[0].getBoundingClientRect(); return [b[0], b[1], b[1].tall ? r.height : r.width]; });   /* read every size, then write */
    sized.forEach(function (b) {
      var f = b[1].s / b[2];
      if (!(b[2] > 0) || !isFinite(f) || Math.abs(f - 1) < 0.01) return;
      b[0].animate([{ transform: (b[1].tall ? 'scaleY(' : 'scaleX(') + f.toFixed(4) + ')' }, { transform: 'none' }], { duration: H.dur(3), easing: H.easing() });
    });
  };

  /* the last n days as YYYY-MM-DD, oldest first, in local time */
  H.lastDays = function (n) {
    var out = [], t = H.parse(H.todayISO());
    for (var i = n - 1; i >= 0; i--) { var d = new Date(t.getFullYear(), t.getMonth(), t.getDate() - i); out.push(d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())); }
    return out;
  };
})();
