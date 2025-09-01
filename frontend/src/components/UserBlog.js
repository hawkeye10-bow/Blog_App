import React, { useEffect, useState } from 'react';
import Blog from './Blog';
import { serverURL } from '../helper/Helper';
import { 
  Box, 
  Typography, 
  Container, 
  CircularProgress, 
  Alert,
  Button,
  Paper,
  Grid,
  Chip,
  Pagination,
  Fade,
  Zoom
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { 
  Article as ArticleIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  TrendingUp as TrendingIcon,
  Visibility as VisibilityIcon,
  Favorite as FavoriteIcon
} from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import axios from 'axios';
import socketService from '../services/socketService';
import Swal from 'sweetalert2';

// Styled Components
const UserBlogContainer = styled(Container)(({ theme }) => ({
  padding: theme.spacing(4, 2),
  minHeight: 'calc(100vh - 80px)',
  background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
}));

const UserBlogHeader = styled(Box)(({ theme }) => ({
  textAlign: 'center',
  marginBottom: theme.spacing(6),
  padding: theme.spacing(4, 0),
}));

const UserBlogTitle = styled(Typography)(({ theme }) => ({
  fontSize: '3rem',
  fontWeight: 700,
  marginBottom: theme.spacing(2),
  background: 'linear-gradient(135deg, #667eea, #764ba2)',
  backgroundClip: 'text',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  [theme.breakpoints.down('sm')]: {
    fontSize: '2.5rem',
  },
}));

const StatsCard = styled(Paper)(({ theme }) => ({
  background: 'rgba(255, 255, 255, 0.9)',
  backdropFilter: 'blur(20px)',
  borderRadius: theme.spacing(3),
  padding: theme.spacing(3),
  marginBottom: theme.spacing(4),
  border: '1px solid rgba(255, 255, 255, 0.3)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
}));

const StatChip = styled(Chip)(({ theme }) => ({
  backgroundColor: 'rgba(102, 126, 234, 0.1)',
  color: '#667eea',
  fontWeight: 600,
  fontSize: '0.9rem',
  '& .MuiChip-icon': {
    color: '#667eea',
  },
}));

const EmptyState = styled(Paper)(({ theme }) => ({
  textAlign: 'center',
  padding: theme.spacing(8, 4),
  background: 'rgba(255, 255, 255, 0.95)',
  backdropFilter: 'blur(20px)',
  borderRadius: theme.spacing(3),
  boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
  border: '1px solid rgba(255, 255, 255, 0.3)',
  maxWidth: '600px',
  margin: '0 auto',
  marginTop: theme.spacing(4),
}));

const CreateBlogButton = styled(Button)(({ theme }) => ({
  background: 'linear-gradient(135deg, #667eea, #764ba2)',
  color: 'white',
  padding: theme.spacing(1.5, 4),
  borderRadius: theme.spacing(3),
  fontSize: '1.1rem',
  fontWeight: 700,
  textTransform: 'none',
  boxShadow: '0 8px 25px rgba(102, 126, 234, 0.3)',
  transition: 'all 0.3s ease',
  '&:hover': {
    background: 'linear-gradient(135deg, #5a6fd8, #6a4190)',
    transform: 'translateY(-2px)',
    boxShadow: '0 12px 35px rgba(102, 126, 234, 0.4)',
  },
}));

const PaginationContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'center',
  marginTop: theme.spacing(6),
  '& .MuiPagination-root': {
    '& .MuiPaginationItem-root': {
      borderRadius: theme.spacing(1.5),
      fontWeight: 600,
      '&.Mui-selected': {
        background: 'linear-gradient(135deg, #667eea, #764ba2)',
        color: 'white',
      },
    },
  },
}));

