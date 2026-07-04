# StreamSync — Collaborative Code + Canvas Workspace

## Architecture Overview

### Client Layer (Browser)
- Monaco Editor (`y-monaco` binding)
- Yjs CRDT (`Y.Text` + `Y.Map`)
- Canvas Engine (`Konva.js` + `Y.Map`)
- Awareness (cursors, users)

### Shared CRDT Model — One Yjs Doc, Two Data Types
- `Y.Text` → code buffer
- `Y.Map` → canvas graph
- Both are linked inside the same Yjs document

### Transport Layer
- WebSocket Server (Node.js + ws)
- Redis Pub/Sub (cross-instance sync)
- Session Manager (rooms, permissions)

### Server Layer
- Doc Service (snapshot, validate)
- Canvas Service (shape operations, history)
- Link Engine (canvas ↔ file sync)
- AI Service (Claude API)

### Persistence Layer
- PostgreSQL (users, rooms, snapshots)
- Redis (hot doc + canvas state)
- MinIO / S3 (binary snapshots)

---

## Core Innovation

The key insight in this architecture is the **shared CRDT model layer** — both the code buffer (`Y.Text`) and the canvas graph (`Y.Map`) live inside a single Yjs document.

This makes the **Link Engine** possible:

- Canvas nodes can reference files.
- File changes automatically update canvas nodes.
- Canvas interactions can generate or modify files.
- Everything stays synchronized through a shared CRDT state.

This is the primary differentiator from standard collaborative editors.

---

# Development Roadmap

## Phase 1 — Foundation

### Week 1: Editor Shell, Single-User Baseline

No collaboration yet. Build a stable editor before introducing distributed state.

#### Deliverables
- React + Monaco Editor
- Syntax highlighting for:
  - JavaScript
  - Python
  - Go
- File tabs UI
- Local-only save
- Node.js + Express backend skeleton
- Docker Compose:
  - PostgreSQL
  - Redis

---

### Week 2: WebSocket Rooms + JWT Authentication

Build the transport layer before touching CRDT.

#### Deliverables
- WebSocket server using `ws`
- Clients grouped by document ID
- JWT issued on login
- JWT validated during socket handshake
- Verify two browser tabs join the same room

---

## Phase 2 — Editor CRDT

### Week 3: Yjs + Monaco Binding

The first difficult week.

#### Deliverables
- Integrate `y-monaco`
- Sync Monaco text model with `Y.Text`
- Local multi-tab editing
- Verify merge resolution correctness
- Study YATA algorithm internals

---

### Week 4: Network Sync + Reconnection

Replace default providers with custom infrastructure.

#### Deliverables
- Custom WebSocket provider
- Broadcast Yjs updates to room members
- Test with 3+ simultaneous editors
- Reconnection handling
- State reconciliation after disconnect

---

### Week 5: Presence — Cursors and Selections

Make collaboration feel like Google Docs.

#### Deliverables
- Yjs Awareness protocol
- Cursor position broadcasting
- Selection range synchronization
- Colored remote cursors
- Username labels
- Active users list

---

### Week 6: Persistence + Snapshotting

**Milestone 1**

At this point you have a fully functional collaborative editor.

#### Deliverables
- Periodic Yjs snapshots

```js
Y.encodeStateAsUpdate()
```

- Snapshot storage in PostgreSQL
- Update replay system
- Redis hot cache
- PostgreSQL cold storage

---

## Phase 3 — Canvas CRDT

### Week 7: Canvas Engine — Local Single User

Build the canvas independently first.

#### Deliverables
- Konva.js canvas panel
- Boxes
- Circles
- Arrows
- Dragging
- Resizing
- Shape labels
- Directed connections
- Store state in `Y.Map`
- Shared Yjs document with editor

---

### Week 8: Canvas Collaboration

Second difficult week.

#### Deliverables
- Synchronize canvas via WebSocket
- Shared `Y.Map`
- Last-write-wins for positions
- CRDT merge for labels
- Remote canvas cursors
- Snapshot and restore support

---

### Week 9: Link Engine — Bidirectional Binding

**Milestone 2**

This is the project's unique interview talking point.

#### Deliverables
- Shapes contain optional `fileId`
- `fileId` stored in shape's `Y.Map`
- Clicking shape opens linked file
- File rename updates canvas labels
- Shared Yjs observers
- Drag shape into editor:
  - Automatically scaffold new file

---

## Phase 4 — AI Layer

### Week 10: AI Pair Programmer

Not a chatbot.

An inline coding assistant integrated directly into editing flow.

#### Deliverables
- Keyboard shortcut
- Send:
  - Selected code
  - File context
- Claude API integration
- Monaco ghost text suggestions
- Accept with `Tab`
- Dismiss with `Esc`
- Per-room rate limiting

---

## Phase 5 — Polish

### Week 12: Rooms, Sharing, Permissions

#### Deliverables
- Shareable room links
- View-only permission mode
- Edit permission mode
- Room creation dashboard
- Recent rooms list
- Canvas export to PNG
- Editor files export to ZIP

---

### Week 13: Load Testing — Get Your Numbers

Your resume metrics come from this phase.

#### Deliverables
- Concurrent user simulation script
- Simulate N users editing:
  - Editor
  - Canvas
  - Simultaneously
- Measure:
  - Editor sync latency
  - Canvas sync latency
  - Reconnection time
  - AI response round-trip
- Benchmark documentation

#### Outcome
These become:
- Resume metrics
- Interview performance numbers
- Scalability proof points

---

### Week 14: Deployment, Demo Video, README

**Milestone 3 — Ship**

A live deployment matters. Interviewers will open it.

#### Deployment
- Backend:
  - Railway or Render
- Frontend:
  - Vercel
- Managed PostgreSQL
- Managed Redis

#### Demo Video
Create a 90-second demonstration showing:

- Two browser windows
- Real-time editor synchronization
- Real-time canvas synchronization
- Link engine functionality
- Presence indicators
- AI pair programmer

#### README

Include:

- Architecture diagram
- Setup instructions
- Local development guide
- Deployment guide
- Benchmark results
- Screenshots
- Demo video link

---

# Final Deliverables

## Milestone 1
Collaborative code editor featuring:

- CRDT synchronization
- Presence awareness
- Snapshot recovery
- Multi-user editing

---

## Milestone 2
Collaborative canvas system featuring:

- Shared canvas graph
- Shape collaboration
- File ↔ Canvas linking
- Bidirectional synchronization

---

## Milestone 3
Production-ready platform featuring:

- Real-time collaborative editor
- Collaborative canvas workspace
- Link engine
- AI pair programmer
- Authentication
- Sharing & permissions
- Benchmark metrics
- Cloud deployment

---

# Suggested Tech Stack

## Frontend
- React
- TypeScript
- Monaco Editor
- Yjs
- y-monaco
- Konva.js
- Zustand
- Tailwind CSS

## Backend
- Node.js
- Express
- ws
- JWT
- Redis
- PostgreSQL

## Storage
- PostgreSQL
- Redis
- MinIO / S3

## Infrastructure
- Docker
- Railway / Render
- Vercel

## AI
- Claude API

---

# Project USP

Most collaborative editors stop at:

- Shared code editing

Most whiteboard tools stop at:

- Shared canvas editing

**StreamSync combines both into a single CRDT document and introduces a Link Engine that synchronizes files and canvas nodes bidirectionally.**

That shared Yjs document is the architectural advantage that makes the project stand out in interviews.