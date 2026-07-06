<div align="center">
  <img src="https://raw.githubusercontent.com/tandpfun/skill-icons/main/icons/React-Dark.svg" width="60" alt="React" />
  <img src="https://raw.githubusercontent.com/tandpfun/skill-icons/main/icons/NodeJS-Dark.svg" width="60" alt="Node" />
  <img src="https://raw.githubusercontent.com/tandpfun/skill-icons/main/icons/TypeScript.svg" width="60" alt="TypeScript" />
  <img src="https://raw.githubusercontent.com/tandpfun/skill-icons/main/icons/PostgreSQL-Dark.svg" width="60" alt="PostgreSQL" />
  
  <br />
  <br />

  # ⚡ StreamSync

  **A Real-Time, AI-Powered Collaborative Workspace for Modern Engineering Teams**

  StreamSync is a fully-featured, multiplayer workspace combining live code collaboration, remote code execution, and an infinite canvas powered by state-of-the-art AI. Break down silos and build together, in real-time.

  [![React](https://img.shields.io/badge/React-18-blue.svg?style=flat&logo=react)](https://reactjs.org/)
  [![Node.js](https://img.shields.io/badge/Node.js-Express-green.svg?style=flat&logo=node.js)](https://nodejs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg?style=flat&logo=typescript)](https://www.typescriptlang.org/)
  [![Yjs](https://img.shields.io/badge/CRDTs-Yjs-orange.svg?style=flat)](https://yjs.dev/)
  [![Gemini](https://img.shields.io/badge/AI-Gemini%202.5-purple.svg?style=flat&logo=google)](https://deepmind.google/technologies/gemini/)

</div>

<hr />

## ✨ Key Features

- **👨‍💻 Multiplayer Code Editor**: Write code together in real-time. Built with Monaco Editor and Yjs for true conflict-free resolution (CRDTs) and live cursors.
- **🏃‍♂️ Remote Code Execution**: Instantly run your code in the cloud across multiple languages (via Judge0).
- **🎨 Collaborative Infinite Canvas**: Draw architectures, flows, and brainstorm seamlessly. Synchronized perfectly for all connected peers.
- **🤖 AI Flowchart Generator**: Ask the built-in Gemini 2.5 Flash AI to analyze your workspace files and instantly auto-generate complex, interactive architecture flowcharts directly onto your canvas!
- **🔐 Secure Authentication**: Supports traditional credentials and GitHub OAuth for one-click onboarding.
- **📂 File System Management**: Full multi-file support with active file synchronization across sessions.

## 🛠️ Technology Stack

**Frontend**
- React 18 & TypeScript
- Tailwind CSS (v4) & Radix UI
- Monaco Editor (Code Editing)
- React Konva (Canvas)
- Zustand (State Management)
- Yjs (CRDTs for Real-time Sync)

**Backend**
- Node.js & Express
- WebSockets (ws protocol)
- Prisma (ORM)
- PostgreSQL (Hosted on Neon)
- Google Generative AI (Gemini 2.5)

---

## 🚀 Getting Started

Follow these instructions to get a local copy of StreamSync up and running.

### Prerequisites
- Node.js (v18+)
- npm or pnpm
- A PostgreSQL Database (e.g., Neon, Supabase)
- RapidAPI Key (for Judge0 code execution)
- Gemini API Key (from Google AI Studio)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/ANSUJKMEHER/StreamSync.git
   cd StreamSync
   ```

2. **Setup the Backend**
   ```bash
   cd server
   npm install
   ```
   Create a `.env` file in the `server/` directory:
   ```env
   DATABASE_URL="your_postgresql_connection_string"
   JWT_SECRET="your_secure_jwt_secret"
   RAPIDAPI_KEY="your_rapidapi_key"
   RAPIDAPI_HOST="judge0-ce.p.rapidapi.com"
   GITHUB_CLIENT_ID="your_github_oauth_client_id"
   GITHUB_CLIENT_SECRET="your_github_oauth_client_secret"
   GEMINI_API_KEY="your_gemini_api_key"
   ```
   Push the database schema and start the server:
   ```bash
   npx prisma db push
   npm run dev
   ```

3. **Setup the Frontend**
   Open a new terminal window:
   ```bash
   cd client
   npm install
   ```
   Create a `.env` file in the `client/` directory:
   ```env
   VITE_API_URL="http://localhost:3001"
   ```
   Start the frontend development server:
   ```bash
   npm run dev
   ```

4. **Open StreamSync**
   Navigate to `http://localhost:5173` in your browser.

---

## ☁️ Deployment

StreamSync is designed for cloud-native deployment:

- **Frontend**: Optimized for [Vercel](https://vercel.com). Just connect the repository, set the `VITE_API_URL` environment variable, and deploy!
- **Backend**: Easily deployed to [Render](https://render.com) or Heroku as a Node.js Web Service. Make sure to bind the WebSockets correctly and provide all `.env` variables in your provider's dashboard.

---

## 🤝 Contributing

Contributions make the open-source community an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---
<div align="center">
  <i>Built with ❤️ for developers.</i>
</div>
