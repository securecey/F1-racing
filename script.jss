// ========== Mock leaderboard ==========
const leaderboard = [
  { rank: 1, player: "SpeedRacer", score: 9800 },
  { rank: 2, player: "NitroKing", score: 9450 },
  { rank: 3, player: "DriftMaster", score: 9100 },
  { rank: 4, player: "TurboFlash", score: 8900 }
];

const tbody = document.getElementById("leaderboard-data");
leaderboard.forEach(item => {
  const tr = document.createElement("tr");
  tr.innerHTML = `<td>${item.rank}</td>
                  <td>${item.player}</td>
                  <td class="score" data-score="${item.score}">0</td>`;
  tbody.appendChild(tr);
});

// Animate score count-up using GSAP (once DOM is ready)
document.addEventListener("DOMContentLoaded", () => {
  if (window.gsap) {
    // animate scores from 0 -> data-score
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

// ========== Countdown timer (1 hour from load) ==========
let countdownTime = new Date().getTime() + 60 * 60 * 1000;
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

// ========== GSAP Animations (car + parallax + leaderboard pulse) ==========
function initAnimations() {
  if (!window.gsap || !window.ScrollTrigger) return;

  gsap.registerPlugin(ScrollTrigger);

  // Parallax: shift background position slightly on scroll
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

  // Car zips across the screen while scrolling past hero
  const car = document.getElementById("raceCar");
  gsap.fromTo(car, { xPercent: -120, yPercent: 0, scale: 0.9 }, {
    xPercent: 220,
    ease: "none",
    scrollTrigger: {
      trigger: ".hero",
      start: "top center",
      end: "bottom top",
      scrub: 0.9
    }
  });

  // Add a tiny floating/bounce to car to suggest motion
  gsap.to(car, {
    y: "-=6",
    duration: 0.6,
    yoyo: true,
    repeat: -1,
    ease: "sine.inOut",
    delay: 0.1
  });

  // Subtle leaderboard row highlight when entering viewport
  gsap.utils.toArray("#leaderboard tbody tr").forEach((row, i) => {
    gsap.from(row, {
      opacity: 0,
      y: 12,
      duration: 0.6,
      delay: i * 0.06,
      scrollTrigger: {
        trigger: row,
        start: "top 85%"
      }
    });
  });

  // small pulse on Play button when hero is visible
  gsap.to(".btn", {
    scale: 1.03,
    repeat: -1,
    yoyo: true,
    duration: 1.8,
    ease: "sine.inOut",
    scrollTrigger: {
      trigger: ".hero",
      start: "top top",
      end: "bottom top"
    }
  });
}

// Wait a tick to ensure GSAP loaded
window.addEventListener("load", () => {
  // If gsap hasn't loaded from CDN yet, poll for it
  const maxTries = 50;
  let tries = 0;
  const t = setInterval(() => {
    tries++;
    if (window.gsap && window.ScrollTrigger) {
      clearInterval(t);
      initAnimations();
    } else if (tries > maxTries) {
      clearInterval(t);
      console.warn("GSAP not available — animations disabled.");
    }
  }, 50);
});
