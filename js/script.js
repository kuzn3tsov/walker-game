// ============================================================
// STAR EATER — Space Edition (raketa i svemirci)
// ============================================================
// Verzija s: intro modalom, zvukom, FA ikonama, fixanim mute gumbom i raketom bez pozadine
// ============================================================

// ---------- Elementi ----------
const gameArea = document.getElementById("game-area");
if (!gameArea) {
  console.error("Nije pronađen element #game-area!");
}
const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const restartBtn = document.getElementById("restartBtn");
const muteBtn = document.getElementById("muteBtn");
const infoBtn = document.getElementById("infoBtn");
const fsBtn = document.getElementById("fsBtn");

const rulesModal = document.getElementById("rulesModal");
const closeModal = document.getElementById("closeModal");

const scoreEl = document.getElementById("score");
const highScoreEl = document.getElementById("highscore");
const livesEl = document.getElementById("lives");
const levelEl = document.getElementById("level");

// ---------- Intro i Game Over modali ----------
const introModal = document.createElement("div");
introModal.className = "modal";
introModal.innerHTML = `
  <div class="modal-content">
    <h2>🚀 Dobrodošao u Star Eater!</h2>
    <p>Spreman za let kroz svemir? Sakupi sve zvijezde i izbjegavaj svemirce!</p>
    <button id="introStart">Start</button>
  </div>`;
document.body.appendChild(introModal);

const gameOverModal = document.createElement("div");
gameOverModal.className = "modal";
gameOverModal.innerHTML = `
  <div class="modal-content">
    <h2>Kraj igre!</h2>
    <p id="finalScoreText"></p>
    <button id="restartGame">🔁 Igraj ponovno</button>
  </div>`;
document.body.appendChild(gameOverModal);

// ---------- Stanje igre ----------
let score = 0, highScore = 0, lives = 3, level = 1;
let running = false, paused = false, muted = false;

let collectibles = [], aliens = [];
let powerMode = false, aliensFrozen = false;
let powerTimeout, freezeTimeout;

const GAME_MARGIN = 50;
const PLAYER_SIZE = 40;
const ALIEN_SIZE = 40;
const gameBounds = { width: 0, height: 0 };

// 🌌 Generiranje zvjezdanog polja sa blagim pomakom
function createStarfield(count = 120) {
  for (let i = 0; i < count; i++) {
    const star = document.createElement("div");
    star.classList.add("star");

    // nasumična veličina i pozicija
    const size = Math.random() * 2 + 1;
    star.style.width = `${size}px`;
    star.style.height = `${size}px`;
    star.style.left = `${Math.random() * 100}%`;
    star.style.top = `${Math.random() * 100}%`;
    star.style.animationDelay = `${Math.random() * 8}s`;

    // svaka zvjezdica ima malo drugačiju brzinu i smjer
    const duration = 6 + Math.random() * 4;
    star.style.animationDuration = `${duration}s`;

    gameArea.appendChild(star);
  }
}
// ---------- Zvuk ----------
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
// Zvuk warp efekta (kratki ping)
const warpSound = new Audio();
warpSound.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAABCxAgAEABAAZGF0YQgAAAAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA";
warpSound.volume = 0.4;

function playTone(freq, duration = 0.2, type = "square", vol = 0.15, delay = 0) {
  if (muted) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.connect(g);
  g.connect(audioCtx.destination);
  o.type = type;
  o.frequency.setValueAtTime(freq, audioCtx.currentTime + delay);
  g.gain.setValueAtTime(vol, audioCtx.currentTime + delay);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + delay + duration);
  o.start(audioCtx.currentTime + delay);
  o.stop(audioCtx.currentTime + delay + duration);
}

function playSound(type) {
  if (muted) return;
  switch (type) {
    case "collect": playTone(440, 0.1); playTone(880, 0.1, "triangle", 0.08, 0.05); break;
    case "ping": playTone(800, 0.2, "triangle"); break;
    case "hit": playTone(200, 0.15); playTone(100, 0.15, "square", 0.1, 0.05); break;
    case "levelup": playTone(500, 0.15, "triangle"); playTone(700, 0.2, "triangle", 0.15, 0.15); playTone(900, 0.25, "triangle", 0.15, 0.3); break;
  }
}

