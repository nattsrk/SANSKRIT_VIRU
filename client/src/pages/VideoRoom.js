import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useTracks,
  TrackLoop,
  TrackRefContext,
  VideoTrack,
  ParticipantName,
  useRoomContext,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { Track, RoomEvent, ConnectionState } from 'livekit-client';
import './VideoRoom.css';
import { API_BASE } from '../config';

// Required env var — no hardcoded fallback in production. A missing var
// should be obvious immediately, not silently pointed at localhost.
const LIVEKIT_URL = process.env.REACT_APP_LIVEKIT_URL;
if (!LIVEKIT_URL) {
  console.error('REACT_APP_LIVEKIT_URL is not set.');
}

/**
 * Returns true if a LiveKit participant is the teacher, based on the
 * `role` metadata the backend sets when it mints the access token
 * (see server/routes/livekit.js).
 */
function participantIsTeacher(participant) {
  if (!participant?.metadata) return false;
  try {
    return JSON.parse(participant.metadata).role === 'teacher';
  } catch {
    return false;
  }
}

// Controls for all participants: mic, camera, screen share (teacher only), leave.
function RoomControls({ isTeacher, onLeave }) {
  const room = useRoomContext();
  const [micOn, setMicOn] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [mediaError, setMediaError] = useState(null);

  // Prime browser camera/mic permission on mount without publishing,
  // so the first real toggle doesn't stall on a permission prompt.
  useEffect(() => {
    let stream;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        stream.getTracks().forEach((t) => t.stop());
      } catch (err) {
        console.error('Initial permission request failed:', err.name, err.message);
      }
    })();
    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const describeMediaError = (err) => {
    switch (err.name) {
      case 'NotAllowedError':
        return 'Permission was denied. Check your browser site settings.';
      case 'NotFoundError':
        return 'No matching device was found on this device.';
      case 'NotReadableError':
        return 'Device is already in use by another app or tab.';
      default:
        return `Device error: ${err.message}`;
    }
  };

  const toggleMic = async () => {
    try {
      await room.localParticipant.setMicrophoneEnabled(!micOn);
      setMicOn(!micOn);
      setMediaError(null);
    } catch (err) {
      console.error('Microphone error:', err.name, err.message);
      setMediaError(describeMediaError(err));
    }
  };

  const toggleCamera = async () => {
    try {
      await room.localParticipant.setCameraEnabled(!cameraOn);
      setCameraOn(!cameraOn);
      setMediaError(null);
    } catch (err) {
      console.error('Camera error:', err.name, err.message);
      setMediaError(describeMediaError(err));
    }
  };

  const toggleScreenShare = async () => {
    try {
      await room.localParticipant.setScreenShareEnabled(!screenSharing);
      setScreenSharing(!screenSharing);
    } catch (err) {
      console.error('Screen share error:', err.name, err.message);
    }
  };

  return (
    <div className="video-controls-wrapper">
      {mediaError && (
        <div className="media-error-banner" role="alert">
          {mediaError}
        </div>
      )}
      <div className="video-controls">
        <button className="control-btn" onClick={toggleMic}>
          {micOn ? 'Mute' : 'Turn On Mic'}
        </button>
        <button className="control-btn" onClick={toggleCamera}>
          {cameraOn ? 'Camera Off' : 'Turn On Camera'}
        </button>
        {isTeacher && (
          <button className="control-btn" onClick={toggleScreenShare}>
            {screenSharing ? 'Stop Share' : 'Share Screen'}
          </button>
        )}
        <button className="leave-btn" onClick={onLeave}>
          Leave
        </button>
      </div>
    </div>
  );
}

// Small banner shown while LiveKit is reconnecting after a network drop.
// The LiveKit SDK handles the actual reconnect (ICE restart / resume)
// automatically — this just surfaces that state to the user instead of
// leaving them staring at a frozen video with no explanation.
function ConnectionBanner({ state }) {
  if (state === ConnectionState.Reconnecting) {
    return (
      <div className="connection-banner reconnecting" role="status">
        Connection lost — reconnecting...
      </div>
    );
  }
  return null;
}

