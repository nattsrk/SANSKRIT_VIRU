iport React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './VideoRoom.css';
import { API_BASE } from '../config';

function VideoRoom() {
  const socketRef = useRef(null);
  const peersRef = useRef({});
  const userNamesRef = useRef({});
  const localVideoRef = useRef(null);
  
  const [remoteStreams, setRemoteStreams] = useState([]);
  const [streamReady, setStreamReady] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [stream, setStream] = useState(null);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);

  const { roomId } = useParams();
  const { user } = useAuth();
  const isTeacher = user.role === 'teacher';

  useEffect(() => {
    async function startCamera() {
      try {
       
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });

        setStream(mediaStream);

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = mediaStream;
        }
        setStreamReady(true);
        setCameraError(false);
      } catch (err) {
        console.error("Camera error caught:", err);
        setStreamReady(false);
        setCameraError(true);
        
        
        if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          setErrorMessage("Your camera or microphone is already in use by another program or browser tab.");
        } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setErrorMessage("Camera/Microphone access was blocked. Please reset site permissions in your address bar.");
        } else {
          setErrorMessage("Could not connect to video/audio hardware devices.");
        }
      }
    }

    startCamera();

    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    const handleUnload = () => {
      cleanup();
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [stream]);

  
  const createPeerConnection = (targetId, isInitiator) => {
    if (peersRef.current[targetId]) {
      return peersRef.current[targetId];
    }

    if (!stream) {
      console.warn("Stream not ready yet - skipping peer creation");
      return null;
    }

    const peer = new RTCPeerConnection({
      iceServers: [
        {
          urls: [
            'stun:stun.l.google.com:19302',
            'stun:stun1.l.google.com:19302'
          ]
        }
      ]
    });

    peer.onsignalingstatechange = () => {
      console.log(targetId, peer.signalingState);
    };

    peer.oniceconnectionstatechange = () => {
      console.log(targetId, 'ICE:', peer.iceConnectionState);
    };

    peersRef.current[targetId] = peer;

    stream.getTracks().forEach(track => {
      peer.addTrack(track, stream);
    });

    peer.ontrack = (event) => {
      console.log('Track received:', event.track.kind);
      const remoteStream = event.streams[0];

      setRemoteStreams(prev => {
        const exists = prev.find(p => p.id === targetId);
        if (exists) return prev;

        return [
          ...prev,
          {
            id: targetId,
            name: userNamesRef.current[targetId] || 'Participant',
            stream: remoteStream
          }
        ];
      });
    };

    peer.onicecandidate = event => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('ice-candidate', {
          to: targetId,
          candidate: event.candidate
        });
      }
    };

    if (isInitiator) {
      if (peer.signalingState !== 'stable') {
        console.log('Cannot create offer. State:', peer.signalingState);
        return peer;
      }

      console.log('Creating offer for:', targetId);
      peer.createOffer()
        .then(async offer => {
          if (peer.signalingState !== 'stable') {
            console.log('Offer aborted. State:', peer.signalingState);
            return;
          }

          await peer.setLocalDescription(offer);
          console.log('Offer sent to:', targetId, 'State:', peer.signalingState);

          if (socketRef.current) {
            socketRef.current.emit('offer', {
              to: targetId,
              offer: peer.localDescription
            });
          }
        })
        .catch(err => {
          console.error('Offer creation error:', err);
        });
    }

    return peer;
  };

  useEffect(() => {
    if (!stream) return;

   
    const authToken = localStorage.getItem('token') || user?.token;

    socketRef.current = io(API_BASE, {
      auth: {
        token: authToken
      }
    });

    socketRef.current.on('connect', () => {
      console.log('Connected to Signaling service:', socketRef.current.id);
      if (socketRef.current) {
        socketRef.current.emit('join-room', {
          roomId,
          userName: user?.name || 'Anonymous',
          role: user?.role || 'student',
          token: authToken 
        });
      }
    });

    socketRef.current.on('existing-users', (users) => {
      users.forEach(u => {
        userNamesRef.current[u.id] = u.name;

        if (isTeacher) {
          setTimeout(() => {
            createPeerConnection(u.id, true);
          }, 100);
        }
      });
    });

    socketRef.current.on('user-joined', ({ id, name }) => {
      userNamesRef.current[id] = name;
      if (isTeacher) {
        createPeerConnection(id, true);
      }
    });

    socketRef.current.on('offer', async ({ from, offer }) => {
      console.log('Offer received from:', from);
      const peer = createPeerConnection(from, false);
      if (!peer) return;

      if (peer.signalingState !== 'stable') {
        console.log('Ignoring offer. Current state:', peer.signalingState);
        return;
      }

      try {
        await peer.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);

        console.log('Answer created for:', from, 'State:', peer.signalingState);
        if (socketRef.current) {
          socketRef.current.emit('answer', {
            to: from,
            answer
          });
        }
      } catch (err) {
        console.error('Remote description/Answer error:', err);
      }
    });

    socketRef.current.on('answer', async ({ from, answer }) => {
      const peer = peersRef.current[from];
      if (!peer) return;

      console.log('Answer received from:', from, 'Current state:', peer.signalingState);

      if (peer.signalingState !== 'have-local-offer') {
        console.log('Ignoring answer');
        return;
      }

      try {
        await peer.setRemoteDescription(new RTCSessionDescription(answer));
        console.log('Answer applied');
      } catch (err) {
        console.error('Answer error:', err);
      }
    });

    socketRef.current.on('ice-candidate', async ({ from, candidate }) => {
      const peer = peersRef.current[from];
      if (!peer) return;

      try {
        await peer.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error('Error adding ICE candidate:', err);
      }
    });

    socketRef.current.on('student-left', (id) => {
      console.log('Student left:', id);
      if (peersRef.current[id]) {
        peersRef.current[id].close();
        delete peersRef.current[id];
      }
      setRemoteStreams(prev => prev.filter(item => item.id !== id));
    });

    socketRef.current.on('teacher-ended', () => {
      alert('Teacher ended the class');
      cleanup();
      window.location.href = '/SANSKRIT_VIRU#/classes';
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      Object.values(peersRef.current).forEach(peer => {
        try {
          peer.ontrack = null;
          peer.onicecandidate = null;
          peer.close();
        } catch {}
      });
      peersRef.current = {};
    };
  }, [stream, roomId, isTeacher, user]);

  
  const toggleMic = () => {
    if (!stream) return;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !track.enabled;
    });
    setMicOn(!micOn);
  };

  const toggleCamera = () => {
    if (!stream) return;
    stream.getVideoTracks().forEach((track) => {
      track.enabled = !track.enabled;
    });
    setCameraOn(!cameraOn);
  };

  const cleanup = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    setStream(null);
    setStreamReady(false);
    
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    setRemoteStreams([]);

    Object.values(peersRef.current).forEach(peer => {
      peer.close();
    });
    peersRef.current = {};

    if (socketRef.current) {
      socketRef.current.disconnect();
    }
  };

  const leaveRoom = () => {
    if (socketRef.current) {
      socketRef.current.emit('leave-room', {
        roomId,
        role: user?.role
      });
    }
    cleanup();
    window.location.href = '/SANSKRIT_VIRU#/classes';
  };

  
  if (cameraError) {
    return (
      <div className="video-room-error">
        <h2>Hardware Access Restricted</h2>
        <p className="error-highlight">{errorMessage}</p>
        <p>To fix this, make sure no other program is using your camera, check your URL address bar permission locks, and try reloading the interface.</p>
      </div>
    );
  }

 
  if (!streamReady) {
    return (
      <div className="video-room-loading">
        <h2>Connecting to audio and video configurations...</h2>
        <p>Please allow media device access if prompted.</p>
      </div>
    );
  }

  return (
    <div className="video-room">
      <h2 className="video-title">Live Classroom</h2>

      <div className="video-grid">
        <div className="video-card">
          <h3>{isTeacher ? 'Teacher (You)' : 'You'}</h3>
          <video ref={localVideoRef} autoPlay playsInline muted />
        </div>

        {remoteStreams.map(remoteUser => (
          <div key={remoteUser.id} className="video-card">
            <h3>{remoteUser.name}</h3>
            <video
              autoPlay
              playsInline
              controls={false}
              ref={(video) => {
                if (video && video.srcObject !== remoteUser.stream) {
                  console.log('Assigning stream:', remoteUser.id);
                  video.srcObject = remoteUser.stream;
                  video.onloadedmetadata = () => {
                    video.play().catch(console.error);
                  };
                }
              }}
            />
          </div>
        ))}
      </div>

      <div className="video-controls">
        <button className="control-btn" onClick={toggleMic}>
          {micOn ? 'Mute' : 'Unmute'}
        </button>
        <button className="control-btn" onClick={toggleCamera}>
          {cameraOn ? 'Camera Off' : 'Camera On'}
        </button>
        <button className="leave-btn" onClick={leaveRoom}>
          Leave
        </button>
      </div>
    </div>
  );
}

export default VideoRoom;