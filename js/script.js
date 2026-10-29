/**
 * Car contact page: language switch, report form with the owner's live reply,
 * call dock, visit notifications.
 * Messages go through a Cloudflare Worker (source in worker/), which holds the bot token.
 */

const NOTIFY_URL = 'https://car-notify.kyrylohn.workers.dev';
const POLL_MS = 4000;
const POLL_FOR_MS = 30 * 60 * 1000;

const TEXT = {
  uk: {
    empty: 'Оберіть, що сталося, або напишіть коментар.',
    failed: 'Не вдалося надіслати. Будь ласка, подзвоніть.',
    geoWait: 'Визначаю місцезнаходження…',
    geoDenied: 'Не вдалося отримати місцезнаходження. Надішлю без нього.',
    photoAdded: 'Фото додано',
    waitingTitle: 'Надіслано',
    waitingText: 'Власник отримав сповіщення в Telegram. Його відповідь з’явиться тут.',
    comingTitle: 'Власник іде',
    comingText: (min) => `Буде приблизно за ${min} хв, о`,
    comingLate: 'Має вже бути поруч.',
    cantTitle: 'Власник не може підійти зараз',
    cantText: 'Якщо справа термінова, будь ласка, подзвоніть.',
    doneTitle: 'Авто вже переставлено',
    doneText: 'Дякую за терпіння і що повідомили!'
  },
  en: {
    empty: 'Pick what happened or write a comment.',
    failed: "Couldn't send it. Please call instead.",
    geoWait: 'Getting your location…',
    geoDenied: "Couldn't get your location. I'll send without it.",
    photoAdded: 'Photo added',
    waitingTitle: 'Sent',
    waitingText: 'The owner got a Telegram notification. Their reply will show up here.',
    comingTitle: 'The owner is on the way',
    comingText: (min) => `About ${min} minutes, by`,
    comingLate: 'Should be there any moment.',
    cantTitle: "The owner can't come right now",
    cantText: "If it's urgent, please call.",
    doneTitle: 'The car has been moved',
    doneText: 'Thanks for your patience and for letting me know!'
  }
};

const root = document.documentElement;
const t = (key) => (TEXT[root.lang] || TEXT.uk)[key];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (id) => document.getElementById(id);

/* --- Language ----------------------------------------------------------------- */

function applyLang(lang) {
  root.lang = lang;
  localStorage.setItem('car-lang', lang);
  document.querySelectorAll('[data-set-lang]').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.setLang === lang));
  });
  refreshPhotoLabel();
  if (reply.ticket) renderResult();
}

document.querySelectorAll('[data-set-lang]').forEach((b) => {
  b.addEventListener('click', () => {
    if (root.lang === b.dataset.setLang) return;
    track('lang');
    const swap = () => applyLang(b.dataset.setLang);
    if (document.startViewTransition && !reducedMotion) document.startViewTransition(swap);
    else swap();
  });
});

/* --- Report form -------------------------------------------------------------- */

const form = $('report');
const statusEl = $('status');
const sendBtn = $('send');
const photoInput = $('photo');
const photoLabel = $('photo-label');
const geoBox = $('geo');
const details = $('details');
const detailsInner = $('details-inner');
let position = null;

function showStatus(state, message) {
  statusEl.dataset.state = state;
  statusEl.textContent = message;
}

function refreshPhotoLabel() {
  const file = photoInput.files[0];
  photoInput.closest('.extra').classList.toggle('is-set', !!file);
  if (file) photoLabel.textContent = t('photoAdded');
  else photoLabel.innerHTML = '<span data-l="uk">Зробити фото</span><span data-l="en">Take a photo</span>';
}

// The rest of the form opens once something is picked, so the call button stays the main thing
form.addEventListener('change', (e) => {
  if (e.target.name !== 'issue') return;
  track('issue');
  if (navigator.vibrate) navigator.vibrate(12);
  if (!details.classList.contains('is-open')) {
    details.classList.add('is-open');
    detailsInner.inert = false;
  }
});

photoInput.addEventListener('change', () => {
  refreshPhotoLabel();
  if (photoInput.files[0]) track('photo');
});

