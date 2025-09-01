import React, { useState, useEffect } from 'react';
import { Box, Chip, Typography, Fade, Zoom } from '@mui/material';
import { styled } from '@mui/material/styles';
import { 
  Circle as CircleIcon,
  Edit as EditIcon,
  Add as AddIcon
} from '@mui/icons-material';
import socketService from '../services/socketService';

const IndicatorContainer = styled(Box)(({ theme }) => ({
  position: 'fixed',
  top: '100px',
  right: theme.spacing(3),
  zIndex: 1000,
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1),
  maxWidth: '300px',
}));

const ConnectionStatus = styled(Chip)(({ theme, connected }) => ({
  backgroundColor: connected ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)',
  color: connected ? '#4caf50' : '#f44336',
  border: `1px solid ${connected ? '#4caf50' : '#f44336'}`,
  fontWeight: 600,
  '& .MuiChip-icon': {
    color: connected ? '#4caf50' : '#f44336',
  },
}));

const TypingIndicator = styled(Chip)(({ theme }) => ({
  backgroundColor: 'rgba(102, 126, 234, 0.1)',
  color: '#667eea',
  border: '1px solid #667eea',
  fontWeight: 500,
  animation: 'pulse 2s ease-in-out infinite',
  '& .MuiChip-icon': {
    color: '#667eea',
  },
  '@keyframes pulse': {
    '0%': {
      opacity: 1,
    },
    '50%': {
      opacity: 0.7,
    },
    '100%': {
      opacity: 1,
    },
  },
}));

const RealTimeIndicator = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState(new Map());

  useEffect(() => {
    const socket = socketService.connect();

    // Connection status
    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    // Typing indicators
    const handleUserTyping = (data) => {
      setTypingUsers(prev => {
        const newMap = new Map(prev);
        newMap.set(data.userId, {
          userName: data.userName,
          action: data.action,
          timestamp: Date.now()
        });
        return newMap;
      });

      // Auto-remove after 3 seconds
      setTimeout(() => {
        setTypingUsers(prev => {
          const newMap = new Map(prev);
          newMap.delete(data.userId);
          return newMap;
        });
      }, 3000);
    };

    const handleUserStoppedTyping = (data) => {
      setTypingUsers(prev => {
        const newMap = new Map(prev);
        newMap.delete(data.userId);
        return newMap;
      });
    };

    // Set initial connection status
    setIsConnected(socketService.getConnectionStatus());

    // Register event listeners
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socketService.onUserTyping(handleUserTyping);
    socketService.onUserStoppedTyping(handleUserStoppedTyping);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, []);

  const typingUsersArray = Array.from(typingUsers.values());

  return (
    <IndicatorContainer>
      {/* Connection Status */}
      <Fade in={true}>
        <ConnectionStatus
          connected={isConnected}
          icon={<CircleIcon />}
          label={isConnected ? 'Connected' : 'Disconnected'}
          size="small"
        />
      </Fade>

      {/* Typing Indicators */}
      {typingUsersArray.map((typingUser, index) => (
        <Zoom in={true} key={`${typingUser.userName}-${typingUser.timestamp}`}>
          <TypingIndicator
            icon={typingUser.action === 'creating' ? <AddIcon /> : <EditIcon />}
            label={`${typingUser.userName} is ${typingUser.action}...`}
            size="small"
          />
        </Zoom>
      ))}
    </IndicatorContainer>
  );
};

export default RealTimeIndicator;