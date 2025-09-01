import React, { Suspense, useState, useEffect } from 'react';
import { 
  TextField, 
  Typography, 
  Box, 
  Button, 
  Container,
  Paper,
  InputAdornment,
  IconButton,
  Alert,
  Divider,
  CircularProgress
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { 
  Email as EmailIcon,
  Lock as LockIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Login as LoginIcon,
  ArrowForward as ArrowForwardIcon
} from '@mui/icons-material';
import axios from 'axios';
import { useDispatch } from 'react-redux';
import { authActions } from './../store/index';
import { Link, useNavigate } from 'react-router-dom';
import { serverURL } from '../helper/Helper';
import Loading from './Loading';
import Swal from 'sweetalert2';

// Styled Components - Enhanced
const AuthContainer = styled(Container)(({ theme }) => ({
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: theme.spacing(2),
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
  backgroundSize: '200% 200%',
  animation: 'gradientShift 8s ease infinite',
  position: 'relative',
  overflow: 'hidden',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="0.03"%3E%3Ccircle cx="30" cy="30" r="2"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
    opacity: 0.4,
    animation: 'float 20s ease-in-out infinite',
  },
  '&::after': {
    content: '""',
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: '300px',
    height: '300px',
    background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)',
    transform: 'translate(-50%, -50%)',
    animation: 'pulse 6s ease-in-out infinite',
  },
}));

const AuthCard = styled(Paper)(({ theme }) => ({
  background: 'rgba(255, 255, 255, 0.95)',
  backdropFilter: 'blur(30px)',
  borderRadius: theme.spacing(4),
  boxShadow: '0 25px 50px rgba(0,0,0,0.15)',
  padding: theme.spacing(5),
  maxWidth: 500,
  width: '100%',
  border: '1px solid rgba(255, 255, 255, 0.3)',
  position: 'relative',
  overflow: 'hidden',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '5px',
    background: 'linear-gradient(90deg, #667eea, #764ba2, #f093fb)',
    backgroundSize: '200% 100%',
    animation: 'gradientShift 3s ease infinite',
  },
  '&::after': {
    content: '""',
    position: 'absolute',
    top: '50%',
    right: '-100px',
    width: '200px',
    height: '200px',
    background: 'radial-gradient(circle, rgba(102, 126, 234, 0.1) 0%, transparent 70%)',
    transform: 'translateY(-50%)',
    animation: 'float 15s ease-in-out infinite',
  },
}));

const AuthTitle = styled(Typography)(({ theme }) => ({
  fontSize: '3rem',
  fontWeight: 900,
  textAlign: 'center',
  marginBottom: theme.spacing(2),
  background: 'linear-gradient(135deg, #667eea, #764ba2)',
  backgroundClip: 'text',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  fontFamily: "'Outfit', sans-serif",
  letterSpacing: '-0.02em',
  [theme.breakpoints.down('sm')]: {
    fontSize: '2.5rem',
  },
}));

const AuthSubtitle = styled(Typography)(({ theme }) => ({
  textAlign: 'center',
  color: theme.palette.text.secondary,
  marginBottom: theme.spacing(5),
  fontSize: '1.125rem',
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  fontWeight: 500,
  lineHeight: 1.6,
}));

const StyledTextField = styled(TextField)(({ theme }) => ({
  marginBottom: theme.spacing(4),
  '& .MuiOutlinedInput-root': {
    borderRadius: theme.spacing(2.5),
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    border: '2px solid transparent',
    transition: 'all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    fontSize: '1.1rem',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    '&:hover': {
      backgroundColor: 'rgba(255, 255, 255, 1)',
      borderColor: 'rgba(102, 126, 234, 0.4)',
      transform: 'translateY(-2px)',
      boxShadow: '0 8px 25px rgba(102, 126, 234, 0.15)',
    },
    '&.Mui-focused': {
      backgroundColor: 'white',
      borderColor: '#667eea',
      boxShadow: '0 0 0 4px rgba(102, 126, 234, 0.15)',
      transform: 'scale(1.02)',
    },
  },
  '& .MuiInputLabel-root': {
    color: theme.palette.text.secondary,
    fontWeight: 600,
    fontSize: '1rem',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  },
  '& .MuiInputLabel-root.Mui-focused': {
    color: '#667eea',
    fontWeight: 700,
  },
}));

