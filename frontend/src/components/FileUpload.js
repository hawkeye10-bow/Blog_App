import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Alert,
  Paper,
  Grid
} from '@mui/material';
import {
  CloudUpload,
  InsertDriveFile,
  Image,
  VideoFile,
  AudioFile,
  Description,
  Delete,
  CheckCircle,
  Error,
  AttachFile
} from '@mui/icons-material';

const FileUpload = ({ open, onClose, onUpload }) => {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const allowedFileTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/webm',
    'video/ogg',
    'audio/mpeg',
    'audio/wav',
    'audio/ogg',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ];

  const maxFileSize = 10 * 1024 * 1024; // 10MB

  const getFileIcon = (file) => {
    if (file.type.startsWith('image/')) return <Image />;
    if (file.type.startsWith('video/')) return <VideoFile />;
    if (file.type.startsWith('audio/')) return <AudioFile />;
    if (file.type === 'application/pdf') return <Description />;
    return <InsertDriveFile />;
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleFileSelect = (event) => {
    const selectedFiles = Array.from(event.target.files);
    const validFiles = [];
    const errors = [];

    selectedFiles.forEach(file => {
      if (!allowedFileTypes.includes(file.type)) {
        errors.push(`${file.name} - Unsupported file type`);
        return;
      }

      if (file.size > maxFileSize) {
        errors.push(`${file.name} - File too large (max ${formatFileSize(maxFileSize)})`);
        return;
      }

      validFiles.push(file);
    });

    if (errors.length > 0) {
      setError(errors.join('\n'));
    }

    setFiles(prev => [...prev, ...validFiles]);
    setError('');
  };

  const handleRemoveFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    setUploading(true);
    setUploadProgress({});
    setError('');

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Simulate upload progress
        setUploadProgress(prev => ({ ...prev, [i]: 0 }));
        
        // Simulate upload delay
        for (let progress = 0; progress <= 100; progress += 10) {
          await new Promise(resolve => setTimeout(resolve, 100));
          setUploadProgress(prev => ({ ...prev, [i]: progress }));
        }

        // Call the actual upload function
        await onUpload(file);
      }

      setFiles([]);
      setUploadProgress({});
      onClose();
    } catch (err) {
      setError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    const droppedFiles = Array.from(event.dataTransfer.files);
    const validFiles = [];
    const errors = [];

    droppedFiles.forEach(file => {
      if (!allowedFileTypes.includes(file.type)) {
        errors.push(`${file.name} - Unsupported file type`);
        return;
      }

      if (file.size > maxFileSize) {
        errors.push(`${file.name} - File too large (max ${formatFileSize(maxFileSize)})`);
        return;
      }

      validFiles.push(file);
    });

    if (errors.length > 0) {
      setError(errors.join('\n'));
    }

    setFiles(prev => [...prev, ...validFiles]);
    setError('');
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  const handleClose = () => {
    if (!uploading) {
      setFiles([]);
      setUploadProgress({});
      setError('');
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Upload Files</DialogTitle>
      <DialogContent>
        {/* Drop Zone */}
        <Paper
          sx={{
            p: 3,
            textAlign: 'center',
            border: '2px dashed',
            borderColor: 'primary.main',
            bgcolor: 'action.hover',
            cursor: 'pointer',
            mb: 2
          }}
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <CloudUpload sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
          <Typography variant="h6" gutterBottom>
            Drop files here or click to select
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Supported: Images, Videos, Audio, Documents (max 10MB each)
          </Typography>
        </Paper>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={allowedFileTypes.join(',')}
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* File List */}
        {files.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Selected Files ({files.length})
            </Typography>
            <List dense>
              {files.map((file, index) => (
                <ListItem
                  key={index}
                  secondaryAction={
                    !uploading && (
                      <IconButton
                        edge="end"
                        onClick={() => handleRemoveFile(index)}
                        disabled={uploading}
                      >
                        <Delete />
                      </IconButton>
                    )
                  }
                >
                  <ListItemIcon>
                    {uploadProgress[index] === 100 ? (
                      <CheckCircle color="success" />
                    ) : uploadProgress[index] !== undefined ? (
                      <LinearProgress
                        variant="determinate"
                        value={uploadProgress[index]}
                        sx={{ width: 24, height: 24, borderRadius: '50%' }}
                      />
                    ) : (
                      getFileIcon(file)
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={file.name}
                    secondary={`${formatFileSize(file.size)} • ${file.type}`}
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        {/* Upload Progress */}
        {uploading && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Uploading...
            </Typography>
            {Object.entries(uploadProgress).map(([index, progress]) => (
              <Box key={index} sx={{ mb: 1 }}>
                <Typography variant="caption">
                  {files[index]?.name}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={progress}
                  sx={{ mt: 0.5 }}
                />
              </Box>
            ))}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={uploading}>
          Cancel
        </Button>
        <Button
          onClick={handleUpload}
          variant="contained"
          disabled={files.length === 0 || uploading}
          startIcon={<AttachFile />}
        >
          {uploading ? 'Uploading...' : 'Upload'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FileUpload;
