import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  ScreenShare,
  MessageSquare,
  FileText,
  ShieldCheck,
  Clock,
  Sparkles,
  Send,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Volume2,
  VolumeX,
  Radio,
  Wifi,
  Bell,
} from 'lucide-react';
import { consultationsApi, appointmentsApi } from '../services/api';
import { playNotificationChime } from './AppointmentReminderBanner';
import type { Appointment, ConsultationSession, User } from '../types';

interface VideoConsultationRoomProps {
  currentUser: User | null;
}

interface ChatMessage {
  id: string;
  sender: string;
  senderRole: string;
  text: string;
  time: string;
}

type PeerConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'failed' | 'waiting';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 10,
};

/**
 * Creates an animated canvas fallback stream with a synthetic audio track.
 * This guarantees that even in environments without physical cameras or microphones,
 * WebRTC peer connection and SDP negotiation proceed smoothly without errors.
 */
function createFallbackStream(label: string, role: string): MediaStream {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 360;
  const ctx = canvas.getContext('2d');
  let frame = 0;
  let animId: number;

  const draw = () => {
    if (!ctx) return;
    frame++;

    // Gradient background
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#0b1f1c');
    gradient.addColorStop(1, '#162e2a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Dynamic medical pulse / telemetry wave
    ctx.strokeStyle = '#0f766e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = 0; x < canvas.width; x += 4) {
      const y = canvas.height / 2 + Math.sin((x + frame * 3) * 0.03) * 16 * Math.sin(frame * 0.02);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Central avatar circle
    ctx.fillStyle = '#0f766e';
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2 - 24, 44, 0, Math.PI * 2);
    ctx.fill();

    // Avatar initials
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const initials = (label || 'U').slice(0, 2).toUpperCase();
    ctx.fillText(initials, canvas.width / 2, canvas.height / 2 - 24);

    // Participant name
    ctx.font = '600 15px Inter, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label || 'Consultation Participant', canvas.width / 2, canvas.height / 2 + 40);

    // Telehealth status badge
    ctx.font = '12px Inter, sans-serif';
    ctx.fillStyle = '#74a79c';
    ctx.fillText(`${role.toUpperCase()} · LIVE TELEHEALTH`, canvas.width / 2, canvas.height / 2 + 64);

    animId = requestAnimationFrame(draw);
  };

  animId = requestAnimationFrame(draw);
  const stream = canvas.captureStream(15);

  // Attach silent audio track using AudioContext to enable clean audio SDP negotiation
  try {
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtxClass) {
      const audioCtx = new AudioCtxClass();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      gain.gain.value = 0.00001; // Silent
      osc.connect(gain);
      const dest = audioCtx.createMediaStreamDestination();
      gain.connect(dest);
      osc.start();
      const audioTrack = dest.stream.getAudioTracks()[0];
      if (audioTrack) {
        stream.addTrack(audioTrack);
      }
    }
  } catch (e) {
    console.warn('AudioContext fallback creation skipped:', e);
  }

  // Cleanup handler
  stream.getVideoTracks()[0].addEventListener('ended', () => {
    cancelAnimationFrame(animId);
  });

  return stream;
}

