import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Avatar,
  Typography,
  Grid,
  IconButton,
  Chip,
  Divider,
  Alert,
  CircularProgress,
  Paper
} from '@mui/material';
import {
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  LinkedIn as LinkedInIcon,
  Twitter as TwitterIcon,
  GitHub as GitHubIcon,
  Instagram as InstagramIcon,
  Facebook as FacebookIcon,
  YouTube as YouTubeIcon,
  Language as WebsiteIcon
} from '@mui/icons-material';
import { useSelector, useDispatch } from 'react-redux';
import { authActions } from '../../store/index.js';
import axios from 'axios';
import { serverURL } from '../../helper/Helper.js';

const ProfileEdit = () => {
  const dispatch = useDispatch();
  const user = useSelector(state => state.user);
  
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    bio: '',
    profilePicture: '',
    socialLinks: {
      linkedin: '',
      twitter: '',
      github: '',
      instagram: '',
      facebook: '',
      youtube: '',
      website: ''
    }
  });

  const [originalData, setOriginalData] = useState({});

  useEffect(() => {
    if (user) {
      const userData = {
        name: user.name || '',
        email: user.email || '',
        bio: user.profile?.bio || '',
        profilePicture: user.profile?.profilePicture || '',
        socialLinks: {
          linkedin: user.profile?.socialLinks?.linkedin || '',
          twitter: user.profile?.socialLinks?.twitter || '',
          github: user.profile?.socialLinks?.github || '',
          instagram: user.profile?.socialLinks?.instagram || '',
          facebook: user.profile?.socialLinks?.facebook || '',
          youtube: user.profile?.socialLinks?.youtube || '',
          website: user.profile?.socialLinks?.website || ''
        }
      };
      setFormData(userData);
      setOriginalData(userData);
    }
  }, [user]);

  const handleInputChange = (field, value) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const handleProfilePictureChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setFormData(prev => ({
          ...prev,
          profilePicture: e.target.result
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await axios.put(`${serverURL}/api/user/profile/${user._id}`, {
        name: formData.name,
        profile: {
          bio: formData.bio,
          profilePicture: formData.profilePicture,
          socialLinks: formData.socialLinks
        }
      });

      if (response.data.success) {
        // Update Redux store
        dispatch(authActions.updateUser(response.data.user));
        setOriginalData(formData);
        setIsEditing(false);
        setMessage({ type: 'success', text: 'Profile updated successfully!' });
        
        // Clear message after 3 seconds
        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.message || 'Failed to update profile' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData(originalData);
    setIsEditing(false);
    setMessage({ type: '', text: '' });
  };

  const hasChanges = () => {
    return JSON.stringify(formData) !== JSON.stringify(originalData);
  };

  const socialIcons = {
    linkedin: LinkedInIcon,
    twitter: TwitterIcon,
    github: GitHubIcon,
    instagram: InstagramIcon,
    facebook: FacebookIcon,
    youtube: YouTubeIcon,
    website: WebsiteIcon
  };

  const socialLabels = {
    linkedin: 'LinkedIn',
    twitter: 'Twitter',
    github: 'GitHub',
    instagram: 'Instagram',
    facebook: 'Facebook',
    youtube: 'YouTube',
    website: 'Website'
  };

  if (!user) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 4, fontWeight: 600 }}>
        Profile Settings
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

      <Card elevation={3} sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" alignItems="center" mb={3}>
            <Avatar
              src={formData.profilePicture}
              sx={{ 
                width: 100, 
                height: 100, 
                mr: 3,
                border: '3px solid #e0e0e0'
              }}
            />
            <Box>
              <Typography variant="h6" gutterBottom>
                {formData.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {user.role}
              </Typography>
              {!isEditing && (
                <Button
                  variant="outlined"
                  startIcon={<EditIcon />}
                  onClick={() => setIsEditing(true)}
                  sx={{ mt: 1 }}
                >
                  Edit Profile
                </Button>
              )}
            </Box>
          </Box>

          {isEditing && (
            <Box mb={3}>
              <Typography variant="subtitle2" gutterBottom>
                Profile Picture
              </Typography>
              <input
                accept="image/*"
                type="file"
                id="profile-picture-input"
                onChange={handleProfilePictureChange}
                style={{ display: 'none' }}
              />
              <label htmlFor="profile-picture-input">
                <Button
                  variant="outlined"
                  component="span"
                  startIcon={<EditIcon />}
                >
                  Change Picture
                </Button>
              </label>
            </Box>
          )}
        </CardContent>
      </Card>

      <Card elevation={3}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
            Personal Information
          </Typography>

          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                disabled={!isEditing}
                variant="outlined"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Email"
                value={formData.email}
                disabled
                variant="outlined"
                helperText="Email cannot be changed"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Bio"
                value={formData.bio}
                onChange={(e) => handleInputChange('bio', e.target.value)}
                disabled={!isEditing}
                variant="outlined"
                multiline
                rows={4}
                placeholder="Tell us about yourself..."
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 4 }} />

          <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
            Social Links
          </Typography>

          <Grid container spacing={2}>
            {Object.entries(formData.socialLinks).map(([platform, url]) => {
              const IconComponent = socialIcons[platform];
              return (
                <Grid item xs={12} sm={6} key={platform}>
                  <TextField
                    fullWidth
                    label={socialLabels[platform]}
                    value={url}
                    onChange={(e) => handleInputChange(`socialLinks.${platform}`, e.target.value)}
                    disabled={!isEditing}
                    variant="outlined"
                    InputProps={{
                      startAdornment: (
                        <IconComponent sx={{ mr: 1, color: 'text.secondary' }} />
                      )
                    }}
                    placeholder={`https://${platform}.com/username`}
                  />
                </Grid>
              );
            })}
          </Grid>

          {isEditing && (
            <Box display="flex" gap={2} mt={4}>
              <Button
                variant="contained"
                startIcon={isLoading ? <CircularProgress size={20} /> : <SaveIcon />}
                onClick={handleSave}
                disabled={isLoading || !hasChanges()}
                sx={{ minWidth: 120 }}
              >
                {isLoading ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button
                variant="outlined"
                startIcon={<CancelIcon />}
                onClick={handleCancel}
                disabled={isLoading}
              >
                Cancel
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default ProfileEdit;
