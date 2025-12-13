# AI Agent & Task Management Roadmap
## สำหรับระบบสำนักงานบัญชี We Accounting

---

## 1. โครงสร้าง AI Agent System

### 1.1 Agent Types (ประเภท AI Agent)

```
┌─────────────────────────────────────────────────────────────────┐
│                    AGENT ORCHESTRATOR                           │
│         (ควบคุม/มอบหมายงานให้ Agent ต่างๆ)                      │
└─────────────────────────────────────────────────────────────────┘
           │
           ├──► 📄 Document Agent
           │    • วิเคราะห์เอกสาร, จำแนกประเภท
           │    • สร้าง Journal Entry
           │    • ตรวจสอบความถูกต้องเอกสาร
           │
           ├──► 💰 Tax Agent
           │    • คำนวณ WHT, VAT
           │    • เตรียมแบบภาษี (ภ.ง.ด., ภ.พ.30)
           │    • แจ้งเตือนกำหนดยื่น
           │
           ├──► 🏦 Reconciliation Agent
           │    • จับคู่ Bank Statement
           │    • ตรวจหายอดต่าง
           │    • Booking fee/interest
           │
           ├──► 📊 Closing Agent
           │    • คำนวณค่าเสื่อมราคา
           │    • ตั้ง Accruals/Provisions
           │    • ตรวจสอบ Trial Balance
           │
           ├──► 👥 Task Assignment Agent (ใหม่!)
           │    • วิเคราะห์ workload staff
           │    • มอบหมายงานอัตโนมัติ
           │    • ติดตาม SLA และ escalate
           │
           └──► 🔔 Notification Agent (ใหม่!)
                • ส่งแจ้งเตือน deadline
                • Alert ปัญหาเร่งด่วน
                • รายงานสรุปประจำวัน
```

### 1.2 Agent States & Lifecycle

```typescript
type AgentStatus =
  | 'idle'        // รอรับงาน
  | 'processing'  // กำลังทำงาน
  | 'waiting'     // รอ input จาก human/agent อื่น
  | 'completed'   // ทำเสร็จ
  | 'failed'      // ล้มเหลว - ต้องการ human review
  | 'escalated';  // ส่งต่อ human

interface AgentExecution {
  id: string;
  agentType: AgentType;
  status: AgentStatus;
  input: any;
  output: any;
  startedAt: string;
  completedAt?: string;
  humanReviewRequired: boolean;
  assignedTo?: string; // Staff ID if escalated
  auditLog: AgentAction[];
}
```

---

## 2. Task Management System (ระบบมอบหมายงาน)

### 2.1 Task Types (ประเภทงาน)

```typescript
type TaskCategory =
  // งานบัญชี
  | 'document_review'      // ตรวจสอบเอกสาร
  | 'gl_posting'           // ลงบัญชี
  | 'bank_recon'           // กระทบยอดธนาคาร
  | 'period_closing'       // ปิดงวด
  | 'tax_filing'           // ยื่นภาษี
  | 'financial_report'     // จัดทำงบ

  // งานบริการลูกค้า
  | 'client_request'       // ตอบคำถามลูกค้า
  | 'document_collection'  // ติดตามเอกสาร
  | 'meeting'              // นัดประชุม

  // งานทั่วไป
  | 'general'              // งานทั่วไป
  | 'training'             // อบรม
  | 'internal';            // งานภายใน

interface Task {
  id: string;
  title: string;
  description: string;
  category: TaskCategory;

  // Assignment
  assignedTo: string;           // Staff ID
  assignedBy: string;           // Manager/Agent ID
  assignedAt: string;

  // Priority & Deadline
  priority: 'urgent' | 'high' | 'medium' | 'low';
  dueDate: string;
  estimatedHours: number;

  // Context
  clientId?: string;
  documentIds?: string[];
  parentTaskId?: string;        // สำหรับ subtasks

  // Status
  status: 'pending' | 'in_progress' | 'reviewing' | 'completed' | 'cancelled';
  completedAt?: string;
  completionNotes?: string;

  // AI Agent
  createdByAgent?: string;      // Agent ที่สร้าง task
  canBeAutomated: boolean;      // AI ทำแทนได้หรือไม่
  automationAttempts: number;   // จำนวนครั้งที่ AI พยายาม

  // Tracking
  timeSpent: number;            // minutes
  checklistItems?: ChecklistItem[];
  comments: TaskComment[];
}

interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  completedAt?: string;
}

interface TaskComment {
  id: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
}
```

### 2.2 Task Assignment Logic (ตรรกะมอบหมายงาน)

