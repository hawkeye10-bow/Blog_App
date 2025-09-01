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
  const [collaboratingUsers, setCollaboratingUsers] = useState(new Map());

  useEffect(() => {
    const socket = socketService.connect();

    // General typing (blog creation/editing)
    const handleUserTyping = (data) => {
      console.log('⌨️ Real-time: User typing:', data);
      
      // Show global typing or blog-specific typing
      if ((!data.blogId && showGlobal) || (data.blogId === blogId)) {
        setTypingUsers(prev => {
          const newMap = new Map(prev);
          newMap.set(data.userId, {
            userName: data.userName,
            action: data.action,
            blogId: data.blogId,
            timestamp: Date.now()
          });
          return newMap;
        });

        // Auto-remove after 4 seconds (slightly longer than server timeout)
        setTimeout(() => {
          setTypingUsers(prev => {
            const newMap = new Map(prev);
            newMap.delete(data.userId);
            return newMap;
          });
        }, 4000);
      }
    };

    const handleUserStoppedTyping = (data) => {
      console.log('⌨️ Real-time: User stopped typing:', data);
      setTypingUsers(prev => {
        const newMap = new Map(prev);
        newMap.delete(data.userId);
        return newMap;
      });
    };

    // Comment typing (specific to blog)
    const handleUserCommenting = (data) => {
      if (data.blogId === blogId) {
        console.log('💬 Real-time: User commenting:', data);
        setCommentingUsers(prev => {
          const newMap = new Map(prev);
          newMap.set(data.userId, {
            userName: data.userName,
            blogId: data.blogId,
            timestamp: Date.now()
          });
          return newMap;
        });

        // Auto-remove after 4 seconds
        setTimeout(() => {
          setCommentingUsers(prev => {
            const newMap = new Map(prev);
            newMap.delete(data.userId);
            return newMap;
          });
        }, 4000);
      }
    };

    const handleUserStoppedCommenting = (data) => {
      if (data.blogId === blogId) {
        console.log('💬 Real-time: User stopped commenting:', data);
        setCommentingUsers(prev => {
          const newMap = new Map(prev);
          newMap.delete(data.userId);
          return newMap;
        });
      }
    };

    // Collaboration typing
    const handleCollaboratorTyping = (data) => {
      if (data.blogId === blogId) {
        console.log('🤝 Real-time: Collaborator typing:', data);
        setCollaboratingUsers(prev => {
          const newMap = new Map(prev);
          newMap.set(data.userId, {
            userName: data.userName,
            action: 'collaborating',
            blogId: data.blogId,
            timestamp: Date.now()
          });
          return newMap;
        });

        // Auto-remove after 4 seconds
        setTimeout(() => {
          setCollaboratingUsers(prev => {
            const newMap = new Map(prev);
            newMap.delete(data.userId);
            return newMap;
          });
        }, 4000);
      }
    };

    const handleCollaboratorStoppedTyping = (data) => {
      if (data.blogId === blogId) {
        console.log('🤝 Real-time: Collaborator stopped typing:', data);
        setCollaboratingUsers(prev => {
          const newMap = new Map(prev);
          newMap.delete(data.userId);
          return newMap;
        });
      }
    };

    // Register event listeners
    socketService.addEventListener('user-typing', handleUserTyping);
    socketService.addEventListener('user-stopped-typing', handleUserStoppedTyping);
    socketService.addEventListener('user-commenting', handleUserCommenting);
    socketService.addEventListener('user-stopped-commenting', handleUserStoppedCommenting);
    socketService.addEventListener('collaboration-update', handleCollaboratorTyping);
    socketService.addEventListener('collaborator-joined', handleCollaboratorTyping);
    socketService.addEventListener('collaborator-left', handleCollaboratorStoppedTyping);

    return () => {
      socketService.removeEventListener('user-typing', handleUserTyping);
      socketService.removeEventListener('user-stopped-typing', handleUserStoppedTyping);
      socketService.removeEventListener('user-commenting', handleUserCommenting);
      socketService.removeEventListener('user-stopped-commenting', handleUserStoppedCommenting);
      socketService.removeEventListener('collaboration-update', handleCollaboratorTyping);
      socketService.removeEventListener('collaborator-joined', handleCollaboratorTyping);
      socketService.removeEventListener('collaborator-left', handleCollaboratorStoppedTyping);
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
      case 'collaborating': return 'collaborating on a blog';
      default: return 'typing';
    }
  };

  const getActionColor = (action) => {
    switch (action) {
      case 'creating': return '#4caf50';
      case 'editing': return '#ff9800';
      case 'commenting': return '#2196f3';
      case 'collaborating': return '#9c27b0';
      default: return '#667eea';
    }
  };

  const allTypingUsers = [
    ...Array.from(typingUsers.values()).map(user => ({ ...user, type: 'general', priority: 1 })),
    ...Array.from(commentingUsers.values()).map(user => ({ ...user, type: 'comment', action: 'commenting', priority: 2 })),
    ...Array.from(collaboratingUsers.values()).map(user => ({ ...user, type: 'collaboration', priority: 3 }))
  ];

  // Sort by priority and timestamp
  allTypingUsers.sort((a, b) => {
    if (a.priority !== b.priority) {
      return b.priority - a.priority; // Higher priority first
    }
    return b.timestamp - a.timestamp; // More recent first
  });

  if (allTypingUsers.length === 0) {
    return null;
  }

  return (
    <Slide direction="up" in={true}>
      <TypingContainer>
        <Typography variant="subtitle2" fontWeight={600} mb={2} color="primary">
          ⚡ Live Activity
        </Typography>
        
        {allTypingUsers.map((typingUser, index) => (
          <Fade in={true} key={`${typingUser.userName}-${typingUser.timestamp}`}>
            <TypingIndicator sx={{
              borderLeft: `3px solid ${getActionColor(typingUser.action)}`,
            }}>
              <Avatar
                sx={{ 
                  width: 28, 
                  height: 28,
                  background: `linear-gradient(135deg, ${getActionColor(typingUser.action)}, #764ba2)`,
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
                  {typingUser.blogId && typingUser.blogId !== blogId && (
                    <span> in another blog</span>
                  )}
                </Typography>
              </Box>
              
              <Box display="flex" alignItems="center" gap={1}>
                <Box sx={{ color: getActionColor(typingUser.action) }}>
                  {getActionIcon(typingUser.action)}
                </Box>
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