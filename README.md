# 🇩🇪 Deutsch Studio

AI-powered German learning app — migrated to **Vite + React + TypeScript + Tailwind CSS + MongoDB**.

## Tech Stack

| Layer     | Technology                                      |
|-----------|-------------------------------------------------|
| Frontend  | Vite, React 18, TypeScript, Tailwind CSS, Redux Toolkit |
| Backend   | Node.js, Express, MongoDB + Mongoose            |
| Auth      | JWT (jsonwebtoken) + bcrypt                     |
| AI        | Groq (llama-3.3-70b-versatile) — free tier      |
| Storage   | Cloudinary (file uploads)                       |

## Project Structure

```
deutsch-studio/
├── frontend/          # Vite + React + TypeScript
│   ├── src/
│   │   ├── pages/     # Route-level pages
│   │   ├── components/
│   │   ├── store/     # Redux slices (TypeScript)
│   │   ├── hooks/     # useAppDispatch, useAppSelector
│   │   ├── types/     # TypeScript interfaces
│   │   └── utils/     # axios api instance
│   ├── tailwind.config.js
│   ├── vite.config.ts
│   └── tsconfig.json
│
└── backend/           # Express + MongoDB
    ├── models/        # Mongoose models
    ├── controllers/
    ├── routes/
    ├── middleware/    # JWT auth, error, rate limiter
    └── config/        # db.js, groq.js, cloudinary.js
```

## Quick Start

### 1. Backend

```bash
cd backend
cp .env.example .env
# Fill in MONGODB_URI, JWT_SECRET, GROQ_API_KEY, CLOUDINARY_* in .env

npm install
npm run dev
# → running on http://localhost:5000
```

### 2. Frontend

```bash
cd frontend
cp .env.example .env
# VITE_API_URL=http://localhost:5000/api (already set)

npm install
npm run dev
# → running on http://localhost:3000
```

## Environment Variables

### Backend `.env`

| Variable                | Description                                |
|-------------------------|--------------------------------------------|
| `MONGODB_URI`           | MongoDB Atlas connection string            |
| `JWT_SECRET`            | Secret key for signing JWTs (min 32 chars) |
| `JWT_EXPIRES_IN`        | Token expiry e.g. `7d`                     |
| `GROQ_API_KEY`          | Free at [console.groq.com](https://console.groq.com) |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary dashboard                       |
| `CLOUDINARY_API_KEY`    | Cloudinary dashboard                       |
| `CLOUDINARY_API_SECRET` | Cloudinary dashboard                       |
| `CLIENT_URL`            | Frontend URL for CORS                      |

### Frontend `.env`

| Variable       | Description           |
|----------------|-----------------------|
| `VITE_API_URL` | Backend API base URL  |

## MongoDB Models

- **User** — profile, XP, streak, level, hashed password
- **VocabList** — embedded VocabWord subdocuments
- **Material** — uploaded files metadata + Cloudinary URL
- **PodcastScript** — generated scripts linked to materials
- **PronunciationAttempt** — coach session results
- **Translation** — saved translation history

## Key Migrations from Original

| Before                      | After                              |
|-----------------------------|------------------------------------|
| Create React App            | Vite + TypeScript                  |
| Supabase Auth               | JWT + bcrypt                       |
| Supabase (PostgreSQL)       | MongoDB Atlas + Mongoose           |
| `.jsx` components           | `.tsx` with full types             |
| Untyped Redux slices        | Typed with `PayloadAction<T>`      |
| `process.env.REACT_APP_*`   | `import.meta.env.VITE_*`           |

## Features

- 🔐 **Auth** — Register / Login / JWT session restore
- 🎙️ **File to Podcast** — Upload PDFs/PPTX → AI podcast script
- 🌍 **Translate** — German ↔ English + grammar explanation
- 🔊 **Pronunciation Guide** — IPA + phoneme reference
- 🎤 **Speaking Coach** — Record speech → AI evaluation + score
- 📚 **Vocabulary Builder** — Topic-based word lists, mastery tracking
