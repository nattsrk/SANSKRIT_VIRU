// Mock data for GitHub Pages demo (no backend needed)

const USERS = {
  'guru@vidyasetu.com': { id: 1, name: 'Guru Sharma', email: 'guru@vidyasetu.com', role: 'teacher', college: 'Sanskrit Vidyapeeth', password: 'teacher123' },
  'priya@vidyasetu.com': { id: 2, name: 'Priya Patel', email: 'priya@vidyasetu.com', role: 'student', college: 'Sanskrit Vidyapeeth', password: 'student123' },
  'arjun@vidyasetu.com': { id: 3, name: 'Arjun Kumar', email: 'arjun@vidyasetu.com', role: 'student', college: 'Sanskrit Vidyapeeth', password: 'student123' },
};

const CLASSES = [
  { id: 1, title: 'Sanskrit Basics - Varnamala', description: 'Learn the Sanskrit alphabet and basic pronunciation', teacher_id: 1, teacher_name: 'Guru Sharma', subject: 'Sanskrit', schedule: 'Mon, Wed, Fri - 10:00 AM', student_count: 2 },
  { id: 2, title: 'Bhagavad Gita - Chapter 1', description: 'Study of the first chapter with shloka recitation', teacher_id: 1, teacher_name: 'Guru Sharma', subject: 'Sanskrit', schedule: 'Tue, Thu - 2:00 PM', student_count: 1 },
  { id: 3, title: 'Sanskrit Grammar - Vibhakti', description: 'Case endings and declension patterns', teacher_id: 1, teacher_name: 'Guru Sharma', subject: 'Sanskrit', schedule: 'Mon, Wed - 11:30 AM', student_count: 1 },
];

const ENROLLMENTS = { 2: [1, 2], 3: [1, 3] }; // student_id -> class_ids

const LESSONS = [
  { id: 1, class_id: 1, title: 'Introduction to Varnamala', content: 'The Sanskrit alphabet consists of 49 letters arranged scientifically.', shloka: null, shloka_meaning: null, order_num: 1 },
  { id: 2, class_id: 1, title: 'Swar (Vowels)', content: 'Sanskrit has 13 vowels called Swar.', shloka: null, shloka_meaning: null, order_num: 2 },
  { id: 3, class_id: 2, title: 'Arjuna Vishada Yoga', content: 'The first chapter describes Arjuna\'s dilemma on the battlefield.',
    shloka: 'धर्मक्षेत्रे कुरुक्षेत्रे समवेता युयुत्सवः।\nमामकाः पाण्डवाश्चैव किमकुर्वत सञ्जय।।',
    shloka_meaning: 'O Sanjaya, what did my sons and the sons of Pandu do when they assembled on the holy field of Kurukshetra, eager to fight?', order_num: 1 },
];

const ASSIGNMENTS = [
  { id: 1, class_id: 1, title: 'Write Varnamala', description: 'Write all 49 letters of Sanskrit alphabet', class_title: 'Sanskrit Basics - Varnamala', due_date: '2026-04-15', max_marks: 50 },
  { id: 2, class_id: 2, title: 'Shloka Recitation', description: 'Record yourself reciting the first 5 shlokas', class_title: 'Bhagavad Gita - Chapter 1', due_date: '2026-04-20', max_marks: 100 },
];

const STUDENTS = [
  { id: 2, name: 'Priya Patel', email: 'priya@vidyasetu.com' },
  { id: 3, name: 'Arjun Kumar', email: 'arjun@vidyasetu.com' },
];

// Track submissions in memory
let submissions = {};

// Track active video rooms in memory: class_id -> room object
let activeRooms = {};

function getSubmissionKey(assignmentId, studentId) {
  return `${assignmentId}-${studentId}`;
}

// Mock API that mimics axios response format
function mockResponse(data, status = 200) {
  return { data, status };
}

