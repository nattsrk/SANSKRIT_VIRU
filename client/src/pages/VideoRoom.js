import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './VideoRoom.css';

function VideoRoom() {
  const socketRef = useRef(null);
  const peersRef = useRef({});
  const userNamesRef = useRef({});
  const localVideoRef = useRef(null);
  const [remoteStreams, setRemoteStreams] =
  useState([]);
  const { roomId } = useParams();
  const { user } = useAuth();

  const isTeacher = user.role === 'teacher';

  const [stream, setStream] = useState(null);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);

  useEffect(() => {
  startCamera();
  // eslint-disable-next-line
}, []);


  useEffect(() => {

  const handleUnload = () => {
    cleanup();
  };

  window.addEventListener(
    'beforeunload',
    handleUnload
  );

  return () => {
    window.removeEventListener(
      'beforeunload',
      handleUnload
    );
  };

}, [stream]);


  useEffect(() => {
    if (!stream) return;

    socketRef.current = io('http://localhost:5001');

socketRef.current.on('connect', () => {
  console.log('Connected:', socketRef.current.id);

  socketRef.current.emit(
  'join-room',
  {
    roomId,
    userName: user.name
  }
);
});
  socketRef.current.on(
  'existing-users',
  (users) => {

    users.forEach(user => {

      userNamesRef.current[user.id] =
        user.name;

      if (isTeacher) {
        createPeerConnection(
          user.id,
          true
        );
      }

    });

  }
);
    
    socketRef.current.on(
  'student-left',
  (id) => {

    console.log(
      'Student left:',
      id
    );

    peersRef.current[id]?.close();

    delete peersRef.current[id];

    setRemoteStreams(prev =>
      prev.filter(
        user => user.id !== id
      )
    );
  }
);
    
socketRef.current.on(
  'teacher-ended',
  () => {

    alert(
      'Teacher ended the class'
    );

    cleanup();

    window.location.href =
      '/SANSKRIT_VIRU#/classes';

  }
);

   socketRef.current.on(
  'user-joined',
  ({ id, name }) => {

    userNamesRef.current[id] =
      name;

    if (isTeacher) {
      createPeerConnection(
        id,
        true
      );
    }

  }
);
    
    socketRef.current.on(
  'offer',
  async ({ from, offer }) => {

    console.log(
      'Offer received from:',
      from
    );

    const peer =
      createPeerConnection(
        from,
        false
      );

    console.log(
      'Before remote description:',
      peer.signalingState
    );

    if (peer.signalingState !== 'stable') {
      console.log(
        'Ignoring offer. Current state:',
        peer.signalingState
      );
      return;
    }

    try {

  await peer.setRemoteDescription(
    new RTCSessionDescription(offer)
  );

} catch (err) {

  console.error(
    'Remote description error:',
    err
  );

  return;
}

    const answer =
      await peer.createAnswer();

    await peer.setLocalDescription(
      answer
    );

    console.log(
      'Answer created for:',
      from,
      'State:',
      peer.signalingState
    );

    socketRef.current.emit(
      'answer',
      {
        to: from,
        answer
      }
    );
  }
);
   socketRef.current.on(
  'answer',
  async ({ from, answer }) => {

    const peer =
      peersRef.current[from];

    if (!peer) return;

    console.log(
      'Answer received from:',
      from
    );

    console.log(
      'Current state:',
      peer.signalingState
    );

    if (
      peer.signalingState !==
      'have-local-offer'
    ) {

      console.log(
        'Ignoring answer'
      );

      return;
    }

    try {

      await peer.setRemoteDescription(
        new RTCSessionDescription(
          answer
        )
      );

      console.log(
        'Answer applied'
      );

    } catch (err) {

      console.error(
        'Answer error:',
        err
      );

    }

  }
);

   

    socketRef.current.on(
  'ice-candidate',
  async ({
    from,
    candidate
  }) => {

    const peer =
      peersRef.current[from];

    if (!peer) return;

    try {

      await peer.addIceCandidate(
        new RTCIceCandidate(
          candidate
        )
      );

    } catch (err) {

      console.error(err);

    }
  }
);

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }

      Object.values(
  peersRef.current
).forEach(peer => {

  peer.close();

});

peersRef.current = {};
    };
  }, [roomId, stream]);

  const createPeerConnection = (
  targetId,
  isInitiator
) => {

  if (peersRef.current[targetId]) {
    return peersRef.current[targetId];
  }

  const peer =
    new RTCPeerConnection({
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
    console.log(
      targetId,
      peer.signalingState
    );
  };
  peer.oniceconnectionstatechange = () => {
  console.log(
    targetId,
    'ICE:',
    peer.iceConnectionState
  );
};
  peersRef.current[targetId] = peer;

 
  stream.getTracks().forEach(track => {
    peer.addTrack(track, stream);
  });

   console.log(
  'Sending tracks:',
  stream.getTracks().map(
    t => ({
      kind: t.kind,
      enabled: t.enabled
    })
  )
);
  
  peer.ontrack = (event) => {

  console.log(
    'Track received:',
    event.track.kind
  );

  const remoteStream =
    event.streams[0];

  console.log(
    'Remote stream:',
    remoteStream
  );

  console.log(
    'Tracks:',
    remoteStream.getTracks()
  );

  setRemoteStreams(prev => {

    const exists =
      prev.find(
        p => p.id === targetId
      );

    if (exists) return prev;

    return [
  ...prev,
  {
    id: targetId,
    name:
      userNamesRef.current[targetId] ||
      'Participant',
    stream: remoteStream
  }
];
  });
};
  
  peer.onicecandidate = event => {

    if (event.candidate) {

      socketRef.current.emit(
        'ice-candidate',
        {
          to: targetId,
          candidate: event.candidate
        }
      );

    }
  };

if (isInitiator) {

  if (peer.signalingState !== 'stable') {

    console.log(
      'Cannot create offer. State:',
      peer.signalingState
    );

    return peer;
  }

  console.log(
    'Creating offer for:',
    targetId
  );

  peer.createOffer()
    .then(async offer => {

      if (
        peer.signalingState !== 'stable'
      ) {

        console.log(
          'Offer aborted. State:',
          peer.signalingState
        );

        return;
      }

      await peer.setLocalDescription(
        offer
      );

      console.log(
        'Offer sent to:',
        targetId,
        'State:',
        peer.signalingState
      );

      socketRef.current.emit(
        'offer',
        {
          to: targetId,
          offer: peer.localDescription
        }
      );

    })
    .catch(err => {
      console.error(
        'Offer creation error:',
        err
      );
    });

}

return peer;
};
  
  const startCamera = async () => {
  try {
    if (localVideoRef.current?.srcObject) {
      return;
    }

    const mediaStream =
      await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: true
      });
      console.log(
  'Video tracks:',
  mediaStream.getVideoTracks().length
);

console.log(
  'Audio tracks:',
  mediaStream.getAudioTracks().length
);


    setStream(mediaStream);

    if (localVideoRef.current) {
      localVideoRef.current.srcObject =
        mediaStream;

      localVideoRef.current.muted = true;

      await localVideoRef.current.play();
    }
  
  } catch (err) {

  console.log(err.name);
  console.log(err);

  if (err.name === 'NotReadableError') {

    alert(
      'Camera is already being used by another application or browser tab.'
    );

  } else if (err.name === 'NotAllowedError') {

    alert(
      'Camera/Microphone permission denied.'
    );

  } else {

    alert(
      'Unable to access camera or microphone.'
    );

  }
}
};

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
    stream.getTracks().forEach(track => {
      track.stop();
    });
  }

  if (localVideoRef.current) {
    localVideoRef.current.srcObject = null;
  }

  setRemoteStreams([]);

  Object.values(
  peersRef.current
).forEach(peer => {

  peer.close();

});

