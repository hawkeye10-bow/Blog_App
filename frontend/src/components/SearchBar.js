import React, { useState, useEffect, useCallback } from 'react';
import {
  TextField,
  InputAdornment,
  IconButton,
  Box,
  Paper,
  List,
  ListItem,
  ListItemText,
  Typography,
  Chip,
  CircularProgress,
  Fade
} from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  TrendingUp as TrendingIcon
} from '@mui/icons-material';
import axios from 'axios';
import { serverURL } from '../helper/Helper';
import { useNavigate } from 'react-router-dom';

const SearchContainer = styled(Box)(({ theme }) => ({
  position: 'relative',
  width: '100%',
  maxWidth: '600px',
  margin: '0 auto',
}));

const StyledTextField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    borderRadius: theme.spacing(3),
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    backdropFilter: 'blur(20px)',
    border: '2px solid transparent',
    transition: 'all 0.3s ease',
    fontSize: '1.1rem',
    '&:hover': {
      backgroundColor: 'white',
      borderColor: 'rgba(102, 126, 234, 0.3)',
      boxShadow: '0 4px 20px rgba(102, 126, 234, 0.1)',
    },
    '&.Mui-focused': {
      backgroundColor: 'white',
      borderColor: '#667eea',
      boxShadow: '0 0 0 4px rgba(102, 126, 234, 0.15)',
    },
  },
  '& .MuiInputLabel-root': {
    color: theme.palette.text.secondary,
    fontWeight: 500,
  },
  '& .MuiInputLabel-root.Mui-focused': {
    color: '#667eea',
    fontWeight: 600,
  },
}));

const SearchResults = styled(Paper)(({ theme }) => ({
  position: 'absolute',
  top: '100%',
  left: 0,
  right: 0,
  zIndex: 1000,
  marginTop: theme.spacing(1),
  borderRadius: theme.spacing(2),
  backgroundColor: 'rgba(255, 255, 255, 0.95)',
  backdropFilter: 'blur(20px)',
  border: '1px solid rgba(255, 255, 255, 0.3)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
  maxHeight: '400px',
  overflow: 'auto',
}));

const SearchResultItem = styled(ListItem)(({ theme }) => ({
  cursor: 'pointer',
  borderRadius: theme.spacing(1),
  margin: theme.spacing(0.5, 1),
  transition: 'all 0.2s ease',
  '&:hover': {
    backgroundColor: 'rgba(102, 126, 234, 0.08)',
    transform: 'translateX(4px)',
  },
}));

const SearchBar = ({ onSearchResults, placeholder = "Search blogs..." }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const navigate = useNavigate();

  // Debounced search
  const debounceTimeoutRef = React.useRef(null);

  const performSearch = useCallback(async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    setLoading(true);
    try {
      const response = await axios.get(`${serverURL}/api/blog/search?query=${encodeURIComponent(query)}&limit=5`);
      const results = response.data.blogs || [];
      setSearchResults(results);
      setShowResults(true);
      
      // Call parent callback if provided
      if (onSearchResults) {
        onSearchResults(results, query);
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  }, [onSearchResults]);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);

    // Clear previous timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Set new timeout for debounced search
    debounceTimeoutRef.current = setTimeout(() => {
      performSearch(value);
    }, 300);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Add to recent searches
      const newRecentSearches = [
        searchQuery.trim(),
        ...recentSearches.filter(s => s !== searchQuery.trim())
      ].slice(0, 5);
      setRecentSearches(newRecentSearches);
      localStorage.setItem('recentSearches', JSON.stringify(newRecentSearches));
      
      // Navigate to search results page or trigger search
      performSearch(searchQuery);
      setShowResults(false);
    }
  };

  const handleResultClick = (blog) => {
    setSearchQuery('');
    setShowResults(false);
    // Navigate to blog detail or handle as needed
    navigate(`/blogs/${blog._id}`);
  };

  const handleClear = () => {
    setSearchQuery('');
    setSearchResults([]);
    setShowResults(false);
    if (onSearchResults) {
      onSearchResults([], '');
    }
  };

  const handleFocus = () => {
    if (searchResults.length > 0) {
      setShowResults(true);
    }
  };

  const handleBlur = () => {
    // Delay hiding results to allow for clicks
    setTimeout(() => {
      setShowResults(false);
    }, 200);
  };

  // Load recent searches on mount
  useEffect(() => {
    const saved = localStorage.getItem('recentSearches');
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch (error) {
        console.error('Error loading recent searches:', error);
      }
    }
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  const truncateText = (text, maxLength = 100) => {
    return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
  };

  return (
    <SearchContainer>
      <form onSubmit={handleSearchSubmit}>
        <StyledTextField
          fullWidth
          placeholder={placeholder}
          value={searchQuery}
          onChange={handleSearchChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" sx={{ fontSize: '1.5rem' }} />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                {loading && <CircularProgress size={20} />}
                {searchQuery && !loading && (
                  <IconButton onClick={handleClear} size="small">
                    <ClearIcon />
                  </IconButton>
                )}
              </InputAdornment>
            ),
          }}
        />
      </form>

      {/* Search Results Dropdown */}
      <Fade in={showResults}>
        <SearchResults>
          {searchResults.length > 0 ? (
            <List>
              {searchResults.map((blog) => (
                <SearchResultItem
                  key={blog._id}
                  onClick={() => handleResultClick(blog)}
                >
                  <ListItemText
                    primary={
                      <Typography variant="subtitle1" fontWeight={600}>
                        {blog.title}
                      </Typography>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          {truncateText(blog.description)}
                        </Typography>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Chip
                            label={blog.user.name}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                          <Typography variant="caption" color="text.secondary">
                            {new Date(blog.createdAt).toLocaleDateString()}
                          </Typography>
                        </Box>
                      </Box>
                    }
                  />
                </SearchResultItem>
              ))}
            </List>
          ) : searchQuery && !loading ? (
            <Box p={3} textAlign="center">
              <Typography variant="body2" color="text.secondary">
                No blogs found for "{searchQuery}"
              </Typography>
            </Box>
          ) : recentSearches.length > 0 && !searchQuery ? (
            <Box p={2}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <TrendingIcon fontSize="small" />
                Recent Searches
              </Typography>
              <Box display="flex" flexWrap="wrap" gap={1}>
                {recentSearches.map((search, index) => (
                  <Chip
                    key={index}
                    label={search}
                    size="small"
                    onClick={() => {
                      setSearchQuery(search);
                      performSearch(search);
                    }}
                    sx={{ cursor: 'pointer' }}
                  />
                ))}
              </Box>
            </Box>
          ) : null}
        </SearchResults>
      </Fade>
    </SearchContainer>
  );
};

export default SearchBar;