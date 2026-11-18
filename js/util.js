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
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 3200);
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
  /* a small labelled horizontal bar: label, bar to scale, value. cls colours the fill. */
  H.bar = function (label, n, max, cls, title) {
    return H.h('li', { class: 'hb' + (cls ? ' ' + cls : ''), title: title || null }, H.h('span', { class: 'hb-l' }, label),
      H.h('span', { class: 'hb-t' }, n ? H.h('i', { style: 'width:' + Math.max(3, Math.round(n / Math.max(max, 1) * 100)) + '%' }) : null), H.h('b', { class: 'num' }, n));
  };
})();
