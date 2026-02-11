# ServiceM8 ↔ HubSpot Bi-Directional Integration Middleware

## 📌 Project Overview

This project implements a **bi-directional integration** between **ServiceM8** and **HubSpot CRM** using a **Node.js middleware layer**.  
It ensures **real-time synchronization** of clients, jobs, deals, quotes, invoices, and activity data between both platforms while maintaining a **clean, selective sync strategy**.

The middleware acts as a **central control layer** for validation, transformation, retries, logging, and conflict handling.

---

## 🎯 Key Features

- Real-time sync between ServiceM8 and HubSpot  
- **Two-way contact/client synchronization**  
- **Selective job → deal sync** (not all jobs pushed to HubSpot)  
- Job status mapped to **HubSpot deal stages**  
- Quotes & invoices sync (configurable)  
- Activity notes & time tracking sync  
- Webhook-driven architecture  
- Retry logic, logging, and error handling  
- Scalable middleware-first architecture  

---

## 🧩 Platforms Integrated

### **ServiceM8**
Used for:
- Job management  
- Scheduling  
- Quotes  
- Invoices  
- Time tracking  
- Field operations  

### **HubSpot CRM**
Used for:
- Contacts & companies  
- Deals & pipelines  
- Workflow automation  
- Customer lifecycle tracking  

---

## 🔄 Sync Model

ServiceM8 ⇄ Middleware ⇄ HubSpot


### Sync Rules Summary

| Data Type | Sync Mode |
|----------|----------|
| Clients / Contacts | Two-way |
| Jobs / Deals | Two-way (Selective) |
| Job Status → Deal Stage | One-way |
| Quotes | Yes |
| Invoices | Optional |
| Notes / Activity | One-way or Selective Two-way |

---

## 📦 Objects Synced

### 👤 Clients / Contacts
- Create & update clients  
- Sync phone, email, address, company info  
- Two-way updates  

### 🛠 Jobs (Selective Sync)
> Only selected jobs sync to HubSpot to avoid CRM clutter.

- Job creation & updates  
- Job scheduling & assignments  
- Job status → HubSpot deal stage mapping  
- Booking data  
- Check-in / Check-out timestamps  
- Time tracking & work logs  

### 💰 Quotes
- Quote creation  
- Quote updates  

### 🧾 Invoices (Configurable)
- Invoice sync support  

### 📝 Notes & Activity
- Job activity logs  
- Customer interaction notes  

---

## 🧠 Business Logic Highlights

- Prevents syncing **every ServiceM8 job** to HubSpot  
- Automated **deal pipeline stage updates**  
- Conflict resolution rules for two-way sync  
- Field-level mapping via **mapping layer**  
- Middleware handles:
  - Validation  
  - Transformation  
  - Retries  
  - Logging  
  - Error tracking  

---

## 🏗 Project File Structure


```text

├── .github/
│ └── workflows/
│ └── deploy.yml # CI/CD deployment pipeline
│
├── logs/ # Application logs
├── node_modules/ # Dependencies
│
├── src/
│ ├── configs/ # Platform configuration files
│ │ ├── hubspot.config.js
│ │ └── serviceM8.config.js
│ │
│ ├── controllers/ # Request & webhook controllers
│ ├── jobs/ # Job-related handlers
│ │
│ ├── mappings/ # Field & object mapping logic
│ │ ├── hubspot.mapping.js
│ │ └── serviceM8.mapping.js
│ │
│ ├── services/ # External API service layers
│ │ ├── hubspot.service.js
│ │ └── serviceM8.service.js
│ │
│ ├── utils/ # Helpers, formatters, shared utilities
│ ├── webhooks/ # Webhook processors
│ │
│ ├── app.js # Express app setup
│ └── index.js # Server entry point
│
├── .env # Environment variables (not committed)
├── .env.example # Sample environment config
├── Dockerfile # Containerization setup
├── package.json # Dependencies & scripts
├── package-lock.json
├── README.md # Project documentation
└── serviceM8-hubspot.js # Integration bootstrap logic

```


---

## ⚙️ Environment Variables

Create a `.env` file using `.env.example`:

```env
SERVICE_M8_API_KEY=
SERVICE_M8_BASE_URL=

HUBSPOT_ACCESS_TOKEN=
HUBSPOT_BASE_URL=

PORT=3000
LOG_LEVEL=info

```


## 🚀 Setup & Installation
1️⃣ Install dependencies
```bash
npm install
```

2️⃣ Start server
```bash
npm start
```

3️⃣ Run in development mode
```bash
npm run dev
```

## 🔗 Webhook Flow

- ServiceM8 triggers webhook

- Middleware validates & transforms payload

- Mapping layer converts fields

- Data sent to HubSpot

- Response logged & retried if needed

### 🛡 Error Handling & Logging

- Structured logs stored in /logs

- Retry mechanism for API failures

- Rate-limit protection

- Safe failure handling to prevent sync loops

### 🔐 Security

- Secure API token handling

- Environment-based secret storage

- Payload validation

- Audit logging

- Webhook signature verification (if enabled)

### 📈 Future Enhancements

- Admin sync monitoring dashboard

- Full invoice lifecycle sync

- UI-based sync rule configuration

- Advanced conflict resolution

- Real-time event streaming

- Metrics & health dashboard

### 👨‍💻 Maintainer

#### Author: Md Saddam
#### Project Type: Enterprise Integration Middleware
#### Status: Active Development