/**
 * car-notify: relays the car contact page to Telegram, so the bot token never reaches the browser.
 *
 * POST /report   multipart: issue, text, name, lang, lat, lon, acc, photo, website (honeypot)
 * POST /visit    { visit }                      -> { ok, ref }
 * POST /update   { ref, visit, activity }       edits the visit message (sendBeacon, text/plain)
 */

const BOT_UA = /bot|crawl|spider|slurp|headless|preview|facebookexternalhit|embedly|curl|wget|python|go-http|java\/|monitor|lighthouse/i;
const MAX_PHOTO = 10 * 1024 * 1024;

const ISSUES = {
  blocked: '🚧 Заважає проїзду',
  accident: '💥 ДТП',
  evacuation: '🚨 Евакуація',
  alarm: '🔊 Звучить сигналізація',
  lights: '💡 Горить світло',
  window: '🪟 Відкрите вікно',
  tire: '🛞 Спущене колесо',
  other: '❔ Інше'
};

const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const clean = (s, max = 120) => escapeHtml(String(s ?? '').trim().slice(0, max));
const num = (n, min, max) => {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.min(Math.max(v, min), max) : null;
};

const kyivTime = (iso) => {
  const t = Date.parse(iso);
  const d = Number.isFinite(t) && Math.abs(Date.now() - t) < 86400000 ? new Date(t) : new Date();
  return d.toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv', dateStyle: 'short', timeStyle: 'short' });
};

function corsHeaders(origin, env) {
  const allowed = env.ALLOWED_ORIGINS.split(',').map((s) => s.trim());
  if (!allowed.includes(origin)) return null;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  };
}

const json = (body, status, headers) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

async function readJson(request) {
  try {
    return JSON.parse(await request.text());
  } catch {
    return null;
  }
}

async function telegram(env, method, payload) {
  const isForm = payload instanceof FormData;
  if (isForm) {
    payload.set('chat_id', env.CHAT_ID);
    payload.set('parse_mode', 'HTML');
  }
  const res = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: isForm ? undefined : { 'Content-Type': 'application/json' },
    body: isForm
      ? payload
      : JSON.stringify({ chat_id: env.CHAT_ID, parse_mode: 'HTML', disable_web_page_preview: true, ...payload })
  });
  const data = await res.json().catch(() => ({}));
  if (!data.ok && !/not modified/.test(data.description || '')) {
    console.error('Telegram error', method, res.status, data.description);
  }
  return data;
}

/* --- Signed message refs ---------------------------------------------------- */

async function hmac(env, text) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(env.BOT_TOKEN), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/[+/=]/g, '').slice(0, 22);
}

const makeRef = async (env, id) => `${id}.${await hmac(env, String(id))}`;

async function readRef(env, ref) {
  const [id, sig] = String(ref || '').split('.');
  if (!/^\d+$/.test(id || '') || !sig) return null;
  return (await hmac(env, id)) === sig ? Number(id) : null;
}

/* --- Visitor description ---------------------------------------------------- */

function flag(cc) {
  if (!/^[A-Z]{2}$/.test(cc || '')) return '';
  return String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

function countryName(cc) {
  try {
    return new Intl.DisplayNames(['uk'], { type: 'region' }).of(cc) || cc;
  } catch {
    return cc;
  }
}

function device(ua) {
  let os = 'Unknown OS';
  if (/iPhone|iPad|iPod/.test(ua)) os = /iPad/.test(ua) ? 'iPadOS' : 'iOS';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/Windows/.test(ua)) os = 'Windows';
  else if (/Mac OS X|Macintosh/.test(ua)) os = 'macOS';
  else if (/Linux/.test(ua)) os = 'Linux';

  const browsers = [
    ['Edge', /Edg\/(\d+)/], ['Opera', /OPR\/(\d+)/], ['Samsung Internet', /SamsungBrowser\/(\d+)/],
    ['Firefox', /(?:Firefox|FxiOS)\/(\d+)/], ['Chrome', /(?:Chrome|CriOS)\/(\d+)/], ['Safari', /Version\/(\d+).*Safari/]
  ];
  let browser = 'Unknown browser';
  for (const [name, re] of browsers) {
    const m = ua.match(re);
    if (m) { browser = `${name} ${m[1]}`; break; }
  }
  // Android UAs carry the phone model, e.g. "Android 14; SM-S918B Build/..."
  const model = (ua.match(/Android [\d.]+; (?:[a-z]{2}-[a-z]{2}; )?([^;)]+?)(?: Build\/[^)]*)?\)/i) || [])[1];
  if (model && model !== 'K') os += ` (${model.trim()})`;
  if (/iPhone/.test(ua)) os += ' (iPhone)';
  return { os, browser, mobile: /Mobi|Android|iPhone|iPod/.test(ua) ? '📱' : '💻' };
}

