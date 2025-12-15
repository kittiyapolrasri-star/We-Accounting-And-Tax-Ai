# WE Accounting & Tax AI 🧾💰

> **ระบบบัญชีและภาษีอัจฉริยะสำหรับสำนักงานบัญชี**  
> Smart Accounting & Tax System powered by Google Gemini AI

[![Deploy to Cloud Run](https://github.com/kittiyapolrasri-star/We-Accounting-And-Tax-Ai/actions/workflows/deploy.yml/badge.svg)](https://github.com/kittiyapolrasri-star/We-Accounting-And-Tax-Ai/actions/workflows/deploy.yml)

---

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Quick Start](#-quick-start)
- [Project Structure](#-project-structure)
- [Configuration](#-configuration)
- [Deployment](#-deployment)
- [API Documentation](#-api-documentation)
- [Contributing](#-contributing)

---

## ✨ Features

### 🤖 AI-Powered Document Processing
- Automatic document classification (Invoice, Receipt, Bank Statement, etc.)
- OCR + AI extraction of key data
- Auto-generate GL entries from documents
- Smart vendor matching with learning

### 📊 CEO/Manager Dashboard
- Real-time team workload monitoring
- Client assignment management
- Urgent items tracking
- Performance analytics

### 📅 Task Management (Notion-style)
- Kanban board view
- Timeline/Gantt chart
- Recurring tasks with Thai tax deadlines
- Comments, checklists, time tracking

### 🔔 Real-time Notifications
- Push notifications (Firebase Cloud Messaging)
- In-app notification center
- Deadline reminders
- Tax filing alerts

### 🛒 E-Commerce Integration
- **Shopee** - Orders, Settlements
- **Lazada** - Orders, Settlements
- **TikTok Shop** - Orders, Settlements
- **Grab** (GrabFood/GrabMart) - Orders
- **LINE MAN Wongnai** - Orders

### 📋 Thai Tax Compliance
- ภ.ง.ด.1, 3, 53, 54 (WHT)
- ภ.พ.30, 36 (VAT)
- ภ.ง.ด.50, 51 (Corporate Tax)
- ใบ 50 ทวิ (WHT Certificate)
- e-Filing submission

### 💼 Accounting Features
- Chart of Accounts (Thai standard)
- GL Posting with validation
- Bank Reconciliation
- Period Closing
- Financial Reports

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18 + TypeScript + TailwindCSS |
| **AI Engine** | Google Gemini 2.0 Flash |
| **Backend** | Firebase Cloud Functions |
| **Database** | Firestore |
| **Auth** | Firebase Authentication |
| **Notifications** | Firebase Cloud Messaging |
| **Hosting** | Google Cloud Run |
| **CI/CD** | GitHub Actions |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- npm or yarn
- Firebase CLI (`npm install -g firebase-tools`)
- Google Cloud SDK (optional, for deployment)

### Installation

```bash
# Clone the repository
git clone https://github.com/kittiyapolrasri-star/We-Accounting-And-Tax-Ai.git
cd We-Accounting-And-Tax-Ai

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env with your credentials
# See Configuration section below

# Start development server
npm run dev
```

### Windows Users
```batch
scripts\setup.bat
```

### Mac/Linux Users
```bash
chmod +x scripts/setup.sh
./scripts/setup.sh
```

---

## 📁 Project Structure

```
We-Accounting-And-Tax-Ai/
├── components/              # React UI components
│   ├── CEODashboard.tsx     # CEO/Manager dashboard
│   ├── TaskTimeline.tsx     # Gantt chart view
│   ├── NotificationCenter.tsx
│   ├── ECommerceSyncDashboard.tsx
│   ├── RecurringTasksManager.tsx
│   └── ...
├── services/                # Business logic & APIs
│   ├── accountingFirmEngine.ts  # Main AI engine
│   ├── fcmService.ts        # Push notifications
│   ├── recurringTasks.ts    # Scheduled tasks
│   ├── webhookIntegration.ts
│   ├── taskDatabase.ts
│   └── ecommercePlatforms.ts
├── functions/               # Firebase Cloud Functions
│   └── src/index.ts
├── types/                   # TypeScript definitions
├── hooks/                   # React hooks
├── contexts/                # React contexts
├── scripts/                 # Setup scripts
├── .github/workflows/       # CI/CD pipelines
├── Dockerfile               # Container config
├── nginx.conf               # Web server config
└── cloudbuild.yaml          # Google Cloud Build
```

---

## ⚙️ Configuration

### Required Environment Variables

```env
# Firebase (required)
FIREBASE_API_KEY=xxx
FIREBASE_AUTH_DOMAIN=xxx.firebaseapp.com
FIREBASE_PROJECT_ID=xxx
FIREBASE_APP_ID=xxx

# Gemini AI (required)
VITE_GEMINI_API_KEY=xxx

# E-Commerce (optional - for platform integration)
SHOPEE_PARTNER_ID=xxx
SHOPEE_PARTNER_KEY=xxx
LAZADA_APP_KEY=xxx
LAZADA_APP_SECRET=xxx
```

See `.env.example` for full list.

### Getting API Keys

| Service | Where to get |
|---------|--------------|
| Firebase | [Firebase Console](https://console.firebase.google.com) |
| Gemini AI | [Google AI Studio](https://aistudio.google.com/app/apikey) |
| Shopee | [Shopee Open Platform](https://open.shopee.com) |
| Lazada | [Lazada Open Platform](https://open.lazada.com) |
| TikTok Shop | [TikTok Shop Partner Center](https://partner.tiktokshop.com) |

---

## 🚢 Deployment

### Option 1: GitHub Actions (Recommended)

1. Add secrets in GitHub repo settings:
   - `GCP_PROJECT_ID`
   - `GCP_SA_KEY` (Service Account JSON)
   - `VITE_GEMINI_API_KEY`
   - `FIREBASE_*` variables

2. Push to `main` branch → Auto-deploy to production
3. Push to `Dev-Gemini-workflow` → Auto-deploy to staging

### Option 2: Google Cloud Build

```bash
gcloud builds submit --config cloudbuild.yaml
```

### Option 3: Manual Docker

```bash
# Build
docker build -t we-accounting-ai .

# Run locally
docker run -p 8080:8080 we-accounting-ai

# Push to Artifact Registry
docker tag we-accounting-ai asia-southeast1-docker.pkg.dev/PROJECT_ID/repo/we-accounting-ai
docker push asia-southeast1-docker.pkg.dev/PROJECT_ID/repo/we-accounting-ai

# Deploy to Cloud Run
gcloud run deploy we-accounting-ai \
  --image asia-southeast1-docker.pkg.dev/PROJECT_ID/repo/we-accounting-ai \
  --region asia-southeast1 \
  --platform managed
```

---

## 📚 API Documentation

### Firestore Collections

| Collection | Description |
|------------|-------------|
| `clients` | Client companies |
| `documents` | Uploaded documents |
| `tasks` | Task management |
| `gl_entries` | GL transactions |
| `notifications` | User notifications |
| `recurring_task_templates` | Scheduled tasks |
| `ecommerce_orders` | E-commerce orders |
| `webhook_logs` | Webhook history |

### Firebase Functions

| Function | Trigger | Description |
|----------|---------|-------------|
| `runRecurringTaskScheduler` | Daily 6 AM | Generate recurring tasks |
| `sendDeadlineReminders` | Daily 8 AM | Task deadline alerts |
| `sendTaxDeadlineAlerts` | 1st, 5th of month | Thai tax reminders |
| `ecommerceWebhook` | HTTP POST | E-commerce webhooks |
| `onTaskAssigned` | Firestore | Notify on assignment |
| `cleanupOldNotifications` | Weekly | Delete old notifications |

---

## 🔐 Security

- Firebase Authentication for user management
- Firestore Security Rules for data access
- Rate limiting on API endpoints
- HTTPS-only in production
- Input sanitization

---

## 🧪 Testing

```bash
# Run tests
npm test

# Type checking
npm run type-check

# Lint
npm run lint
```

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

---

## 📄 License

This project is proprietary software. All rights reserved.

---

## 📞 Support

- 📧 Email: support@weaccounting.com
- 📱 LINE: @weaccounting
- 🌐 Website: https://weaccounting.com

---

Made with ❤️ by WE Accounting Team
