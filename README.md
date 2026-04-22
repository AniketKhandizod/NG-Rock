# Data API (Express, in-memory)

REST API for storing arbitrary JSON in memory, **Bearer token** auth (token set in code), IST logging, and a layout you can later swap for a database.

## Authentication

All **`/data/*`** routes require:

```http
Authorization: Bearer amura@123#
```

The token is defined in **`config/auth.js`** (`BEARER_TOKEN`). It is **not** read from Railway environment variables. To change the password, edit that file and redeploy.

**Public:** `GET /`, `GET /health` (no auth).

## Features

- **POST /data** — store JSON, returns `index` (201, `Location` header)
- **GET /data** — list all index ids
- **GET /data/all** — full dump
- **GET /data/:index** — one document
- **PUT /data/:index** — replace
- **DELETE /data/:index** — delete

## Response format

```json
{
  "status": "success" | "error",
  "message": "…",
  "data": { } | null,
  "error": { } | null,
  "requestId": "…",
  "timestamp": "2026-04-22T16:00:00+05:30"
}
```

## Local setup

```bash
npm install
npm start
```

Listens on `http://0.0.0.0:3000` or `process.env.PORT`.

### Example (curl)

```bash
curl -s -X POST "http://127.0.0.1:3000/data" ^
  -H "Authorization: Bearer amura@123#" ^
  -H "Content-Type: application/json" ^
  -d "{\"a\":1}"
```

### Postman

- **Authorization** tab → Type **Bearer Token** → Token: `amura@123#`  
  Or **Headers**: `Authorization` = `Bearer amura@123#`

## Railway deployment

1. Connect the repo; Railway runs **`npm start`** and sets **`PORT`** automatically.
2. No API key variables are required for auth.
3. Open `https://<your-app>.up.railway.app/health` to verify the service is up.

## Project structure

| Path | Role |
|------|------|
| `config/auth.js` | Hardcoded `BEARER_TOKEN` for `/data` |
| `config/env.js` | `PORT`, `NODE_ENV` flags |
| `middleware/bearerAuth.js` | Validates `Authorization: Bearer` |
| `server.js` | Entry, graceful shutdown |

## Extending to a database

Keep `dataService`’s public methods as the boundary; swap the implementation for your ORM/DB.

## License

ISC