const mapsLink = (lat, lon, label) =>
  `<a href="https://maps.google.com/?q=${lat},${lon}">${label}</a>`;

// Approximate point from Cloudflare's IP geolocation (city level)
function ipMap(request) {
  const cf = request.cf || {};
  return cf.latitude && cf.longitude ? ` (${mapsLink(cf.latitude, cf.longitude, 'карта')})` : '';
}

async function reverseGeocode(lat, lon) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&accept-language=uk&lat=${lat}&lon=${lon}`,
      { headers: { 'User-Agent': 'car-notify (kyrylohn.github.io/car-link-bio)' } }
    );
    if (!res.ok) return '';
    const a = (await res.json()).address || {};
    const street = [a.road, a.house_number].filter(Boolean).join(', ');
    return [street, a.suburb || a.city_district, a.city || a.town || a.village].filter(Boolean).join(', ');
  } catch {
    return '';
  }
}

function networkLine(request, extra = {}) {
  const cf = request.cf || {};
  const org = cf.asOrganization ? `${escapeHtml(cf.asOrganization)} (AS${cf.asn})` : 'невідомо';
  const conn = extra.connection ? `, ${clean(extra.connection, 10)}` : '';
  return `📶 Мережа: ${org}${conn}`;
}

function deviceLine(request, extra = {}) {
  const d = device(request.headers.get('User-Agent') || '');
  const screen = extra.screen ? `, ${clean(extra.screen, 20)}` : '';
  return `${d.mobile} ${escapeHtml(d.os)}, ${d.browser}${screen}`;
}

function place(request) {
  const cf = request.cf || {};
  const city = [cf.city, cf.region].filter(Boolean).map(escapeHtml).join(', ');
  const country = cf.country ? `${flag(cf.country)} ${escapeHtml(countryName(cf.country))}` : '';
  const tz = cf.timezone && cf.timezone !== 'Europe/Kyiv' ? `, ${escapeHtml(cf.timezone)}` : '';
  return ([city, country].filter(Boolean).join(', ') || 'невідомо') + tz;
}

function visitText(request, visit) {
  const n = num(visit.visitNo, 1, 100000) || 1;
  const head = n > 1
    ? `🔁 <b>QR-сторінку авто відкрито знову</b> (${n}-й раз з цього телефона${visit.firstSeen ? `, перший ${clean(visit.firstSeen, 20)}` : ''})`
    : '🚗 <b>Хтось відкрив QR-сторінку авто</b>';
  const ref = clean(visit.referrer, 200);
  const qr = visit.qr ? ` (наліпка «${clean(visit.qr, 40)}»)` : '';

  return [
    head,
    '',
    `📍 ${place(request)}, за IP${ipMap(request)}`,
    networkLine(request, visit),
    deviceLine(request, visit),
    `🗣 Мова сайту: ${visit.siteLang === 'en' ? 'EN' : 'UA'}; браузер: ${clean(visit.languages, 60) || '?'}`,
    `🔗 Звідки: ${ref || 'QR-код або пряме посилання'}${qr}`,
    `🌐 IP: <code>${escapeHtml(request.headers.get('CF-Connecting-IP') || 'Unknown')}</code>`,
    `🕐 ${kyivTime(visit.openedAt)} (Київ)`
  ].join('\n');
}

const ACTION_LABELS = {
  call: '📞 натиснув «Подзвонити»',
  telegram: '✈️ відкрив Telegram',
  issue: '🧭 почав заповнювати повідомлення',
  sent: '✅ надіслав повідомлення',
  photo: '📷 додав фото',
  geo: '📍 поділився місцезнаходженням',
  lang: '🔤 перемкнув мову'
};

function activityText(activity = {}) {
  const sec = num(activity.seconds, 0, 86400) ?? 0;
  const time = sec < 60 ? `${sec} с` : `${Math.floor(sec / 60)} хв ${sec % 60} с`;
  const actions = [...new Set((Array.isArray(activity.actions) ? activity.actions : []).map(String))]
    .filter((a) => ACTION_LABELS[a])
    .map((a) => ACTION_LABELS[a]);
  return ['', '—', `⏱ На сторінці: ${time}`, ...(actions.length ? actions : ['Нічого не натискав'])].join('\n');
}

/* --- Handlers --------------------------------------------------------------- */

async function handleReport(request, env, cors) {
  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, error: 'bad_form' }, 400, cors);
  }
  if (form.get('website')) return json({ ok: true }, 200, cors);

  const issue = ISSUES[form.get('issue')] || '';
  const text = String(form.get('text') || '').trim().slice(0, 1000);
  const name = String(form.get('name') || '').trim().slice(0, 60);
  const photo = form.get('photo');
  const hasPhoto = photo && typeof photo === 'object' && photo.size > 0;

  if (!issue && !text) return json({ ok: false, error: 'empty' }, 400, cors);
  if (hasPhoto && (photo.size > MAX_PHOTO || !/^image\//.test(photo.type))) {
    return json({ ok: false, error: 'photo' }, 400, cors);
  }

  const lat = Number(form.get('lat'));
  const lon = Number(form.get('lon'));
  const hasGeo = Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && (lat || lon);
  const acc = num(form.get('acc'), 0, 100000);

  const address = hasGeo ? await reverseGeocode(lat, lon) : '';
  const secs = num(form.get('secs'), 0, 86400);
  const visitNo = num(form.get('visitNo'), 1, 100000);
  const extra = { screen: form.get('screen'), connection: form.get('connection') };

  const body = [
    `🚗 <b>${issue || '💬 Повідомлення щодо авто'}</b>`,
    text ? `\n💬 ${escapeHtml(text)}` : '',
    '',
    name ? `👤 ${escapeHtml(name)}` : '👤 без імені',
    hasGeo
      ? `📍 ${address ? escapeHtml(address) : 'точка на карті'} (${mapsLink(lat, lon, 'відкрити')}${acc ? `, ±${acc} м` : ''})`
      : `📍 ${place(request)}, за IP${ipMap(request)}`,
    networkLine(request, extra),
    deviceLine(request, extra),
    `🗣 ${form.get('lang') === 'en' ? 'Писали англійською' : 'Писали українською'}` +
      (secs !== null ? `, на сторінці ${secs < 60 ? `${secs} с` : `${Math.floor(secs / 60)} хв ${secs % 60} с`}` : '') +
      (visitNo > 1 ? `, ${visitNo}-й візит` : ''),
    `🌐 IP: <code>${escapeHtml(request.headers.get('CF-Connecting-IP') || 'Unknown')}</code>`,
    `🕐 ${kyivTime()} (Київ)`
  ].join('\n');

  let res;
  if (hasPhoto) {
    const fd = new FormData();
    fd.set('photo', photo, photo.name || 'photo.jpg');
    // Photo captions are capped at 1024 characters
    fd.set('caption', body.length > 1024 ? `${body.slice(0, 1000)}…` : body);
    res = await telegram(env, 'sendPhoto', fd);
  } else {
    res = await telegram(env, 'sendMessage', { text: body });
  }
  if (!res.ok) return json({ ok: false }, 502, cors);

  if (hasGeo) {
    await telegram(env, 'sendLocation', {
      latitude: lat,
      longitude: lon,
      horizontal_accuracy: acc ? Math.min(acc, 1500) : undefined,
      reply_to_message_id: res.result.message_id
    });
  }
  return json({ ok: true }, 200, cors);
}

async function handleVisit(request, env, cors) {
  const data = (await readJson(request)) || {};
  if (BOT_UA.test(request.headers.get('User-Agent') || '')) return json({ ok: true, skipped: 'bot' }, 200, cors);

  const res = await telegram(env, 'sendMessage', { text: visitText(request, data.visit || {}) });
  if (!res.ok) return json({ ok: false }, 502, cors);
  return json({ ok: true, ref: await makeRef(env, res.result.message_id) }, 200, cors);
}

async function handleUpdate(request, env, cors) {
  const data = await readJson(request);
  const id = data && (await readRef(env, data.ref));
  if (!id) return json({ ok: false, error: 'bad_ref' }, 400, cors);

  const res = await telegram(env, 'editMessageText', {
    message_id: id,
    text: `${visitText(request, data.visit || {})}\n${activityText(data.activity)}`
  });
  return json({ ok: !!res.ok }, 200, cors);
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request.headers.get('Origin') || '', env);
    if (!cors) return new Response('Forbidden', { status: 403 });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return json({ ok: false, error: 'method' }, 405, cors);

    const { pathname } = new URL(request.url);
    if (pathname === '/report') return handleReport(request, env, cors);
    if (pathname === '/visit') return handleVisit(request, env, cors);
    if (pathname === '/update') return handleUpdate(request, env, cors);
    return json({ ok: false, error: 'not_found' }, 404, cors);
  }
};
