import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Avatar,
  AvatarGroup,
  LinearProgress,
  Grid,
  Paper,
  Tooltip,
  Badge,
  IconButton,
  Fade,
  Zoom
} from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  Visibility as ViewIcon,
  Favorite as LikeIcon,
  Comment as CommentIcon,
  Share as ShareIcon,
  TrendingUp as TrendingIcon,
  People as PeopleIcon,
  Timeline as TimelineIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useRealTimeBlogView } from '../../hooks/useRealTimeFeatures';
import { formatDistanceToNow } from 'date-fns';

const StatsContainer = styled(Paper)(({ theme }) => ({
  background: 'rgba(255, 255, 255, 0.95)',
  backdropFilter: 'blur(20px)',
  borderRadius: theme.spacing(3),
  padding: theme.spacing(3),
  border: '1px solid rgba(255, 255, 255, 0.3)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
  position: 'sticky',
  top: theme.spacing(2),
}));

const StatCard = styled(Card)(({ theme }) => ({
  background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1))',
  borderRadius: theme.spacing(2),
  border: '1px solid rgba(102, 126, 234, 0.2)',
  transition: 'all 0.3s ease',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: '0 8px 25px rgba(102, 126, 234, 0.2)',
  },
}));

const LiveIndicator = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  padding: theme.spacing(1, 2),
  backgroundColor: 'rgba(76, 175, 80, 0.1)',
  borderRadius: theme.spacing(2),
  border: '1px solid rgba(76, 175, 80, 0.3)',
  '&::before': {
    content: '""',
    width: 8,
    height: 8,
    borderRadius: '50%',
    backgroundColor: '#4caf50',
    animation: 'pulse 2s ease-in-out infinite',
  },
}));

const ViewerAvatar = styled(Avatar)(({ theme }) => ({
  width: 32,
  height: 32,
  border: '2px solid white',
  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
  '&:hover': {
    transform: 'scale(1.1)',
    zIndex: 10,
  },
}));

const ActivityItem = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
  padding: theme.spacing(1.5),
  borderRadius: theme.spacing(1.5),
  backgroundColor: 'rgba(248, 250, 252, 0.8)',
  marginBottom: theme.spacing(1),
  transition: 'all 0.2s ease',
  '&:hover': {
    backgroundColor: 'rgba(102, 126, 234, 0.05)',
    transform: 'translateX(4px)',
  },
}));

