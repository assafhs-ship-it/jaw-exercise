// ===== EXERCISE DATA =====
// kind: 'counter' opens a screen with a Counter button; 'check' is a list-only step.
// hold: seconds — each Counter tap starts a timer that stops there and rings a bell.
// goal: target number of reps, shown under the count.
// counterLabel: text on the Counter button (defaults to "Counter").
const EXERCISES = [
  {
    id: 'open-wide',
    title: 'לפתוח פה גדול',
    description: 'לפתוח פה גדול ל-10 שניות, 10 פעמים.',
    image: 'images/open-wide.svg',
    kind: 'counter',
    hold: 10,
    goal: 10,
  },
  {
    id: 'wide-fingers',
    title: 'פה גדול עם אצבעות',
    description: 'לפתוח פה גדול ולהניח אצבע על השיניים התחתונות ולמתוח למטה לפתיחה. 5 מתיחות, 10 פעמים.',
    image: 'images/wide-fingers.svg',
    kind: 'counter',
    goal: 10,
  },
  {
    id: 'three-fingers',
    title: 'בדיקה להכניס 3 אצבעות',
    image: 'images/three-fingers.svg',
    kind: 'check',
  },
  {
    id: 'close-resist',
    title: 'סגירה עם לחץ',
    description: 'להניח 2 אצבעות על הטוחנות התחתונות ולנסות לסגור את הפה, והאצבעות מתנגדות לכיוון פתיחה.',
    image: 'images/close-resist.svg',
    kind: 'counter',
    hold: 10,
  },
  {
    id: 'jaw-forward',
    title: 'לסת קדימה',
    description: 'להביא לסת קדימה עם מעט פתיחה, ולהתנגד עם אגרוף לכיוון אחורה. לספור עד 10, 10 פעמים.',
    image: 'images/jaw-forward.svg',
    kind: 'counter',
    goal: 10,
  },
  {
    id: 'side-to-side',
    title: 'לסת לצדדים',
    description: 'להכניס אצבעות בשני צידי הלסת ולדחוף פעם לשמאל ולהתנגד, ואז לצד ימין ולהתנגד.',
    image: 'images/side-to-side.svg',
    kind: 'counter',
    counterLabel: 'בזוגות',
  },
];

const RING_CIRCUMFERENCE = 2 * Math.PI * 56;
const BELL_GRACE_MS = 3000; // ring only if the hold ended at most this long ago

// ===== STATE =====
// Saved to localStorage so progress survives iOS closing the app in the background.
// Everything starts fresh each day.
const STORAGE_KEY = 'jaw-exercise-v2';
let state = loadState();   // { day, items: { [id]: { count, holdStart, done } } }
let current = null;        // the exercise currently open
let finishedId = null;     // exercise whose hold just completed (shows "time's up")
let tickHandle = null;
let wakeLock = null;
let audioCtx = null;

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && saved.day === todayKey()) return saved;
  } catch {
    // fall through to a fresh day
  }
  return { day: todayKey(), items: {} };
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable (e.g. private mode) – progress just won't persist.
  }
}

function ensureToday() {
  if (state.day !== todayKey()) {
    state = { day: todayKey(), items: {} };
    finishedId = null;
    saveState();
  }
}

function item(id) {
  if (!state.items[id]) state.items[id] = { count: 0, holdStart: null, done: false };
  return state.items[id];
}

// ===== ELEMENTS =====
const $ = (id) => document.getElementById(id);
const listScreen = $('list-screen');
const exerciseScreen = $('exercise-screen');
const listEl = $('exercise-list');
const counterBtn = $('counter-btn');
const counterValue = $('counter-value');
const ringFill = $('ring-fill');
const doneBtn = $('done-btn');

const CHECK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

// ===== LIST SCREEN =====
function metaFor(ex) {
  if (ex.kind === 'check') return ['בדיקה'];
  const parts = [];
  if (ex.hold) parts.push(`טיימר ${ex.hold} שניות`);
  else parts.push(ex.counterLabel ? `מונה ${ex.counterLabel}` : 'מונה');
  if (ex.goal) parts.push(`${ex.goal} חזרות`);
  return parts;
}

