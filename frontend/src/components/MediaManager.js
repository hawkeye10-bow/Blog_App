import React, { useState, useEffect, useRef } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Button,
    Grid,
    IconButton,
    Tooltip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Chip,
    LinearProgress,
    Alert,
    Tabs,
    Tab,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Checkbox,
    FormControlLabel,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Pagination,
    CircularProgress,
    ImageList,
    ImageListItem,
    ImageListItemBar
} from '@mui/material';
import {
    CloudUpload,
    Image,
    VideoFile,
    Description,
    AudioFile,
    Delete,
    Edit,
    Download,
    Search,
    FilterList,
    Add,
    Visibility,
    VisibilityOff,
    Refresh,
    Sort,
    GridView,
    ViewList
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import socketService from '../services/socketService';

const MediaManager = ({ blogId = null, onMediaSelect = null, isSelector = false }) => {
    const [media, setMedia] = useState([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState(0);
    const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [sortBy, setSortBy] = useState('newest');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [selectedMedia, setSelectedMedia] = useState([]);
    const [showUploadDialog, setShowUploadDialog] = useState(false);
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [editingMedia, setEditingMedia] = useState(null);
    const [uploadProgress, setUploadProgress] = useState({});
    
    const fileInputRef = useRef();
    const uploadFormRef = useRef();

    useEffect(() => {
        fetchMedia();
        setupRealTimeUpdates();
        
        return () => {
            socketService.removeAllListeners();
        };
    }, [page, searchQuery, filterType, sortBy]);

    const setupRealTimeUpdates = () => {
        const socket = socketService.connect();
        
        socket.on('media-uploaded', (data) => {
            if (data.blogId === blogId) {
                fetchMedia(); // Refresh media list
            }
        });

        socket.on('media-updated', (data) => {
            if (data.blogId === blogId) {
                fetchMedia(); // Refresh media list
            }
        });

        socket.on('media-deleted', (data) => {
            if (data.blogId === blogId) {
                fetchMedia(); // Refresh media list
            }
        });
    };

    const fetchMedia = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page,
                limit: 20,
                ...(searchQuery && { q: searchQuery }),
                ...(filterType !== 'all' && { type: filterType }),
                ...(sortBy && { sort: sortBy })
            });

            const response = await fetch(`/api/media/user/${localStorage.getItem('userId')}?${params}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setMedia(data.media);
                setTotalPages(data.pagination.total);
            } else {
                setError('Failed to fetch media');
            }
        } catch (error) {
            setError('Error fetching media');
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleFileSelect = (event) => {
        const files = Array.from(event.target.files);
        if (files.length > 0) {
            setShowUploadDialog(true);
            // Store files for upload
            setSelectedMedia(files);
        }
    };

    const handleUpload = async () => {
        if (selectedMedia.length === 0) return;

        setUploading(true);
        setError(null);

        const formData = new FormData();
        selectedMedia.forEach(file => {
            formData.append('files', file);
        });
        
        if (blogId) {
            formData.append('blogId', blogId);
        }

        try {
            const response = await fetch('/api/media/upload', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: formData
            });

            if (response.ok) {
                const data = await response.json();
                setShowUploadDialog(false);
                setSelectedMedia([]);
                fetchMedia(); // Refresh media list
                
                // Emit real-time update
                const socket = socketService.connect();
                socket.emit('media-uploaded', { blogId });
            } else {
                const errorData = await response.json();
                setError(errorData.message || 'Upload failed');
            }
        } catch (error) {
            setError('Upload error');
            console.error('Error:', error);
        } finally {
            setUploading(false);
        }
    };

    const handleEdit = async () => {
        if (!editingMedia) return;

        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/media/${editingMedia._id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    alt: editingMedia.alt,
                    caption: editingMedia.caption,
                    tags: editingMedia.tags,
                    isPublic: editingMedia.isPublic
                })
            });

            if (response.ok) {
                const data = await response.json();
                setShowEditDialog(false);
                setEditingMedia(null);
                fetchMedia(); // Refresh media list
            } else {
                const errorData = await response.json();
                setError(errorData.message || 'Update failed');
            }
        } catch (error) {
            setError('Update error');
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (mediaId) => {
        if (!window.confirm('Are you sure you want to delete this media?')) {
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/media/${mediaId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                fetchMedia(); // Refresh media list
            } else {
                const errorData = await response.json();
                setError(errorData.message || 'Delete failed');
            }
        } catch (error) {
            setError('Delete error');
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedMedia.length === 0) return;

        if (!window.confirm(`Are you sure you want to delete ${selectedMedia.length} media files?`)) {
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/media/bulk-delete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    mediaIds: selectedMedia.map(m => m._id)
                })
            });

            if (response.ok) {
                setSelectedMedia([]);
                fetchMedia(); // Refresh media list
            } else {
                const errorData = await response.json();
                setError(errorData.message || 'Bulk delete failed');
            }
        } catch (error) {
            setError('Bulk delete error');
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const getMediaIcon = (type) => {
        switch (type) {
            case 'image': return <Image />;
            case 'video': return <VideoFile />;
            case 'audio': return <AudioFile />;
            default: return <Description />;
        }
    };

    const getMediaColor = (type) => {
        switch (type) {
            case 'image': return 'primary';
            case 'video': return 'secondary';
            case 'audio': return 'success';
            default: return 'default';
        }
    };

    const handleMediaSelect = (mediaItem) => {
        if (isSelector && onMediaSelect) {
            onMediaSelect(mediaItem);
        }
    };

    if (loading && media.length === 0) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={{ p: 3 }}>
            {/* Header */}
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h4" component="h1">
                    Media Manager
                </Typography>
                <Box display="flex" gap={2}>
                    <Button
                        variant="contained"
                        startIcon={<CloudUpload />}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        Upload Media
                    </Button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                        style={{ display: 'none' }}
                        onChange={handleFileSelect}
                    />
                </Box>
            </Box>

            {/* Search and Filters */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} md={4}>
                            <TextField
                                fullWidth
                                placeholder="Search media..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                InputProps={{
                                    startAdornment: <Search />
                                }}
                            />
                        </Grid>
                        <Grid item xs={12} md={2}>
                            <FormControl fullWidth>
                                <InputLabel>Type</InputLabel>
                                <Select
                                    value={filterType}
                                    label="Type"
                                    onChange={(e) => setFilterType(e.target.value)}
                                >
                                    <MenuItem value="all">All Types</MenuItem>
                                    <MenuItem value="image">Images</MenuItem>
                                    <MenuItem value="video">Videos</MenuItem>
                                    <MenuItem value="audio">Audio</MenuItem>
                                    <MenuItem value="document">Documents</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={2}>
                            <FormControl fullWidth>
                                <InputLabel>Sort By</InputLabel>
                                <Select
                                    value={sortBy}
                                    label="Sort By"
                                    onChange={(e) => setSortBy(e.target.value)}
                                >
                                    <MenuItem value="newest">Newest First</MenuItem>
                                    <MenuItem value="oldest">Oldest First</MenuItem>
                                    <MenuItem value="name">Name</MenuItem>
                                    <MenuItem value="size">Size</MenuItem>
                                    <MenuItem value="type">Type</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={2}>
                            <Box display="flex" gap={1}>
                                <Tooltip title="Grid View">
                                    <IconButton
                                        onClick={() => setViewMode('grid')}
                                        color={viewMode === 'grid' ? 'primary' : 'default'}
                                    >
                                        <GridView />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title="List View">
                                    <IconButton
                                        onClick={() => setViewMode('list')}
                                        color={viewMode === 'list' ? 'primary' : 'default'}
                                    >
                                        <ViewList />
                                    </IconButton>
                                </Tooltip>
                            </Box>
                        </Grid>
                        <Grid item xs={12} md={2}>
                            <Button
                                variant="outlined"
                                startIcon={<Refresh />}
                                onClick={fetchMedia}
                            >
                                Refresh
                            </Button>
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}

            {/* Media Grid/List */}
            {viewMode === 'grid' ? (
                <ImageList cols={4} gap={16}>
                    {media.map((item) => (
                        <ImageListItem key={item._id} sx={{ cursor: isSelector ? 'pointer' : 'default' }}>
                            <Box
                                onClick={() => handleMediaSelect(item)}
                                sx={{
                                    position: 'relative',
                                    border: selectedMedia.some(m => m._id === item._id) ? '2px solid #1976d2' : '2px solid transparent',
                                    borderRadius: 1,
                                    overflow: 'hidden'
                                }}
                            >
                                {item.type === 'image' ? (
                                    <img
                                        src={item.url}
                                        alt={item.alt || item.originalName}
                                        style={{ width: '100%', height: 200, objectFit: 'cover' }}
                                    />
                                ) : (
                                    <Box
                                        sx={{
                                            width: '100%',
                                            height: 200,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            backgroundColor: 'grey.100'
                                        }}
                                    >
                                        {getMediaIcon(item.type)}
                                    </Box>
                                )}
                                
                                <ImageListItemBar
                                    title={item.originalName}
                                    subtitle={
                                        <Box>
                                            <Typography variant="caption" display="block">
                                                {item.sizeFormatted}
                                            </Typography>
                                            <Typography variant="caption" display="block">
                                                {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                                            </Typography>
                                        </Box>
                                    }
                                    actionIcon={
                                        <Box>
                                            <Tooltip title="Edit">
                                                <IconButton
                                                    size="small"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setEditingMedia(item);
                                                        setShowEditDialog(true);
                                                    }}
                                                >
                                                    <Edit />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Delete">
                                                <IconButton
                                                    size="small"
                                                    color="error"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDelete(item._id);
                                                    }}
                                                >
                                                    <Delete />
                                                </IconButton>
                                            </Tooltip>
                                        </Box>
                                    }
                                />
                            </Box>
                        </ImageListItem>
                    ))}
                </ImageList>
            ) : (
                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Preview</TableCell>
                                <TableCell>Name</TableCell>
                                <TableCell>Type</TableCell>
                                <TableCell>Size</TableCell>
                                <TableCell>Uploaded</TableCell>
                                <TableCell>Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {media.map((item) => (
                                <TableRow key={item._id}>
                                    <TableCell>
                                        <Box
                                            sx={{
                                                width: 60,
                                                height: 60,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                backgroundColor: 'grey.100',
                                                borderRadius: 1
                                            }}
                                        >
                                            {getMediaIcon(item.type)}
                                        </Box>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2" noWrap>
                                            {item.originalName}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            label={item.type}
                                            color={getMediaColor(item.type)}
                                            size="small"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2">
                                            {item.sizeFormatted}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2">
                                            {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Box display="flex" gap={1}>
                                            <Tooltip title="Edit">
                                                <IconButton
                                                    size="small"
                                                    onClick={() => {
                                                        setEditingMedia(item);
                                                        setShowEditDialog(true);
                                                    }}
                                                >
                                                    <Edit />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Delete">
                                                <IconButton
                                                    size="small"
                                                    color="error"
                                                    onClick={() => handleDelete(item._id)}
                                                >
                                                    <Delete />
                                                </IconButton>
                                            </Tooltip>
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <Box display="flex" justifyContent="center" mt={3}>
                    <Pagination
                        count={totalPages}
                        page={page}
                        onChange={(e, value) => setPage(value)}
                        color="primary"
                    />
                </Box>
            )}

            {/* Upload Dialog */}
            <Dialog
                open={showUploadDialog}
                onClose={() => setShowUploadDialog(false)}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle>Upload Media</DialogTitle>
                <DialogContent>
                    <Box mb={2}>
                        <Typography variant="subtitle1" gutterBottom>
                            Selected Files:
                        </Typography>
                        {selectedMedia.map((file, index) => (
                            <Chip
                                key={index}
                                label={`${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`}
                                sx={{ m: 0.5 }}
                            />
                        ))}
                    </Box>
                    
                    {uploading && (
                        <Box mb={2}>
                            <Typography variant="body2" gutterBottom>
                                Uploading... Please wait.
                            </Typography>
                            <LinearProgress />
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowUploadDialog(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleUpload}
                        variant="contained"
                        disabled={uploading || selectedMedia.length === 0}
                    >
                        {uploading ? 'Uploading...' : 'Upload'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Edit Dialog */}
            <Dialog
                open={showEditDialog}
                onClose={() => setShowEditDialog(false)}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle>Edit Media</DialogTitle>
                <DialogContent>
                    {editingMedia && (
                        <Box>
                            <TextField
                                fullWidth
                                label="Alt Text"
                                value={editingMedia.alt || ''}
                                onChange={(e) => setEditingMedia(prev => ({ ...prev, alt: e.target.value }))}
                                margin="normal"
                            />
                            <TextField
                                fullWidth
                                label="Caption"
                                value={editingMedia.caption || ''}
                                onChange={(e) => setEditingMedia(prev => ({ ...prev, caption: e.target.value }))}
                                margin="normal"
                                multiline
                                rows={3}
                            />
                            <TextField
                                fullWidth
                                label="Tags (comma-separated)"
                                value={editingMedia.tags?.join(', ') || ''}
                                onChange={(e) => setEditingMedia(prev => ({ 
                                    ...prev, 
                                    tags: e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag)
                                }))}
                                margin="normal"
                            />
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={editingMedia.isPublic || false}
                                        onChange={(e) => setEditingMedia(prev => ({ ...prev, isPublic: e.target.checked }))}
                                    />
                                }
                                label="Public"
                            />
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowEditDialog(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleEdit}
                        variant="contained"
                        disabled={loading}
                    >
                        {loading ? 'Updating...' : 'Update'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default MediaManager;
