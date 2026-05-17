(() => {
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    const scoreEl = document.getElementById('score');
    const hiscoreEl = document.getElementById('hiscore');
    const stageEl = document.getElementById('stage');
    const livesEl = document.getElementById('lives');
    const overlay = document.getElementById('overlay');
    const gameOverEl = document.getElementById('gameOver');
    const gameOverTitle = document.getElementById('gameOverTitle');
    const finalScoreEl = document.getElementById('finalScore');
    const finalStageEl = document.getElementById('finalStage');
    const startBtn = document.getElementById('startBtn');
    const restartBtn = document.getElementById('restartBtn');
    const saveScoreBtn = document.getElementById('saveScoreBtn');
    const playerName = document.getElementById('playerName');
    const scoreList = document.getElementById('scoreList');
    const stageBanner = document.getElementById('stageBanner');
    const stageText = document.getElementById('stageText');

    const COLS = 10;
    const ROWS = 5;
    const CELL_W = 36;
    const CELL_H = 36;
    const FORMATION_TOP = 90;
    const FORMATION_LEFT = (W - COLS * CELL_W) / 2 + CELL_W / 2;

    // sprite pixel arts
    const SPR = {
        player: [
            '....X....',
            '....X....',
            '...XXX...',
            '...XXX...',
            '..XXXXX..',
            'X.XXXXX.X',
            'X.XXXXX.X',
            'XXXXXXXXX',
            'XXX.X.XXX'
        ],
        bee: [
            '..X...X..',
            '...X.X...',
            '..XXXXX..',
            '.XX.X.XX.',
            'XXXXXXXXX',
            'X.XXXXX.X',
            '.X.X.X.X.',
            '.X.....X.'
        ],
        butterfly: [
            '.X.....X.',
            '..X...X..',
            '.XXX.XXX.',
            'XX.XXX.XX',
            'XXXXXXXXX',
            'XX.XXX.XX',
            '.XXXXXXX.',
            '.X.X.X.X.'
        ],
        boss: [
            '...XXX...',
            '..XXXXX..',
            '.XXXXXXX.',
            'XX.XXX.XX',
            'XX.XXX.XX',
            'XXXXXXXXX',
            '.XX.X.XX.',
            'X.X...X.X'
        ],
        explosion0: [
            '....X....',
            '..X.X.X..',
            '.X.XXX.X.',
            '..XXXXX..',
            'XXXXXXXXX',
            '..XXXXX..',
            '.X.XXX.X.',
            '..X.X.X..',
            '....X....'
        ],
        explosion1: [
            'X...X...X',
            '..X.X.X..',
            '.........',
            '...XXX...',
            'X.XXXXX.X',
            '...XXX...',
            '.........',
            '..X.X.X..',
            'X...X...X'
        ]
    };

    const ENEMY_TYPES = {
        bee:       { sprite: SPR.bee,       color: '#0af', points: { formation: 50,  diving: 100 }, hp: 1 },
        butterfly: { sprite: SPR.butterfly, color: '#ff3', points: { formation: 80,  diving: 160 }, hp: 1 },
        boss:      { sprite: SPR.boss,      color: '#f33', points: { formation: 150, diving: 400 }, hp: 2 }
    };

    const state = {
        running: false,
        paused: false,
        score: 0,
        hiscore: 0,
        stage: 1,
        lives: 2,
        player: null,
        captured: null,        // captured ship awaiting rescue
        dual: false,           // dual fighter active
        enemies: [],
        bullets: [],
        enemyBullets: [],
        beam: null,            // active tractor beam
        stars: [],
        explosions: [],
        popups: [],
        keys: {},
        spawnQueue: [],
        spawnTimer: 0,
        diveTimer: 0,
        respawnTimer: 0,
        flashFrames: 0,
        challenging: false,
        stageDone: false,
        stageStart: 0
    };

    function rand(min, max) { return min + Math.random() * (max - min); }
    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

    function drawSprite(sprite, x, y, scale, color) {
        ctx.fillStyle = color;
        for (let r = 0; r < sprite.length; r++) {
            const line = sprite[r];
            for (let c = 0; c < line.length; c++) {
                if (line[c] === 'X') ctx.fillRect(x + c * scale, y + r * scale, scale, scale);
            }
        }
    }

    function drawCenteredSprite(sprite, cx, cy, scale, color, angle) {
        const w = sprite[0].length * scale;
        const h = sprite.length * scale;
        if (angle) {
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(angle);
            drawSprite(sprite, -w / 2, -h / 2, scale, color);
            ctx.restore();
        } else {
            drawSprite(sprite, cx - w / 2, cy - h / 2, scale, color);
        }
    }

    function initStars() {
        state.stars = [];
        for (let i = 0; i < 80; i++) {
            state.stars.push({
                x: Math.random() * W,
                y: Math.random() * H,
                s: Math.random() * 1.5 + 0.3,
                v: Math.random() * 0.8 + 0.2,
                color: pick(['#fff', '#ff3', '#0af', '#f3f', '#3f3'])
            });
        }
    }

    function formationSlot(col, row) {
        return {
            x: FORMATION_LEFT + col * CELL_W,
            y: FORMATION_TOP + row * CELL_H
        };
    }

    function enemyTypeForRow(row) {
        if (row === 0) return 'boss';
        if (row <= 2) return 'butterfly';
        return 'bee';
    }

    // Build a bezier path entrance. Returns array of {x,y} sampled points.
    function buildEntryPath(fromSide, targetX, targetY) {
        const points = [];
        const startX = fromSide === 'left' ? -40 : W + 40;
        const startY = rand(80, 200);
        // Two control points for a swooping loop
        const cp1 = {
            x: fromSide === 'left' ? rand(80, 180) : rand(W - 180, W - 80),
            y: rand(H * 0.55, H * 0.75)
        };
        const cp2 = {
            x: fromSide === 'left' ? rand(W - 200, W - 100) : rand(100, 200),
            y: rand(H * 0.35, H * 0.55)
        };
        const steps = 80;
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const u = 1 - t;
            const x = u * u * u * startX + 3 * u * u * t * cp1.x + 3 * u * t * t * cp2.x + t * t * t * targetX;
            const y = u * u * u * startY + 3 * u * u * t * cp1.y + 3 * u * t * t * cp2.y + t * t * t * targetY;
            points.push({ x, y });
        }
        return points;
    }

    function buildDivePath(startX, startY, type) {
        const points = [];
        // Dive that swings down past the player and exits bottom
        const cp1 = { x: startX + rand(-150, 150), y: startY + rand(120, 200) };
        const cp2 = { x: rand(40, W - 40), y: rand(H * 0.55, H * 0.75) };
        const endX = rand(-60, W + 60);
        const endY = H + 80;
        const steps = 90;
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const u = 1 - t;
            const x = u * u * u * startX + 3 * u * u * t * cp1.x + 3 * u * t * t * cp2.x + t * t * t * endX;
            const y = u * u * u * startY + 3 * u * u * t * cp1.y + 3 * u * t * t * cp2.y + t * t * t * endY;
            points.push({ x, y });
        }
        return points;
    }

    // Boss capture dive: descends to mid-screen and emits tractor beam
    function buildCaptureDivePath(startX, startY) {
        const points = [];
        const targetX = state.player ? state.player.x : W / 2;
        const targetY = H * 0.55;
        const cp1 = { x: startX, y: startY + 150 };
        const cp2 = { x: targetX, y: targetY - 60 };
        const steps = 70;
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const u = 1 - t;
            const x = u * u * u * startX + 3 * u * u * t * cp1.x + 3 * u * t * t * cp2.x + t * t * t * targetX;
            const y = u * u * u * startY + 3 * u * u * t * cp1.y + 3 * u * t * t * cp2.y + t * t * t * targetY;
            points.push({ x, y });
        }
        return points;
    }

    function createPlayer() {
        return {
            x: W / 2,
            y: H - 70,
            w: 36,
            h: 36,
            speed: 4.2,
            cooldown: 0,
            invuln: 60,
            captured: false
        };
    }

    function spawnFormation() {
        state.enemies = [];
        state.spawnQueue = [];
        state.bullets = [];
        state.enemyBullets = [];
        state.beam = null;
        state.stageDone = false;
        state.stageStart = performance.now();

        // Build spawn queue: groups of 4 enemies alternating left/right entries
        const groups = [];
        // Bosses (row 0) — 4 enemies, only 8 slots used (center)
        for (let i = 0; i < 4; i++) groups.push({ col: 1 + i * 2, row: 0, side: i % 2 === 0 ? 'left' : 'right' });
        // Butterflies rows 1-2
        for (let r = 1; r <= 2; r++) {
            for (let c = 0; c < COLS; c++) groups.push({ col: c, row: r, side: c < COLS / 2 ? 'left' : 'right' });
        }
        // Bees rows 3-4
        for (let r = 3; r <= 4; r++) {
            for (let c = 0; c < COLS; c++) groups.push({ col: c, row: r, side: c < COLS / 2 ? 'right' : 'left' });
        }

        // Stagger entries — every ~14 frames spawn next
        let delay = 40;
        for (const g of groups) {
            state.spawnQueue.push({ ...g, delay });
            delay += 12;
        }
        state.spawnTimer = 0;
    }

    function spawnNextEnemy() {
        if (state.spawnQueue.length === 0) return;
        const g = state.spawnQueue[0];
        if (state.spawnTimer < g.delay) return;
        state.spawnQueue.shift();

        const slot = formationSlot(g.col, g.row);
        const type = enemyTypeForRow(g.row);
        const path = buildEntryPath(g.side, slot.x, slot.y);
        state.enemies.push({
            type,
            def: ENEMY_TYPES[type],
            col: g.col,
            row: g.row,
            slotX: slot.x,
            slotY: slot.y,
            x: path[0].x,
            y: path[0].y,
            angle: 0,
            state: state.challenging ? 'challenge' : 'entering',
            path,
            pathIdx: 0,
            pathSpeed: 1.0 + state.stage * 0.05,
            hp: ENEMY_TYPES[type].hp,
            wing: 0,
            wingTimer: Math.floor(Math.random() * 30),
            hasCaptive: false
        });

        if (state.challenging) {
            // In challenging stages, give each enemy a dive path after entry instead of stopping
            const last = state.enemies[state.enemies.length - 1];
            last.afterEntry = 'dive';
        }
    }

    function resetGame() {
        state.score = 0;
        state.stage = 1;
        state.lives = 2;
        state.player = createPlayer();
        state.dual = false;
        state.captured = null;
        state.explosions = [];
        state.popups = [];
        state.flashFrames = 0;
        state.challenging = false;
        startStage();
        updateHud();
    }

    function startStage() {
        state.challenging = (state.stage % 3 === 0);
        spawnFormation();
        showStageBanner();
    }

    function showStageBanner() {
        stageText.textContent = state.challenging ? `CHALLENGING STAGE ${state.stage}` : `STAGE ${state.stage}`;
        stageBanner.classList.remove('hidden');
        setTimeout(() => stageBanner.classList.add('hidden'), 1500);
    }

    function updateHud() {
        scoreEl.textContent = String(state.score).padStart(5, '0');
        hiscoreEl.textContent = String(Math.max(state.hiscore, state.score)).padStart(5, '0');
        stageEl.textContent = state.stage;
        livesEl.textContent = Math.max(0, state.lives);
    }

    function shoot() {
        if (!state.player || state.player.cooldown > 0 || state.player.captured) return;
        const maxBullets = state.dual ? 4 : 2;
        if (state.bullets.length >= maxBullets) return;
        if (state.dual) {
            state.bullets.push({ x: state.player.x - 14, y: state.player.y - 18, w: 3, h: 14, vy: -10 });
            state.bullets.push({ x: state.player.x + 11, y: state.player.y - 18, w: 3, h: 14, vy: -10 });
        } else {
            state.bullets.push({ x: state.player.x - 2, y: state.player.y - 18, w: 3, h: 14, vy: -10 });
        }
        state.player.cooldown = 10;
        playSound(900, 0.05, 'square');
    }

    function enemyFire(e) {
        if (state.challenging) return;
        if (!state.player || state.player.captured) return;
        const sx = e.x;
        const sy = e.y + 12;
        const px = state.player.x;
        const py = state.player.y;
        const dx = px - sx;
        const dy = py - sy;
        const d = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const speed = 2.8 + state.stage * 0.1;
        state.enemyBullets.push({
            x: sx, y: sy, w: 4, h: 10,
            vx: (dx / d) * speed,
            vy: (dy / d) * speed
        });
    }

    function explosion(x, y, big, color) {
        state.explosions.push({ x, y, life: big ? 30 : 18, big: !!big, color: color || '#ff3' });
        playSound(big ? 80 : 200, big ? 0.4 : 0.15, 'sawtooth');
    }

    function popup(x, y, text, color) {
        state.popups.push({ x, y, text, color: color || '#ff3', life: 40 });
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

    function rectsCollide(a, b) {
        return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }

    // Pulse the formation slowly side to side
    function formationOffset() {
        const t = (performance.now() - state.stageStart) / 1500;
        return Math.sin(t) * 24;
    }

    function startDive(e) {
        const isBoss = e.type === 'boss';
        const canCapture = isBoss && !state.dual && !state.captured && Math.random() < 0.35;
        if (canCapture) {
            e.state = 'capture-dive';
            e.path = buildCaptureDivePath(e.x, e.y);
            e.pathIdx = 0;
            e.beamTimer = 0;
        } else {
            e.state = 'diving';
            e.path = buildDivePath(e.x, e.y, e.type);
            e.pathIdx = 0;
            // Pick a butterfly wingman for bosses occasionally
            if (isBoss && Math.random() < 0.5) {
                const wingmen = state.enemies.filter(x => x.type === 'butterfly' && x.state === 'formation');
                for (let i = 0; i < Math.min(2, wingmen.length); i++) {
                    const w = wingmen[Math.floor(Math.random() * wingmen.length)];
                    if (w.state === 'formation') {
                        w.state = 'diving';
                        w.path = buildDivePath(w.x, w.y, w.type);
                        w.pathIdx = 0;
                    }
                }
            }
        }
    }

    function updateEnemy(e) {
        e.wingTimer++;
        if (e.wingTimer >= 22) { e.wing ^= 1; e.wingTimer = 0; }

        if (e.state === 'entering' || e.state === 'challenge') {
            const next = e.path[e.pathIdx + Math.floor(e.pathSpeed)];
            const cur = e.path[e.pathIdx];
            if (next) e.angle = Math.atan2(next.y - cur.y, next.x - cur.x) + Math.PI / 2;
            e.pathIdx += e.pathSpeed;
            const idx = Math.floor(e.pathIdx);
            if (idx >= e.path.length - 1) {
                if (e.state === 'challenge' || e.afterEntry === 'dive') {
                    // continue into a dive path that exits the bottom
                    e.path = buildDivePath(e.x, e.y, e.type);
                    e.pathIdx = 0;
                    e.state = 'diving';
                } else {
                    e.state = 'formation';
                    e.angle = 0;
                }
                return;
            }
            e.x = e.path[idx].x;
            e.y = e.path[idx].y;
        } else if (e.state === 'formation') {
            const offset = formationOffset();
            e.x = e.slotX + offset;
            e.y = e.slotY;
            e.angle = 0;
            // Occasionally fire while in formation
            if (!state.challenging && Math.random() < 0.0004 + state.stage * 0.0001) {
                enemyFire(e);
            }
        } else if (e.state === 'diving' || e.state === 'capture-dive') {
            const cur = e.path[Math.floor(e.pathIdx)];
            const next = e.path[Math.floor(e.pathIdx) + 2];
            if (next) e.angle = Math.atan2(next.y - cur.y, next.x - cur.x) + Math.PI / 2;
            e.pathIdx += e.pathSpeed * 0.75;

            if (e.state === 'capture-dive') {
                // Halt mid-screen to deploy tractor beam
                const idx = Math.floor(e.pathIdx);
                if (idx >= e.path.length - 1) {
                    // hover briefly then beam
                    e.state = 'beaming';
                    e.beamTimer = 0;
                    state.beam = {
                        boss: e,
                        x: e.x,
                        y: e.y + 18,
                        progress: 0,
                        active: true
                    };
                    playSound(180, 0.6, 'sawtooth');
                    return;
                }
                e.x = e.path[idx].x;
                e.y = e.path[idx].y;
            } else {
                // diving - fire occasionally
                if (!state.challenging && Math.random() < 0.012 && e.y < H - 80) {
                    enemyFire(e);
                }
                const idx = Math.floor(e.pathIdx);
                if (idx >= e.path.length - 1) {
                    // Return to formation from top
                    e.state = 'returning';
                    e.x = (e.slotX < W / 2) ? -30 : W + 30;
                    e.y = 30;
                    return;
                }
                e.x = e.path[idx].x;
                e.y = e.path[idx].y;
            }
        } else if (e.state === 'beaming') {
            e.beamTimer++;
            if (state.beam) {
                state.beam.x = e.x;
                state.beam.progress = Math.min(1, e.beamTimer / 90);
            }
            // attempt capture
            if (state.beam && state.beam.progress >= 0.6 && state.player && !state.player.captured && !state.captured) {
                const beamWidth = 36;
                if (Math.abs(state.player.x - e.x) < beamWidth / 2 && state.player.y > e.y) {
                    capturePlayer(e);
                }
            }
            if (e.beamTimer > 220) {
                // retreat with or without captive
                e.state = 'returning-capture';
                state.beam = null;
                playSound(120, 0.4, 'sawtooth');
            }
        } else if (e.state === 'returning' || e.state === 'returning-capture') {
            // Fly back to formation slot
            const offset = formationOffset();
            const tx = e.slotX + offset;
            const ty = e.slotY;
            const dx = tx - e.x;
            const dy = ty - e.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            const speed = 3.5;
            if (d < speed) {
                e.x = tx; e.y = ty;
                e.state = 'formation';
                e.angle = 0;
            } else {
                e.x += (dx / d) * speed;
                e.y += (dy / d) * speed;
                e.angle = Math.atan2(dy, dx) + Math.PI / 2;
            }
        }
    }

    function capturePlayer(boss) {
        if (!state.player) return;
        state.player.captured = true;
        state.captured = { boss, alive: true };
        boss.hasCaptive = true;
        playSound(200, 0.8, 'triangle');
        popup(state.player.x, state.player.y - 20, 'CAPTURED!', '#f3f');
        // Player is consumed (one life lost), but we keep the captured ship attached to boss
        state.player = null;
        state.lives--;
        if (state.lives < 0) {
            // give a moment then game over
            setTimeout(() => gameOver(false), 1500);
        } else {
            state.respawnTimer = 90;
        }
    }

    function spawnDives() {
        if (state.spawnQueue.length > 0) return;
        if (state.beam) return;
        const formation = state.enemies.filter(e => e.state === 'formation');
        if (formation.length === 0) return;
        state.diveTimer++;
        const interval = Math.max(110, 210 - state.stage * 5);
        if (state.diveTimer >= interval) {
            state.diveTimer = 0;
            // Prefer lower rows first (bees / butterflies)
            const candidates = formation.sort((a, b) => b.row - a.row);
            const diver = candidates[Math.floor(Math.random() * Math.min(candidates.length, 6))];
            if (diver) startDive(diver);
        }
    }

    function update() {
        if (!state.running || state.paused) return;

        for (const s of state.stars) {
            s.y += s.v;
            if (s.y > H) { s.y = 0; s.x = Math.random() * W; }
        }

        // spawn queue
        if (state.spawnQueue.length > 0) {
            state.spawnTimer++;
            while (state.spawnQueue.length > 0 && state.spawnTimer >= state.spawnQueue[0].delay) {
                spawnNextEnemy();
            }
        }

        // player
        if (state.respawnTimer > 0) {
            state.respawnTimer--;
            if (state.respawnTimer === 0 && state.lives >= 0) {
                state.player = createPlayer();
            }
        } else if (state.player && !state.player.captured) {
            if (state.keys.left) state.player.x -= state.player.speed;
            if (state.keys.right) state.player.x += state.player.speed;
            const halfW = state.dual ? 30 : 18;
            state.player.x = Math.max(halfW, Math.min(W - halfW, state.player.x));
            if (state.player.cooldown > 0) state.player.cooldown--;
            if (state.player.invuln > 0) state.player.invuln--;
            if (state.keys.fire) shoot();
        }

        // enemies
        for (const e of state.enemies) updateEnemy(e);

        // diving logic
        if (!state.challenging) spawnDives();

        // player bullets
        for (let i = state.bullets.length - 1; i >= 0; i--) {
            const b = state.bullets[i];
            b.y += b.vy;
            if (b.y + b.h < 0) { state.bullets.splice(i, 1); continue; }
            let consumed = false;
            for (const e of state.enemies) {
                if (e.state === 'returning' || e.state === 'returning-capture') continue;
                const half = (e.type === 'boss') ? 16 : 14;
                const box = { x: e.x - half, y: e.y - half, w: half * 2, h: half * 2 };
                if (rectsCollide(b, box)) {
                    e.hp--;
                    if (e.hp <= 0) {
                        // points and special handling
                        const diving = (e.state === 'diving' || e.state === 'capture-dive' || e.state === 'beaming' || e.state === 'challenge');
                        const pts = diving ? e.def.points.diving : e.def.points.formation;
                        state.score += pts;
                        popup(e.x, e.y, String(pts), e.def.color);
                        explosion(e.x, e.y, e.type === 'boss', e.def.color);
                        if (e.state === 'beaming' && state.beam && state.beam.boss === e) {
                            state.beam = null;
                        }
                        if (e.hasCaptive) {
                            rescueCaptive(e);
                        }
                        // remove
                        const idx = state.enemies.indexOf(e);
                        state.enemies.splice(idx, 1);
                    } else {
                        // boss damaged turns from red to blue indication
                        e.def = { ...e.def, color: '#0af' };
                        playSound(440, 0.05, 'triangle');
                    }
                    state.bullets.splice(i, 1);
                    consumed = true;
                    break;
                }
            }
            if (consumed) continue;
        }

        // enemy bullets
        for (let i = state.enemyBullets.length - 1; i >= 0; i--) {
            const b = state.enemyBullets[i];
            b.x += b.vx;
            b.y += b.vy;
            if (b.y > H + 20 || b.x < -20 || b.x > W + 20) { state.enemyBullets.splice(i, 1); continue; }
            if (state.player && !state.player.captured && state.player.invuln === 0) {
                const box = { x: state.player.x - 14, y: state.player.y - 14, w: 28, h: 28 };
                if (rectsCollide(b, box)) {
                    state.enemyBullets.splice(i, 1);
                    playerHit();
                    continue;
                }
                // dual hit area
                if (state.dual) {
                    const box2 = { x: state.player.x + 14, y: state.player.y - 14, w: 28, h: 28 };
                    if (rectsCollide(b, box2)) {
                        state.enemyBullets.splice(i, 1);
                        playerHit();
                        continue;
                    }
                }
            }
        }

        // enemy collision with player
        if (state.player && !state.player.captured && state.player.invuln === 0) {
            for (const e of state.enemies) {
                if (e.state !== 'diving' && e.state !== 'challenge' && e.state !== 'capture-dive') continue;
                const half = 14;
                const dx = e.x - state.player.x;
                const dy = e.y - state.player.y;
                if (Math.abs(dx) < half + 14 && Math.abs(dy) < half + 14) {
                    // both die
                    explosion(e.x, e.y, false, e.def.color);
                    state.score += e.def.points.diving;
                    popup(e.x, e.y, String(e.def.points.diving), e.def.color);
                    state.enemies.splice(state.enemies.indexOf(e), 1);
                    playerHit();
                    break;
                }
            }
        }

        // explosions
        for (let i = state.explosions.length - 1; i >= 0; i--) {
            state.explosions[i].life--;
            if (state.explosions[i].life <= 0) state.explosions.splice(i, 1);
        }
        // popups
        for (let i = state.popups.length - 1; i >= 0; i--) {
            state.popups[i].life--;
            state.popups[i].y -= 0.5;
            if (state.popups[i].life <= 0) state.popups.splice(i, 1);
        }

        // stage clear check
        if (!state.stageDone && state.spawnQueue.length === 0 && state.enemies.length === 0) {
            state.stageDone = true;
            if (state.challenging) {
                // bonus per remaining or just stage complete
                state.score += 1000;
                popup(W / 2, H / 2, 'PERFECT! +1000', '#ff3');
            }
            setTimeout(() => {
                if (!state.running) return;
                state.stage++;
                startStage();
                updateHud();
            }, 1800);
        }

        updateHud();
    }

    function rescueCaptive(boss) {
        // captured ship freed — falls back to player as dual fighter
        if (state.captured && state.captured.boss === boss && state.player && !state.player.captured) {
            state.dual = true;
            popup(state.player.x, state.player.y - 30, 'DUAL FIGHTER!', '#ff3');
            playSound(660, 0.2, 'triangle');
        }
        state.captured = null;
    }

    function playerHit() {
        if (!state.player) return;
        explosion(state.player.x, state.player.y, true, '#fff');
        if (state.dual) {
            state.dual = false;
            state.player.invuln = 90;
            popup(state.player.x, state.player.y - 20, 'WINGMAN LOST', '#f33');
            return;
        }
        state.player = null;
        state.lives--;
        if (state.lives < 0) {
            setTimeout(() => gameOver(true), 1200);
        } else {
            state.respawnTimer = 90;
        }
    }

    function gameOver() {
        state.running = false;
        if (state.score > state.hiscore) state.hiscore = state.score;
        try { localStorage.setItem('galaga_hiscore', state.hiscore); } catch (e) {}
        gameOverTitle.textContent = 'GAME OVER';
        finalScoreEl.textContent = state.score;
        finalStageEl.textContent = state.stage;
        gameOverEl.classList.remove('hidden');
        playerName.value = '';
        setTimeout(() => playerName.focus(), 100);
        updateHud();
    }

    function draw() {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);

        // stars
        for (const s of state.stars) {
            ctx.fillStyle = s.color;
            ctx.globalAlpha = 0.4 + s.v * 0.5;
            ctx.fillRect(s.x, s.y, s.s, s.s);
        }
        ctx.globalAlpha = 1;

        // tractor beam
        if (state.beam && state.beam.boss) {
            const b = state.beam;
            const cx = b.x;
            const top = b.boss.y + 16;
            const bottom = top + (H - top) * b.progress;
            const widthTop = 6;
            const widthBot = 40;
            ctx.save();
            ctx.globalAlpha = 0.5 + Math.sin(performance.now() / 80) * 0.2;
            const grad = ctx.createLinearGradient(cx, top, cx, bottom);
            grad.addColorStop(0, 'rgba(255,255,80,0.7)');
            grad.addColorStop(0.5, 'rgba(80,180,255,0.45)');
            grad.addColorStop(1, 'rgba(255,80,255,0.25)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(cx - widthTop / 2, top);
            ctx.lineTo(cx + widthTop / 2, top);
            ctx.lineTo(cx + widthBot / 2, bottom);
            ctx.lineTo(cx - widthBot / 2, bottom);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
            // beam scan lines
            ctx.fillStyle = '#ff3';
            for (let yy = top; yy < bottom; yy += 12) {
                const ww = widthTop + (widthBot - widthTop) * ((yy - top) / (bottom - top));
                ctx.globalAlpha = 0.3;
                ctx.fillRect(cx - ww / 2, yy, ww, 1);
            }
            ctx.globalAlpha = 1;
        }

        // enemies
        for (const e of state.enemies) {
            const scale = e.type === 'boss' ? 3 : 3;
            drawCenteredSprite(e.def.sprite, e.x, e.y, scale, e.def.color, e.angle || 0);
            if (e.hasCaptive) {
                // captured ship sits below boss
                drawCenteredSprite(SPR.player, e.x, e.y + 28, 2, '#0f0', e.angle || 0);
            }
        }

        // player
        if (state.player && !state.player.captured) {
            const blink = state.player.invuln === 0 || Math.floor(state.player.invuln / 6) % 2 === 0;
            if (blink) {
                if (state.dual) {
                    drawCenteredSprite(SPR.player, state.player.x - 18, state.player.y, 3, '#0f0');
                    drawCenteredSprite(SPR.player, state.player.x + 18, state.player.y, 3, '#0f0');
                } else {
                    drawCenteredSprite(SPR.player, state.player.x, state.player.y, 3, '#0f0');
                }
            }
        }

        // bullets
        ctx.fillStyle = '#fff';
        for (const b of state.bullets) ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.fillStyle = '#f80';
        for (const b of state.enemyBullets) ctx.fillRect(b.x - b.w / 2, b.y, b.w, b.h);

        // explosions
        for (const e of state.explosions) {
            const sprite = (e.life > 9) ? SPR.explosion0 : SPR.explosion1;
            const scale = e.big ? 4 : 3;
            drawCenteredSprite(sprite, e.x, e.y, scale, e.color);
        }

        // popups
        ctx.font = 'bold 12px Courier New';
        ctx.textAlign = 'center';
        for (const p of state.popups) {
            ctx.globalAlpha = Math.min(1, p.life / 20);
            ctx.fillStyle = p.color;
            ctx.fillText(p.text, p.x, p.y);
        }
        ctx.globalAlpha = 1;

        // lives icons
        for (let i = 0; i < Math.max(0, state.lives); i++) {
            drawSprite(SPR.player, 8 + i * 22, H - 24, 2, '#0f0');
        }

        if (state.paused) {
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.fillRect(0, 0, W, H);
            ctx.fillStyle = '#f33';
            ctx.font = 'bold 42px Courier New';
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

    function touchHandler(e) {
        e.preventDefault();
        state.keys.left = state.keys.right = state.keys.fire = false;
        const rect = canvas.getBoundingClientRect();
        for (const t of e.touches) {
            const x = (t.clientX - rect.left) * (W / rect.width);
            const y = (t.clientY - rect.top) * (H / rect.height);
            if (y < H / 2) state.keys.fire = true;
            else if (state.player && x < state.player.x) state.keys.left = true;
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
                body: JSON.stringify({ name, score: state.score, stage: state.stage })
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
                scoreList.innerHTML = '<li><span>-- --</span><span>00000</span></li>';
                return;
            }
            list.slice(0, 10).forEach((s, i) => {
                const li = document.createElement('li');
                const stageTxt = s.stage ? ` (S${s.stage})` : '';
                li.innerHTML = `<span>${i + 1}. ${s.name}${stageTxt}</span><span>${String(s.score).padStart(5, '0')}</span>`;
                scoreList.appendChild(li);
            });
        } catch (e) { /* ignore */ }
    }

    try {
        const saved = parseInt(localStorage.getItem('galaga_hiscore') || '0', 10);
        if (!isNaN(saved)) state.hiscore = saved;
    } catch (e) {}

    initStars();
    updateHud();
    loadScores();
    loop();
})();
