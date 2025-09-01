import React, { useState, useEffect } from 'react';
import {
  Box,
  Chip,
  Avatar,
  Typography,
  Fade,
  Slide,
  Paper
} from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  Edit as EditIcon,
  Add as AddIcon,
  Comment as CommentIcon,
  Create as CreateIcon
} from '@mui/icons-material';
import socketService from '../../services/socketService';

const TypingContainer = styled(Paper)(({ theme }) => ({
  position: 'fixed',
  bottom: theme.spacing(3),
  left: theme.spacing(3),
  zIndex: 1000,
  background: 'rgba(255, 255, 255, 0.95)',
  backdropFilter: 'blur(20px)',
  borderRadius: theme.spacing(2),
  padding: theme.spacing(2),
  border: '1px solid rgba(255, 255, 255, 0.3)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
  maxWidth: '300px',
}));

const TypingIndicator = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
  padding: theme.spacing(1.5),
  backgroundColor: 'rgba(102, 126, 234, 0.1)',
  borderRadius: theme.spacing(2),
  marginBottom: theme.spacing(1),
  border: '1px solid rgba(102, 126, 234, 0.2)',
  animation: 'pulse 2s ease-in-out infinite',
  '&:last-child': {
    marginBottom: 0,
  },
}));

const TypingDots = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(0.5),
  '& .dot': {
    width: 6,
    height: 6,
    borderRadius: '50%',
    backgroundColor: '#667eea',
    animation: 'typingDots 1.4s ease-in-out infinite',
    '&:nth-of-type(1)': { animationDelay: '0s' },
    '&:nth-of-type(2)': { animationDelay: '0.2s' },
    '&:nth-of-type(3)': { animationDelay: '0.4s' },
  },
  '@keyframes typingDots': {
    '0%, 60%, 100%': { transform: 'translateY(0)' },
    '30%': { transform: 'translateY(-10px)' },
  },
}));

const LiveTypingIndicators = ({ blogId = null, showGlobal = true }) => {
  const [typingUsers, setTypingUsers] = useState(new Map());
  const [commentingUsers, setCommentingUsers] = useState(new Map());

  useEffect(() => {
    const socket = socketService.connect();

    // General typing (blog creation/editing)
    const handleUserTyping = (data) => {
      if (!blogId || showGlobal) {
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
      }
    };

    const handleUserStoppedTyping = (data) => {
      setTypingUsers(prev => {
        const newMap = new Map(prev);
        newMap.delete(data.userId);
        return newMap;
      });
    };

    // Comment typing (specific to blog)
    const handleUserCommenting = (data) => {
      if (data.blogId === blogId) {
        setCommentingUsers(prev => {
          const newMap = new Map(prev);
          newMap.set(data.userId, {
            userName: data.userName,
            timestamp: Date.now()
          });
          return newMap;
        });

        // Auto-remove after 3 seconds
        setTimeout(() => {
          setCommentingUsers(prev => {
            const newMap = new Map(prev);
            newMap.delete(data.userId);
            return newMap;
          });
        }, 3000);
      }
    };

    const handleUserStoppedCommenting = (data) => {
      if (data.blogId === blogId) {
        setCommentingUsers(prev => {
          const newMap = new Map(prev);
          newMap.delete(data.userId);
          return newMap;
        });
      }
    };

    // Register event listeners
    socket.on('user-typing', handleUserTyping);
    socket.on('user-stopped-typing', handleUserStoppedTyping);
    socket.on('user-commenting', handleUserCommenting);
    socket.on('user-stopped-commenting', handleUserStoppedCommenting);

    return () => {
      socket.off('user-typing', handleUserTyping);
      socket.off('user-stopped-typing', handleUserStoppedTyping);
      socket.off('user-commenting', handleUserCommenting);
      socket.off('user-stopped-commenting', handleUserStoppedCommenting);
    };
  }, [blogId, showGlobal]);

  const getActionIcon = (action) => {
    switch (action) {
      case 'creating': return <AddIcon fontSize="small" />;
      case 'editing': return <EditIcon fontSize="small" />;
      case 'commenting': return <CommentIcon fontSize="small" />;
      default: return <CreateIcon fontSize="small" />;
    }
  };

  const getActionText = (action) => {
    switch (action) {
      case 'creating': return 'creating a blog';
      case 'editing': return 'editing a blog';
      case 'commenting': return 'writing a comment';
      default: return 'typing';
    }
  };

  const allTypingUsers = [
    ...Array.from(typingUsers.values()).map(user => ({ ...user, type: 'general' })),
    ...Array.from(commentingUsers.values()).map(user => ({ ...user, type: 'comment', action: 'commenting' }))
  ];

  if (allTypingUsers.length === 0) {
    return null;
  }

  return (
    <Slide direction="up" in={true}>
      <TypingContainer>
        <Typography variant="subtitle2" fontWeight={600} mb={2} color="primary">
          Live Activity
        </Typography>
        
        {allTypingUsers.map((typingUser, index) => (
          <Fade in={true} key={`${typingUser.userName}-${typingUser.timestamp}`}>
            <TypingIndicator>
              <Avatar
                sx={{ 
                  width: 28, 
                  height: 28,
                  background: 'linear-gradient(135deg, #667eea, #764ba2)',
                  fontSize: '0.8rem',
                  fontWeight: 600
                }}
              >
                {typingUser.userName.charAt(0)}
              </Avatar>
              
              <Box flex={1}>
                <Typography variant="body2" fontWeight={600}>
                  {typingUser.userName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {getActionText(typingUser.action)}
                </Typography>
              </Box>
              
              <Box display="flex" alignItems="center" gap={1}>
                {getActionIcon(typingUser.action)}
                <TypingDots>
                  <div className="dot" />
                  <div className="dot" />
                  <div className="dot" />
                </TypingDots>
              </Box>
            </TypingIndicator>
          </Fade>
        ))}
      </TypingContainer>
    </Slide>
  );
};

export default LiveTypingIndicators;