const LiveBlogStats = ({ blogId, showViewers = true, showActivity = true, compact = false }) => {
  const { currentViewers, liveStats, trackEngagement } = useRealTimeBlogView(blogId);
  const [recentActivity, setRecentActivity] = useState([]);
  const [activeViewers, setActiveViewers] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  // Listen for real-time updates
  useEffect(() => {
    const handleAnalyticsUpdate = (event) => {
      const data = event.detail;
      if (data.blogId === blogId) {
        setRecentActivity(data.recentActivity || []);
      }
    };

    const handleBlogViewUpdate = (event) => {
      const data = event.detail;
      if (data.blogId === blogId) {
        setActiveViewers(data.activeViewers || []);
      }
    };

    window.addEventListener('analytics-update', handleAnalyticsUpdate);
    window.addEventListener('blog-view-update', handleBlogViewUpdate);

    return () => {
      window.removeEventListener('analytics-update', handleAnalyticsUpdate);
      window.removeEventListener('blog-view-update', handleBlogViewUpdate);
    };
  }, [blogId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // Refresh real-time data
      const stats = await fetch(`/api/realtime/blog/${blogId}/stats`);
      const data = await stats.json();
      
      if (data.stats) {
        setRecentActivity(data.stats.recentActivity || []);
        setActiveViewers(data.stats.currentViewers || []);
      }
    } catch (error) {
      console.error('Error refreshing stats:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const getActionIcon = (action) => {
    switch (action) {
      case 'like': return <LikeIcon color="error" fontSize="small" />;
      case 'comment': return <CommentIcon color="primary" fontSize="small" />;
      case 'share': return <ShareIcon color="success" fontSize="small" />;
      case 'view': return <ViewIcon color="info" fontSize="small" />;
      default: return <TrendingIcon color="action" fontSize="small" />;
    }
  };

  const getActionColor = (action) => {
    switch (action) {
      case 'like': return 'error';
      case 'comment': return 'primary';
      case 'share': return 'success';
      case 'view': return 'info';
      default: return 'default';
    }
  };

  if (compact) {
    return (
      <Box display="flex" alignItems="center" gap={2}>
        <LiveIndicator>
          <Typography variant="caption" fontWeight={600}>
            LIVE
          </Typography>
        </LiveIndicator>
        
        <Chip
          icon={<PeopleIcon />}
          label={`${currentViewers} viewing`}
          size="small"
          color="primary"
          variant="outlined"
        />
        
        <Chip
          icon={<ViewIcon />}
          label={liveStats.views}
          size="small"
          variant="outlined"
        />
        
        <Chip
          icon={<LikeIcon />}
          label={liveStats.likes}
          size="small"
          variant="outlined"
        />
      </Box>
    );
  }

  return (
    <StatsContainer>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center" gap={2}>
          <LiveIndicator>
            <Typography variant="body2" fontWeight={600}>
              LIVE STATS
            </Typography>
          </LiveIndicator>
          <IconButton 
            size="small" 
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshIcon sx={{ 
              animation: refreshing ? 'spin 1s linear infinite' : 'none',
              '@keyframes spin': {
                '0%': { transform: 'rotate(0deg)' },
                '100%': { transform: 'rotate(360deg)' }
              }
            }} />
          </IconButton>
        </Box>
      </Box>

      {/* Live Statistics */}
      <Grid container spacing={2} mb={3}>
        <Grid item xs={6} sm={3}>
          <StatCard>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box display="flex" alignItems="center" gap={1}>
                <ViewIcon color="primary" />
                <Box>
                  <Typography variant="h6" fontWeight={700}>
                    {liveStats.views}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Views
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </StatCard>
        </Grid>

        <Grid item xs={6} sm={3}>
          <StatCard>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box display="flex" alignItems="center" gap={1}>
                <LikeIcon color="error" />
                <Box>
                  <Typography variant="h6" fontWeight={700}>
                    {liveStats.likes}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Likes
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </StatCard>
        </Grid>

        <Grid item xs={6} sm={3}>
          <StatCard>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box display="flex" alignItems="center" gap={1}>
                <CommentIcon color="primary" />
                <Box>
                  <Typography variant="h6" fontWeight={700}>
                    {liveStats.comments}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Comments
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </StatCard>
        </Grid>

        <Grid item xs={6} sm={3}>
          <StatCard>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box display="flex" alignItems="center" gap={1}>
                <PeopleIcon color="success" />
                <Box>
                  <Typography variant="h6" fontWeight={700}>
                    {currentViewers}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Live Viewers
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </StatCard>
        </Grid>
      </Grid>

      {/* Active Viewers */}
      {showViewers && activeViewers.length > 0 && (
        <Fade in={true}>
          <Box mb={3}>
            <Typography variant="subtitle2" fontWeight={600} mb={2}>
              Currently Reading ({activeViewers.length})
            </Typography>
            <AvatarGroup max={8} sx={{ justifyContent: 'flex-start' }}>
              {activeViewers.map((viewer, index) => (
                <Tooltip 
                  key={viewer.user?._id || index}
                  title={`${viewer.user?.name || 'Anonymous'} - ${formatDistanceToNow(new Date(viewer.joinedAt), { addSuffix: true })}`}
                >
                  <ViewerAvatar
                    src={viewer.user?.profile?.profilePicture}
                    sx={{ 
                      animation: `fadeIn 0.5s ease ${index * 0.1}s both`,
                      '@keyframes fadeIn': {
                        from: { opacity: 0, transform: 'scale(0.8)' },
                        to: { opacity: 1, transform: 'scale(1)' }
                      }
                    }}
                  >
                    {viewer.user?.name?.charAt(0) || '?'}
                  </ViewerAvatar>
                </Tooltip>
              ))}
            </AvatarGroup>
          </Box>
        </Fade>
      )}

      {/* Recent Activity */}
      {showActivity && (
        <Box>
          <Typography variant="subtitle2" fontWeight={600} mb={2} display="flex" alignItems="center" gap={1}>
            <TimelineIcon fontSize="small" />
            Recent Activity
          </Typography>
          
          {recentActivity.length > 0 ? (
            <Box maxHeight={200} overflow="auto">
              {recentActivity.slice(0, 10).map((activity, index) => (
                <Zoom in={true} key={index} style={{ transitionDelay: `${index * 50}ms` }}>
                  <ActivityItem>
                    <Avatar
                      src={activity.user?.profile?.profilePicture}
                      sx={{ width: 24, height: 24 }}
                    >
                      {activity.user?.name?.charAt(0) || '?'}
                    </Avatar>
                    
                    <Box flex={1}>
                      <Typography variant="body2">
                        <strong>{activity.user?.name || 'Someone'}</strong> {activity.type}d this blog
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                      </Typography>
                    </Box>
                    
                    <Chip
                      icon={getActionIcon(activity.type)}
                      label={activity.type}
                      size="small"
                      color={getActionColor(activity.type)}
                      variant="outlined"
                    />
                  </ActivityItem>
                </Zoom>
              ))}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
              No recent activity
            </Typography>
          )}
        </Box>
      )}
    </StatsContainer>
  );
};

export default LiveBlogStats;