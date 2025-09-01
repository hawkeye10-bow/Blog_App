import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Avatar,
  Chip,
  IconButton,
  Collapse,
  Divider,
  Alert,
  CircularProgress,
  Fade,
  Zoom,
  Badge,
  Tooltip
} from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  Send as SendIcon,
  Reply as ReplyIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Favorite as LikeIcon,
  FavoriteBorder as LikeOutlineIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Flag as FlagIcon,
  MoreVert as MoreIcon
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { useRealTimeFeatures } from '../../hooks/useRealTimeFeatures';
import socketService from '../../services/socketService';
import apiService from '../../services/apiService';
import { formatDistanceToNow } from 'date-fns';

const CommentsContainer = styled(Card)(({ theme }) => ({
  background: 'rgba(255, 255, 255, 0.95)',
  backdropFilter: 'blur(20px)',
  borderRadius: theme.spacing(3),
  border: '1px solid rgba(255, 255, 255, 0.3)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
  overflow: 'hidden',
}));

const CommentItem = styled(Box)(({ theme, level = 0 }) => ({
  padding: theme.spacing(2),
  marginLeft: level * theme.spacing(4),
  borderRadius: theme.spacing(2),
  backgroundColor: level > 0 ? 'rgba(248, 250, 252, 0.8)' : 'transparent',
  border: level > 0 ? '1px solid rgba(0, 0, 0, 0.05)' : 'none',
  marginBottom: theme.spacing(1),
  transition: 'all 0.3s ease',
  '&:hover': {
    backgroundColor: 'rgba(102, 126, 234, 0.03)',
  },
}));

const CommentInput = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    borderRadius: theme.spacing(2),
    backgroundColor: 'rgba(248, 250, 252, 0.8)',
    '&:hover': {
      backgroundColor: 'rgba(248, 250, 252, 0.9)',
    },
    '&.Mui-focused': {
      backgroundColor: 'white',
      boxShadow: '0 0 0 3px rgba(102, 126, 234, 0.1)',
    },
  },
}));

const TypingIndicator = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  padding: theme.spacing(1, 2),
  backgroundColor: 'rgba(102, 126, 234, 0.1)',
  borderRadius: theme.spacing(2),
  marginBottom: theme.spacing(2),
  animation: 'pulse 2s ease-in-out infinite',
}));

