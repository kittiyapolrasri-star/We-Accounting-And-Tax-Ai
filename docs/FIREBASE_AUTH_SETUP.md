# Firebase Authentication Setup Guide
## คู่มือการตั้งค่า Firebase Authentication สำหรับระบบสำนักงานบัญชี

---

## 1. เปิดใช้งาน Firebase Authentication

### ขั้นตอนที่ 1: เข้า Firebase Console

1. ไปที่ [Firebase Console](https://console.firebase.google.com/)
2. เลือก Project ของคุณ
3. คลิก **Authentication** ในเมนูด้านซ้าย
4. คลิกแท็บ **Sign-in method**

### ขั้นตอนที่ 2: เปิดใช้งาน Email/Password

1. คลิก **Email/Password**
2. Toggle **Enable** เป็น ON
3. คลิก **Save**

---

## 2. สร้าง User คนแรก (Admin)

### วิธีที่ 1: ผ่าน Firebase Console (แนะนำ)

1. ไปที่ **Authentication** > **Users**
2. คลิก **Add user**
3. ใส่ข้อมูล:
   - **Email**: `admin@yourcompany.com`
   - **Password**: `รหัสผ่านที่ปลอดภัย`
4. คลิก **Add user**
5. จด **User UID** ไว้ (จะใช้ในขั้นตอนถัดไป)

### วิธีที่ 2: ใช้ Firebase Admin SDK (สำหรับ Developers)

```javascript
// scripts/createAdminUser.js
const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: 'your-project-id'
});

async function createAdminUser() {
  try {
    const user = await admin.auth().createUser({
      email: 'admin@yourcompany.com',
      password: 'YourSecurePassword123!',
      displayName: 'Admin',
      emailVerified: true
    });

    console.log('Created user:', user.uid);

    // Set custom claims for admin role
    await admin.auth().setCustomUserClaims(user.uid, {
      role: 'admin'
    });

    console.log('Admin user created successfully!');
  } catch (error) {
    console.error('Error:', error);
  }
}

createAdminUser();
```

---

## 3. สร้าง Staff Record ใน Firestore

หลังจากสร้าง User ใน Firebase Auth แล้ว ต้องสร้าง Staff record ใน Firestore:

### ผ่าน Firebase Console:

1. ไปที่ **Firestore Database**
2. สร้าง Collection ชื่อ `staff`
3. สร้าง Document ใหม่:
   - **Document ID**: ใช้ UID จาก Authentication (เช่น `abc123xyz`)
   - **Fields**:

```json
{
  "name": "ชื่อ-นามสกุล",
  "email": "admin@yourcompany.com",
  "role": "Manager",
  "active_tasks": 0,
  "avatar_url": "",
  "created_at": "2024-01-01T00:00:00Z"
}
```

### Roles ที่รองรับ:
- `Admin` - ผู้ดูแลระบบ
- `Manager` - ผู้จัดการ
- `Senior Accountant` - นักบัญชีอาวุโส
- `Junior Accountant` - นักบัญชี

---

## 4. ตั้งค่า Environment Variables

สร้างไฟล์ `.env` ที่ root ของโปรเจค:

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef

# Gemini API (for AI Document Analysis)
VITE_GEMINI_API_KEY=your-gemini-api-key
```

### หา Firebase Config ได้จาก:
1. Firebase Console > Project Settings > General
2. เลื่อนลงมาหา "Your apps"
3. คลิก Web App หรือสร้างใหม่
4. Copy config values

---

## 5. ตั้งค่า Firestore Security Rules

ไปที่ **Firestore Database** > **Rules** และใส่:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper function to check if user is authenticated
    function isAuthenticated() {
      return request.auth != null;
    }

    // Helper function to check user role
    function hasRole(role) {
      return isAuthenticated() &&
        get(/databases/$(database)/documents/staff/$(request.auth.uid)).data.role == role;
    }

    function isManager() {
      return hasRole('Manager') || hasRole('Admin');
    }

    // Staff collection
    match /staff/{staffId} {
      allow read: if isAuthenticated();
      allow write: if isManager();
    }

    // Clients collection
    match /clients/{clientId} {
      allow read: if isAuthenticated();
      allow write: if isManager();
    }

    // Documents collection
    match /documents/{docId} {
      allow read, write: if isAuthenticated();
    }

    // GL Entries collection
    match /gl_entries/{entryId} {
      allow read: if isAuthenticated();
      allow write: if isAuthenticated();
    }

    // Tasks collection
    match /tasks/{taskId} {
      allow read, write: if isAuthenticated();
    }

    // Activity logs
    match /activity_logs/{logId} {
      allow read: if isAuthenticated();
      allow write: if isAuthenticated();
    }
  }
}
```

---

## 6. Deploy และทดสอบ Login

### ทดสอบ Local:
```bash
npm run dev
```

### Deploy ไป Google Cloud:
```bash
npm run build
gcloud run deploy
```

### ทดสอบ Login:
1. เปิด URL ของ app
2. ใส่ email และ password ที่สร้างไว้
3. ถ้า login สำเร็จจะเข้าสู่ Dashboard

---

## 7. สร้าง Staff เพิ่มเติม

### สร้างผ่าน Firebase Console:

**ทำซ้ำขั้นตอนที่ 2 และ 3 สำหรับแต่ละ Staff**

### หรือใช้ Script Batch Create:

```javascript
// scripts/createStaff.js
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

admin.initializeApp();
const db = getFirestore();

const staffMembers = [
  {
    email: 'somchai@company.com',
    password: 'TempPass123!',
    name: 'สมชาย ใจดี',
    role: 'Senior Accountant'
  },
  {
    email: 'somying@company.com',
    password: 'TempPass123!',
    name: 'สมหญิง รักดี',
    role: 'Junior Accountant'
  }
];

async function createStaffMembers() {
  for (const staff of staffMembers) {
    try {
      // Create auth user
      const user = await admin.auth().createUser({
        email: staff.email,
        password: staff.password,
        displayName: staff.name,
        emailVerified: true
      });

      // Create Firestore document
      await db.collection('staff').doc(user.uid).set({
        name: staff.name,
        email: staff.email,
        role: staff.role,
        active_tasks: 0,
        created_at: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`Created: ${staff.name} (${user.uid})`);
    } catch (error) {
      console.error(`Error creating ${staff.email}:`, error);
    }
  }
}

createStaffMembers();
```

---

## 8. Troubleshooting

### ปัญหา: "Firebase not configured"
- ตรวจสอบ `.env` ว่ามีค่าครบถ้วน
- ตรวจสอบว่า prefix เป็น `VITE_` สำหรับ Vite

### ปัญหา: "Permission denied"
- ตรวจสอบ Firestore Security Rules
- ตรวจสอบว่า Staff document มี UID ตรงกับ Auth user

### ปัญหา: "User not found"
- ตรวจสอบว่าสร้าง User ใน Firebase Auth แล้ว
- ตรวจสอบ Email spelling

### ปัญหา: "Network error"
- ตรวจสอบ Internet connection
- ตรวจสอบ Firebase project ยัง active

---

## Quick Start Commands

```bash
# 1. Install Firebase CLI
npm install -g firebase-tools

# 2. Login to Firebase
firebase login

# 3. Select project
firebase use your-project-id

# 4. Deploy Firestore rules
firebase deploy --only firestore:rules

# 5. Run local development
npm run dev
```

---

## Demo Mode (ไม่ต้องมี Firebase)

ถ้าต้องการทดสอบโดยไม่ต้องตั้งค่า Firebase:

ระบบจะทำงานใน **Demo Mode** อัตโนมัติถ้าไม่มี Firebase config โดยจะ:
- ใช้ localStorage แทน Firestore
- ไม่ต้อง login
- ข้อมูลจะหายเมื่อ clear browser

---

*Document Version: 1.0*
*Last Updated: 2024*
