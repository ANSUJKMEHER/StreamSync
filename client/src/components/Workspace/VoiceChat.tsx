import { useEffect, useRef, useState } from 'react';
import { MdMic, MdMicOff, MdVideocam, MdVideocamOff, MdCallEnd } from 'react-icons/md';
import { useRoomStore } from '../../store/roomStore';
import { useAuthStore } from '../../store/authStore';
import { wsService } from '../../services/websocket';
import './VoiceChat.css';

interface PeerConnection {
  pc: RTCPeerConnection;
  stream: MediaStream;
}

export default function VoiceChat({ roomId, onLeaveCall }: { roomId: string; onLeaveCall: () => void }) {
  const { user } = useAuthStore();
  const { roomUsers } = useRoomStore();
  
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(true); // Default muted
  const [isVideoOff, setIsVideoOff] = useState(true);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const peersRef = useRef<Map<string, PeerConnection>>(new Map());
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const remoteVideoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});
  
  // Local state tracking active call participants (userId -> username)
  const [callParticipants, setCallParticipants] = useState<Map<string, string>>(new Map());

  console.log('[VoiceChat] Rendered state:', {
    roomUsersCount: roomUsers.length,
    roomUsers,
    remoteStreamsKeys: Array.from(remoteStreams.keys())
  });

  // 1. Initialize local media
  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: false, audio: true })
      .then(stream => {
        // Mute audio initially
        stream.getAudioTracks().forEach(track => track.enabled = false);
        
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
    const handleSignal = async (msg: any) => {
      const payload = msg.payload;
      if (!payload) return;
      
      const { senderUserId, signal } = payload;
      if (!signal) return;
      
      // Allow signals only from verified call participants
      if (!callParticipants.has(senderUserId)) {
        console.warn('[VoiceChat] handleSignal rejected signal from non-participant:', senderUserId);
        return;
      }
      
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
  }, [localStream, callParticipants]);

  // 3. Coordinate call participants and WebRTC connections
  useEffect(() => {
    if (!localStream || !user || !roomId) return;

    const handleRoomMessage = (msg: any) => {
      const { payload } = msg;
      if (!payload || !payload.action) return;

      const { action, userId, username } = payload;

      if (action === 'call-query') {
        // Reply that we are in the call
        wsService.send({
          type: 'room-message',
          roomId,
          payload: {
            action: 'call-present',
            userId: user.id,
            username: user.username
          }
        });
      } else if (action === 'call-joined' || action === 'call-present') {
        if (userId) {
          // Update callParticipants mapping
          setCallParticipants(prev => {
            const next = new Map(prev);
            next.set(userId, username || 'User');
            return next;
          });

          if (userId !== user.id && !peersRef.current.has(userId)) {
            // A new user has joined the call, or responded that they are in the call.
            // We can now safely initiate WebRTC connection!
            const pc = createPeer(userId);
            pc.createOffer().then(offer => {
              pc.setLocalDescription(offer);
              wsService.send({
                type: 'webrtc-signal',
                roomId,
                payload: {
                  targetUserId: userId,
                  signal: offer
                }
              });
            });
          }
        }
      } else if (action === 'call-left') {
        if (userId) {
          // Remove from callParticipants mapping
          setCallParticipants(prev => {
            const next = new Map(prev);
            next.delete(userId);
            return next;
          });

          if (peersRef.current.has(userId)) {
            // Close peer connection
            const peer = peersRef.current.get(userId);
            if (peer) {
              peer.pc.close();
              peersRef.current.delete(userId);
            }
            setRemoteStreams(prev => {
              const next = new Map(prev);
              next.delete(userId);
              return next;
            });
          }
        }
      }
    };

    const unsubscribe = wsService.on('room-message', handleRoomMessage);

    // Broadcast that we have joined the call (since our localStream is now fully ready)
    wsService.send({
      type: 'room-message',
      roomId,
      payload: {
        action: 'call-joined',
        userId: user.id,
        username: user.username
      }
    });

    // Ask if there are others already in the call
    wsService.send({
      type: 'room-message',
      roomId,
      payload: {
        action: 'call-query'
      }
    });

    return () => {
      unsubscribe();
      // Broadcast that we are leaving the call
      wsService.send({
        type: 'room-message',
        roomId,
        payload: {
          action: 'call-left',
          userId: user.id,
          username: user.username
        }
      });
    };
  }, [localStream, roomId, user]);

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

    const peerStream = new MediaStream();
    peersRef.current.set(targetUserId, { pc, stream: peerStream });

    pc.ontrack = (event) => {
      peerStream.addTrack(event.track);
      
      const el = remoteVideoRefs.current[targetUserId];
      if (el) {
        // Kickstart the browser's video decoder by forcing a reload of the stream
        el.srcObject = null;
        el.srcObject = peerStream;
        el.play().catch(e => console.log('Video auto-play suppressed', e));
      }

      setRemoteStreams(prev => {
        const next = new Map(prev);
        next.set(targetUserId, peerStream);
        return next;
      });
    };
    
    // Instantly render the empty bubble for this peer
    setRemoteStreams(prev => {
      if (!prev.has(targetUserId)) {
        const next = new Map(prev);
        next.set(targetUserId, peerStream);
        return next;
      }
      return prev;
    });

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

  const toggleVideo = async () => {
    if (!localStream) return;
    
    if (isVideoOff) {
      try {
        // Request camera access only when turned on
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        const newVideoTrack = stream.getVideoTracks()[0];
        localStream.addTrack(newVideoTrack);
        
        // Add track to existing peers using transceiver-aware track replacement
        peersRef.current.forEach(({ pc }, targetUserId) => {
          const videoTransceiver = pc.getTransceivers().find(t => t.receiver.track.kind === 'video');
          
          if (videoTransceiver && videoTransceiver.sender && videoTransceiver.direction === 'sendrecv') {
            // Seamlessly resume sending video data without renegotiation!
            videoTransceiver.sender.replaceTrack(newVideoTrack);
          } else {
            // If the transceiver exists but is not set to send, or doesn't exist yet:
            if (videoTransceiver) {
              videoTransceiver.direction = 'sendrecv';
              videoTransceiver.sender.replaceTrack(newVideoTrack);
            } else {
              pc.addTrack(newVideoTrack, localStream);
            }
            
            // Renegotiate to update the remote peer of the new track/direction
            pc.createOffer()
              .then(offer => pc.setLocalDescription(offer))
              .then(() => {
                wsService.send({
                  type: 'webrtc-signal',
                  roomId,
                  payload: {
                    targetUserId,
                    signal: pc.localDescription
                  }
                });
              });
          }
        });
        
        // Force update local video reference
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream;
        }
        setIsVideoOff(false);
      } catch (err) {
        console.error("Failed to turn on video:", err);
      }
    } else {
      // Turn off video and completely stop hardware access
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.stop(); // Stops camera light
        localStream.removeTrack(videoTrack);
        
        peersRef.current.forEach(({ pc }) => {
          const videoTransceiver = pc.getTransceivers().find(t => t.receiver.track.kind === 'video');
          if (videoTransceiver && videoTransceiver.sender) {
            // Replaces track with null to pause video sending without breaking connection state
            videoTransceiver.sender.replaceTrack(null);
          }
        });
      }
      setIsVideoOff(true);
    }
  };

  if (!user) return null;

  return (
    <div className="absolute top-16 right-4 z-50 flex items-center gap-3 pointer-events-auto bg-surface-container/90 backdrop-blur-md p-2 pl-4 rounded-full shadow-xl border border-outline-variant/30">
      <div className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mr-2 hidden md:block">Voice Call</div>
      
      {/* Remote Peers */}
      {Array.from(remoteStreams.entries()).map(([userId, stream]) => {
        const username = callParticipants.get(userId) || 'User';
        const hasVideo = stream && stream.getVideoTracks().length > 0;
        
        return (
          <div key={userId} className="w-16 h-16 rounded-full overflow-hidden border-2 border-primary/50 bg-surface-container-highest shadow-xl pointer-events-auto relative group flex flex-col justify-end">
            <video
              ref={el => { remoteVideoRefs.current[userId] = el; }}
              autoPlay
              playsInline
              className={`w-full h-full object-cover absolute inset-0 ${!hasVideo ? 'hidden' : ''}`}
            />
            {!hasVideo && (
              <div className="absolute inset-0 flex items-center justify-center bg-surface-container-highest text-on-surface-variant text-2xl font-bold">
                {username.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="absolute bottom-1 left-0 right-0 text-center text-[10px] font-bold text-white bg-black/50 px-1 truncate z-10 font-sans">
              {username}
            </div>
          </div>
        );
      })}

      {/* Local Video */}
      <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-primary bg-surface-container shadow-xl pointer-events-auto relative group flex flex-col justify-end">
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
      
      <div className="w-[1px] h-10 bg-outline-variant/30 mx-1"></div>
      
      <button 
        onClick={onLeaveCall}
        className="w-12 h-12 rounded-full bg-error text-white shadow-md flex items-center justify-center hover:bg-error/90 hover:scale-105 active:scale-95 transition-all ml-1 group relative"
        title="Leave Call"
      >
        <MdCallEnd size={22} />
      </button>
    </div>
  );
}
