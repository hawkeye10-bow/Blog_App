import { useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import socketService from '../services/socketService';

export const useTypingIndicator = (action = 'creating') => {
  const user = useSelector(state => state.user);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);

  const startTyping = useCallback(() => {
    if (!user || !socketService.getConnectionStatus()) return;

    // Only emit if not already typing
    if (!isTypingRef.current) {
      socketService.emitUserTyping(user._id, user.name, action);
      isTypingRef.current = true;
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to stop typing after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 2000);
  }, [user, action]);

  const stopTyping = useCallback(() => {
    if (!user || !socketService.getConnectionStatus()) return;

    if (isTypingRef.current) {
      socketService.emitUserStoppedTyping(user._id);
      isTypingRef.current = false;
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, [user]);

  // Handle input change with typing indicator
  const handleInputChange = useCallback((callback) => {
    return (e) => {
      startTyping();
      if (callback) {
        callback(e);
      }
    };
  }, [startTyping]);

  // Cleanup on unmount
  const cleanup = useCallback(() => {
    stopTyping();
  }, [stopTyping]);

  return {
    startTyping,
    stopTyping,
    handleInputChange,
    cleanup
  };
};