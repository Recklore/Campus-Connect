const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const { redis } = require('./redis');

let io;

const initSocketIO = (server) => {
  io = new socketIo.Server(server, {
    cors: {
      origin: process.env.FRONTEND_BASE_URL,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });
  
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.cookie?.split('campus_connect_token=')[1]?.split(';')[0];
      
      if (!token) {
        return next(new Error('Authentication token missing'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
      socket.userId = decoded._id;
      socket.userRole = decoded.role;
      next();
    } catch (error) {
      console.error('Socket auth error:', error.message);
      next(new Error('Authentication failed'));
    }
  });


  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.userId}`);

    socket.join(`user:${socket.userId}`);


    socket.on('subscribe:discussion', (discussionId) => {
      socket.join(`discussion:${discussionId}`);
      socket.emit('subscribed:discussion', { discussionId });
    });

    socket.on('unsubscribe:discussion', (discussionId) => {
      socket.leave(`discussion:${discussionId}`);
      socket.emit('unsubscribed:discussion', { discussionId });
    });


    socket.on('subscribe:department', (departmentId) => {
      socket.join(`dept:${departmentId}`);
      socket.emit('subscribed:department', { departmentId });
    });

    socket.on('unsubscribe:department', (departmentId) => {
      socket.leave(`dept:${departmentId}`);
      socket.emit('unsubscribed:department', { departmentId });
    });

   
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.userId}`);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO not initialized. Call initSocketIO first.');
  }
  return io;
};

module.exports = {
  initSocketIO,
  getIO,
};