function renderList() {
  $('today-date').textContent = new Date().toLocaleDateString('he-IL', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  listEl.innerHTML = '';
  EXERCISES.forEach((ex, i) => {
    const done = item(ex.id).done;
    const li = document.createElement('li');
    const isCheck = ex.kind === 'check';
    const card = document.createElement(isCheck ? 'div' : 'a');
    card.className = `card${done ? ' is-done' : ''}${isCheck ? ' card-static' : ''}`;
    if (!isCheck) card.href = `#${ex.id}`;

    card.innerHTML = `
      <span class="card-thumb"><img src="${ex.image}" alt=""></span>
      <span class="card-text">
        <span class="card-number">${String(i + 1).padStart(2, '0')}</span>
        <span class="card-title">${ex.title}</span>
        <span class="card-meta">${metaFor(ex).map((m) => `<span>${m}</span>`).join('')}</span>
      </span>
    `;

    if (isCheck) {
      // A list-only step: its Done control lives on the card itself.
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = done ? 'check is-done' : 'pill-done';
      btn.setAttribute('aria-label', done ? 'בטל סימון' : 'סמן כבוצע');
      btn.innerHTML = done ? CHECK_SVG : 'Done';
      btn.addEventListener('click', () => toggleDone(ex.id));
      card.appendChild(btn);
    } else {
      card.insertAdjacentHTML('beforeend',
        `<span class="check${done ? ' is-done' : ''}" aria-label="${done ? 'בוצע' : ''}">${done ? CHECK_SVG : ''}</span>`);
    }

    li.appendChild(card);
    listEl.appendChild(li);
  });

  const doneCount = EXERCISES.filter((ex) => item(ex.id).done).length;
  $('progress-count').textContent = doneCount;
  $('progress-total').textContent = EXERCISES.length;
  $('progress-fill').style.width = `${(doneCount / EXERCISES.length) * 100}%`;
}

// ===== EXERCISE SCREEN =====
function openExercise(ex) {
  current = ex;
  const index = EXERCISES.indexOf(ex);
  $('ex-position').textContent = `תרגיל ${String(index + 1).padStart(2, '0')} / ${String(EXERCISES.length).padStart(2, '0')}`;
  $('ex-image').src = ex.image;
  $('ex-image').alt = ex.title;
  $('ex-title').textContent = ex.title;
  $('ex-description').textContent = ex.description || '';
  $('ex-description').hidden = !ex.description;
  $('counter-label').textContent = ex.counterLabel || 'Counter';
  $('counter-goal').textContent = ex.goal ? `מתוך ${ex.goal}` : '';
  $('counter-goal').hidden = !ex.goal;
  $('hold').hidden = !ex.hold;
  $('hold-total').textContent = `מתוך ${ex.hold} שניות`;
  $('ring').toggleAttribute('hidden', !ex.hold && !ex.goal); // SVG elements have no .hidden property

  renderExercise();
  listScreen.hidden = true;
  exerciseScreen.hidden = false;
  window.scrollTo(0, 0);
}

function closeExercise() {
  current = null;
  renderList();
  exerciseScreen.hidden = true;
  listScreen.hidden = false;
  window.scrollTo(0, 0);
}

function holdElapsed(it) {
  return it.holdStart ? (Date.now() - it.holdStart) / 1000 : 0;
}

function renderExercise() {
  if (!current) return;
  const ex = current;
  const it = item(ex.id);
  const running = Boolean(ex.hold && it.holdStart);

  counterValue.textContent = it.count;
  counterBtn.classList.toggle('is-running', running);

  let progress = 0;
  if (ex.hold) {
    const elapsed = Math.min(holdElapsed(it), ex.hold);
    progress = running ? elapsed / ex.hold : (finishedId === ex.id ? 1 : 0);
    $('hold-value').textContent = running ? Math.floor(elapsed) : (finishedId === ex.id ? ex.hold : 0);
    $('hold-status').textContent = running
      ? 'מחזיקים…'
      : finishedId === ex.id ? 'הזמן הסתיים' : 'לחצו על הכפתור כדי להתחיל';
    $('hold').classList.toggle('is-finished', !running && finishedId === ex.id);
  } else if (ex.goal) {
    progress = Math.min(it.count / ex.goal, 1);
  }
  ringFill.style.strokeDasharray = RING_CIRCUMFERENCE;
  ringFill.style.strokeDashoffset = RING_CIRCUMFERENCE * (1 - progress);

  doneBtn.classList.toggle('is-done', it.done);
  doneBtn.innerHTML = it.done ? `${CHECK_SVG}<span>Done</span>` : 'Done';
}

// ===== COUNTER, HOLD TIMER & DONE =====
function increment() {
  if (!current) return;
  unlockAudio();
  const it = item(current.id);
  if (current.hold && it.holdStart) return; // wait for the running hold to finish

  it.count += 1;
  if (current.hold) {
    it.holdStart = Date.now();
    finishedId = null;
    startTicking();
  }
  saveState();
  renderExercise();

  counterValue.classList.remove('bump');
  void counterValue.offsetWidth; // restart the animation
  counterValue.classList.add('bump');
}

function reset() {
  if (!current) return;
  const it = item(current.id);
  it.count = 0;
  it.holdStart = null;
  finishedId = null;
  saveState();
  tick();
  renderExercise();
}

function toggleDone(id) {
  const it = item(id);
  it.done = !it.done;
  saveState();
  if (current && current.id === id) {
    renderExercise();
    if (it.done) setTimeout(goToList, 450);
  } else {
    renderList();
  }
}

// One ticker drives every running hold, so a hold still ends (and rings)
// if you go back to the list while it runs.
function tick() {
  let anyRunning = false;
  EXERCISES.forEach((ex) => {
    const it = state.items[ex.id];
    if (!ex.hold || !it || !it.holdStart) return;
    const overBy = Date.now() - (it.holdStart + ex.hold * 1000);
    if (overBy >= 0) {
      it.holdStart = null;
      finishedId = ex.id;
      saveState();
      if (overBy < BELL_GRACE_MS) playBell();
    } else {
      anyRunning = true;
    }
  });
  renderExercise();
  if (!anyRunning) stopTicking();
}

function startTicking() {
  if (!tickHandle) tickHandle = setInterval(tick, 100);
  requestWakeLock();
}

function stopTicking() {
  clearInterval(tickHandle);
  tickHandle = null;
  releaseWakeLock();
}

// ===== BELL SOUND =====
// iOS only allows audio that was unlocked by a tap, so the Counter tap unlocks it.
function unlockAudio() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state !== 'running') audioCtx.resume();
    const source = audioCtx.createBufferSource();
    source.buffer = audioCtx.createBuffer(1, 1, 22050);
    source.connect(audioCtx.destination);
    source.start(0);
  } catch {
    audioCtx = null;
  }
}

