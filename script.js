// ===== EXERCISE DATA =====
// Edit this list to change the exercises. `image` is a path inside images/.
// `timer: true` starts a timer on the first Counter tap.
const EXERCISES = [
  {
    id: 'relaxed-jaw',
    title: 'הרפיית הלסת',
    image: 'images/relaxed-jaw.svg',
    timer: true,
    steps: [
      'הניחו את קצה הלשון על החך, ממש מאחורי השיניים העליונות.',
      'הפרידו מעט את השיניים העליונות מהתחתונות.',
      'הרפו את שרירי הלסת והפנים ונשמו לאט.',
      'לחצו על המונה בכל נשימה.',
    ],
  },
  {
    id: 'partial-goldfish',
    title: 'דג זהב – פתיחה חלקית',
    image: 'images/partial-goldfish.svg',
    timer: false,
    steps: [
      'הניחו את הלשון על החך ואצבע אחת על מפרק הלסת, ליד האוזן.',
      'הניחו אצבע נוספת על הסנטר.',
      'הורידו את הלסת התחתונה עד חצי הדרך, ואז סגרו.',
      'לחצו על המונה אחרי כל חזרה.',
    ],
  },
  {
    id: 'full-goldfish',
    title: 'דג זהב – פתיחה מלאה',
    image: 'images/full-goldfish.svg',
    timer: false,
    steps: [
      'הניחו את הלשון על החך ואצבע אחת על מפרק הלסת.',
      'הניחו אצבע נוספת על הסנטר.',
      'פתחו את הפה עד הסוף באיטיות, ואז סגרו.',
      'לחצו על המונה אחרי כל חזרה.',
    ],
  },
  {
    id: 'chin-tuck',
    title: 'הכנסת סנטר',
    image: 'images/chin-tuck.svg',
    timer: true,
    steps: [
      'שבו או עמדו זקוף, כתפיים לאחור וחזה פתוח.',
      'משכו את הסנטר ישר לאחור, כאילו יוצרים "סנטר כפול".',
      'החזיקו 3 שניות ושחררו.',
      'לחצו על המונה אחרי כל חזרה.',
    ],
  },
  {
    id: 'resisted-opening',
    title: 'פתיחה נגד התנגדות',
    image: 'images/resisted-opening.svg',
    timer: true,
    steps: [
      'הניחו את האגודל מתחת לסנטר.',
      'פתחו את הפה לאט תוך לחיצה עדינה של האגודל כלפי מעלה.',
      'החזיקו 3–6 שניות ואז סגרו לאט.',
      'לחצו על המונה אחרי כל חזרה.',
    ],
  },
  {
    id: 'side-to-side',
    title: 'תנועת לסת לצדדים',
    image: 'images/side-to-side.svg',
    timer: false,
    steps: [
      'הניחו חפץ דק (כמו מקל ארטיק) בין השיניים הקדמיות.',
      'הזיזו את הלסת לאט לצד אחד.',
      'חזרו למרכז והזיזו לצד השני.',
      'לחצו על המונה אחרי כל תנועה.',
    ],
  },
];

// ===== STATE =====
// Saved to localStorage so counts survive iOS closing the app in the background.
const STORAGE_KEY = 'jaw-exercise-state-v1';
let state = loadState();   // { [exerciseId]: { count, startedAt } }
let current = null;        // the exercise currently open
let tickHandle = null;
let wakeLock = null;

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable (e.g. private mode) – counts just won't persist.
  }
}

function entryFor(id) {
  return state[id] || { count: 0, startedAt: null };
}

// ===== ELEMENTS =====
const $ = (id) => document.getElementById(id);
const listScreen = $('list-screen');
const exerciseScreen = $('exercise-screen');
const listEl = $('exercise-list');
const counterValue = $('counter-value');
const timerEl = $('timer');
const timerValue = $('timer-value');

// ===== LIST SCREEN =====
function buildList() {
  listEl.innerHTML = '';
  EXERCISES.forEach((ex, i) => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.className = 'exercise-card';
    a.href = `#${ex.id}`;
    a.innerHTML = `
      <span class="card-thumb"><img src="${ex.image}" alt=""></span>
      <span class="card-text">
        <span class="card-number">תרגיל ${i + 1}</span>
        <span class="card-title">${ex.title}</span>
        <span class="card-meta">${ex.timer ? 'מונה + טיימר' : 'מונה'}</span>
      </span>
      <span class="card-chevron" aria-hidden="true">‹</span>
    `;
    li.appendChild(a);
    listEl.appendChild(li);
  });
}

// ===== EXERCISE SCREEN =====
function openExercise(ex) {
  current = ex;
  $('ex-image').src = ex.image;
  $('ex-image').alt = ex.title;
  $('ex-title').textContent = ex.title;

  const steps = $('ex-steps');
  steps.innerHTML = '';
  ex.steps.forEach((text) => {
    const li = document.createElement('li');
    li.textContent = text;
    steps.appendChild(li);
  });

  timerEl.hidden = !ex.timer;
  render();
  if (ex.timer && entryFor(ex.id).startedAt) startTicking();

  listScreen.hidden = true;
  exerciseScreen.hidden = false;
  window.scrollTo(0, 0);
}

function closeExercise() {
  stopTicking();
  current = null;
  exerciseScreen.hidden = true;
  listScreen.hidden = false;
}

function render() {
  if (!current) return;
  const entry = entryFor(current.id);
  counterValue.textContent = entry.count;
  timerValue.textContent = formatElapsed(entry.startedAt);
}

function formatElapsed(startedAt) {
  if (!startedAt) return '00:00';
  const total = Math.floor((Date.now() - startedAt) / 1000);
  const mm = String(Math.floor(total / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

// ===== COUNTER & TIMER =====
function increment() {
  if (!current) return;
  const entry = entryFor(current.id);
  entry.count += 1;
  if (current.timer && !entry.startedAt) {
    entry.startedAt = Date.now();
    startTicking();
  }
  state[current.id] = entry;
  saveState();
  render();

  counterValue.classList.remove('bump');
  void counterValue.offsetWidth; // restart the animation
  counterValue.classList.add('bump');
}

function reset() {
  if (!current) return;
  delete state[current.id];
  saveState();
  stopTicking();
  render();
}

function startTicking() {
  if (tickHandle) return;
  tickHandle = setInterval(render, 250);
  requestWakeLock();
}

function stopTicking() {
  clearInterval(tickHandle);
  tickHandle = null;
  releaseWakeLock();
}

// Keep the screen on while a timer runs (supported on recent iOS; ignored elsewhere).
async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    }
  } catch {
    wakeLock = null;
  }
}

function releaseWakeLock() {
  if (wakeLock) wakeLock.release().catch(() => {});
  wakeLock = null;
}

// ===== ROUTING =====
// The URL hash (#chin-tuck) picks the screen, so a refresh keeps you in place.
function route() {
  const ex = EXERCISES.find((e) => e.id === location.hash.slice(1));
  if (ex) openExercise(ex);
  else closeExercise();
}

// ===== INIT =====
$('counter-btn').addEventListener('click', increment);
$('reset-btn').addEventListener('click', reset);
$('back-btn').addEventListener('click', () => {
  history.replaceState(null, '', location.pathname);
  route();
});
window.addEventListener('hashchange', route);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && tickHandle) {
    wakeLock = null;
    requestWakeLock();
    render();
  }
});

buildList();
route();
