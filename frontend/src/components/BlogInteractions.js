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
  Collapse
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
  Link as LinkIcon
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
  backgroundColor: 'rgba(248, 250, 252, 0.5)',
}));

const InteractionButton = styled(IconButton)(({ theme, active }) => ({
  borderRadius: theme.spacing(2),
  padding: theme.spacing(1.5),
  transition: 'all 0.3s ease',
  backgroundColor: active ? 'rgba(102, 126, 234, 0.1)' : 'transparent',
  color: active ? '#667eea' : theme.palette.text.secondary,
  '&:hover': {
    backgroundColor: 'rgba(102, 126, 234, 0.15)',
    transform: 'scale(1.1)',
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

  // Debug user authentication
  useEffect(() => {
    console.log('🔐 BlogInteractions - User state:', user);
    console.log('🔐 BlogInteractions - User ID from Redux:', user?._id);
    console.log('🔐 BlogInteractions - User ID from localStorage:', localStorage.getItem('userId'));
  }, [user]);

  useEffect(() => {
    if (user) {
      setIsLiked(likes.some(like => like.user === user._id));
      // Check bookmark status
      checkBookmarkStatus();
    }
  }, [likes, user]);

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

  useEffect(() => {
    // Set up real-time updates
    const socket = socketService.connect();
    
    // Listen for new comments
    const handleNewComment = (data) => {
      if (data.blogId === blogId) {
        console.log('📝 Real-time: New comment received:', data);
        setComments(prev => [...prev, data.comment]);
      }
    };

    // Listen for like updates
    const handleLikeUpdate = (data) => {
      if (data.blogId === blogId) {
        console.log('❤️ Real-time: Like update received:', data);
        setLikes(prev => {
          if (data.isLiked) {
            // Add like if not already present
            const exists = prev.some(like => like.user === user?._id);
            if (!exists) {
              return [...prev, { user: user._id, createdAt: new Date() }];
            }
          } else {
            // Remove like
            return prev.filter(like => like.user !== user?._id);
          }
          return prev;
        });
        setIsLiked(data.isLiked);
      }
    };

    // Listen for blog updates
    const handleBlogUpdated = (data) => {
      if (data.blogId === blogId) {
        console.log('📝 Real-time: Blog updated:', data);
        // Update likes and comments if provided
        if (data.likes) setLikes(data.likes);
        if (data.comments) setComments(data.comments);
      }
    };

    // Set up event listeners
    socket.on('new-comment', handleNewComment);
    socket.on('blog-like-updated', handleLikeUpdate);
    socket.on('blog-updated', handleBlogUpdated);

    // Join blogs room for real-time updates
    socket.emit('join-blogs-room');

    return () => {
      socket.off('new-comment', handleNewComment);
      socket.off('blog-like-updated', handleLikeUpdate);
      socket.off('blog-updated', handleBlogUpdated);
    };
  }, [blogId, user?._id]);

  const handleLike = async () => {
    if (!user?._id) {
      console.log('❌ User not authenticated');
      return;
    }

    // Prevent users from liking their own blogs
    if (user._id === authorId) {
      console.log('❌ Cannot like your own blog');
      return;
    }
    
    try {
      console.log('❤️ Sending like request for blog:', blogId);
      const response = await apiService.post(`/api/blog/${blogId}/like`, {
        userId: user._id
      });
      
      console.log('❤️ Like response:', response.data);
      setIsLiked(response.data.isLiked);
      setLikes(prev => 
        response.data.isLiked 
          ? [...prev, { user: user._id, createdAt: new Date() }]
          : prev.filter(like => like.user !== user._id)
      );
      
      // Track engagement
      trackEngagement(response.data.isLiked ? 'like' : 'unlike', blogId);
    } catch (err) {
      console.error('❌ Error toggling like:', err);
    }
  };

  const handleBookmark = async () => {
    if (!user?._id) {
      console.log('❌ User not authenticated');
      return;
    }

    try {
      console.log('🔖 Sending bookmark request for blog:', blogId);
      const response = await apiService.post(`/api/blog/${blogId}/bookmark`, {
        userId: user._id
      });
      
      console.log('🔖 Bookmark response:', response.data);
      setIsBookmarked(response.data.isBookmarked);
      
      // Track engagement
      trackEngagement('bookmark', blogId);
    } catch (err) {
      console.error('❌ Error toggling bookmark:', err);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !user?._id) return;

    try {
      setSubmittingComment(true);
      console.log('💬 Sending comment request for blog:', blogId);
      
      const response = await apiService.post(`/api/blog/${blogId}/comment`, {
        content: newComment,
        userId: user._id,
        parentCommentId: replyTo?._id || null
      });
      
      console.log('💬 Comment response:', response.data);
      setComments(prev => [...prev, response.data.comment]);
      setNewComment('');
      setReplyTo(null);
      
      // Track engagement
      trackEngagement('comment', blogId, {
        commentLength: newComment.length,
        isReply: !!replyTo
      });
    } catch (err) {
      console.error('❌ Error adding comment:', err);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleShare = async (platform) => {
    if (!user?._id) {
      console.log('❌ User not authenticated');
      return;
    }

    try {
      console.log('📤 Sending share request for blog:', blogId, 'platform:', platform);
      
      // Track share in backend
      await apiService.post(`/api/blog/${blogId}/share`, {
        userId: user._id,
        platform
      });
      
      const blogUrl = `${window.location.origin}/blog/${blogId}`;
      
      switch (platform) {
        case 'facebook':
          window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(blogUrl)}`);
          break;
        case 'twitter':
          window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(blogUrl)}`);
          break;
        case 'linkedin':
          window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(blogUrl)}`);
          break;
        case 'whatsapp':
          window.open(`https://wa.me/?text=${encodeURIComponent(blogUrl)}`);
          break;
        case 'email':
          window.open(`mailto:?subject=Check out this blog&body=${encodeURIComponent(blogUrl)}`);
          break;
        case 'copy':
          navigator.clipboard.writeText(blogUrl);
          break;
      }
      
      setShareMenuAnchor(null);
      
      // Track engagement
      trackEngagement('share', blogId, { platform });
    } catch (err) {
      console.error('❌ Error sharing blog:', err);
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
      {/* Interaction Bar */}
      <InteractionBar>
        <Box display="flex" alignItems="center" gap={1}>
          <InteractionButton
            active={isLiked}
            onClick={handleLike}
            disabled={!user?._id || user._id === authorId}
            sx={{
              opacity: (!user?._id || user._id === authorId) ? 0.5 : 1,
              cursor: (!user?._id || user._id === authorId) ? 'not-allowed' : 'pointer',
              '&:hover': {
                backgroundColor: (!user?._id || user._id === authorId) ? 'transparent' : 'rgba(102, 126, 234, 0.15)',
                transform: (!user?._id || user._id === authorId) ? 'none' : 'scale(1.1)',
              }
            }}
            title={!user?._id ? "Please login to like" : (user._id === authorId ? "You can't like your own blog" : "Like this blog")}
          >
            {isLiked ? <LikeIcon /> : <LikeOutlineIcon />}
          </InteractionButton>
          <Typography variant="body2" fontWeight={600}>
            {likes.length}
          </Typography>
        </Box>

        <Box display="flex" alignItems="center" gap={1}>
          <InteractionButton onClick={() => setShowComments(!showComments)}>
            <CommentIcon />
          </InteractionButton>
          <Typography variant="body2" fontWeight={600}>
            {comments.length}
          </Typography>
        </Box>

        <InteractionButton
          onClick={(e) => setShareMenuAnchor(e.currentTarget)}
          disabled={!user?._id}
          title={!user?._id ? "Please login to share" : "Share this blog"}
        >
          <ShareIcon />
        </InteractionButton>

        <InteractionButton
          active={isBookmarked}
          onClick={handleBookmark}
          disabled={!user?._id}
          title={!user?._id ? "Please login to bookmark" : (isBookmarked ? "Remove bookmark" : "Bookmark this blog")}
        >
          {isBookmarked ? <BookmarkIcon /> : <BookmarkOutlineIcon />}
        </InteractionButton>

        <Box sx={{ flexGrow: 1 }} />

        <Typography variant="body2" color="text.secondary">
          {likes.length} likes • {comments.length} comments
        </Typography>
      </InteractionBar>

      {/* Comments Section */}
      {showComments && (
        <LiveComments 
          blogId={blogId}
          allowComments={allowComments}
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
          <LinkIcon sx={{ mr: 1 }} />
          Copy Link
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default BlogInteractions;