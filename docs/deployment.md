# Adrift Deployment

## Apps

- Web build output comes from `apps/web`.
- API runtime comes from `apps/api`.
- iOS is built with Xcode from `apps/ios`.

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

```bash
cd apps/api
npm install
npm run start
```

Set API environment variables from `apps/api/.env.example`.

## Local MongoDB

The root `docker-compose.yml` starts a local MongoDB service for development.

```bash
docker compose up -d
```