// ---------- Pomoćne funkcije ----------
function rand(min, max) { return Math.random() * (max - min) + min; }
function updateGameBounds() {
  const rect = gameArea.getBoundingClientRect();
  gameBounds.width = rect.width;
  gameBounds.height = rect.height;
}
window.addEventListener("resize", updateGameBounds);
window.addEventListener("load", () => {
  setTimeout(updateGameBounds, 50);
});


function createIcon(classes, color) {
  const i = document.createElement("i");
  i.className = classes;
  i.style.color = color;
  i.style.textShadow = `0 0 8px ${color}`;
  return i;
}

// ---------- Igrač ----------
const player = document.createElement("div");
player.id = "player";

// 🔹 Raketa (Font Awesome ikona)
const playerIcon = document.createElement("i");
playerIcon.className = "fa-solid fa-rocket";
playerIcon.style.color = "turquoise";
playerIcon.style.fontSize = "2em"; // povećano 200%
playerIcon.style.transformOrigin = "center";

// 🔥 Plamen iza rakete
const flame = document.createElement("div");
flame.classList.add("flame");

// 🔹 Dodavanje ikona unutar igrača
player.appendChild(playerIcon);
player.appendChild(flame);
gameArea.appendChild(player);

// 🔹 Stanje igrača
const playerState = { x: 0, y: 0, vx: 0, vy: 0, speed: 4, angle: 0 };

// ---------- Kontrole ----------
const keys = {};
window.addEventListener("keydown", e => keys[e.key.toLowerCase()] = true);
window.addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);

function setDirection(dir) {
  const s = playerState.speed;
  switch (dir) {
    case "up": playerState.vx = 0; playerState.vy = -s; playerState.angle = -90; break;
    case "down": playerState.vx = 0; playerState.vy = s; playerState.angle = 90; break;
    case "left": playerState.vx = -s; playerState.vy = 0; playerState.angle = 180; break;
    case "right": playerState.vx = s; playerState.vy = 0; playerState.angle = 0; break;
  }
  rotatePlayer();
}

function handleInput() {
  if (keys["arrowup"] || keys["w"]) setDirection("up");
  else if (keys["arrowdown"] || keys["s"]) setDirection("down");
  else if (keys["arrowleft"] || keys["a"]) setDirection("left");
  else if (keys["arrowright"] || keys["d"]) setDirection("right");
  else { playerState.vx = 0; playerState.vy = 0; }
}

// ---------- Rotacija igrača ----------
function rotatePlayer() {
  player.style.transform = `translate(${playerState.x}px, ${playerState.y}px) rotate(${playerState.angle}deg)`;
  playerIcon.style.transform = `rotate(90deg)`; // poravnanje rakete jer FA raketa gleda gore

}

// 📱 Mobilne kontrole
const btnLeft = document.getElementById("btn-left");
const btnRight = document.getElementById("btn-right");
const btnUp = document.getElementById("btn-up");
const btnDown = document.getElementById("btn-down");

// Dodaj dodirne evente
const mobileControls = [
  { btn: btnLeft, vx: -1, vy: 0 },
  { btn: btnRight, vx: 1, vy: 0 },
  { btn: btnUp, vx: 0, vy: -1 },
  { btn: btnDown, vx: 0, vy: 1 },
];