function createMockAPI() {
  const handlers = {
    'POST /auth/login': ({ email, password }) => {
      const user = USERS[email];
      if (!user || user.password !== password) {
        throw { response: { data: { error: 'Invalid credentials' } } };
      }
      const { password: _, ...userData } = user;
      return mockResponse({ token: 'demo-token', user: userData });
    },

    'POST /auth/register': ({ name, email, password, role, college }) => {
      if (USERS[email]) {
        throw { response: { data: { error: 'Email already registered' } } };
      }
      const newUser = { id: Date.now(), name, email, role, college };
      USERS[email] = { ...newUser, password };
      return mockResponse({ token: 'demo-token', user: newUser }, 201);
    },

    'GET /classes': (_, user) => {
      if (user.role === 'teacher') {
        return mockResponse(CLASSES.filter(c => c.teacher_id === user.id));
      }
      const classIds = ENROLLMENTS[user.id] || [];
      return mockResponse(CLASSES.filter(c => classIds.includes(c.id)));
    },

    'GET /classes/:id': (_, user, params) => {
      const cls = CLASSES.find(c => c.id === parseInt(params.id));
      if (!cls) throw { response: { data: { error: 'Class not found' }, status: 404 } };
      const lessons = LESSONS.filter(l => l.class_id === cls.id).sort((a, b) => a.order_num - b.order_num);
      const assignments = ASSIGNMENTS.filter(a => a.class_id === cls.id);
      const students = cls.id === 1 ? STUDENTS : cls.id === 2 ? [STUDENTS[0]] : [STUDENTS[1]];
      return mockResponse({ ...cls, lessons, assignments, students });
    },

    'GET /assignments': (_, user) => {
      if (user.role === 'teacher') {
        return mockResponse(ASSIGNMENTS.map(a => ({ ...a, submission_count: Object.keys(submissions).filter(k => k.startsWith(a.id + '-')).length })));
      }
      const classIds = ENROLLMENTS[user.id] || [];
      return mockResponse(ASSIGNMENTS.filter(a => classIds.includes(a.class_id)).map(a => {
        const key = getSubmissionKey(a.id, user.id);
        return { ...a, submitted_at: submissions[key] || null, marks: null };
      }));
    },

    'POST /assignments/:id/submit': (_, user, params) => {
      const key = getSubmissionKey(params.id, user.id);
      submissions[key] = new Date().toISOString();
      return mockResponse({ message: 'Submitted successfully' }, 201);
    },

    'POST /classes': (body, user) => {
      const newClass = { id: Date.now(), ...body, teacher_id: user.id, teacher_name: user.name, subject: body.subject || 'Sanskrit', student_count: 0 };
      CLASSES.push(newClass);
      return mockResponse(newClass, 201);
    },

    'GET /rooms/:classId/active': (_, user, params) => {
      const room = activeRooms[params.classId];
      if (room) {
        return mockResponse({ active: true, room });
      }
      return mockResponse({ active: false });
    },

    'POST /rooms/start': (body, user) => {
      const room = {
        id: Date.now(),
        class_id: body.classId,
        host_id: user.id,
        room_code: Math.random().toString(36).substring(2, 8),
        started_at: new Date().toISOString(),
        ended_at: null,
      };
      activeRooms[body.classId] = room;
      return mockResponse({ roomId: room.id, roomCode: room.room_code }, 201);
    },

    'POST /rooms/:id/end': (_, user, params) => {
      for (const classId in activeRooms) {
        if (String(activeRooms[classId].id) === String(params.id)) {
          delete activeRooms[classId];
        }
      }
      return mockResponse({ success: true });
    },
  };

  function matchRoute(method, url) {
    for (const [pattern, handler] of Object.entries(handlers)) {
      const [pMethod, pPath] = pattern.split(' ');
      if (pMethod !== method) continue;

      const pParts = pPath.split('/');
      const uParts = url.split('/');
      if (pParts.length !== uParts.length) continue;

      const params = {};
      let match = true;
      for (let i = 0; i < pParts.length; i++) {
        if (pParts[i].startsWith(':')) {
          params[pParts[i].slice(1)] = uParts[i];
        } else if (pParts[i] !== uParts[i]) {
          match = false;
          break;
        }
      }
      if (match) return { handler, params };
    }
    return null;
  }

  function getUser() {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  }

  return {
    get(url) {
      const route = matchRoute('GET', url);
      if (!route) return Promise.reject({ response: { data: { error: 'Not found' } } });
      return Promise.resolve(route.handler(null, getUser(), route.params));
    },
    post(url, body) {
      const route = matchRoute('POST', url);
      if (!route) return Promise.reject({ response: { data: { error: 'Not found' } } });
      return Promise.resolve(route.handler(body, getUser(), route.params));
    },
    interceptors: {
      request: { use() {} },
    },
  };
}

export default createMockAPI;