import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Avatar,
  AvatarGroup,
  Chip,
  Tooltip,
  Alert,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction
} from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  Group as GroupIcon,
  PersonAdd as InviteIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Sync as SyncIcon,
  Warning as ConflictIcon
} from '@mui/icons-material';
import { useRealTimeCollaboration } from '../../hooks/useRealTimeFeatures';
import RichTextEditor from '../RichTextEditor';
import socketService from '../../services/socketService';
import apiService from '../../services/apiService';

const CollaborationContainer = styled(Paper)(({ theme }) => ({
  background: 'rgba(255, 255, 255, 0.95)',
  backdropFilter: 'blur(20px)',
  borderRadius: theme.spacing(3),
  border: '1px solid rgba(255, 255, 255, 0.3)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
  overflow: 'hidden',
}));

const CollaborationHeader = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2, 3),
  backgroundColor: 'rgba(102, 126, 234, 0.05)',
  borderBottom: '1px solid rgba(102, 126, 234, 0.1)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
}));

const CollaboratorAvatar = styled(Avatar)(({ theme }) => ({
  width: 32,
  height: 32,
  border: '2px solid white',
  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
  position: 'relative',
  '&::after': {
    content: '""',
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: '50%',
    backgroundColor: '#4caf50',
    border: '2px solid white',
  },
}));

const ConflictIndicator = styled(Alert)(({ theme }) => ({
  margin: theme.spacing(2, 3),
  borderRadius: theme.spacing(2),
  '& .MuiAlert-icon': {
    color: '#ff9800',
  },
}));

const ChangeIndicator = styled(Box)(({ theme }) => ({
  position: 'absolute',
  right: theme.spacing(1),
  top: '50%',
  transform: 'translateY(-50%)',
  background: 'linear-gradient(135deg, #667eea, #764ba2)',
  color: 'white',
  padding: theme.spacing(0.5, 1),
  borderRadius: theme.spacing(1),
  fontSize: '0.75rem',
  fontWeight: 600,
  animation: 'pulse 2s ease-in-out infinite',
}));