mobileControls.forEach(ctrl => {
  ctrl.btn.addEventListener("touchstart", e => {
    if (e.cancelable) e.preventDefault(); // ✅ sigurno sprječavanje bez upozorenja
    playerState.vx = ctrl.vx * playerState.speed;
    playerState.vy = ctrl.vy * playerState.speed;
  }, { passive: false });
  // 💻 Dodaj i podršku za miš
  mobileControls.forEach(ctrl => {
    ctrl.btn.addEventListener("mousedown", () => {
      playerState.vx = ctrl.vx * playerState.speed;
      playerState.vy = ctrl.vy * playerState.speed;
    });
    ctrl.btn.addEventListener("mouseup", () => {
      playerState.vx = 0;
      playerState.vy = 0;
    });
  });
  ctrl.btn.addEventListener("touchend", e => {
    if (e.cancelable) e.preventDefault(); // ✅ isto ovdje
    playerState.vx = 0;
    playerState.vy = 0;
  }, { passive: false });
});
// ---------- Zvuk i fullscreen ----------
muteBtn.addEventListener("click", () => {
  muted = !muted;
  const icon = muteBtn.querySelector("i");
  icon.className = muted ? "fa-solid fa-volume-xmark" : "fa-solid fa-volume-high";
});
fsBtn.addEventListener("click", () => {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen();
  else document.exitFullscreen();
});

// ---------- Modali ----------
infoBtn.addEventListener("click", () => rulesModal.style.display = "flex");
closeModal.addEventListener("click", () => rulesModal.style.display = "none");

// ---------- Collectibles ----------
function spawnItem(type) {
  const el = document.createElement("div");
  el.classList.add("collectible");

  let icon;
  switch (type) {
    case "yellow": icon = createIcon("fa-solid fa-star", "gold"); break;
    case "green": icon = createIcon("fa-solid fa-star", "greenyellow"); break;
    case "blue": icon = createIcon("fa-solid fa-star", "turquoise"); break;
    case "heart": icon = createIcon("fa-solid fa-rocket", "darkred"); break;
  }
  el.appendChild(icon);

  const x = rand(GAME_MARGIN, gameBounds.width - GAME_MARGIN - 30);
  const y = rand(GAME_MARGIN, gameBounds.height - GAME_MARGIN - 30);
  el.style.transform = `translate(${x}px, ${y}px)`;
  gameArea.appendChild(el);
  collectibles.push({ x, y, el, type });
}

function spawnCollectibles() {
  collectibles.forEach(c => c.el.remove());
  collectibles = [];
  for (let i = 0; i < 10; i++) spawnItem("yellow");
  for (let i = 0; i < Math.floor(rand(1, 4)); i++) spawnItem("green");
  if (level % 5 === 0) spawnItem("heart");
  if (level >= 15 && (level - 15) % 3 === 0) spawnItem("blue");
}

// ---------- Svemirci ----------
function spawnAliensByLevel(lvl) {
  aliens.forEach(a => a.el.remove());
  aliens = [];
  const speeds = [1.5, 2.0, 2.5, 3.0];
  const colors = ["red", "green", "grey", "deeppink"];
  let pattern = [];

  switch (true) {
    case (lvl <= 12): {
      const phase = Math.ceil(lvl / 3);
      const addCount = lvl % 3 === 1 ? 3 : lvl % 3 === 2 ? 3 : 4;
      for (let i = 0; i < addCount; i++) pattern.push(phase);
      break;
    }
    case (lvl === 13): pattern = [1, 2, 3, 4]; break;
    case (lvl === 14): pattern = [1, 2, 3, 4, 1, 1]; break;
    case (lvl === 15): pattern = [1, 1, 1, 1, 2, 2]; break;
    case (lvl === 16): pattern = Array(8).fill(2); break;
    case (lvl >= 17 && lvl < 20): pattern = Array(10).fill(3); break;
    default: pattern = Array(12).fill(4); break;
  }

  pattern.forEach(t => {
    const el = document.createElement("div");
    el.classList.add("alien");

    // 👾 Font Awesome ikona svemirca (povećana i centrirana)
    const alienIcon = document.createElement("i");
    alienIcon.className = "fa-solid fa-satellite"; // možeš promijeniti u fa-ufo ili fa-shuttle-space ako želiš
    alienIcon.style.color = colors[t - 1];
    alienIcon.style.fontSize = "2em";              // povećano 200%
    alienIcon.style.transformOrigin = "center";
    el.appendChild(alienIcon);

    // 🔥 Dodaj thruster plamen svemircu
    const alienFlame = document.createElement("div");
    alienFlame.classList.add("alien-flame");
    alienFlame.style.background = `radial-gradient(circle, ${colors[t - 1]}, transparent)`;
    el.appendChild(alienFlame);

    // 📍 Nasumična pozicija i brzina
    const x = rand(GAME_MARGIN, gameBounds.width - GAME_MARGIN - ALIEN_SIZE);
    const y = rand(GAME_MARGIN, gameBounds.height - GAME_MARGIN - ALIEN_SIZE);
    const speed = speeds[t - 1];
    const vx = rand(-1, 1) * speed;
    const vy = rand(-1, 1) * speed;

    // 🛰️ Postavi na ekran
    el.style.transform = `translate(${x}px, ${y}px)`;
    gameArea.appendChild(el);

    // 📦 Spremi u niz s objektom
    aliens.push({ x, y, vx, vy, el, speed });
  });
}

