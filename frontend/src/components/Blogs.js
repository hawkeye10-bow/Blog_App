import React, { useEffect, useState } from 'react';
import Blog from './Blog';
import { 
  Box, 
  Typography, 
  Container, 
  Grid, 
  Skeleton, 
  Card, 
  CardContent,
  Alert,
  Button,
  Pagination,
  Chip,
  Paper,
  Fade,
  Zoom
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { 
  Refresh as RefreshIcon,
  Article as ArticleIcon,
  TrendingUp as TrendingIcon,
  People as PeopleIcon,
  Today as TodayIcon
} from '@mui/icons-material';
import { useRealTimeBlogs } from '../hooks/useRealTimeBlogs';
import SearchBar from './SearchBar';
import RealTimeIndicator from './RealTimeIndicator';
import socketService from '../services/socketService';
import axios from 'axios';
import { serverURL } from '../helper/Helper';

// Styled Components
const BlogsContainer = styled(Container)(({ theme }) => ({
  padding: theme.spacing(4, 2),
  minHeight: 'calc(100vh - 80px)',
  background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
}));

const BlogsHeader = styled(Box)(({ theme }) => ({
  textAlign: 'center',
  marginBottom: theme.spacing(6),
  padding: theme.spacing(4, 0),
}));

const BlogsTitle = styled(Typography)(({ theme }) => ({
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

const BlogsSubtitle = styled(Typography)(({ theme }) => ({
  fontSize: '1.2rem',
  color: theme.palette.text.secondary,
  maxWidth: '600px',
  margin: '0 auto',
  lineHeight: 1.6,
  marginBottom: theme.spacing(4),
}));

const StatsContainer = styled(Paper)(({ theme }) => ({
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

const SkeletonCard = styled(Card)(({ theme }) => ({
  background: 'white',
  borderRadius: theme.spacing(2),
  boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
  overflow: 'hidden',
  maxWidth: '800px',
  margin: '0 auto',
  marginTop: theme.spacing(3),
}));

const EmptyState = styled(Box)(({ theme }) => ({
  textAlign: 'center',
  padding: theme.spacing(8, 2),
  background: 'white',
  borderRadius: theme.spacing(3),
  boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
  maxWidth: '600px',
  margin: '0 auto',
}));

const RefreshButton = styled(Button)(({ theme }) => ({
  background: 'linear-gradient(135deg, #667eea, #764ba2)',
  color: 'white',
  padding: theme.spacing(1.5, 3),
  borderRadius: theme.spacing(2),
  fontWeight: 600,
  textTransform: 'none',
  boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)',
  transition: 'all 0.3s ease',
  '&:hover': {
    background: 'linear-gradient(135deg, #5a6fd8, #6a4190)',
    transform: 'translateY(-2px)',
    boxShadow: '0 8px 25px rgba(102, 126, 234, 0.4)',
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

const Blogs = () => {
  const {
    blogs,
    loading,
    error,
    pagination,
    typingUsers,
    goToPage,
    refreshBlogs
  } = useRealTimeBlogs(1, 6);

  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [stats, setStats] = useState(null);

  // Fetch blog statistics
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await axios.get(`${serverURL}/api/blog/stats`);
        setStats(response.data.stats);
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    };

    fetchStats();
  }, [blogs]); // Refetch stats when blogs change

  // Handle search results
  const handleSearchResults = (results, query) => {
    setSearchResults(results);
    setIsSearching(!!query);
  };

  // Connect to socket for real-time updates
  useEffect(() => {
    socketService.connect();
    return () => {
      // Don't disconnect here as other components might be using it
    };
  }, []);

  // Render skeleton loading cards
  const renderSkeletons = () => {
    return Array.from({ length: 6 }).map((_, index) => (
      <Fade in={true} key={index} style={{ transitionDelay: `${index * 100}ms` }}>
        <SkeletonCard className="fade-in">
          <Box sx={{ position: 'relative' }}>
            <Skeleton 
              variant="rectangular" 
              height={300} 
              sx={{ 
                background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
                backgroundSize: '200% 100%',
                animation: 'loading 1.5s infinite',
              }} 
            />
            
            <Box sx={{ p: 3 }}>
              <Box display="flex" alignItems="center" mb={2}>
                <Skeleton variant="circular" width={56} height={56} />
                <Box sx={{ ml: 2, flexGrow: 1 }}>
                  <Skeleton variant="text" width="60%" height={32} />
                  <Skeleton variant="text" width="40%" height={24} />
                </Box>
              </Box>
              
              <Box mb={2}>
                <Skeleton variant="rectangular" width={120} height={32} sx={{ borderRadius: 16 }} />
              </Box>
              
              <Skeleton variant="text" width="100%" height={24} />
              <Skeleton variant="text" width="90%" height={24} />
              <Skeleton variant="text" width="80%" height={24} />
            </Box>
          </Box>
        </SkeletonCard>
      </Fade>
    ));
  };

  // Render empty state
  const renderEmptyState = () => (
    <Zoom in={true}>
      <EmptyState className="fade-in">
        <ArticleIcon sx={{ fontSize: 80, color: 'primary.main', mb: 3 }} />
        <Typography variant="h4" color="primary" mb={2} fontWeight={600}>
          {isSearching ? 'No Search Results' : 'No Blogs Available'}
        </Typography>
        <Typography variant="body1" color="text.secondary" mb={4} sx={{ maxWidth: '400px', mx: 'auto' }}>
          {isSearching 
            ? 'Try adjusting your search terms or browse all blogs below.'
            : 'Be the first to share your story with the community!'
          }
        </Typography>
        <RefreshButton
          onClick={refreshBlogs}
          startIcon={<RefreshIcon />}
        >
          {isSearching ? 'Show All Blogs' : 'Refresh'}
        </RefreshButton>
      </EmptyState>
    </Zoom>
  );

  // Render error state
  const renderErrorState = () => (
    <Zoom in={true}>
      <EmptyState className="fade-in">
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
          {error}
        </Alert>
        <RefreshButton
          onClick={refreshBlogs}
          startIcon={<RefreshIcon />}
        >
          Try Again
        </RefreshButton>
      </EmptyState>
    </Zoom>
  );

  const displayBlogs = isSearching ? searchResults : blogs;

  return (
    <BlogsContainer maxWidth="lg">
      {/* Real-time Indicator */}
      <RealTimeIndicator />

      {/* Header */}
      <BlogsHeader>
        <BlogsTitle variant="h1">
          Discover Amazing Stories
        </BlogsTitle>
        <BlogsSubtitle variant="h6">
          Explore a collection of inspiring blogs written by our community of creators
        </BlogsSubtitle>

        {/* Search Bar */}
        <Box mt={4}>
          <SearchBar onSearchResults={handleSearchResults} />
        </Box>

        {/* Statistics */}
        {stats && (
          <Fade in={true}>
            <StatsContainer>
              <Grid container spacing={3} justifyContent="center">
                <Grid item>
                  <StatChip
                    icon={<ArticleIcon />}
                    label={`${stats.totalBlogs} Total Blogs`}
                  />
                </Grid>
                <Grid item>
                  <StatChip
                    icon={<PeopleIcon />}
                    label={`${stats.totalUsers} Authors`}
                  />
                </Grid>
                <Grid item>
                  <StatChip
                    icon={<TodayIcon />}
                    label={`${stats.recentBlogs} Today`}
                  />
                </Grid>
                <Grid item>
                  <StatChip
                    icon={<TrendingIcon />}
                    label="Live Updates"
                  />
                </Grid>
              </Grid>
            </StatsContainer>
          </Fade>
        )}
      </BlogsHeader>

      {/* Content */}
      <Box>
        {loading ? (
          renderSkeletons()
        ) : error ? (
          renderErrorState()
        ) : displayBlogs && displayBlogs.length > 0 ? (
          <Box className="fade-in">
            {displayBlogs.map((blog, index) => (
              <Fade in={true} key={blog._id} style={{ transitionDelay: `${index * 100}ms` }}>
                <div>
                  <Blog
                    id={blog._id}
                    authorId={blog.user._id}
                    isUser={localStorage.getItem("userId") === blog.user._id}
                    title={blog.title}
                    description={blog.description}
                    imageURL={blog.image}
                    userName={blog.user.name}
                    createdAt={blog.createdAt}
                    views={blog.views}
                    likeCount={blog.likeCount}
                    commentCount={blog.commentCount}
                    readingTime={blog.readingTime}
                    likes={blog.likes || []}
                    comments={blog.comments || []}
                  />
                </div>
              </Fade>
            ))}

            {/* Pagination - only show for non-search results */}
            {!isSearching && pagination.totalPages > 1 && (
              <PaginationContainer>
                <Pagination
                  count={pagination.totalPages}
                  page={pagination.currentPage}
                  onChange={(event, page) => goToPage(page)}
                  color="primary"
                  size="large"
                  showFirstButton
                  showLastButton
                />
              </PaginationContainer>
            )}
          </Box>
        ) : (
          renderEmptyState()
        )}
      </Box>

      {/* Typing Indicators */}
      {typingUsers.size > 0 && (
        <Box position="fixed" bottom={20} left={20} zIndex={1000}>
          {Array.from(typingUsers.values()).map((typingUser, index) => (
            <Fade in={true} key={`${typingUser.userName}-${typingUser.timestamp}`}>
              <Chip
                label={`${typingUser.userName} is ${typingUser.action}...`}
                color="primary"
                variant="outlined"
                sx={{ 
                  mb: 1, 
                  display: 'block',
                  animation: 'pulse 2s ease-in-out infinite',
                  backgroundColor: 'rgba(255, 255, 255, 0.9)',
                  backdropFilter: 'blur(10px)',
                }}
              />
            </Fade>
          ))}
        </Box>
      )}
    </BlogsContainer>
  );
};

export default Blogs;