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
    goal: 10,
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
    goal: 10,
  },
];

const APP_VERSION = 'V1.1'; // shown on the welcome screen; bump with each release
const DONE_AT = 10; // Done unlocks once the counter reaches this
const RING_CIRCUMFERENCE = 2 * Math.PI * 56;
const BELL_GRACE_MS = 60000; // don't ring for a hold that ended longer ago than this
const CLEAR_CONFIRM_MS = 5000; // how long "Clear All" waits for the confirming tap

// ===== STATE =====
// Saved to localStorage so progress survives iOS closing the app in the background.
// Everything starts fresh each day.
const STORAGE_KEY = 'jaw-exercise-v2';
let state = loadState();   // { day, items: { [id]: { count, holdStart, done } } }
let started = false;       // false while the welcome screen is showing
let current = null;        // the exercise currently open
let finishedId = null;     // exercise whose hold just completed (shows "time's up")
let tickHandle = null;
let wakeLock = null;
let audioCtx = null;
let scheduledBell = null;  // { id, fireAt, nodes } — bell queued on the audio clock
let clearConfirmHandle = null;

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
const welcomeScreen = $('welcome-screen');
const listScreen = $('list-screen');
const exerciseScreen = $('exercise-screen');
const listEl = $('exercise-list');
const counterBtn = $('counter-btn');
const counterValue = $('counter-value');
const ringFill = $('ring-fill');
const doneBtn = $('done-btn');

const CHECK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

// ===== WELCOME SCREEN =====
function greeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'בוקר טוב';
  if (hour >= 12 && hour < 17) return 'צהריים טובים';
  return 'ערב טוב';
}

function formattedToday() {
  return new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });
}

function renderWelcome() {
  $('app-version').textContent = APP_VERSION;
  $('welcome-greeting').textContent = greeting();
  $('welcome-date').textContent = formattedToday();
  const doneCount = EXERCISES.filter((ex) => item(ex.id).done).length;
  const progress = $('welcome-progress');
  progress.hidden = doneCount === 0;
  progress.textContent = doneCount === EXERCISES.length
    ? 'כל התרגילים של היום הושלמו'
    : `השלמת היום ${doneCount} מתוך ${EXERCISES.length} תרגילים`;
}

function start() {
  started = true;
  welcomeScreen.hidden = true;
  route();
}

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
  $('today-date').textContent = formattedToday();

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

  cancelClearConfirm();
  const doneCount = EXERCISES.filter((ex) => item(ex.id).done).length;
  $('progress-count').textContent = doneCount;
  $('progress-total').textContent = EXERCISES.length;
  $('progress-fill').style.width = `${(doneCount / EXERCISES.length) * 100}%`;
}

// ===== CLEAR ALL =====
// First tap asks for confirmation, second tap clears the day.
function onClearClick() {
  const btn = $('clear-btn');
  if (btn.classList.contains('is-confirming')) {
    clearAll();
    return;
  }
  btn.classList.add('is-confirming');
  btn.textContent = 'לנקות הכל? לחצו שוב';
  clearConfirmHandle = setTimeout(cancelClearConfirm, CLEAR_CONFIRM_MS);
}

function cancelClearConfirm() {
  clearTimeout(clearConfirmHandle);
  clearConfirmHandle = null;
  const btn = $('clear-btn');
  btn.classList.remove('is-confirming');
  btn.textContent = 'Clear All';
}

function clearAll() {
  state = { day: todayKey(), items: {} };
  finishedId = null;
  cancelBell();
  stopTicking();
  saveState();
  renderList();
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

  // Done stays locked until the target is reached (but a done mark can always be undone).
  doneBtn.disabled = !it.done && it.count < DONE_AT;
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
    scheduleBellIn(current.hold, current.id);
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
  cancelBell();
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
      if (overBy < BELL_GRACE_MS) bellDue(ex.id);
      else cancelBell();
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
// The bell is queued on the audio clock the moment a hold starts, so it rings
// even if JS timers are throttled (background tabs, a busy phone). If the audio
// clock was suspended and the queued bell hasn't fired by the time the hold
// ends, bellDue() plays one immediately instead. Both paths are guarded so a
// hold can never ring twice or stay silent.
function ensureAudio() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state !== 'running') audioCtx.resume();
  } catch {
    audioCtx = null;
  }
  return audioCtx;
}

