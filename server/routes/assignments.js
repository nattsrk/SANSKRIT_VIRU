const express = require('express');
const { getDb } = require('../db/schema');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/assignments — list assignments for current user
router.get('/', authenticate, (req, res) => {
  const db = getDb();

  let assignments;
  if (req.user.role === 'teacher') {
    assignments = db.prepare(`
      SELECT a.*, c.title as class_title,
        (SELECT COUNT(*) FROM submissions s WHERE s.assignment_id = a.id) as submission_count
      FROM assignments a
      JOIN classes c ON c.id = a.class_id
      WHERE c.teacher_id = ?
      ORDER BY a.due_date
    `).all(req.user.id);
  } else {
    assignments = db.prepare(`
      SELECT a.*, c.title as class_title, s.submitted_at, s.marks
      FROM assignments a
      JOIN classes c ON c.id = a.class_id
      JOIN enrollments e ON e.class_id = c.id
      LEFT JOIN submissions s ON s.assignment_id = a.id AND s.student_id = ?
      WHERE e.student_id = ?
      ORDER BY a.due_date
    `).all(req.user.id, req.user.id);
  }

  db.close();
  res.json(assignments);
});

// POST /api/assignments — create assignment (teacher only)
router.post('/', authenticate, requireRole('teacher'), (req, res) => {
  const { class_id, title, description, due_date, max_marks } = req.body;
  if (!class_id || !title) return res.status(400).json({ error: 'class_id and title are required' });

  const db = getDb();
  const result = db.prepare(
    'INSERT INTO assignments (class_id, title, description, due_date, max_marks) VALUES (?, ?, ?, ?, ?)'
  ).run(class_id, title, description || null, due_date || null, max_marks || 100);

  const assignment = db.prepare('SELECT * FROM assignments WHERE id = ?').get(result.lastInsertRowid);
  db.close();
  res.status(201).json(assignment);
});

// POST /api/assignments/:id/submit — submit assignment (student only)
router.post('/:id/submit', authenticate, requireRole('student'), (req, res) => {
  const { content } = req.body;
  const db = getDb();

  try {
    db.prepare(
      'INSERT INTO submissions (assignment_id, student_id, content) VALUES (?, ?, ?)'
    ).run(req.params.id, req.user.id, content);

    db.close();
    res.status(201).json({ message: 'Submitted successfully' });
  } catch (err) {
    db.close();
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Already submitted' });
    }
    throw err;
  }
});

module.exports = router;
