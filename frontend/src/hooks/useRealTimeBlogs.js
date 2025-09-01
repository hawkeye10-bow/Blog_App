import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { serverURL } from '../helper/Helper';
import socketService from '../services/socketService';
import Swal from 'sweetalert2';

export const useRealTimeBlogs = (initialPage = 1, limit = 10) => {
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 0,
    totalBlogs: 0,
    hasNext: false,
    hasPrev: false
  });
  const [typingUsers, setTypingUsers] = useState(new Map());

  // Fetch blogs from API
  const fetchBlogs = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.get(`${serverURL}/api/blog?page=${page}&limit=${limit}`);
      const { blogs: fetchedBlogs, pagination: paginationData } = response.data;
      
      setBlogs(fetchedBlogs || []);
      setPagination(paginationData || {
        currentPage: page,
        totalPages: 0,
        totalBlogs: 0,
        hasNext: false,
        hasPrev: false
      });
    } catch (err) {
      console.error('Error fetching blogs:', err);
      setError('Failed to load blogs. Please try again.');
      
      // Show user-friendly error
      Swal.fire({
        icon: 'error',
        title: 'Connection Error',
        text: 'Unable to load blogs. Please check your internet connection.',
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(20px)',
      });
    } finally {
      setLoading(false);
    }
  }, [limit]);

  // Real-time event handlers
  useEffect(() => {
    const socket = socketService.connect();

    // Handle new blog creation
    const handleNewBlog = (data) => {
      console.log('New blog received:', data);
      setBlogs(prevBlogs => [data.blog, ...prevBlogs]);
      
      // Show notification
      Swal.fire({
        icon: 'info',
        title: 'New Blog Published!',
        text: data.message,
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(20px)',
      });
    };

    // Handle blog updates
    const handleBlogUpdated = (data) => {
      console.log('Blog updated:', data);
      setBlogs(prevBlogs => 
        prevBlogs.map(blog => 
          blog._id === data.blog._id ? data.blog : blog
        )
      );
      
      // Show notification if it's not the current user's blog
      const currentUserId = localStorage.getItem('userId');
      if (data.blog.user._id !== currentUserId) {
        Swal.fire({
          icon: 'info',
          title: 'Blog Updated',
          text: data.message,
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 3000,
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
        });
      }
    };

    // Handle blog deletion
    const handleBlogDeleted = (data) => {
      console.log('Blog deleted:', data);
      setBlogs(prevBlogs => 
        prevBlogs.filter(blog => blog._id !== data.blogId)
      );
      
      // Show notification
      const currentUserId = localStorage.getItem('userId');
      if (data.userId !== currentUserId) {
        Swal.fire({
          icon: 'info',
          title: 'Blog Removed',
          text: data.message,
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 3000,
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
        });
      }
    };

    // Handle typing indicators
    const handleUserTyping = (data) => {
      setTypingUsers(prev => {
        const newMap = new Map(prev);
        newMap.set(data.userId, {
          userName: data.userName,
          action: data.action,
          timestamp: Date.now()
        });
        return newMap;
      });
      
      // Auto-remove typing indicator after 3 seconds
      setTimeout(() => {
        setTypingUsers(prev => {
          const newMap = new Map(prev);
          newMap.delete(data.userId);
          return newMap;
        });
      }, 3000);
    };

    const handleUserStoppedTyping = (data) => {
      setTypingUsers(prev => {
        const newMap = new Map(prev);
        newMap.delete(data.userId);
        return newMap;
      });
    };

    // Register event listeners
    socketService.onNewBlog(handleNewBlog);
    socketService.onBlogUpdated(handleBlogUpdated);
    socketService.onBlogDeleted(handleBlogDeleted);
    socketService.onUserTyping(handleUserTyping);
    socketService.onUserStoppedTyping(handleUserStoppedTyping);

    // Initial fetch
    fetchBlogs(initialPage);

    // Cleanup
    return () => {
      socketService.removeAllListeners();
    };
  }, [fetchBlogs, initialPage]);

  // Pagination handlers
  const goToPage = useCallback((page) => {
    if (page >= 1 && page <= pagination.totalPages) {
      fetchBlogs(page);
    }
  }, [fetchBlogs, pagination.totalPages]);

  const nextPage = useCallback(() => {
    if (pagination.hasNext) {
      goToPage(pagination.currentPage + 1);
    }
  }, [pagination.hasNext, pagination.currentPage, goToPage]);

  const prevPage = useCallback(() => {
    if (pagination.hasPrev) {
      goToPage(pagination.currentPage - 1);
    }
  }, [pagination.hasPrev, pagination.currentPage, goToPage]);

  // Refresh blogs
  const refreshBlogs = useCallback(() => {
    fetchBlogs(pagination.currentPage);
  }, [fetchBlogs, pagination.currentPage]);

  return {
    blogs,
    loading,
    error,
    pagination,
    typingUsers,
    goToPage,
    nextPage,
    prevPage,
    refreshBlogs,
    fetchBlogs
  };
};