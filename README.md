# Circa — FBLA Local Business Discovery App

A local business discovery platform for finding and supporting independent businesses in Arizona. Built for the **FBLA Coding & Programming** competition.

---

## Prerequisites

- **Node.js** 18+ and **npm**
- **Python** 3.11+
- A **Supabase** project (free tier) with the connection string
- A **Google reCAPTCHA v2** site key + secret key (free)

---

## Setup (5 steps)

### 1. Clone & configure environment

Copy `.env.example` to `.env` in the project root and fill in your values:

```bash
DATABASE_URL=postgresql+psycopg://user:password@host:5432/dbname
JWT_SECRET_KEY=your-secret-key-here
RECAPTCHA_SECRET_KEY=your-recaptcha-secret-key
```

Copy `frontend/.env` and set:

```
VITE_RECAPTCHA_SITE_KEY=your-recaptcha-site-key
```

### 2. Install backend dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 3. Install frontend dependencies

```bash
cd frontend
npm install
```

### 4. Seed the database

```bash
# From the project root
python -m backend.seed
```

This creates all tables, loads 100 Arizona businesses, creates 3 demo accounts, and adds sample reviews and deals.

### 5. Start the app

```bash
# Terminal 1 — backend
uvicorn backend.main:app --reload

# Terminal 2 — frontend
cd frontend
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

---

## Demo Accounts

| Role | Email | Password |
|---|---|---|
| User | demo@example.com | Demo1234 |
| Business Owner | owner@example.com | Owner1234 |
| Admin | admin@example.com | Admin1234 |

---

## Intelligent Features

### Hidden Gems Algorithm

Surfaces underappreciated local businesses using:

```
score = avg_rating × log₁₀(1 + review_count) × recency_factor
recency_factor = 1 / (1 + days_since_last_review / 30)
```

Combines quality (average rating), volume (logarithmic review count so no single viral business dominates), and recency (businesses with recent reviews score higher than stale ones). Requires a minimum of 2 reviews to qualify. Visible on the Map Discovery page.

### Content-Based Recommendations

Personalizes suggestions based on your saved favorites:

```
score = (shared_category_count × 2) + avg_rating + (has_active_deal × 1)
```

Counts which categories you prefer (weighted 2×), factors in business quality, and boosts businesses with active deals. Requires 2+ saved favorites; falls back to Hidden Gems otherwise. Visible on the Profile page.

---

## Project Structure

```
/frontend       React + TypeScript + Vite frontend
/backend        FastAPI backend
  /models       SQLAlchemy ORM models
  /routes       API route handlers
  /services     Business logic (business_manager, review_system, etc.)
  /utils        Auth helpers
  seed.py       Database seeder
/data
  businesses.json   100 Arizona seed businesses
```
