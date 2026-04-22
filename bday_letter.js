/* ════════════════════════════════════
   AUDIO ENGINE
════════════════════════════════════ */
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let ctx;

function ensureAudio() {
  if (!ctx) ctx = new AudioCtx();
  if (ctx.state === 'suspended') ctx.resume();
}

function playClick() {
  ensureAudio();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.connect(g);
  g.connect(ctx.destination);
  o.type = 'sine';
  o.frequency.setValueAtTime(880, ctx.currentTime);
  o.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.12);
  g.gain.setValueAtTime(0.15, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
  o.start();
  o.stop(ctx.currentTime + 0.2);
}

function playChime() {
  ensureAudio();
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((f, i) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = 'sine';
    o.frequency.value = f;
    const t = ctx.currentTime + i * 0.13;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.18, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    o.start(t);
    o.stop(t + 0.75);
  });
}

function playPaperOpen() {
  ensureAudio();
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) {
    d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 1.8) * 0.3;
  }
  const src = ctx.createBufferSource();
  const g   = ctx.createGain();
  const bpf = ctx.createBiquadFilter();
  bpf.type = 'bandpass';
  bpf.frequency.value = 3000;
  bpf.Q.value = 0.5;
  src.connect(bpf);
  bpf.connect(g);
  g.connect(ctx.destination);
  src.buffer = buf;
  g.gain.setValueAtTime(0.4, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
  src.start();
}

/* ─── AMBIENT MUSIC ─── */
let musicOn   = false;
let musicNodes = [];

function startMusic() {
  ensureAudio();
  const chords = [
    [261.63, 329.63, 392],
    [293.66, 369.99, 440],
    [349.23, 440,    523.25],
    [329.63, 415.30, 493.88],
  ];
  let idx = 0;

  function playChord() {
    musicNodes.forEach(n => { try { n.stop(); } catch (e) {} });
    musicNodes = [];

    const chord = chords[idx % chords.length];
    idx++;

    chord.forEach(f => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      o.connect(g);
      g.connect(ctx.destination);
      g.gain.setValueAtTime(0, ctx.currentTime);
      g.gain.linearRampToValueAtTime(0.03, ctx.currentTime + 1);
      g.gain.setValueAtTime(0.03, ctx.currentTime + 2.5);
      g.gain.linearRampToValueAtTime(0, ctx.currentTime + 4);
      o.start();
      o.stop(ctx.currentTime + 4.5);
      musicNodes.push(o);
    });

    if (musicOn) setTimeout(playChord, 3500);
  }

  playChord();
}

function stopMusic() {
  musicNodes.forEach(n => { try { n.stop(); } catch (e) {} });
  musicNodes = [];
}

function toggleMusic() {
  ensureAudio();
  musicOn = !musicOn;
  document.getElementById('musicBtn').textContent = musicOn ? '♫' : '♪';
  if (musicOn) startMusic();
  else         stopMusic();
}

/* ════════════════════════════════════
   CANVAS — NUMBER DRAWING
   Responsive: scale "22" relative to
   viewport so it always looks right
════════════════════════════════════ */
const canvas = document.getElementById('numberCanvas');
const c      = canvas.getContext('2d');
let W, H;

/* Responsive digit sizing */
function getDigitSize() {
  const base = Math.min(W, H);
  // On very small screens scale down, cap at original 80×120
  const scale = Math.min(1, base / 480);
  return {
    NUM_W: Math.round(80 * scale),
    NUM_H: Math.round(120 * scale),
    GAP:   Math.round(36 * scale),
  };
}

function resizeCanvas() {
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
}

window.addEventListener('resize', () => {
  resizeCanvas();
  rebuildPaths();
  drawNumbers();
});
resizeCanvas();

function getOrigin() {
  const { NUM_W, NUM_H, GAP } = getDigitSize();
  const totalW = NUM_W * 2 + GAP;
  return {
    x: W / 2 - totalW / 2 - NUM_W * 0.15,
    // Position "22" above the envelope; push up a bit more on short screens
    y: H / 2 - (H < 600 ? H * 0.38 : 220),
  };
}

/* Bezier path for digit "2" — uses dynamic sizing */
function get2Path(ox, oy) {
  const { NUM_W: w, NUM_H: h } = getDigitSize();
  return [
    { t: 'M', p: [ox + w * 0.15, oy + h * 0.38] },
    { t: 'Q', p: [ox + w * 0.12, oy + h * 0.05, ox + w * 0.5,  oy + h * 0.04] },
    { t: 'Q', p: [ox + w * 0.88, oy + h * 0.05, ox + w * 0.85, oy + h * 0.38] },
    { t: 'Q', p: [ox + w * 0.82, oy + h * 0.62, ox + w * 0.5,  oy + h * 0.72] },
    { t: 'Q', p: [ox + w * 0.18, oy + h * 0.82, ox + w * 0.05, oy + h * 1.0]  },
    { t: 'L', p: [ox + w * 0.95, oy + h * 1.0] },
  ];
}

