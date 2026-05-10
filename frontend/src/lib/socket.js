import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

let socket = null;
let isConnecting = false;

export const initializeSocket = () => {
  if (socket) {
    return socket;
  }

  if (isConnecting) {
    return null;
  }

  isConnecting = true;

  socket = io(SOCKET_URL, {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
    transports: ['websocket', 'polling'],
  });

  socket.on('connect', () => {
    console.log('Socket connected:', socket.id);
    isConnecting = false;
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected');
  });

  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });

  return socket;
};

export const getSocket = () => {
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const subscribeToDiscussion = (discussionId) => {
  if (!socket) return;
  socket.emit('subscribe:discussion', discussionId);
};

export const unsubscribeFromDiscussion = (discussionId) => {
  if (!socket) return;
  socket.emit('unsubscribe:discussion', discussionId);
};

export const subscribeToDepartment = (departmentId) => {
  if (!socket) return;
  socket.emit('subscribe:department', departmentId);
};

export const unsubscribeFromDepartment = (departmentId) => {
  if (!socket) return;
  socket.emit('unsubscribe:department', departmentId);
};

export default {
  initializeSocket,
  getSocket,
  disconnectSocket,
  subscribeToDiscussion,
  unsubscribeFromDiscussion,
  subscribeToDepartment,
  unsubscribeFromDepartment,
};
