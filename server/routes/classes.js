const express = require('express');
const { getDb } = require('../db/schema');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/classes — list classes for current user
router.get('/', authenticate, (req, res) => {
  const db = getDb();

  let classes;
  if (req.user.role === 'teacher') {
    classes = db.prepare(`
      SELECT c.*, COUNT(e.id) as student_count
      FROM classes c
      LEFT JOIN enrollments e ON e.class_id = c.id
      WHERE c.teacher_id = ?
      GROUP BY c.id
    `).all(req.user.id);
  } else {
    classes = db.prepare(`
      SELECT c.*, u.name as teacher_name
      FROM classes c
      JOIN enrollments e ON e.class_id = c.id
      JOIN users u ON u.id = c.teacher_id
      WHERE e.student_id = ?
    `).all(req.user.id);
  }

  db.close();
  res.json(classes);
});

// GET /api/classes/:id — class detail with lessons
router.get('/:id', authenticate, (req, res) => {
  const db = getDb();

  const cls = db.prepare('SELECT c.*, u.name as teacher_name FROM classes c JOIN users u ON u.id = c.teacher_id WHERE c.id = ?').get(req.params.id);
  if (!cls) {
    db.close();
    return res.status(404).json({ error: 'Class not found' });
  }

  const lessons = db.prepare('SELECT * FROM lessons WHERE class_id = ? ORDER BY order_num').all(req.params.id);
  const assignments = db.prepare('SELECT * FROM assignments WHERE class_id = ? ORDER BY due_date').all(req.params.id);
  const students = db.prepare(`
    SELECT u.id, u.name, u.email FROM users u
    JOIN enrollments e ON e.student_id = u.id
    WHERE e.class_id = ?
  `).all(req.params.id);

  db.close();
  res.json({ ...cls, lessons, assignments, students });
});

// POST /api/classes — create class (teacher only)
router.post('/', authenticate, requireRole('teacher'), (req, res) => {
  const { title, description, subject, schedule } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });

  const db = getDb();
  const result = db.prepare(
    'INSERT INTO classes (title, description, teacher_id, subject, schedule) VALUES (?, ?, ?, ?, ?)'
  ).run(title, description || null, req.user.id, subject || 'Sanskrit', schedule || null);

  const cls = db.prepare('SELECT * FROM classes WHERE id = ?').get(result.lastInsertRowid);
  db.close();
  res.status(201).json(cls);
});

// POST /api/classes/:id/enroll — enroll student
router.post('/:id/enroll', authenticate, requireRole('student'), (req, res) => {
  const db = getDb();
  try {
    db.prepare('INSERT INTO enrollments (student_id, class_id) VALUES (?, ?)').run(req.user.id, req.params.id);
    db.close();
    res.json({ message: 'Enrolled successfully' });
  } catch (err) {
    db.close();
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Already enrolled' });
    }
    throw err;
  }
});

module.exports = router;