const LiveComments = ({ blogId, allowComments = true }) => {
  const user = useSelector(state => state.user);
  const { trackEngagement } = useRealTimeFeatures(blogId);
  
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [editingComment, setEditingComment] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [expandedReplies, setExpandedReplies] = useState(new Set());
  const [typingUsers, setTypingUsers] = useState([]);
  
  const commentInputRef = useRef(null);
  const [optimisticComments, setOptimisticComments] = useState(new Map());
  const typingTimeoutRef = useRef(null);

  const typingTimeoutRef = useRef(null);
  // Fetch comments
  useEffect(() => {
    fetchComments();
    setupRealTimeComments();
    
    return () => {
      socketService.removeAllListeners();
    };
  }, [blogId]);

  const fetchComments = async () => {
    try {
      setLoading(true);
      const response = await apiService.get(`/api/blog/${blogId}`);
      setComments(response.data.blog.comments || []);
    } catch (error) {
      console.error('Error fetching comments:', error);
      setError('Failed to load comments');
    } finally {
      setLoading(false);
    }
  };

  const setupRealTimeComments = () => {
    const socket = socketService.connect();

    // Join blog room for comment updates
    socketService.joinBlogRoom(blogId, user?._id);

    // New comment
    socket.on('new-comment', (data) => {
      if (data.blogId === blogId) {
        console.log('💬 Real-time: New comment received:', data);
        
        // Remove optimistic comment if it exists
        setOptimisticComments(prev => {
          const newMap = new Map(prev);
          // Find and remove optimistic comment with same content
          for (const [id, comment] of newMap.entries()) {
            if (comment.content === data.comment.content && comment.user._id === data.comment.user._id) {
              newMap.delete(id);
              break;
            }
          }
          return newMap;
        });
        
        // Add real comment
        setComments(prev => {
          // Check if comment already exists (avoid duplicates)
          const exists = prev.some(c => c._id === data.comment._id);
          if (!exists) {
            return [...prev, data.comment];
          }
          return prev;
        });
        
        // Show notification if not from current user
        if (data.comment.user._id !== user?._id) {
          window.dispatchEvent(new CustomEvent('realtime-notification', {
            detail: {
              title: 'New Comment',
              message: `${data.comment.user.name} commented on this blog`,
              type: 'comment'
            }
          }));
        }
      }
    });

    // Comment updated
    socket.on('comment-updated', (data) => {
      if (data.blogId === blogId) {
        console.log('💬 Real-time: Comment updated:', data);
        setComments(prev => prev.map(c => 
          c._id === data.comment._id ? data.comment : c
        ));
      }
    });

    // Comment deleted
    socket.on('comment-deleted', (data) => {
      if (data.blogId === blogId) {
        console.log('💬 Real-time: Comment deleted:', data);
        setComments(prev => prev.filter(c => c._id !== data.commentId));
      }
    });

    // Comment liked
    socket.on('comment-liked', (data) => {
      if (data.blogId === blogId) {
        console.log('💬 Real-time: Comment liked:', data);
        setComments(prev => prev.map(c => 
          c._id === data.commentId 
            ? { ...c, likes: data.likes }
            : c
        ));
      }
    });

    // Typing indicators
    socket.on('user-commenting', (data) => {
      if (data.blogId === blogId && data.userId !== user?._id) {
        console.log('⌨️ Real-time: User commenting:', data);
        setTypingUsers(prev => {
          const filtered = prev.filter(u => u.userId !== data.userId);
          return [...filtered, data];
        });
      }
    });

    socket.on('user-stopped-commenting', (data) => {
      if (data.blogId === blogId) {
        console.log('⌨️ Real-time: User stopped commenting:', data);
        setTypingUsers(prev => prev.filter(u => u.userId !== data.userId));
      }
    });
  };

  const handleCommentChange = (e) => {
    setNewComment(e.target.value);
    
    // Emit typing indicator with debouncing
    if (user?._id) {
      socketService.emitCommentTyping(blogId, user._id, user.name);
      
      // Clear previous timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Set timeout to stop typing
      typingTimeoutRef.current = setTimeout(() => {
        socketService.emitCommentStoppedTyping(blogId, user._id);
      }, 1500); // Reduced timeout for more responsive indicators
    }
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || !user?._id) return;
    
    if (isSubmitting) return;

    setSubmitting(true);
    setError('');
    
    try {
      // Create optimistic comment
      const optimisticId = `optimistic_${Date.now()}`;
      const optimisticComment = {
        _id: optimisticId,
        user: {
          _id: user._id,
          name: user.name,
          profile: user.profile
        },
        content: newComment.trim(),
        createdAt: new Date(),
        likes: [],
        replies: [],
        isOptimistic: true,
        parentComment: replyTo?._id || null
      };
      
      // Add optimistic comment to map
      setOptimisticComments(prev => new Map(prev.set(optimisticId, optimisticComment)));
      
      const commentContent = newComment.trim();
      const parentId = replyTo?._id || null;
      
      // Clear form immediately for better UX
      setNewComment('');
      setReplyTo(null);
      
      // Stop typing indicator
      socketService.emitCommentStoppedTyping(blogId, user._id);
      
      const response = await apiService.post(`/api/blog/${blogId}/comment`, {
        content: commentContent,
        userId: user._id,
        parentCommentId: parentId
      });

      if (response.data.success) {
        // Remove optimistic comment
        setOptimisticComments(prev => {
          const newMap = new Map(prev);
          newMap.delete(optimisticId);
          return newMap;
        });
        
        socketService.emitCommentStoppedTyping(blogId, user._id);
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      
      // Remove optimistic comment on error
      setOptimisticComments(prev => {
        const newMap = new Map(prev);
        newMap.delete(optimisticId);
        return newMap;
      });
      
      // Restore form state
      setNewComment(commentContent);
      setReplyTo(replyTo);
      
      setError('Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLikeComment = async (comment) => {
    if (!user?._id) return;

    try {
      // Optimistic update
      const isCurrentlyLiked = comment.likes?.some(like => like.user === user._id);
      const newLikes = isCurrentlyLiked 
        ? comment.likes.filter(like => like.user !== user._id)
        : [...(comment.likes || []), { user: user._id, createdAt: new Date() }];
      
      // Update comment locally
      setComments(prev => prev.map(c => 
        c._id === comment._id 
          ? { ...c, likes: newLikes }
          : c
      ));
      
      await apiService.post(`/api/blog/comment/${comment._id}/like`, {
        userId: user._id
      });
      
      // The real update will come via socket event
    } catch (error) {
      console.error('Error liking comment:', error);
      
      // Revert optimistic update on error
      setComments(prev => prev.map(c => 
        c._id === comment._id ? comment : c
      ));
    }
  };

  const handleReply = (comment) => {
    setReplyTo(comment);
    setNewComment('');
    setTimeout(() => {
      commentInputRef.current?.focus();
    }, 100);
  };

  const handleEdit = (comment) => {
    setEditingComment(comment);
    setEditContent(comment.content);
  };

  const handleUpdateComment = async () => {
    if (!editContent.trim()) return;

    try {
      const response = await apiService.put(`/api/blog/comment/${editingComment._id}`, {
        content: editContent.trim()
      });

      if (response.data.success) {
        setEditingComment(null);
        setEditContent('');
      }
    } catch (error) {
      console.error('Error updating comment:', error);
      setError('Failed to update comment');
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('Are you sure you want to delete this comment?')) return;

    try {
      await apiService.delete(`/api/blog/comment/${commentId}`);
    } catch (error) {
      console.error('Error deleting comment:', error);
      setError('Failed to delete comment');
    }
  };

  const toggleReplies = (commentId) => {
    setExpandedReplies(prev => {
      const newSet = new Set(prev);
      if (newSet.has(commentId)) {
        newSet.delete(commentId);
      } else {
        newSet.add(commentId);
      }
      return newSet;
    });
  };

  const renderComment = (comment, level = 0) => {
    const isLiked = comment.likes?.some(like => like.user === user?._id);
    const hasReplies = comment.replies && comment.replies.length > 0;
    const isExpanded = expandedReplies.has(comment._id);
    const canModify = user && (comment.user._id === user._id || user.role === 'admin');

    return (
      <Fade in={true} key={comment._id}>
        <CommentItem level={level}>
          <Box display="flex" alignItems="flex-start" gap={2}>
            <Avatar
              src={comment.user?.profile?.profilePicture}
              sx={{ width: 40, height: 40 }}
            >
              {comment.user?.name?.charAt(0)}
            </Avatar>
            
            <Box flex={1}>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <Typography variant="subtitle2" fontWeight={600}>
                  {comment.user?.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                </Typography>
                {comment.isEdited && (
                  <Chip label="edited" size="small" variant="outlined" />
                )}
              </Box>

              {editingComment?._id === comment._id ? (
                <Box>
                  <CommentInput
                    fullWidth
                    multiline
                    rows={3}
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    sx={{ mb: 2 }}
                  />
                  <Box display="flex" gap={1}>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={handleUpdateComment}
                    >
                      Update
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        setEditingComment(null);
                        setEditContent('');
                      }}
                    >
                      Cancel
                    </Button>
                  </Box>
                </Box>
              ) : (
                <Typography variant="body2" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>
                  {comment.content}
                </Typography>
              )}

              <Box display="flex" alignItems="center" gap={1}>
                <IconButton
                  size="small"
                  onClick={() => handleLikeComment(comment)}
                  color={isLiked ? 'error' : 'default'}
                >
                  {isLiked ? <LikeIcon fontSize="small" /> : <LikeOutlineIcon fontSize="small" />}
                </IconButton>
                <Typography variant="caption" color="text.secondary">
                  {comment.likes?.length || 0}
                </Typography>

                <Button
                  size="small"
                  startIcon={<ReplyIcon />}
                  onClick={() => handleReply(comment)}
                  sx={{ ml: 1 }}
                >
                  Reply
                </Button>

                {canModify && (
                  <>
                    <IconButton
                      size="small"
                      onClick={() => handleEdit(comment)}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteComment(comment._id)}
                      color="error"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </>
                )}
              </Box>

              {hasReplies && (
                <Box mt={2}>
                  <Button
                    size="small"
                    startIcon={isExpanded ? <CollapseIcon /> : <ExpandIcon />}
                    onClick={() => toggleReplies(comment._id)}
                    disabled={isOptimistic}
                    disabled={isOptimistic}
                  >
                    {isExpanded ? 'Hide' : 'Show'} {comment.replies.length} replies
                  </Button>
                </Box>
                  {canModifyComment(comment) && !isOptimistic && (
            </Box>
          </Box>

          {/* Render replies */}
          {hasReplies && isExpanded && (
            <Collapse in={isExpanded}>
              <Box mt={2}>
                {comment.replies.map(reply => renderComment(reply, level + 1))}
              </Box>
            </Collapse>
          )}
        </CommentItem>
      </Fade>
    );
  };

  // Combine real comments with optimistic comments for display
  const getAllComments = () => {
    const realComments = comments.filter(c => !c.isDeleted && !c.parentComment);
    const optimisticArray = Array.from(optimisticComments.values());
    
    return [...realComments, ...optimisticArray].sort((a, b) => 
      new Date(a.createdAt) - new Date(b.createdAt)
    );
  };

    const isOptimistic = comment.isOptimistic || optimisticComments.has(comment._id);
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={3}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <CommentsContainer>
      <CardContent>
        <Typography variant="h6" fontWeight={700} mb={3} display="flex" alignItems="center" gap={1}>
          💬 Live Comments ({comments.length})
          {typingUsers.length > 0 && (
            <Badge badgeContent={typingUsers.length} color="primary">
              <Chip label="typing..." size="small" color="primary" variant="outlined" />
            </Badge>
          )}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {/* Typing Indicators */}
        {typingUsers.length > 0 && (
          <Fade in={true}>
            <TypingIndicator>
              <Typography variant="body2" color="primary">
                {typingUsers.map(u => u.userName).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
              </Typography>
            </TypingIndicator>
          </Fade>
        )}

        {/* Add Comment Form */}
        {allowComments && user && (
          <Box mb={4}>
            <Box display="flex" alignItems="flex-start" gap={2} mb={2}>
              <Avatar
                src={user.profile?.profilePicture}
        <CommentItem level={level} sx={{ 
          opacity: isOptimistic ? 0.7 : 1,
          border: isOptimistic ? '1px dashed #ccc' : 'none'
        }}>
              >
                {user.name?.charAt(0)}
              </Avatar>
              
              <Box flex={1}>
                {replyTo && (
                  <Box mb={2} p={2} bgcolor="grey.100" borderRadius={2}>
                    <Typography variant="caption" color="text.secondary">
                      Replying to {replyTo.user.name}
                    </Typography>
                    <Button
                      size="small"
                      onClick={() => setReplyTo(null)}
                      sx={{ ml: 2 }}
                    >
                      Cancel
                    </Button>
                  </Box>
                )}
                {isOptimistic && (
                  <Chip label="Sending..." size="small" color="info" variant="outlined" />
                )}

                <form onSubmit={handleSubmitComment}>
                  <CommentInput
                    ref={commentInputRef}
                    fullWidth
                    multiline
                    rows={3}
                    placeholder={replyTo ? `Reply to ${replyTo.user.name}...` : "Write a comment..."}
                    value={newComment}
                    onChange={handleCommentChange}
                    sx={{ mb: 2 }}
                  />
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Button
                      type="submit"
                      variant="contained"
                      startIcon={submitting ? <CircularProgress size={20} /> : <SendIcon />}
                      disabled={!newComment.trim() || submitting}
                      sx={{
                        background: 'linear-gradient(135deg, #667eea, #764ba2)',
                        '&:hover': {
                          background: 'linear-gradient(135deg, #5a6fd8, #6a4190)',
                        },
                      }}
                    >
                      {submitting ? 'Posting...' : 'Post Comment'}
                    </Button>
                    
                    <Typography variant="caption" color="text.secondary">
                      {newComment.length}/1000 characters
                    </Typography>
                  </Box>
                </form>
              </Box>
            </Box>
          </Box>
        )}

        <Divider sx={{ mb: 3 }} />

        {/* Comments List */}
        <Box>
          {getAllComments().length === 0 ? (
            <Box textAlign="center" py={4}>
              <Typography variant="body2" color="text.secondary">
                No comments yet. Be the first to comment!
              </Typography>
            </Box>
          ) : (
            getAllComments().map(comment => renderComment(comment))
          )}
        </Box>
      </CardContent>
    </CommentsContainer>
  );
};

export default LiveComments;