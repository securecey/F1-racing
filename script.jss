// ========== Data & DOM ==========
const leaderboard = [
  { id: 'p1', rank: 1, player: "SpeedRacer", score: 9800 },
  { id: 'p2', rank: 2, player: "NitroKing", score: 9450 },
  { id: 'p3', rank: 3, player: "DriftMaster", score: 9100 },
  { id: 'p4', rank: 4, player: "TurboFlash", score: 8900 }
];

const tbody = document.getElementById("leaderboard-data");
const muteBtn = document.getElementById("muteBtn");
const playBtn = document.getElementById("play-btn");
const heroSection = document.getElementById("home");
const gameSection = document.getElementById("game-section");
const exitGameBtn = document.getElementById("exitGame");
let audioEnabled = true;

// render initial leaderboard rows
function renderLeaderboard() {
  tbody.innerHTML = '';
  leaderboard.sort((a,b)=> a.rank - b.rank).forEach(item => {
    const tr = document.createElement("tr");
    tr.id = item.id;
    tr.innerHTML = `<td>${item.rank}</td><td>${item.player}</td><td class="score" data-score="${item.score}">${item.score.toLocaleString()}</td>`;
    tbody.appendChild(tr);
  });
}
renderLeaderboard();

// ========== GSAP entrance timeline & scroll effects ==========
function entranceAnimation() {
  if (!window.gsap) return;
  const car = document.getElementById("raceCar");
  const exhaust = document.getElementById("exhaust");
  const tl = gsap.timeline();

  gsap.set(car, { xPercent: -140, scale: 0.9, rotation: -2 });
  gsap.set(exhaust, { opacity: 0 });

  tl.to(exhaust, { opacity: 0.18, duration: 0.25, yoyo: true, repeat: 1 });
  tl.to(car, {
    duration: 1.2,
    xPercent: 16,
    scale: 1,
    rotation: 0,
    ease: "power4.out",
    onStart() { audioEngine.rampUp(); }
  }, "-=0.2");
  tl.to(exhaust, { opacity: 0.9, duration: 0.12, yoyo: true, repeat: 1 }, "-=0.3");
  tl.to(car, { y: "-=6", duration: 0.18, yoyo: true, repeat: 5, ease: "sine.inOut" }, "-=0.9");
  tl.call(()=> audioEngine.setCruise(), null, "-=0.2");
}

function initScrollEffects() {
  if (!window.gsap || !window.ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);

  gsap.to(".hero", {
    backgroundPosition: "50% 30%",
    ease: "none",
    scrollTrigger: {
      trigger: ".hero",
      start: "top top",
      end: "bottom top",
      scrub: 0.8
    }
  });

  gsap.to(".car", { y: "-=6", duration: 0.8, yoyo: true, repeat: -1, ease: "sine.inOut" });

  gsap.utils.toArray("section").forEach((sec) => {
    gsap.from(sec, {
      opacity: 0, y: 16, duration: 0.7, ease: "power2.out",
      scrollTrigger: { trigger: sec, start: "top 85%" }
    });
  });
}

window.addEventListener("load", () => {
  entranceAnimation();
  initScrollEffects();
});

// ========== WebAudio engine & tire (synthesized) ==========
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const masterGain = audioCtx.createGain();
masterGain.gain.value = 0.62;
masterGain.connect(audioCtx.destination);

