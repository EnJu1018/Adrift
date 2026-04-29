# Adrift

Adrift is a full-stack map diary MVP. Users can register, log in, create location-based diary entries with mood, optional images, text, visibility, and browse markers on a dark animated map interface.

## Stack

- Frontend: React + Vite, Framer Motion, Mapbox GL
- Backend: Node.js + Express
- Database: MongoDB + Mongoose
- Auth: JWT

## Project Structure

```txt
Adrift/
  backend/
    src/
      config/
      middleware/
      models/
      routes/
      uploads/
      server.js
  frontend/
    src/
      api/
      components/
      App.jsx
      main.jsx
      styles.css
```

## Setup

1. Install dependencies:

```bash
npm run install:all
```

2. Create environment files:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

3. Update `backend/.env` with your MongoDB URI and JWT secret. If you do not have MongoDB installed locally, start the included container:

```bash
docker compose up -d mongo
```

4. Optional: add a Mapbox token to `frontend/.env`. Without it, Adrift shows an animated fallback map so the MVP remains usable.

5. Run both apps:

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:5000

## API

- `POST /auth/register`
- `POST /auth/login`
- `GET /diaries`
- `GET /diaries?lat=&lng=&radius=`
- `POST /diaries`
- `DELETE /diaries/:id`

## Notes

- Diary geodata is stored as GeoJSON Point with a `2dsphere` index.
- `private` entries are only returned to their owner. `public` entries are visible to everyone. `friends` is stored for the MVP schema but friend graph filtering is intentionally not implemented yet.
