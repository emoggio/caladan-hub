/* Map lenses: each one re-emphasises the same picture (highlight some bubbles, dim the rest) and says what it found. */
(function () {
  var H = window.H, h = H.h, HUB = window.HUB;

  function count(list) {
    var p = list.filter(function (o) { return o.person; }).length, o = list.length - p;
    var bits = [];
    if (p) bits.push(H.plural(p, 'person', 'people'));
    if (o) bits.push(H.plural(o, 'organisation'));
    return bits.join(' and ') || 'Nobody';
  }
  function owned(key, name) {
    return { key: key, label: name + '’s', test: function (o) { return o.owner === key; },
      say: function (hit) { return [h('b', null, count(hit)), ' are mainly ' + name + '’s: ' + name + ' has had most of the contact.']; } };
  }
  /* Investors and the companies they backed, with the links between them. */
  function moneyLinks(L) {
    return H.data.edges.filter(function (e) { return e.kind === 'invested' && L.pos[e.source] && L.pos[e.target] && !L.pos[e.source].core && !L.pos[e.target].core; });
  }

  H.lenses = [
    { key: 'attention', label: 'Needs attention', test: function (o) { return !!o.attn; },
      say: function (hit) {
        var due = hit.filter(function (o) { return o.attn === 'due'; }).length;
        return [h('b', null, count(hit)), ' need attention: ', h('b', null, due), ' have a next step that is due and ',
          h('b', null, hit.length - due), ' have gone quiet for ' + HUB.coldAfterDays + ' days or more.'];
      } },
    { key: 'warm', label: 'Warmest', test: function (o) { return o.contacted && H.daysSince(o.last) != null && H.daysSince(o.last) < HUB.coldAfterDays; },
      say: function (hit) { return [h('b', null, count(hit)), ' you have been in touch with in the last ' + HUB.coldAfterDays + ' days. They sit in the inner ring.']; } },
    owned('eugenio', 'Eugenio'), owned('alex', 'Alex'),
    { key: 'both', label: 'Shared', test: function (o) { return o.owner === 'both'; },
      say: function (hit) { return [h('b', null, count(hit)), ' are shared: both of you are in regular contact.']; } },
    { key: 'never', label: 'Never contacted', test: function (o) { return !o.contacted; },
      say: function (hit) { return [h('b', null, count(hit)), ' are on the map but neither of you has emailed, called or met them. Organisations nobody has reached sit in the outer ring.']; } },
    { key: 'money', label: 'Money', links: moneyLinks,
      test: function (o, L) {
        if (!L._money) { L._money = {}; moneyLinks(L).forEach(function (e) { L._money[e.source] = 'investor'; L._money[e.target] = L._money[e.target] || 'backed'; }); }
        return !!L._money[o.id];
      },
      say: function (hit, L) {
        var inv = hit.filter(function (o) { return L._money[o.id] === 'investor'; });
        var known = inv.filter(function (o) { return o.contacted || H.knownAt(o.id).length; }).length;
        return [h('b', null, H.plural(inv.length, 'investor')), ' on the map backed ', h('b', null, H.plural(hit.length - inv.length, 'company', 'companies')),
          '. You have a contact at ', h('b', null, known), ' of the investors. Point at or tap a bubble to see who backed whom.'];
      } },
    { key: 'all', label: 'Whole map', test: function () { return true; },
      say: function (hit, L) {
        return [h('b', null, count(hit)), ' in ' + L.groups.length + ' territories. Closer to the centre means more recent contact.'];
      } }
  ];
  H.lensByKey = function (k) { return H.lenses.filter(function (l) { return l.key === k; })[0] || H.lenses[0]; };

  H.mapLegend = function () {
    function sw(cls, text) { return h('span', null, h('i', { class: 'sw ' + cls }), text); }
    return h('div', { class: 'map-legend small' },
      h('span', { class: 'lg-title' }, 'Colour: who looks after it'),
      sw('o-eugenio', 'Eugenio'), sw('o-alex', 'Alex'), sw('o-both', 'both of you'), sw('o-none', 'nobody yet'),
      h('span', { class: 'lg-title' }, 'Shape'),
      sw('big o-none', 'organisation'), sw('dot o-none', 'person'),
      sw('m-due', 'thick red ring: next step due'), sw('m-cold', 'thin amber ring: gone quiet ' + HUB.coldAfterDays + '+ days'),
      h('span', { class: 'lg-title' }, 'Distance'),
      h('span', null, 'centre = recent contact, outer ring = never contacted'));
  };
})();
