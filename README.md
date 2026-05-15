# Space Invaders

A classic Space Invaders clone built with Spring Boot (Java 17) and HTML5 Canvas. Designed to be containerized and deployed to Render in a couple of clicks.

## Features

- Classic Space Invaders gameplay: 5 rows x 11 columns of aliens, formation step movement, descending after edges, multiple waves with increasing difficulty
- Player ship with 3 lives, single bullet on-screen at a time
- Destructible barriers (4 shields)
- Mystery UFO with random bonus points (50/100/150/300)
- Sound effects (Web Audio API)
- Local high-score persistence + server-side top-10 leaderboard via REST
- Keyboard + touch controls (mobile-friendly)

## Controls

- Move: Arrow keys (or A / D)
- Fire: Space (or Up arrow)
- Pause: P
- Mobile: tap left/right of the ship to move, tap top half of screen to fire

## Run locally

```bash
./mvnw spring-boot:run     # or: mvn spring-boot:run
```

Then open http://localhost:8080

## Build the jar

```bash
mvn clean package
java -jar target/spaceinvaders.jar
```

## Docker

```bash
docker build -t spaceinvaders .
docker run -p 8080:8080 spaceinvaders
```

## Deploy to Render

1. Push this repository to GitHub.
2. In Render, click **New +** -> **Web Service** and connect the repo.
3. Render auto-detects `render.yaml`. Confirm the service:
   - Runtime: Docker
   - Plan: Free
   - Health Check Path: `/`
4. Click **Create Web Service**. Render builds the Dockerfile and starts the app on the `$PORT` it injects (the Spring Boot app honors it).

Alternatively, click **New +** -> **Blueprint** and point it at the repo - Render reads `render.yaml` automatically.

## REST API

- `GET  /api/scores` - returns top-10 leaderboard
- `POST /api/scores` - body: `{ "name": "AAA", "score": 1234 }`

Note: leaderboard is in-memory and resets on redeploy.
