# Data API (Express, in-memory)

Production-oriented REST API for storing arbitrary JSON in memory, with API-key auth, India Standard Time (IST) logging, and a layout that you can later swap the service layer for a database.

## Features

- **POST /data** — store JSON, returns auto-incremented `index` (201, `Location` header)
- **GET /data** — list all stored index ids
- **GET /data/all** — full dump: `{ "1": …, "2": … }`
- **GET /data/:index** — fetch one document
- **PUT /data/:index** — replace a document
- **DELETE /data/:index** — remove a document
- All **`/data/*`** routes require header **`x-api-key`**
- **GET /health** and **GET /** are public (for Railway liveness and discovery)

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

1. **Install**

   ```bash
   npm install
   ```

2. **Environment**

   ```bash
   cp .env.example .env
   # Edit .env and set API_KEY to a long random string
   ```

   Or export in the shell:

   ```bash
   set API_KEY=your-secret-key
   npm start
   ```

3. **Run**

   ```bash
   npm start
   ```

   Listens on `http://0.0.0.0:3000` by default, or `process.env.PORT`.

4. **Example (curl)**

   ```bash
   set KEY=your-secret-key
   curl -s -H "x-api-key: %KEY%" -H "Content-Type: application/json" -d "{\"a\":1}" http://127.0.0.1:3000/data
   curl -s -H "x-api-key: %KEY%" http://127.0.0.1:3000/data
   ```

## Railway deployment

1. Create a **New Project** → **Deploy from GitHub** (or empty repo) and connect this app root (where `package.json` and `server.js` live).
2. Railway will run **`npm start`** and install dependencies via Nixpacks.
3. In **Variables**, add **`API_KEY`** (long random string, e.g. `openssl rand -hex 32`).  
   - If you deploy **without** `API_KEY` while `NODE_ENV=production`, the process **still starts** (no crash): `GET /` and `GET /health` work, but **`/data/*` returns HTTP 503** with a clear message until you add `API_KEY` and redeploy.
   - `NODE_ENV=production` is optional; Railway often sets it automatically.

4. `PORT` is set automatically; do not override unless you know what you are doing.
5. After deploy, open `https://<name>.up.railway.app/health` — you should see `status: "success"`.
6. All **`/data`** calls require a configured **`API_KEY`** and must include:

   ```http
   x-api-key: <your API_KEY from Railway>
   Content-Type: application/json
   ```

7. For **Private Networking** or health checks, use **GET /health** (no API key) so the platform can verify the process without exposing secrets.

## Project structure

| Path                 | Role |
|----------------------|------|
| `server.js`          | Process entry, `listen`, graceful `SIGTERM` / `SIGINT` |
| `app.js`             | Express app, global middleware, routes |
| `config/env.js`      | `PORT`, `API_KEY`, environment flags |
| `routes/`            | HTTP layer |
| `controllers/`       | Request validation + HTTP status codes |
| `services/dataService.js` | In-memory store (replace with DB later) |
| `middleware/`        | API key, logging, errors |
| `utils/`             | Time (IST), response envelope, `AppError` |

## Extending to a database

Keep `dataService`’s public methods as the single boundary; reimplement them with your ORM/DB, then the routes/controllers can stay the same.

## Troubleshooting `SERVICE_NOT_CONFIGURED` (503 on `/data`)

This means the **Railway service** has no usable API key in the environment (or it is empty).

1. Railway → your project → **NG-Rock** (or your service) → **Variables**.
2. **Add** a variable: **Name:** `API_KEY` — **Value:** a long random string (e.g. 32+ chars). Save.  
   If you previously used the typo **`APT_KEY`**, the app now accepts that name as a fallback; renaming to **`API_KEY`** is still recommended.
3. **Redeploy** the service (Deployments → Redeploy) so the new variable is loaded.
4. In your **client** (curl, Postman, app), send the **same** value in the header: `x-api-key: <that value>`.

Check **GET `/health`**: `data.dataApiReady` should be `true` after the server env is correct. The key in Variables and the `x-api-key` header must **match** (they are not two different things—one is server config, one is the client proving it knows the secret).

## License

ISC