const CollaborativeEditor = ({ 
  blogId, 
  initialContent = '', 
  onContentChange, 
  onSave,
  readOnly = false 
}) => {
  const { 
    collaborators, 
    isCollaborating, 
    typingUsers, 
    handleContentChange 
  } = useRealTimeCollaboration(blogId);
  
  const [content, setContent] = useState(initialContent);
  const [lastSavedContent, setLastSavedContent] = useState(initialContent);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [conflicts, setConflicts] = useState([]);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [lastChangeBy, setLastChangeBy] = useState(null);
  
  const editorRef = useRef(null);
  const saveTimeoutRef = useRef(null);
  const lastChangeTimeRef = useRef(Date.now());

  // Listen for content synchronization
  useEffect(() => {
    const handleContentSync = (event) => {
      const { detail } = event;
      
      if (detail.blogId === blogId && detail.userId !== user?._id) {
        // Handle incoming content changes from other collaborators
        const timeDiff = Date.now() - lastChangeTimeRef.current;
        
        if (timeDiff > 1000) { // Only apply if no recent local changes
          setContent(detail.content);
          setLastChangeBy(detail.user);
          
          // Show change indicator
          setTimeout(() => setLastChangeBy(null), 3000);
        } else {
          // Potential conflict - store for resolution
          setConflicts(prev => [...prev, {
            id: Date.now(),
            content: detail.content,
            user: detail.user,
            timestamp: detail.timestamp
          }]);
        }
      }
    };

    window.addEventListener('content-sync', handleContentSync);
    
    return () => {
      window.removeEventListener('content-sync', handleContentSync);
    };
  }, [blogId]);

  // Handle content changes
  const handleEditorChange = useCallback((e) => {
    const newContent = e.target.value;
    setContent(newContent);
    setHasUnsavedChanges(newContent !== lastSavedContent);
    lastChangeTimeRef.current = Date.now();
    
    // Notify parent component
    if (onContentChange) {
      onContentChange(newContent);
    }
    
    // Send real-time update to other collaborators
    if (isCollaborating && !readOnly) {
      handleContentChange(newContent, 'edit', e.target.selectionStart);
    }
    
    // Auto-save after 2 seconds of inactivity
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      handleAutoSave();
    }, 2000);
  }, [lastSavedContent, isCollaborating, readOnly, handleContentChange, onContentChange]);

  // Auto-save functionality
  const handleAutoSave = async () => {
    if (!hasUnsavedChanges || readOnly) return;
    
    try {
      setSaving(true);
      await apiService.put(`/api/blog/update/${blogId}`, {
        content,
        userId: user._id
      });
      
      setLastSavedContent(content);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Auto-save failed:', error);
    } finally {
      setSaving(false);
    }
  };

  // Manual save
  const handleSave = async () => {
    if (!hasUnsavedChanges) return;
    
    try {
      setSaving(true);
      
      if (onSave) {
        await onSave(content);
      } else {
        await apiService.put(`/api/blog/update/${blogId}`, {
          content,
          userId: user._id
        });
      }
      
      setLastSavedContent(content);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Save failed:', error);
    } finally {
      setSaving(false);
    }
  };

  // Invite collaborator
  const handleInviteCollaborator = async () => {
    if (!inviteEmail.trim()) return;

    try {
      await apiService.post(`/api/blog/${blogId}/collaboration-invite`, {
        email: inviteEmail.trim()
      });
      
      setInviteEmail('');
      setShowInviteDialog(false);
      
      // Show success notification
      window.dispatchEvent(new CustomEvent('realtime-notification', {
        detail: {
          title: 'Invitation Sent',
          message: `Collaboration invitation sent to ${inviteEmail}`,
          type: 'success'
        }
      }));
    } catch (error) {
      console.error('Error inviting collaborator:', error);
    }
  };

  // Resolve conflict
  const handleResolveConflict = (conflict, action) => {
    if (action === 'accept') {
      setContent(conflict.content);
      setLastSavedContent(conflict.content);
      setHasUnsavedChanges(false);
    }
    
    setConflicts(prev => prev.filter(c => c.id !== conflict.id));
  };

  return (
    <CollaborationContainer>
      {/* Collaboration Header */}
      <CollaborationHeader>
        <Box display="flex" alignItems="center" gap={2}>
          <GroupIcon color="primary" />
          <Typography variant="subtitle1" fontWeight={600}>
            Collaborative Editing
          </Typography>
          {isCollaborating && (
            <Chip
              label="LIVE"
              size="small"
              color="success"
              sx={{ 
                animation: 'pulse 2s ease-in-out infinite',
                fontWeight: 600
              }}
            />
          )}
        </Box>

        <Box display="flex" alignItems="center" gap={2}>
          {/* Active Collaborators */}
          {collaborators.length > 0 && (
            <AvatarGroup max={4}>
              {collaborators.map((collaborator) => (
                <Tooltip 
                  key={collaborator.userId}
                  title={`${collaborator.userName} - Active`}
                >
                  <CollaboratorAvatar>
                    {collaborator.userName.charAt(0)}
                  </CollaboratorAvatar>
                </Tooltip>
              ))}
            </AvatarGroup>
          )}

          {/* Invite Button */}
          <Button
            size="small"
            startIcon={<InviteIcon />}
            onClick={() => setShowInviteDialog(true)}
            variant="outlined"
          >
            Invite
          </Button>

          {/* Save Button */}
          <Button
            size="small"
            startIcon={saving ? <SyncIcon sx={{ animation: 'spin 1s linear infinite' }} /> : <SaveIcon />}
            onClick={handleSave}
            disabled={!hasUnsavedChanges || saving || readOnly}
            variant="contained"
            color={hasUnsavedChanges ? 'warning' : 'success'}
          >
            {saving ? 'Saving...' : hasUnsavedChanges ? 'Save' : 'Saved'}
          </Button>
        </Box>
      </CollaborationHeader>

      {/* Conflict Resolution */}
      {conflicts.length > 0 && (
        <ConflictIndicator severity="warning" icon={<ConflictIcon />}>
          <Typography variant="subtitle2" fontWeight={600} mb={1}>
            Content Conflict Detected
          </Typography>
          <Typography variant="body2" mb={2}>
            {conflicts[0].user.name} made changes while you were editing.
          </Typography>
          <Box display="flex" gap={1}>
            <Button
              size="small"
              onClick={() => handleResolveConflict(conflicts[0], 'accept')}
              variant="outlined"
            >
              Accept Their Changes
            </Button>
            <Button
              size="small"
              onClick={() => handleResolveConflict(conflicts[0], 'reject')}
              variant="outlined"
            >
              Keep My Changes
            </Button>
          </Box>
        </ConflictIndicator>
      )}

      {/* Typing Indicators */}
      {typingUsers.length > 0 && (
        <Box p={2} bgcolor="rgba(102, 126, 234, 0.05)">
          <Typography variant="body2" color="primary">
            {typingUsers.map(u => u.userName).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
          </Typography>
        </Box>
      )}

      {/* Change Indicator */}
      {lastChangeBy && (
        <Box position="relative">
          <ChangeIndicator>
            Updated by {lastChangeBy.name}
          </ChangeIndicator>
        </Box>
      )}

      {/* Editor */}
      <Box p={3} position="relative">
        <RichTextEditor
          ref={editorRef}
          value={content}
          onChange={handleEditorChange}
          placeholder="Start writing your blog content..."
          minHeight={400}
          showPreview={true}
          disabled={readOnly}
        />
      </Box>

      {/* Invite Dialog */}
      <Dialog
        open={showInviteDialog}
        onClose={() => setShowInviteDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Invite Collaborator</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Invite someone to collaborate on this blog post in real-time.
          </Typography>
          <TextField
            fullWidth
            label="Email Address"
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="Enter collaborator's email"
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowInviteDialog(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleInviteCollaborator}
            variant="contained"
            disabled={!inviteEmail.trim()}
          >
            Send Invitation
          </Button>
        </DialogActions>
      </Dialog>
    </CollaborationContainer>
  );
};

export default CollaborativeEditor;