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
  useParticipants,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { Track } from 'livekit-client';
import './VideoRoom.css';
import { API_BASE } from '../config';

const LIVEKIT_URL = process.env.REACT_APP_LIVEKIT_URL || 'ws://localhost:7880';

// Decodes a JWT payload client-side (for logging only)
function decodeJwtPayload(token) {
  try {
    const payload = token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// Controls for all participants
function RoomControls({ isTeacher, onLeave }) {
  const room = useRoomContext();
  const [micOn, setMicOn] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [mediaError, setMediaError] = useState(null);

  // Prime browser camera/mic permission on mount without publishing
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

  const toggleMic = async () => {
    try {
      await room.localParticipant.setMicrophoneEnabled(!micOn);
      setMicOn(!micOn);
      setMediaError(null);
    } catch (err) {
      console.error('Microphone error:', err.name, err.message);
      setMediaError(
        err.name === 'NotAllowedError'
          ? 'Microphone permission was denied. Check your browser site settings.'
          : err.name === 'NotFoundError'
          ? 'No microphone was found on this device.'
          : err.name === 'NotReadableError'
          ? 'Microphone is already in use by another app or tab.'
          : `Microphone error: ${err.message}`
      );
    }
  };

  const toggleCamera = async () => {
    try {
      await room.localParticipant.setCameraEnabled(!cameraOn);
      setCameraOn(!cameraOn);
      setMediaError(null);
    } catch (err) {
      console.error('Camera error:', err.name, err.message);
      setMediaError(
        err.name === 'NotAllowedError'
          ? 'Camera permission was denied. Check your browser site settings.'
          : err.name === 'NotFoundError'
          ? 'No camera was found on this device.'
          : err.name === 'NotReadableError'
          ? 'Camera is already in use by another app or tab.'
          : `Camera error: ${err.message}`
      );
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

// Inner room UI — also watches for teacher leaving
function RoomUI({ isTeacher, onLeave }) {
  const participants = useParticipants();

  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  // When teacher leaves, redirect all students automatically
  useEffect(() => {
    if (!isTeacher && participants.length === 1) {
      // Only the local participant (student) remains — teacher has left
      alert('The teacher has ended the class.');
      onLeave();
    }
  }, [participants, isTeacher, onLeave]);

  return (
    <div className="video-room">
      <h2 className="video-title">Live Classroom</h2>

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

// Main component
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
            'Authorization': `Bearer ${authToken}`,
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
          const payload = decodeJwtPayload(data.token);
          console.log('[LiveKit token grant]', payload?.video || payload);
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