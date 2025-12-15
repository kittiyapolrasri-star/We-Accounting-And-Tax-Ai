# 🖥️ VM Server Setup Checklist
## WE Accounting & Tax AI - Production Deployment

---

# 📋 Table of Contents

1. [Pre-Deployment Checklist](#1-pre-deployment-checklist)
2. [Server Setup](#2-server-setup)
3. [Application Deployment](#3-application-deployment)
4. [Data Storage & Backup](#4-data-storage--backup)
5. [Security Hardening](#5-security-hardening)
6. [Monitoring & Maintenance](#6-monitoring--maintenance)
7. [Post-Deployment Testing](#7-post-deployment-testing)

---

# 1️⃣ Pre-Deployment Checklist

## Server Requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| CPU | 2 cores | 4 cores |
| RAM | 4 GB | 8 GB |
| Storage | 50 GB SSD | 100 GB SSD |
| OS | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |
| Network | Static IP | Static IP + Domain |

## Required Software

```bash
# Check if installed
node --version    # Node.js 18+
npm --version     # npm 9+
docker --version  # Docker 24+
docker-compose --version  # Docker Compose 2+
git --version     # Git 2+
```

## API Keys Required

| Service | Required | How to Get |
|---------|----------|------------|
| Gemini API | ✅ Yes | https://makersuite.google.com/app/apikey |
| Domain SSL | Optional | Let's Encrypt (free) |

---

# 2️⃣ Server Setup

## Step 1: Update Server

```bash
sudo apt update && sudo apt upgrade -y
sudo reboot
```

## Step 2: Install Docker & Docker Compose

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt install docker-compose-plugin -y

# Verify
docker --version
docker compose version
```

## Step 3: Install Node.js (for development)

```bash
# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node --version
npm --version
```

## Step 4: Create Application Directory

```bash
# Create directories
sudo mkdir -p /opt/we-accounting
sudo mkdir -p /opt/we-accounting/backups
sudo mkdir -p /opt/we-accounting/logs
sudo chown -R $USER:$USER /opt/we-accounting

# Clone repository
cd /opt/we-accounting
git clone https://github.com/kittiyapolrasri-star/We-Accounting-And-Tax-Ai.git app
cd app
git checkout Dev-local
```

---

# 3️⃣ Application Deployment

## Step 1: Configure Environment

```bash
cd /opt/we-accounting/app

# Create production environment file
cat > .env << 'EOF'
# Database
DB_PASSWORD=CHANGE_ME_STRONG_PASSWORD_HERE

# JWT Secret (generate: openssl rand -base64 32)
JWT_SECRET=CHANGE_ME_GENERATE_NEW_SECRET

# Gemini API
GEMINI_API_KEY=your-gemini-api-key-here

# Frontend URL (your domain or IP)
FRONTEND_URL=http://your-server-ip-or-domain

# Ports
BACKEND_PORT=3001
FRONTEND_PORT=80
EOF

# Edit with your values
nano .env
```

## Step 2: Backend Environment

```bash
cd /opt/we-accounting/app/backend

# Copy and edit backend .env
cat > .env << 'EOF'
PORT=3001
DATABASE_URL="postgresql://postgres:CHANGE_ME_STRONG_PASSWORD@localhost:5432/we_accounting?schema=public"
JWT_SECRET=CHANGE_ME_SAME_AS_MAIN_ENV
GEMINI_API_KEY=your-gemini-api-key
STORAGE_PATH=./storage
FRONTEND_URL=http://your-server-ip-or-domain
EOF
```

## Step 3: Deploy with Docker Compose

```bash
cd /opt/we-accounting/app

# Build and start all services
docker compose up -d --build

# Check status
docker compose ps

# View logs
docker compose logs -f
```

## Step 4: Initialize Database

```bash
# Run migrations and seed
docker compose exec backend npm run setup

# Or manually:
docker compose exec backend npm run prisma:migrate
docker compose exec backend npm run prisma:seed
```

## Step 5: Verify Deployment

```bash
# Check health endpoint
curl http://localhost:3001/health

# Expected response:
# {"status":"healthy","timestamp":"...","version":"1.0.0","mode":"local"}
```

---

# 4️⃣ Data Storage & Backup

## Storage Locations

| Data Type | Location | Backup Priority |
|-----------|----------|-----------------|
| Database | Docker volume `postgres_data` | 🔴 Critical |
| Documents/Files | `/opt/we-accounting/app/backend/storage` | 🔴 Critical |
| Logs | `/opt/we-accounting/logs` | 🟡 Medium |
| Configuration | `.env` files | 🔴 Critical |

## Automated Backup Script

```bash
# Create backup script
cat > /opt/we-accounting/backup.sh << 'SCRIPT'
#!/bin/bash

# Configuration
BACKUP_DIR="/opt/we-accounting/backups"
APP_DIR="/opt/we-accounting/app"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

echo "=== Starting Backup: $DATE ==="

# Create backup directory
mkdir -p "$BACKUP_DIR/$DATE"

# 1. Backup PostgreSQL Database
echo "Backing up database..."
docker compose -f "$APP_DIR/docker-compose.yml" exec -T postgres \
    pg_dump -U postgres we_accounting > "$BACKUP_DIR/$DATE/database.sql"

# 2. Backup Document Files
echo "Backing up documents..."
tar -czf "$BACKUP_DIR/$DATE/storage.tar.gz" -C "$APP_DIR/backend" storage/

# 3. Backup Configuration
echo "Backing up configuration..."
cp "$APP_DIR/.env" "$BACKUP_DIR/$DATE/env.backup"
cp "$APP_DIR/backend/.env" "$BACKUP_DIR/$DATE/backend.env.backup"

# 4. Create combined archive
echo "Creating combined archive..."
cd "$BACKUP_DIR"
tar -czf "backup_$DATE.tar.gz" "$DATE/"
rm -rf "$DATE/"

# 5. Remove old backups
echo "Cleaning old backups..."
find "$BACKUP_DIR" -name "backup_*.tar.gz" -mtime +$RETENTION_DAYS -delete

echo "=== Backup Complete: backup_$DATE.tar.gz ==="
SCRIPT

chmod +x /opt/we-accounting/backup.sh
```

## Schedule Automatic Backups

```bash
# Add to crontab - daily at 2 AM
crontab -e

# Add this line:
0 2 * * * /opt/we-accounting/backup.sh >> /opt/we-accounting/logs/backup.log 2>&1
```

## Restore from Backup

```bash
# Restore script
cat > /opt/we-accounting/restore.sh << 'SCRIPT'
#!/bin/bash

if [ -z "$1" ]; then
    echo "Usage: ./restore.sh backup_YYYYMMDD_HHMMSS.tar.gz"
    exit 1
fi

BACKUP_FILE=$1
BACKUP_DIR="/opt/we-accounting/backups"
APP_DIR="/opt/we-accounting/app"
TEMP_DIR="/tmp/we-restore-$$"

echo "=== Restoring from: $BACKUP_FILE ==="

# Extract backup
mkdir -p "$TEMP_DIR"
tar -xzf "$BACKUP_DIR/$BACKUP_FILE" -C "$TEMP_DIR"
RESTORE_DIR=$(ls "$TEMP_DIR")

# Stop services
echo "Stopping services..."
docker compose -f "$APP_DIR/docker-compose.yml" down

# Restore database
echo "Restoring database..."
docker compose -f "$APP_DIR/docker-compose.yml" up -d postgres
sleep 10
docker compose -f "$APP_DIR/docker-compose.yml" exec -T postgres \
    psql -U postgres -c "DROP DATABASE IF EXISTS we_accounting; CREATE DATABASE we_accounting;"
docker compose -f "$APP_DIR/docker-compose.yml" exec -T postgres \
    psql -U postgres we_accounting < "$TEMP_DIR/$RESTORE_DIR/database.sql"

# Restore files
echo "Restoring files..."
rm -rf "$APP_DIR/backend/storage"
tar -xzf "$TEMP_DIR/$RESTORE_DIR/storage.tar.gz" -C "$APP_DIR/backend/"

# Restart all services
echo "Restarting services..."
docker compose -f "$APP_DIR/docker-compose.yml" up -d

# Cleanup
rm -rf "$TEMP_DIR"

echo "=== Restore Complete ==="
SCRIPT

chmod +x /opt/we-accounting/restore.sh
```

---

# 5️⃣ Security Hardening

## Firewall Configuration

```bash
# Install UFW
sudo apt install ufw -y

# Default policies
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH (change port if needed)
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable
sudo ufw status
```

## SSL Certificate (Let's Encrypt)

```bash
# Install Certbot
sudo apt install certbot -y

# Get certificate (replace with your domain)
sudo certbot certonly --standalone -d your-domain.com

# Certificate locations:
# /etc/letsencrypt/live/your-domain.com/fullchain.pem
# /etc/letsencrypt/live/your-domain.com/privkey.pem

# Auto-renewal (already set up by certbot)
sudo certbot renew --dry-run
```

## Update Nginx for SSL

Update `nginx.conf` for HTTPS:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # ... rest of config
}
```

## Fail2Ban (Brute Force Protection)

```bash
# Install Fail2Ban
sudo apt install fail2ban -y

# Create local config
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local

# Enable and start
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

---

# 6️⃣ Monitoring & Maintenance

## Docker Container Monitoring

```bash
# Create monitoring script
cat > /opt/we-accounting/monitor.sh << 'SCRIPT'
#!/bin/bash

APP_DIR="/opt/we-accounting/app"
LOG_FILE="/opt/we-accounting/logs/monitor.log"

echo "=== Health Check: $(date) ===" >> "$LOG_FILE"

# Check containers
docker compose -f "$APP_DIR/docker-compose.yml" ps >> "$LOG_FILE"

# Check API health
HEALTH=$(curl -s http://localhost:3001/health)
echo "API Health: $HEALTH" >> "$LOG_FILE"

# Check disk usage
DISK=$(df -h /opt/we-accounting | tail -1)
echo "Disk: $DISK" >> "$LOG_FILE"

# Alert if API is down
if ! echo "$HEALTH" | grep -q "healthy"; then
    echo "ALERT: API is unhealthy!" >> "$LOG_FILE"
    # Add email/notification here if needed
fi

echo "" >> "$LOG_FILE"
SCRIPT

chmod +x /opt/we-accounting/monitor.sh

# Add to crontab - every 5 minutes
crontab -e
# Add: */5 * * * * /opt/we-accounting/monitor.sh
```

## Log Rotation

```bash
# Create logrotate config
sudo cat > /etc/logrotate.d/we-accounting << 'EOF'
/opt/we-accounting/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 644 root root
}
EOF
```

## Maintenance Schedule

| Task | Frequency | Command |
|------|-----------|---------|
| Backup | Daily 2 AM | Auto (cron) |
| Monitor | Every 5 min | Auto (cron) |
| Update Docker images | Weekly | `docker compose pull && docker compose up -d` |
| Check logs | Weekly | Review `/opt/we-accounting/logs/` |
| Test restore | Monthly | `./restore.sh <backup-file>` |
| Update SSL cert | Auto | Certbot handles this |
| Prune Docker | Weekly | `docker system prune -af` |

---

# 7️⃣ Post-Deployment Testing

## Functional Tests Checklist

| Test | Expected Result | Status |
|------|-----------------|--------|
| **Health Check** | | |
| `curl http://localhost:3001/health` | `{"status":"healthy"}` | ☐ |
| **Authentication** | | |
| Login as admin | Token returned | ☐ |
| Login as accountant | Token returned | ☐ |
| Invalid login | 401 error | ☐ |
| **Clients** | | |
| Create client | Client created | ☐ |
| List clients | Clients returned | ☐ |
| Update client | Client updated | ☐ |
| **Documents** | | |
| Upload document | File stored | ☐ |
| Analyze with AI | OCR results | ☐ |
| Approve document | Status changed | ☐ |
| **GL Entries** | | |
| Post journal entry | Entries saved | ☐ |
| View trial balance | Balance shown | ☐ |
| **Backup/Restore** | | |
| Run backup script | Backup created | ☐ |
| Restore from backup | Data restored | ☐ |

## Performance Test

```bash
# Install Apache Benchmark
sudo apt install apache2-utils -y

# Test API performance
ab -n 100 -c 10 http://localhost:3001/health
```

---

# 📊 Quick Reference Commands

```bash
# Start services
docker compose up -d

# Stop services
docker compose down

# View logs
docker compose logs -f

# Restart specific service
docker compose restart backend

# Shell into backend
docker compose exec backend sh

# Prisma Studio
docker compose exec backend npm run prisma:studio

# Manual backup
/opt/we-accounting/backup.sh

# Manual restore
/opt/we-accounting/restore.sh backup_YYYYMMDD_HHMMSS.tar.gz

# Check disk space
df -h

# Check memory
free -h

# Check running containers
docker ps
```

---

# ✅ Final Deployment Checklist

| Step | Description | Done |
|------|-------------|------|
| 1 | Server meets requirements | ☐ |
| 2 | Docker & Node.js installed | ☐ |
| 3 | Repository cloned | ☐ |
| 4 | Environment files configured | ☐ |
| 5 | Docker Compose running | ☐ |
| 6 | Database migrated & seeded | ☐ |
| 7 | Health check passed | ☐ |
| 8 | Login test successful | ☐ |
| 9 | Backup script configured | ☐ |
| 10 | Cron jobs set up | ☐ |
| 11 | Firewall configured | ☐ |
| 12 | SSL certificate installed | ☐ |
| 13 | Monitoring set up | ☐ |
| 14 | Full functional test passed | ☐ |

---

*VM Server Setup Checklist - WE Accounting & Tax AI v1.0*
