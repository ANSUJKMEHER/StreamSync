import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import { fromByteArray, toByteArray } from 'base64-js';
import { wsService } from './websocket';
import { useAuthStore } from '../store/authStore';

class YjsService {
  private docs = new Map<string, Y.Doc>();
  private awarenesses = new Map<string, Awareness>();
  private unsubscribers: Array<() => void> = [];

  constructor() {
    // Listen to Yjs sync (initial state from server)
    this.unsubscribers.push(
      wsService.on('yjs-sync', (msg) => {
        if (!msg.roomId || !msg.payload) return;
        const payload = msg.payload as any;
        console.log('[Yjs] Received yjs-sync for room:', msg.roomId);
        if (typeof payload.update === 'string') {
          const doc = this.getDoc(msg.roomId);
          Y.applyUpdate(doc, toByteArray(payload.update), 'remote');
        }
      })
    );

    // Listen to incremental updates
    this.unsubscribers.push(
      wsService.on('yjs-update', (msg) => {
        if (!msg.roomId || !msg.payload) return;
        const payload = msg.payload as any;
        console.log('[Yjs] Received yjs-update for room:', msg.roomId);
        if (typeof payload.update === 'string') {
          const doc = this.getDoc(msg.roomId);
          Y.applyUpdate(doc, toByteArray(payload.update), 'remote');
        }
      })
    );

    // Listen to awareness updates (cursors)
    this.unsubscribers.push(
      wsService.on('awareness-update', (msg) => {
        if (!msg.roomId || !msg.payload) return;
        const payload = msg.payload as any;
        console.log('[Yjs] Received awareness-update for room:', msg.roomId);
        if (typeof payload.update === 'string') {
          const awareness = this.getAwareness(msg.roomId);
          import('y-protocols/awareness').then(({ applyAwarenessUpdate }) => {
            applyAwarenessUpdate(awareness, toByteArray(payload.update), 'remote');
          });
        }
      })
    );
  }

  /**
   * Get or create a Y.Doc for a specific room.
   */
  getDoc(roomId: string): Y.Doc {
    if (this.docs.has(roomId)) {
      return this.docs.get(roomId)!;
    }

    const doc = new Y.Doc();
    this.docs.set(roomId, doc);

    // Broadcast local updates
    doc.on('update', (update: Uint8Array, origin: any) => {
      // Don't broadcast if the update came from the network or client seed
      if (origin !== 'remote' && origin !== 'client-seed') {
        wsService.sendToRoom(roomId, { update: fromByteArray(update) }, 'yjs-update');
      }
    });

    return doc;
  }

  /**
   * Get or create an Awareness instance for a specific room.
   */
  getAwareness(roomId: string): Awareness {
    if (this.awarenesses.has(roomId)) {
      return this.awarenesses.get(roomId)!;
    }

    const doc = this.getDoc(roomId);
    const awareness = new Awareness(doc);
    this.awarenesses.set(roomId, awareness);

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
          wsService.sendToRoom(roomId, { update: fromByteArray(update) }, 'awareness-update');
        });
      }
    });

    return awareness;
  }

  /**
   * Get the Y.Map for canvas shapes from the shared Y.Doc.
   * This lives in the same document as the editor's Y.Text,
   * enabling the Link Engine to correlate shapes with files.
   */
  getCanvasMap(roomId: string): Y.Map<any> {
    const doc = this.getDoc(roomId);
    return doc.getMap('canvas');
  }

  /**
   * Get the current text content from the Yjs document.
   */
  getTextContent(roomId: string): string {
    const doc = this.getDoc(roomId);
    return doc.getText('monaco').toString();
  }
}

export const yjsService = new YjsService();