geoBox.addEventListener('change', () => {
  position = null;
  if (!geoBox.checked) return;
  if (!navigator.geolocation) {
    geoBox.checked = false;
    showStatus('error', t('geoDenied'));
    return;
  }
  showStatus('', t('geoWait'));
  navigator.geolocation.getCurrentPosition(
    (p) => {
      position = p.coords;
      track('geo');
      showStatus('', '');
    },
    () => {
      geoBox.checked = false;
      showStatus('error', t('geoDenied'));
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
  );
});

// Phone photos are often 5-10 MB; shrink before upload so it works on mobile data
async function shrinkPhoto(file) {
  if (!file || !file.type.startsWith('image/')) return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 2 * 1024 * 1024) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
    return blob ? new File([blob], 'photo.jpg', { type: 'image/jpeg' }) : file;
  } catch {
    return file;
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const issue = form.querySelector('input[name="issue"]:checked');
  const text = form.elements.text.value.trim();
  if (!issue && !text) {
    showStatus('error', t('empty'));
    return;
  }

  sendBtn.disabled = true;
  sendBtn.classList.add('is-busy');
  showStatus('', '');

  const data = new FormData();
  data.set('issue', issue ? issue.value : '');
  data.set('text', text);
  data.set('name', form.elements.namedItem('name').value.trim());
  data.set('lang', root.lang);
  data.set('website', form.elements.website.value);
  data.set('visitNo', visit.visitNo);
  data.set('screen', visit.screen);
  data.set('connection', visit.connection);
  data.set('secs', Math.round((activity.visibleMs + Date.now() - activity.shownAt) / 1000));
  if (position) {
    data.set('lat', position.latitude);
    data.set('lon', position.longitude);
    data.set('acc', Math.round(position.accuracy || 0));
  }
  const photo = await shrinkPhoto(photoInput.files[0]);
  if (photo) data.set('photo', photo, photo.name || 'photo.jpg');

  let res = null;
  try {
    const r = await fetch(`${NOTIFY_URL}/report`, { method: 'POST', body: data });
    if (r.ok) res = await r.json();
  } catch (err) {
    console.error('Report error:', err);
  }

  sendBtn.disabled = false;
  sendBtn.classList.remove('is-busy');
  if (!res || !res.ok) {
    showStatus('error', t('failed'));
    return;
  }

  track('sent');
  form.reset();
  position = null;
  refreshPhotoLabel();
  details.classList.remove('is-open');
  detailsInner.inert = true;
  startReply(res.ticket, Date.now());
});

/* --- Owner's reply ------------------------------------------------------------ */

const result = $('result');
const reportSection = $('report-section');
const reply = { ticket: null, sentAt: 0, status: 'waiting', at: null, timer: null };

function clock(ms) {
  return new Date(ms).toLocaleTimeString(root.lang === 'en' ? 'en-GB' : 'uk-UA', { hour: '2-digit', minute: '2-digit' });
}

function renderResult() {
  const s = reply.status;
  result.dataset.status = s;
  $('result-wait').hidden = s !== 'waiting';
  $('result-call').hidden = s !== 'cant';

  let title = t('waitingTitle');
  let text = t('waitingText');
  if (s === 'm5' || s === 'm15') {
    const min = s === 'm5' ? 5 : 15;
    const eta = (reply.at || Date.now()) + min * 60000;
    title = t('comingTitle');
    text = eta > Date.now()
      ? `${t('comingText')(min)}<span class="result__eta">${clock(eta)}</span>`
      : t('comingLate');
  } else if (s === 'cant') {
    title = t('cantTitle');
    text = t('cantText');
  } else if (s === 'done') {
    title = t('doneTitle');
    text = t('doneText');
  }
  $('result-title').textContent = title;
  $('result-text').innerHTML = text;
}

async function pollReply() {
  clearTimeout(reply.timer);
  if (!reply.ticket || Date.now() - reply.sentAt > POLL_FOR_MS) return;
  if (document.visibilityState === 'visible') {
    try {
      const r = await fetch(`${NOTIFY_URL}/status?t=${encodeURIComponent(reply.ticket)}`, { cache: 'no-store' });
      const data = r.ok ? await r.json() : null;
      if (data && data.ok && (data.status !== reply.status || data.at !== reply.at)) {
        reply.status = data.status;
        reply.at = data.at;
        if (navigator.vibrate && data.status !== 'waiting') navigator.vibrate([20, 60, 20]);
        renderResult();
      }
    } catch (err) {
      console.error('Status error:', err);
    }
  }
  if (reply.status !== 'done') reply.timer = setTimeout(pollReply, POLL_MS);
}

