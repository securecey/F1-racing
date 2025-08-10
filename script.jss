// ----------------------- Data & DOM -----------------------
const leaderboard = [
  { id: 'p1', rank: 1, player: "SpeedRacer", score: 9800 },
  { id: 'p2', rank: 2, player: "NitroKing", score: 9450 },
  { id: 'p3', rank: 3, player: "DriftMaster", score: 9100 },
  { id: 'p4', rank: 4, player: "TurboFlash", score: 8900 }
];

const tbody = document.getElementById("leaderboard-data");
const muteBtn = document.getElementById("muteBtn");
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

// ----------------------- GSAP entrance timeline -----------------------
function entranceAnimation() {
  if (!window.gsap) return;
  const car = document.getElementById("raceCar");
  const exhaust = document.getElementById("exhaust");

  const tl = gsap.timeline();

  // start small and offscreen with quiet engine -> rev up + zip in
  gsap.set(car, { xPercent: -140, scale: 0.9, rotation: -2 });
  gsap.set(exhaust, { opacity: 0 });

  // small engine idle pulsing before launch
  tl.to(exhaust, { opacity: 0.18, duration: 0.25, yoyo: true, repeat: 1 });

  // rev sound ramp + quick zoom-in entrance
  tl.to(car, {
    duration: 1.2,
    xPercent: 16,
    scale: 1,
    rotation: 0,
    ease: "power4.out",
    onStart() { audioEngine.rampUp(); }
  }, "-=0.2");

  // exhaust flash + small bounce
  tl.to(exhaust, { opacity: 0.9, duration: 0.12, yoyo: true, repeat: 1 }, "-=0.3");
  tl.to(car, { y: "-=6", duration: 0.18, yoyo: true, repeat: 5, ease: "sine.inOut" }, "-=0.9");

  // after entrance, settle engine to cruising
  tl.call(()=> audioEngine.setCruise(), null, "-=0.2");
}
window.addEventListener("load", entranceAnimation);

// ----------------------- WebAudio engine & tire (synthesized) -----------------------
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const masterGain = audioCtx.createGain();
masterGain.gain.value = 0.62;
masterGain.connect(audioCtx.destination);

const audioEngine = (function () {
  // simple engine: two oscillators (low hum) + distortion + filter for 'growl'
  const osc1 = audioCtx.createOscillator();
  const osc2 = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const filter = audioCtx.createBiquadFilter();
  const waveshaper = audioCtx.createWaveShaper();

  osc1.type = 'sawtooth';
  osc2.type = 'sine';
  osc1.frequency.value = 60;
  osc2.frequency.value = 120;
  gain.gain.value = 0.0001; // start almost silent

  filter.type = 'lowpass';
  filter.frequency.value = 800;
  filter.Q.value = 1;

  // soft distortion curve
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

  // connect chain: osc -> gain -> filter -> waveshaper -> master
  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(filter);
  filter.connect(waveshaper);
  waveshaper.connect(masterGain);

  osc1.start();
  osc2.start();

  // public API
  return {
    rampUp(duration = 0.9) {
      // ramp oscillator frequencies and gain to simulate rev
      const now = audioCtx.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0.55, now + duration * 0.45);
      filter.frequency.cancelScheduledValues(now);
      filter.frequency.linearRampToValueAtTime(2500, now + duration);
      // frequency pitch-up
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

// simple tire noise generator (short burst) using buffer white noise -> filter
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

// Resume audio context on first user interaction (autoplay policy)
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

// ----------------------- Countdown timer -----------------------
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

// ----------------------- Faux websocket: realtime leaderboard updates -----------------------
/*
  Behavior:
  - Every few seconds, choose a random player, bump their score slightly.
  - Re-sort ranks based on score, animate row movement (GSAP).
  - Play a small tire squeal + short engine blip when position changes for drama.
*/
function simulateRealtime() {
  // helper: pick random element
  function randPick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  setInterval(() => {
    // random small change
    const target = randPick(leaderboard);
    const bonus = Math.floor(Math.random() * 300) + 50; // 50..349
    target.score += bonus;

    // re-sort by score desc -> update ranks
    leaderboard.sort((a,b) => b.score - a.score);
    leaderboard.forEach((p, idx) => p.rank = idx + 1);

    // update DOM with intelligent animations
    updateLeaderboardRows();
  }, 2500 + Math.random() * 2200);
}

function updateLeaderboardRows() {
  // Keep a map of previous order to animate movement
  const prevOrder = Array.from(tbody.querySelectorAll('tr')).map(tr => tr.id);
  // Re-render rows (but we'll animate)
  // Create document fragment with new rows (so we can animate transition)
  const frag = document.createDocumentFragment();
  leaderboard.sort((a,b)=> a.rank - b.rank).forEach(item => {
    const tr = document.createElement("tr");
    tr.id = item.id;
    tr.innerHTML = `<td>${item.rank}</td><td>${item.player}</td><td class="score" data-score="${item.score}">${item.score.toLocaleString()}</td>`;
    frag.appendChild(tr);
  });

  // Simple animated swap: fade out old tbody then fade in new one with GSAP
  if (window.gsap) {
    gsap.to(tbody, { opacity: 0, duration: 0.25, onComplete() {
      tbody.innerHTML = '';
      tbody.appendChild(frag);
      // animate each row in slightly staggered
      gsap.from(tbody.querySelectorAll('tr'), { opacity:0, y:10, stagger:0.06, duration:0.45, ease:"power2.out" });
      // pop sound + engine blip if top changed
      // detect if top changed vs prev (id at index 0)
      const newTop = leaderboard[0].id;
      if (prevOrder[0] !== newTop) {
        audioEngine.rampUp(0.35);
        setTimeout(()=> { audioEngine.setCruise(); }, 450);
        playTireSqueal(0.18);
      } else {
        // small blip for score updates
        audioEngine.rampUp(0.18);
        setTimeout(()=> audioEngine.setCruise(), 280);
      }
    }});
  } else {
    tbody.innerHTML = '';
    tbody.appendChild(frag);
  }
}

// Start the faux websocket simulation
simulateRealtime();

// ----------------------- GSAP Scroll animations & smaller effects -----------------------
function initScrollEffects() {
  if (!window.gsap || !window.ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);

  // hero parallax background
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

  // car floats
  gsap.to(".car", { y: "-=6", duration: 0.8, yoyo: true, repeat: -1, ease: "sine.inOut" });

  // fade in sections
  gsap.utils.toArray("section").forEach((sec) => {
    gsap.from(sec, {
      opacity: 0, y: 16, duration: 0.7, ease: "power2.out",
      scrollTrigger: { trigger: sec, start: "top 85%" }
    });
  });
}
window.addEventListener("load", initScrollEffects);

// ----------------------- small UX: resume audio when interacting if needed -----------------------
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") ensureAudioStarted();
});
