# Congkak Game Backend

Authoritative Colyseus backend for Congkak Game.

## Local Development

```bash
npm install
npm run dev
```

The default backend URL is `http://localhost:2567`.

## HTTP Endpoints

- `GET /healthz`
- `POST /rooms`
- `GET /rooms/:code`

## Environment

Use `.env.example` as the reference. The committed `.env` contains local runnable values.

```bash
NODE_ENV=development
PORT=2567
CORS_ORIGINS=http://localhost:3000
MAX_ROOMS=100
TURN_TIMEOUT_DEFAULT=30
RECONNECT_GRACE_SEC=60
LOG_LEVEL=info
```

For Railway, replace `CORS_ORIGINS` with the Vercel frontend URL.

## Checks

```bash
npm run typecheck
npm test
npm run build
```
