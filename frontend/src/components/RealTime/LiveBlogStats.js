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
  Zoom,
  CircularProgress,
  Alert
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
  Refresh as RefreshIcon,
  AccessTime as TimeIcon,
  MouseIcon,
  TouchApp as InteractionIcon
} from '@mui/icons-material';
import { useRealTimeBlogView } from '../../hooks/useRealTimeFeatures';
import { formatDistanceToNow } from 'date-fns';
import socketService from '../../services/socketService';

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
  const { currentViewers, liveStats, timeOnPage, scrollDepth, interactions, trackEngagement } = useRealTimeBlogView(blogId);
  const [recentActivity, setRecentActivity] = useState([]);
  const [activeViewers, setActiveViewers] = useState([]);
  const [detailedStats, setDetailedStats] = useState({
    averageTimeOnPage: 0,
    averageScrollDepth: 0,
    bounceRate: 0,
    engagementRate: 0
  });
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Setup real-time listeners
  useEffect(() => {
    if (!blogId) return;

    const socket = socketService.connect();
    
    // Join analytics room for this blog
    socketService.joinAnalyticsRoom(blogId);

    // Listen for viewer updates
    const handleViewerJoined = (data) => {
      if (data.blogId === blogId) {
        console.log(`👁️ Viewer joined blog ${blogId}:`, data);
        setActiveViewers(prev => {
          const existing = prev.find(v => v.userId === data.userId);
          if (!existing) {
            return [...prev, {
              userId: data.userId,
              userName: data.userName,
              joinedAt: data.timestamp,
              lastActivity: data.timestamp
            }];
          }
          return prev;
        });
      }
    };

    const handleViewerLeft = (data) => {
      if (data.blogId === blogId) {
        console.log(`👁️ Viewer left blog ${blogId}:`, data);
        setActiveViewers(prev => prev.filter(v => v.userId !== data.userId));
      }
    };

    const handleCurrentViewers = (data) => {
      if (data.blogId === blogId) {
        console.log(`👁️ Current viewers for blog ${blogId}:`, data);
        setActiveViewers(data.viewers.map(userId => ({
          userId,
          userName: `User ${userId}`, // This would be populated from user data
          joinedAt: new Date(),
          lastActivity: new Date()
        })));
      }
    };

    const handleAnalyticsUpdate = (data) => {
      if (data.blogId === blogId) {
        console.log(`📊 Analytics update for blog ${blogId}:`, data);
        setRecentActivity(prev => {
          const newActivity = {
            type: data.event || data.action,
            user: {
              _id: data.userId,
              name: data.userName || 'Anonymous'
            },
            timestamp: data.timestamp,
            metadata: data.metadata
          };
          
          return [newActivity, ...prev.slice(0, 19)];
        });
      }
    };

    const handleDetailedAnalyticsUpdate = (data) => {
      if (data.blogId === blogId) {
        console.log(`📊 Detailed analytics update for blog ${blogId}:`, data);
        setDetailedStats({
          averageTimeOnPage: data.averageReadingTime || 0,
          averageScrollDepth: data.averageScrollDepth || 0,
          bounceRate: data.bounceRate || 0,
          engagementRate: data.engagementRate || 0
        });
      }
    };

    // Register event listeners
    socketService.addEventListener('viewer-joined', handleViewerJoined);
    socketService.addEventListener('viewer-left', handleViewerLeft);
    socketService.addEventListener('current-viewers', handleCurrentViewers);
    socketService.addEventListener('analytics-updated', handleAnalyticsUpdate);
    socketService.addEventListener('detailed-analytics-updated', handleDetailedAnalyticsUpdate);
    socketService.addEventListener('engagement-updated', handleAnalyticsUpdate);

    return () => {
      socketService.leaveAnalyticsRoom(blogId);
      socketService.removeEventListener('viewer-joined', handleViewerJoined);
      socketService.removeEventListener('viewer-left', handleViewerLeft);
      socketService.removeEventListener('current-viewers', handleCurrentViewers);
      socketService.removeEventListener('analytics-updated', handleAnalyticsUpdate);
      socketService.removeEventListener('detailed-analytics-updated', handleDetailedAnalyticsUpdate);
      socketService.removeEventListener('engagement-updated', handleAnalyticsUpdate);
    };
  }, [blogId]);

  // Fetch initial analytics data
  useEffect(() => {
    if (blogId) {
      fetchInitialData();
    }
  }, [blogId]);

  const fetchInitialData = async () => {
    try {
      const response = await fetch(`/api/realtime/blog/${blogId}/stats`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const stats = data.stats;
        
        setActiveViewers(stats.activeViewers || []);
        setRecentActivity(stats.recentActivity || []);
        setDetailedStats({
          averageTimeOnPage: stats.averageReadingTime || 0,
          averageScrollDepth: stats.averageScrollDepth || 0,
          bounceRate: stats.bounceRate || 0,
          engagementRate: stats.engagementRate || 0
        });
      } else {
        setError('Failed to load analytics data');
      }
    } catch (error) {
      console.error('Error fetching initial analytics:', error);
      setError('Failed to load analytics data');
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setError(null);
    
    try {
      await fetchInitialData();
    } catch (error) {
      console.error('Error refreshing stats:', error);
      setError('Failed to refresh data');
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
          label={`${activeViewers.length} viewing`}
          size="small"
          color="primary"
          variant="outlined"
        />
        
        <Chip
          icon={<TimeIcon />}
          label={`${Math.floor(timeOnPage / 60)}:${(timeOnPage % 60).toString().padStart(2, '0')}`}
          size="small"
          variant="outlined"
          title="Your time on page"
        />
        
        <Chip
          icon={<InteractionIcon />}
          label={`${scrollDepth}%`}
          size="small"
          variant="outlined"
          title="Your scroll depth"
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
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      
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
            title="Refresh analytics data"
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

      {/* Personal Stats (for current user) */}
      <Box mb={3} p={2} bgcolor="rgba(102, 126, 234, 0.05)" borderRadius={2}>
        <Typography variant="subtitle2" fontWeight={600} mb={2} color="primary">
          📊 Your Session Stats
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={6}>
            <Box display="flex" alignItems="center" gap={1}>
              <TimeIcon fontSize="small" />
              <Typography variant="body2">
                Time: {Math.floor(timeOnPage / 60)}:{(timeOnPage % 60).toString().padStart(2, '0')}
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={6}>
            <Box display="flex" alignItems="center" gap={1}>
              <MouseIcon fontSize="small" />
              <Typography variant="body2">
                Scroll: {scrollDepth}%
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={6}>
            <Box display="flex" alignItems="center" gap={1}>
              <InteractionIcon fontSize="small" />
              <Typography variant="body2">
                Interactions: {interactions}
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={6}>
            <Box display="flex" alignItems="center" gap={1}>
              <TrendingIcon fontSize="small" />
              <Typography variant="body2">
                Engagement: Active
              </Typography>
            </Box>
          </Grid>
        </Grid>
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
                    {activeViewers.length}
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

      {/* Detailed Analytics */}
      <Box mb={3}>
        <Typography variant="subtitle2" fontWeight={600} mb={2}>
          📈 Performance Metrics
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={6}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Avg. Reading Time
              </Typography>
              <LinearProgress
                variant="determinate"
                value={Math.min((detailedStats.averageTimeOnPage / 300) * 100, 100)} // Max 5 minutes
                sx={{ mt: 1, height: 6, borderRadius: 3 }}
              />
              <Typography variant="caption">
                {Math.floor(detailedStats.averageTimeOnPage / 60)}:{(detailedStats.averageTimeOnPage % 60).toString().padStart(2, '0')}
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={6}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Engagement Rate
              </Typography>
              <LinearProgress
                variant="determinate"
                value={detailedStats.engagementRate}
                sx={{ mt: 1, height: 6, borderRadius: 3 }}
                color="success"
              />
              <Typography variant="caption">
                {detailedStats.engagementRate.toFixed(1)}%
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Box>

      {/* Active Viewers */}
      {showViewers && activeViewers.length > 0 && (
        <Fade in={true}>
          <Box mb={3}>
            <Typography variant="subtitle2" fontWeight={600} mb={2}>
              👁️ Currently Reading ({activeViewers.length})
            </Typography>
            <AvatarGroup max={8} sx={{ justifyContent: 'flex-start' }}>
              {activeViewers.map((viewer, index) => (
                <Tooltip 
                  key={viewer.userId || index}
                  title={`${viewer.userName || 'Anonymous'} - ${formatDistanceToNow(new Date(viewer.joinedAt), { addSuffix: true })}`}
                >
                  <ViewerAvatar
                    src={viewer.profilePicture}
                    sx={{ 
                      animation: `fadeIn 0.5s ease ${index * 0.1}s both`,
                      '@keyframes fadeIn': {
                        from: { opacity: 0, transform: 'scale(0.8)' },
                        to: { opacity: 1, transform: 'scale(1)' }
                      }
                    }}
                  >
                    {viewer.userName?.charAt(0) || '?'}
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
            ⚡ Live Activity
          </Typography>
          
          {recentActivity.length > 0 ? (
            <Box maxHeight={250} overflow="auto">
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
                        <strong>{activity.user?.name || 'Someone'}</strong> {activity.type === 'view' ? 'viewed' : `${activity.type}d`} this blog
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                        {activity.metadata?.timeOnPage && (
                          ` • ${Math.floor(activity.metadata.timeOnPage / 60)}:${(activity.metadata.timeOnPage % 60).toString().padStart(2, '0')} read time`
                        )}
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
              No recent activity - be the first to engage!
            </Typography>
          )}
        </Box>
      )}
    </StatsContainer>
  );
};

export default LiveBlogStats;