/* Flatten bezier path to a dense list of points */
function flattenPath(path) {
  const pts = [];
  let cx = 0, cy = 0;

  for (const seg of path) {
    if (seg.t === 'M') {
      cx = seg.p[0]; cy = seg.p[1];
      pts.push({ x: cx, y: cy });

    } else if (seg.t === 'L') {
      const [x1, y1] = seg.p;
      for (let i = 1; i <= 20; i++) {
        pts.push({ x: cx + (x1 - cx) * i / 20, y: cy + (y1 - cy) * i / 20 });
      }
      cx = x1; cy = y1;

    } else if (seg.t === 'Q') {
      const [cpx, cpy, ex, ey] = seg.p;
      for (let i = 1; i <= 60; i++) {
        const t = i / 60;
        pts.push({
          x: (1 - t) * (1 - t) * cx + 2 * (1 - t) * t * cpx + t * t * ex,
          y: (1 - t) * (1 - t) * cy + 2 * (1 - t) * t * cpy + t * t * ey,
        });
      }
      cx = ex; cy = ey;
    }
  }
  return pts;
}

let digit1pts = [];
let digit2pts = [];
let prog1     = 0;  // 0..1
let prog2     = 0;
let anim1Id, anim2Id;

function rebuildPaths() {
  const { NUM_W, GAP } = getDigitSize();
  const o  = getOrigin();
  digit1pts = flattenPath(get2Path(o.x, o.y));
  digit2pts = flattenPath(get2Path(o.x + NUM_W + GAP, o.y));
}

function drawNumbers() {
  c.clearRect(0, 0, W, H);

  /* Responsive stroke width */
  const { NUM_W } = getDigitSize();
  const strokeW = Math.max(2, 3.5 * (NUM_W / 80));

  function drawDigit(pts, progress, alpha) {
    if (progress <= 0 || pts.length < 2) return;
    const end = Math.floor(progress * (pts.length - 1));

    /* main stroke */
    c.beginPath();
    c.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i <= end; i++) c.lineTo(pts[i].x, pts[i].y);
    c.strokeStyle = `rgba(168,91,110,${alpha})`;
    c.lineWidth   = strokeW;
    c.lineCap     = 'round';
    c.lineJoin    = 'round';
    c.stroke();

    /* glow pass */
    c.save();
    c.filter      = 'blur(4px)';
    c.strokeStyle = `rgba(212,137,154,${alpha * 0.4})`;
    c.lineWidth   = strokeW * 2.3;
    c.beginPath();
    c.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i <= end; i++) c.lineTo(pts[i].x, pts[i].y);
    c.stroke();
    c.restore();
  }

  drawDigit(digit1pts, prog1, 0.9);
  drawDigit(digit2pts, prog2, 0.9);
}

function animateTo(target, speed, onDone, isSecond) {
  let start    = null;
  const startVal = isSecond ? prog2 : prog1;
  const dist     = target - startVal;
  const dur      = Math.abs(dist) / speed * 1000;

  const step = (ts) => {
    if (!start) start = ts;
    const p    = Math.min((ts - start) / dur, 1);
    const ease = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p;

    if (isSecond) prog2 = startVal + dist * ease;
    else          prog1 = startVal + dist * ease;

    rebuildPaths();
    drawNumbers();

    if (p < 1) {
      if (isSecond) anim2Id = requestAnimationFrame(step);
      else          anim1Id = requestAnimationFrame(step);
    } else {
      if (onDone) onDone();
    }
  };

  requestAnimationFrame(step);
}

/* ════════════════════════════════════
   HEARTS & SPARKLES
════════════════════════════════════ */
const HEARTS = ['♡', '♡', '♡', '❤', '♡'];

function spawnHearts(count = 12) {
  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      const h = document.createElement('div');
      h.className   = 'heart-particle';
      h.textContent = HEARTS[Math.floor(Math.random() * HEARTS.length)];
      h.style.cssText = `
        left: ${30 + Math.random() * 40}vw;
        bottom: ${25 + Math.random() * 20}vh;
        font-size: ${12 + Math.random() * 14}px;
        color: hsl(${340 + Math.random() * 20}, 70%, ${60 + Math.random() * 15}%);
        animation-duration: ${3 + Math.random() * 2}s;
        animation-delay: ${Math.random() * 0.6}s;
      `;
      document.body.appendChild(h);
      setTimeout(() => h.remove(), 6000);
    }, i * 80);
  }
}

