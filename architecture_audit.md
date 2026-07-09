# StreamSync Architecture Audit

## 1. System Robustness & Strengths

The architecture incorporates several sophisticated patterns that make it highly robust against common real-time concurrency issues:

- **CRDT Synchronization (Yjs)**: Using Yjs natively solves the complex operational transform problems typical in collaborative editors. State merging is deterministic.
- **Race Condition Mitigations (JoinLocks)**: The `RoomManager` cleanly prevents authorization race conditions by using a `joinLocks` Promise map. A client cannot fetch or mutate a document while the database is still querying their permissions.
- **CRLF vs LF Drift Fix**: By globally forcing Monaco to use `model.setEOL(0)` (LF line endings), the system brilliantly side-steps the classic Yjs mathematical offset drift bug caused by Windows machines injecting `\r\n` characters.
- **Thundering Herd Protection**: The `pendingDocs` map in `RoomManager` ensures that if 100 users join a room simultaneously, the database is only hit *once* to seed the Yjs document, and the rest await the same promise.

---

## 2. Critical Problems & Vulnerabilities

While the real-time collaboration layer is robust, there are two major architectural flaws that need immediate attention.

> [!CAUTION]
> ### Problem 1: Remote Code Execution (RCE) Vulnerability
> The local execution fallback engine (`server/src/routes/execute.ts`) directly executes untrusted user code on the host machine using `child_process.exec()`. 
> 
> **Why this is bad**:
> - There is **no sandboxing**. A user can run Node, Python, or C++ code that reads environment variables (e.g., `process.env.DATABASE_URL`), deletes files, or opens reverse shells on your server.
> - **The Fix**: You must isolate the local execution engine using Docker containers (e.g., spinning up an ephemeral alpine container per execution) or use restricted sandboxes like `vm2` (for Node) and `isolate` / `nsjail` for C++/Python.

> [!WARNING]
> ### Problem 2: Canvas State Persistence Loss
> In `server/src/websocket/roomManager.ts` (Line 45), the auto-save loop explicitly skips saving the Canvas CRDT to PostgreSQL:
> `if (docId.startsWith('canvas-')) continue;`
> 
> Furthermore, when a room is destroyed (all users leave), the canvas document is simply deleted from memory. 
> 
> **Why this is bad**: 
> - If all users leave a room, or if the Node.js server restarts, **all canvas flowcharts and drawings are permanently lost**. The canvas data only exists in RAM.
> - **The Fix**: You need to update the Prisma schema to store canvas state (perhaps adding a `canvasState Bytes?` column to the `Room` model) and serialize the canvas Y.Doc just like you do for files.

## 3. Minor Areas for Improvement

- **WebSocket Reconnection Storms**: If the server goes down and comes back up, all clients will attempt to reconnect simultaneously. Adding a randomized backoff jitter on the client-side `WebSocket` reconnect logic will prevent overwhelming the server.
- **Large Document Memory Bounds**: Because the entire Y.Doc history is kept in memory and saved to PostgreSQL as binary blobs, a room that is active for months will result in massive memory consumption. You should periodically run `Y.encodeStateAsUpdate` to garbage collect history and rewrite the base state.
