/**
 * Grok wake-up script for Caladan (runs inside Eugenio's Google account).
 * Wakes Grok's "Caladan brain sync and call prep" routine only when needed:
 *  - new real mail (inbox or sent, no promotions/social/updates/forums), batched at most every 30 min, 7:00-20:00 Mon-Fri London time
 *  - an outside meeting (any guest outside caladanworlds.com) starting in the next 60-120 min
 *  - 30-60 min after an outside meeting ends, so Granola notes get synced
 *
 * Script Properties (Project Settings > Script Properties):
 *  - WEBHOOK_URL: from the routine's Webhook URL field
 *  - AUTH_HEADER: copied straight from the routine's Authorization header field
 *    (or keep WEBHOOK_KEY + KEY_HEADER; both work)
 * Nothing secret lives in this file.
 */
const OWN_DOMAIN = 'caladanworlds.com';
const MAIL_BATCH_MIN = 30;
const TIMEZONE = 'Europe/London';

function setup() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('check').timeBased().everyMinutes(10).create();
  const p = PropertiesService.getScriptProperties();
  if (!p.getProperty('LAST_MAIL_EPOCH')) {
    p.setProperty('LAST_MAIL_EPOCH', String(Math.floor(Date.now() / 1000)));
  }
  Logger.log('Trigger installed.');
}

function check() {
  const p = PropertiesService.getScriptProperties();
  const now = new Date();
  const reasons = [];

  // 1. Mail, batched, working hours only (Europe/London)
  const weekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].indexOf(Utilities.formatDate(now, TIMEZONE, 'EEE')) !== -1;
  const hour = Number(Utilities.formatDate(now, TIMEZONE, 'H'));
  const lastWake = Number(p.getProperty('LAST_MAIL_WAKE') || 0);
  if (weekday && hour >= 7 && hour < 20 && Date.now() - lastWake >= MAIL_BATCH_MIN * 60000) {
    const since = p.getProperty('LAST_MAIL_EPOCH') || String(Math.floor(Date.now() / 1000) - 3600);
    const q = 'after:' + since + ' -category:promotions -category:social -category:updates -category:forums -in:spam -in:trash';
    const threads = GmailApp.search(q, 0, 20);
    if (threads.length) {
      reasons.push({ reason: 'mail', count: threads.length });
      p.setProperty('LAST_MAIL_WAKE', String(Date.now()));
      p.setProperty('LAST_MAIL_EPOCH', String(Math.floor(Date.now() / 1000)));
    }
  }

  // 2. Outside meetings: prep before, sync after
  const seen = JSON.parse(p.getProperty('SEEN') || '{}');
  const cal = CalendarApp.getDefaultCalendar();
  const events = cal.getEvents(new Date(now.getTime() - 90 * 60000), new Date(now.getTime() + 120 * 60000));
  events.forEach(ev => {
    if (ev.isAllDayEvent()) return;
    const outside = ev.getGuestList().some(g => !g.getEmail().toLowerCase().endsWith('@' + OWN_DOMAIN));
    if (!outside) return;
    const id = ev.getId() + '|' + ev.getStartTime().getTime();
    const toStart = (ev.getStartTime() - now) / 60000;
    const sinceEnd = (now - ev.getEndTime()) / 60000;
    if (toStart >= 60 && toStart <= 120 && !seen[id + '|prep']) {
      reasons.push({ reason: 'meeting', title: ev.getTitle(), start: ev.getStartTime().toISOString() });
      seen[id + '|prep'] = Date.now();
    }
    if (sinceEnd >= 30 && sinceEnd <= 60 && !seen[id + '|after']) {
      reasons.push({ reason: 'meeting_ended', title: ev.getTitle(), end: ev.getEndTime().toISOString() });
      seen[id + '|after'] = Date.now();
    }
  });
  Object.keys(seen).forEach(k => { if (Date.now() - seen[k] > 2 * 86400000) delete seen[k]; });
  p.setProperty('SEEN', JSON.stringify(seen));

  if (reasons.length) wake(p, reasons);
}

function buildHeaders(p) {
  const auth = (p.getProperty('AUTH_HEADER') || '').trim();
  const key = (p.getProperty('WEBHOOK_KEY') || '').trim();
  const keyHeader = (p.getProperty('KEY_HEADER') || '').trim();

  const candidate = auth || (keyHeader.indexOf(':') !== -1 || /^bearer\s+/i.test(keyHeader) ? keyHeader : '');
  if (candidate) {
    const colon = candidate.indexOf(':');
    if (colon > 0) {
      return { [candidate.slice(0, colon).trim()]: candidate.slice(colon + 1).trim() };
    }
    if (/^bearer\s+/i.test(candidate)) {
      return { Authorization: candidate };
    }
    if (key) {
      const val = candidate.toLowerCase() === 'authorization' && !/^bearer\s+/i.test(key) ? 'Bearer ' + key : key;
      return { [candidate]: val };
    }
    return { Authorization: 'Bearer ' + candidate };
  }

  if (key) {
    const name = keyHeader || 'Authorization';
    const val = name.toLowerCase() === 'authorization' && !/^bearer\s+/i.test(key) ? 'Bearer ' + key : key;
    return { [name]: val };
  }

  throw new Error('Missing AUTH_HEADER or WEBHOOK_KEY in Script Properties.');
}

function wake(p, reasons) {
  const url = (p.getProperty('WEBHOOK_URL') || '').trim();
  if (!url) throw new Error('Missing WEBHOOK_URL in Script Properties.');
  const headers = buildHeaders(p);
  const headerName = Object.keys(headers)[0];
  const hasBearer = /^bearer\s+/i.test(headers[headerName]);
  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: headers,
    payload: JSON.stringify({ source: 'caladan-grok-wake', at: new Date().toISOString(), reasons: reasons }),
    muteHttpExceptions: true
  });
  const code = res.getResponseCode();
  const body = res.getContentText().slice(0, 300);
  Logger.log('Sent header "' + headerName + '" (bearer=' + hasBearer + ') -> HTTP ' + code + ': ' + body);
  return { code: code, body: body };
}

/** Run manually to test the connection. */
function testWake() {
  const r = wake(PropertiesService.getScriptProperties(), [{ reason: 'test' }]);
  if (r.code < 200 || r.code >= 300) {
    throw new Error('Webhook returned HTTP ' + r.code + ': ' + r.body);
  }
  Logger.log('Test wake accepted.');
}