// Inner room UI — renders tracks/controls and watches for the teacher disconnecting.
function RoomUI({ isTeacher, onLeave }) {
  const room = useRoomContext();
  const [connectionState, setConnectionState] = useState(room.state);

  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  // Track reconnect state so we can show a banner instead of a silently
  // frozen call during a network blip.
  useEffect(() => {
    const handleStateChange = (state) => setConnectionState(state);
    room.on(RoomEvent.ConnectionStateChanged, handleStateChange);
    return () => {
      room.off(RoomEvent.ConnectionStateChanged, handleStateChange);
    };
  }, [room]);

  // Students: end the call the moment the teacher's participant disconnects.
  // Reacts to the actual LiveKit event rather than a participant count, so
  // it can't misfire on join (before data has synced) or when a different
  // student leaves.
  useEffect(() => {
    if (isTeacher) return;

    const handleParticipantDisconnected = (participant) => {
      if (participantIsTeacher(participant)) {
        alert('The teacher has ended the class.');
        onLeave();
      }
    };

    room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
    return () => {
      room.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
    };
  }, [room, isTeacher, onLeave]);

  return (
    <div className="video-room">
      <h2 className="video-title">Live Classroom</h2>

      <ConnectionBanner state={connectionState} />

      <div className="video-grid">
        <TrackLoop tracks={tracks}>
          <TrackRefContext.Consumer>
            {(trackRef) => (
              <div className="video-card">
                <h3><ParticipantName /></h3>
                <VideoTrack {...trackRef} />
              </div>
            )}
          </TrackRefContext.Consumer>
        </TrackLoop>
      </div>

      <RoomAudioRenderer />

      <RoomControls isTeacher={isTeacher} onLeave={onLeave} />
    </div>
  );
}

// Main component: fetches a token, connects to the room, renders RoomUI.
export default function VideoRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isTeacher = user?.role === 'teacher';

  const [token, setToken] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchToken() {
      try {
        const authToken = localStorage.getItem('token');
        const res = await fetch(`${API_BASE}/api/livekit/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            roomName: roomId,
            participantName: user?.name || 'Anonymous',
            role: user?.role || 'student',
          }),
        });

        const data = await res.json();

        if (data.token) {
          setToken(data.token);
        } else {
          setError(data.error || 'Failed to get room token');
        }
      } catch (err) {
        setError('Could not connect to server');
      } finally {
        setLoading(false);
      }
    }

    fetchToken();
  }, [roomId, user]);

  const handleLeave = useCallback(() => {
    navigate('/classes');
  }, [navigate]);

  if (loading) {
    return (
      <div className="video-room-loading">
        <h2>Connecting to classroom...</h2>
        <p>Please wait while we set up your session.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="video-room-error">
        <h2>Could Not Join Room</h2>
        <p className="error-highlight">{error}</p>
        <button className="control-btn" onClick={() => navigate('/classes')}>
          Back to Classes
        </button>
      </div>
    );
  }

  return (
    <LiveKitRoom
      token={token}
      serverUrl={LIVEKIT_URL}
      connect={true}
      video={false}
      audio={false}
      // LiveKit's client SDK retries dropped connections and resumes
      // published/subscribed tracks automatically. onDisconnected only
      // fires for a final, non-recoverable disconnect (explicit leave,
      // kicked, or reconnect attempts exhausted) — not a transient blip.
      onDisconnected={handleLeave}
      onMediaDeviceFailure={(failure) => {
        console.error('Media device failure:', failure);
      }}
      onError={(err) => {
        console.error('LiveKitRoom error:', err.name, err.message);
      }}
      style={{ height: '100vh' }}
    >
      <RoomUI isTeacher={isTeacher} onLeave={handleLeave} />
    </LiveKitRoom>
  );
}