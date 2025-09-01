import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Chip,
  Avatar,
  Divider,
  IconButton,
  Tooltip,
  Fade,
  Zoom,
  Badge
} from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  Refresh as RefreshIcon,
  TrendingUp as TrendingIcon,
  Visibility as ViewIcon,
  Favorite as LikeIcon,
  Comment as CommentIcon,
  Share as ShareIcon,
  Bookmark as BookmarkIcon,
  Person as PersonIcon,
  AccessTime as TimeIcon,
  FiberNew as NewIcon
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { useRealTimeFeatures } from '../../hooks/useRealTimeFeatures';
import socketService from '../../services/socketService';
import realtimeService from '../../services/realtimeService';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';

const FeedContainer = styled(Box)(({ theme }) => ({
  maxWidth: '800px',
  margin: '0 auto',
  padding: theme.spacing(2),
}));

const FeedCard = styled(Card)(({ theme }) => ({
  background: 'rgba(255, 255, 255, 0.95)',
  backdropFilter: 'blur(20px)',
  borderRadius: theme.spacing(3),
  border: '1px solid rgba(255, 255, 255, 0.3)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
  marginBottom: theme.spacing(3),
  transition: 'all 0.3s ease',
  cursor: 'pointer',
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: '0 16px 40px rgba(0,0,0,0.15)',
  },
}));

const NewContentIndicator = styled(Box)(({ theme }) => ({
  position: 'fixed',
  top: '100px',
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 1000,
  background: 'linear-gradient(135deg, #667eea, #764ba2)',
  color: 'white',
  padding: theme.spacing(1, 3),
  borderRadius: theme.spacing(3),
  boxShadow: '0 8px 25px rgba(102, 126, 234, 0.3)',
  animation: 'slideDown 0.5s ease',
  '@keyframes slideDown': {
    from: { transform: 'translateX(-50%) translateY(-100%)', opacity: 0 },
    to: { transform: 'translateX(-50%) translateY(0)', opacity: 1 }
  }
}));

const LiveStats = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
  padding: theme.spacing(1),
  backgroundColor: 'rgba(248, 250, 252, 0.8)',
  borderRadius: theme.spacing(2),
  marginTop: theme.spacing(2),
}));