// ---------- Efekti ----------
function flashPlayer(color) {
  player.classList.add(`flash-${color}`);
  setTimeout(() => player.classList.remove(`flash-${color}`), 500);
}

function freezeAliens(ms) {
  aliensFrozen = true;
  aliens.forEach(a => a.el.style.opacity = 0.5);
  clearTimeout(freezeTimeout);
  freezeTimeout = setTimeout(() => {
    aliensFrozen = false;
    aliens.forEach(a => a.el.style.opacity = 1);
  }, ms);
}

// 💥 Aktivacija Power Mode efekta (plava zvijezda)
function activatePowerMode(ms) {
  powerMode = true;
  clearTimeout(powerTimeout);

  player.classList.add("flash-blue");

  // 🔥 Plamen – pojačaj intenzitet
  const flame = player.querySelector(".flame");
  if (flame) flame.classList.add("power");

  // 🎵 Power-up zvuk (retro fanfare C–G–E)
  if (!mute) {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [261.63, 392.00, 659.25]; // C4, G4, E5
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.05);
      osc.stop(ctx.currentTime + 0.35 + i * 0.05);
    });
  };
};
// ---------- Logika ----------
function loseLife() {
  lives--;
  livesEl.textContent = lives;
  if (lives <= 0) return gameOver();
  resetPlayer();
}

function resetPlayer() {
  playerState.x = gameBounds.width / 2;
  playerState.y = gameBounds.height / 2;
  playerState.vx = 0;
  playerState.vy = 0;
  rotatePlayer();
}

function gameOver() {
  running = false;
  document.getElementById("finalScoreText").textContent = `Tvoj rezultat: ${score}`;
  gameOverModal.style.display = "flex";
}
document.getElementById("restartGame").addEventListener("click", () => {
  gameOverModal.style.display = "none";
  startGame();
});

function nextLevel() {
  level++;
  levelEl.textContent = level;
  playSound("levelup");
  spawnCollectibles();
  spawnAliensByLevel(level);
}

// ---------- Petlja ----------
function updatePlayer() {
  playerState.x += playerState.vx;
  playerState.y += playerState.vy;
  playerState.x = Math.max(GAME_MARGIN, Math.min(gameBounds.width - GAME_MARGIN - PLAYER_SIZE, playerState.x));
  playerState.y = Math.max(GAME_MARGIN, Math.min(gameBounds.height - GAME_MARGIN - PLAYER_SIZE, playerState.y));
  rotatePlayer();
  document.querySelectorAll(".star").forEach(star => {
    const offset = (playerState.vx + playerState.vy) * 0.3;
    const currentTop = parseFloat(star.style.top);
    let newTop = currentTop + offset * 0.01;
    if (newTop > 100) newTop = 0;
    if (newTop < 0) newTop = 100;
    star.style.top = `${newTop}%`;
  });
}

