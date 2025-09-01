import React, { useEffect, useState } from 'react';
import Header from './components/Header.js';
import { Routes, Route, Navigate } from 'react-router-dom';
import Auth from './components/Auth.js';
import Blogs from './components/Blogs.js';
import UserBlog from './components/UserBlog.js';
import AddBlog from './components/AddBlog.js';
import BlogDetail from './components/BlogDetail.js';
import { useDispatch, useSelector } from 'react-redux';
import { authActions } from './store/index.js';
import Signup from './components/Signup.js';
import First from './components/First.js';
import UserInfo from './components/UserInfo.js';
import Loading from './components/Loading.js';
import socketService from './services/socketService.js';
import pwaService from './services/pwaService.js';
import Dashboard from './components/Dashboard.js';
import ProfileEdit from './components/Profile/ProfileEdit.js';
import AdminDashboard from './components/Admin/AdminDashboard.js';
import AnalyticsDashboard from './components/AnalyticsDashboard.js';
import MediaManager from './components/MediaManager.js';
import Chat from './components/Chat.js';
import { Snackbar, Alert } from '@mui/material';
import axios from 'axios';
import { serverURL } from './helper/Helper.js';

// Import the enhanced CSS
import './App.css';

// Protected Route Component - Enhanced
const ProtectedRoute = ({ children, isLoggedIn, isLoading, isInitialized }) => {
  if (isLoading || !isInitialized) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '60vh' 
      }}>
        <Loading message="Checking authentication..." />
      </div>
    );
  }
  
  if (!isLoggedIn) {
    return <Navigate to="/" replace />;
  }
  
  return children;
};

