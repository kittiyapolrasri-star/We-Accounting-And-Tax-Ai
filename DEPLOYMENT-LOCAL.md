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

# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# Start development server
npm run dev
```

Backend will run on: http://localhost:3001

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

# Reset database (WARNING: deletes all data)
npx prisma migrate reset
```

---

## 5. Create Admin User

```bash
# Use the register endpoint
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "securepassword",
    "name": "Admin User",
    "role": "admin"
  }'
```

---

## 6. API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/auth/login` | POST | Login |
| `/api/auth/register` | POST | Register |
| `/api/auth/me` | GET | Current user |
| `/api/clients` | GET/POST | Clients CRUD |
| `/api/clients/:id` | GET/PUT/DELETE | Single client |
| `/api/documents` | GET/POST | Documents |
| `/api/gl` | GET/POST | GL entries |
| `/api/analyze/document` | POST | AI OCR |
| `/api/files/upload` | POST | File upload |

---

## 7. Troubleshooting

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

---

## 8. Backup & Restore

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

## Architecture

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

*Local VM Deployment Guide - WE Accounting & Tax AI*
