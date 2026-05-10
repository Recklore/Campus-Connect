import { useEffect, useCallback } from 'react';
import { getSocket, subscribeToDiscussion, unsubscribeFromDiscussion } from '../lib/socket';

export const useDiscussionSocket = (discussionId, callbacks = {}) => {
  const {
    onReplyAdded = () => {},
    onThoughtAdded = () => {},
    onDiscussionUpdated = () => {},
    onDiscussionDeleted = () => {},
    onReplyDeleted = () => {},
    onThoughtDeleted = () => {},
    onReplyUpdated = () => {},
    onThoughtUpdated = () => {},
  } = callbacks;

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !socket.connected) {
      return;
    }

    // Subscribe to discussion
    subscribeToDiscussion(discussionId);

    // Listen for real-time events
    const handleReplyAdded = (data) => {
      onReplyAdded(data);
    };
    const handleThoughtAdded = (data) => {
      onThoughtAdded(data);
    };

    const handleDiscussionUpdated = (data) => {
      onDiscussionUpdated(data);
    };

    const handleDiscussionDeleted = (data) => {
      onDiscussionDeleted(data);
    };

    const handleReplyDeleted = (data) => {
      onReplyDeleted(data);
    };
    const handleThoughtDeleted = (data) => {
      onThoughtDeleted(data);
    };

    const handleReplyUpdated = (data) => {
      onReplyUpdated(data);
    };
    const handleThoughtUpdated = (data) => {
      onThoughtUpdated(data);
    };

    socket.on('reply:added', handleReplyAdded);
    socket.on('thought:added', handleThoughtAdded);
    socket.on('discussion:updated', handleDiscussionUpdated);
    socket.on('discussion:deleted', handleDiscussionDeleted);
    socket.on('reply:deleted', handleReplyDeleted);
    socket.on('thought:deleted', handleThoughtDeleted);
    socket.on('reply:updated', handleReplyUpdated);
    socket.on('thought:updated', handleThoughtUpdated);

    // Cleanup
    return () => {
      socket.off('reply:added', handleReplyAdded);
      socket.off('thought:added', handleThoughtAdded);
      socket.off('discussion:updated', handleDiscussionUpdated);
      socket.off('discussion:deleted', handleDiscussionDeleted);
      socket.off('reply:deleted', handleReplyDeleted);
      socket.off('thought:deleted', handleThoughtDeleted);
      socket.off('reply:updated', handleReplyUpdated);
      socket.off('thought:updated', handleThoughtUpdated);
      unsubscribeFromDiscussion(discussionId);
    };
  }, [discussionId, onReplyAdded, onThoughtAdded, onDiscussionUpdated, onDiscussionDeleted, onReplyDeleted, onThoughtDeleted, onReplyUpdated, onThoughtUpdated]);
};

export default useDiscussionSocket;
