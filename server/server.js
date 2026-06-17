require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initializeDb } = require('./db/schema');
const http = require('http');
const { Server } = require('socket.io');

// Initialize database tables
initializeDb();

const db = getDb();
const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get();
if (userCount.c === 0) {
  console.log('Database empty, seeding...');
  require('./db/seed.js');
}
db.close();

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/classes', require('./routes/classes'));
app.use('/api/assignments', require('./routes/assignments'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/rooms', require('./routes/rooms'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', name: 'VidyaSetu API' });
});

const { getDb } = require('./db/schema');
app.get('/api/health/details', (req, res) => {
  try {
    const db = getDb();

    const row = db
      .prepare('SELECT COUNT(*) AS userCount FROM users')
      .get();

    res.json({
      currentTime: new Date().toISOString(),
      totalUsers: row.userCount
    });

    db.close();

  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

app.get('/test-room', (req, res) => {
  const db = getDb();

  const result = db.prepare(`
    INSERT INTO video_rooms
    (class_id, host_id, room_code)
    VALUES (?, ?, ?)
  `).run(3, 3, 'rskjh123');

  res.json({
    roomId: result.lastInsertRowid
  });

  db.close();
});

app.get('/test-end-room', (req, res) => {
  const db = getDb();

  db.prepare(`
    UPDATE video_rooms
    SET ended_at = CURRENT_TIMESTAMP
    WHERE id = 1
  `).run();

  res.json({ success: true });

  db.close();
});

// Serve React build in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  });
}

const httpServer = http.createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', ({ roomId, userName, role }) => {
    // Bind context attributes directly to socket instances for sudden disconnections
    socket.userName = userName;
    socket.roomId = roomId;
    socket.role = role || 'student'; 

    socket.join(roomId);

    const room = io.sockets.adapter.rooms.get(roomId);
    const clients = room ? Array.from(room) : [];

    const users = clients.map(id => {
      const s = io.sockets.sockets.get(id);
      return {
        id,
        name: s?.userName || 'Unknown'
      };
    });

    socket.emit('existing-users', users.filter(u => u.id !== socket.id));

    socket.to(roomId).emit('user-joined', {
      id: socket.id,
      name: userName
    });
  });

  socket.on('offer', ({ to, offer }) => {
    io.to(to).emit('offer', { from: socket.id, offer });
  });

  socket.on('answer', ({ to, answer }) => {
    io.to(to).emit('answer', { from: socket.id, answer });
  });

  socket.on('ice-candidate', ({ to, candidate }) => {
    io.to(to).emit('ice-candidate', { from: socket.id, candidate });
  });
  
  socket.on('leave-room', ({ roomId, role }) => {
    socket.leave(roomId);

    if (role === 'teacher') {
      socket.to(roomId).emit('teacher-ended');
    } else {
      socket.to(roomId).emit('student-left', socket.id);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // Safely cleanup session boundaries if the user drop-out was unannounced
    if (socket.roomId) {
      if (socket.role === 'teacher') {
        socket.to(socket.roomId).emit('teacher-ended');
      } else {
        socket.to(socket.roomId).emit('student-left', socket.id);
      }
    }
  });
}); 

httpServer.listen(PORT, () => {
  console.log(`VidyaSetu server running on http://localhost:${PORT}`);
});