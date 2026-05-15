(() => {
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    const scoreEl = document.getElementById('score');
    const hiscoreEl = document.getElementById('hiscore');
    const waveEl = document.getElementById('wave');
    const livesEl = document.getElementById('lives');
    const overlay = document.getElementById('overlay');
    const gameOverEl = document.getElementById('gameOver');
    const gameOverTitle = document.getElementById('gameOverTitle');
    const finalScoreEl = document.getElementById('finalScore');
    const startBtn = document.getElementById('startBtn');
    const restartBtn = document.getElementById('restartBtn');
    const saveScoreBtn = document.getElementById('saveScoreBtn');
    const playerName = document.getElementById('playerName');
    const scoreList = document.getElementById('scoreList');

    const ALIEN_COLS = 11;
    const ALIEN_ROWS = 5;
    const ALIEN_W = 32;
    const ALIEN_H = 24;
    const ALIEN_PAD_X = 16;
    const ALIEN_PAD_Y = 14;

    const state = {
        running: false,
        paused: false,
        score: 0,
        hiscore: 0,
        wave: 1,
        lives: 3,
        player: null,
        aliens: [],
        bullets: [],
        alienBullets: [],
        barriers: [],
        ufo: null,
        ufoTimer: 0,
        alienDir: 1,
        alienSpeed: 0.5,
        alienStepTimer: 0,
        explosions: [],
        keys: {},
        lastShot: 0,
        respawnTimer: 0,
        stars: []
    };

    // Pixel sprites (1 = pixel on, 0 = off). Each row is a string.
    const SPRITES = {
        alien1a: [
            '..X.....X..',
            '...X...X...',
            '..XXXXXXX..',
            '.XX.XXX.XX.',
            'XXXXXXXXXXX',
            'X.XXXXXXX.X',
            'X.X.....X.X',
            '...XX.XX...'
        ],
        alien1b: [
            '..X.....X..',
            'X..X...X..X',
            'X.XXXXXXX.X',
            'XXX.XXX.XXX',
            'XXXXXXXXXXX',
            '.XXXXXXXXX.',
            '..X.....X..',
            '.X.......X.'
        ],
        alien2a: [
            '...XXXX...',
            '.XXXXXXXX.',
            'XXXXXXXXXX',
            'XXX..XX..XX',
            'XXXXXXXXXXX',
            '..XXX..XXX.',
            '.XX.XX.XX..',
            'X.X....X.X.'
        ],
        alien2b: [
            '...XXXX...',
            '.XXXXXXXX.',
            'XXXXXXXXXX',
            'XXX..XX..XX',
            'XXXXXXXXXXX',
            '.XXX.XXXXX.',
            'X.X.XX.X.X.',
            '.X......X..'
        ],
        alien3a: [
            '....XX....',
            '...XXXX...',
            '..XXXXXX..',
            '.XX.XX.XX.',
            'XXXXXXXXXX',
            'X.XXXXXX.X',
            'X.X....X.X',
            '...XX.XX..'
        ],
        alien3b: [
            '....XX....',
            '...XXXX...',
            '..XXXXXX..',
            '.XX.XX.XX.',
            'XXXXXXXXXX',
            '..XXXXXX..',
            '.X.XXXX.X.',
            'X.X....X.X'
        ],
        player: [
            '....X....',
            '...XXX...',
            '...XXX...',
            'XXXXXXXXX',
            'XXXXXXXXX',
            'XXXXXXXXX',
            'XXXXXXXXX'
        ],
        ufo: [
            '....XXXXXX....',
            '..XXXXXXXXXX..',
            '.XXXXXXXXXXXX.',
            'XX.XX.XX.XX.XX',
            'XXXXXXXXXXXXXX',
            '..XX..XX..XX..',
            '.X........X...'
        ]
    };

    const ALIEN_VARIANTS = [
        { a: SPRITES.alien3a, b: SPRITES.alien3b, points: 30, color: '#ff3' },
        { a: SPRITES.alien2a, b: SPRITES.alien2b, points: 20, color: '#0ff' },
        { a: SPRITES.alien2a, b: SPRITES.alien2b, points: 20, color: '#0ff' },
        { a: SPRITES.alien1a, b: SPRITES.alien1b, points: 10, color: '#f0f' },
        { a: SPRITES.alien1a, b: SPRITES.alien1b, points: 10, color: '#f0f' }
    ];

    function drawSprite(sprite, x, y, scale, color) {
        ctx.fillStyle = color;
        for (let row = 0; row < sprite.length; row++) {
            const line = sprite[row];
            for (let col = 0; col < line.length; col++) {
                if (line[col] === 'X') {
                    ctx.fillRect(x + col * scale, y + row * scale, scale, scale);
                }
            }
        }
    }

    function initStars() {
        state.stars = [];
        for (let i = 0; i < 60; i++) {
            state.stars.push({
                x: Math.random() * W,
                y: Math.random() * H,
                s: Math.random() * 1.5 + 0.3,
                v: Math.random() * 0.4 + 0.1
            });
        }
    }

    function createPlayer() {
        return {
            x: W / 2 - 22,
            y: H - 60,
            w: 44,
            h: 28,
            speed: 4,
            cooldown: 0,
            invuln: 0
        };
    }

    function createAliens() {
        state.aliens = [];
        const startX = 60;
        const startY = 80;
        for (let r = 0; r < ALIEN_ROWS; r++) {
            for (let c = 0; c < ALIEN_COLS; c++) {
                state.aliens.push({
                    row: r,
                    col: c,
                    x: startX + c * (ALIEN_W + ALIEN_PAD_X),
                    y: startY + r * (ALIEN_H + ALIEN_PAD_Y),
                    variant: ALIEN_VARIANTS[r],
                    frame: 0,
                    alive: true
                });
            }
        }
        state.alienDir = 1;
        state.alienSpeed = 0.6 + (state.wave - 1) * 0.15;
        state.alienStepTimer = 0;
    }

    function createBarriers() {
        state.barriers = [];
        const count = 4;
        const bw = 64;
        const bh = 40;
        const gap = (W - bw * count) / (count + 1);
        for (let i = 0; i < count; i++) {
            const bx = gap + i * (bw + gap);
            const by = H - 160;
            const cells = [];
            for (let r = 0; r < bh / 4; r++) {
                const row = [];
                for (let c = 0; c < bw / 4; c++) {
                    let on = 1;
                    if (r < 3 && (c < 2 || c >= bw / 4 - 2)) on = 0;
                    if (r >= bh / 4 - 3 && c >= bw / 8 - 2 && c < bw / 8 + 4) on = 0;
                    row.push(on);
                }
                cells.push(row);
            }
            state.barriers.push({ x: bx, y: by, cells, cellSize: 4 });
        }
    }

    function resetGame() {
        state.score = 0;
        state.wave = 1;
        state.lives = 3;
        state.bullets = [];
        state.alienBullets = [];
        state.explosions = [];
        state.ufo = null;
        state.ufoTimer = 600;
        state.player = createPlayer();
        createAliens();
        createBarriers();
        updateHud();
    }

    function nextWave() {
        state.wave++;
        state.bullets = [];
        state.alienBullets = [];
        state.ufo = null;
        createAliens();
        createBarriers();
        updateHud();
    }

    function updateHud() {
        scoreEl.textContent = String(state.score).padStart(4, '0');
        hiscoreEl.textContent = String(state.hiscore).padStart(4, '0');
        waveEl.textContent = state.wave;
        livesEl.textContent = state.lives;
    }

    function shoot() {
        if (!state.player || state.player.cooldown > 0) return;
        const existing = state.bullets.length;
        if (existing >= 1) return;
        state.bullets.push({
            x: state.player.x + state.player.w / 2 - 1,
            y: state.player.y - 8,
            w: 3,
            h: 12,
            speed: 9
        });
        state.player.cooldown = 12;
        playSound(880, 0.05, 'square');
    }

    function alienShoot() {
        const aliveCols = {};
        for (const a of state.aliens) {
            if (!a.alive) continue;
            if (!aliveCols[a.col] || a.y > aliveCols[a.col].y) {
                aliveCols[a.col] = a;
            }
        }
        const shooters = Object.values(aliveCols);
        if (shooters.length === 0) return;
        const shooter = shooters[Math.floor(Math.random() * shooters.length)];
        state.alienBullets.push({
            x: shooter.x + ALIEN_W / 2,
            y: shooter.y + ALIEN_H,
            w: 3,
            h: 12,
            speed: 3 + state.wave * 0.3
        });
    }

    function spawnUfo() {
        const fromLeft = Math.random() < 0.5;
        state.ufo = {
            x: fromLeft ? -40 : W + 40,
            y: 40,
            w: 40,
            h: 20,
            speed: fromLeft ? 2 : -2,
            points: [50, 100, 150, 300][Math.floor(Math.random() * 4)]
        };
        playSound(220, 0.4, 'sawtooth');
    }

    function rectsCollide(a, b) {
        return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }

    function damageBarrier(barrier, px, py) {
        const cs = barrier.cellSize;
        const col = Math.floor((px - barrier.x) / cs);
        const row = Math.floor((py - barrier.y) / cs);
        let hit = false;
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                const r = row + dr;
                const c = col + dc;
                if (r >= 0 && r < barrier.cells.length && c >= 0 && c < barrier.cells[0].length) {
                    if (barrier.cells[r][c] === 1) {
                        if (Math.random() < 0.6) {
                            barrier.cells[r][c] = 0;
                            hit = true;
                        }
                    }
                }
            }
        }
        return hit;
    }

    function checkBarrierHit(bullet) {
        for (const b of state.barriers) {
            if (bullet.x + bullet.w < b.x || bullet.x > b.x + b.cells[0].length * b.cellSize) continue;
            if (bullet.y + bullet.h < b.y || bullet.y > b.y + b.cells.length * b.cellSize) continue;
            const cs = b.cellSize;
            const col = Math.floor((bullet.x + bullet.w / 2 - b.x) / cs);
            const startRow = bullet.speed > 0 ? Math.floor((bullet.y - b.y) / cs) : Math.floor((bullet.y + bullet.h - b.y) / cs);
            if (col < 0 || col >= b.cells[0].length) continue;
            if (startRow < 0 || startRow >= b.cells.length) continue;
            if (b.cells[startRow][col] === 1) {
                damageBarrier(b, bullet.x + bullet.w / 2, bullet.y + bullet.h / 2);
                return true;
            }
        }
        return false;
    }

    function explosion(x, y, color) {
        state.explosions.push({ x, y, life: 18, color: color || '#fff' });
    }

    let audioCtx;
    function playSound(freq, dur, type) {
        try {
            if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = type || 'square';
            osc.frequency.value = freq;
            gain.gain.value = 0.07;
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();
            gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
            osc.stop(audioCtx.currentTime + dur);
        } catch (e) { /* ignore */ }
    }

    function update() {
        if (!state.running || state.paused) return;

        // stars
        for (const s of state.stars) {
            s.y += s.v;
            if (s.y > H) { s.y = 0; s.x = Math.random() * W; }
        }

        // player
        if (state.respawnTimer > 0) {
            state.respawnTimer--;
            if (state.respawnTimer === 0) {
                state.player = createPlayer();
                state.player.invuln = 90;
            }
        } else if (state.player) {
            if (state.keys.left) state.player.x -= state.player.speed;
            if (state.keys.right) state.player.x += state.player.speed;
            state.player.x = Math.max(8, Math.min(W - state.player.w - 8, state.player.x));
            if (state.player.cooldown > 0) state.player.cooldown--;
            if (state.player.invuln > 0) state.player.invuln--;
            if (state.keys.fire) shoot();
        }

        // bullets
        for (let i = state.bullets.length - 1; i >= 0; i--) {
            const b = state.bullets[i];
            b.y -= b.speed;
            if (b.y + b.h < 0) { state.bullets.splice(i, 1); continue; }
            if (checkBarrierHit({ ...b, speed: -b.speed })) {
                state.bullets.splice(i, 1);
                continue;
            }
            // ufo
            if (state.ufo && rectsCollide(b, state.ufo)) {
                state.score += state.ufo.points;
                explosion(state.ufo.x + state.ufo.w / 2, state.ufo.y + state.ufo.h / 2, '#f33');
                state.ufo = null;
                state.bullets.splice(i, 1);
                playSound(120, 0.3, 'sawtooth');
                continue;
            }
            // aliens
            let hit = false;
            for (const a of state.aliens) {
                if (!a.alive) continue;
                if (b.x < a.x + ALIEN_W && b.x + b.w > a.x && b.y < a.y + ALIEN_H && b.y + b.h > a.y) {
                    a.alive = false;
                    state.score += a.variant.points;
                    explosion(a.x + ALIEN_W / 2, a.y + ALIEN_H / 2, a.variant.color);
                    state.bullets.splice(i, 1);
                    playSound(220, 0.1, 'triangle');
                    hit = true;
                    break;
                }
            }
            if (hit) continue;
        }

        // alien bullets
        for (let i = state.alienBullets.length - 1; i >= 0; i--) {
            const b = state.alienBullets[i];
            b.y += b.speed;
            if (b.y > H) { state.alienBullets.splice(i, 1); continue; }
            if (checkBarrierHit(b)) {
                state.alienBullets.splice(i, 1);
                continue;
            }
            if (state.player && state.player.invuln === 0 && rectsCollide(b, state.player)) {
                state.alienBullets.splice(i, 1);
                playerHit();
                continue;
            }
        }

        // aliens stepping
        const alive = state.aliens.filter(a => a.alive);
        const step = Math.max(8, 60 - alive.length * 1.2 - state.wave * 4);
        state.alienStepTimer++;
        if (state.alienStepTimer >= step) {
            state.alienStepTimer = 0;
            let edge = false;
            const dx = state.alienDir * (3 + state.wave);
            for (const a of alive) {
                const nx = a.x + dx;
                if (nx < 8 || nx + ALIEN_W > W - 8) { edge = true; break; }
            }
            if (edge) {
                state.alienDir *= -1;
                for (const a of alive) a.y += 16;
            } else {
                for (const a of alive) a.x += dx;
            }
            for (const a of alive) a.frame ^= 1;
            playSound(80 + alive.length, 0.04, 'square');

            // landing
            for (const a of alive) {
                if (a.y + ALIEN_H >= H - 80) {
                    gameOver(false);
                    return;
                }
            }
        }

        // alien fire
        if (alive.length > 0 && Math.random() < 0.012 + state.wave * 0.003) {
            const maxBullets = Math.min(4, 1 + Math.floor(state.wave / 2));
            if (state.alienBullets.length < maxBullets) alienShoot();
        }

        // ufo
        if (!state.ufo) {
            state.ufoTimer--;
            if (state.ufoTimer <= 0) {
                spawnUfo();
                state.ufoTimer = 600 + Math.random() * 600;
            }
        } else {
            state.ufo.x += state.ufo.speed;
            if (state.ufo.x < -50 || state.ufo.x > W + 50) state.ufo = null;
        }

        // explosions
        for (let i = state.explosions.length - 1; i >= 0; i--) {
            state.explosions[i].life--;
            if (state.explosions[i].life <= 0) state.explosions.splice(i, 1);
        }

        // wave clear
        if (alive.length === 0) nextWave();

        updateHud();
    }

    function playerHit() {
        if (!state.player) return;
        explosion(state.player.x + state.player.w / 2, state.player.y + state.player.h / 2, '#0f0');
        playSound(60, 0.4, 'sawtooth');
        state.player = null;
        state.lives--;
        if (state.lives <= 0) {
            gameOver(true);
        } else {
            state.respawnTimer = 90;
        }
    }

    function gameOver(hitByBullet) {
        state.running = false;
        if (state.score > state.hiscore) state.hiscore = state.score;
        try { localStorage.setItem('si_hiscore', state.hiscore); } catch (e) {}
        gameOverTitle.textContent = hitByBullet ? 'GAME OVER' : 'EARTH INVADED';
        finalScoreEl.textContent = state.score;
        gameOverEl.classList.remove('hidden');
        playerName.value = '';
        playerName.focus();
        updateHud();
    }

    function draw() {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);

        // stars
        for (const s of state.stars) {
            ctx.fillStyle = `rgba(255,255,255,${s.v * 1.5})`;
            ctx.fillRect(s.x, s.y, s.s, s.s);
        }

        // barriers
        ctx.fillStyle = '#0f0';
        for (const b of state.barriers) {
            const cs = b.cellSize;
            for (let r = 0; r < b.cells.length; r++) {
                for (let c = 0; c < b.cells[r].length; c++) {
                    if (b.cells[r][c] === 1) ctx.fillRect(b.x + c * cs, b.y + r * cs, cs, cs);
                }
            }
        }

        // aliens
        for (const a of state.aliens) {
            if (!a.alive) continue;
            const sprite = a.frame === 0 ? a.variant.a : a.variant.b;
            drawSprite(sprite, a.x, a.y, 3, a.variant.color);
        }

        // ufo
        if (state.ufo) {
            drawSprite(SPRITES.ufo, state.ufo.x, state.ufo.y, 3, '#f33');
        }

        // player
        if (state.player) {
            if (state.player.invuln === 0 || Math.floor(state.player.invuln / 6) % 2 === 0) {
                drawSprite(SPRITES.player, state.player.x, state.player.y, 4, '#0f0');
            }
        }

        // bullets
        ctx.fillStyle = '#fff';
        for (const b of state.bullets) ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.fillStyle = '#ff0';
        for (const b of state.alienBullets) ctx.fillRect(b.x, b.y, b.w, b.h);

        // explosions
        for (const e of state.explosions) {
            ctx.fillStyle = e.color;
            const r = Math.max(2, e.life);
            for (let i = 0; i < 8; i++) {
                const ang = (i / 8) * Math.PI * 2;
                ctx.fillRect(e.x + Math.cos(ang) * r - 1, e.y + Math.sin(ang) * r - 1, 3, 3);
            }
        }

        // ground line
        ctx.fillStyle = '#0f0';
        ctx.fillRect(0, H - 30, W, 2);

        if (state.paused) {
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.fillRect(0, 0, W, H);
            ctx.fillStyle = '#0f0';
            ctx.font = 'bold 48px Courier New';
            ctx.textAlign = 'center';
            ctx.fillText('PAUSED', W / 2, H / 2);
        }
    }

    function loop() {
        update();
        draw();
        requestAnimationFrame(loop);
    }

    function startGame() {
        overlay.classList.add('hidden');
        gameOverEl.classList.add('hidden');
        resetGame();
        state.running = true;
        state.paused = false;
        if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    }

    // input
    window.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') state.keys.left = true;
        if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') state.keys.right = true;
        if (e.key === ' ' || e.key === 'ArrowUp') { state.keys.fire = true; e.preventDefault(); }
        if (e.key === 'p' || e.key === 'P') state.paused = !state.paused;
    });
    window.addEventListener('keyup', (e) => {
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') state.keys.left = false;
        if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') state.keys.right = false;
        if (e.key === ' ' || e.key === 'ArrowUp') state.keys.fire = false;
    });

    // touch
    function touchHandler(e) {
        e.preventDefault();
        state.keys.left = state.keys.right = state.keys.fire = false;
        const rect = canvas.getBoundingClientRect();
        for (const t of e.touches) {
            const x = (t.clientX - rect.left) * (W / rect.width);
            const y = (t.clientY - rect.top) * (H / rect.height);
            if (y < H / 2) state.keys.fire = true;
            else if (state.player && x < state.player.x + state.player.w / 2) state.keys.left = true;
            else state.keys.right = true;
        }
    }
    canvas.addEventListener('touchstart', touchHandler, { passive: false });
    canvas.addEventListener('touchmove', touchHandler, { passive: false });
    canvas.addEventListener('touchend', (e) => {
        e.preventDefault();
        if (e.touches.length === 0) state.keys.left = state.keys.right = state.keys.fire = false;
        else touchHandler(e);
    }, { passive: false });

    startBtn.addEventListener('click', startGame);
    restartBtn.addEventListener('click', startGame);

    saveScoreBtn.addEventListener('click', async () => {
        const name = (playerName.value || 'AAA').toUpperCase();
        try {
            const res = await fetch('/api/scores', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, score: state.score })
            });
            if (res.ok) await loadScores();
        } catch (e) { /* ignore */ }
        saveScoreBtn.disabled = true;
        saveScoreBtn.textContent = 'SAVED';
        setTimeout(() => {
            gameOverEl.classList.add('hidden');
            overlay.classList.remove('hidden');
            saveScoreBtn.disabled = false;
            saveScoreBtn.textContent = 'SAVE';
        }, 800);
    });

    async function loadScores() {
        try {
            const res = await fetch('/api/scores');
            const list = await res.json();
            scoreList.innerHTML = '';
            if (list.length === 0) {
                scoreList.innerHTML = '<li><span>--</span><span>0000</span></li>';
                return;
            }
            list.slice(0, 10).forEach((s, i) => {
                const li = document.createElement('li');
                li.innerHTML = `<span>${i + 1}. ${s.name}</span><span>${String(s.score).padStart(4, '0')}</span>`;
                scoreList.appendChild(li);
            });
        } catch (e) { /* ignore */ }
    }

    try {
        const saved = parseInt(localStorage.getItem('si_hiscore') || '0', 10);
        if (!isNaN(saved)) state.hiscore = saved;
    } catch (e) {}

    initStars();
    updateHud();
    loadScores();
    loop();
})();
