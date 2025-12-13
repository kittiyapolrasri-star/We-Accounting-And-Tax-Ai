# WE Accounting & Tax AI - Deployment Runbook

## Prerequisites

1. **Google Cloud Project** with billing enabled
2. **Firebase Project** connected to the GCP project
3. **Required APIs enabled**:
   - Cloud Run API
   - Cloud Build API
   - Secret Manager API
   - Cloud Functions API
   - Firestore API

## Environment Variables

### Frontend (.env)
```bash
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### Cloud Functions Secrets (Secret Manager)
```bash
GEMINI_API_KEY=your_gemini_api_key
```

## Deployment Steps

### 1. Initial Setup

```bash
# Clone repository
git clone <repository_url>
cd We-Accounting-And-Tax-Ai

# Install dependencies
npm install
cd functions && npm install && cd ..

# Configure Firebase
firebase login
firebase use your_project_id
```

### 2. Deploy Firestore Security Rules

```bash
firebase deploy --only firestore:rules
```

### 3. Deploy Cloud Functions

```bash
# Set Gemini API key in Secret Manager
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"
echo -n "your_api_key" | gcloud secrets versions add GEMINI_API_KEY --data-file=-

# Grant Cloud Functions access to the secret
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:your_project_id@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Deploy functions
firebase deploy --only functions
```

### 4. Deploy Frontend via Cloud Build

```bash
# Trigger Cloud Build
gcloud builds submit --config=cloudbuild.yaml \
  --substitutions=_FIREBASE_API_KEY="...",_FIREBASE_AUTH_DOMAIN="...",_FIREBASE_PROJECT_ID="...",_FIREBASE_STORAGE_BUCKET="...",_FIREBASE_MESSAGING_SENDER_ID="...",_FIREBASE_APP_ID="..."
```

Or configure Cloud Build Triggers in GCP Console for automatic deployment on push.

### 5. Verify Deployment

1. **Health Check**: `curl https://asia-southeast1-{project_id}.cloudfunctions.net/api/health`
2. **Frontend**: Visit `https://we-accounting-ai.web.app`
3. **Authentication**: Test login with valid credentials
4. **Document Analysis**: Upload test document and verify AI processing

## Rollback Procedure

### Frontend Rollback
```bash
# List previous Cloud Run revisions
gcloud run revisions list --service=we-accounting-ai --region=asia-southeast1

# Route traffic to previous revision
gcloud run services update-traffic we-accounting-ai \
  --to-revisions=revision-name=100 \
  --region=asia-southeast1
```

### Cloud Functions Rollback
```bash
# Deploy from specific commit
git checkout <previous_commit_hash>
firebase deploy --only functions
```

## Monitoring

### Cloud Logging
```bash
# View Cloud Functions logs
gcloud functions logs read api --region=asia-southeast1 --limit=100

# View Cloud Run logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=we-accounting-ai" --limit=100
```

### Key Metrics to Monitor
1. **API Response Time**: Should be < 5 seconds for document analysis
2. **Error Rate**: Should be < 1%
3. **Rate Limit Hits**: Monitor for abuse
4. **Authentication Failures**: Monitor for brute force attempts

### Set Up Alerts (GCP Console)
1. Navigate to Cloud Monitoring > Alerting
2. Create policies for:
   - High error rate (> 5% in 5 minutes)
   - High latency (> 10s P95 in 5 minutes)
   - Cloud Function failures
   - Quota approaching limits

## Security Checklist

- [ ] Gemini API key is in Secret Manager (NOT in code)
- [ ] Firestore rules deployed and tested
- [ ] CORS configured for production domains only
- [ ] Rate limiting enabled (100/min global, 20/min for analysis)
- [ ] Authentication required for all API endpoints
- [ ] HTTPS enforced
- [ ] Security headers (Helmet) configured

## Scaling Configuration

### Cloud Functions
- **Memory**: 1GB
- **Timeout**: 300 seconds (5 minutes)
- **Min Instances**: 0 (scale to zero)
- **Max Instances**: 100

### Cloud Run (Frontend)
- **Memory**: 256MB
- **CPU**: 1
- **Min Instances**: 0
- **Max Instances**: 10
- **Concurrency**: 80

## Troubleshooting

### Common Issues

**1. "Firebase not configured" error**
- Verify VITE_* environment variables are set in Cloud Build
- Check browser console for missing config

**2. "Authentication failed" error**
- Verify Firebase Auth is enabled
- Check if user exists in Firebase Auth
- Verify Firestore staff document exists

**3. "Rate limit exceeded" error**
- Wait 1 minute and retry
- Check for potential abuse in logs

**4. "Gemini API error"**
- Verify Secret Manager access
- Check Gemini API quota in GCP Console
- Review API key permissions

### Support Contacts
- Technical Issues: Check Cloud Logging first
- API Quota: GCP Console > APIs & Services > Quotas
- Firebase Issues: Firebase Console > Project Settings

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2024-02 | Initial production deployment |
| 1.1.0 | - | Added PDF export for tax forms |
