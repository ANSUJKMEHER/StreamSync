<div align="center">
  <img src="https://raw.githubusercontent.com/tandpfun/skill-icons/main/icons/React-Dark.svg" width="60" alt="React" />
  <img src="https://raw.githubusercontent.com/tandpfun/skill-icons/main/icons/NodeJS-Dark.svg" width="60" alt="Node" />
  <img src="https://raw.githubusercontent.com/tandpfun/skill-icons/main/icons/TypeScript.svg" width="60" alt="TypeScript" />
  <img src="https://raw.githubusercontent.com/tandpfun/skill-icons/main/icons/PostgreSQL-Dark.svg" width="60" alt="PostgreSQL" />
  
  <br />
  <br />

  # ⚡ StreamSync

  **A Real-Time, AI-Powered Collaborative Workspace for Modern Engineering Teams**

  StreamSync is a fully-featured, multiplayer workspace combining live code collaboration, remote/local code execution, and an infinite canvas powered by state-of-the-art AI. Break down silos and build together, in real-time.

  [![React](https://img.shields.io/badge/React-18-blue.svg?style=flat&logo=react)](https://reactjs.org/)
  [![Node.js](https://img.shields.io/badge/Node.js-Express-green.svg?style=flat&logo=node.js)](https://nodejs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg?style=flat&logo=typescript)](https://www.typescriptlang.org/)
  [![Yjs](https://img.shields.io/badge/CRDTs-Yjs-orange.svg?style=flat)](https://yjs.dev/)
  [![Gemini](https://img.shields.io/badge/AI-Gemini%202.5-purple.svg?style=flat&logo=google)](https://deepmind.google/technologies/gemini/)

</div>

<hr />

## 🌟 The Core Innovation: Shared CRDT & Link Engine

The key insight in StreamSync's architecture is the **shared CRDT model layer**. Both the code buffer (`Y.Text`) and the infinite canvas graph (`Y.Map`) live inside a single Yjs document.

This architectural advantage enables the **Link Engine**:
- Canvas nodes can intuitively reference actual files in the workspace.
- Changes in the file tree automatically update related canvas nodes.
- Canvas interactions can seamlessly generate or modify files.
- Everything stays mathematically synchronized through the shared CRDT state, achieving perfect eventual consistency.

---

## 🏗️ Architecture & Data Flow

StreamSync utilizes a powerful Client-Server model that synchronizes Yjs CRDTs via a custom WebSocket multiplexer.

```mermaid
graph TD
    subgraph Client
        M[Monaco Editor] <-->|y-monaco| Y[Yjs CRDT Document]
        K[Konva Canvas] <-->|Y.Map| Y
        E[Execution UI] --> M
    end
    
    subgraph Network
        WS[WebSocket Multiplexer] <-->|Binary Updates| Y
    end
    
    subgraph Server
        WS <--> SM[Session / Room Manager]
        SM <-->|Auth & State| P[Prisma ORM]
        SM --> CE[Hybrid Execution Engine]
        SM --> AI[Gemini API Route]
    end
    
    subgraph Infrastructure
        P <--> DB[(PostgreSQL)]
        CE -->|Local Process| G[g++ / Python / Node]
        CE -->|External API| J[Judge0 Fallback]
    end
    
    classDef primary fill:#2563eb,stroke:#1d4ed8,stroke-width:2px,color:#fff;
    classDef secondary fill:#059669,stroke:#047857,stroke-width:2px,color:#fff;
    classDef database fill:#ea580c,stroke:#c2410c,stroke-width:2px,color:#fff;
    
    class Y,SM primary;
    class CE,AI secondary;
    class DB database;
```

### Critical Concurrency Fixes Solved

1. **The Server JoinLock Race Condition:** To prevent clients from broadcasting updates before they are fully authorized, the server places a strict `JoinLock` during the database permissions check, enforcing sequential message processing and preventing dropped initialization packets.
2. **CRDT Offset Drift Mitigation:** Different operating systems use different newline characters (CRLF vs LF), which fundamentally breaks mathematical CRDT offsets over time. StreamSync injects a forceful `model.setEOL(0)` into Monaco, enforcing Unix line endings globally and maintaining perfect sync accuracy.

---

## ✨ Features & Capabilities

### 👨‍💻 Multiplayer Code Editor
Write code together in real-time with zero friction.
- Built on top of **Monaco Editor**.
- Uses **Yjs** for true conflict-free resolution and live cursors.

### 🏃‍♂️ Intelligent Code Execution Engine
Instantly run code directly from your browser with a robust **hybrid execution pipeline**:

```mermaid
sequenceDiagram
    participant User
    participant Client
    participant Server
    participant LocalEngine
    participant Judge0

    User->>Client: Clicks "Run Code"
    Client->>Server: POST /api/execute (Language, Code)
    Server->>Server: Validate Payload & Language
    alt If External Judge0 Configured
        Server->>Judge0: Forward Request
        Judge0-->>Server: Return Execution Output
    else No Judge0 / Fallback
        Server->>LocalEngine: Spawn child_process (g++, python, node)
        LocalEngine-->>Server: stdout / stderr
    end
    Server-->>Client: Return Results
    Client-->>User: Display Output in Terminal Panel
```

### 🎨 Collaborative Infinite Canvas & 🤖 AI Integration
- **Infinite Canvas:** Powered by `Konva.js`. Synchronized perfectly for all connected peers.
- **AI Flowchart Generator:** Leverage the built-in **Gemini 2.5 Flash AI** to instantly analyze your workspace files and auto-generate complex architecture flowcharts directly onto your canvas.

### 🧩 Extensions Marketplace & 🔍 Global Workspace Search
- **Extensions Panel:** A built-in sidebar that simulates a marketplace, allowing users to discover and theoretically integrate new capabilities.
- **Global Search:** Regex-powered search across all workspace files with **Real-Time Line Reveal** (clicking a result scrolls the Monaco editor and flashes the exact line of code).

### 💎 Premium Design System
- Flexible CSS-variable-based design system with stunning premium themes like **Obsidian Gold** and **Nord Slate**.

---

## 📂 Project Structure

```text
📦 StreamSync
 ┣ 📂 client                  # Frontend App (Vite + React 19)
 ┃ ┣ 📂 src
 ┃ ┃ ┣ 📂 components          # React UI Components (Workspace, Sidebar, Editor)
 ┃ ┃ ┣ 📂 services            # Yjs & WebSocket connection managers
 ┃ ┃ ┣ 📂 store               # Zustand global state
 ┃ ┃ ┗ 📜 App.tsx             # Root Application
 ┃ ┗ 📜 package.json
 ┣ 📂 server                  # Backend API (Node.js + Express)
 ┃ ┣ 📂 src
 ┃ ┃ ┣ 📂 routes              # API Routes (Execute, AI, Auth, Rooms)
 ┃ ┃ ┣ 📂 websocket           # Yjs SocketHandler & RoomManager
 ┃ ┃ ┗ 📜 index.ts            # Server Entry Point
 ┃ ┣ 📂 prisma
 ┃ ┃ ┗ 📜 schema.prisma       # PostgreSQL Database Schema
 ┃ ┗ 📜 package.json
 ┗ 📜 README.md
```

---

## 🛠️ Technology Stack

| Layer | Technologies Used |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Tailwind CSS, Monaco Editor, Konva, Yjs, Zustand |
| **Backend** | Node.js, Express, WebSockets (`ws`), Prisma, bcryptjs, JWT |
| **Storage & DB** | PostgreSQL (via Prisma) |
| **Integrations** | Google Gemini 2.5 API, Judge0 API (Optional), GitHub OAuth |
| **Execution** | Node `child_process`, `g++`, `python3` |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v18+)
- **PostgreSQL Database** (e.g., Neon, Supabase, or local)
- **Local Compilers (Optional):** `python3` and `g++` (MinGW/GCC) installed in your PATH for local C/C++ execution.

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/ANSUJKMEHER/StreamSync.git
   cd StreamSync
   ```

2. **Setup Environment Variables**
   Create a `.env` file in the `server/` directory:
   ```env
   DATABASE_URL="your_postgresql_connection_string"
   JWT_SECRET="your_secure_jwt_secret"
   GEMINI_API_KEY="your_gemini_api_key"
   GITHUB_CLIENT_ID="your_github_oauth_client_id"
   GITHUB_CLIENT_SECRET="your_github_oauth_client_secret"
   
   # Optional: For external execution API
   RAPIDAPI_KEY="your_rapidapi_key"
   RAPIDAPI_HOST="judge0-ce.p.rapidapi.com"
   ```

3. **Install & Run (Unified Command)**
   From the **root** directory (`/StreamSync`), install dependencies and run both servers concurrently:
   ```bash
   npm run install:all
   npx prisma db push --schema=server/prisma/schema.prisma
   npm run dev
   ```

4. Navigate to `http://localhost:5173` in your browser.

---

## ☁️ Deployment

- **Frontend**: Optimized for [Vercel](https://vercel.com) or Netlify. Set `VITE_API_URL` to point to your backend.
- **Backend**: Deploy to [Render](https://render.com) or Heroku as a Node.js Web Service. Ensure the deployment environment has Python and GCC installed if utilizing the local execution engine.

---

## 🤝 Contributing
1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---
<div align="center">
  <i>Built with ❤️ for collaborative developers.</i>
</div>