function spawnSparkles(cx, cy) {
  for (let i = 0; i < 16; i++) {
    const s     = document.createElement('div');
    s.className = 'sparkle';
    const angle = (i / 16) * Math.PI * 2;
    const dist  = 40 + Math.random() * 60;
    s.style.cssText = `
      left: ${cx}px;
      top:  ${cy}px;
      --dx: ${Math.cos(angle) * dist}px;
      --dy: ${Math.sin(angle) * dist}px;
      width:  ${3 + Math.random() * 4}px;
      height: ${3 + Math.random() * 4}px;
      background: ${Math.random() > 0.5 ? 'var(--gold)' : 'var(--rose)'};
      animation-delay:    ${Math.random() * 0.3}s;
      animation-duration: ${0.8 + Math.random() * 0.6}s;
    `;
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 2000);
  }
}

/* ════════════════════════════════════
   PETAL RAIN
════════════════════════════════════ */
function startPetals() {
  const container = document.getElementById('petals');
  setInterval(() => {
    const p       = document.createElement('div');
    p.className   = 'petal';
    p.textContent = Math.random() > 0.5 ? '·' : '✿';
    p.style.cssText = `
      left: ${Math.random() * 100}vw;
      top: -10px;
      font-size: ${8 + Math.random() * 8}px;
      color: hsl(${340 + Math.random() * 20}, 60%, ${75 + Math.random() * 15}%);
      animation-duration: ${8 + Math.random() * 8}s;
      animation-delay: 0s;
      opacity: 0;
    `;
    container.appendChild(p);
    setTimeout(() => p.remove(), 18000);
  }, 1200);
}

/* ════════════════════════════════════
   ENVELOPE OPEN
════════════════════════════════════ */
function openEnvelope() {
  const wrap = document.getElementById('envelopeWrap');
  const flap = document.getElementById('envFlap');
  const seal = document.getElementById('seal');
  const glow = document.getElementById('innerGlow');
  const hint = document.getElementById('hint');

  hint.classList.add('hidden');
  wrap.style.cursor        = 'default';
  wrap.style.pointerEvents = 'none';

  /* bounce */
  wrap.classList.add('bounce');

  /* seal dissolves + paper sound */
  setTimeout(() => {
    seal.classList.add('hidden');
    playPaperOpen();
  }, 500);

  /* flap opens + glow + particles */
  setTimeout(() => {
    flap.classList.add('open');
    glow.classList.add('visible');
    spawnSparkles(W / 2, H / 2 - 80);
    spawnHearts(8);
  }, 900);

  /* letter fades in */
  setTimeout(() => {
    revealLetter();
  }, 2200);
}

/* ════════════════════════════════════
   LETTER REVEAL
════════════════════════════════════ */
function revealLetter() {
  const overlay  = document.getElementById('letterOverlay');
  const inner    = document.getElementById('letterInner');
  const musicBtn = document.getElementById('musicBtn');

  overlay.classList.add('visible');
  musicBtn.classList.add('visible');

  /* start scroll after a short reading pause */
  setTimeout(() => {
    inner.style.setProperty('--scroll-duration', '75s');
    inner.classList.add('scrolling');
  }, 1200);

  /* auto-start ambient music */
  if (!musicOn) {
    musicOn = true;
    document.getElementById('musicBtn').textContent = '♫';
    startMusic();
  }
}

/* ════════════════════════════════════
   CLICK / TAP STATE MACHINE
════════════════════════════════════ */
let clickCount = 0;
let busy       = false;

function handleClick() {
  if (busy) return;
  ensureAudio();
  clickCount++;

  switch (clickCount) {

    case 1: {
      busy = true;
      playClick();
      document.getElementById('hint').textContent = '…keep going';
      animateTo(0.48, 0.35, () => { busy = false; }, false);
      break;
    }

    case 2: {
      busy = true;
      playClick();
      animateTo(1.0, 0.3, () => { busy = false; }, false);
      break;
    }

    case 3: {
      busy = true;
      playClick();
      animateTo(0.48, 0.35, () => { busy = false; }, true);
      break;
    }

    case 4: {
      busy = true;
      playClick();
      animateTo(1.0, 0.3, () => {
        setTimeout(() => {
          playChime();
          spawnHearts(18);
          const { NUM_W, GAP } = getDigitSize();
          const o = getOrigin();
          spawnSparkles(o.x + NUM_W + GAP / 2, o.y + (getDigitSize().NUM_H / 2));
          document.getElementById('hint').textContent = '…one more time';
          busy = false;
        }, 700);
      }, true);
      break;
    }

    case 5: {
      busy = true;
      openEnvelope();
      break;
    }

    default:
      break;
  }
}

/* ════════════════════════════════════
   INIT
════════════════════════════════════ */
rebuildPaths();
drawNumbers();
startPetals();