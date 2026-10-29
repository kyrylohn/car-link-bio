/**
 * Car contact page: language switch, report form, visit notifications.
 * Messages go through a Cloudflare Worker (source in worker/), which holds the bot token.
 */

const NOTIFY_URL = 'https://car-notify.kyrylohn.workers.dev';

const TEXT = {
  uk: {
    empty: 'Оберіть, що сталося, або напишіть коментар.',
    sending: 'Надсилаю…',
    sent: 'Надіслано. Дякую, я вже бачу повідомлення!',
    failed: 'Не вдалося надіслати. Будь ласка, подзвоніть.',
    geoWait: 'Визначаю місцезнаходження…',
    geoDenied: 'Не вдалося отримати місцезнаходження. Надішлю без нього.',
    photoAdded: 'Фото додано'
  },
  en: {
    empty: 'Pick what happened or write a comment.',
    sending: 'Sending…',
    sent: "Sent. Thank you, I've got your message!",
    failed: "Couldn't send it. Please call instead.",
    geoWait: 'Getting your location…',
    geoDenied: "Couldn't get your location. I'll send without it.",
    photoAdded: 'Photo added'
  }
};

const root = document.documentElement;
const t = (key) => (TEXT[root.lang] || TEXT.uk)[key];

/* --- Language ----------------------------------------------------------------- */

function setLang(lang) {
  root.lang = lang;
  localStorage.setItem('car-lang', lang);
  document.querySelectorAll('[data-set-lang]').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.setLang === lang));
  });
  refreshPhotoLabel();
}

document.querySelectorAll('[data-set-lang]').forEach((b) => {
  b.addEventListener('click', () => {
    setLang(b.dataset.setLang);
    track('lang');
  });
});

/* --- Report form -------------------------------------------------------------- */

const form = document.getElementById('report');
const statusEl = document.getElementById('status');
const sendBtn = document.getElementById('send');
const photoInput = document.getElementById('photo');
const photoLabel = document.getElementById('photo-label');
const geoBox = document.getElementById('geo');
let position = null;

function showStatus(state, message) {
  statusEl.dataset.state = state;
  statusEl.textContent = message;
}

function refreshPhotoLabel() {
  const file = photoInput.files[0];
  photoInput.closest('.extra').classList.toggle('is-set', !!file);
  if (file) photoLabel.textContent = t('photoAdded');
  else photoLabel.innerHTML = '<span data-l="uk">Додати фото</span><span data-l="en">Add a photo</span>';
}

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

form.addEventListener('focusin', () => track('issue'), { once: true });
form.addEventListener('change', () => track('issue'), { once: true });

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
  showStatus('', t('sending'));

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

  let ok = false;
  try {
    const res = await fetch(`${NOTIFY_URL}/report`, { method: 'POST', body: data });
    ok = res.ok;
  } catch (err) {
    console.error('Report error:', err);
  }

  sendBtn.disabled = false;
  if (ok) {
    track('sent');
    form.reset();
    position = null;
    refreshPhotoLabel();
    showStatus('ok', t('sent'));
  } else {
    showStatus('error', t('failed'));
  }
});

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

setLang(root.lang === 'en' ? 'en' : 'uk');

fetch(`${NOTIFY_URL}/visit`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ visit })
})
  .then((r) => (r.ok ? r.json() : null))
  .then((r) => { visitRef = r && r.ref; })
  .catch((err) => console.error('Visit error:', err));
