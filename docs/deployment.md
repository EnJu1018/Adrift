# Adrift Deployment

## Apps

- Web build output comes from `apps/web`.
- API runtime comes from `apps/api`.
- iOS is built and released independently with Xcode from
  [Adrift-iOS](https://github.com/EnJu1018/Adrift-iOS).

The repository split does not change the VPS runtime, API routes, environment
variables or database. Removing native source needs no frontend rebuild or API
restart. Continue deploying only the web/API repository when those apps change.

## Web

```bash
cd apps/web
npm install
npm run build
```

Set `VITE_API_URL` in the web deployment environment.

The production Nginx configuration is versioned at
`deploy/nginx/adrift.conf`. It prevents the SPA document from retaining an old
asset manifest while allowing content-hashed files under `/assets/` to be
cached safely.

## API

Install API dependencies before restarting the backend. A web-only install does
not install packages introduced by backend changes (for example `ajv`). Check
imports first; do not restart a healthy older process against missing packages.

```bash
cd /var/www/Adrift
npm ci --workspace apps/api --include=dev
npm --workspace apps/api run check:runtime
cd apps/api
npm run start
```

Set API environment variables from `apps/api/.env.example`.

## Local MongoDB

The root `docker-compose.yml` starts a local MongoDB service for development.

```bash
docker compose up -d
```
