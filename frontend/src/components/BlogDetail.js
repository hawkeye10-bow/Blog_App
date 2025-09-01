import { 
  Box, 
  Button, 
  TextField, 
  Typography, 
  Container, 
  Paper,
  InputAdornment,
  Divider,
  Chip,
  Grid,
  Alert,
  CircularProgress,
  Avatar,
  Card,
  CardContent,
  LinearProgress,
  Fade,
  Zoom
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { 
  Edit as EditIcon,
  Title as TitleIcon,
  Description as DescriptionIcon,
  Save as SaveIcon,
  ArrowBack as ArrowBackIcon,
  Image as ImageIcon,
  CheckCircle as CheckCircleIcon,
  Person as PersonIcon,
  CalendarToday as CalendarIcon,
  Warning as WarningIcon,
  Preview as PreviewIcon
} from '@mui/icons-material';
import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useTypingIndicator } from '../hooks/useTypingIndicator';
import socketService from '../services/socketService';
import CollaborativeEditor from './RealTime/CollaborativeEditor';
import { useRealTimeFeatures } from '../hooks/useRealTimeFeatures';
import Swal from 'sweetalert2';
import { serverURL } from '../helper/Helper';

import 'sweetalert2/dist/sweetalert2.css';

// Styled Components - Enhanced
const EditContainer = styled(Container)(({ theme }) => ({
  padding: theme.spacing(4),
  background: 'linear-gradient(135deg, #f5f7fa, #e4e9f7)',
  minHeight: '100vh',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
}));

const EditCard = styled(Paper)(({ theme }) => ({
  background: 'rgba(255, 255, 255, 0.95)',
  backdropFilter: 'blur(30px)',
  borderRadius: theme.spacing(3),
  boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
  border: '1px solid rgba(255, 255, 255, 0.3)',
  padding: theme.spacing(4),
  width: '100%',
  maxWidth: '900px',
  position: 'relative',
  overflow: 'hidden',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '4px',
    background: 'linear-gradient(90deg, #667eea, #764ba2)',
  },
}));

const EditTitle = styled(Typography)(({ theme }) => ({
  fontSize: '2.5rem',
  fontWeight: 700,
  textAlign: 'center',
  marginBottom: theme.spacing(1),
  background: 'linear-gradient(135deg, #667eea, #764ba2)',
  backgroundClip: 'text',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
}));

const StyledTextField = styled(TextField)(({ theme }) => ({
  marginBottom: theme.spacing(3),
  '& .MuiOutlinedInput-root': {
    borderRadius: theme.spacing(2),
    backgroundColor: 'rgba(248, 250, 252, 0.8)',
    border: '2px solid transparent',
    transition: 'all 0.3s ease',
    '&:hover': {
      backgroundColor: 'rgba(248, 250, 252, 0.9)',
      borderColor: 'rgba(102, 126, 234, 0.3)',
    },
    '&.Mui-focused': {
      backgroundColor: 'white',
      borderColor: '#667eea',
      boxShadow: '0 0 0 3px rgba(102, 126, 234, 0.1)',
    },
  },
}));

const SubmitButton = styled(Button)(({ theme }) => ({
  background: 'linear-gradient(135deg, #667eea, #764ba2)',
  color: 'white',
  padding: theme.spacing(1.5, 4),
  borderRadius: theme.spacing(2),
  fontSize: '1.1rem',
  fontWeight: 600,
  textTransform: 'none',
  boxShadow: '0 8px 25px rgba(102, 126, 234, 0.3)',
  transition: 'all 0.3s ease',
  width: '100%',
  '&:hover': {
    background: 'linear-gradient(135deg, #5a6fd8, #6a4190)',
    transform: 'translateY(-2px)',
    boxShadow: '0 12px 35px rgba(102, 126, 234, 0.4)',
  },
  '&:disabled': {
    background: theme.palette.grey[400],
    transform: 'none',
    boxShadow: 'none',
  },
}));

const PreviewButton = styled(Button)(({ theme }) => ({
  background: 'rgba(255, 255, 255, 0.9)',
  color: '#667eea',
  border: '2px solid #667eea',
  padding: theme.spacing(1.5, 4),
  borderRadius: theme.spacing(2),
  fontSize: '1.1rem',
  fontWeight: 600,
  textTransform: 'none',
  transition: 'all 0.3s ease',
  width: '100%',
  '&:hover': {
    background: '#667eea',
    color: 'white',
    transform: 'translateY(-2px)',
    boxShadow: '0 8px 25px rgba(102, 126, 234, 0.3)',
  },
}));

const CharacterCount = styled(Typography)(({ theme }) => ({
  fontSize: '0.875rem',
  color: theme.palette.text.secondary,
  textAlign: 'right',
  marginTop: theme.spacing(1),
}));

const BlogDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const currentUser = useSelector(state => state.user);
  const { startTyping, stopTyping, trackEngagement } = useRealTimeFeatures(id);
  const [input, setInput] = useState({
    title: '',
    description: '',
    image: '',
  });
  const [blog, setBlog] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [imageValid, setImageValid] = useState(true);
  const [progress, setProgress] = useState(0);
  const [useCollaborativeEditor, setUseCollaborativeEditor] = useState(false);

  const { handleInputChange, cleanup } = useTypingIndicator('editing');

  // Connect to socket
  useEffect(() => {
    socketService.connect();
    return cleanup;
  }, [cleanup]);

  // Validate image URL
  useEffect(() => {
    if (input.image) {
      const img = new Image();
      img.onload = () => setImageValid(true);
      img.onerror = () => setImageValid(false);
      img.src = input.image;
    } else {
      setImageValid(true);
    }
  }, [input.image]);

  const handleChange = handleInputChange((e) => {
    setInput((prevState) => ({
      ...prevState,
      [e.target.name]: e.target.value,
    }));
    
    // Start typing indicator
    startTyping('editing');
    
    if (error) setError("");
  });

  const fetchDetails = async () => {
    try {
      const userId = localStorage.getItem("userId");
      if (!userId) {
        setError('User not authenticated');
        return null;
      }

      const res = await axios.get(`${serverURL}/api/blog/${id}`);
      const data = res.data;
      return data.blog;
    } catch (error) {
      console.error('Error fetching blog details:', error);
      setError('Failed to load blog details. Please try again.');
      return null;
    }
  };

  useEffect(() => {
    fetchDetails().then((data) => {
      if (data) {
        setBlog(data);
        setInput({
          title: data.title || '',
          description: data.description || '',
          image: data.image || '',
        });
        
        if (currentUser && data.user && currentUser._id !== data.user._id) {
          setError('You can only edit your own blogs');
        }
      } else {
        setError('Blog not found');
      }
      setIsLoading(false);
    });
  }, [id, currentUser]);

  const sendRequest = async () => {
    try {
      const userId = localStorage.getItem("userId");
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const res = await axios.put(`${serverURL}/api/blog/update/${id}`, {
        title: input.title,
        description: input.description,
        image: input.image,
      });
      return res.data;
    } catch (error) {
      console.error('Error updating blog:', error);
      const errorMessage = error.response?.data?.message || 'Failed to update blog';
      setError(errorMessage);
      throw error;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!input.title.trim()) {
      setError('Title is required');
      return;
    }
    if (input.title.trim().length < 3) {
      setError('Title must be at least 3 characters long');
      return;
    }
    if (!input.description.trim()) {
      setError('Description is required');
      return;
    }
    if (input.description.trim().length < 10) {
      setError('Description must be at least 10 characters long');
      return;
    }
    if (input.image && !imageValid) {
      setError('Please provide a valid image URL');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setProgress(0);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 200);

    try {
      await sendRequest();
      setProgress(100);
      
      // Track engagement
      trackEngagement('edit', id, {
        changes: {
          title: input.title !== blog?.title,
          description: input.description !== blog?.description,
          image: input.image !== blog?.image
        }
      });
      
      Swal.fire({
        icon: 'success',
        title: 'Blog Updated Successfully!',
        text: 'Your blog has been updated and saved.',
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(20px)',
        timer: 2000,
        showConfirmButton: false,
      }).then(() => navigate('/myblogs'));
    } catch (error) {
      setProgress(0);
      console.error('Error updating blog:', error);
    } finally {
      clearInterval(progressInterval);
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    navigate('/myblogs');
  };

  const handlePreview = () => {
    setShowPreview(!showPreview);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Date not available';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Date not available';
    }
  };

  const isFormValid = input.title.trim() && 
                     input.description.trim() && 
                     (!input.image || imageValid);

  const titleCharCount = input.title.length;
  const descriptionCharCount = input.description.length;
  const maxTitleLength = 200;
  const maxDescriptionLength = 5000;

  if (isLoading) {
    return (
      <EditContainer maxWidth={false}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
          <CircularProgress size={60} thickness={4} sx={{ color: 'primary.main' }} />
        </Box>
      </EditContainer>
    );
  }

  if (error && !blog) {
    return (
      <EditContainer maxWidth={false}>
        <Container maxWidth="md">
          <Box textAlign="center" py={8}>
            <Alert severity="error" sx={{ mb: 4, borderRadius: 3, fontSize: '1.1rem' }}>
              {error}
            </Alert>
            <Button 
              onClick={handleBack} 
              startIcon={<ArrowBackIcon />}
              variant="contained"
              sx={{
                background: 'linear-gradient(135deg, #667eea, #764ba2)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #5a6fd8, #6a4190)',
                },
              }}
            >
              Back to My Blogs
            </Button>
          </Box>
        </Container>
      </EditContainer>
    );
  }

  return (
    <EditContainer maxWidth={false}>
      <Container maxWidth="lg">
        <Fade in={true}>
          <EditCard elevation={0}>
            {/* Header */}
            <Box textAlign="center" mb={4}>
              <EditTitle variant="h1">
                Edit Your Blog
              </EditTitle>
              <Typography variant="body1" color="text.secondary" sx={{ fontSize: '1.1rem' }}>
                Update your blog post with new content and make it even better
              </Typography>
            </Box>

            {/* Back Button */}
            <Box display="flex" justifyContent="flex-start" mb={4}>
              <Button 
                onClick={handleBack} 
                startIcon={<ArrowBackIcon />}
                sx={{
                  background: 'linear-gradient(135deg, #667eea, #764ba2)',
                  color: 'white',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #5a6fd8, #6a4190)',
                  },
                  borderRadius: 2,
                  px: 3,
                  fontWeight: 600,
                }}
              >
                Back to My Blogs
              </Button>
            </Box>

            {/* Progress Bar */}
            {isSubmitting && (
              <Box mb={3}>
                <LinearProgress 
                  variant="determinate" 
                  value={progress} 
                  sx={{ 
                    borderRadius: 2, 
                    height: 8,
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    '& .MuiLinearProgress-bar': {
                      background: 'linear-gradient(90deg, #667eea, #764ba2)',
                    }
                  }} 
                />
                <Typography variant="body2" color="text.secondary" textAlign="center" mt={1}>
                  Updating your blog... {progress}%
                </Typography>
              </Box>
            )}

            {/* User Info Card */}
            {blog && blog.user && (
              <Zoom in={true}>
                <Card sx={{ 
                  mb: 4, 
                  background: 'rgba(255, 255, 255, 0.9)',
                  backdropFilter: 'blur(20px)',
                  borderRadius: 3,
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                }}>
                  <CardContent>
                    <Grid container spacing={3} alignItems="center">
                      <Grid item>
                        <Avatar sx={{ 
                          width: 60, 
                          height: 60, 
                          fontSize: '1.5rem',
                          fontWeight: 700,
                          background: 'linear-gradient(135deg, #667eea, #764ba2)',
                        }}>
                          {blog.user.name ? blog.user.name.charAt(0).toUpperCase() : 'U'}
                        </Avatar>
                      </Grid>
                      <Grid item xs>
                        <Typography variant="h6" fontWeight={700} color="primary" gutterBottom>
                          {blog.user.name || 'Unknown User'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" display="flex" alignItems="center" gap={1}>
                          <CalendarIcon fontSize="small" />
                          Created: {formatDate(blog.createdAt)}
                        </Typography>
                        {blog.updatedAt && blog.updatedAt !== blog.createdAt && (
                          <Typography variant="body2" color="text.secondary" display="flex" alignItems="center" gap={1}>
                            <EditIcon fontSize="small" />
                            Updated: {formatDate(blog.updatedAt)}
                          </Typography>
                        )}
                      </Grid>
                      <Grid item>
                        <Chip
                          icon={<PersonIcon />}
                          label="Blog Author"
                          color="primary"
                          variant="outlined"
                          sx={{ fontWeight: 600 }}
                        />
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Zoom>
            )}

            {/* Error Alert */}
            {error && (
              <Zoom in={true}>
                <Alert severity="error" sx={{ mb: 4, borderRadius: 3, fontSize: '1rem' }}>
                  {error}
                </Alert>
              </Zoom>
            )}

            {/* Edit Form */}
            {input && (
              <form onSubmit={handleSubmit}>
                <Grid container spacing={4}>
                  {/* Title Section */}
                  <Grid item xs={12}>
                    <Box>
                      <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <TitleIcon color="primary" />
                        Blog Title
                      </Typography>
                      <StyledTextField
                        name="title"
                        onChange={handleChange}
                        value={input.title}
                        placeholder="Enter your blog title"
                        fullWidth
                        required
                        error={titleCharCount > maxTitleLength}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <TitleIcon color="action" />
                            </InputAdornment>
                          ),
                        }}
                      />
                      <CharacterCount 
                        color={titleCharCount > maxTitleLength ? 'error' : 'textSecondary'}
                      >
                        {titleCharCount}/{maxTitleLength} characters
                      </CharacterCount>
                    </Box>
                  </Grid>

                  {/* Description Section */}
                  <Grid item xs={12}>
                    <Box>
                      <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <DescriptionIcon color="primary" />
                        Blog Content
                        <Button
                          size="small"
                          onClick={() => setUseCollaborativeEditor(!useCollaborativeEditor)}
                          variant="outlined"
                          sx={{ ml: 2 }}
                        >
                          {useCollaborativeEditor ? 'Simple Editor' : 'Collaborative Editor'}
                        </Button>
                      </Typography>
                      {useCollaborativeEditor ? (
                        <CollaborativeEditor
                          blogId={id}
                          initialContent={input.description}
                          onContentChange={(content) => setInput(prev => ({ ...prev, description: content }))}
                          onSave={async (content) => {
                            setInput(prev => ({ ...prev, description: content }));
                            await sendRequest();
                          }}
                          readOnly={false}
                        />
                      ) : (
                        <>
                          <StyledTextField
                            name="description"
                            onChange={handleChange}
                            value={input.description}
                            placeholder="Write your blog content here..."
                            fullWidth
                            required
                            multiline
                            rows={8}
                            error={descriptionCharCount > maxDescriptionLength}
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start" sx={{ alignSelf: 'flex-start', mt: 1 }}>
                                  <DescriptionIcon color="action" />
                                </InputAdornment>
                              ),
                            }}
                          />
                          <CharacterCount 
                            color={descriptionCharCount > maxDescriptionLength ? 'error' : 'textSecondary'}
                          >
                            {descriptionCharCount}/{maxDescriptionLength} characters
                          </CharacterCount>
                        </>
                      )}
                    </Box>
                  </Grid>

                  {/* Image URL Section */}
                  <Grid item xs={12}>
                    <Box>
                      <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <ImageIcon color="primary" />
                        Featured Image
                      </Typography>
                      <StyledTextField
                        name="image"
                        onChange={handleChange}
                        value={input.image}
                        placeholder="Enter image URL for your blog"
                        fullWidth
                        error={input.image && !imageValid}
                        helperText={input.image && !imageValid ? "Invalid image URL" : ""}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <ImageIcon color="action" />
                            </InputAdornment>
                          ),
                        }}
                      />
                      
                      {/* Image Preview */}
                      {input.image && imageValid && (
                        <Fade in={true}>
                          <Box mt={2} textAlign="center">
                            <img 
                              src={input.image} 
                              alt="Blog preview" 
                              style={{ 
                                maxWidth: '100%', 
                                maxHeight: '200px', 
                                borderRadius: '8px',
                                border: '2px solid #e0e0e0',
                                objectFit: 'contain'
                              }}
                              onError={() => setImageValid(false)}
                            />
                            <Typography variant="caption" color="success.main" sx={{ display: 'block', mt: 1 }}>
                              ✓ Image loaded successfully
                            </Typography>
                          </Box>
                        </Fade>
                      )}
                    </Box>
                  </Grid>

                  {/* Action Buttons */}
                  <Grid item xs={12}>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <PreviewButton
                          type="button"
                          onClick={handlePreview}
                          startIcon={<PreviewIcon />}
                          disabled={!isFormValid}
                        >
                          {showPreview ? 'Hide Preview' : 'Preview Changes'}
                        </PreviewButton>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <SubmitButton
                          type="submit"
                          disabled={isSubmitting || !isFormValid}
                          startIcon={isSubmitting ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                        >
                          {isSubmitting ? 'Updating...' : 'Update Blog'}
                        </SubmitButton>
                      </Grid>
                    </Grid>
                  </Grid>
                </Grid>

                {/* Blog Preview */}
                {showPreview && isFormValid && (
                  <Fade in={true}>
                    <Box mt={6} p={4} sx={{ 
                      background: 'rgba(102, 126, 234, 0.05)', 
                      borderRadius: 3,
                      border: '2px solid rgba(102, 126, 234, 0.1)'
                    }}>
                      <Typography variant="h5" color="primary" mb={3} fontWeight={700}>
                        📖 Updated Blog Preview
                      </Typography>
                      
                      {input.image && imageValid && (
                        <Box mb={3} textAlign="center">
                          <img
                            src={input.image}
                            alt="Preview"
                            style={{
                              maxWidth: '100%',
                              maxHeight: '300px',
                              borderRadius: '12px',
                              objectFit: 'contain'
                            }}
                          />
                        </Box>
                      )}
                      
                      <Typography variant="h4" fontWeight={700} mb={2}>
                        {input.title}
                      </Typography>
                      
                      <Typography variant="body1" sx={{ 
                        lineHeight: 1.8,
                        whiteSpace: 'pre-wrap',
                        color: 'text.secondary'
                      }}>
                        {input.description}
                      </Typography>
                      
                      <Box mt={3} display="flex" gap={1} flexWrap="wrap">
                        <Chip label={`By ${blog?.user?.name || 'You'}`} color="primary" variant="outlined" />
                        <Chip label="Updated" color="warning" variant="outlined" />
                        <Chip label={`${Math.ceil(input.description.split(' ').length / 200)} min read`} color="default" variant="outlined" />
                      </Box>
                    </Box>
                  </Fade>
                )}
              </form>
            )}
          </EditCard>
        </Fade>
      </Container>
    </EditContainer>
  );
};

export default BlogDetail;