const audioEngine = (function () {
  const osc1 = audioCtx.createOscillator();
  const osc2 = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const filter = audioCtx.createBiquadFilter();
  const waveshaper = audioCtx.createWaveShaper();

  osc1.type = 'sawtooth';
  osc2.type = 'sine';
  osc1.frequency.value = 60;
  osc2.frequency.value = 120;
  gain.gain.value = 0.0001;

  filter.type = 'lowpass';
  filter.frequency.value = 800;
  filter.Q.value = 1;

  function makeDistortion(amount) {
    const k = typeof amount === 'number' ? amount : 50;
    const n = 44100;
    const curve = new Float32Array(n);
    const deg = Math.PI / 180;
    for (let i = 0; i < n; ++i) {
      const x = (i * 2) / n - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }
  waveshaper.curve = makeDistortion(6);
  waveshaper.oversample = '2x';

  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(filter);
  filter.connect(waveshaper);
  waveshaper.connect(masterGain);

  osc1.start();
  osc2.start();

  return {
    rampUp(duration = 0.9) {
      const now = audioCtx.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0.55, now + duration * 0.45);
      filter.frequency.cancelScheduledValues(now);
      filter.frequency.linearRampToValueAtTime(2500, now + duration);
      osc1.frequency.cancelScheduledValues(now);
      osc2.frequency.cancelScheduledValues(now);
      osc1.frequency.linearRampToValueAtTime(160, now + duration);
      osc2.frequency.linearRampToValueAtTime(320, now + duration);
    },
    setCruise() {
      const now = audioCtx.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.linearRampToValueAtTime(0.38, now + 0.6);
      filter.frequency.cancelScheduledValues(now);
      filter.frequency.linearRampToValueAtTime(1100, now + 0.6);
      osc1.frequency.cancelScheduledValues(now);
      osc2.frequency.cancelScheduledValues(now);
      osc1.frequency.linearRampToValueAtTime(85, now + 0.6);
      osc2.frequency.linearRampToValueAtTime(170, now + 0.6);
    },
    rampDown() {
      const now = audioCtx.currentTime;
      gain.gain.linearRampToValueAtTime(0.0001, now + 0.8);
    },
    mute(state) {
      masterGain.gain.setValueAtTime(state ? 0 : 0.62, audioCtx.currentTime);
    }
  };
})();

function playTireSqueal(duration = 0.35) {
  const bufferSize = audioCtx.sampleRate * duration;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.6));
  const src = audioCtx.createBufferSource();
  src.buffer = buffer;
  const flt = audioCtx.createBiquadFilter();
  flt.type = 'highpass'; flt.frequency.value = 900;
  const comp = audioCtx.createDynamicsCompressor();
  src.connect(flt); flt.connect(comp); comp.connect(masterGain);
  src.start();
}

// Resume audio context on first user interaction
function ensureAudioStarted() {
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}
window.addEventListener('click', ensureAudioStarted, { once: true });
window.addEventListener('keydown', ensureAudioStarted, { once: true });

// Mute toggle
muteBtn.addEventListener('click', () => {
  audioEnabled = !audioEnabled;
  muteBtn.classList.toggle('active', !audioEnabled);
  muteBtn.textContent = audioEnabled ? '🔈 Mute' : '🔇 Muted';
  audioEngine.mute(!audioEnabled);
});

// ========== Countdown timer ==========
let countdownTime = new Date().getTime() + 60 * 60 * 1000; // 1 hour from load
function updateTimer() {
  const now = Date.now();
  const d = countdownTime - now;
  if (d <= 0) { document.getElementById("timer").innerText = "Race Started!"; return; }
  const hrs = Math.floor((d / (1000 * 60 * 60)) % 24);
  const mins = Math.floor((d / (1000 * 60)) % 60);
  const secs = Math.floor((d / 1000) % 60);
  document.getElementById("timer").innerText =
    `${String(hrs).padStart(2,"0")}:${String(mins).padStart(2,"0")}:${String(secs).padStart(2,"0")}`;
}
setInterval(updateTimer, 1000);
updateTimer();

// ========== Faux websocket: realtime leaderboard updates ==========
function simulateRealtime() {
  function randPick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  setInterval(() => {
    const target = randPick(leaderboard);
    const bonus = Math.floor(Math.random() * 300) + 50;
    target.score += bonus;

    leaderboard.sort((a,b) => b.score - a.score);
    leaderboard.forEach((p, idx) => p.rank = idx + 1);

    updateLeaderboardRows();
  }, 2500 + Math.random() * 2200);
}

