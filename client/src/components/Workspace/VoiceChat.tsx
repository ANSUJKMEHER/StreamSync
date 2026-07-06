import { useEffect, useRef, useState } from 'react';
import { MdMic, MdMicOff, MdVideocam, MdVideocamOff } from 'react-icons/md';
import { useRoomStore } from '../../store/roomStore';
import { useAuthStore } from '../../store/authStore';
import { wsService } from '../../services/websocket';
import './VoiceChat.css';

interface PeerConnection {
  pc: RTCPeerConnection;
  stream: MediaStream;
}

export default function VoiceChat({ roomId }: { roomId: string }) {
  const { user } = useAuthStore();
  const { roomUsers } = useRoomStore();
  
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(true); // Default muted
  const [isVideoOff, setIsVideoOff] = useState(true);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const peersRef = useRef<Map<string, PeerConnection>>(new Map());
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const remoteVideoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});

  // 1. Initialize local media
  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        // Mute tracks initially
        stream.getAudioTracks().forEach(track => track.enabled = false);
        stream.getVideoTracks().forEach(track => track.enabled = false);
        
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      })
      .catch(err => console.error("Failed to get local media:", err));

    return () => {
      localStream?.getTracks().forEach(t => t.stop());
      peersRef.current.forEach(({ pc }) => pc.close());
    };
  }, []);

  // 2. Handle Signaling
  useEffect(() => {
    const handleSignal = async (payload: any) => {
      const { senderUserId, signal } = payload;
      
      let pc = peersRef.current.get(senderUserId)?.pc;
      
      if (!pc) {
        pc = createPeer(senderUserId);
      }

      if (signal.type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        wsService.send({
          type: 'webrtc-signal',
          roomId,
          payload: {
            targetUserId: senderUserId,
            signal: pc.localDescription
          }
        });
      } else if (signal.type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal));
      } else if (signal.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(signal));
      }
    };

    const unsubscribe = wsService.on('webrtc-signal', handleSignal);
    return () => unsubscribe();
  }, [localStream]);

  // 3. Initiate connections when new users join
  useEffect(() => {
    if (!localStream || !user) return;
    
    roomUsers.forEach(u => {
      if (u.userId !== user.id && !peersRef.current.has(u.userId)) {
        // We initiate the call to the new user
        const pc = createPeer(u.userId);
        pc.createOffer().then(offer => {
          pc.setLocalDescription(offer);
          wsService.send({
            type: 'webrtc-signal',
            roomId,
            payload: {
              targetUserId: u.userId,
              signal: offer
            }
          });
        });
      }
    });
  }, [roomUsers, localStream]);

  const createPeer = (targetUserId: string) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] // Free Google STUN
    });

    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        wsService.send({
          type: 'webrtc-signal',
          roomId,
          payload: {
            targetUserId,
            signal: event.candidate
          }
        });
      }
    };

    pc.ontrack = (event) => {
      setRemoteStreams(prev => {
        const next = new Map(prev);
        next.set(targetUserId, event.streams[0]);
        return next;
      });
    };

    peersRef.current.set(targetUserId, { pc, stream: new MediaStream() });
    return pc;
  };

  useEffect(() => {
    // Attach remote streams to video elements
    remoteStreams.forEach((stream, userId) => {
      const el = remoteVideoRefs.current[userId];
      if (el && el.srcObject !== stream) {
        el.srcObject = stream;
      }
    });
  }, [remoteStreams]);

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(t => t.enabled = !t.enabled);
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(t => t.enabled = !t.enabled);
      setIsVideoOff(!isVideoOff);
    }
  };

  if (!user) return null;

  return (
    <div className="absolute top-4 right-4 z-50 flex gap-4 pointer-events-none">
      {/* Remote Peers */}
      {Array.from(remoteStreams.entries()).map(([userId, _stream]) => {
        const u = roomUsers.find(ru => ru.userId === userId);
        return (
          <div key={userId} className="w-24 h-24 rounded-full overflow-hidden border-2 border-primary/50 bg-surface-container-highest shadow-xl pointer-events-auto relative group">
            <video
              ref={el => { remoteVideoRefs.current[userId] = el; }}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-1 left-0 right-0 text-center text-[10px] font-bold text-white bg-black/50 px-1 truncate">
              {u?.username || 'User'}
            </div>
          </div>
        );
      })}

      {/* Local Video */}
      <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-primary bg-surface-container shadow-xl pointer-events-auto relative group flex flex-col justify-end">
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover absolute inset-0 ${isVideoOff ? 'hidden' : ''}`}
        />
        {isVideoOff && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-container-highest text-on-surface-variant text-3xl font-bold">
            {user.username.charAt(0).toUpperCase()}
          </div>
        )}
        
        {/* Controls Overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <button onClick={toggleMute} className={`p-1.5 rounded-full ${isMuted ? 'bg-error text-white' : 'bg-surface/80 text-white hover:bg-white hover:text-black'}`}>
            {isMuted ? <MdMicOff size={14} /> : <MdMic size={14} />}
          </button>
          <button onClick={toggleVideo} className={`p-1.5 rounded-full ${isVideoOff ? 'bg-error text-white' : 'bg-surface/80 text-white hover:bg-white hover:text-black'}`}>
            {isVideoOff ? <MdVideocamOff size={14} /> : <MdVideocam size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
}
