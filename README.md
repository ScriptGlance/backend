<div align="center">

# 🎬 ScriptGlance Backend

*Collaborative teleprompter platform for presentations*

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/nestjs-%23E0234E.svg?style=for-the-badge&logo=nestjs&logoColor=white)](https://nestjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/redis-%23DD0031.svg?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)
[![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)

---

**ScriptGlance** is a collaborative video presentations platform with a focus on advanced teleprompter functionality, as well as real-time features including authentication, presentation management, video processing, chat, and payment integration.

</div>

---

<table>
<tr>
<td width="50%" valign="top">

### 🔐 **Authentication & Authorization**
- 🔑 JWT-based authentication  
- 🌐 Google OAuth integration  
- 📘 Facebook OAuth integration  
- 👥 Role-based access control (User, Moderator, Admin)  
- 📧 Email verification and password reset  

### 📋 **Presentation Management**
- ➕ Create and manage presentations  
- 🤝 Collaborative presentation parts  
- 👫 Participant management  
- ⚡ Real-time presentation control  

### ✏️ **Real-time Collaborative Text Editing**
- 🔄 Operational Transformation (OT) for conflict-free collaborative editing  
- 👥 Multiple users editing presentation content simultaneously  
- 🎯 Character-level synchronization  
- 🖱️ Real-time cursor positions and user presence  

### 📺 **Teleprompter System**
- 🎯 Real-time reading position tracking
- 👑 Dynamic ownership management
- 🔄 Automatic part transitions
- ⏰ Reading confirmation system with timeouts
- 🔔 Part reassignment notifications
- 📊 Session state management with Redis
- 🎥 Video recording integration tracking
- 👥 Multi-user session handling

</td>
<td width="50%" valign="top">

### 🎥 **Video Processing**
- 📤 Video upload and processing with FFmpeg  
- 🖼️ Video preview generation  
- 🔗 Shared video functionality  
- 🗂️ File serving for avatars and previews  

### 💬 **Real-time Communication**
- 🔌 WebSocket support with Socket.IO  
- 💭 Live chat functionality  
- 🔔 Real-time notifications  
- 🎬 Presentation synchronization  
- ✏️ Collaborative text editing synchronization  

### 💳 **Payment Integration**
- ⭐ Premium subscription management  
- 💰 Payment processing  
- 📊 Transaction tracking  
- 🔄 Subscription lifecycle management  

### ⚙️ **Admin Features**
- 👤 User management  
- 📨 Invitation system  
- 🛡️ Moderation tools  
- 📈 Analytics and monitoring  

</td>
</tr>
</table>


---

## 🛠️ Tech Stack

<div align="center">

| Category | Technologies |
|----------|-------------|
| **Framework** | ![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=flat-square&logo=nestjs&logoColor=white) |
| **Language** | ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white) |
| **Database** | ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-336791?style=flat-square&logo=postgresql&logoColor=white) ![TypeORM](https://img.shields.io/badge/TypeORM-FE0803?style=flat-square&logo=typeorm&logoColor=white) |
| **Cache** | ![Redis](https://img.shields.io/badge/Redis-DC382D?style=flat-square&logo=redis&logoColor=white) |
| **Authentication** | ![Passport](https://img.shields.io/badge/Passport-34E27A?style=flat-square&logo=passport&logoColor=white) (JWT, Google, Facebook) |
| **Real-time** | ![Socket.IO](https://img.shields.io/badge/Socket.IO-010101?style=flat-square&logo=socket.io&logoColor=white) |
| **Video Processing** | ![FFmpeg](https://img.shields.io/badge/FFmpeg-007808?style=flat-square&logo=ffmpeg&logoColor=white) |
| **Documentation** | ![Swagger](https://img.shields.io/badge/Swagger-85EA2D?style=flat-square&logo=swagger&logoColor=black) |
| **Email** | ![Email](https://img.shields.io/badge/Resend-000000?style=flat-square&logo=mail.ru&logoColor=white) |
| **Notifications** | ![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=flat-square&logo=firebase&logoColor=black) |
| **Collaborative Editing** | ![OT](https://img.shields.io/badge/Operational_Transformation-4285F4?style=flat-square&logo=google&logoColor=white) |

</div>

---

## 📋 Prerequisites

<div align="center">

| Requirement | Version | Status |
|-------------|---------|--------|
| ![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white) | Latest | ✅ Required |
| ![Docker Compose](https://img.shields.io/badge/Docker_Compose-2496ED?style=flat-square&logo=docker&logoColor=white) | Latest | ✅ Required |
| ![Git](https://img.shields.io/badge/Git-F05032?style=flat-square&logo=git&logoColor=white) | Latest | ✅ Required |

</div>

---

## 🚀 Quick Start

### 📥 Installation

```bash
# Clone the repository
git clone https://github.com/ScriptGlance/backend.git
cd backend

# Create the environment file
touch .env
# Edit .env with your configuration (see the example configuration below)
```

### ⚙️ Environment Configuration

Create a `.env` file in the root directory:

<details>
<summary>📄 Click to expand environment variables</summary>

```env
# 🗄️ Database Configuration
DB_HOST=db
DB_PORT=5432
DB_USERNAME=scriptglance
DB_PASSWORD=your_secure_db_password
DB_NAME=scriptglance

# 🔧 Application Settings
DEBUG=false
JWT_SECRET=your-super-secret-jwt-key-here
FRONTEND_URL=http://localhost:3001
BACKEND_URL=http://localhost:3000

# 📧 Email Configuration (Resend)
RESEND_API_KEY=re_your_resend_api_key
FROM_EMAIL=noreply@scriptglance.com
EMAIL_SENDER_NAME=ScriptGlance

# 🌐 Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
SUCCESS_LOGIN_REDIRECT_URL=http://localhost:3001/dashboard

# 📘 Facebook OAuth
FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret
FACEBOOK_CALLBACK_URL=http://localhost:3000/auth/facebook/callback
FACEBOOK_NO_LINKED_EMAIL_ERROR_REDIRECT_URL=http://localhost:3001/auth/facebook-email-error

# 🔴 Redis Configuration
REDIS_URL=redis://redis:6379

# 💳 Payment Integration
PAYMENTS_API_TOKEN=your-payment-api-token
PAYMENTS_API_URL=https://api.payment-provider.com
SUBSCRIPTION_CHECKOUT_REDIRECT_URL=http://localhost:3001/subscription/success
PAYMENTS_WEBHOOK_URL=http://localhost:3000/payments/webhook

# 🔥 Firebase Configuration (for notifications)
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour-Private-Key-Here\n-----END PRIVATE KEY-----\n"
```

</details>

---

## 🐳 Running with Docker Compose

<div align="center">

### 🎯 Main Commands

| Command | Description | Icon |
|---------|-------------|------|
| `docker-compose up -d` | Start all services | 🟢 |
| `docker-compose down` | Stop all services | 🔴 |
| `docker-compose up --build -d` | Rebuild and restart | 🔄 |

</div>

### 📊 Service URLs

<div align="center">

| Service | URL | Description |
|---------|-----|-------------|
| 🌐 **API** | http://localhost:3000 | Main API endpoint |
| 📖 **Swagger Docs** | http://localhost:3000/docs | API documentation |
| 🗄️ **PostgreSQL** | localhost:5432 | Database connection |
| 🔴 **Redis** | localhost:6379 | Cache connection |

</div>

### 🛠️ Docker Services

<div align="center">

| Service | Technology | Purpose |
|---------|------------|---------|
| **app** | ![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=flat-square&logo=nestjs&logoColor=white) | Backend application |
| **db** | ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-336791?style=flat-square&logo=postgresql&logoColor=white) | Database server |
| **redis** | ![Redis](https://img.shields.io/badge/Redis-DC382D?style=flat-square&logo=redis&logoColor=white) | Cache server |

</div>

---

## 📚 API Documentation

<div align="center">

🎯 **Interactive API Documentation**

Once the application is running, explore the full API at:
**[http://localhost:3000/docs](http://localhost:3000/docs)**

*Complete with request/response schemas and authentication examples*

</div>

---

## 🏗️ Project Architecture

```
📁 src/
├── ⚙️ admin/                  # Admin functionality
├── 🔐 auth/                  # Authentication module
├── 💬 chat/                  # Real-time chat
├── 🔧 common/                # Shared utilities
├── 📧 email/                 # Email services
├── 📄 migrations/            # Database migrations
├── 🛡️ moderator/             # Moderator functionality
├── 🔔 notifications/         # Notifications module
├── 💳 payments/              # Payment processing
├── 📋 presentations/         # Presentation management
├── 🎥 shared-video/          # Shared videos module
├── 👤 user/                  # User management
├── app.module.ts            # Main app module
└── main.ts                  # Application bootstrap
```

---

## 🔐 Authentication Methods

<div align="center">

### 🎫 Supported Authentication

| Method | Type | Usage |
|--------|------|-------|
| **JWT Bearer** | `Authorization: Bearer <token>` | ![JWT](https://img.shields.io/badge/JWT-000000?style=flat-square&logo=jsonwebtokens&logoColor=white) |
| **Google OAuth** | OAuth 2.0 Flow | ![Google](https://img.shields.io/badge/Google-4285F4?style=flat-square&logo=google&logoColor=white) |
| **Facebook OAuth** | OAuth 2.0 Flow | ![Facebook](https://img.shields.io/badge/Facebook-1877F2?style=flat-square&logo=facebook&logoColor=white) |

</div>

---

## 🌐 WebSocket Events
<div align="center">
<table>
<tr>
<td width="50%">

### ✏️ **Collaborative Text Editing**
- 🔄 OT operations for text changes
- 🖱️ Real-time cursor tracking
- 🎯 Text selection synchronization
- 👥 User presence in editing session

### 🎬 **Presentation Control**
- 📊 Presentation state changes
- 🔄 Part transitions
- 🎥 Video synchronization

</td>
<td width="50%">

### 💬 **Chat & Notifications**
- 💭 Chat messages
- 🔄 Chat state changes

### 📺 **Teleprompter**
- 👥 User presence in teleprompter session
- 📍 Current reading position
- 👑 Owner change events
- 🔄 Presentation parts reassign events
- ⏰ Reading confirmation events
- 🎥 Recording mode changes
- 📊 Recorded videos count tracking
- ⚠️ Part reassignment notifications
- ⏸️ Waiting for user events

</td>
</tr>
</table>
</div>

---

## 🔄 Operational Transformation (OT)

<div align="center">

### 🧠 How OT Works

</div>

| Step | Process | Description |
|------|---------|-------------|
| **1️⃣** | **Operations** | Each text change → operation (insert, delete, retain) |
| **2️⃣** | **Transformation** | Conflicting operations → transformed for consistency |
| **3️⃣** | **Application** | Transformed operations → applied to document state |
| **4️⃣** | **Synchronization** | All clients → receive operations in correct order |

### 🎯 Operation Types

<div align="center">

| Operation | Purpose |
|-----------|---------|
| **Insert** | Add text at specific position |
| **Delete** | Remove text from specific position |
| **Retain** | Keep existing text (positioning) |

</div>

### 💡 Example Flow

```javascript
// 👤 User A types "Hello" at position 0
// 👤 User B simultaneously types "Hi" at position 0
// 🔄 OT transforms operations → consistent state across all clients
```

---

## 🎯 Real-time Features

<div align="center">
<table>
<tr>
<td width="50%" valign="top">

### ✏️ **Text Editing Collaboration**
- 👥 Multiple simultaneous editors
- 🖱️ Real-time cursor positions
- 🎯 User presence indicators
- 🔄 Conflict-free collaborative editing

### 📺 **Teleprompter Synchronization**
- 🎯 Real-time reading position tracking
- 👑 Dynamic ownership management
- 🔄 Automatic part transitions
- ⏰ Reading confirmation system
- 🔔 Push notification integration

</td>
<td width="50%" valign="top">

### 🎬 **Presentation Synchronization**
- ⚡ Real-time presentation control
- 🎥 Synchronized video playback
- 👫 Participant management
- 🔔 Live notifications

### 💬 **Communication**
- 💭 Live chat functionality
- 🔔 Real-time notifications
- 👥 User presence tracking

</td>
</tr>
</table>
</div>

---

<div align="center">
  
**Built with ❤️ for seamless collaboration**

[![TypeScript](https://img.shields.io/badge/Made%20with-TypeScript-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/Powered%20by-NestJS-red?style=for-the-badge&logo=nestjs)](https://nestjs.com/)

</div>
