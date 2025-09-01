import React, { useState, useEffect } from 'react';
import {
  Box,
  IconButton,
  Typography,
  Button,
  TextField,
  Avatar,
  Chip,
  Divider,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Collapse,
  Tooltip,
  Badge,
  CircularProgress,
  Alert,
  Snackbar
} from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  Favorite as LikeIcon,
  FavoriteBorder as LikeOutlineIcon,
  Comment as CommentIcon,
  Share as ShareIcon,
  Bookmark as BookmarkIcon,
  BookmarkBorder as BookmarkOutlineIcon,
  Send as SendIcon,
  Reply as ReplyIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Facebook as FacebookIcon,
  Twitter as TwitterIcon,
  LinkedIn as LinkedInIcon,
  WhatsApp as WhatsAppIcon,
  Email as EmailIcon,
  Link as LinkIcon,
  ContentCopy as CopyIcon,
  CheckCircle as CheckIcon
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import apiService from '../services/apiService';
import socketService from '../services/socketService';
import LiveComments from './RealTime/LiveComments';
import { useRealTimeFeatures } from '../hooks/useRealTimeFeatures';
import { formatDistanceToNow } from 'date-fns';

const InteractionBar = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
  padding: theme.spacing(2),
  borderTop: '1px solid rgba(0, 0, 0, 0.08)',
  backgroundColor: 'rgba(248, 250, 252, 0.8)',
  backdropFilter: 'blur(10px)',
}));

const InteractionButton = styled(IconButton)(({ theme, active }) => ({
  borderRadius: theme.spacing(2),
  padding: theme.spacing(1.5),
  transition: 'all 0.3s ease',
  backgroundColor: active ? 'rgba(102, 126, 234, 0.1)' : 'transparent',
  color: active ? '#667eea' : theme.palette.text.secondary,
  position: 'relative',
  overflow: 'hidden',
  '&:hover': {
    backgroundColor: 'rgba(102, 126, 234, 0.15)',
    transform: 'scale(1.1)',
    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: '-100%',
      width: '100%',
      height: '100%',
      background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent)',
      transition: 'left 0.6s ease',
      left: '100%',
    },
  },
  '&:disabled': {
    opacity: 0.5,
    cursor: 'not-allowed',
    '&:hover': {
      transform: 'none',
      backgroundColor: 'transparent',
    },
  },
}));

const CommentSection = styled(Box)(({ theme }) => ({
  padding: theme.spacing(3),
  backgroundColor: 'rgba(248, 250, 252, 0.3)',
}));

const CommentItem = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  borderRadius: theme.spacing(2),
  backgroundColor: 'white',
  marginBottom: theme.spacing(2),
  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
  border: '1px solid rgba(0, 0, 0, 0.05)',
}));