// iOS only allows audio that was unlocked by a tap, so every tap nudges it.
function unlockAudio() {
  const ctx = ensureAudio();
  if (!ctx) return;
  try {
    const source = ctx.createBufferSource();
    source.buffer = ctx.createBuffer(1, 1, 22050);
    source.connect(ctx.destination);
    source.start(0);
  } catch {
    // An unlock that fails is not fatal – bellDue() still tries later.
  }
}

// A bell is a few inharmonic partials that fade at different rates.
function ringBell(ctx, at) {
  const master = ctx.createGain();
  master.gain.value = 0.7;
  master.connect(ctx.destination);
  const nodes = [];
  const base = 784; // G5
  const partials = [
    [1, 0.9, 3.2], [2, 0.45, 2.2], [2.76, 0.32, 1.6], [5.4, 0.14, 0.9], [8.93, 0.07, 0.5],
  ];
  [0, 0.9].forEach((offset, strike) => {
    const t = at + offset;
    const level = strike === 0 ? 1 : 0.55;
    partials.forEach(([ratio, amp, decay]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = base * ratio;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(amp * level, t + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + decay);
      osc.connect(gain).connect(master);
      osc.start(t);
      osc.stop(t + decay + 0.05);
      nodes.push(osc);
    });
  });
  return nodes;
}

// Queue the bell for `seconds` from now (re-queuing replaces any earlier one).
function scheduleBellIn(seconds, id) {
  const ctx = ensureAudio();
  if (!ctx) return;
  cancelBell();
  const fireAt = ctx.currentTime + Math.max(seconds, 0);
  scheduledBell = { id, fireAt, nodes: ringBell(ctx, fireAt) };
}

function cancelBell() {
  if (!scheduledBell) return;
  scheduledBell.nodes.forEach((osc) => {
    try { osc.stop(); } catch { /* already finished */ }
  });
  scheduledBell = null;
}

// Called the moment a hold ends: ring now unless the queued bell already did.
function bellDue(id) {
  const alreadyRang = scheduledBell && scheduledBell.id === id && audioCtx
    && audioCtx.currentTime >= scheduledBell.fireAt;
  if (alreadyRang) {
    scheduledBell = null;
    return;
  }
  cancelBell();
  const ctx = ensureAudio();
  if (ctx) ringBell(ctx, ctx.currentTime + 0.02);
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
  if (!started) return;
  const ex = EXERCISES.find((e) => e.id === location.hash.slice(1) && e.kind === 'counter');
  if (ex) openExercise(ex);
  else closeExercise();
}

function goToList() {
  history.replaceState(null, '', location.pathname);
  route();
}

// ===== INIT =====
$('start-btn').addEventListener('click', start);
$('clear-btn').addEventListener('click', onClearClick);
counterBtn.addEventListener('click', increment);
// Any tap is a chance to get the audio context running before the first hold.
document.addEventListener('pointerdown', ensureAudio);
$('reset-btn').addEventListener('click', reset);
doneBtn.addEventListener('click', () => current && toggleDone(current.id));
$('back-btn').addEventListener('click', goToList);
window.addEventListener('hashchange', route);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  ensureToday();
  wakeLock = null;
  ensureAudio(); // iOS suspends the audio clock in the background
  tick();
  // Re-queue the bell for any hold still running, on the resumed audio clock.
  EXERCISES.forEach((ex) => {
    const it = state.items[ex.id];
    if (ex.hold && it && it.holdStart) {
      scheduleBellIn((it.holdStart + ex.hold * 1000 - Date.now()) / 1000, ex.id);
    }
  });
  if (tickHandle) requestWakeLock();
  if (!started) renderWelcome();
  else if (current) renderExercise();
  else renderList();
});

// Every launch opens on the welcome screen.
history.replaceState(null, '', location.pathname + location.search);
if (Object.values(state.items).some((it) => it.holdStart)) startTicking();
renderWelcome();
