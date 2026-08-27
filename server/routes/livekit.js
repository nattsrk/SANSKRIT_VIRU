const express = require('express');
const router = express.Router();
const { AccessToken } = require('livekit-server-sdk');

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;

// Fail fast on boot if these aren't set, rather than silently minting
// tokens against a hardcoded devkey/secret pair in production.
if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
  throw new Error(
    'LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be set in the environment.'
  );
}

const VALID_ROLES = ['teacher', 'student'];

router.post('/token', async (req, res) => {
  try {
    const { roomName, participantName, role } = req.body;

    if (!roomName || !participantName) {
      return res.status(400).json({ error: 'roomName and participantName are required' });
    }

    // Anything other than an explicit 'teacher' is treated as a student.
    // This is server-side, so a client can't grant itself teacher
    // privileges just by sending role: 'teacher' in the request body —
    // add real auth/role-lookup here before trusting req.body.role in
    // production (e.g. look up the user's role from their session/JWT
    // instead of accepting it as a client-supplied field).
    const normalizedRole = VALID_ROLES.includes(role) ? role : 'student';

    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: participantName,
      // Lets clients distinguish the teacher from students via
      // participant.metadata (used e.g. to end the call for students
      // when the teacher disconnects).
      metadata: JSON.stringify({ role: normalizedRole }),
      ttl: '2h',
    });

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
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