const UserBlog = () => {
  const user = useSelector(state => state.user);
  const [userBlogs, setUserBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 0,
    totalBlogs: 0,
    hasNext: false,
    hasPrev: false
  });
  
  const userId = localStorage.getItem("userId");

  const fetchUserBlogs = async (page = 1) => {
    try {
      setLoading(true);
      setError(null);
      
      const [blogsResponse, statsResponse] = await Promise.all([
        axios.get(`${serverURL}/api/blog/user/${userId}?page=${page}&limit=6`),
        axios.get(`${serverURL}/api/user/stats/${userId}`)
      ]);
      
      const { user: userData, pagination: paginationData } = blogsResponse.data;
      setUserBlogs(userData.blogs || []);
      setPagination(paginationData || {
        currentPage: page,
        totalPages: 0,
        totalBlogs: 0,
        hasNext: false,
        hasPrev: false
      });
      
      setStats(statsResponse.data.stats);
    } catch (err) {
      console.error('Error fetching user blogs:', err);
      setError('Failed to fetch your blogs. Please try again.');
      
      Swal.fire({
        icon: 'error',
        title: 'Error Loading Blogs',
        text: 'Unable to load your blogs. Please check your connection.',
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(20px)',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    fetchUserBlogs(pagination.currentPage);
  };

  const handlePageChange = (event, page) => {
    fetchUserBlogs(page);
  };

  // Real-time updates
  useEffect(() => {
    const socket = socketService.connect();

    const handleBlogCreated = (data) => {
      if (data.blog.user._id === userId) {
        setUserBlogs(prev => [data.blog, ...prev]);
        // Update stats
        setStats(prev => prev ? {
          ...prev,
          totalBlogs: prev.totalBlogs + 1
        } : null);
      }
    };

    const handleBlogUpdated = (data) => {
      if (data.blog.user._id === userId) {
        setUserBlogs(prev => 
          prev.map(blog => 
            blog._id === data.blog._id ? data.blog : blog
          )
        );
      }
    };

    const handleBlogDeleted = (data) => {
      setUserBlogs(prev => prev.filter(blog => blog._id !== data.blogId));
      // Update stats
      setStats(prev => prev ? {
        ...prev,
        totalBlogs: Math.max(0, prev.totalBlogs - 1)
      } : null);
    };

    socketService.onNewBlog(handleBlogCreated);
    socketService.onBlogUpdated(handleBlogUpdated);
    socketService.onBlogDeleted(handleBlogDeleted);

    return () => {
      socketService.removeAllListeners();
    };
  }, [userId]);

  useEffect(() => {
    if (userId) {
      fetchUserBlogs();
    }
  }, [userId]);

  if (loading) {
    return (
      <UserBlogContainer maxWidth="lg">
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
          <CircularProgress size={60} thickness={4} sx={{ color: 'primary.main' }} />
        </Box>
      </UserBlogContainer>
    );
  }

  if (error) {
    return (
      <UserBlogContainer maxWidth="lg">
        <Box textAlign="center" py={8}>
          <Alert severity="error" sx={{ mb: 4, borderRadius: 3, fontSize: '1.1rem' }}>
            {error}
          </Alert>
          <Button
            onClick={handleRetry}
            startIcon={<RefreshIcon />}
            variant="contained"
            sx={{
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              '&:hover': {
                background: 'linear-gradient(135deg, #5a6fd8, #6a4190)',
              },
            }}
          >
            Try Again
          </Button>
        </Box>
      </UserBlogContainer>
    );
  }

  return (
    <UserBlogContainer maxWidth="lg">
      {/* Header */}
      <UserBlogHeader>
        <UserBlogTitle variant="h1">
          My Blog Collection
        </UserBlogTitle>
        <Typography variant="h6" color="text.secondary" sx={{ maxWidth: '600px', mx: 'auto', lineHeight: 1.6 }}>
          Manage and showcase your personal blog posts
        </Typography>
      </UserBlogHeader>

      {/* Statistics */}
      {stats && (
        <Fade in={true}>
          <StatsCard>
            <Typography variant="h6" color="primary" mb={3} fontWeight={700}>
              📊 Your Blog Statistics
            </Typography>
            <Grid container spacing={3} justifyContent="center">
              <Grid item>
                <StatChip
                  icon={<ArticleIcon />}
                  label={`${stats.totalBlogs} Total Blogs`}
                />
              </Grid>
              <Grid item>
                <StatChip
                  icon={<VisibilityIcon />}
                  label={`${stats.totalViews || 0} Total Views`}
                />
              </Grid>
              <Grid item>
                <StatChip
                  icon={<FavoriteIcon />}
                  label={`${stats.totalLikes || 0} Total Likes`}
                />
              </Grid>
              <Grid item>
                <StatChip
                  icon={<TrendingIcon />}
                  label={`Member since ${new Date(stats.memberSince).getFullYear()}`}
                />
              </Grid>
            </Grid>
          </StatsCard>
        </Fade>
      )}

      {/* Content */}
      <Box>
        {userBlogs && userBlogs.length > 0 ? (
          <Box className="fade-in">
            {userBlogs.map((blog, index) => (
              <Fade in={true} key={blog._id} style={{ transitionDelay: `${index * 100}ms` }}>
                <div>
                  <Blog
                    id={blog._id}
                    isUser={true}
                    title={blog.title}
                    description={blog.description}
                    imageURL={blog.image}
                    userName={user?.name || 'You'}
                    createdAt={blog.createdAt}
                    views={blog.views}
                    likeCount={blog.likeCount}
                    commentCount={blog.commentCount}
                    readingTime={blog.readingTime}
                  />
                </div>
              </Fade>
            ))}

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <PaginationContainer>
                <Pagination
                  count={pagination.totalPages}
                  page={pagination.currentPage}
                  onChange={handlePageChange}
                  color="primary"
                  size="large"
                  showFirstButton
                  showLastButton
                />
              </PaginationContainer>
            )}
          </Box>
        ) : (
          <Zoom in={true}>
            <EmptyState className="fade-in">
              <ArticleIcon sx={{ fontSize: 80, color: 'primary.main', mb: 3 }} />
              <Typography variant="h4" color="primary" mb={2} fontWeight={600}>
                No Blogs Yet
              </Typography>
              <Typography variant="body1" color="text.secondary" mb={4} sx={{ maxWidth: '400px', mx: 'auto' }}>
                You haven't created any blog posts yet. Start sharing your thoughts and stories with the world!
              </Typography>
              <CreateBlogButton
                component={Link}
                to="/blogs/add"
                startIcon={<AddIcon />}
              >
                Create Your First Blog
              </CreateBlogButton>
            </EmptyState>
          </Zoom>
        )}
      </Box>
    </UserBlogContainer>
  );
};

export default UserBlog;