```
┌─────────────────────────────────────────────────────────────────┐
│                 TASK ASSIGNMENT FLOW                            │
└─────────────────────────────────────────────────────────────────┘

     งานใหม่เข้ามา
          │
          ▼
    ┌─────────────┐
    │ AI ทำได้?   │──────Yes────►  Document Agent / Tax Agent
    └─────────────┘                        │
          │                                │
          No                               ▼
          │                         ┌─────────────┐
          ▼                         │ สำเร็จ?     │
    ┌─────────────┐                 └─────────────┘
    │ ใครว่าง?    │                       │
    └─────────────┘                  Yes ──┴── No
          │                           │        │
          ▼                           ▼        ▼
    ┌─────────────────────────┐   Complete   Escalate
    │ Staff Assignment Agent  │              to Human
    │ พิจารณา:                │
    │ • Workload ปัจจุบัน     │
    │ • Skill match           │
    │ • ความเชี่ยวชาญลูกค้า   │
    │ • SLA deadline          │
    └─────────────────────────┘
          │
          ▼
    มอบหมายให้ Staff ที่เหมาะสม
```

---

## 3. Workflow Integration (เชื่อมต่อ Workflow)

### 3.1 Enhanced Workflow with Agents

```typescript
interface EnhancedWorkflowStep {
  // Existing fields...

  // NEW: Agent Configuration
  agentConfig?: {
    enabled: boolean;
    agentType: AgentType;
    maxAttempts: number;
    fallbackToHuman: boolean;
    confidenceThreshold: number;  // ถ้า confidence < threshold ส่งต่อ human
  };

  // NEW: Auto-assignment
  autoAssignment?: {
    enabled: boolean;
    assignmentStrategy: 'round_robin' | 'least_loaded' | 'skill_match' | 'client_familiarity';
    skillsRequired?: string[];
    excludeStaffIds?: string[];
  };
}
```

### 3.2 Monthly Workflow Automation

```
┌─────────────────────────────────────────────────────────────────┐
│              MONTHLY ACCOUNTING WORKFLOW                        │
└─────────────────────────────────────────────────────────────────┘

วันที่ 1-5: Document Collection
    ├── Agent: Notification Agent ส่งแจ้งเตือนลูกค้า
    ├── Agent: Document Agent ตรวจรับเอกสาร
    └── Task: Staff ติดตามเอกสารที่ขาด

วันที่ 6-10: Processing
    ├── Agent: Document Agent วิเคราะห์ทุกเอกสาร
    ├── Agent: Reconciliation Agent จับคู่ Bank
    └── Task: Staff review เอกสาร low-confidence

วันที่ 11-15: Tax Filing
    ├── Agent: Tax Agent เตรียมแบบภาษี
    ├── Task: Senior review WHT certificates
    └── Task: Manager approve และยื่นภาษี

วันที่ 16-25: Period Closing
    ├── Agent: Closing Agent คำนวณค่าเสื่อม, accruals
    ├── Task: Staff บันทึกรายการปรับปรุง
    └── Task: Senior review Trial Balance

วันที่ 26-End: Reporting
    ├── Agent: Closing Agent สร้างงบการเงิน
    ├── Task: Manager review งบ
    └── Task: Partner sign-off
```

---

## 4. Staff Workload Dashboard

### 4.1 Real-time Workload Metrics

```typescript
interface StaffWorkload {
  staffId: string;
  staffName: string;
  role: StaffRole;

  // Current Tasks
  activeTasks: number;
  pendingTasks: number;
  overdueTasks: number;

  // Capacity
  maxCapacity: number;          // จำนวนงานสูงสุดที่รับได้
  utilizationPercent: number;   // % ของ capacity
  availableHours: number;       // ชั่วโมงว่างสัปดาห์นี้

  // Performance
  avgCompletionTime: number;    // ชั่วโมงเฉลี่ยต่องาน
  slaCompliance: number;        // % งานเสร็จใน SLA
  qualityScore: number;         // คะแนนคุณภาพ (จาก review)

  // Skills & Specialization
  skills: string[];             // ความเชี่ยวชาญ
  preferredClients: string[];   // ลูกค้าที่ดูแลประจำ

  // Today's Status
  tasksCompletedToday: number;
  estimatedHoursRemaining: number;
}
```

### 4.2 Assignment Visualization