const LiveContentFeed = ({ userId, limit = 10 }) => {
  const navigate = useNavigate();
  const user = useSelector(state => state.user);
  const { isConnected } = useRealTimeFeatures();
  
  const [feedItems, setFeedItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [newContentCount, setNewContentCount] = useState(0);
  const [lastTimestamp, setLastTimestamp] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  
  const loadingRef = useRef(false);
  const observerRef = useRef(null);
  const feedEndRef = useRef(null);

  // Initial load
  useEffect(() => {
    loadFeedItems(true);
    setupRealTimeFeed();
    
    return () => {
      socketService.removeAllListeners();
    };
  }, [userId]);

  // Setup infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadFeedItems(false);
        }
      },
      { threshold: 0.1 }
    );

    if (feedEndRef.current) {
      observer.observe(feedEndRef.current);
    }

    observerRef.current = observer;

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, loading]);

  const loadFeedItems = async (isInitial = false) => {
    if (loadingRef.current) return;
    
    loadingRef.current = true;
    setLoading(true);
    setError('');

    try {
      const timestamp = isInitial ? null : lastTimestamp;
      const response = await realtimeService.getContentFeed(timestamp, limit);
      
      if (response.blogs) {
        if (isInitial) {
          setFeedItems(response.blogs);
        } else {
          setFeedItems(prev => [...prev, ...response.blogs]);
        }
        
        setHasMore(response.hasMore);
        
        if (response.blogs.length > 0) {
          setLastTimestamp(response.blogs[response.blogs.length - 1].createdAt);
        }
      }
    } catch (error) {
      console.error('Error loading feed:', error);
      setError('Failed to load content feed');
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  };

  const setupRealTimeFeed = () => {
    const socket = socketService.connect();

    // New blog published
    socket.on('new-blog', (data) => {
      // Check if this blog should appear in user's feed
      if (shouldShowInFeed(data.blog)) {
        setNewContentCount(prev => prev + 1);
        
        // Show notification
        window.dispatchEvent(new CustomEvent('realtime-notification', {
          detail: {
            title: 'New Blog Published',
            message: `${data.blog.user.name} published "${data.blog.title}"`,
            type: 'new_post'
          }
        }));
      }
    });

    // Blog updated
    socket.on('blog-updated', (data) => {
      setFeedItems(prev => prev.map(item => 
        item._id === data.blog._id ? data.blog : item
      ));
    });

    // Blog deleted
    socket.on('blog-deleted', (data) => {
      setFeedItems(prev => prev.filter(item => item._id !== data.blogId));
    });

    // Engagement updates
    socket.on('engagement-updated', (data) => {
      setFeedItems(prev => prev.map(item => {
        if (item._id === data.blogId) {
          const updatedItem = { ...item };
          switch (data.action) {
            case 'like':
              updatedItem.likeCount = (updatedItem.likeCount || 0) + 1;
              break;
            case 'comment':
              updatedItem.commentCount = (updatedItem.commentCount || 0) + 1;
              break;
            case 'share':
              updatedItem.shareCount = (updatedItem.shareCount || 0) + 1;
              break;
          }
          return updatedItem;
        }
        return item;
      }));
    });
  };

  const shouldShowInFeed = (blog) => {
    // Logic to determine if blog should appear in user's feed
    // Based on following, interests, etc.
    return true; // Simplified for now
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setNewContentCount(0);
    await loadFeedItems(true);
    setRefreshing(false);
  };

  const handleBlogClick = (blog) => {
    navigate(`/blogs/${blog._id}`);
  };

  const handleLoadNewContent = () => {
    setNewContentCount(0);
    loadFeedItems(true);
  };

  const renderFeedItem = (item, index) => {
    const isNew = index < newContentCount;
    
    return (
      <Zoom in={true} key={item._id} style={{ transitionDelay: `${index * 100}ms` }}>
        <FeedCard onClick={() => handleBlogClick(item)}>
          {isNew && (
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                right: 0,
                background: 'linear-gradient(135deg, #ff6b6b, #ee5a24)',
                color: 'white',
                padding: '4px 12px',
                borderRadius: '0 16px 0 16px',
                fontSize: '0.75rem',
                fontWeight: 600,
                zIndex: 10,
              }}
            >
              NEW
            </Box>
          )}
          
          <CardContent>
            {/* Author Info */}
            <Box display="flex" alignItems="center" gap={2} mb={2}>
              <Avatar
                src={item.user?.profile?.profilePicture}
                sx={{ width: 48, height: 48 }}
              >
                {item.user?.name?.charAt(0)}
              </Avatar>
              <Box flex={1}>
                <Typography variant="subtitle1" fontWeight={600}>
                  {item.user?.name}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="flex" alignItems="center" gap={0.5}>
                  <TimeIcon fontSize="small" />
                  {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                </Typography>
              </Box>
              <Chip
                label={item.category}
                size="small"
                color="primary"
                variant="outlined"
              />
            </Box>

            {/* Blog Content */}
            <Typography variant="h6" fontWeight={700} mb={2}>
              {item.title}
            </Typography>
            
            <Typography variant="body2" color="text.secondary" mb={2}>
              {item.description?.substring(0, 150)}...
            </Typography>

            {/* Blog Image */}
            {item.image && (
              <Box
                sx={{
                  width: '100%',
                  height: '200px',
                  borderRadius: 2,
                  overflow: 'hidden',
                  mb: 2,
                }}
              >
                <img
                  src={item.image}
                  alt={item.title}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
              </Box>
            )}

            {/* Tags */}
            {item.tags && item.tags.length > 0 && (
              <Box display="flex" gap={1} mb={2} flexWrap="wrap">
                {item.tags.slice(0, 3).map((tag, tagIndex) => (
                  <Chip
                    key={tagIndex}
                    label={`#${tag}`}
                    size="small"
                    variant="outlined"
                    sx={{ fontSize: '0.75rem' }}
                  />
                ))}
                {item.tags.length > 3 && (
                  <Chip
                    label={`+${item.tags.length - 3} more`}
                    size="small"
                    variant="outlined"
                    sx={{ fontSize: '0.75rem' }}
                  />
                )}
              </Box>
            )}

            <Divider sx={{ my: 2 }} />

            {/* Live Stats */}
            <LiveStats>
              <Tooltip title="Views">
                <Box display="flex" alignItems="center" gap={0.5}>
                  <ViewIcon fontSize="small" color="action" />
                  <Typography variant="caption" fontWeight={600}>
                    {item.views || 0}
                  </Typography>
                </Box>
              </Tooltip>

              <Tooltip title="Likes">
                <Box display="flex" alignItems="center" gap={0.5}>
                  <LikeIcon fontSize="small" color="error" />
                  <Typography variant="caption" fontWeight={600}>
                    {item.likeCount || 0}
                  </Typography>
                </Box>
              </Tooltip>

              <Tooltip title="Comments">
                <Box display="flex" alignItems="center" gap={0.5}>
                  <CommentIcon fontSize="small" color="primary" />
                  <Typography variant="caption" fontWeight={600}>
                    {item.commentCount || 0}
                  </Typography>
                </Box>
              </Tooltip>

              <Tooltip title="Shares">
                <Box display="flex" alignItems="center" gap={0.5}>
                  <ShareIcon fontSize="small" color="success" />
                  <Typography variant="caption" fontWeight={600}>
                    {item.shareCount || 0}
                  </Typography>
                </Box>
              </Tooltip>

              <Box sx={{ flexGrow: 1 }} />

              <Typography variant="caption" color="text.secondary">
                {item.readingTime || 1} min read
              </Typography>
            </LiveStats>
          </CardContent>
        </FeedCard>
      </Zoom>
    );
  };

  return (
    <FeedContainer>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight={700} display="flex" alignItems="center" gap={1}>
          📡 Live Content Feed
          {!isConnected && (
            <Chip label="Offline" color="error" size="small" />
          )}
        </Typography>
        
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={handleRefresh}
          disabled={refreshing}
        >
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </Box>

      {/* New Content Indicator */}
      {newContentCount > 0 && (
        <NewContentIndicator>
          <Button
            variant="text"
            startIcon={<NewIcon />}
            onClick={handleLoadNewContent}
            sx={{ color: 'white', fontWeight: 600 }}
          >
            {newContentCount} new post{newContentCount > 1 ? 's' : ''} available
          </Button>
        </NewContentIndicator>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Feed Items */}
      <Box>
        {feedItems.map((item, index) => renderFeedItem(item, index))}
        
        {/* Loading indicator */}
        {loading && (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        )}
        
        {/* End of feed indicator */}
        <div ref={feedEndRef} />
        
        {!hasMore && feedItems.length > 0 && (
          <Box textAlign="center" py={4}>
            <Typography variant="body2" color="text.secondary">
              You've reached the end of your feed
            </Typography>
          </Box>
        )}
        
        {feedItems.length === 0 && !loading && (
          <Box textAlign="center" py={8}>
            <TrendingIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" mb={2}>
              Your feed is empty
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={3}>
              Follow some authors or check out trending content to see posts here
            </Typography>
            <Button
              variant="contained"
              onClick={() => navigate('/blogs')}
              sx={{
                background: 'linear-gradient(135deg, #667eea, #764ba2)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #5a6fd8, #6a4190)',
                },
              }}
            >
              Explore Blogs
            </Button>
          </Box>
        )}
      </Box>
    </FeedContainer>
  );
};

export default LiveContentFeed;