function updateLeaderboardRows() {
  const prevOrder = Array.from(tbody.querySelectorAll('tr')).map(tr => tr.id);
  const frag = document.createDocumentFragment();
  leaderboard.sort((a,b)=> a.rank - b.rank).forEach(item => {
    const tr = document.createElement("tr");
    tr.id = item.id;
    tr.innerHTML = `<td>${item.rank}</td><td>${item.player}</td><td class="score" data-score="${item.score}">${item.score.toLocaleString()}</td>`;
    frag.appendChild(tr);
  });

  if (window.gsap) {
    gsap.to(tbody, { opacity: 0, duration: 0.25, onComplete() {
      tbody.innerHTML = '';
      tbody.appendChild(frag);
      gsap.from(tbody.querySelectorAll('tr'), { opacity:0, y:10, stagger:0.06, duration:0.45, ease:"power2.out" });
      const newTop = leaderboard[0].id;
      if (prevOrder[0] !== newTop) {
        audioEngine.rampUp(0.35);
        setTimeout(()=> { audioEngine.setCruise(); }, 450);
        playTireSqueal(0.18);
      } else {
        audioEngine.rampUp(0.18);
        setTimeout(()=> audioEngine.setCruise(), 280);
      }
    }});
  } else {
    tbody.innerHTML = '';
    tbody.appendChild(frag);
  }
}

simulateRealtime();

// ========== Game Code (canvas) ==========
/*
  Controls:
  - ArrowUp: accelerate
  - ArrowDown: brake/reverse
  - ArrowLeft/Right: steer
*/
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const speedDisplay = document.getElementById("speedDisplay");
const lapDisplay = document.getElementById("lapDisplay");

let gameRunning = false;
let gameState = null;

// Assets
const carImg = new Image();
carImg.src = "https://i.ibb.co/mzYpPgH/f1-car.png"; // small transparent car sprite (fallback)

const trackImg = new Image();
trackImg.src = "https://i.ibb.co/bL7Mtkm/racetrack.png"; // looped track background (placeholder)

// Basic physics & player
function createInitialState() {
  return {
    x: canvas.width/2,
    y: canvas.height/2 + 50,
    angle: 0,
    speed: 0,
    maxSpeed: 8,
    accel: 0.25,
    friction: 0.96,
    steering: 0.045,
    keys: {},
    lap: 0,
    lastLapY: null // naive lap detection
  };
}

// Input listeners (for game)
document.addEventListener("keydown", (e) => {
  if (!gameRunning) return;
  gameState.keys[e.key] = true;
});
document.addEventListener("keyup", (e) => {
  if (!gameRunning) return;
  gameState.keys[e.key] = false;
});

// Start and stop game
playBtn.addEventListener("click", (e) => {
  e.preventDefault();
  // resume audio context (autoplay rules)
  ensureAudioStarted();
  heroSection.style.display = "none";
  gameSection.style.display = "block";
  startGame();
});

exitGameBtn && exitGameBtn.addEventListener("click", () => {
  stopGame();
  gameSection.style.display = "none";
  heroSection.style.display = "block";
});