peersRef.current = {};

  if (socketRef.current) {
    socketRef.current.disconnect();
  }
};

 const leaveRoom = () => {

  if (socketRef.current) {

    socketRef.current.emit(
      'leave-room',
      {
        roomId,
        role: user.role
      }
    );

  }

  cleanup();

  window.location.href =
    '/SANSKRIT_VIRU#/classes';

};

  return (
    <div className="video-room">

      <h2 className="video-title">
        Live Classroom
      </h2>

      <div className="video-grid">

        <div className="video-card">
          <h3>
            {isTeacher
              ? 'Teacher (You)'
              : 'You'}
          </h3>

          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
          />
        </div>

        {remoteStreams.map(user => (

  <div
    key={user.id}
    className="video-card"
  >

   
      <h3>{user.name}</h3>
    

    <video
      autoPlay
      playsInline
      controls={false}
      ref={(video) => {

        if (
          video &&
          video.srcObject !== user.stream
        ) {

          console.log(
            'Assigning stream:',
            user.id
          );

          video.srcObject =
            user.stream;

          video.onloadedmetadata =
            () => {
              video.play()
                .catch(console.error);
            };

        }

      }}
    />

  </div>

))}

      </div>

      <div className="video-controls">

        <button
          className="control-btn"
          onClick={toggleMic}
        >
          {micOn ? 'Mute' : 'Unmute'}
        </button>

        <button
          className="control-btn"
          onClick={toggleCamera}
        >
          {cameraOn
            ? 'Camera Off'
            : 'Camera On'}
        </button>

        <button
          className="leave-btn"
          onClick={leaveRoom}
        >
          Leave
        </button>

      </div>

    </div>
  );
}
export default VideoRoom;