function startReply(ticket, sentAt) {
  Object.assign(reply, { ticket, sentAt, status: 'waiting', at: null });
  localStorage.setItem('car-reply', JSON.stringify({ ticket, sentAt }));
  reportSection.hidden = true;
  result.hidden = false;
  renderResult();
  result.focus({ preventScroll: true });
  result.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
  pollReply();
}

$('result-again').addEventListener('click', () => {
  clearTimeout(reply.timer);
  reply.ticket = null;
  localStorage.removeItem('car-reply');
  result.hidden = true;
  reportSection.hidden = false;
  showStatus('', '');
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && reply.ticket) pollReply();
});

/* --- Call dock ---------------------------------------------------------------- */

const dock = $('dock');
new IntersectionObserver(([entry]) => {
  // Show the dock only after the main call button has scrolled up out of view
  const shown = !entry.isIntersecting && entry.boundingClientRect.top < 0;
  dock.classList.toggle('is-shown', shown);
  dock.setAttribute('aria-hidden', String(!shown));
  dock.querySelector('a').tabIndex = shown ? 0 : -1;
}).observe($('main-call'));

/* --- Visit notification and actions ------------------------------------------- */

function readVisits() {
  try {
    const v = JSON.parse(localStorage.getItem('car-visits')) || {};
    const n = (v.n || 0) + 1;
    const first = v.first || new Date().toLocaleDateString('uk-UA');
    localStorage.setItem('car-visits', JSON.stringify({ n, first }));
    return { visitNo: n, firstSeen: n > 1 ? first : '' };
  } catch {
    return { visitNo: 1, firstSeen: '' };
  }
}

function referrerHost() {
  try {
    const u = new URL(document.referrer);
    return u.host === location.host ? '' : u.host.replace(/^www\./, '');
  } catch {
    return '';
  }
}

const visit = {
  ...readVisits(),
  screen: `${screen.width}×${screen.height}`,
  connection: (navigator.connection && navigator.connection.effectiveType) || '',
  openedAt: new Date().toISOString(),
  referrer: referrerHost(),
  qr: new URLSearchParams(location.search).get('qr') || '',
  languages: (navigator.languages || [navigator.language]).slice(0, 3).join(', '),
  siteLang: root.lang
};

const activity = { visibleMs: 0, shownAt: Date.now(), actions: [] };
let visitRef = null;
let lastSent = '';

function track(action) {
  if (!activity.actions.includes(action)) activity.actions.push(action);
}

document.querySelectorAll('[data-action]').forEach((a) => {
  a.addEventListener('click', () => track(a.dataset.action));
});

function sendActivity() {
  if (!visitRef) return;
  const seconds = Math.round(activity.visibleMs / 1000);
  const key = `${Math.round(seconds / 10)}|${activity.actions.join()}`;
  if (key === lastSent) return;
  lastSent = key;
  const body = JSON.stringify({ ref: visitRef, visit, activity: { seconds, actions: activity.actions } });
  // text/plain keeps the beacon a "simple" CORS request (no preflight)
  navigator.sendBeacon(`${NOTIFY_URL}/update`, new Blob([body], { type: 'text/plain' }));
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    activity.visibleMs += Date.now() - activity.shownAt;
    sendActivity();
  }
  activity.shownAt = Date.now();
});

/* --- Start ---------------------------------------------------------------------- */

applyLang(root.lang === 'en' ? 'en' : 'uk');

// Coming back to the page shortly after sending shows the same reply card
try {
  const saved = JSON.parse(localStorage.getItem('car-reply'));
  if (saved && saved.ticket && Date.now() - saved.sentAt < 2 * 60 * 60 * 1000) {
    startReply(saved.ticket, saved.sentAt);
  }
} catch {
  localStorage.removeItem('car-reply');
}

fetch(`${NOTIFY_URL}/visit`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ visit })
})
  .then((r) => (r.ok ? r.json() : null))
  .then((r) => { visitRef = r && r.ref; })
  .catch((err) => console.error('Visit error:', err));