// 🚀 Ažuriranje svemiraca i njihovog gibanja
// 🚀 Ažuriranje svemiraca i njihovog gibanja
function updateAliens() {
  aliens.forEach(a => {
    // ako su zamrznuti (zelena zvjezdica) – ne miču se
    if (aliensFrozen) return;

    // pomicanje
    a.x += a.vx;
    a.y += a.vy;

    // granice kretanja
    let bounced = false;

    if (a.x <= GAME_MARGIN || a.x >= gameBounds.width - GAME_MARGIN - ALIEN_SIZE) {
      a.vx *= -1;
      bounced = true;
    }
    if (a.y <= GAME_MARGIN || a.y >= gameBounds.height - GAME_MARGIN - ALIEN_SIZE) {
      a.vy *= -1;
      bounced = true;
    }

    // ⚡ Warp blink efekt i warp zvuk kad se odbije od ruba
    if (bounced) {
      a.el.classList.add("alien-blink");
      setTimeout(() => a.el.classList.remove("alien-blink"), 150);

      // 🎵 Warp zvuk (kratki ping)
      if (!muted) { // koristi 'muted', ne 'mute'
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = 880; // visoki ping ton
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      }
    }

    // rotacija svemirca prema smjeru gibanja
    const angle = Math.atan2(a.vy, a.vx) * (180 / Math.PI);
    a.el.style.transform = `translate(${a.x}px, ${a.y}px) rotate(${angle}deg)`;
  });
}


function checkCollisions() {
  collectibles.forEach((c, i) => {
    const dx = playerState.x - c.x;
    const dy = playerState.y - c.y;
    if (Math.sqrt(dx * dx + dy * dy) < 30) {
      c.el.remove();
      collectibles.splice(i, 1);
      if (c.type === "yellow") { score++; playSound("collect"); flashPlayer("yellow"); }
      else if (c.type === "green") { freezeAliens(1000); playSound("ping"); flashPlayer("green"); }
      else if (c.type === "heart") { lives++; livesEl.textContent = lives; playSound("levelup"); flashPlayer("heart"); }
      else if (c.type === "blue") { activatePowerMode(10000); playSound("levelup"); flashPlayer("blue"); }
      scoreEl.textContent = score;
    }
  });

  aliens.forEach((a, i) => {
    const dx = playerState.x - a.x;
    const dy = playerState.y - a.y;
    if (Math.sqrt(dx * dx + dy * dy) < 35) {
      if (powerMode) {
        a.el.remove();
        aliens.splice(i, 1);
        score += 5;
        scoreEl.textContent = score;
        playSound("ping");
      } else {
        playSound("hit");
        loseLife();
      }
    }
  });

  if (collectibles.filter(c => c.type === "yellow").length === 0) nextLevel();
}

function gameLoop() {
  if (!running || paused) return;
  handleInput();
  updatePlayer();
  updateAliens();
  checkCollisions();
  requestAnimationFrame(gameLoop);
}

// ---------- Start ----------
function startGame() {
  if (audioCtx.state === "suspended") audioCtx.resume(); // pokreni zvuk

  // 🔄 Reset svih glavnih parametara
  score = 0;
  lives = 3;
  level = 1;
  scoreEl.textContent = score;
  livesEl.textContent = lives;
  levelEl.textContent = level;

  // 🌌 Regeneriraj pozadinu (očisti stare zvjezdice pa napravi nove)
  document.querySelectorAll(".star").forEach(s => s.remove());
  createStarfield(120);

  // 🚀 Postavi igrača u sredinu
  resetPlayer();

  // ✨ Postavi collectables i neprijatelje
  spawnCollectibles();
  spawnAliensByLevel(level);

  running = true;
  paused = false;

  // ▶️ Pokreni glavni loop igre
  gameLoop();
}
// ---------- Gumbi ----------
document.getElementById("introStart").addEventListener("click", () => {
  introModal.style.display = "none";
  startGame();
});
pauseBtn.addEventListener("click", () => paused = !paused);
restartBtn.addEventListener("click", startGame);

// ---------- Učitavanje ----------
window.addEventListener("load", () => {
  updateGameBounds();
  resetPlayer();
  introModal.style.display = "flex"; // odmah pokaži intro
});