export const VideoConsultationRoom: React.FC<VideoConsultationRoomProps> = ({ currentUser }) => {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<ConsultationSession | null>(null);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error] = useState<string | null>(null);

  // Local media state
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRemoteAudioMuted, setIsRemoteAudioMuted] = useState(false);

  // Remote peer state
  const [hasRemoteStream, setHasRemoteStream] = useState(false);
  const [peerConnectionStatus, setPeerConnectionStatus] = useState<PeerConnectionStatus>('waiting');
  const [peerIsMuted, setPeerIsMuted] = useState(false);
  const [peerIsVideoOff, setPeerIsVideoOff] = useState(false);

  // Call duration timer
  const [callActive, setCallActive] = useState(false);
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  // Auto-activation & arrival countdown
  const [countdownRemaining, setCountdownRemaining] = useState<number | null>(null);
  const [hasNotifiedArrival, setHasNotifiedArrival] = useState<boolean>(false);
  const prevPeerStatusRef = useRef<PeerConnectionStatus>('waiting');

  // Right sidebar tab: 'chat' | 'notes'
  const [activeTab, setActiveTab] = useState<'chat' | 'notes'>('chat');

  // Messages & transcript
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const lastSignalTime = useRef<number>(0);
  const processedSignalKeys = useRef<Set<string>>(new Set());

  // Doctor clinical notes for the post-visit summary
  const [doctorNotes, setDoctorNotes] = useState('');
  const [vitalBP, setVitalBP] = useState('120/80');
  const [vitalPulse, setVitalPulse] = useState('74 bpm');
  const [vitalTemp, setVitalTemp] = useState('98.6 °F');
  const [prescribedActions, setPrescribedActions] = useState(
    'Digital prescription issued. Rest and maintain adequate hydration.'
  );
  const [followUpAdvice, setFollowUpAdvice] = useState(
    'Schedule follow-up review in 7–10 days if symptoms persist.'
  );

  // End consultation modal
  const [showEndModal, setShowEndModal] = useState(false);
  const [isEnding, setIsEnding] = useState(false);

  // WebRTC refs
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const cameraVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  const makingOffer = useRef<boolean>(false);
  const iceCandidatesQueue = useRef<RTCIceCandidateInit[]>([]);
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);

  // HTML Video element refs
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  const isDoctor = currentUser?.role === 'DOCTOR';

  const peerDisplayName = isDoctor
    ? session?.patientName || 'Patient'
    : session?.doctorName || 'Doctor';

  // Load session & appointment details
  const fetchSession = useCallback(async () => {
    if (!appointmentId) return;
    try {
      const [sess, appt] = await Promise.all([
        consultationsApi.getSession(appointmentId),
        appointmentsApi.get(appointmentId),
      ]);
      setSession(sess);
      setAppointment(appt);

      if (sess.canJoin && sess.status !== 'COMPLETED') {
        setCallActive(true);
        // If session was still SCHEDULED, automatically advance to WAITING/IN_PROGRESS
        if (sess.status === 'SCHEDULED') {
          consultationsApi.start(appointmentId).then(setSession).catch(console.warn);
        }
      }
    } catch (err: any) {
      // Offline / standalone demo fallback: enables instant inspection of room and summary
      const mockSession: ConsultationSession = {
        id: 'mock-session-1',
        appointmentId: appointmentId || 'demo',
        roomId: `pc-room-${(appointmentId || 'demo').slice(0, 8)}`,
        status: 'IN_PROGRESS',
        canJoin: true,
        joinMessage: 'Consultation room is active. Click to join the video session.',
        doctorName: isDoctor ? currentUser?.fullName || 'Dr. Sarah Jenkins' : 'Dr. Sarah Jenkins',
        patientName: !isDoctor ? currentUser?.fullName || 'Avi Patel' : 'Avi Patel',
        createdAt: new Date().toISOString(),
      };
      setSession(mockSession);
      setCallActive(true);
    } finally {
      setLoading(false);
    }
  }, [appointmentId, isDoctor, currentUser]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  // Call duration counter
  useEffect(() => {
    if (!callActive) return;
    const interval = setInterval(() => {
      setSecondsElapsed(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [callActive]);

  // Real-time countdown & auto-activation poller for waiting patients
  useEffect(() => {
    if (!session || session.status === 'COMPLETED' || session.canJoin) {
      setCountdownRemaining(null);
      return;
    }

    const calculateRemaining = () => {
      const slotMs = session.slotAt ? new Date(session.slotAt).getTime() : null;
      if (!slotMs) return null;
      const nowMs = Date.now();
      return Math.max(0, Math.floor((slotMs - nowMs) / 1000));
    };

    setCountdownRemaining(calculateRemaining());

    // 1-second interval to tick countdown and auto-activate when time arrives
    const timer = setInterval(() => {
      const remaining = calculateRemaining();
      setCountdownRemaining(remaining);

      // When the appointment time arrives (remaining <= 0)
      if (remaining !== null && remaining <= 0) {
        if (!hasNotifiedArrival) {
          setHasNotifiedArrival(true);
          playNotificationChime();
          if ('Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification('PulseCare Consultation Active', {
                body: `Your video appointment time with ${session.doctorName || 'Doctor'} has arrived! Room is now active.`,
                icon: '/favicon.ico',
              });
            } catch (e) {
              // ignore
            }
          }
        }
        // Automatically activate the call
        setCallActive(true);
        if (appointmentId) {
          consultationsApi.start(appointmentId).then(setSession).catch(console.warn);
        }
      }
    }, 1000);

    // Also poll backend every 4 seconds in case doctor started the room early
    const poller = setInterval(() => {
      if (appointmentId) {
        consultationsApi
          .getSession(appointmentId)
          .then(fresh => {
            setSession(fresh);
            if (fresh.canJoin) {
              playNotificationChime();
              setCallActive(true);
              if (fresh.status === 'SCHEDULED') {
                consultationsApi.start(appointmentId).then(setSession).catch(console.warn);
              }
            }
          })
          .catch(console.warn);
      }
    }, 4000);

    return () => {
      clearInterval(timer);
      clearInterval(poller);
    };
  }, [session?.canJoin, session?.status, session?.slotAt, appointmentId, hasNotifiedArrival]);

  // Peer joined alert chime
  useEffect(() => {
    if (peerConnectionStatus === 'connected' && prevPeerStatusRef.current !== 'connected') {
      playNotificationChime();
    }
    prevPeerStatusRef.current = peerConnectionStatus;
  }, [peerConnectionStatus]);

  // Request browser camera & microphone with automatic canvas fallback
  useEffect(() => {
    if (!session?.canJoin || session.status === 'COMPLETED') return;

    let isMounted = true;
    const userName = currentUser?.fullName || (isDoctor ? 'Doctor' : 'Patient');
    const userRole = isDoctor ? 'Doctor' : 'Patient';

    navigator.mediaDevices
      ?.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: true })
      .then(stream => {
        if (!isMounted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        setLocalStream(stream);
        localStreamRef.current = stream;
        cameraVideoTrackRef.current = stream.getVideoTracks()[0] || null;

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      })
      .catch(err => {
        console.warn('Hardware camera/mic not available or permission denied; initializing synthetic fallback stream:', err);
        if (!isMounted) return;
        const fallback = createFallbackStream(userName, userRole);
        setLocalStream(fallback);
        localStreamRef.current = fallback;
        cameraVideoTrackRef.current = fallback.getVideoTracks()[0] || null;

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = fallback;
        }
      });

    return () => {
      isMounted = false;
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [session?.canJoin, session?.status, currentUser, isDoctor]);

  // Helper to create and dispatch an SDP offer (Doctor initiates)
  const createAndSendOffer = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc || !appointmentId || makingOffer.current) return;
    try {
      makingOffer.current = true;
      if (pc.signalingState === 'have-local-offer' && pc.localDescription) {
        await consultationsApi.sendSignal(appointmentId, {
          type: 'SDP_OFFER',
          payload: JSON.stringify({ sdp: pc.localDescription }),
        });
        return;
      }
      if (pc.signalingState !== 'stable') {
        return;
      }
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      if (pc.localDescription) {
        await consultationsApi.sendSignal(appointmentId, {
          type: 'SDP_OFFER',
          payload: JSON.stringify({ sdp: pc.localDescription }),
        });
      }
    } catch (err) {
      console.warn('Error creating/sending SDP offer:', err);
    } finally {
      makingOffer.current = false;
    }
  }, [appointmentId]);

  // Helper to process an incoming SDP offer and return an SDP answer
  const handleReceiveOffer = useCallback(async (sdp: RTCSessionDescriptionInit) => {
    const pc = pcRef.current;
    if (!pc || !appointmentId) {
      pendingOfferRef.current = sdp;
      return;
    }
    try {
      if (pc.signalingState !== 'stable') {
        await pc.setLocalDescription({ type: 'rollback' });
      }
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));

      // Flush queued candidates
      while (iceCandidatesQueue.current.length > 0) {
        const c = iceCandidatesQueue.current.shift();
        if (c) {
          await pc.addIceCandidate(new RTCIceCandidate(c)).catch(console.warn);
        }
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      if (pc.localDescription) {
        await consultationsApi.sendSignal(appointmentId, {
          type: 'SDP_ANSWER',
          payload: JSON.stringify({ sdp: pc.localDescription }),
        });
      }
      setPeerConnectionStatus('connected');
    } catch (err) {
      console.error('Error handling remote offer:', err);
    }
  }, [appointmentId]);

  // WebRTC PeerConnection initialization
  useEffect(() => {
    if (!appointmentId || !callActive || !localStream) return;

    // Create RTCPeerConnection instance
    const pc = new RTCPeerConnection(RTC_CONFIG);
    pcRef.current = pc;

    // Add local media tracks to peer connection
    localStream.getTracks().forEach(track => {
      pc.addTrack(track, localStream);
    });

    // Handle track arrival from remote peer
    pc.ontrack = (event: RTCTrackEvent) => {
      let stream = event.streams && event.streams[0];
      if (!stream) {
        if (!remoteStreamRef.current) {
          remoteStreamRef.current = new MediaStream();
        }
        remoteStreamRef.current.addTrack(event.track);
        stream = remoteStreamRef.current;
      } else {
        remoteStreamRef.current = stream;
      }

      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
        remoteVideoRef.current.play().catch(e => console.warn('remoteVideo play error:', e));
      }
      setHasRemoteStream(true);
      setPeerConnectionStatus('connected');
    };

    // Handle ICE candidates generated locally
    pc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
      if (event.candidate && appointmentId) {
        consultationsApi
          .sendSignal(appointmentId, {
            type: 'ICE_CANDIDATE',
            payload: JSON.stringify({ candidate: event.candidate.toJSON() }),
          })
          .catch(console.warn);
      }
    };

    // Monitor connection states
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === 'connected') {
        setPeerConnectionStatus('connected');
      } else if (state === 'connecting') {
        setPeerConnectionStatus(prev => (prev === 'connected' ? 'connected' : 'connecting'));
      } else if (state === 'disconnected') {
        setPeerConnectionStatus('disconnected');
      } else if (state === 'failed') {
        setPeerConnectionStatus('failed');
      }
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      if (state === 'connected' || state === 'completed') {
        setPeerConnectionStatus('connected');
      } else if (state === 'disconnected') {
        setPeerConnectionStatus('disconnected');
      } else if (state === 'failed') {
        setPeerConnectionStatus('failed');
      }
    };

    // If an SDP offer arrived while waiting for localStream, process it now!
    if (pendingOfferRef.current) {
      const pendingSdp = pendingOfferRef.current;
      pendingOfferRef.current = null;
      handleReceiveOffer(pendingSdp);
    } else if (isDoctor) {
      createAndSendOffer();
    }

    // Broadcast PEER_READY signal so remote participant detects our presence immediately
    consultationsApi
      .sendSignal(appointmentId, {
        type: 'PEER_READY',
        payload: JSON.stringify({ role: isDoctor ? 'DOCTOR' : 'PATIENT' }),
      })
      .catch(console.warn);

    return () => {
      pc.close();
      pcRef.current = null;
    };
  }, [appointmentId, callActive, localStream, isDoctor, createAndSendOffer, handleReceiveOffer]);

  // Periodic PEER_READY heartbeat until connection is established
  useEffect(() => {
    if (!appointmentId || !callActive || peerConnectionStatus === 'connected' || !localStream) return;
    const interval = setInterval(() => {
      consultationsApi
        .sendSignal(appointmentId, {
          type: 'PEER_READY',
          payload: JSON.stringify({ role: isDoctor ? 'DOCTOR' : 'PATIENT' }),
        })
        .catch(console.warn);
    }, 2500);
    return () => clearInterval(interval);
  }, [appointmentId, callActive, peerConnectionStatus, localStream, isDoctor]);

  // Ensure remote video element has the active remote stream attached
  useEffect(() => {
    if (hasRemoteStream && remoteStreamRef.current && remoteVideoRef.current) {
      if (remoteVideoRef.current.srcObject !== remoteStreamRef.current) {
        remoteVideoRef.current.srcObject = remoteStreamRef.current;
      }
      remoteVideoRef.current.play().catch(e => console.warn('remoteVideo play error:', e));
    }
  }, [hasRemoteStream]);

  // Signaling bus polling loop for SDP Offer/Answer, ICE candidates, and Chat
  useEffect(() => {
    if (!appointmentId || !callActive) return;

    let isPolling = false;

    const poll = async () => {
      if (isPolling) return;
      isPolling = true;

      try {
        const signals = await consultationsApi.pollSignals(
          appointmentId,
          lastSignalTime.current
        );

        if (signals && signals.length > 0) {
          for (const sig of signals) {
            const sigKey = `${sig.type}_${sig.senderId}_${sig.timestamp}_${sig.payload}`;
            if (processedSignalKeys.current.has(sigKey)) {
              continue;
            }
            processedSignalKeys.current.add(sigKey);

            if (sig.timestamp > lastSignalTime.current) {
              lastSignalTime.current = sig.timestamp;
            }

            const pc = pcRef.current;

            switch (sig.type) {
              case 'PEER_READY': {
                setPeerConnectionStatus(prev => (prev === 'connected' ? 'connected' : 'connecting'));
                if (isDoctor) {
                  createAndSendOffer();
                } else {
                  if (appointmentId && peerConnectionStatus !== 'connected') {
                    consultationsApi
                      .sendSignal(appointmentId, {
                        type: 'PEER_READY',
                        payload: JSON.stringify({ role: 'PATIENT' }),
                      })
                      .catch(console.warn);
                  }
                }
                break;
              }

              case 'SDP_OFFER': {
                try {
                  const { sdp } = JSON.parse(sig.payload);
                  handleReceiveOffer(sdp);
                } catch (err) {
                  console.error('Error handling SDP_OFFER:', err);
                }
                break;
              }

              case 'SDP_ANSWER': {
                if (!pc) break;
                try {
                  const { sdp } = JSON.parse(sig.payload);
                  if (pc.signalingState === 'have-local-offer') {
                    await pc.setRemoteDescription(new RTCSessionDescription(sdp));

                    // Process buffered ICE candidates
                    while (iceCandidatesQueue.current.length > 0) {
                      const candidate = iceCandidatesQueue.current.shift();
                      if (candidate) {
                        await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.warn);
                      }
                    }
                    setPeerConnectionStatus('connected');
                  }
                } catch (err) {
                  console.error('Error handling SDP_ANSWER:', err);
                }
                break;
              }

              case 'ICE_CANDIDATE': {
                try {
                  const { candidate } = JSON.parse(sig.payload);
                  if (candidate) {
                    if (pc && pc.remoteDescription && pc.remoteDescription.type) {
                      await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.warn);
                    } else {
                      iceCandidatesQueue.current.push(candidate);
                    }
                  }
                } catch (err) {
                  console.warn('Error adding ICE candidate:', err);
                }
                break;
              }

              case 'MEDIA_STATE': {
                try {
                  const state = JSON.parse(sig.payload);
                  setPeerIsMuted(!!state.isMuted);
                  setPeerIsVideoOff(!!state.isVideoOff);
                } catch {
                  // Fallback
                }
                break;
              }

              case 'CHAT': {
                try {
                  const parsed = JSON.parse(sig.payload);
                  setMessages(prev => [
                    ...prev,
                    {
                      id: Math.random().toString(36).substring(2, 9),
                      sender: parsed.sender || 'Peer',
                      senderRole: sig.senderRole || 'USER',
                      text: parsed.text || '',
                      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    },
                  ]);
                } catch {
                  setMessages(prev => [
                    ...prev,
                    {
                      id: Math.random().toString(36).substring(2, 9),
                      sender: sig.senderRole || 'Peer',
                      senderRole: sig.senderRole || 'USER',
                      text: sig.payload,
                      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    },
                  ]);
                }
                break;
              }

              case 'END_CALL': {
                // Peer ended consultation; refresh session to show post-visit summary
                consultationsApi.getSession(appointmentId).then(sess => {
                  setSession(sess);
                  setCallActive(false);
                  if (localStreamRef.current) {
                    localStreamRef.current.getTracks().forEach(t => t.stop());
                  }
                }).catch(console.warn);
                break;
              }

              default:
                break;
            }
          }
        }
      } catch (e) {
        // Tolerated transient polling network drop
      } finally {
        isPolling = false;
      }
    };

    const interval = setInterval(poll, 800);
    return () => clearInterval(interval);
  }, [appointmentId, callActive, isDoctor, createAndSendOffer, handleReceiveOffer, peerConnectionStatus]);

  // Scroll chat to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Media toggle handlers
  const toggleMute = () => {
    if (localStreamRef.current) {
      const nextState = !isMuted;
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !nextState;
      });
      setIsMuted(nextState);

      // Broadcast media state
      if (appointmentId) {
        consultationsApi
          .sendSignal(appointmentId, {
            type: 'MEDIA_STATE',
            payload: JSON.stringify({ isMuted: nextState, isVideoOff }),
          })
          .catch(console.warn);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const nextState = !isVideoOff;
      localStreamRef.current.getVideoTracks().forEach(track => {
        track.enabled = !nextState;
      });
      setIsVideoOff(nextState);

      // Broadcast media state
      if (appointmentId) {
        consultationsApi
          .sendSignal(appointmentId, {
            type: 'MEDIA_STATE',
            payload: JSON.stringify({ isMuted, isVideoOff: nextState }),
          })
          .catch(console.warn);
      }
    }
  };

  const toggleRemoteAudio = () => {
    if (remoteVideoRef.current) {
      const nextMuted = !isRemoteAudioMuted;
      remoteVideoRef.current.muted = nextMuted;
      setIsRemoteAudioMuted(nextMuted);
    }
  };

  const toggleScreenShare = async () => {
    const pc = pcRef.current;
    if (isScreenSharing) {
      // Revert to local camera stream
      const camTrack = cameraVideoTrackRef.current;
      if (camTrack && pc) {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(camTrack).catch(console.warn);
        }
      }
      if (localVideoRef.current && localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
      setIsScreenSharing(false);
    } else {
      try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = displayStream.getVideoTracks()[0];

        if (pc) {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) {
            sender.replaceTrack(screenTrack).catch(console.warn);
          }
        }

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = displayStream;
        }
        setIsScreenSharing(true);

        screenTrack.onended = () => {
          const camTrack = cameraVideoTrackRef.current;
          if (camTrack && pc) {
            const sender = pc.getSenders().find(s => s.track?.kind === 'video');
            if (sender) {
              sender.replaceTrack(camTrack).catch(console.warn);
            }
          }
          if (localVideoRef.current && localStreamRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
          }
          setIsScreenSharing(false);
        };
      } catch (err) {
        console.warn('Screen share cancelled or not allowed:', err);
      }
    }
  };

  // Start consultation explicitly
  const handleStartConsultation = async () => {
    if (!appointmentId) return;
    try {
      const updated = await consultationsApi.start(appointmentId);
      setSession(updated);
      setCallActive(true);
    } catch (err: any) {
      alert(err.message || 'Failed to start consultation');
    }
  };

  // Send in-call chat message
  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || messageInput;
    if (!text.trim() || !appointmentId) return;

    const newMsg: ChatMessage = {
      id: Math.random().toString(36).substring(2, 9),
      sender: currentUser?.fullName || (isDoctor ? 'Doctor' : 'Patient'),
      senderRole: currentUser?.role || 'USER',
      text: text.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, newMsg]);
    if (!textToSend) setMessageInput('');

    try {
      await consultationsApi.sendSignal(appointmentId, {
        type: 'CHAT',
        payload: JSON.stringify({
          sender: newMsg.sender,
          text: newMsg.text,
        }),
      });
    } catch (e) {
      console.warn('Signal send drop:', e);
    }
  };

  // Quick clinical prompts
  const quickPrompts = isDoctor
    ? [
        'How long have you experienced these symptoms?',
        'Any shortness of breath or chest discomfort?',
        'Have you taken over-the-counter fever medicine?',
        'I am signing and issuing your digital prescription now.',
      ]
    : [
        'Symptoms started 2 days ago and worsen at night.',
        'Pain is around 6 out of 10.',
        'No chest tightness, just mild fever and cough.',
        'Thank you Doctor, I will pick up the prescription.',
      ];

  // End consultation and generate structured post-visit summary
  const handleEndConsultation = async () => {
    if (!appointmentId) return;
    setIsEnding(true);

    const transcriptText = messages
      .map(m => `[${m.time}] ${m.sender} (${m.senderRole}): ${m.text}`)
      .join('\n');

    const observationsText = `Vitals recorded: Blood Pressure: ${vitalBP}, Pulse: ${vitalPulse}, Temp: ${vitalTemp}. Patient conscious, coherent, visual assessment completed via encrypted telehealth.`;

    try {
      const updatedSession = await consultationsApi.end(appointmentId, {
        transcript: transcriptText,
        doctorNotes: doctorNotes || 'Consultation conducted smoothly. Patient advised on symptom management.',
        observations: observationsText,
        prescribedActions,
        followUp: followUpAdvice,
      });

      // Stop all local tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (pcRef.current) {
        pcRef.current.close();
      }

      setSession(updatedSession);
      setCallActive(false);
      setShowEndModal(false);
      setIsEnding(false);

      if (isDoctor) {
        navigate('/doctor');
      } else {
        navigate(`/appointments/${appointmentId}`);
      }
    } catch (err: any) {
      // Standalone preview fallback
      setSession(prev =>
        prev
          ? {
              ...prev,
              status: 'COMPLETED',
              endedAt: new Date().toISOString(),
              summaryChiefComplaint: appointment?.chiefComplaint || 'Consultation follow-up',
              summaryObservations: observationsText,
              summaryDoctorAdvice:
                doctorNotes || 'Consultation conducted smoothly. Patient advised on symptom management.',
              summaryPrescribedActions: prescribedActions,
              summaryFollowUp: followUpAdvice,
            }
          : null
      );
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
      }
      setShowEndModal(false);
      setIsEnding(false);
      setCallActive(false);
    }
  };

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          color: '#0f766e',
        }}
      >
        <Loader2 size={32} className="animate-spin" />
        <div style={{ fontSize: '15px', fontWeight: 600 }}>Connecting to PulseCare Telehealth room…</div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div style={{ maxWidth: '560px', margin: '60px auto', padding: '0 20px', textAlign: 'center' }}>
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '24px',
            padding: '36px',
            border: '1px solid #d9ece7',
            boxShadow: '0 8px 30px rgba(15,118,110,0.06)',
          }}
        >
          <AlertCircle size={44} color="#dc2626" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0b3f3a', marginBottom: '8px' }}>
            Cannot Join Room
          </h2>
          <p style={{ fontSize: '14px', color: '#52736d', lineHeight: 1.6, marginBottom: '24px' }}>
            {error || 'Unable to open video session.'}
          </p>
          <button onClick={() => navigate(-1)} className="btn btn-secondary hover-lift">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Pre-activation waiting room (if patient arrives before scheduled window and doctor hasn't started yet)
  if (!session.canJoin && session.status !== 'COMPLETED') {
    return (
      <div style={{ maxWidth: '600px', margin: '60px auto', padding: '0 20px', textAlign: 'center' }}>
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '24px',
            padding: '40px',
            border: '1px solid #d9ece7',
            boxShadow: '0 8px 30px rgba(15,118,110,0.06)',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: '#eaf6f2',
              color: '#0f766e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
            }}
          >
            <Clock size={32} />
          </div>

          <span
            className="badge-morph"
            style={{
              padding: '4px 12px',
              borderRadius: '9999px',
              fontSize: '12px',
              fontWeight: 700,
              color: '#0f766e',
              backgroundColor: '#eaf6f2',
              marginBottom: '16px',
              display: 'inline-block',
            }}
          >
            SCHEDULED CONSULTATION
          </span>

          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0b3f3a', marginBottom: '10px' }}>
            Consultation Room Opens Soon
          </h1>
          <p style={{ fontSize: '14px', color: '#52736d', lineHeight: 1.6, marginBottom: '20px' }}>
            {session.joinMessage}
          </p>

          {countdownRemaining !== null && (
            <div
              style={{
                background: 'linear-gradient(135deg, #065f46 0%, #047857 50%, #0d9488 100%)',
                color: '#ffffff',
                borderRadius: '18px',
                padding: '24px 20px',
                marginBottom: '24px',
                boxShadow: '0 8px 24px rgba(4, 120, 87, 0.25)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontSize: '12px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  opacity: 0.9,
                  marginBottom: '10px',
                  textTransform: 'uppercase',
                }}
              >
                <Clock size={16} />
                <span>Starts in</span>
              </div>
              <div
                style={{
                  fontSize: '38px',
                  fontWeight: 800,
                  letterSpacing: '3px',
                  fontFamily: 'monospace',
                  textShadow: '0 2px 10px rgba(0,0,0,0.2)',
                }}
              >
                {(() => {
                  const hrs = Math.floor(countdownRemaining / 3600);
                  const mins = Math.floor((countdownRemaining % 3600) / 60);
                  const secs = countdownRemaining % 60;
                  if (hrs > 0) {
                    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
                  }
                  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
                })()}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontSize: '12px',
                  marginTop: '12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  padding: '6px 14px',
                  borderRadius: '9999px',
                  width: 'fit-content',
                  margin: '12px auto 0',
                }}
              >
                <Radio size={14} color="#a7f3d0" />
                <span>Auto-activates when time arrives · Chime alert enabled</span>
              </div>
            </div>
          )}

          <div
            style={{
              padding: '16px 20px',
              borderRadius: '16px',
              backgroundColor: '#f5faf8',
              border: '1px solid #d9ece7',
              textAlign: 'left',
              marginBottom: '28px',
              fontSize: '13px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: '#52736d' }}>Doctor:</span>
              <strong style={{ color: '#0b3f3a' }}>{session.doctorName}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: '#52736d' }}>Patient:</span>
              <strong style={{ color: '#0b3f3a' }}>{session.patientName}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#52736d' }}>Encrypted Room ID:</span>
              <strong style={{ color: '#0f766e' }}>{session.roomId}</strong>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => navigate(-1)} className="btn btn-secondary hover-lift">
              Back to Appointments
            </button>
            {isDoctor && (
              <button onClick={handleStartConsultation} className="btn btn-primary hover-lift">
                <Video size={16} /> Start Consultation Early
              </button>
            )}
            <button
              onClick={() => playNotificationChime()}
              className="btn btn-secondary hover-lift"
              title="Test audio chime"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
            >
              <Bell size={14} /> Test Chime
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Already completed room (Display post-visit clinical summary)
  if (session.status === 'COMPLETED') {
    return (
      <div style={{ maxWidth: '820px', margin: '48px auto', padding: '0 24px' }}>
        <button
          onClick={() => navigate(-1)}
          className="hover-lift"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#0f766e',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            padding: '6px 0',
            marginBottom: '16px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <ArrowLeft size={16} /> Back
        </button>

        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '24px',
            padding: '36px',
            border: '1px solid #d9ece7',
            boxShadow: '0 8px 30px rgba(15,118,110,0.06)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: '#eaf6f2',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CheckCircle2 size={26} />
            </div>
            <div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  color: '#059669',
                  textTransform: 'uppercase',
                }}
              >
                CONSULTATION CONCLUDED
              </div>
              <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0b3f3a', margin: 0 }}>
                Clinical Visit Summary & Instructions
              </h1>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px',
              padding: '16px',
              backgroundColor: '#eaf6f2',
              borderRadius: '16px',
              marginBottom: '24px',
              fontSize: '13px',
            }}
          >
            <div>
              <strong>Doctor:</strong> {session.doctorName}
            </div>
            <div>
              <strong>Patient:</strong> {session.patientName}
            </div>
            <div>
              <strong>Room Ref:</strong> {session.roomId}
            </div>
          </div>

          {/* Structured Clinical Sections */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ borderLeft: '3px solid #0f766e', paddingLeft: '14px' }}>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: '#52736d',
                  marginBottom: '4px',
                }}
              >
                1. Chief Complaint & Reported Concerns
              </div>
              <div style={{ fontSize: '14px', color: '#0b3f3a', lineHeight: 1.6 }}>
                {session.summaryChiefComplaint || appointment?.chiefComplaint || 'Reported medical concern.'}
              </div>
            </div>

            <div style={{ borderLeft: '3px solid #0f766e', paddingLeft: '14px' }}>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: '#52736d',
                  marginBottom: '4px',
                }}
              >
                2. Clinical Observations & Recorded Vitals
              </div>
              <div style={{ fontSize: '14px', color: '#0b3f3a', lineHeight: 1.6 }}>
                {session.summaryObservations || 'Clinical vitals recorded and verified.'}
              </div>
            </div>

            <div style={{ borderLeft: '3px solid #0f766e', paddingLeft: '14px' }}>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: '#52736d',
                  marginBottom: '4px',
                }}
              >
                3. Doctor's Medical Advice & Treatment Plan
              </div>
              <div style={{ fontSize: '14px', color: '#0b3f3a', lineHeight: 1.6 }}>
                {session.summaryDoctorAdvice || 'Follow medical guidance provided.'}
              </div>
            </div>

            <div style={{ borderLeft: '3px solid #0f766e', paddingLeft: '14px' }}>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: '#52736d',
                  marginBottom: '4px',
                }}
              >
                4. Prescribed Medications & Actions
              </div>
              <div style={{ fontSize: '14px', color: '#0b3f3a', lineHeight: 1.6 }}>
                {session.summaryPrescribedActions || 'Digital prescription provided in patient portal.'}
              </div>
            </div>

            <div style={{ borderLeft: '3px solid #d97706', paddingLeft: '14px' }}>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: '#d97706',
                  marginBottom: '4px',
                }}
              >
                5. Follow-Up Instructions & Warning Signs
              </div>
              <div style={{ fontSize: '14px', color: '#0b3f3a', lineHeight: 1.6 }}>
                {session.summaryFollowUp || 'Follow up with clinician if symptoms do not improve.'}
              </div>
            </div>
          </div>

          <div style={{ marginTop: '32px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button onClick={() => navigate('/prescriptions')} className="btn btn-primary hover-lift">
              View Prescriptions
            </button>
            <button onClick={() => navigate('/appointments')} className="btn btn-secondary hover-lift">
              My Appointments
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Active Live Video Consultation Suite
  return (
    <div
      style={{
        maxWidth: '1500px',
        margin: '0 auto',
        padding: '12px 18px',
        height: '100vh',
        maxHeight: '100vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        boxSizing: 'border-box',
      }}
    >
      {/* Top Header Bar */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 24px',
          backgroundColor: '#ffffff',
          borderRadius: '18px',
          border: '1px solid #d9ece7',
          boxShadow: '0 2px 10px rgba(15,118,110,0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              background: '#eaf6f2',
              border: 'none',
              color: '#0f766e',
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0b3f3a', margin: 0 }}>
                {isDoctor ? `Consultation with ${session.patientName}` : `Consultation with ${session.doctorName}`}
              </h2>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#0f766e',
                  backgroundColor: '#eaf6f2',
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <ShieldCheck size={12} /> Encrypted WebRTC
              </span>
            </div>
            <div style={{ fontSize: '12px', color: '#52736d' }}>
              Room: {session.roomId} · {appointment?.doctorSpecialty || 'General Medicine'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Peer connection badge */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 12px',
              borderRadius: '9999px',
              fontSize: '12px',
              fontWeight: 600,
              backgroundColor:
                peerConnectionStatus === 'connected'
                  ? 'rgba(34, 197, 94, 0.12)'
                  : peerConnectionStatus === 'connecting'
                  ? 'rgba(234, 179, 8, 0.15)'
                  : 'rgba(100, 116, 139, 0.12)',
              color:
                peerConnectionStatus === 'connected'
                  ? '#15803d'
                  : peerConnectionStatus === 'connecting'
                  ? '#b45309'
                  : '#475569',
              border: `1px solid ${
                peerConnectionStatus === 'connected'
                  ? 'rgba(34, 197, 94, 0.3)'
                  : peerConnectionStatus === 'connecting'
                  ? 'rgba(234, 179, 8, 0.3)'
                  : 'rgba(100, 116, 139, 0.2)'
              }`,
            }}
          >
            {peerConnectionStatus === 'connected' ? (
              <>
                <Radio size={13} className="animate-pulse" />
                <span>P2P Live HD</span>
              </>
            ) : peerConnectionStatus === 'connecting' ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>Connecting…</span>
              </>
            ) : (
              <>
                <Wifi size={13} />
                <span>Waiting for {isDoctor ? 'Patient' : 'Doctor'}</span>
              </>
            )}
          </div>

          {/* Call duration timer */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#0b3f3a',
              color: '#ffffff',
              padding: '6px 14px',
              borderRadius: '9999px',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#22c55e',
                animation: 'pulse 1.5s infinite',
              }}
            />
            <span>{formatTimer(secondsElapsed)}</span>
          </div>

          <button
            onClick={() => setShowEndModal(true)}
            className="hover-lift"
            style={{
              backgroundColor: '#dc2626',
              color: '#ffffff',
              border: 'none',
              borderRadius: '9999px',
              padding: '8px 20px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <PhoneOff size={16} /> End Consultation
          </button>
        </div>
      </header>

      {/* Main Consultation Stage */}
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 380px',
          gap: '16px',
          minHeight: 0,
        }}
      >
        {/* Left: Video Tiles Stage */}
        <div
          style={{
            backgroundColor: '#0b1f1c',
            borderRadius: '22px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
            overflow: 'hidden',
            border: '1px solid #1c3d37',
          }}
        >
          {/* Video Grid */}
          <div
            style={{
              flex: 1,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '14px',
              minHeight: 0,
            }}
          >
            {/* Local Video Tile (Self) */}
            <div
              style={{
                backgroundColor: '#162e2a',
                borderRadius: '16px',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #234842',
              }}
            >
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: isVideoOff ? 'none' : 'block',
                  transform: isScreenSharing ? 'none' : 'scaleX(-1)',
                }}
              />
              {isVideoOff && (
                <div style={{ textAlign: 'center', color: '#9fc2ba' }}>
                  <div
                    style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '50%',
                      backgroundColor: '#0f766e',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 10px',
                      fontSize: '24px',
                      fontWeight: 700,
                    }}
                  >
                    {currentUser?.fullName?.charAt(0) || 'U'}
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>Camera Disabled</div>
                </div>
              )}
              <div
                style={{
                  position: 'absolute',
                  bottom: '12px',
                  left: '12px',
                  backgroundColor: 'rgba(11, 31, 28, 0.75)',
                  backdropFilter: 'blur(4px)',
                  color: '#ffffff',
                  padding: '4px 10px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>You ({isDoctor ? 'Doctor' : 'Patient'})</span>
                {isMuted && <MicOff size={13} color="#f87171" />}
                {isScreenSharing && (
                  <span
                    style={{
                      backgroundColor: '#0284c7',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      fontSize: '10px',
                    }}
                  >
                    Screen
                  </span>
                )}
              </div>
            </div>

            {/* Remote Peer Video Tile */}
            <div
              style={{
                backgroundColor: '#162e2a',
                borderRadius: '16px',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #234842',
              }}
            >
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: hasRemoteStream && !peerIsVideoOff ? 'block' : 'none',
                }}
              />

              {/* Fallback avatar preview when remote stream is loading, pending, or peer turned off camera */}
              {(!hasRemoteStream || peerIsVideoOff) && (
                <div style={{ textAlign: 'center', color: '#9fc2ba', padding: '20px' }}>
                  <div
                    style={{
                      width: '72px',
                      height: '72px',
                      borderRadius: '50%',
                      backgroundColor: '#0f766e',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 12px',
                      fontSize: '26px',
                      fontWeight: 700,
                      boxShadow: '0 0 20px rgba(15,118,110,0.4)',
                    }}
                  >
                    {peerDisplayName.charAt(0)}
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff', marginBottom: '4px' }}>
                    {peerDisplayName}
                  </div>
                  <div
                    style={{
                      fontSize: '12px',
                      color: peerConnectionStatus === 'connected' ? '#4ade80' : '#94a3b8',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: 'rgba(15,118,110,0.2)',
                      padding: '4px 12px',
                      borderRadius: '9999px',
                    }}
                  >
                    <span
                      style={{
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        backgroundColor:
                          peerConnectionStatus === 'connected'
                            ? '#22c55e'
                            : peerConnectionStatus === 'connecting'
                            ? '#eab308'
                            : '#94a3b8',
                      }}
                    />
                    {peerConnectionStatus === 'connected'
                      ? peerIsVideoOff
                        ? 'Camera Off · Live Audio Connected'
                        : 'WebRTC P2P Live'
                      : peerConnectionStatus === 'connecting'
                      ? 'Establishing encrypted stream…'
                      : `Waiting for ${isDoctor ? 'patient' : 'doctor'} to enter room`}
                  </div>
                </div>
              )}

              {/* Remote Peer Label Bar */}
              <div
                style={{
                  position: 'absolute',
                  bottom: '12px',
                  left: '12px',
                  backgroundColor: 'rgba(11, 31, 28, 0.75)',
                  backdropFilter: 'blur(4px)',
                  color: '#ffffff',
                  padding: '4px 10px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>{peerDisplayName}</span>
                {peerIsMuted && <MicOff size={13} color="#f87171" />}
              </div>

              {/* Remote audio mute button (essential for dual-tab local testing to prevent feedback echo) */}
              <button
                onClick={toggleRemoteAudio}
                title={isRemoteAudioMuted ? 'Unmute remote audio' : 'Mute remote audio (prevents local echo)'}
                style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  backgroundColor: isRemoteAudioMuted ? 'rgba(220, 38, 38, 0.85)' : 'rgba(11, 31, 28, 0.75)',
                  backdropFilter: 'blur(4px)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '5px 8px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                {isRemoteAudioMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                <span>{isRemoteAudioMuted ? 'Audio Muted' : 'Mute Peer Audio'}</span>
              </button>
            </div>
          </div>

          {/* Media Controls Bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '12px',
              marginTop: '16px',
              paddingTop: '14px',
              borderTop: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <button
              onClick={toggleMute}
              className="hover-lift"
              title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '50%',
                backgroundColor: isMuted ? '#dc2626' : '#234842',
                color: '#ffffff',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
            </button>

            <button
              onClick={toggleVideo}
              className="hover-lift"
              title={isVideoOff ? 'Enable camera' : 'Disable camera'}
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '50%',
                backgroundColor: isVideoOff ? '#dc2626' : '#234842',
                color: '#ffffff',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              {isVideoOff ? <VideoOff size={18} /> : <Video size={18} />}
            </button>

            <button
              onClick={toggleScreenShare}
              className="hover-lift"
              title={isScreenSharing ? 'Stop sharing screen' : 'Share your screen'}
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '50%',
                backgroundColor: isScreenSharing ? '#0284c7' : '#234842',
                color: '#ffffff',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <ScreenShare size={18} />
            </button>
          </div>
        </div>

        {/* Right: Tabbed Conversation & Clinical Notes Panel */}
        <aside
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '22px',
            border: '1px solid #d9ece7',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 4px 20px rgba(15,118,110,0.05)',
          }}
        >
          {/* Tabs */}
          <div
            style={{
              display: 'flex',
              borderBottom: '1px solid #d9ece7',
              backgroundColor: '#f5faf8',
            }}
          >
            <button
              onClick={() => setActiveTab('chat')}
              style={{
                flex: 1,
                padding: '12px 14px',
                border: 'none',
                background: activeTab === 'chat' ? '#ffffff' : 'transparent',
                fontWeight: activeTab === 'chat' ? 700 : 500,
                color: activeTab === 'chat' ? '#0f766e' : '#52736d',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                borderBottom: activeTab === 'chat' ? '2px solid #0f766e' : 'none',
              }}
            >
              <MessageSquare size={15} /> Conversation ({messages.length})
            </button>
            <button
              onClick={() => setActiveTab('notes')}
              style={{
                flex: 1,
                padding: '12px 14px',
                border: 'none',
                background: activeTab === 'notes' ? '#ffffff' : 'transparent',
                fontWeight: activeTab === 'notes' ? 700 : 500,
                color: activeTab === 'notes' ? '#0f766e' : '#52736d',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                borderBottom: activeTab === 'notes' ? '2px solid #0f766e' : 'none',
              }}
            >
              <FileText size={15} /> Clinical Notes
            </button>
          </div>

          {/* Tab 1: Live Conversation Feed */}
          {activeTab === 'chat' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              {/* Quick Prompts Bar */}
              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: '#fdfbf7',
                  borderBottom: '1px solid #eae3d8',
                  fontSize: '11px',
                }}
              >
                <div
                  style={{
                    fontWeight: 700,
                    color: '#785b47',
                    marginBottom: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Sparkles size={12} /> Quick Clinical Prompts:
                </div>
                <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
                  {quickPrompts.map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(q)}
                      style={{
                        whiteSpace: 'nowrap',
                        backgroundColor: '#ffffff',
                        border: '1px solid #d9ece7',
                        borderRadius: '9999px',
                        padding: '3px 10px',
                        fontSize: '11px',
                        color: '#0b3f3a',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message List */}
              <div
                ref={chatScrollRef}
                style={{
                  flex: 1,
                  padding: '14px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                {messages.length === 0 ? (
                  <div
                    style={{
                      margin: 'auto',
                      textAlign: 'center',
                      color: '#8aa39d',
                      fontSize: '13px',
                      padding: '20px',
                    }}
                  >
                    <MessageSquare size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                    Live consultation messages will appear here. Messages are automatically archived into the
                    post-visit clinical summary.
                  </div>
                ) : (
                  messages.map(msg => {
                    const isSelf = msg.sender === currentUser?.fullName;
                    return (
                      <div
                        key={msg.id}
                        style={{
                          alignSelf: isSelf ? 'flex-end' : 'flex-start',
                          maxWidth: '82%',
                          backgroundColor: isSelf ? '#0f766e' : '#f0fdf4',
                          color: isSelf ? '#ffffff' : '#0b3f3a',
                          padding: '8px 12px',
                          borderRadius: '12px',
                          border: isSelf ? 'none' : '1px solid #d9ece7',
                          fontSize: '13px',
                          lineHeight: 1.4,
                        }}
                      >
                        <div
                          style={{
                            fontSize: '10px',
                            opacity: 0.8,
                            marginBottom: '2px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: '8px',
                          }}
                        >
                          <span>{msg.sender}</span>
                          <span>{msg.time}</span>
                        </div>
                        <div>{msg.text}</div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Input field */}
              <form
                onSubmit={e => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                style={{
                  padding: '12px',
                  borderTop: '1px solid #d9ece7',
                  display: 'flex',
                  gap: '8px',
                }}
              >
                <input
                  type="text"
                  placeholder="Type message or symptoms…"
                  value={messageInput}
                  onChange={e => setMessageInput(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '9px 12px',
                    borderRadius: '10px',
                    border: '1px solid #d9ece7',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
                <button
                  type="submit"
                  disabled={!messageInput.trim()}
                  style={{
                    backgroundColor: '#0f766e',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '0 14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: messageInput.trim() ? 1 : 0.5,
                  }}
                >
                  <Send size={15} />
                </button>
              </form>
            </div>
          )}

          {/* Tab 2: Doctor Clinical Notes */}
          {activeTab === 'notes' && (
            <div
              style={{
                flex: 1,
                padding: '16px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#52736d', textTransform: 'uppercase' }}>
                Observed Vitals & Biometrics
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: '#52736d' }}>Blood Pressure</label>
                  <input
                    type="text"
                    value={vitalBP}
                    onChange={e => setVitalBP(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      borderRadius: '8px',
                      border: '1px solid #d9ece7',
                      fontSize: '12px',
                      marginTop: '2px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: '#52736d' }}>Heart Rate</label>
                  <input
                    type="text"
                    value={vitalPulse}
                    onChange={e => setVitalPulse(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      borderRadius: '8px',
                      border: '1px solid #d9ece7',
                      fontSize: '12px',
                      marginTop: '2px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', color: '#52736d' }}>Body Temperature</label>
                <input
                  type="text"
                  value={vitalTemp}
                  onChange={e => setVitalTemp(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    border: '1px solid #d9ece7',
                    fontSize: '12px',
                    marginTop: '2px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#0b3f3a' }}>
                  Doctor Advice & Guidance
                </label>
                <textarea
                  rows={3}
                  value={doctorNotes}
                  onChange={e => setDoctorNotes(e.target.value)}
                  placeholder="Record treatment plan, dietary guidance, rest instructions…"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid #d9ece7',
                    fontSize: '12px',
                    marginTop: '4px',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#0b3f3a' }}>
                  Prescribed Actions / Meds
                </label>
                <input
                  type="text"
                  value={prescribedActions}
                  onChange={e => setPrescribedActions(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: '8px',
                    border: '1px solid #d9ece7',
                    fontSize: '12px',
                    marginTop: '4px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#0b3f3a' }}>
                  Follow-up Schedule
                </label>
                <input
                  type="text"
                  value={followUpAdvice}
                  onChange={e => setFollowUpAdvice(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: '8px',
                    border: '1px solid #d9ece7',
                    fontSize: '12px',
                    marginTop: '4px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* End Consultation & Post-Visit Summary Modal */}
      <AnimatePresence>
        {showEndModal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 100,
              backgroundColor: 'rgba(11, 31, 28, 0.65)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '24px',
                padding: '32px',
                maxWidth: '640px',
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
                border: '1px solid #d9ece7',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <CheckCircle2 size={24} color="#0f766e" />
                <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0b3f3a', margin: 0 }}>
                  Conclude Consultation & Generate Summary
                </h2>
              </div>

              <p style={{ fontSize: '13px', color: '#52736d', lineHeight: 1.5, marginBottom: '20px' }}>
                Ending this consultation will finalize the appointment, compile the live transcript, and
                generate the structured clinical summary for the patient.
              </p>

              {/* Summary Preview Box */}
              <div
                style={{
                  backgroundColor: '#f5faf8',
                  borderRadius: '16px',
                  padding: '16px',
                  border: '1px solid #d9ece7',
                  marginBottom: '24px',
                  fontSize: '13px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div>
                  <strong style={{ color: '#0b3f3a' }}>Chief Complaint:</strong>{' '}
                  <span style={{ color: '#52736d' }}>
                    {appointment?.chiefComplaint || 'Consultation follow-up'}
                  </span>
                </div>
                <div>
                  <strong style={{ color: '#0b3f3a' }}>Observations:</strong>{' '}
                  <span style={{ color: '#52736d' }}>
                    BP {vitalBP}, Pulse {vitalPulse}, Temp {vitalTemp}
                  </span>
                </div>
                <div>
                  <strong style={{ color: '#0b3f3a' }}>Doctor Advice:</strong>{' '}
                  <span style={{ color: '#52736d' }}>{doctorNotes || 'Symptomatic rest and hydration advised'}</span>
                </div>
                <div>
                  <strong style={{ color: '#0b3f3a' }}>Prescription / Actions:</strong>{' '}
                  <span style={{ color: '#52736d' }}>{prescribedActions}</span>
                </div>
                <div>
                  <strong style={{ color: '#0b3f3a' }}>Follow-up:</strong>{' '}
                  <span style={{ color: '#52736d' }}>{followUpAdvice}</span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowEndModal(false)}
                  disabled={isEnding}
                  className="btn btn-secondary hover-lift"
                >
                  Return to Call
                </button>
                <button
                  type="button"
                  onClick={handleEndConsultation}
                  disabled={isEnding}
                  className="btn btn-primary hover-lift"
                  style={{ backgroundColor: '#059669', borderColor: '#059669' }}
                >
                  {isEnding ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Saving Summary…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} /> Finalize & Save Summary
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