const LoginButton = styled(Button)(({ theme }) => ({
  background: 'linear-gradient(135deg, #667eea, #764ba2)',
  color: 'white',
  padding: theme.spacing(2, 5),
  borderRadius: theme.spacing(3),
  fontSize: '1.2rem',
  fontWeight: 700,
  textTransform: 'none',
  boxShadow: '0 12px 35px rgba(102, 126, 234, 0.4)',
  transition: 'all 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  width: '100%',
  marginBottom: theme.spacing(4),
  fontFamily: "'Outfit', sans-serif",
  position: 'relative',
  overflow: 'hidden',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: '-100%',
    width: '100%',
    height: '100%',
    background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent)',
    transition: 'left 0.8s ease',
  },
  '&:hover:not(:disabled)': {
    background: 'linear-gradient(135deg, #5a6fd8, #6a4190)',
    transform: 'translateY(-3px) scale(1.02)',
    boxShadow: '0 20px 40px rgba(102, 126, 234, 0.5)',
    '&::before': {
      left: '100%',
    },
  },
  '&:disabled': {
    background: theme.palette.grey[400],
    transform: 'none',
    boxShadow: 'none',
    cursor: 'not-allowed',
  },
}));

const SignupLinkButton = styled(Button)(({ theme }) => ({
  background: 'rgba(255, 255, 255, 0.1)',
  color: '#667eea',
  border: '2px solid #667eea',
  padding: theme.spacing(2, 5),
  borderRadius: theme.spacing(3),
  fontSize: '1.1rem',
  fontWeight: 700,
  textTransform: 'none',
  transition: 'all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  width: '100%',
  backdropFilter: 'blur(10px)',
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  '&:hover': {
    background: '#667eea',
    color: 'white',
    transform: 'translateY(-2px) scale(1.02)',
    boxShadow: '0 15px 35px rgba(102, 126, 234, 0.3)',
  },
}));

