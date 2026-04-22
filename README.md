# Data API (Express, in-memory)

REST API with **Bearer** auth. The secret is read only from the environment variable **`BEARER_TOKEN`** (set in **Railway → Variables** or a local `.env` file).

## Authentication

Send the same value as in `BEARER_TOKEN`:

```http
Authorization: Bearer <your BEARER_TOKEN value>
```

**Public:** `GET /`, `GET /health` (no auth).  
**Health** includes `data.dataApiReady: true` when `BEARER_TOKEN` is set.

If `BEARER_TOKEN` is missing, **`/data/*` returns 503** until you set the variable and redeploy.

## Features

- **POST /data** — store JSON (201, `Location`)
- **GET /data** — list indexes
- **GET /data/all** — full dump
- **GET /data/:index** — one record
- **PUT /data/:index** — replace
- **DELETE /data/:index** — delete one
- **DELETE /data** — remove **all** data and reset ids
- **GET /data/latest** — `maxIndex`, `latestUpdatedIndex`, `count`, `nextIndex`

## Local setup

```bash
cp .env.example .env
# Edit .env and set BEARER_TOKEN
npm install
npm start
```

## Railway

1. **Variables** → add **`BEARER_TOKEN`** = a long random string (e.g. `openssl rand -hex 32`).
2. **Redeploy** so the process receives the variable.
3. In Postman/curl, **Authorization → Bearer Token** with the **same** value.

`PORT` is set automatically. No other auth variables are required.

## Project structure

| Path | Role |
|------|------|
| `config/env.js` | `PORT`, dotenv |
| `config/auth.js` | Reads `process.env.BEARER_TOKEN` |
| `middleware/bearerAuth.js` | Validates `Authorization: Bearer` |

## License

ISC