const BlogInteractions = ({ blogId, authorId, initialLikes = [], initialComments = [], allowComments = true }) => {
  const user = useSelector(state => state.user);
  const { trackEngagement } = useRealTimeFeatures(blogId);
  const [likes, setLikes] = useState(initialLikes);
  const [comments, setComments] = useState(initialComments);
  const [isLiked, setIsLiked] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [shareMenuAnchor, setShareMenuAnchor] = useState(null);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [likingInProgress, setLikingInProgress] = useState(false);
  const [bookmarkingInProgress, setBookmarkingInProgress] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const [error, setError] = useState('');

  // Debug user authentication
  useEffect(() => {
    console.log('🔐 BlogInteractions - User state:', user);
    console.log('🔐 BlogInteractions - User ID from Redux:', user?._id);
    console.log('🔐 BlogInteractions - User ID from localStorage:', localStorage.getItem('userId'));
  }, [user]);

  useEffect(() => {
    if (user) {
      setIsLiked(likes.some(like => like.user === user._id));
      checkBookmarkStatus();
    }
  }, [likes, user]);

  // Setup real-time listeners
  useEffect(() => {
    if (!blogId) return;

    const socket = socketService.connect();
    
    // Join blog room for real-time updates
    socketService.joinBlogRoom(blogId, user?._id);

    // Listen for like updates
    const handleLikeUpdate = (data) => {
      if (data.blogId === blogId) {
        console.log('❤️ Real-time like update:', data);
        setLikes(prev => {
          // Update like count based on server response
          const newLikes = [];
          for (let i = 0; i < data.likeCount; i++) {
            newLikes.push({ user: `user_${i}`, createdAt: new Date() });
          }
          return newLikes;
        });
        
        // Update user's like status if it's their action
        if (data.userId === user?._id) {
          setIsLiked(data.isLiked);
        }
      }
    };

    // Listen for comment updates
    const handleCommentUpdate = (data) => {
      if (data.blogId === blogId) {
        console.log('💬 Real-time comment update:', data);
        if (data.comment) {
          setComments(prev => [...prev, data.comment]);
        }
      }
    };

    // Listen for share updates
    const handleShareUpdate = (data) => {
      if (data.blogId === blogId) {
        console.log('📤 Real-time share update:', data);
        // Update share count or show notification
      }
    };

    // Register event listeners
    socketService.addEventListener('blog-like-updated', handleLikeUpdate);
    socketService.addEventListener('new-comment', handleCommentUpdate);
    socketService.addEventListener('blog-shared', handleShareUpdate);

    return () => {
      socketService.leaveBlogRoom(blogId, user?._id);
      socketService.removeEventListener('blog-like-updated', handleLikeUpdate);
      socketService.removeEventListener('new-comment', handleCommentUpdate);
      socketService.removeEventListener('blog-shared', handleShareUpdate);
    };
  }, [blogId, user?._id]);

  // Check bookmark status
  const checkBookmarkStatus = async () => {
    if (!user?._id) return;
    
    try {
      const response = await apiService.get(`/api/user/bookmarks/${user._id}`);
      const bookmarkedBlogs = response.data.bookmarks || [];
      setIsBookmarked(bookmarkedBlogs.some(blog => blog._id === blogId));
    } catch (err) {
      console.error('Error checking bookmark status:', err);
    }
  };

  const handleLike = async () => {
    if (!user?._id) {
      console.log('❌ User not authenticated');
      setError('Please login to like this blog');
      return;
    }

    // Prevent users from liking their own blogs
    if (user._id === authorId) {
      console.log('❌ Cannot like your own blog');
      setError('You cannot like your own blog');
      return;
    }
    
    if (likingInProgress) return;
    
    setLikingInProgress(true);
    setError('');
    
    try {
      console.log('❤️ Sending like request for blog:', blogId);
      
      // Optimistic update
      const newIsLiked = !isLiked;
      setIsLiked(newIsLiked);
      setLikes(prev => 
        newIsLiked 
          ? [...prev, { user: user._id, createdAt: new Date() }]
          : prev.filter(like => like.user !== user._id)
      );
      
      // Send to server
      const response = await apiService.post(`/api/blog/${blogId}/like`, {
        userId: user._id
      });
      
      // Emit real-time update
      socketService.emitBlogLike(blogId, user._id, newIsLiked);
      
      // Track engagement
      trackEngagement(newIsLiked ? 'like' : 'unlike', blogId, {
        previousState: isLiked,
        newState: newIsLiked
      });
      
      console.log('❤️ Like action completed:', response.data);
    } catch (err) {
      console.error('❌ Error toggling like:', err);
      
      // Revert optimistic update on error
      setIsLiked(!isLiked);
      setLikes(prev => 
        isLiked 
          ? [...prev, { user: user._id, createdAt: new Date() }]
          : prev.filter(like => like.user !== user._id)
      );
      
      setError('Failed to update like. Please try again.');
    } finally {
      setLikingInProgress(false);
    }
  };

  const handleBookmark = async () => {
    if (!user?._id) {
      console.log('❌ User not authenticated');
      setError('Please login to bookmark this blog');
      return;
    }

    if (bookmarkingInProgress) return;
    
    setBookmarkingInProgress(true);
    setError('');
    
    try {
      console.log('🔖 Sending bookmark request for blog:', blogId);
      
      // Optimistic update
      const newIsBookmarked = !isBookmarked;
      setIsBookmarked(newIsBookmarked);
      
      const response = await apiService.post(`/api/blog/${blogId}/bookmark`, {
        userId: user._id
      });
      
      // Track engagement
      trackEngagement('bookmark', blogId, {
        action: newIsBookmarked ? 'add' : 'remove'
      });
      
      console.log('🔖 Bookmark action completed:', response.data);
    } catch (err) {
      console.error('❌ Error toggling bookmark:', err);
      
      // Revert optimistic update on error
      setIsBookmarked(!isBookmarked);
      setError('Failed to update bookmark. Please try again.');
    } finally {
      setBookmarkingInProgress(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !user?._id) return;

    if (submittingComment) return;
    
    setSubmittingComment(true);
    setError('');
    
    try {
      console.log('💬 Sending comment request for blog:', blogId);
      
      // Optimistic update
      const optimisticComment = {
        _id: `temp_${Date.now()}`,
        user: {
          _id: user._id,
          name: user.name,
          profile: user.profile
        },
        content: newComment,
        createdAt: new Date(),
        likes: [],
        replies: [],
        isOptimistic: true
      };
      
      setComments(prev => [...prev, optimisticComment]);
      const commentContent = newComment;
      setNewComment('');
      
      const response = await apiService.post(`/api/blog/${blogId}/comment`, {
        content: commentContent,
        userId: user._id,
        parentCommentId: replyTo?._id || null
      });
      
      console.log('💬 Comment response:', response.data);
      
      // Replace optimistic comment with real one
      setComments(prev => prev.map(c => 
        c._id === optimisticComment._id ? response.data.comment : c
      ));
      
      setReplyTo(null);
      
      // Emit real-time comment
      socketService.emitComment(blogId, user._id, commentContent, replyTo?._id);
      
      // Track engagement
      trackEngagement('comment', blogId, {
        commentLength: commentContent.length,
        isReply: !!replyTo
      });
    } catch (err) {
      console.error('❌ Error adding comment:', err);
      
      // Remove optimistic comment on error
      setComments(prev => prev.filter(c => c._id !== optimisticComment._id));
      setNewComment(commentContent); // Restore comment text
      setError('Failed to add comment. Please try again.');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleShare = async (platform) => {
    if (!user?._id) {
      console.log('❌ User not authenticated');
      setError('Please login to share this blog');
      return;
    }

    setError('');
    
    try {
      console.log('📤 Sending share request for blog:', blogId, 'platform:', platform);
      
      const blogUrl = `${window.location.origin}/blog/${blogId}`;
      const blogTitle = document.title || 'Check out this blog';
      
      switch (platform) {
        case 'facebook':
          window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(blogUrl)}`, '_blank', 'width=600,height=400');
          break;
        case 'twitter':
          window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(blogUrl)}&text=${encodeURIComponent(blogTitle)}`, '_blank', 'width=600,height=400');
          break;
        case 'linkedin':
          window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(blogUrl)}`, '_blank', 'width=600,height=400');
          break;
        case 'whatsapp':
          window.open(`https://wa.me/?text=${encodeURIComponent(`${blogTitle} ${blogUrl}`)}`);
          break;
        case 'email':
          window.open(`mailto:?subject=${encodeURIComponent(blogTitle)}&body=${encodeURIComponent(`I thought you might be interested in this blog: ${blogUrl}`)}`);
          break;
        case 'copy':
          await navigator.clipboard.writeText(blogUrl);
          setShareSuccess(true);
          setTimeout(() => setShareSuccess(false), 2000);
          break;
      }
      
      // Track share in backend
      await apiService.post(`/api/blog/${blogId}/share`, {
        userId: user._id,
        platform
      });
      
      // Emit real-time share
      socketService.emitBlogShare(blogId, user._id, platform);
      
      setShareMenuAnchor(null);
      
      // Track engagement
      trackEngagement('share', blogId, { platform });
    } catch (err) {
      console.error('❌ Error sharing blog:', err);
      setError('Failed to share blog. Please try again.');
    }
  };

  const formatCommentTime = (date) => {
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true });
    } catch {
      return 'Recently';
    }
  };

  return (
    <Box>
      {/* Error Snackbar */}
      <Snackbar
        open={!!error}
        autoHideDuration={4000}
        onClose={() => setError('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={() => setError('')}>
          {error}
        </Alert>
      </Snackbar>

      {/* Share Success Snackbar */}
      <Snackbar
        open={shareSuccess}
        autoHideDuration={2000}
        onClose={() => setShareSuccess(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" icon={<CheckIcon />}>
          Link copied to clipboard!
        </Alert>
      </Snackbar>

      {/* Interaction Bar */}
      <InteractionBar>
        <Box display="flex" alignItems="center" gap={1}>
          <Tooltip title={
            !user?._id ? "Please login to like" : 
            (user._id === authorId ? "You can't like your own blog" : 
            (isLiked ? "Unlike this blog" : "Like this blog"))
          }>
            <InteractionButton
            active={isLiked}
            onClick={handleLike}
            disabled={!user?._id || user._id === authorId || likingInProgress}
            sx={{
              opacity: (!user?._id || user._id === authorId) ? 0.5 : 1,
              cursor: (!user?._id || user._id === authorId) ? 'not-allowed' : 'pointer',
            }}
          >
            {likingInProgress ? (
              <CircularProgress size={20} />
            ) : (
              isLiked ? <LikeIcon /> : <LikeOutlineIcon />
            )}
          </InteractionButton>
          </Tooltip>
          <Typography variant="body2" fontWeight={600}>
            {likes.length}
          </Typography>
        </Box>

        <Box display="flex" alignItems="center" gap={1}>
          <Tooltip title={showComments ? "Hide comments" : "Show comments"}>
            <InteractionButton onClick={() => setShowComments(!showComments)}>
            <CommentIcon />
          </InteractionButton>
          </Tooltip>
          <Typography variant="body2" fontWeight={600}>
            {comments.length}
          </Typography>
        </Box>

        <Tooltip title={!user?._id ? "Please login to share" : "Share this blog"}>
          <InteractionButton
          onClick={(e) => setShareMenuAnchor(e.currentTarget)}
          disabled={!user?._id}
        >
          <ShareIcon />
        </InteractionButton>
        </Tooltip>

        <Tooltip title={
          !user?._id ? "Please login to bookmark" : 
          (isBookmarked ? "Remove bookmark" : "Bookmark this blog")
        }>
          <InteractionButton
          active={isBookmarked}
          onClick={handleBookmark}
          disabled={!user?._id || bookmarkingInProgress}
        >
          {bookmarkingInProgress ? (
            <CircularProgress size={20} />
          ) : (
            isBookmarked ? <BookmarkIcon /> : <BookmarkOutlineIcon />
          )}
        </InteractionButton>
        </Tooltip>

        <Box sx={{ flexGrow: 1 }} />

        <Typography variant="body2" color="text.secondary">
          {likes.length} like{likes.length !== 1 ? 's' : ''} • {comments.length} comment{comments.length !== 1 ? 's' : ''}
        </Typography>
      </InteractionBar>

      {/* Comments Section */}
      {showComments && (
        <LiveComments 
          blogId={blogId}
          allowComments={allowComments}
          onCommentCountChange={(count) => setComments(prev => ({ ...prev, length: count }))}
        />
      )}

      {/* Share Menu */}
      <Menu
        anchorEl={shareMenuAnchor}
        open={Boolean(shareMenuAnchor)}
        onClose={() => setShareMenuAnchor(null)}
      >
        <MenuItem onClick={() => handleShare('facebook')}>
          <FacebookIcon sx={{ mr: 1, color: '#1877f2' }} />
          Facebook
        </MenuItem>
        <MenuItem onClick={() => handleShare('twitter')}>
          <TwitterIcon sx={{ mr: 1, color: '#1da1f2' }} />
          Twitter
        </MenuItem>
        <MenuItem onClick={() => handleShare('linkedin')}>
          <LinkedInIcon sx={{ mr: 1, color: '#0077b5' }} />
          LinkedIn
        </MenuItem>
        <MenuItem onClick={() => handleShare('whatsapp')}>
          <WhatsAppIcon sx={{ mr: 1, color: '#25d366' }} />
          WhatsApp
        </MenuItem>
        <MenuItem onClick={() => handleShare('email')}>
          <EmailIcon sx={{ mr: 1, color: '#ea4335' }} />
          Email
        </MenuItem>
        <MenuItem onClick={() => handleShare('copy')}>
          <CopyIcon sx={{ mr: 1 }} />
          Copy Link
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default BlogInteractions;