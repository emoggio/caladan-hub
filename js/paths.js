/* Routes: the warmest way to reach someone, drawn on the map with the steps listed beside it. */
(function () {
  var H = window.H, h = H.h;

  /* With a target: open the map and draw the route. */
  H.openPaths = function (id) { if (id && H.data.nodes.has(id)) H.mapRoute(id); else H.go('map'); };

  function routeCard(r, pick) {
    var D = H.data, w = H.warmth(r.effort), c = D.nodes.get(r.contact);
    function link(id) { return h('button', { class: 'link', type: 'button', onclick: function () { pick(id); } }, D.nodes.get(id).name); }
    var steps = [h('li', null, H.firstText(r.contact, r.first.best), r.first.all.length > 1 ? h('span', { class: 'muted' }, ' (both of you know them)') : null)];
    r.steps.forEach(function (st) {
      steps.push(h('li', null, H.stepText(st), st.e.note ? h('div', { class: 'small muted' }, H.clip(st.e.note, 140)) : null));
    });
    return h('article', { class: 'card route' },
      h('header', null, h('h3', null, 'Ask ', link(c.id)), h('span', { class: 'chip ' + w.key, title: w.meaning }, w.label)),
      h('ol', { class: 'route-steps' }, steps));
  }

  /* The hop-by-hop explanation shown beside the map. pick(id) opens a profile in the same panel. */
  H.routeBlock = function (targetId, res, pick) {
    var D = H.data, t = D.nodes.get(targetId), box = h('div', { class: 'section' });
    box.appendChild(h('h2', null, 'Routes to ', h('button', { class: 'link', type: 'button', onclick: function () { pick(t.id); } }, t.name)));
    if (res.direct) box.appendChild(h('p', null, h('b', null, 'You already know them. '), res.direct.all.map(function (s) { return H.firstText(t.id, s); }).join('. ') + '.'));
    if (res.routes.length) {
      var w = H.warmth(res.routes[0].effort);
      box.appendChild(h('p', { class: 'small muted' }, res.direct ? 'Others who could vouch for you, warmest first:' : 'Warmest first. The thick line on the map is the first one. ' + w.label + ' means ' + w.meaning + '.'));
      res.routes.forEach(function (r) { box.appendChild(routeCard(r, pick)); });
      box.appendChild(h('p', { class: 'small muted' }, 'Warm = someone we spoke with recently is one step away. Possible = the link is older or two steps away. Long shot = several weak links in a row.'));
    } else if (!res.direct) {
      box.appendChild(h('div', { class: 'empty' }, h('h3', null, 'No route yet'),
        h('p', null, 'Nobody either of you has spoken with is linked to ' + t.name + ' within three steps. Log a conversation or an introduction on a profile and a route will appear.')));
    }
    var staff = (D.staff.get(t.id) || []).map(function (id) { return D.nodes.get(id); });
    if (staff.length) box.appendChild(h('p', { class: 'small' }, 'People on the map at ' + t.name + ': ',
      staff.map(function (p, i) { return [i ? ', ' : '', h('button', { class: 'link', type: 'button', onclick: function () { pick(p.id); } }, p.name), p._.contacted ? '' : ' (not contacted)']; })));
    return box;
  };
})();
