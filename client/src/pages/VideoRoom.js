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
import { Track } from 'livekit-client';
import './VideoRoom.css';
import { API_BASE } from '../config';

const LIVEKIT_URL = process.env.REACT_APP_LIVEKIT_URL || 'ws://localhost:7880';

// Controls for all participants
function RoomControls({ isTeacher, onLeave }) {
  const room = useRoomContext();
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);

  const toggleMic = async () => {
    await room.localParticipant.setMicrophoneEnabled(!micOn);
    setMicOn(!micOn);
  };

  const toggleCamera = async () => {
    await room.localParticipant.setCameraEnabled(!cameraOn);
    setCameraOn(!cameraOn);
  };

  const toggleScreenShare = async () => {
    await room.localParticipant.setScreenShareEnabled(!screenSharing);
    setScreenSharing(!screenSharing);
  };

  return (
    <div className="video-controls">
      <button className="control-btn" onClick={toggleMic}>
        {micOn ? 'Mute' : 'Unmute'}
      </button>
      <button className="control-btn" onClick={toggleCamera}>
        {cameraOn ? 'Camera Off' : 'Camera On'}
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
  );
}

// Inner room UI
function RoomUI({ isTeacher, onLeave }) {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

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
      video={true}
      audio={true}
      onDisconnected={handleLeave}
      style={{ height: '100vh' }}
    >
      <RoomUI isTeacher={isTeacher} onLeave={handleLeave} />
    </LiveKitRoom>
  );
}
