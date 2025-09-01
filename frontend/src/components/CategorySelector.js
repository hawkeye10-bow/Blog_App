import React, { useState, useEffect } from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Alert
} from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  Add as AddIcon,
  Category as CategoryIcon
} from '@mui/icons-material';
import axios from 'axios';
import { serverURL } from '../helper/Helper';
import { useSelector } from 'react-redux';

const StyledFormControl = styled(FormControl)(({ theme }) => ({
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

const CategoryOption = styled(MenuItem)(({ theme }) => ({
  padding: theme.spacing(1.5),
  borderRadius: theme.spacing(1),
  margin: theme.spacing(0.5),
  transition: 'all 0.2s ease',
  '&:hover': {
    backgroundColor: 'rgba(102, 126, 234, 0.08)',
    transform: 'translateX(4px)',
  },
}));

const CategorySelector = ({ value, onChange, allowCreate = false, label = "Category" }) => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newCategory, setNewCategory] = useState({
    name: '',
    description: '',
    color: '#667eea'
  });
  const [creating, setCreating] = useState(false);
  
  const user = useSelector(state => state.user);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${serverURL}/api/category`);
      setCategories(response.data.categories || []);
    } catch (err) {
      console.error('Error fetching categories:', err);
      setError('Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategory.name.trim()) {
      setError('Category name is required');
      return;
    }

    try {
      setCreating(true);
      const response = await axios.post(`${serverURL}/api/category`, {
        ...newCategory,
        createdBy: user._id
      });
      
      const createdCategory = response.data.category;
      setCategories(prev => [...prev, createdCategory]);
      onChange({ target: { value: createdCategory.name } });
      setCreateDialogOpen(false);
      setNewCategory({ name: '', description: '', color: '#667eea' });
      setError('');
    } catch (err) {
      console.error('Error creating category:', err);
      setError(err.response?.data?.message || 'Failed to create category');
    } finally {
      setCreating(false);
    }
  };

  const handleCloseDialog = () => {
    setCreateDialogOpen(false);
    setNewCategory({ name: '', description: '', color: '#667eea' });
    setError('');
  };

  if (loading) {
    return (
      <StyledFormControl fullWidth>
        <Box display="flex" alignItems="center" gap={1} p={2}>
          <CircularProgress size={20} />
          <Typography>Loading categories...</Typography>
        </Box>
      </StyledFormControl>
    );
  }

  return (
    <>
      <StyledFormControl fullWidth>
        <InputLabel>{label}</InputLabel>
        <Select
          value={value}
          onChange={onChange}
          label={label}
          renderValue={(selected) => {
            const category = categories.find(c => c.name === selected);
            return category ? (
              <Box display="flex" alignItems="center" gap={1}>
                <Box
                  sx={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    backgroundColor: category.color
                  }}
                />
                <Typography>{category.name}</Typography>
                <Chip 
                  label={`${category.blogCount} blogs`} 
                  size="small" 
                  variant="outlined"
                />
              </Box>
            ) : selected;
          }}
        >
          {categories.map((category) => (
            <CategoryOption key={category._id} value={category.name}>
              <Box display="flex" alignItems="center" gap={2} width="100%">
                <Box
                  sx={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    backgroundColor: category.color
                  }}
                />
                <Box flex={1}>
                  <Typography variant="subtitle1" fontWeight={600}>
                    {category.name}
                  </Typography>
                  {category.description && (
                    <Typography variant="body2" color="text.secondary">
                      {category.description}
                    </Typography>
                  )}
                </Box>
                <Chip 
                  label={`${category.blogCount}`} 
                  size="small" 
                  variant="outlined"
                />
              </Box>
            </CategoryOption>
          ))}
          
          {allowCreate && user && ['admin', 'author'].includes(user.role) && (
            <CategoryOption onClick={() => setCreateDialogOpen(true)}>
              <Box display="flex" alignItems="center" gap={2} width="100%">
                <AddIcon color="primary" />
                <Typography color="primary" fontWeight={600}>
                  Create New Category
                </Typography>
              </Box>
            </CategoryOption>
          )}
        </Select>
      </StyledFormControl>

      {/* Create Category Dialog */}
      <Dialog 
        open={createDialogOpen} 
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <CategoryIcon color="primary" />
            Create New Category
          </Box>
        </DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          
          <TextField
            fullWidth
            label="Category Name"
            value={newCategory.name}
            onChange={(e) => setNewCategory(prev => ({ ...prev, name: e.target.value }))}
            margin="normal"
            required
          />
          
          <TextField
            fullWidth
            label="Description (Optional)"
            value={newCategory.description}
            onChange={(e) => setNewCategory(prev => ({ ...prev, description: e.target.value }))}
            margin="normal"
            multiline
            rows={2}
          />
          
          <Box mt={2}>
            <Typography variant="subtitle2" mb={1}>Category Color</Typography>
            <input
              type="color"
              value={newCategory.color}
              onChange={(e) => setNewCategory(prev => ({ ...prev, color: e.target.value }))}
              style={{
                width: '100%',
                height: '40px',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreateCategory}
            variant="contained"
            disabled={creating || !newCategory.name.trim()}
            startIcon={creating ? <CircularProgress size={20} /> : <AddIcon />}
          >
            {creating ? 'Creating...' : 'Create Category'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default CategorySelector;