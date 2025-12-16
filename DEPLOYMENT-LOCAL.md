# 🚀 WE Accounting & Tax AI - Local VM Deployment Guide

## Quick Start

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- PostgreSQL (or use Docker)
- Gemini API Key

---

## 1. Backend Setup

```bash
# Navigate to backend
cd backend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your settings:
# - DATABASE_URL (PostgreSQL connection)
# - JWT_SECRET (change for production!)
# - GEMINI_API_KEY (from Google AI Studio)

# Run setup (generate client + migrate + seed)
npm run setup

# OR run each step manually:
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed

# Start development server
npm run dev
```

Backend will run on: http://localhost:3001

### Default Login Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@weaccounting.local | admin123 |
| Accountant | accountant@weaccounting.local | demo123 |

---

## 2. Frontend Setup

```bash
# Navigate to project root
cd ..

# Install frontend dependencies
npm install

# Create local environment file
cp .env.local.example .env.local

# Edit .env.local:
# VITE_API_URL=http://localhost:3001
# VITE_DEPLOYMENT_MODE=local

# Start development server
npm run dev
```

Frontend will run on: http://localhost:5173

---

## 3. Docker Deployment

For production deployment:

```bash
# Create environment file
cat > .env << EOF
DB_PASSWORD=your-secure-password
JWT_SECRET=your-secure-jwt-secret-change-me
GEMINI_API_KEY=your-gemini-api-key
FRONTEND_URL=http://your-domain.com
EOF

# Build and start all services
docker-compose up -d --build

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

Services:
- Frontend: http://localhost (port 80)
- API: http://localhost:3001
- PostgreSQL: localhost:5432

---

## 4. Database Management

```bash
# Access Prisma Studio (visual DB editor)
cd backend
npm run prisma:studio

# Create new migration after schema changes
npm run prisma:migrate

# Re-run seed data
npm run prisma:seed

# Reset database (WARNING: deletes all data)
npx prisma migrate reset
```

---

## 5. API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/register` | Register |
| GET | `/api/auth/me` | Current user |
| POST | `/api/auth/change-password` | Change password |

### Clients
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/clients` | List clients |
| GET | `/api/clients/:id` | Get client |
| POST | `/api/clients` | Create client |
| PUT | `/api/clients/:id` | Update client |
| DELETE | `/api/clients/:id` | Delete client |

### Documents
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/documents` | List documents |
| GET | `/api/documents/:id` | Get document |
| POST | `/api/documents` | Create document |
| PUT | `/api/documents/:id` | Update document |
| DELETE | `/api/documents/:id` | Delete document |
| POST | `/api/documents/:id/approve` | Approve |
| POST | `/api/documents/:id/reject` | Reject |

### GL Entries
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/gl` | List GL entries |
| GET | `/api/gl/trial-balance` | Trial balance |
| POST | `/api/gl` | Create entries |
| DELETE | `/api/gl/:id` | Delete entry |

### AI OCR
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/analyze/document` | Analyze document |
| GET | `/api/analyze/health` | Check AI status |

### Files
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/files/upload` | Upload file |
| POST | `/api/files/upload-base64` | Upload base64 |
| GET | `/api/files/serve/*` | Serve file |
| DELETE | `/api/files` | Delete file |

### Staff Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/staff` | List staff |
| GET | `/api/staff/:id` | Get staff |
| POST | `/api/staff` | Create staff |
| PUT | `/api/staff/:id` | Update staff |
| POST | `/api/staff/:id/reset-password` | Reset password |
| DELETE | `/api/staff/:id` | Deactivate staff |

### Fixed Assets
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/assets` | List assets |
| GET | `/api/assets/:id` | Get asset |
| POST | `/api/assets` | Create asset |
| PUT | `/api/assets/:id` | Update asset |
| POST | `/api/assets/:id/depreciate` | Depreciate |
| DELETE | `/api/assets/:id` | Delete asset |

### Bank Transactions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/bank` | List transactions |
| POST | `/api/bank` | Create transaction |
| POST | `/api/bank/import` | Import batch |
| POST | `/api/bank/:id/match` | Match to document |
| POST | `/api/bank/:id/reconcile` | Mark reconciled |
| GET | `/api/bank/summary` | Reconciliation summary |
| DELETE | `/api/bank/:id` | Delete transaction |

### Vendor Rules
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/rules` | List rules |
| POST | `/api/rules` | Create rule |
| PUT | `/api/rules/:id` | Update rule |
| POST | `/api/rules/match` | Match vendor name |
| DELETE | `/api/rules/:id` | Delete rule |

### Tasks
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tasks` | List tasks |
| GET | `/api/tasks/my` | My tasks |
| POST | `/api/tasks` | Create task |
| PUT | `/api/tasks/:id` | Update task |
| POST | `/api/tasks/:id/complete` | Complete task |
| DELETE | `/api/tasks/:id` | Delete task |

### Activity Logs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/activity-logs` | List logs |
| POST | `/api/activity-logs` | Create log |
| GET | `/api/activity-logs/entity/:type/:id` | Entity logs |
| GET | `/api/activity-logs/user/:id` | User logs |

---

## 6. Troubleshooting

### Database connection error
```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Check connection string
echo $DATABASE_URL
```

### API key error
```bash
# Verify GEMINI_API_KEY is set
grep GEMINI_API_KEY backend/.env
```

### CORS error
```bash
# Check FRONTEND_URL in backend/.env
# Must match your frontend URL
```

### TypeScript errors after checkout
```bash
cd backend
npm install
npm run prisma:generate
```

---

## 7. Backup & Restore

### Backup PostgreSQL
```bash
docker-compose exec postgres pg_dump -U postgres we_accounting > backup.sql
```

### Restore PostgreSQL
```bash
docker-compose exec -T postgres psql -U postgres we_accounting < backup.sql
```

### Backup Files
```bash
tar -czf documents-backup.tar.gz backend/storage/
```

---

## 8. Architecture

```
┌─────────────────────────────────────────────┐
│                  Nginx (80)                  │
│              Reverse Proxy + SPA             │
└─────────────────┬───────────────────────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
        ▼                   ▼
┌───────────────┐   ┌───────────────────┐
│   Frontend    │   │     Backend       │
│ React + Vite  │   │  Express + Prisma │
│   (static)    │   │     (3001)        │
└───────────────┘   └────────┬──────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
        ┌──────────┐  ┌───────────┐  ┌───────────┐
        │PostgreSQL│  │  Local    │  │  Gemini   │
        │  (5432)  │  │  Storage  │  │  API ☁️   │
        └──────────┘  └───────────┘  └───────────┘
```

---

## 9. Feature Comparison

| Feature | Cloud | Local |
|---------|-------|-------|
| Authentication | ✅ | ✅ |
| Client CRUD | ✅ | ✅ |
| Document CRUD | ✅ | ✅ |
| GL Entries | ✅ | ✅ |
| AI OCR (Gemini) | ✅ | ✅ |
| Staff Management | ✅ | ✅ |
| Asset Management | ✅ | ✅ |
| Bank Reconciliation | ✅ | ✅ |
| Vendor Rules | ✅ | ✅ |
| Task Management | ✅ | ✅ |
| Activity Logs | ✅ | ✅ |
| Trial Balance | ❌ | ✅ |

---

*Local VM Deployment Guide - WE Accounting & Tax AI v1.0*

