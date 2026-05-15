# Galaga

A Galaga clone built with Spring Boot (Java 17) and HTML5 Canvas. Containerized for one-click deployment to Render.

## Features

- **Swooping formation entrances** — enemies fly in along curved bezier paths from off-screen and slot into a 5-row formation (4 Boss Galagas, 16 Butterflies, 20 Bees)
- **Diving attacks** — enemies break formation in waves, swoop down, fire aimed shots, then loop back to their slot
- **Tractor beam capture** — Boss Galagas occasionally descend and try to capture your fighter with a tractor beam
- **Dual fighter rescue** — destroy the boss holding your captured ship to recover it and gain twin-fighter firepower
- **Challenging stages** — every 3rd stage, enemies fly through in pure-bonus patterns without firing
- **Stage progression** with increasing difficulty
- **Multicolor parallax starfield**
- **Score popups, explosions, sound effects** (Web Audio API)
- **Server-side top-10 leaderboard** with stage tracking + local high-score persistence
- **Keyboard + touch controls** (mobile-friendly)

## Controls

- Move: Arrow keys (or A / D)
- Fire: Space (or Up arrow)
- Pause: P
- Mobile: tap left/right of the ship to move; tap top half of screen to fire

## Scoring

| Enemy       | In Formation | Diving |
|-------------|--------------|--------|
| Bee         | 50           | 100    |
| Butterfly   | 80           | 160    |
| Boss Galaga | 150          | 400    |

Bonus: 1000 points for clearing a challenging stage cleanly.

## Run locally

```bash
mvn spring-boot:run
```

Then open http://localhost:8080

## Build the jar

```bash
mvn clean package
java -jar target/galaga.jar
```

## Docker

```bash
docker build -t galaga .
docker run -p 8080:8080 galaga
```

## Deploy to Render

1. Push this repository to GitHub.
2. In Render, click **New +** → **Blueprint** and connect the repo. Render reads `render.yaml` and provisions the Docker web service automatically.
   - Runtime: Docker
   - Plan: Free
   - Health Check Path: `/`
3. Click **Apply**. Render builds the Dockerfile and starts the app on its injected `$PORT` (the Spring Boot app honors it).

Alternative: **New +** → **Web Service**, pick the repo, choose "Docker" runtime, and Render still picks up the Dockerfile.

## REST API

- `GET  /api/scores` — returns the top-10 leaderboard
- `POST /api/scores` — body: `{ "name": "AAA", "score": 12345, "stage": 4 }`

Note: leaderboard is in-memory and resets on redeploy.
