const bcrypt = require('bcrypt');
const { getDb, initializeDb } = require('./schema');

async function seed() {
  initializeDb();
  const db = getDb();

  const teacherPass = await bcrypt.hash('teacher123', 10);
  const studentPass = await bcrypt.hash('student123', 10);

  // Create users
  const insertUser = db.prepare(
    'INSERT OR IGNORE INTO users (name, email, password, role, college) VALUES (?, ?, ?, ?, ?)'
  );

  insertUser.run('Guru Sharma', 'guru@vidyasetu.com', teacherPass, 'teacher', 'Sanskrit Vidyapeeth');
  insertUser.run('Priya Patel', 'priya@vidyasetu.com', studentPass, 'student', 'Sanskrit Vidyapeeth');
  insertUser.run('Arjun Kumar', 'arjun@vidyasetu.com', studentPass, 'student', 'Sanskrit Vidyapeeth');

  // Create classes
  const insertClass = db.prepare(
    'INSERT OR IGNORE INTO classes (id, title, description, teacher_id, subject, schedule) VALUES (?, ?, ?, ?, ?, ?)'
  );

  insertClass.run(1, 'Sanskrit Basics - Varnamala', 'Learn the Sanskrit alphabet and basic pronunciation', 1, 'Sanskrit', 'Mon, Wed, Fri - 10:00 AM');
  insertClass.run(2, 'Bhagavad Gita - Chapter 1', 'Study of the first chapter with shloka recitation', 1, 'Sanskrit', 'Tue, Thu - 2:00 PM');
  insertClass.run(3, 'Sanskrit Grammar - Vibhakti', 'Case endings and declension patterns', 1, 'Sanskrit', 'Mon, Wed - 11:30 AM');

  // Enroll students
  const insertEnrollment = db.prepare(
    'INSERT OR IGNORE INTO enrollments (student_id, class_id) VALUES (?, ?)'
  );

  insertEnrollment.run(2, 1);
  insertEnrollment.run(2, 2);
  insertEnrollment.run(3, 1);
  insertEnrollment.run(3, 3);

  // Create lessons
  const insertLesson = db.prepare(
    'INSERT OR IGNORE INTO lessons (id, class_id, title, content, shloka, shloka_meaning, order_num) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );

  insertLesson.run(1, 1, 'Introduction to Varnamala', 'The Sanskrit alphabet consists of 49 letters arranged scientifically.', null, null, 1);
  insertLesson.run(2, 1, 'Swar (Vowels)', 'Sanskrit has 13 vowels called Swar.', null, null, 2);
  insertLesson.run(3, 2, 'Arjuna Vishada Yoga', 'The first chapter describes Arjuna\'s dilemma on the battlefield.',
    'धर्मक्षेत्रे कुरुक्षेत्रे समवेता युयुत्सवः।\nमामकाः पाण्डवाश्चैव किमकुर्वत सञ्जय।।',
    'O Sanjaya, what did my sons and the sons of Pandu do when they assembled on the holy field of Kurukshetra, eager to fight?', 1);

  // Create assignments
  const insertAssignment = db.prepare(
    'INSERT OR IGNORE INTO assignments (id, class_id, title, description, due_date, max_marks) VALUES (?, ?, ?, ?, ?, ?)'
  );

  insertAssignment.run(1, 1, 'Write Varnamala', 'Write all 49 letters of Sanskrit alphabet', '2026-04-15', 50);
  insertAssignment.run(2, 2, 'Shloka Recitation', 'Record yourself reciting the first 5 shlokas', '2026-04-20', 100);

  db.close();
  console.log('Database seeded successfully!');
}

seed().catch(console.error);
