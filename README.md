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

## sell.do — mark placed calls answered

**`POST /sell-do/mark-placed-answered`** (Bearer `BEARER_TOKEN` required)

Body: `{ "api_key": "…", "client_id": "…" }` (sell.do credentials). The server:

1. Lists **placed** calls (paginated) with default **IST** date range (≈ last 30 days through tomorrow), same filters as your Postman `calls.json` query.
2. For each call: **PUT** new `remote_id` on `…/leads/{lead_id}/calls/{call_id}`.
3. **POST** IVR `mcube_v2` with `status: CONNECTED` and `total_duration`.

Optional JSON fields: `date_range_start`, `date_range_end` (`DD-MM-YYYY`), `per_page`, `ivr_total_duration`, `delay_ms`.

Override base URL: env `SELL_DO_BASE_URL` (default `https://v2.sell.do`).

## Project structure

| Path | Role |
|------|------|
| `config/env.js` | `PORT`, dotenv |
| `config/auth.js` | Reads `process.env.BEARER_TOKEN` |
| `middleware/bearerAuth.js` | Validates `Authorization: Bearer` |
| `services/sellDoMarkAnsweredService.js` | sell.do list → PUT remote_id → IVR |
| `routes/sellDoRoutes.js` | `POST /sell-do/mark-placed-answered` |

## License

ISC
