import React, { useState, useEffect } from 'react';
import {
  Container,
  Grid,
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  Avatar,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert
} from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  TrendingUp as TrendingIcon,
  People as PeopleIcon,
  Article as ArticleIcon,
  Visibility as ViewIcon,
  Favorite as LikeIcon,
  Comment as CommentIcon,
  Share as ShareIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  AdminPanelSettings as AdminIcon
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import axios from 'axios';
import { serverURL } from '../helper/Helper';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import LiveBlogStats from './RealTime/LiveBlogStats';
import LiveContentFeed from './RealTime/LiveContentFeed';
import { useRealTimeFeatures } from '../hooks/useRealTimeFeatures';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const DashboardContainer = styled(Container)(({ theme }) => ({
  padding: theme.spacing(4, 2),
  minHeight: 'calc(100vh - 80px)',
  background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
}));

const StatsCard = styled(Card)(({ theme }) => ({
  background: 'rgba(255, 255, 255, 0.95)',
  backdropFilter: 'blur(20px)',
  borderRadius: theme.spacing(3),
  boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
  border: '1px solid rgba(255, 255, 255, 0.3)',
  transition: 'all 0.3s ease',
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: '0 16px 40px rgba(0,0,0,0.15)',
  },
}));

const ChartCard = styled(Paper)(({ theme }) => ({
  background: 'rgba(255, 255, 255, 0.95)',
  backdropFilter: 'blur(20px)',
  borderRadius: theme.spacing(3),
  padding: theme.spacing(3),
  boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
  border: '1px solid rgba(255, 255, 255, 0.3)',
}));

