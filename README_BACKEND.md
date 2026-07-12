# ⚙️ KCET EduGuide - Backend API Server

KCET EduGuide is a full-stack web application designed to simplify the Karnataka Common Entrance Test (KCET) counselling process. This directory contains the Node.js / Express-based REST API backend.

---

## 🔗 Git Repositories

*   **Backend Repository (This Codebase):** [https://github.com/mithrangowda07/backend-kcet](https://github.com/mithrangowda07/backend-kcet)
*   **Frontend Repository:** [https://github.com/mithrangowda07/frontend-kcet](https://github.com/mithrangowda07/frontend-kcet)

---

## 🚀 Key Backend Features

*   **Custom Recommendation Engine:** Evaluates candidate ranks against historical cutoff databases (2022-2025). Resolves reservation category hierarchies (e.g. 2AG $\rightarrow$ 2A $\rightarrow$ GM) and round fallback mappings.
*   **Cutoff Stability Analyzer:** Stabilizes cutoff fluctuations over multiple years using mean and coefficient of variation checks.
*   **Role-Based Security:** Secure JWT session authentication (with access/refresh token support), role-based middleware validations (Counselling Student, Studying Mentor, Administrator).
*   **AWS S3 ID Verification Upload:** Handles candidate ID verification file uploads to AWS S3 using presigned URLs.
    *   *Local Storage Fallback:* Dynamically switches to local file writes (`uploads/` directory) if AWS is quarantine-blocked or credentials are not configured.
*   **Jitsi Video Conferencing Tokens:** Generates authentication tokens to support Jitsi meetings for peer tutoring/mentoring sessions.
*   **Auto-Maintenance Scheduler (Cron):** Updates meeting states and dispatches reminder notifications. Run locally via a 2-minute interval loop or serverless via Vercel Crons.

---

## 🛠️ Tech Stack & Dependencies

*   **Runtime & Framework:** Node.js, Express 5 (`express` `^5.2.1`)
*   **Database & ODM:** MongoDB, Mongoose (`mongoose` `^9.6.3`)
*   **Authentication & Hashing:** JWT (`jsonwebtoken` `^9.0.3`), `bcryptjs` (`^3.0.3`) supporting Node.js hashes and backward compatibility for legacy Django pbkdf2 hashes.
*   **File Handling & Cloud Storage:** Multer (`^2.1.1`), AWS SDK v3 (`@aws-sdk/client-s3` `^3.1058.0`, `@aws-sdk/s3-request-presigner` `^3.1060.0`).
*   **Notification Mailers:** Nodemailer (`^7.0.3`) for SMTP email dispatch.
*   **Request Schema Validation:** Joi (`^18.2.1`)
*   **Security & Log Middlewares:** Helmet (`^8.2.0`), CORS (`^2.8.6`), Morgan HTTP logger (`^1.10.1`).
*   **Environment Variables:** Dotenv (`^17.4.2`), `uuid` (`^9.0.1`).

---

## ⚙️ Development Setup & Installation

### 1. Prerequisites
- [Node.js](https://nodejs.org/) installed (v18+ recommended)
- A running [MongoDB](https://www.mongodb.com/) server (local instance or cloud cluster)
- (Optional) AWS S3 bucket and SMTP mail credentials

### 2. Installation
1.  Clone this repository and navigate to the directory:
    ```bash
    git clone https://github.com/mithrangowda07/backend-kcet.git
    cd backend-kcet
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```

### 3. Environment Configuration
Create a `.env` file in the root of the backend directory. Refer to `.env.example` for details:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/kcet-eduguide
JWT_SECRET=your_jwt_secret_key

# AWS configuration (optional, falls back to local storage)
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_STORAGE_BUCKET_NAME=...
AWS_S3_REGION_NAME=...
AWS_S3_DEFAULT_ACL=private

# SMTP Credentials
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=...
```

### 4. Database Seeding & Initialization
Populate categories, colleges, branches, and cutoffs prior to starting:
1.  **Seed Reservation Categories:**
    ```bash
    npm run seed:categories
    ```
2.  **Seed Main Database (Colleges & Branch Cutoffs):**
    ```bash
    node scripts/seed_db.js
    ```
3.  **Create Administrator User:**
    ```bash
    npm run admin:create admin@example.com adminPassword123 "System Admin"
    ```

### 5. Running the API Server
*   **Start Local Development Server:**
    ```bash
    npm run dev
    ```
    Starts the server with node watch-mode at `http://localhost:5000`.
*   **Start Production Server:**
    ```bash
    npm start
    ```

---

## 🐋 Docker Containerization

Run the API server inside a Docker container:
*   **Build & Start Container:**
    ```bash
    docker-compose up --build
    ```
    This launches the Node backend server mapped to container port `5000`.

---

## 🌐 Serverless Deployment & Cron Setup

The backend is configured for deployment on **Vercel** via `vercel.json`, which compiles the Express server and maps serverless cron schedules to execute the periodic scheduler maintenance job every 2 minutes:
```json
{
  "version": 2,
  "builds": [
    {
      "src": "src/server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "src/server.js"
    }
  ],
  "crons": [
    {
      "path": "/api/cron/scheduler",
      "schedule": "*/2 * * * *"
    }
  ]
}
```

---

## 🤖 Database Seeding & Maintenance Scripts

Located under `scripts/`:
*   `seedCategories.js` (`npm run seed:categories`): Seeds the 24 categories and fallbacks.
*   `createAdmin.js` (`npm run admin:create`): Creates/updates administrator credentials.
*   `seed_db.js`: Seeds all colleges, clusters, branches, and cutoff lists.
*   `seedLocations.js`: Seeds geolocation records for the college dashboard search engine.
*   `build_db_jsons.js`: Compiles raw KCET database JSON inputs.
*   `remove_stable_cutoffs.js`: Prunes redundant cutoff entries.
*   `update_recommendation_index.js`: Creates/updates database indexing structures.
