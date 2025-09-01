import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Avatar,
  IconButton,
  Collapse,
  Divider,
  Chip,
  Alert,
  CircularProgress,
  Menu,
  MenuItem,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Paper
} from '@mui/material';
import {
  Send as SendIcon,
  Reply as ReplyIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  ThumbUp as ThumbUpIcon,
  ThumbUpOutlined as ThumbUpOutlinedIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Flag as FlagIcon
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import socketService from '../../services/socketService.js';
import axios from 'axios';
import { serverURL } from '../../helper/Helper.js';
import { formatDistanceToNow } from 'date-fns';

const CommentSection = ({ blogId, onCommentCountChange }) => {
  const { id } = useParams();
  const currentUser = useSelector(state => state.user);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [editingComment, setEditingComment] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [expandedReplies, setExpandedReplies] = useState(new Set());
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedComment, setSelectedComment] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const commentInputRef = useRef(null);
  const replyInputRef = useRef(null);

  useEffect(() => {
    fetchComments();
    setupSocketListeners();
    
    return () => {
      socketService.removeAllListeners();
    };
  }, [blogId || id]);

  const setupSocketListeners = () => {
    const socket = socketService.getSocket();
    if (!socket) return;

    socket.on('comment_added', (data) => {
      if (data.blogId === (blogId || id)) {
        setComments(prev => [...prev, data.comment]);
        onCommentCountChange && onCommentCountChange(prev => prev + 1);
      }
    });

    socket.on('comment_updated', (data) => {
      if (data.blogId === (blogId || id)) {
        setComments(prev => prev.map(c => 
          c._id === data.comment._id ? data.comment : c
        ));
      }
    });

    socket.on('comment_deleted', (data) => {
      if (data.blogId === (blogId || id)) {
        setComments(prev => prev.filter(c => c._id !== data.commentId));
        onCommentCountChange && onCommentCountChange(prev => prev - 1);
      }
    });

    socket.on('comment_liked', (data) => {
      if (data.blogId === (blogId || id)) {
        setComments(prev => prev.map(c => {
          if (c._id === data.commentId) {
            return {
              ...c,
              likes: data.likes,
              isLiked: data.userId === currentUser?._id
            };
          }
          return c;
        }));
      }
    });
  };

  const fetchComments = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${serverURL}/api/blog/${blogId || id}/comments`);
      setComments(response.data.comments || []);
      onCommentCountChange && onCommentCountChange(response.data.comments?.length || 0);
    } catch (error) {
      console.error('Error fetching comments:', error);
      setMessage({ 
        type: 'error', 
        text: 'Failed to load comments' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || !currentUser) return;

    setIsSubmitting(true);
    try {
      const response = await axios.post(`${serverURL}/api/blog/${blogId || id}/comment`, {
        content: newComment.trim(),
        userId: currentUser._id,
        parentCommentId: replyTo?._id || null
      });

      if (response.data.success) {
        setNewComment('');
        setReplyTo(null);
        setMessage({ type: 'success', text: 'Comment added successfully!' });
        
        // Emit real-time update
        const socket = socketService.getSocket();
        if (socket) {
          socket.emit('new_comment', {
            blogId: blogId || id,
            comment: response.data.comment
          });
        }

        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.message || 'Failed to add comment' 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReply = (comment) => {
    setReplyTo(comment);
    setNewComment('');
    setTimeout(() => {
      replyInputRef.current?.focus();
    }, 100);
  };

  const handleEdit = (comment) => {
    setEditingComment(comment);
    setEditContent(comment.content);
  };

  const handleUpdateComment = async () => {
    if (!editContent.trim()) return;

    try {
      const response = await axios.put(`${serverURL}/api/blog/comment/${editingComment._id}`, {
        content: editContent.trim()
      });

      if (response.data.success) {
        setEditingComment(null);
        setEditContent('');
        setMessage({ type: 'success', text: 'Comment updated successfully!' });

        // Emit real-time update
        const socket = socketService.getSocket();
        if (socket) {
          socket.emit('comment_updated', {
            blogId: blogId || id,
            comment: response.data.comment
          });
        }

        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
      }
    } catch (error) {
      console.error('Error updating comment:', error);
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.message || 'Failed to update comment' 
      });
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('Are you sure you want to delete this comment?')) return;

    try {
      const response = await axios.delete(`${serverURL}/api/blog/comment/${commentId}`);
      
      if (response.data.success) {
        setMessage({ type: 'success', text: 'Comment deleted successfully!' });

        // Emit real-time update
        const socket = socketService.getSocket();
        if (socket) {
          socket.emit('comment_deleted', {
            blogId: blogId || id,
            commentId
          });
        }

        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.message || 'Failed to delete comment' 
      });
    }
  };

  const handleLikeComment = async (comment) => {
    if (!currentUser) return;

    try {
      const response = await axios.post(`${serverURL}/api/blog/comment/${comment._id}/like`, {
        userId: currentUser._id
      });

      if (response.data.success) {
        // Emit real-time update
        const socket = socketService.getSocket();
        if (socket) {
          socket.emit('comment_liked', {
            blogId: blogId || id,
            commentId: comment._id,
            likes: response.data.likes,
            userId: currentUser._id
          });
        }
      }
    } catch (error) {
      console.error('Error liking comment:', error);
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

  const handleMenuOpen = (event, comment) => {
    setAnchorEl(event.currentTarget);
    setSelectedComment(comment);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedComment(null);
  };

  const canModifyComment = (comment) => {
    return currentUser && (
      comment.user._id === currentUser._id || 
      currentUser.role === 'admin'
    );
  };

  const renderComment = (comment, level = 0) => {
    const isExpanded = expandedReplies.has(comment._id);
    const hasReplies = comment.replies && comment.replies.length > 0;
    const isLiked = comment.likes?.some(like => like.user === currentUser?._id);

    return (
      <Box key={comment._id} sx={{ ml: level * 3, mb: 2 }}>
        <Card variant="outlined" sx={{ backgroundColor: level > 0 ? '#fafafa' : 'white' }}>
          <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
            <Box display="flex" alignItems="flex-start" gap={2}>
              <Avatar
                src={comment.user.profile?.profilePicture}
                sx={{ width: 40, height: 40 }}
              >
                {comment.user.name?.charAt(0)}
              </Avatar>
              
              <Box flex={1}>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <Typography variant="subtitle2" fontWeight={600}>
                    {comment.user.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                  </Typography>
                  {comment.isEdited && (
                    <Chip label="Edited" size="small" variant="outlined" />
                  )}
                </Box>

                {editingComment?._id === comment._id ? (
                  <Box>
                    <TextField
                      fullWidth
                      multiline
                      rows={3}
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      variant="outlined"
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
                    color={isLiked ? 'primary' : 'default'}
                  >
                    {isLiked ? <ThumbUpIcon fontSize="small" /> : <ThumbUpOutlinedIcon fontSize="small" />}
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

                  {canModifyComment(comment) && (
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

                  {!canModifyComment(comment) && (
                    <IconButton
                      size="small"
                      onClick={(e) => handleMenuOpen(e, comment)}
                    >
                      <MoreVertIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>

                {hasReplies && (
                  <Box mt={2}>
                    <Button
                      size="small"
                      startIcon={isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      onClick={() => toggleReplies(comment._id)}
                    >
                      {isExpanded ? 'Hide' : 'Show'} {comment.replies.length} replies
                    </Button>
                  </Box>
                )}
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* Render replies */}
        {hasReplies && isExpanded && (
          <Box>
            {comment.replies.map(reply => renderComment(reply, level + 1))}
          </Box>
        )}
      </Box>
    );
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" p={3}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h6" gutterBottom>
        Comments ({comments.length})
      </Typography>

      {message.text && (
        <Alert 
          severity={message.type} 
          sx={{ mb: 3 }}
          onClose={() => setMessage({ type: '', text: '' })}
        >
          {message.text}
        </Alert>
      )}

      {/* Add Comment Form */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" alignItems="flex-start" gap={2}>
            <Avatar
              src={currentUser?.profile?.profilePicture}
              sx={{ width: 40, height: 40 }}
            >
              {currentUser?.name?.charAt(0)}
            </Avatar>
            
            <Box flex={1}>
              {replyTo && (
                <Box mb={2} p={2} bgcolor="grey.100" borderRadius={1}>
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

              <form onSubmit={handleSubmitComment}>
                <TextField
                  ref={replyInputRef}
                  fullWidth
                  multiline
                  rows={3}
                  placeholder={replyTo ? `Reply to ${replyTo.user.name}...` : "Write a comment..."}
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  variant="outlined"
                  sx={{ mb: 2 }}
                />
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Button
                    type="submit"
                    variant="contained"
                    startIcon={isSubmitting ? <CircularProgress size={20} /> : <SendIcon />}
                    disabled={!newComment.trim() || isSubmitting}
                  >
                    {isSubmitting ? 'Posting...' : 'Post Comment'}
                  </Button>
                  {replyTo && (
                    <Typography variant="caption" color="text.secondary">
                      Replying to {replyTo.user.name}
                    </Typography>
                  )}
                </Box>
              </form>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Comments List */}
      <Box>
        {comments.length === 0 ? (
          <Box textAlign="center" py={4}>
            <Typography variant="body2" color="text.secondary">
              No comments yet. Be the first to comment!
            </Typography>
          </Box>
        ) : (
          comments.map(comment => renderComment(comment))
        )}
      </Box>

      {/* Comment Actions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => {
          // Handle flag/report comment
          handleMenuClose();
        }}>
          <ListItemIcon>
            <FlagIcon fontSize="small" />
          </ListItemIcon>
          Report Comment
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default CommentSection;