const Dashboard = () => {
  const user = useSelector(state => state.user);
  const { realTimeData, isConnected } = useRealTimeFeatures();
  const [stats, setStats] = useState(null);
  const [blogStats, setBlogStats] = useState(null);
  const [userStats, setUserStats] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [recentBlogs, setRecentBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user && ['admin', 'author'].includes(user.role)) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      const requests = [
        axios.get(`${serverURL}/api/blog/stats`),
        axios.get(`${serverURL}/api/user/stats/${user._id}`),
        axios.get(`${serverURL}/api/user/online`),
        axios.get(`${serverURL}/api/blog?limit=5&sortBy=createdAt&sortOrder=desc`)
      ];

      if (user.role === 'admin') {
        requests.push(axios.get(`${serverURL}/api/user?limit=10`));
      }

      const responses = await Promise.all(requests);
      
      setStats(responses[0].data.stats);
      setUserStats(responses[1].data.stats);
      setOnlineUsers(responses[2].data.onlineUsers);
      setRecentBlogs(responses[3].data.blogs);
      
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  if (!user || !['admin', 'author'].includes(user.role)) {
    return (
      <DashboardContainer>
        <Alert severity="error">
          Access denied. Only authors and admins can access the dashboard.
        </Alert>
      </DashboardContainer>
    );
  }

  if (loading) {
    return (
      <DashboardContainer>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
          <LinearProgress sx={{ width: '300px' }} />
        </Box>
      </DashboardContainer>
    );
  }

  return (
    <DashboardContainer maxWidth="xl">
      {/* Header */}
      <Box mb={4}>
        <Typography variant="h3" fontWeight={700} color="primary" mb={1}>
          {user.role === 'admin' ? 'Admin Dashboard' : 'Author Dashboard'}
        </Typography>
        <Typography variant="h6" color="text.secondary">
          Welcome back, {user.name}! Here's your content overview.
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 4 }}>
          {error}
        </Alert>
      )}

      {/* Stats Overview */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <StatsCard>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Total Blogs
                  </Typography>
                  <Typography variant="h4" fontWeight={700}>
                    {formatNumber(userStats?.totalBlogs || 0)}
                  </Typography>
                </Box>
                <Avatar sx={{ backgroundColor: '#667eea' }}>
                  <ArticleIcon />
                </Avatar>
              </Box>
            </CardContent>
          </StatsCard>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatsCard>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Total Views
                  </Typography>
                  <Typography variant="h4" fontWeight={700}>
                    {formatNumber(userStats?.totalViews || 0)}
                  </Typography>
                </Box>
                <Avatar sx={{ backgroundColor: '#10b981' }}>
                  <ViewIcon />
                </Avatar>
              </Box>
            </CardContent>
          </StatsCard>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatsCard>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Total Likes
                  </Typography>
                  <Typography variant="h4" fontWeight={700}>
                    {formatNumber(userStats?.totalLikes || 0)}
                  </Typography>
                </Box>
                <Avatar sx={{ backgroundColor: '#ef4444' }}>
                  <LikeIcon />
                </Avatar>
              </Box>
            </CardContent>
          </StatsCard>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatsCard>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Engagement Rate
                  </Typography>
                  <Typography variant="h4" fontWeight={700}>
                    {userStats?.engagementRate || 0}%
                  </Typography>
                </Box>
                <Avatar sx={{ backgroundColor: '#f59e0b' }}>
                  <TrendingIcon />
                </Avatar>
              </Box>
            </CardContent>
          </StatsCard>
        </Grid>
      </Grid>

      {/* Charts and Analytics */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} md={6}>
          <ChartCard>
            <Typography variant="h6" fontWeight={700} mb={3}>
              Blog Performance Over Time
            </Typography>
            {/* Chart implementation would go here */}
            <Box height={300} display="flex" alignItems="center" justifyContent="center">
              <Typography color="text.secondary">
                Chart visualization coming soon...
              </Typography>
            </Box>
          </ChartCard>
        </Grid>

        <Grid item xs={12} md={6}>
          <ChartCard>
            <Typography variant="h6" fontWeight={700} mb={3}>
              Real-Time Activity
            </Typography>
            <Box height={300} overflow="auto">
              {realTimeData.recentActivity.length > 0 ? (
                realTimeData.recentActivity.slice(0, 10).map((activity, index) => (
                  <Box key={index} display="flex" alignItems="center" gap={2} mb={2}>
                    <Avatar sx={{ width: 32, height: 32 }}>
                      {activity.user?.name?.charAt(0) || '?'}
                    </Avatar>
                    <Box>
                      <Typography variant="body2">
                        {activity.user?.name || 'Someone'} {activity.type}d a blog
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                      </Typography>
                    </Box>
                  </Box>
                ))
              ) : (
                <Typography color="text.secondary" textAlign="center" mt={4}>
                  No recent activity
                </Typography>
              )}
            </Box>
          </ChartCard>
        </Grid>
      </Grid>

      {/* Recent Activity and Online Users */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
                        <IconButton size="small" color="error">
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </ChartCard>
        </Grid>

        <Grid item xs={12} md={4}>
          <ChartCard>
            <Typography variant="h6" fontWeight={700} mb={3}>
              Online Users ({onlineUsers.length})
            </Typography>
            <Box maxHeight={300} overflow="auto">
              {onlineUsers.map((onlineUser) => (
                <Box
                  key={onlineUser._id}
                  display="flex"
                  alignItems="center"
                  gap={2}
                  p={1}
                  borderRadius={2}
                  sx={{
                    '&:hover': {
                      backgroundColor: 'rgba(102, 126, 234, 0.05)',
                    },
                  }}
                >
                  <Avatar
                    src={onlineUser.profile?.profilePicture}
                    sx={{ width: 32, height: 32 }}
                  >
                    {onlineUser.name.charAt(0).toUpperCase()}
                  </Avatar>
                  <Box flex={1}>
                    <Typography variant="body2" fontWeight={600}>
                      {onlineUser.name}
                    </Typography>
                    <Chip
                      label={onlineUser.role}
                      size="small"
                      color="primary"
                      variant="outlined"
                      sx={{ fontSize: '0.7rem', height: '20px' }}
                    />
                  </Box>
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: '#10b981',
                    }}
                  />
                </Box>
              ))}
            </Box>
          </ChartCard>
        </Grid>
      </Grid>
    </DashboardContainer>
  );
};

export default Dashboard;