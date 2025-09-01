import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  CircularProgress,
  Grid,
  Avatar,
  Badge,
  Switch,
  FormControlLabel,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  ListItemSecondaryAction
} from '@mui/material';
import {
  People as PeopleIcon,
  Article as ArticleIcon,
  Flag as FlagIcon,
  Settings as SettingsIcon,
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  Warning as WarningIcon,
  Block as BlockIcon,
  CheckCircle as UnblockIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import axios from 'axios';
import { serverURL } from '../../helper/Helper.js';
import { formatDistanceToNow } from 'date-fns';

const AdminDashboard = () => {
  const currentUser = useSelector(state => state.user);
  const [activeTab, setActiveTab] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // Data states
  const [users, setUsers] = useState([]);
  const [blogs, setBlogs] = useState([]);
  const [comments, setComments] = useState([]);
  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState({});
  
  // Dialog states
  const [userDialog, setUserDialog] = useState({ open: false, user: null });
  const [blogDialog, setBlogDialog] = useState({ open: false, blog: null });
  const [commentDialog, setCommentDialog] = useState({ open: false, comment: null });
  const [reportDialog, setReportDialog] = useState({ open: false, report: null });
  
  // Filter states
  const [userFilter, setUserFilter] = useState('all');
  const [blogFilter, setBlogFilter] = useState('pending');
  const [commentFilter, setCommentFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (currentUser?.role === 'admin') {
      fetchDashboardData();
    }
  }, [currentUser]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const [usersRes, blogsRes, commentsRes, reportsRes, statsRes] = await Promise.all([
        axios.get(`${serverURL}/api/admin/users`),
        axios.get(`${serverURL}/api/admin/blogs`),
        axios.get(`${serverURL}/api/admin/comments`),
        axios.get(`${serverURL}/api/admin/reports`),
        axios.get(`${serverURL}/api/admin/stats`)
      ]);

      setUsers(usersRes.data.users || []);
      setBlogs(blogsRes.data.blogs || []);
      setComments(commentsRes.data.comments || []);
      setReports(reportsRes.data.reports || []);
      setStats(statsRes.data.stats || {});
    } catch (error) {
      console.error('Error fetching admin data:', error);
      setMessage({ 
        type: 'error', 
        text: 'Failed to load admin dashboard data' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleUserAction = async (userId, action, data = {}) => {
    try {
      const response = await axios.put(`${serverURL}/api/admin/users/${userId}/${action}`, data);
      
      if (response.data.success) {
        setMessage({ type: 'success', text: `User ${action} successful` });
        fetchDashboardData();
        setUserDialog({ open: false, user: null });
        
        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
      }
    } catch (error) {
      console.error(`Error ${action} user:`, error);
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.message || `Failed to ${action} user` 
      });
    }
  };

  const handleBlogAction = async (blogId, action, data = {}) => {
    try {
      const response = await axios.put(`${serverURL}/api/admin/blogs/${blogId}/${action}`, data);
      
      if (response.data.success) {
        setMessage({ type: 'success', text: `Blog ${action} successful` });
        fetchDashboardData();
        setBlogDialog({ open: false, blog: null });
        
        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
      }
    } catch (error) {
      console.error(`Error ${action} blog:`, error);
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.message || `Failed to ${action} blog` 
      });
    }
  };

  const handleCommentAction = async (commentId, action, data = {}) => {
    try {
      const response = await axios.put(`${serverURL}/api/admin/comments/${commentId}/${action}`, data);
      
      if (response.data.success) {
        setMessage({ type: 'success', text: `Comment ${action} successful` });
        fetchDashboardData();
        setCommentDialog({ open: false, comment: null });
        
        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
      }
    } catch (error) {
      console.error(`Error ${action} comment:`, error);
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.message || `Failed to ${action} comment` 
      });
    }
  };

  const handleReportAction = async (reportId, action, data = {}) => {
    try {
      const response = await axios.put(`${serverURL}/api/admin/reports/${reportId}/${action}`, data);
      
      if (response.data.success) {
        setMessage({ type: 'success', text: `Report ${action} successful` });
        fetchDashboardData();
        setReportDialog({ open: false, report: null });
        
        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
      }
    } catch (error) {
      console.error(`Error ${action} report:`, error);
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.message || `Failed to ${action} report` 
      });
    }
  };

  const getFilteredUsers = () => {
    let filtered = users;
    
    if (userFilter !== 'all') {
      filtered = filtered.filter(user => user.role === userFilter);
    }
    
    if (searchTerm) {
      filtered = filtered.filter(user => 
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    return filtered;
  };

  const getFilteredBlogs = () => {
    let filtered = blogs;
    
    if (blogFilter !== 'all') {
      filtered = filtered.filter(blog => blog.status === blogFilter);
    }
    
    if (searchTerm) {
      filtered = filtered.filter(blog => 
        blog.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        blog.user.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    return filtered;
  };

  const getFilteredComments = () => {
    let filtered = comments;
    
    if (commentFilter !== 'all') {
      filtered = filtered.filter(comment => comment.status === commentFilter);
    }
    
    if (searchTerm) {
      filtered = filtered.filter(comment => 
        comment.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
        comment.user.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    return filtered;
  };

  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <Typography variant="h6" color="error">
          Access Denied. Admin privileges required.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 4, fontWeight: 600 }}>
        Admin Dashboard
      </Typography>

      {message.text && (
        <Alert 
          severity={message.type} 
          sx={{ mb: 3 }}
          onClose={() => setMessage({ type: '', text: '' })}
        >
          {message.text}
        </Alert>
      )}

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={3}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h4" fontWeight="bold" color="primary">
                    {stats.totalUsers || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Users
                  </Typography>
                </Box>
                <PeopleIcon sx={{ fontSize: 40, color: 'primary.main' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={3}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h4" fontWeight="bold" color="secondary">
                    {stats.pendingBlogs || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Pending Blogs
                  </Typography>
                </Box>
                <ArticleIcon sx={{ fontSize: 40, color: 'secondary.main' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={3}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h4" fontWeight="bold" color="warning.main">
                    {stats.reportedComments || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Reported Comments
                  </Typography>
                </Box>
                <FlagIcon sx={{ fontSize: 40, color: 'warning.main' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={3}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h4" fontWeight="bold" color="error">
                    {stats.spamReports || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Spam Reports
                  </Typography>
                </Box>
                <WarningIcon sx={{ fontSize: 40, color: 'error.main' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Search and Filters */}
      <Box sx={{ mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              placeholder="Search users, blogs, or comments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
              }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <Box display="flex" gap={2}>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={fetchDashboardData}
                disabled={isLoading}
              >
                Refresh
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Box>

      {/* Tabs */}
      <Card elevation={3}>
        <Tabs value={activeTab} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label="Users" icon={<PeopleIcon />} iconPosition="start" />
          <Tab label="Blogs" icon={<ArticleIcon />} iconPosition="start" />
          <Tab label="Comments" icon={<FlagIcon />} iconPosition="start" />
          <Tab label="Reports" icon={<WarningIcon />} iconPosition="start" />
        </Tabs>

        <Box sx={{ p: 3 }}>
          {/* Users Tab */}
          {activeTab === 0 && (
            <Box>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">User Management</Typography>
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Filter</InputLabel>
                  <Select
                    value={userFilter}
                    onChange={(e) => setUserFilter(e.target.value)}
                    label="Filter"
                  >
                    <MenuItem value="all">All Users</MenuItem>
                    <MenuItem value="admin">Admins</MenuItem>
                    <MenuItem value="author">Authors</MenuItem>
                    <MenuItem value="reader">Readers</MenuItem>
                  </Select>
                </FormControl>
              </Box>

              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>User</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Role</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Joined</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {getFilteredUsers().map((user) => (
                      <TableRow key={user._id}>
                        <TableCell>
                          <Box display="flex" alignItems="center" gap={2}>
                            <Avatar src={user.profile?.profilePicture}>
                              {user.name?.charAt(0)}
                            </Avatar>
                            <Typography variant="body2">{user.name}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Chip 
                            label={user.role} 
                            color={user.role === 'admin' ? 'error' : user.role === 'author' ? 'primary' : 'default'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={user.isActive ? 'Active' : 'Blocked'} 
                            color={user.isActive ? 'success' : 'error'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
                        </TableCell>
                        <TableCell>
                          <Box display="flex" gap={1}>
                            <IconButton
                              size="small"
                              onClick={() => setUserDialog({ open: true, user })}
                            >
                              <ViewIcon />
                            </IconButton>
                            <IconButton
                              size="small"
                              color={user.isActive ? 'error' : 'success'}
                              onClick={() => handleUserAction(user._id, user.isActive ? 'block' : 'unblock')}
                            >
                              {user.isActive ? <BlockIcon /> : <UnblockIcon />}
                            </IconButton>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* Blogs Tab */}
          {activeTab === 1 && (
            <Box>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">Blog Management</Typography>
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={blogFilter}
                    onChange={(e) => setBlogFilter(e.target.value)}
                    label="Status"
                  >
                    <MenuItem value="all">All</MenuItem>
                    <MenuItem value="pending">Pending</MenuItem>
                    <MenuItem value="published">Published</MenuItem>
                    <MenuItem value="rejected">Rejected</MenuItem>
                    <MenuItem value="draft">Draft</MenuItem>
                  </Select>
                </FormControl>
              </Box>

              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Blog</TableCell>
                      <TableCell>Author</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Created</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {getFilteredBlogs().map((blog) => (
                      <TableRow key={blog._id}>
                        <TableCell>
                          <Box>
                            <Typography variant="body2" fontWeight={600}>
                              {blog.title}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {blog.category} • {blog.tags?.join(', ')}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box display="flex" alignItems="center" gap={1}>
                            <Avatar src={blog.user.profile?.profilePicture} sx={{ width: 24, height: 24 }}>
                              {blog.user.name?.charAt(0)}
                            </Avatar>
                            <Typography variant="body2">{blog.user.name}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={blog.status} 
                            color={
                              blog.status === 'published' ? 'success' : 
                              blog.status === 'pending' ? 'warning' : 
                              blog.status === 'rejected' ? 'error' : 'default'
                            }
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          {formatDistanceToNow(new Date(blog.createdAt), { addSuffix: true })}
                        </TableCell>
                        <TableCell>
                          <Box display="flex" gap={1}>
                            <IconButton
                              size="small"
                              onClick={() => setBlogDialog({ open: true, blog })}
                            >
                              <ViewIcon />
                            </IconButton>
                            {blog.status === 'pending' && (
                              <>
                                <IconButton
                                  size="small"
                                  color="success"
                                  onClick={() => handleBlogAction(blog._id, 'approve')}
                                >
                                  <ApproveIcon />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => handleBlogAction(blog._id, 'reject')}
                                >
                                  <RejectIcon />
                                </IconButton>
                              </>
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* Comments Tab */}
          {activeTab === 2 && (
            <Box>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">Comment Management</Typography>
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={commentFilter}
                    onChange={(e) => setCommentFilter(e.target.value)}
                    label="Status"
                  >
                    <MenuItem value="all">All</MenuItem>
                    <MenuItem value="active">Active</MenuItem>
                    <MenuItem value="flagged">Flagged</MenuItem>
                    <MenuItem value="hidden">Hidden</MenuItem>
                  </Select>
                </FormControl>
              </Box>

              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Comment</TableCell>
                      <TableCell>User</TableCell>
                      <TableCell>Blog</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Created</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {getFilteredComments().map((comment) => (
                      <TableRow key={comment._id}>
                        <TableCell>
                          <Typography variant="body2" sx={{ maxWidth: 300 }}>
                            {comment.content}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Box display="flex" alignItems="center" gap={1}>
                            <Avatar src={comment.user.profile?.profilePicture} sx={{ width: 24, height: 24 }}>
                              {comment.user.name?.charAt(0)}
                            </Avatar>
                            <Typography variant="body2">{comment.user.name}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ maxWidth: 150 }}>
                            {comment.blog?.title}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={comment.status} 
                            color={
                              comment.status === 'active' ? 'success' : 
                              comment.status === 'flagged' ? 'warning' : 
                              comment.status === 'hidden' ? 'error' : 'default'
                            }
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                        </TableCell>
                        <TableCell>
                          <Box display="flex" gap={1}>
                            <IconButton
                              size="small"
                              onClick={() => setCommentDialog({ open: true, comment })}
                            >
                              <ViewIcon />
                            </IconButton>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleCommentAction(comment._id, 'hide')}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* Reports Tab */}
          {activeTab === 3 && (
            <Box>
              <Typography variant="h6" gutterBottom>Content Reports</Typography>
              
              <List>
                {reports.map((report) => (
                  <React.Fragment key={report._id}>
                    <ListItem alignItems="flex-start">
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: 'warning.main' }}>
                          <FlagIcon />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="body2" fontWeight={600}>
                              {report.type} reported
                            </Typography>
                            <Chip 
                              label={report.status} 
                              color={report.status === 'open' ? 'warning' : 'success'}
                              size="small"
                            />
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              {report.reason}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Reported by {report.reporter.name} • {formatDistanceToNow(new Date(report.createdAt), { addSuffix: true })}
                            </Typography>
                          </Box>
                        }
                      />
                      <ListItemSecondaryAction>
                        <Box display="flex" gap={1}>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => setReportDialog({ open: true, report })}
                          >
                            Review
                          </Button>
                          <Button
                            size="small"
                            variant="contained"
                            color="success"
                            onClick={() => handleReportAction(report._id, 'resolve')}
                          >
                            Resolve
                          </Button>
                        </Box>
                      </ListItemSecondaryAction>
                    </ListItem>
                    <Divider variant="inset" component="li" />
                  </React.Fragment>
                ))}
              </List>
            </Box>
          )}
        </Box>
      </Card>

      {/* User Dialog */}
      <Dialog 
        open={userDialog.open} 
        onClose={() => setUserDialog({ open: false, user: null })}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>User Details</DialogTitle>
        <DialogContent>
          {userDialog.user && (
            <Box>
              <Typography variant="h6">{userDialog.user.name}</Typography>
              <Typography variant="body2" color="text.secondary">
                {userDialog.user.email}
              </Typography>
              {/* Add more user details here */}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUserDialog({ open: false, user: null })}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Blog Dialog */}
      <Dialog 
        open={blogDialog.open} 
        onClose={() => setBlogDialog({ open: false, blog: null })}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Blog Review</DialogTitle>
        <DialogContent>
          {blogDialog.blog && (
            <Box>
              <Typography variant="h6">{blogDialog.blog.title}</Typography>
              <Typography variant="body2" color="text.secondary">
                {blogDialog.blog.description}
              </Typography>
              {/* Add more blog details here */}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBlogDialog({ open: false, blog: null })}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Comment Dialog */}
      <Dialog 
        open={commentDialog.open} 
        onClose={() => setCommentDialog({ open: false, comment: null })}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Comment Review</DialogTitle>
        <DialogContent>
          {commentDialog.comment && (
            <Box>
              <Typography variant="body2">{commentDialog.comment.content}</Typography>
              {/* Add more comment details here */}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCommentDialog({ open: false, comment: null })}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Report Dialog */}
      <Dialog 
        open={reportDialog.open} 
        onClose={() => setReportDialog({ open: false, report: null })}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Report Review</DialogTitle>
        <DialogContent>
          {reportDialog.report && (
            <Box>
              <Typography variant="body2">{reportDialog.report.reason}</Typography>
              {/* Add more report details here */}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReportDialog({ open: false, report: null })}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminDashboard;