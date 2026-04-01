const express = require('express');
const { getDb } = require('../db/schema');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/attendance/:classId — get attendance for a class
router.get('/:classId', authenticate, (req, res) => {
  const db = getDb();

  let attendance;
  if (req.user.role === 'student') {
    attendance = db.prepare(
      'SELECT * FROM attendance WHERE class_id = ? AND student_id = ? ORDER BY date DESC'
    ).all(req.params.classId, req.user.id);
  } else {
    attendance = db.prepare(`
      SELECT a.*, u.name as student_name
      FROM attendance a
      JOIN users u ON u.id = a.student_id
      WHERE a.class_id = ?
      ORDER BY a.date DESC, u.name
    `).all(req.params.classId);
  }

  db.close();
  res.json(attendance);
});

// POST /api/attendance — mark attendance (teacher only)
router.post('/', authenticate, requireRole('teacher'), (req, res) => {
  const { class_id, records } = req.body;
  // records = [{ student_id, status, date }]
  if (!class_id || !records || !records.length) {
    return res.status(400).json({ error: 'class_id and records are required' });
  }

  const db = getDb();
  const stmt = db.prepare(
    'INSERT OR REPLACE INTO attendance (class_id, student_id, date, status) VALUES (?, ?, ?, ?)'
  );

  const insertMany = db.transaction((records) => {
    for (const r of records) {
      stmt.run(class_id, r.student_id, r.date, r.status);
    }
  });

  insertMany(records);
  db.close();
  res.json({ message: `Attendance recorded for ${records.length} students` });
});

module.exports = router;
