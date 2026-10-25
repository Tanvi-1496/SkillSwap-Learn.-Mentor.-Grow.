# SkillSwap — Learn. Mentor. Grow. 🚀

> **AI-Powered Mentorship Platform** connecting students and aspiring developers with verified industry professionals, alumni, and senior peers.

[![React](https://img.shields.io/badge/React-19.0-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.0-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-v4.0-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-Python_3.11-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Sentence_Transformers](https://img.shields.io/badge/SBERT-all--MiniLM--L6--v2-FFA116)](https://www.sbert.net/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL_%2B_pgvector-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)

---

## 📖 Table of Contents

- [Overview](#-overview)
- [System Architecture](#-system-architecture)
- [Key Features](#-key-features)
- [Technology Stack](#-technology-stack)
- [Directory Structure](#-directory-structure)
- [Prerequisites](#-prerequisites)
- [Environment Variables](#-environment-variables)
- [Installation & Quick Start](#-installation--quick-start)
  - [1. AI / ML Service (FastAPI)](#1-ai--ml-service-fastapi)
  - [2. Backend Service (Node.js & Express)](#2-backend-service-nodejs--express)
  - [3. Frontend Application (React & Vite)](#3-frontend-application-react--vite)
- [Database & Demo Seeding](#-database--demo-seeding)
- [AI Recommendation Engine](#-ai-recommendation-engine)
- [API Reference](#-api-reference)
- [Troubleshooting & FAQs](#-troubleshooting--faqs)
- [Contributing & License](#-contributing--license)

---

## 🌟 Overview

**SkillSwap** is a full-stack mentorship and peer-learning ecosystem. It bridges the gap between ambitious learners and experienced mentors by providing:
- **Intelligent Matchmaking:** An AI-driven recommendation pipeline combining dense semantic vector embeddings (`all-MiniLM-L6-v2`) with pgvector similarity search and multi-factor re-ranking.
- **End-to-End Session Workflow:** Seamless discovery, profile inspection, calendar slot booking, session tracking, and structured review feedback.
- **Role-Based Portals:** Custom experiences tailored for **Students (Mentees)**, **Mentors**, and **Platform Administrators**.

---

## 🏛️ System Architecture

SkillSwap is structured as a coordinated tripartite system:

```text
                                +-----------------------------+
                                |      Web Client (React)     |
                                |  Port: 5173 (Vite + TW v4)  |
                                +--------------+--------------+
                                               |
                     +-------------------------+-------------------------+
                     | (Direct Auth & Sessions)                          | (REST API Calls)
                     v                                                   v
        +-------------------------+                         +-------------------------+
        |        Supabase         |                         |     Express Backend     |
        |  - Auth & JWT Sessions  |<------------------------|  Port: 5000 (Node.js)   |
        |  - Postgres + pgvector  |   (Data queries & RLS)  +------------+------------+
        +------------+------------+                                      |
                     ^                                                   | (Forward Student ID)
                     | (Vector Search via RPC)                           v
                     |                              +-------------------------+
                     +------------------------------+     AI / ML Service     |
                                                    |  Port: 8000 (FastAPI)   |
                                                    |  - SBERT Embeddings     |
                                                    |  - Multi-Factor Rerank  |
                                                    +-------------------------+
```

1. **Frontend (React 19 + Tailwind v4):** Renders dynamic role-gated dashboards, mentor discovery search, calendar booking flows, and real-time AI recommendations.
2. **Backend (Node.js Express):** Acts as the API gateway for business logic, booking management, profile hydration, and secure bearer-token authentication.
3. **AI Service (FastAPI + Sentence-Transformers):** Converts student learning profiles into 384-dimensional dense vectors, performs vector similarity searches over mentor embeddings in PostgreSQL via Supabase RPC, and computes a multi-factor re-ranked Top 3 match score.
4. **Database (Supabase PostgreSQL):** Houses relational user profiles, availability slots, session bookings, reviews, and vector embeddings (`pgvector`).

---

## ✨ Key Features

### 🎓 For Students (Mentees)
- **Profile & Learning Goals:** Define skills, career aspirations, department, semester, and target learning outcomes.
- **AI Top 3 Recommendations:** Receive personalized mentor matches with transparent match scores (semantic similarity, domain match, experience, ratings, and availability).
- **Mentor Directory & Filtering:** Search by keyword, domain (Web, AI/ML, Cloud, Data), experience level, and ratings.
- **Frictionless Booking:** Reserve 1-on-1 mentorship slots directly on available calendar intervals.
- **Bookings Management:** Track pending, confirmed, completed, and canceled sessions.
- **Reviews & Ratings:** Leave star ratings and structured feedback after completing sessions.

### 💼 For Mentors
- **Mentorship Portal:** View incoming mentee booking requests, upcoming scheduled sessions, and historical logs.
- **Slot Availability Management:** Define active days and available time windows.
- **Reputation & Badges:** Verified mentor badges, aggregated rating metrics, and student review feeds.

### 🛡️ For Administrators
- **Admin Dashboard:** Platform-wide analytics (user counts, booking conversion rates, active mentors).
- **Mentor Verification:** Audit and approve pending mentor profile credentials.
- **User Management & Audit Logs:** Monitor platform activity and manage account statuses.

---

## 💻 Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, Vite 8, Tailwind CSS v4, Lucide Icons, Supabase JS Client |
| **Backend** | Node.js (ESM), Express 5, CORS, Dotenv, Supabase Admin SDK |
| **AI / ML Service** | Python 3.11, FastAPI, Uvicorn, Sentence-Transformers (`all-MiniLM-L6-v2`), PyTorch, Scikit-Learn |
| **Database & Auth** | Supabase (PostgreSQL 15+), `pgvector` extension, Supabase Auth (JWT) |
| **Tooling & Linter** | oxfmt, TypeScript type defs, Vite Dev Server |

---

## 📁 Directory Structure

```text
SkillSwap/
├── .env                          # Frontend environment variables
├── package.json                  # Root dependencies & scripts (Frontend + AI runner)
├── vite.config.js                # Vite configuration with Tailwind CSS v4
├── index.html                    # Root HTML shell
│
├── src/                          # ⚛️ React 19 Frontend
│   ├── main.jsx                  # React application entrypoint
│   ├── App.jsx                   # Central page router and state-based navigation
│   ├── index.css                 # Global CSS & Tailwind v4 imports
│   ├── lib/
│   │   └── supabase.js           # Supabase client singleton
│   └── components/
│       ├── Landing.jsx           # Public landing & hero page
│       ├── Auth.jsx              # Login / Register modals & session management
│       ├── MenteeDashboard.jsx   # Mentee dashboard & booking summary
│       ├── MenteeRequirements.jsx# Student requirements & goals setup
│       ├── AIRecommendations.jsx # AI-recommended mentors with scoring breakdown
│       ├── SearchMentors.jsx     # Searchable & filterable mentor catalogue
│       ├── MentorProfile.jsx     # Detailed mentor profile view
│       ├── BookingFlow.jsx       # Date/time slot booking wizard
│       ├── MyBookings.jsx        # User session history & status management
│       ├── MentorDashboard.jsx   # Mentor dashboard & schedule control
│       ├── AdminDashboard.jsx    # System metrics & mentor verification
│       ├── Feedback.jsx          # Session review and rating component
│       └── Settings.jsx          # Profile and account preferences
│
├── backend/                      # 🟢 Node.js Express Backend
│   ├── .env                      # Backend environment variables
│   ├── package.json              # Backend dependencies
│   ├── scripts/
│   │   ├── seedMentors.js        # Seed script for demo mentors
│   │   └── seedStudents.js       # Seed script for demo students
│   └── src/
│       ├── server.js             # Express server entrypoint (port 5000)
│       ├── config/
│       │   └── supabase.js       # Supabase service-role client
│       ├── middleware/
│       │   └── authMiddleware.js # Supabase JWT verification middleware
│       ├── routes/
│       │   ├── auth.js           # Auth & session routes
│       │   ├── profile.js        # Profile management & embedding triggers
│       │   ├── mentor.js         # Mentor queries & availability
│       │   ├── recommendations.js# Express bridge to FastAPI recommendation engine
│       │   ├── bookings.js       # Booking operations (create, cancel, approve)
│       │   ├── reviews.js        # Mentor reviews & ratings
│       │   └── admin.js          # Admin analytics & mentor verification
│       └── services/
│           └── aiService.js      # HTTP client communicating with FastAPI
│
└── ai/                           # 🐍 Python AI / ML Service
    └── aiml/
        ├── data/                 # Training & cleaned CSV datasets
        ├── models/               # Serialized models (rf_matcher.pkl)
        ├── scripts/              # Preprocessing & inference bridge test scripts
        └── api/                  # ⚡ FastAPI Service
            ├── .env              # AI service environment variables
            ├── main.py           # FastAPI application & recommendation logic (port 8000)
            └── venv/             # Python Virtual Environment
```

---

## 📋 Prerequisites

Before running the project, ensure you have installed:
1. **Node.js** (v18.x or v20.x recommended) & **npm**
2. **Python** (v3.10 or v3.11)
3. A **Supabase** project with `pgvector` enabled

---

## 🔐 Environment Variables

Create and verify the three `.env` files across the project:

### 1. Root `.env` (Frontend)
File: `./.env`
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-anon-or-publishable-key
VITE_AI_SERVICE_URL=http://127.0.0.1:8000
```

### 2. Backend `.env` (Express Server)
File: `./backend/.env`
```env
PORT=5000
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
DEMO_MENTOR_PASSWORD=SkillSwap@123
DEMO_STUDENT_PASSWORD=SkillSwap@123
AI_SERVICE_URL=http://127.0.0.1:8000
```

### 3. AI Service `.env` (FastAPI)
File: `./ai/aiml/api/.env`
```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_KEY=your-supabase-service-role-key
```

---

## 🚀 Installation & Quick Start

SkillSwap consists of 3 services that run simultaneously in separate terminals:

```text
Terminal 1: AI / ML Service   -> http://127.0.0.1:8000
Terminal 2: Node.js Backend   -> http://localhost:5000
Terminal 3: React Frontend    -> http://localhost:5173
```

---

### 1. AI / ML Service (FastAPI)

> **Important Note for Windows Users:** The Python virtual environment is located at `ai/aiml/api/venv/` (not in `backend/`).

#### Option A: Run directly using the npm script from the root
```bash
npm run ai
```

#### Option B: Activate the venv manually and run Uvicorn
**On Windows (PowerShell):**
```powershell
# Navigate to the FastAPI directory
cd ai/aiml/api

# Activate the existing virtual environment
.\venv\Scripts\Activate.ps1

# Start the FastAPI server
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

**If you need to create a fresh virtual environment:**
```bash
cd ai/aiml/api
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

pip install fastapi uvicorn sentence-transformers supabase python-dotenv pydantic torch
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Check health: Visit `http://127.0.0.1:8000/` or `http://127.0.0.1:8000/docs` (Swagger UI).

---

### 2. Backend Service (Node.js & Express)

Open a second terminal:
```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Start the Express server
npm start
```
The backend will launch at `http://localhost:5000`.

---

### 3. Frontend Application (React & Vite)

Open a third terminal in the repository root:
```bash
# In SkillSwap root directory:
npm install

# Start Vite development server
npm run dev
```
Open your browser at **`http://localhost:5173`**.

---

## 🗄️ Database & Demo Seeding

SkillSwap provides turnkey seeding scripts to populate your Supabase database with realistic mentor and student profiles.

Run these scripts from the `backend/` directory:

```bash
cd backend

# Seed 20+ realistic mentors across Web, AI, Data Science, and Cloud
node scripts/seedMentors.js

# Seed demo student profiles
node scripts/seedStudents.js
```

> **Default Demo Login Password:** `SkillSwap@123`  
> Example Mentor Email: `neha.ai@skillswap.demo`

---

## 🧠 AI Recommendation Engine

SkillSwap implements a two-stage hybrid recommendation pipeline:

```text
[Student Profile]
       |
       v
Sentence-Transformers (all-MiniLM-L6-v2)
       |
       v  (384-dimensional dense embedding)
Stage 1: Candidate Generation
       |  Supabase pgvector RPC: match_mentors()
       v  Retrieves Top 15 semantic candidate mentors
Stage 2: Multi-Factor Reranking
       |  Computes multi-dimensional suitability formula
       v
[Top 3 Ranked Mentors] -> Delivered to Student Dashboard
```

### Reranking Scoring Formula

$$\text{Final Score} = 0.60 \cdot S_{\text{semantic}} + 0.15 \cdot S_{\text{goal}} + 0.10 \cdot S_{\text{experience}} + 0.10 \cdot S_{\text{rating}} + 0.05 \cdot S_{\text{availability}}$$

| Component | Weight | Metric Description |
|---|---|---|
| **Semantic Similarity** | **60%** | Cosine similarity between student learning embedding and mentor bio/skills vector. |
| **Goal & Skill Match** | **15%** | Regex token & phrase boundary matching between student career goals and mentor skills. |
| **Experience Score** | **10%** | Normalized mentor industry experience ($\min(\text{years} / 10.0, 1.0)$). |
| **Rating Score** | **10%** | Aggregated average rating from student reviews ($\text{avg\_rating} / 5.0$). |
| **Availability Score** | **5%** | Active flag indicator if the mentor has active calendar slots ($1.0$ or $0.0$). |

---

## 📡 API Reference

### Express Backend (`http://localhost:5000`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/` | Public | Backend health check |
| `POST` | `/auth/register` | Public | Register new user (Student / Mentor) |
| `POST` | `/auth/login` | Public | Authenticate user & retrieve session |
| `GET` | `/profile` | Bearer | Fetch authenticated user profile |
| `PUT` | `/profile` | Bearer | Update user profile & refresh SBERT embeddings |
| `GET` | `/mentors` | Public | Search mentors with query & domain filters |
| `GET` | `/mentors/:id` | Public | Get single mentor profile and available slots |
| `GET` | `/recommendations` | Bearer | Get Top 3 AI-recommended mentors for student |
| `POST` | `/bookings` | Bearer | Create a new session booking request |
| `GET` | `/bookings/my-bookings` | Bearer | List all bookings for current user |
| `PATCH`| `/bookings/:id/status` | Bearer | Update booking status (`confirmed`, `cancelled`, `completed`) |
| `POST` | `/reviews` | Bearer | Submit rating and feedback for completed session |
| `GET` | `/admin/stats` | Bearer (Admin) | Platform KPI metrics and user stats |
| `PATCH`| `/admin/verify-mentor/:id`| Bearer (Admin) | Verify or unverify a mentor profile |

### AI FastAPI Service (`http://127.0.0.1:8000`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Health check endpoint |
| `GET` | `/test-supabase` | Validates active Supabase connection |
| `POST` | `/embed` | Generates 384-d SBERT vector for a profile and saves to DB |
| `GET` | `/recommendations/{student_id}` | Runs pgvector search & returns Top 3 reranked mentors |

---

## 🛠️ Troubleshooting & FAQs

### 1. `Activate.ps1 cannot be loaded because running scripts is disabled`
If PowerShell blocks virtual environment activation, open PowerShell as Administrator and run:
```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

### 2. `The term '.\backend\.venv\...' is not recognized`
The backend is a **Node.js** app, not Python. The Python virtual environment belongs to the FastAPI service and is located at:
```powershell
.\ai\aiml\api\venv\Scripts\Activate.ps1
```
Alternatively, run `npm run ai` directly from the project root!

### 3. AI Recommendations returns empty list (`[]`)
This occurs if the student has not yet saved their requirements or generated an embedding:
1. Log in as a student.
2. Complete the **Requirements / Goals** form on your dashboard.
3. Once submitted, your profile embedding is automatically generated and recommendations will populate.

### 4. CORS errors in browser console
Ensure `VITE_AI_SERVICE_URL=http://127.0.0.1:8000` is present in your root `.env` and `PORT=5000` is running in your backend.

---

## 👥 Contributing & License

Contributions, bug reports, and feature suggestions are welcome!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

Distributed under the **MIT License**. See `LICENSE` for more information.

---

<div align="center">
  <sub>Built with ❤️ by the SkillSwap Team. Learn. Mentor. Grow.</sub>
</div>
