const express = require('express');
const router = express.Router();
const { getDb } = require('../db/schema');
console.log('Rooms route loaded');
// Start a room
router.post('/start', (req, res) => {
  try {
    const db = getDb();

    const { classId, hostId } = req.body;

    const roomCode =
      Math.random().toString(36).substring(2, 8);

    const result = db
      .prepare(`
        INSERT INTO video_rooms
        (class_id, host_id, room_code)
        VALUES (?, ?, ?)
      `)
      .run(classId, hostId, roomCode);

    res.json({
      roomId: result.lastInsertRowid,
      roomCode
    });

    db.close();

  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// Check active room
router.get('/:classId/active', (req, res) => {
  try {
    const db = getDb();

    const classId = req.params.classId;

    const room = db
      .prepare(`
        SELECT *
        FROM video_rooms
        WHERE class_id = ?
        AND ended_at IS NULL
        ORDER BY started_at DESC
        LIMIT 1
      `)
      .get(classId);

    db.close();

    if (!room) {
      return res.json({
        active: false
      });
    }

    res.json({
      active: true,
      room
    });

  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// End a room
router.post('/:id/end', (req, res) => {
  try {
    const db = getDb();

    const roomId = req.params.id;

    db.prepare(`
      UPDATE video_rooms
      SET ended_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(roomId);

    db.close();

    res.json({
      success: true
    });

  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

module.exports = router;