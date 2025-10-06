(function () {
  const area = document.getElementById("gameArea");
  const scoreEl = document.getElementById("score");
  const levelEl = document.getElementById("level");
  const livesEl = document.getElementById("lives");
  const timeEl = document.getElementById("time");
  const targetEl = document.getElementById("target");

  const state = {
    running: false,
    paused: false,
    score: 0,
    level: 1,
    lives: 3,
    time: 0,
    target: 5,
  };

  const player = document.createElement("div");
  player.classList.add("player");
  area.appendChild(player);
  let px = 80, py = 80, speed = 4;

  const walkers = [];
  const collectibles = [];

  function createWalker() {
    const w = document.createElement("div");
    w.classList.add("walker");
    w.x = Math.random() * (area.clientWidth - 50);
    w.y = Math.random() * (area.clientHeight - 50);
    w.vx = (Math.random() - 0.5) * 3;
    w.vy = (Math.random() - 0.5) * 3;
    area.appendChild(w);
    walkers.push(w);
  }

  function createCollectible() {
    const c = document.createElement("div");
    c.classList.add("collectible");
    c.x = Math.random() * (area.clientWidth - 30);
    c.y = Math.random() * (area.clientHeight - 30);
    area.appendChild(c);
    collectibles.push(c);
  }

  function updateEntities() {
    walkers.forEach(w => {
      w.x += w.vx;
      w.y += w.vy;
      if (w.x < 0 || w.x > area.clientWidth - 48) w.vx *= -1;
      if (w.y < 0 || w.y > area.clientHeight - 48) w.vy *= -1;
      w.style.transform = `translate(${w.x}px, ${w.y}px)`;

      if (checkCollision(player, w)) {
        if (!w.hitCooldown) {
          state.lives -= 1;
          livesEl.textContent = state.lives;
          w.hitCooldown = 40;
          if (state.lives <= 0) endGame();
        }
      }
      if (w.hitCooldown) w.hitCooldown--;
    });

    collectibles.forEach((c, i) => {
      c.style.transform = `translate(${c.x}px, ${c.y}px) scale(${1 + 0.1 * Math.sin(Date.now()/200)})`;
      if (checkCollision(player, c)) {
        area.removeChild(c);
        collectibles.splice(i, 1);
        state.score++;
        scoreEl.textContent = state.score;
        if (state.score >= state.target) levelUp();
        else createCollectible();
      }
    });
  }

  function checkCollision(a, b) {
    const ar = a.getBoundingClientRect();
    const br = b.getBoundingClientRect();
    return !(
      ar.right < br.left ||
      ar.left > br.right ||
      ar.bottom < br.top ||
      ar.top > br.bottom
    );
  }

  function movePlayer(dx, dy) {
    px = Math.max(0, Math.min(area.clientWidth - 48, px + dx));
    py = Math.max(0, Math.min(area.clientHeight - 48, py + dy));
    player.style.transform = `translate(${px}px, ${py}px)`;
  }

  const keys = {};
  document.addEventListener("keydown", e => keys[e.key] = true);
  document.addEventListener("keyup", e => keys[e.key] = false);

  function handleInput() {
    if (keys["ArrowUp"] || keys["w"]) movePlayer(0, -speed);
    if (keys["ArrowDown"] || keys["s"]) movePlayer(0, speed);
    if (keys["ArrowLeft"] || keys["a"]) movePlayer(-speed, 0);
    if (keys["ArrowRight"] || keys["d"]) movePlayer(speed, 0);
  }

  function startGame() {
    area.querySelectorAll(".walker,.collectible").forEach(e => e.remove());
    walkers.length = 0; collectibles.length = 0;
    state.running = true; state.paused = false;
    state.score = 0; state.level = 1; state.lives = 3; state.target = 5;
    px = 80; py = 80;
    scoreEl.textContent = 0; levelEl.textContent = 1; livesEl.textContent = 3;
    for (let i = 0; i < 2; i++) createWalker();
    createCollectible();
  }

  function levelUp() {
    state.level++;
    state.target = Math.floor(state.target * 1.8 + 1);
    levelEl.textContent = state.level;
    targetEl.textContent = `Target: ${state.target}`;
    for (let i = 0; i < 2 + state.level; i++) createWalker();
  }

  function endGame() {
    state.running = false;
    alert("Game Over! Refresh or click Restart.");
  }

  document.getElementById("startBtn").onclick = startGame;
  document.getElementById("restartBtn").onclick = startGame;
  document.getElementById("pauseBtn").onclick = () => state.paused = !state.paused;

  function loop() {
    if (state.running && !state.paused) {
      handleInput();
      updateEntities();
    }
    requestAnimationFrame(loop);
  }
  loop();
})();