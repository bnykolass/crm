const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const { createServer } = require('http');
const { Server } = require('socket.io');

// Load environment variables
dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Socket.io connection handling
const activeUsers = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('user-login', (userId) => {
    activeUsers.set(userId, socket.id);
    io.emit('active-users', Array.from(activeUsers.keys()));
  });

  socket.on('disconnect', () => {
    const userId = [...activeUsers.entries()]
      .find(([_, socketId]) => socketId === socket.id)?.[0];
    if (userId) {
      activeUsers.delete(userId);
      io.emit('active-users', Array.from(activeUsers.keys()));
    }
    console.log('User disconnected:', socket.id);
  });

  socket.on('send-message', (data) => {
    // Broadcast to specific user if receiver_id is provided, otherwise broadcast to all
    if (data.receiver_id) {
      const receiverSocketId = activeUsers.get(data.receiver_id.toString());
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('new-message', data);
      }
      // Send to sender as well (for confirmation and consistency)
      socket.emit('new-message', data);
    } else {
      io.emit('new-message', data);
    }
  });

  socket.on('typing', (data) => {
    if (data.receiver_id) {
      const receiverSocketId = activeUsers.get(data.receiver_id.toString());
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('user-typing', {
          sender_id: data.sender_id,
          sender_name: data.sender_name
        });
      }
    }
  });

  socket.on('stop-typing', (data) => {
    if (data.receiver_id) {
      const receiverSocketId = activeUsers.get(data.receiver_id.toString());
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('user-stop-typing', {
          sender_id: data.sender_id
        });
      }
    }
  });

  // Notification events
  socket.on('join-notifications', (userId) => {
    socket.join(`user-${userId}`);
    console.log(`User ${userId} joined notifications room`);
  });

  socket.on('leave-notifications', (userId) => {
    socket.leave(`user-${userId}`);
    console.log(`User ${userId} left notifications room`);
  });
});

// Initialize database
require('./database/init');

// Set Socket.io instance for notifications
const { setSocketIO } = require('./routes/notifications');
setSocketIO(io);

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/companies', require('./routes/companies'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/timesheets', require('./routes/timesheets'));
app.use('/api/quotes', require('./routes/quotes'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/files', require('./routes/files'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/teams', require('./routes/teams'));
app.use('/api/calendar', require('./routes/calendar'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const PORT = process.env.PORT || 5555;

httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = { app, io };