const Auth = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [input, setInput] = useState({
    email: "",
    password: ""
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Debug: Check if serverURL is defined
  useEffect(() => {
    console.log('Server URL:', serverURL);
    if (!serverURL) {
      setError('Server URL is not configured');
    }
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Normalize email input
    const normalizedValue = name === 'email' ? value.toLowerCase().trim() : value;
    
    setInput((prevState) => ({
      ...prevState,
      [name]: normalizedValue
    }));
    
    // Clear error when user starts typing
    if (error) setError("");
  };

  const handleTogglePassword = () => {
    setShowPassword(!showPassword);
  };

  const sendRequest = async (type = "login") => {
    try {
      // Validate serverURL
      if (!serverURL) {
        throw new Error('Server URL is not configured');
      }

      const url = `${serverURL}/api/user/${type}`;
      console.log('Making request to:', url);
      
      const requestData = {
        email: input.email.toLowerCase().trim(),
        password: input.password
      };
      
      console.log('Request data:', { ...requestData, password: '***' });

      const res = await axios.post(url, requestData, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 15000, // 15 second timeout
        validateStatus: function (status) {
          // Accept status codes less than 500 as successful
          return status < 500;
        }
      });

      console.log('Response status:', res.status);
      console.log('Response data:', res.data);

      // Handle different response statuses
      if (res.status >= 400) {
        throw new Error(res.data?.message || `Request failed with status ${res.status}`);
      }

      return res.data;
    } catch (err) {
      console.error('Request error:', err);
      
      let errorMessage = "Something went wrong";
      
      if (err.response) {
        // Server responded with error status
        console.error('Error response:', err.response.data);
        console.error('Error status:', err.response.status);
        errorMessage = err.response.data?.message || err.response.data?.error || `Server error: ${err.response.status}`;
      } else if (err.request) {
        // Request was made but no response received
        console.error('Network error - no response received');
        console.error('Request details:', err.request);
        errorMessage = "Cannot connect to server. Please check your internet connection.";
      } else if (err.code === 'ECONNABORTED') {
        // Request timeout
        errorMessage = "Request timeout. Please try again.";
      } else {
        // Something else happened
        console.error('Error details:', err);
        errorMessage = err.message || "An unexpected error occurred";
      }
      
      setError(errorMessage);
      throw err;
    }
  };

  const validateForm = () => {
    if (!input.email || !input.password) {
      setError("Please fill in all fields");
      return false;
    }

    if (!input.email.includes('@') || !input.email.includes('.')) {
      setError("Please enter a valid email address");
      return false;
    }

    if (input.password.length < 6) {
      setError("Password must be at least 6 characters long");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    console.log('Form submitted');
    console.log('Input values:', { email: input.email, hasPassword: !!input.password });
    
    // Clear any existing errors
    setError("");

    // Validate form
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      console.log('Attempting login...');
      const data = await sendRequest("login");
      
      console.log('Login response received:', data);
      
      // Check if we received the expected data structure
      if (!data) {
        throw new Error("No data received from server");
      }

      if (!data.user) {
        throw new Error("Invalid response: missing user data");
      }

      console.log('User data received:', data.user);

      // Store user data in localStorage
      try {
        localStorage.setItem("userId", data.user._id);
        console.log('User ID stored in localStorage:', data.user._id);
        
        // Store additional data if available
        if (data.token) {
          localStorage.setItem("token", data.token);
          console.log('Token stored in localStorage');
        }
        
        if (data.user.email) {
          localStorage.setItem("userEmail", data.user.email);
          console.log('Email stored in localStorage');
        }
      } catch (storageError) {
        console.error('Error storing in localStorage:', storageError);
        // Continue with login even if localStorage fails
      }

      // Update Redux store
      try {
        dispatch(authActions.login(data.user));
        console.log('Redux store updated with user data');
      } catch (reduxError) {
        console.error('Error updating Redux store:', reduxError);
        // Continue with login even if Redux fails
      }

      // Show success message
      await Swal.fire({
        icon: 'success',
        title: 'Welcome Back!',
        text: data.message || 'Login successful',
        timer: 2000,
        showConfirmButton: false,
        timerProgressBar: true
      });

      console.log('Navigating to /blogs');
      // Navigate to blogs page
      navigate("/blogs", { replace: true });
      
    } catch (err) {
      console.error('Login failed:', err);
      
      // Only show SweetAlert if we don't already have an error state
      if (!error) {
        await Swal.fire({
          icon: 'error',
          title: 'Login Failed',
          text: err.message || 'An error occurred during login',
          confirmButtonColor: '#667eea'
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Debug component mount
  useEffect(() => {
    console.log('Auth component mounted');
    console.log('Current serverURL:', serverURL);
    
    // Test server connectivity
    const testConnection = async () => {
      try {
        const response = await axios.get(`${serverURL}/api/health`, { timeout: 5000 });
        console.log('Server health check passed:', response.status);
      } catch (err) {
        console.warn('Server health check failed:', err.message);
      }
    };
    
    if (serverURL) {
      testConnection();
    }
  }, []);

  return (
    <AuthContainer maxWidth={false}>
      <Suspense fallback={<Loading />}>
        <AuthCard elevation={0} className="bounce-in">
          {/* Debug Info (remove in production) */}
          {/* {process.env.NODE_ENV === 'development' && (
            <Box mb={2} p={2} bgcolor="rgba(0,0,0,0.05)" borderRadius={2}>
              <Typography variant="caption" display="block">
                Server URL: {serverURL || 'Not configured'}
              </Typography>
              <Typography variant="caption" display="block">
                Form Values: {JSON.stringify({ email: input.email, hasPassword: !!input.password })}
              </Typography>
            </Box>
          )} */}

          {/* Header */}
          <Box textAlign="center" mb={5}>
            <AuthTitle variant="h1">
              Welcome Back
            </AuthTitle>
            <AuthSubtitle variant="body1">
              Sign in to your account to continue your blogging journey
            </AuthSubtitle>
          </Box>

          {/* Error Alert */}
          {error && (
            <Alert severity="error" sx={{ mb: 4, borderRadius: 3, fontFamily: "'Plus Jakarta Sans', sans-serif" }} className="slide-up">
              {error}
            </Alert>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} noValidate>
            <StyledTextField
              required
              name="email"
              type="email"
              onChange={handleChange}
              value={input.email}
              label="Email Address"
              placeholder="Enter your email address"
              fullWidth
              autoComplete="email"
              className="slide-up"
              error={error && error.includes('email')}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailIcon color="action" sx={{ fontSize: '1.5rem' }} />
                  </InputAdornment>
                ),
              }}
            />

            <StyledTextField
              required
              name="password"
              type={showPassword ? "text" : "password"}
              onChange={handleChange}
              value={input.password}
              label="Password"
              placeholder="Enter your password"
              fullWidth
              autoComplete="current-password"
              className="slide-up"
              error={error && error.includes('password')}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockIcon color="action" sx={{ fontSize: '1.5rem' }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={handleTogglePassword}
                      edge="end"
                      size="large"
                      tabIndex={-1}
                      sx={{ 
                        color: 'action.active',
                        '&:hover': { 
                          color: 'primary.main',
                          transform: 'scale(1.1)',
                        },
                        transition: 'all 0.3s ease',
                      }}
                    >
                      {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <LoginButton
              type="submit"
              variant="contained"
              disabled={isLoading || !serverURL}
              startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : <LoginIcon />}
              className="slide-up"
            >
              {isLoading ? "Signing In..." : "Sign In"}
            </LoginButton>
          </form>

          {/* Divider */}
          <Divider sx={{ my: 4 }} className="fade-in">
            <Typography variant="body2" color="text.secondary" fontFamily="'Plus Jakarta Sans', sans-serif" fontWeight="600">
              New to BLOGGY?
            </Typography>
          </Divider>

          {/* Signup Link */}
          <SignupLinkButton
            component={Link}
            to="/signup"
            startIcon={<ArrowForwardIcon />}
            className="slide-up"
          >
            Create New Account
          </SignupLinkButton>

          {/* Footer */}
          <Box mt={5} textAlign="center">
            <Typography variant="caption" color="text.secondary" fontFamily="'Plus Jakarta Sans', sans-serif" sx={{ opacity: 0.8 }}>
              By signing in, you agree to our Terms of Service and Privacy Policy
            </Typography>
          </Box>
        </AuthCard>
      </Suspense>
    </AuthContainer>
  );
};

export default Auth;