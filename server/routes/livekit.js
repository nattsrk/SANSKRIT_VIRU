const express = require('express');
const router = express.Router();
const { AccessToken } = require('livekit-server-sdk');

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || 'devkey';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || 'secret';

// POST /api/livekit/token
// Body: { roomName, participantName, role }
router.post('/token', async (req, res) => {
  try {
    const { roomName, participantName, role } = req.body;

    if (!roomName || !participantName) {
      return res.status(400).json({ error: 'roomName and participantName are required' });
    }

    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: participantName,
      ttl: '2h',
    });

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: role === 'teacher',      // only teacher can publish video/audio
      canSubscribe: true,                   // everyone can watch
      canPublishData: true,
    });

    const token = await at.toJwt();

    res.json({ token });

  } catch (err) {
    console.error('Token generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;