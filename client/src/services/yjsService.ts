import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import { fromByteArray, toByteArray } from 'base64-js';
import { wsService } from './websocket';
import { useAuthStore } from '../store/authStore';

class YjsService {
  private docs = new Map<string, Y.Doc>(); // docId -> Y.Doc
  private awarenesses = new Map<string, Awareness>(); // docId -> Awareness
  private unsubscribers: Array<() => void> = [];

  constructor() {
    // Listen to Yjs sync (initial state from server)
    this.unsubscribers.push(
      wsService.on('yjs-sync', (msg) => {
        if (!msg.roomId || !msg.payload) return;
        const payload = msg.payload as any;
        if (typeof payload.update === 'string' && payload.docId) {
          console.log(`[Yjs] Received yjs-sync for doc: ${payload.docId} in room: ${msg.roomId}`);
          const doc = this.getDoc(msg.roomId, payload.docId);
          Y.applyUpdate(doc, toByteArray(payload.update), 'remote');
        }
      })
    );

    // Listen to incremental updates
    this.unsubscribers.push(
      wsService.on('yjs-update', (msg) => {
        if (!msg.roomId || !msg.payload) return;
        const payload = msg.payload as any;
        if (typeof payload.update === 'string' && payload.docId) {
          const doc = this.getDoc(msg.roomId, payload.docId);
          Y.applyUpdate(doc, toByteArray(payload.update), 'remote');
        }
      })
    );

    // Listen to awareness updates (cursors)
    this.unsubscribers.push(
      wsService.on('awareness-update', (msg) => {
        if (!msg.roomId || !msg.payload) return;
        const payload = msg.payload as any;
        if (typeof payload.update === 'string' && payload.docId) {
          const awareness = this.getAwareness(msg.roomId, payload.docId);
          import('y-protocols/awareness').then(({ applyAwarenessUpdate }) => {
            applyAwarenessUpdate(awareness, toByteArray(payload.update), 'remote');
          });
        }
      })
    );
  }

  /**
   * Get or create a Y.Doc for a specific document (file or canvas) multiplexed over the workspace room.
   */
  getDoc(roomId: string, docId: string): Y.Doc {
    if (this.docs.has(docId)) {
      return this.docs.get(docId)!;
    }

    const doc = new Y.Doc();
    this.docs.set(docId, doc);

    // Request initial state from server
    wsService.sendToRoom(roomId, { docId }, 'sync-doc');

    // Broadcast local updates
    doc.on('update', (update: Uint8Array, origin: any) => {
      // Don't broadcast if the update came from the network or client seed
      if (origin !== 'remote' && origin !== 'client-seed') {
        wsService.sendToRoom(roomId, { docId, update: fromByteArray(update) }, 'yjs-update');
      }
    });

    return doc;
  }

  /**
   * Get or create an Awareness instance for a specific document.
   */
  getAwareness(roomId: string, docId: string): Awareness {
    if (this.awarenesses.has(docId)) {
      return this.awarenesses.get(docId)!;
    }

    const doc = this.getDoc(roomId, docId);
    const awareness = new Awareness(doc);
    this.awarenesses.set(docId, awareness);

    // Set local user info
    const user = useAuthStore.getState().user;
    if (user) {
      // Random color for cursor
      const colors = ['#f87171', '#fb923c', '#fbbf24', '#34d399', '#38bdf8', '#818cf8', '#c084fc', '#f472b6'];
      const color = colors[Math.floor(Math.random() * colors.length)];
      
      awareness.setLocalStateField('user', {
        name: user.username,
        color,
      });
    }

    // Broadcast local awareness updates
    awareness.on('update', ({ added, updated, removed }: any, origin: any) => {
      if (origin !== 'remote') {
        import('y-protocols/awareness').then(({ encodeAwarenessUpdate }) => {
          const update = encodeAwarenessUpdate(awareness, added.concat(updated, removed));
          wsService.sendToRoom(roomId, { docId, update: fromByteArray(update) }, 'awareness-update');
        });
      }
    });

    return awareness;
  }

  /**
   * Get the Y.Map for canvas shapes from the dedicated canvas Y.Doc.
   */
  getCanvasMap(roomId: string): Y.Map<any> {
    const doc = this.getDoc(roomId, `canvas-${roomId}`);
    return doc.getMap('canvas_data');
  }

  /**
   * Get the current text content from a file's Yjs document.
   */
  getTextContent(roomId: string, fileId: string): string {
    const doc = this.getDoc(roomId, fileId);
    return doc.getText('monaco').toString();
  }
}

export const yjsService = new YjsService();
