/* =====================================================
   🍅 Pomodoro Timer — app.js
   ===================================================== */

// ── DOM refs ──────────────────────────────────────────
const timeDisplay  = document.getElementById('timeDisplay');
const phaseLabel   = document.getElementById('phaseLabel');
const ringProg     = document.getElementById('ringProg');
const tomatoDots   = document.getElementById('tomatoDots');
const cycleLabel   = document.getElementById('cycleLabel');
const startBtn     = document.getElementById('startBtn');
const resetBtn     = document.getElementById('resetBtn');
const skipBtn      = document.getElementById('skipBtn');
const iconPlay     = startBtn.querySelector('.icon-play');
const iconPause    = startBtn.querySelector('.icon-pause');
const tabs         = document.querySelectorAll('.tab');
const appEl        = document.querySelector('.app');
const blob1        = document.querySelector('.blob-1');
const currentTimeEl = document.getElementById('currentTime');

// Settings inputs
const focusMinEl   = document.getElementById('focusMin');
const shortMinEl   = document.getElementById('shortMin');
const longMinEl    = document.getElementById('longMin');
const cycleCountEl = document.getElementById('cycleCount');
const autoStartEl  = document.getElementById('autoStart');
const notifEl      = document.getElementById('notifEnabled');

// ── Constants ─────────────────────────────────────────
const RING_CIRC = 2 * Math.PI * 96; // ≈ 603.19

// ── State ─────────────────────────────────────────────
let phase        = 'focus';   // 'focus' | 'short' | 'long'
let running      = false;
let timerId      = null;
let remaining    = 0;
let totalSecs    = 0;
let pomodorosDone = 0;        // total completed focus sessions today
let inCycleDone  = 0;         // how many in the current cycle (resets after long break)

// ── Helpers ───────────────────────────────────────────
function getSettings() {
  return {
    focus:  parseInt(focusMinEl.value,  10) * 60,
    short:  parseInt(shortMinEl.value,  10) * 60,
    long:   parseInt(longMinEl.value,   10) * 60,
    cycle:  parseInt(cycleCountEl.value, 10),
    auto:   autoStartEl.checked,
    notif:  notifEl.checked,
  };
}

function formatTime(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function setPhaseClass(p) {
  appEl.classList.remove('phase-focus', 'phase-short', 'phase-long');
  appEl.classList.add(`phase-${p === 'short' ? 'short' : p === 'long' ? 'long' : 'focus'}`);
  blob1.style.background = p === 'short' ? 'var(--clr-short)' : p === 'long' ? 'var(--clr-long)' : 'var(--clr-focus)';
}

function updateRing() {
  const pct    = totalSecs > 0 ? remaining / totalSecs : 1;
  const offset = RING_CIRC * (1 - pct);
  ringProg.style.strokeDashoffset = offset;
}

function updateDots() {
  const { cycle } = getSettings();
  // Rebuild dots if cycle length changed
  const existing = tomatoDots.querySelectorAll('.dot');
  if (existing.length !== cycle) {
    tomatoDots.innerHTML = '';
    for (let i = 0; i < cycle; i++) {
      const s = document.createElement('span');
      s.className = 'dot';
      s.dataset.idx = i;
      s.textContent = '🍅';
      tomatoDots.appendChild(s);
    }
  }
  tomatoDots.querySelectorAll('.dot').forEach((d, i) => {
    d.classList.toggle('done', i < inCycleDone);
  });
  const cycleNum = Math.floor(pomodorosDone / cycle) + 1;
  cycleLabel.textContent = `第 ${cycleNum} 組 · 共完成 ${pomodorosDone} 個`;
}

function updateTabHighlight(p) {
  tabs.forEach(t => {
    const sel = t.dataset.phase === p;
    t.classList.toggle('active', sel);
    t.setAttribute('aria-selected', sel);
  });
}

function applyPhase(p, startImmediately = false) {
  phase = p;
  const cfg = getSettings();
  totalSecs = p === 'focus' ? cfg.focus : p === 'short' ? cfg.short : cfg.long;
  remaining = totalSecs;

  setPhaseClass(p);
  updateTabHighlight(p);

  const labels = {
    focus: '🎯 專注時間',
    short: '☕ 短休息',
    long:  '🛌 長休息',
  };
  phaseLabel.textContent = labels[p];

  timeDisplay.textContent = formatTime(remaining);
  updateRing();
  document.title = `${formatTime(remaining)} · 番茄鐘`;

  if (startImmediately && cfg.auto) {
    startTimer();
  } else {
    setRunning(false);
  }
}

// ── Timer core ────────────────────────────────────────
function tick() {
  remaining--;
  timeDisplay.textContent = formatTime(remaining);
  document.title = `${formatTime(remaining)} · 番茄鐘`;
  updateRing();

  if (remaining <= 0) {
    clearInterval(timerId);
    timerId = null;
    onPhaseEnd();
  }
}

function onPhaseEnd() {
  playAlertSound();
  const cfg = getSettings();

  if (phase === 'focus') {
    pomodorosDone++;
    inCycleDone++;
    updateDots();

    if (inCycleDone >= cfg.cycle) {
      inCycleDone = 0;
      sendNotif('🛌 長休息', `完成 ${cfg.cycle} 個番茄鐘！休息一下吧。`);
      showToast('🎉 完成一組！進入長休息');
      applyPhase('long', true);
    } else {
      sendNotif('☕ 短休息', '專注完成！休息 5 分鐘。');
      showToast('✅ 專注完成！進入短休息');
      applyPhase('short', true);
    }
  } else {
    sendNotif('🎯 開始專注', '休息結束，繼續加油！');
    showToast('💪 休息結束，開始專注！');
    applyPhase('focus', true);
  }
}

function startTimer() {
  if (timerId) return;
  timerId = setInterval(tick, 1000);
  setRunning(true);
}

function pauseTimer() {
  clearInterval(timerId);
  timerId = null;
  setRunning(false);
}

function setRunning(val) {
  running = val;
  iconPlay.style.display  = val ? 'none' : 'block';
  iconPause.style.display = val ? 'block' : 'none';
  appEl.classList.toggle('running', val);
}

// ── Notifications ─────────────────────────────────────
function requestNotifPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function sendNotif(title, body) {
  if (!notifEl.checked) return;
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body, icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><text y="32" font-size="32">🍅</text></svg>' });
  }
}