```
┌─────────────────────────────────────────────────────────────────┐
│                 STAFF WORKLOAD OVERVIEW                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  👤 สมชาย (Senior)     ████████████░░░░ 75%  [12/16 tasks]    │
│     🔴 3 overdue       ⚠️ Tax filing deadline                  │
│                                                                 │
│  👤 สมหญิง (Senior)    ██████████████░░ 85%  [14/16 tasks]    │
│     ✅ On track        🏆 Top performer                        │
│                                                                 │
│  👤 วิชัย (Junior)     ██████░░░░░░░░░░ 40%  [6/15 tasks]     │
│     ✅ Available       📚 Training period                      │
│                                                                 │
│  👤 มานี (Junior)      ████████████░░░░ 70%  [10/15 tasks]    │
│     🟡 1 at risk       📋 Bank recon focus                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Implementation Phases

### Phase 1: Foundation (2-3 สัปดาห์)
- [ ] สร้าง Task Management Types และ Service
- [ ] เพิ่ม Task Collection ใน Firestore
- [ ] สร้าง TaskBoard UI component
- [ ] เพิ่ม Task CRUD operations

### Phase 2: Agent Framework (2-3 สัปดาห์)
- [ ] สร้าง Agent Base Class
- [ ] Implement Agent Orchestrator
- [ ] สร้าง Agent Execution Logger
- [ ] เพิ่ม Agent Status UI

### Phase 3: Smart Assignment (1-2 สัปดาห์)
- [ ] Implement Task Assignment Agent
- [ ] สร้าง Workload Calculator
- [ ] เพิ่ม Auto-assignment rules
- [ ] สร้าง Assignment Dashboard

### Phase 4: Specialized Agents (3-4 สัปดาห์)
- [ ] Enhance Document Agent
- [ ] Build Tax Agent
- [ ] Build Reconciliation Agent
- [ ] Build Closing Agent

### Phase 5: Notifications (1-2 สัปดาห์)
- [ ] Implement Notification Agent
- [ ] Email integration
- [ ] In-app notifications
- [ ] Daily digest reports

---

## 6. Key Files to Create/Modify

### New Files
```
services/
├── agents/
│   ├── agentOrchestrator.ts    # ควบคุม agents
│   ├── documentAgent.ts         # วิเคราะห์เอกสาร
│   ├── taxAgent.ts              # คำนวณภาษี
│   ├── reconciliationAgent.ts   # กระทบยอด
│   ├── closingAgent.ts          # ปิดงวด
│   ├── taskAssignmentAgent.ts   # มอบหมายงาน
│   └── notificationAgent.ts     # แจ้งเตือน
├── taskManagement.ts            # Task CRUD
└── workloadCalculator.ts        # คำนวณ workload

components/
├── TaskBoard.tsx                # Kanban board
├── TaskDetail.tsx               # รายละเอียดงาน
├── TaskAssignment.tsx           # มอบหมายงาน
├── WorkloadDashboard.tsx        # ดู workload
└── AgentMonitor.tsx             # ดูสถานะ agents

types/
└── agents.ts                    # Agent types
└── tasks.ts                     # Task types
```

### Files to Modify
```
types.ts                         # เพิ่ม Task, Agent types
services/workflow.ts             # เพิ่ม agent integration
services/automation.ts           # เชื่อมกับ agents
App.tsx                          # เพิ่ม routes และ state
components/Sidebar.tsx           # เพิ่ม menu items
```

---

## 7. Database Schema Updates

### New Collections

```typescript
// tasks collection
{
  id: string,
  title: string,
  description: string,
  category: TaskCategory,
  assignedTo: string,
  clientId?: string,
  status: TaskStatus,
  priority: Priority,
  dueDate: string,
  createdAt: string,
  updatedAt: string,
  // ... other fields
}

// agent_executions collection
{
  id: string,
  agentType: AgentType,
  status: AgentStatus,
  input: any,
  output: any,
  startedAt: string,
  completedAt?: string,
  humanReviewRequired: boolean,
  auditLog: AgentAction[]
}

// notifications collection
{
  id: string,
  recipientId: string,
  type: NotificationType,
  title: string,
  message: string,
  priority: Priority,
  status: 'pending' | 'sent' | 'read',
  createdAt: string,
  sentAt?: string,
  readAt?: string
}
```

---

## 8. API Endpoints (Cloud Functions)

### New Endpoints
```
POST /api/tasks                  # สร้าง task
GET  /api/tasks                  # ดึง tasks
PUT  /api/tasks/:id              # อัปเดต task
POST /api/tasks/:id/assign       # มอบหมายงาน
POST /api/tasks/:id/complete     # เสร็จงาน

POST /api/agents/execute         # สั่ง agent ทำงาน
GET  /api/agents/status          # ดูสถานะ agents
POST /api/agents/escalate        # ส่งต่อ human

GET  /api/staff/workload         # ดู workload
GET  /api/staff/:id/tasks        # งานของ staff
```

---

## 9. Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| % งานที่ AI ทำได้ | 20% | 60% |
| เวลาเฉลี่ยต่อเอกสาร | 10 นาที | 3 นาที |
| SLA Compliance | 75% | 95% |
| Staff Utilization | Unknown | 80% |
| Manual Intervention | 80% | 30% |

---

*Document Version: 1.0*
*Created: 2024*
*For: We Accounting & Tax AI System*