// game loop
function startGame() {
  if (gameRunning) return;
  gameRunning = true;
  gameState = createInitialState();
  audioEngine.rampUp(0.6);
  audioEngine.setCruise();
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

function stopGame() {
  gameRunning = false;
  audioEngine.rampDown();
}

// simple track collision / boundary check (keep inside canvas)
function clampToCanvas(s) {
  if (s.x < 40) s.x = 40, s.speed *= 0.6;
  if (s.x > canvas.width - 40) s.x = canvas.width - 40, s.speed *= 0.6;
  if (s.y < 40) s.y = 40, s.speed *= 0.6;
  if (s.y > canvas.height - 40) s.y = canvas.height - 40, s.speed *= 0.6;
}

let lastTime = 0;
function loop(now) {
  if (!gameRunning) return;
  const dt = Math.min((now - lastTime) / 16.666, 4); // normalize to ~60fps ticks
  lastTime = now;

  // physics & input
  if (gameState.keys["ArrowUp"]) {
    gameState.speed += gameState.accel * dt;
  }
  if (gameState.keys["ArrowDown"]) {
    gameState.speed -= gameState.accel * dt * 0.9;
  }
  if (gameState.keys["ArrowLeft"]) {
    gameState.angle -= gameState.steering * (gameState.speed / gameState.maxSpeed + 0.2) * dt;
  }
  if (gameState.keys["ArrowRight"]) {
    gameState.angle += gameState.steering * (gameState.speed / gameState.maxSpeed + 0.2) * dt;
  }

  // clamp speeds
  gameState.speed = Math.max(Math.min(gameState.speed, gameState.maxSpeed), -2);
  // friction
  gameState.speed *= Math.pow(gameState.friction, dt);

  // move
  gameState.x += Math.sin(gameState.angle) * gameState.speed * 1.6 * dt;
  gameState.y -= Math.cos(gameState.angle) * gameState.speed * 1.6 * dt;

  clampToCanvas(gameState);

  // lap detection: naive: cross horizontal center from bottom to top
  if (gameState.lastLapY === null) gameState.lastLapY = gameState.y;
  if (gameState.lastLapY > canvas.height/2 && gameState.y <= canvas.height/2 && Math.abs(gameState.speed) > 1.8) {
    gameState.lap += 1;
    playTireSqueal(0.14);
  }
  gameState.lastLapY = gameState.y;

  // draw
  drawScene();

  // update HUD
  speedDisplay.textContent = `Speed: ${Math.round(Math.abs(gameState.speed * 10))}`;
  lapDisplay.textContent = `Lap: ${gameState.lap}`;

  requestAnimationFrame(loop);
}

function drawScene() {
  // draw track/background (tile scaled to canvas)
  if (trackImg.complete) {
    // draw centered scaled background for nicer look
    ctx.drawImage(trackImg, 0, 0, canvas.width, canvas.height);
  } else {
    ctx.fillStyle = "#1c1c1c";
    ctx.fillRect(0,0,canvas.width,canvas.height);
  }

  // optionally draw simple markers or UI elements
  // draw car
  if (carImg.complete) {
    ctx.save();
    ctx.translate(gameState.x, gameState.y);
    ctx.rotate(gameState.angle);
    const cw = 42, ch = 84;
    ctx.drawImage(carImg, -cw/2, -ch/2, cw, ch);
    ctx.restore();
  } else {
    // fallback rectangle
    ctx.save();
    ctx.translate(gameState.x, gameState.y);
    ctx.rotate(gameState.angle);
    ctx.fillStyle = "#e10600";
    ctx.fillRect(-12,-24,24,48);
    ctx.restore();
  }
}

// ensure images are ready but don't block start
trackImg.onload = ()=> { /* ok */ };
carImg.onload = ()=> { /* ok */ };

// ========== start-up score animation (uses GSAP if available) ==========
document.addEventListener("DOMContentLoaded", () => {
  if (window.gsap) {
    document.querySelectorAll(".score").forEach(el => {
      const target = +el.dataset.score;
      gsap.to({ val: 0 }, {
        val: target,
        duration: 1.6,
        ease: "power3.out",
        onUpdate() {
          el.textContent = Math.floor(this.targets()[0].val).toLocaleString();
        }
      });
    });
  }
});

// ========== Initialize small effects after load ==========
window.addEventListener("load", () => {
  // render initial leaderboard & small animation
  renderLeaderboard();
  updateLeaderboardRows();
});

// make sure canvas scales on resize
window.addEventListener("resize", () => {
  // keep canvas full width within styling limits
  // nothing special needed—canvas keeps fixed pixel size; leave as-is for consistent gameplay
});