function playBell() {
  if (!audioCtx) return;
  if (audioCtx.state !== 'running') audioCtx.resume();
  const now = audioCtx.currentTime;
  const master = audioCtx.createGain();
  master.gain.value = 0.6;
  master.connect(audioCtx.destination);

  // A bell is a few inharmonic partials that fade at different rates.
  const base = 784; // G5
  const partials = [
    [1, 0.9, 3.2], [2, 0.45, 2.2], [2.76, 0.32, 1.6], [5.4, 0.14, 0.9], [8.93, 0.07, 0.5],
  ];
  [0, 0.9].forEach((offset, strike) => {
    const t = now + offset;
    const level = strike === 0 ? 1 : 0.55;
    partials.forEach(([ratio, amp, decay]) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = base * ratio;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(amp * level, t + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + decay);
      osc.connect(gain).connect(master);
      osc.start(t);
      osc.stop(t + decay + 0.05);
    });
  });
}

// ===== WAKE LOCK =====
// Keep the screen on while a hold runs (supported on recent iOS; ignored elsewhere).
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
// The URL hash (#open-wide) picks the screen, so a refresh keeps you in place.
function route() {
  const ex = EXERCISES.find((e) => e.id === location.hash.slice(1) && e.kind === 'counter');
  if (ex) openExercise(ex);
  else closeExercise();
}

function goToList() {
  history.replaceState(null, '', location.pathname);
  route();
}

// ===== INIT =====
counterBtn.addEventListener('click', increment);
$('reset-btn').addEventListener('click', reset);
doneBtn.addEventListener('click', () => current && toggleDone(current.id));
$('back-btn').addEventListener('click', goToList);
window.addEventListener('hashchange', route);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  ensureToday();
  wakeLock = null;
  tick();
  if (tickHandle) requestWakeLock();
  if (current) renderExercise(); else renderList();
});

if (Object.values(state.items).some((it) => it.holdStart)) startTicking();
route();