const App = () => {
  const dispatch = useDispatch();
  const { isLoggedIn, isLoading, isInitialized, user } = useSelector(state => ({
    isLoggedIn: state.isLoggedIn,
    isLoading: state.isLoading,
    isInitialized: state.isInitialized,
    user: state.user
  }));

  const [notification, setNotification] = useState({ open: false, message: '', severity: 'info' });

  // Enhanced authentication check
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const userId = localStorage.getItem("userId");
        if (userId) {
          dispatch(authActions.setLoading(true));
          
          // Verify user with backend
          try {
            const response = await axios.get(`${serverURL}/api/user/${userId}`);
            const userData = response.data.user;
            
            if (userData) {
              dispatch(authActions.login(userData));
              
              // Connect to socket and join user room
              const socket = socketService.connect();
              socketService.joinUserRoom(userId);
            } else {
              throw new Error('User data not found');
            }
          } catch (error) {
            console.error('Error verifying user:', error);
            localStorage.removeItem("userId");
            dispatch(authActions.logout());
          }
        } else {
          dispatch(authActions.setLoading(false));
          dispatch(authActions.setInitialized(true));
        }
      } catch (error) {
        console.error('Error checking auth status:', error);
        localStorage.removeItem("userId");
        dispatch(authActions.logout());
      }
    };

    checkAuthStatus();
  }, [dispatch]);

  // PWA registration
  useEffect(() => {
    pwaService.register();
  }, []);

  // Real-time notifications
  useEffect(() => {
    if (isLoggedIn && user) {
      const socket = socketService.connect();

      // User-specific notifications
      const handleUserNotification = (data) => {
        setNotification({
          open: true,
          message: data.message,
          severity: 'success'
        });
      };

      const handleBlogCreated = (data) => {
        if (data.blog.user._id === user._id) {
          setNotification({
            open: true,
            message: 'Your blog has been published successfully!',
            severity: 'success'
          });
        }
      };

      const handleBlogUpdated = (data) => {
        if (data.blog.user._id === user._id) {
          setNotification({
            open: true,
            message: 'Your blog has been updated successfully!',
            severity: 'success'
          });
        }
      };

      const handleBlogDeleted = (data) => {
        setNotification({
          open: true,
          message: 'Blog has been deleted successfully!',
          severity: 'info'
        });
      };

      // Register event listeners
      socketService.onUserLoggedIn(handleUserNotification);
      socketService.onNewBlog(handleBlogCreated);
      socketService.onBlogUpdated(handleBlogUpdated);
      socketService.onBlogDeleted(handleBlogDeleted);

      return () => {
        socketService.removeAllListeners();
      };
    }
  }, [isLoggedIn, user]);

  // Cleanup socket on unmount
  useEffect(() => {
    return () => {
      socketService.disconnect();
    };
  }, []);

  const handleCloseNotification = () => {
    setNotification({ ...notification, open: false });
  };

  return (
    <div className="app">
      <Header />
      <main className="main-content" style={{ marginTop: '80px' }}>
        <Routes>
          {/* Public Routes */}
          <Route path='/' element={<First />} />
          <Route path='/auth' element={<Auth />} />
          <Route path='/signup' element={<Signup />} />
          
          {/* Protected Routes */}
          <Route path='/blogs' element={
            <ProtectedRoute isLoggedIn={isLoggedIn} isLoading={isLoading} isInitialized={isInitialized}>
              <Blogs />
            </ProtectedRoute>
          } />
          <Route path='/blogs/add' element={
            <ProtectedRoute isLoggedIn={isLoggedIn} isLoading={isLoading} isInitialized={isInitialized}>
              <AddBlog />
            </ProtectedRoute>
          } />
          <Route path='/myBlogs' element={
            <ProtectedRoute isLoggedIn={isLoggedIn} isLoading={isLoading} isInitialized={isInitialized}>
              <UserBlog />
            </ProtectedRoute>
          } />
          <Route path='/myBlogs/:id' element={
            <ProtectedRoute isLoggedIn={isLoggedIn} isLoading={isLoading} isInitialized={isInitialized}>
              <BlogDetail />
            </ProtectedRoute>
          } />
          <Route path="/user-details/:id" element={
            <ProtectedRoute isLoggedIn={isLoggedIn} isLoading={isLoading} isInitialized={isInitialized}>
              <UserInfo />
            </ProtectedRoute>
          } />
          <Route path="/dashboard" element={
            <ProtectedRoute isLoggedIn={isLoggedIn} isLoading={isLoading} isInitialized={isInitialized}>
              <Dashboard />
            </ProtectedRoute>
          } />
          
          <Route path="/profile" element={
            <ProtectedRoute isLoggedIn={isLoggedIn} isLoading={isLoading} isInitialized={isInitialized}>
              <ProfileEdit />
            </ProtectedRoute>
          } />
          
          <Route path="/admin" element={
            <ProtectedRoute isLoggedIn={isLoggedIn} isLoading={isLoading} isInitialized={isInitialized}>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          
          <Route path="/analytics" element={
            <ProtectedRoute isLoggedIn={isLoggedIn} isLoading={isLoading} isInitialized={isInitialized}>
              <AnalyticsDashboard />
            </ProtectedRoute>
          } />
          
          <Route path="/media" element={
            <ProtectedRoute isLoggedIn={isLoggedIn} isLoading={isLoading} isInitialized={isInitialized}>
              <MediaManager />
            </ProtectedRoute>
          } />
          
          <Route path="/chat" element={
            <ProtectedRoute isLoggedIn={isLoggedIn} isLoading={isLoading} isInitialized={isInitialized}>
              <Chat />
            </ProtectedRoute>
          } />
          
          {/* Fallback Route */}
          <Route path="*" element={
            isInitialized && !isLoggedIn ? <Navigate to="/" replace /> : <First />
          } />
        </Routes>
      </main>

      {/* Real-time Notifications */}
      <Snackbar
        open={notification.open}
        autoHideDuration={4000}
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={handleCloseNotification} 
          severity={notification.severity}
          sx={{ 
            borderRadius: 2,
            fontWeight: 600,
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
          }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </div>
  );
};

export default App;