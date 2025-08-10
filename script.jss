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
