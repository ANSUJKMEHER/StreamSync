# StreamSync Architecture

This document describes the core architecture of StreamSync, specifically focusing on the real-time collaborative editing engine (Yjs + Monaco Editor + WebSockets + PostgreSQL), and the specific race conditions and bugs that were solved to achieve a perfectly stable synchronization.

## 1. The Real-Time Synchronization Engine

StreamSync uses **Yjs** (a CRDT - Conflict-free Replicated Data Type framework) to ensure mathematical eventual consistency between all connected users.

### The Stack:
- **Client Editor:** `@monaco-editor/react`
- **Client CRDT:** `yjs` + `y-monaco`
- **Networking:** Custom WebSocket server multiplexing JSON messages.
- **Server:** Node.js WebSocket server (`ws`) handling Yjs documents in memory.
- **Database:** PostgreSQL (via Prisma) to persist the CRDT state when the room is saved or destroyed.

---

## 2. The WebSocket Lifecycle & Handshake

To prevent race conditions where a client receives data before they are fully authorized, the server strictly enforces a **JoinLock**.

### Step 1: Connecting and Joining
1. The client establishes a WebSocket connection using a JWT token.
2. The client sends a `join-room` message containing the `roomId` (Workspace ID).
3. **SERVER LOCK:** The server queries the database (`prisma.room.findUnique`) to verify permissions. While this is happening, the server places a **JoinLock** on the connection.

### Step 2: Document Sync (`sync-doc`)
1. As soon as the client opens a file tab, it sends a `sync-doc` request for that `docId` (File ID).
2. Because of the **Message Queue** implemented on the client, if the WebSocket is still in the `connecting` phase, the `sync-doc` message is queued and safely flushed the millisecond the socket opens.
3. On the server, `sync-doc` **awaits the JoinLock**. It guarantees the client has been fully verified and added to the broadcasting room before it fetches the `Y.Doc` and sends back the `yjs-sync` state.

### Step 3: Real-Time Typing (`yjs-update`)
1. When a user types, Yjs generates an update array.
2. The client broadcasts this via `yjs-update`.
3. The server validates the user's `EDIT` permissions (which also respects the JoinLock).
4. The server applies the update to its in-memory `Y.Doc`.
5. The server broadcasts the update to all *other* users currently in the room.

---

## 3. Critical Fixes & Edge Cases Solved

### A. The "File vs Room" Routing Bug
**Symptom:** Clients were silently rejected from joining the WebSocket room, resulting in zero collaboration and missing cursors.
**Cause:** The backend `joinRoom` function was querying the `File` table instead of the `Room` (Workspace) table for the `roomId`.
**Fix:** Refactored `joinRoom` to correctly query `prisma.room` and validate workspace-level collaborators.

### B. The Connection Race Condition (Dropped Messages)
**Symptom:** Cursors showed up, but text content was completely missing for the second user who joined.
**Cause:** The frontend sent `sync-doc` exactly when the `WebSocket` object was instantiated but not yet `OPEN`. The message was silently dropped into the void. The user never got the base file text, and when they started typing, their text was inserted at offset 0, completely destroying the document structure.
**Fix:** Implemented a robust `messageQueue` in `websocket.ts`. All messages sent during the `connecting` phase are buffered and flushed sequentially inside `socket.onopen`.

### C. The Server JoinLock Race Condition
**Symptom:** User B types, User A never sees the changes, even though they are in the same room.
**Cause:** Node.js processed `sync-doc` instantly but took a few milliseconds to process the database query for `join-room`. User B started sending typing updates *before* the server officially placed them into the broadcasting room array.
**Fix:** Implemented `waitForJoinLock` in `socketHandler.ts`. The server now forces `sync-doc` and `awareness-update` events to pause in the event loop until the `joinRoom` database query successfully finishes.

### D. The Yjs CRDT Offset Drift (CRLF vs LF)
**Symptom:** User A types on Line 97, but the text magically appears on Line 100 for User B.
**Cause:** Windows Monaco Editor uses `\r\n` (CRLF) for newlines (2 invisible characters), while Yjs and the GitHub imported code use `\n` (LF) (1 invisible character). Because Monaco used CRLF, every newline shifted the mathematical CRDT offset by 1 character. By line 97, the offset had drifted by 96 characters (roughly 3 lines of code), causing the CRDT engine to inject the updates into the wrong line on remote screens.
**Fix:** Injected `model.setEOL(0)` (which maps to `EndOfLineSequence.LF`) into `MonacoEditor.tsx` right before the `y-monaco` binding occurs. This brutally forces Monaco to use Linux line endings on all operating systems, maintaining perfect 1:1 character parity with the Yjs network layer.

---

## 4. Current File Structure

- **`client/src/services/websocket.ts`:** Manages the WebSocket connection, auto-reconnects, and queues messages during the handshake.
- **`client/src/services/yjsService.ts`:** Manages the Map of local `Y.Doc` instances, handles awareness (cursors), and multiplexes network updates into Yjs updates.
- **`client/src/components/Editor/MonacoEditor.tsx`:** The view layer. Forces LF line endings, dynamically sets the model, and binds `y-monaco` to the Yjs Document.
- **`server/src/websocket/socketHandler.ts`:** The entry point for WebSocket connections. Routes messages and enforces `waitForJoinLock`.
- **`server/src/websocket/roomManager.ts`:** The state machine. Manages `Y.Doc` instances in memory, queries PostgreSQL for permissions, and broadcasts updates cleanly to connected clients.