// ── Web Audio Alert ───────────────────────────────────
function playAlertSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    notes.forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = ctx.currentTime + i * 0.18;
      osc.start(start);
      gain.gain.setValueAtTime(0.3, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.6);
      osc.stop(start + 0.6);
    });
  } catch (e) { /* silently ignore if audio unavailable */ }
}

// ── Toast ─────────────────────────────────────────────
let toastTimer = null;
function showToast(msg) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}

// ── Clock in footer ───────────────────────────────────
function updateClock() {
  const now = new Date();
  currentTimeEl.textContent = now.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
setInterval(updateClock, 1000);
updateClock();

// ── Event listeners ───────────────────────────────────
startBtn.addEventListener('click', () => {
  if (running) {
    pauseTimer();
  } else {
    requestNotifPermission();
    startTimer();
  }
});

resetBtn.addEventListener('click', () => {
  pauseTimer();
  const cfg = getSettings();
  totalSecs = phase === 'focus' ? cfg.focus : phase === 'short' ? cfg.short : cfg.long;
  remaining = totalSecs;
  timeDisplay.textContent = formatTime(remaining);
  document.title = `${formatTime(remaining)} · 番茄鐘`;
  updateRing();
});

skipBtn.addEventListener('click', () => {
  pauseTimer();
  if (phase === 'focus') {
    // Count as a done pomodoro when skipping? — No, skip without counting.
    const cfg = getSettings();
    if (inCycleDone >= cfg.cycle - 1) {
      inCycleDone = 0;
      applyPhase('long', false);
    } else {
      applyPhase('short', false);
    }
  } else {
    applyPhase('focus', false);
  }
  showToast('⏭ 已跳過此階段');
});

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    pauseTimer();
    applyPhase(tab.dataset.phase, false);
  });
});

// Settings change — reset timer when duration changes
[focusMinEl, shortMinEl, longMinEl, cycleCountEl].forEach(el => {
  el.addEventListener('change', () => {
    pauseTimer();
    const cfg = getSettings();
    totalSecs = phase === 'focus' ? cfg.focus : phase === 'short' ? cfg.short : cfg.long;
    remaining = totalSecs;
    timeDisplay.textContent = formatTime(remaining);
    updateRing();
    updateDots();
  });
});

// ── Init ──────────────────────────────────────────────
applyPhase('focus', false);
updateDots();
