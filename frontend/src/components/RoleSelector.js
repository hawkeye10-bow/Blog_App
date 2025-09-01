import React from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  Chip
} from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  AdminPanelSettings as AdminIcon,
  Edit as AuthorIcon,
  Visibility as ReaderIcon
} from '@mui/icons-material';

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

const RoleOption = styled(MenuItem)(({ theme }) => ({
  padding: theme.spacing(2),
  borderRadius: theme.spacing(1),
  margin: theme.spacing(0.5),
  transition: 'all 0.2s ease',
  '&:hover': {
    backgroundColor: 'rgba(102, 126, 234, 0.08)',
    transform: 'translateX(4px)',
  },
}));

const RoleSelector = ({ value, onChange, disabled = false, label = "Select Role" }) => {
  const roles = [
    {
      value: 'reader',
      label: 'Reader',
      description: 'Can read and interact with blog posts',
      icon: <ReaderIcon />,
      color: '#2196f3'
    },
    {
      value: 'author',
      label: 'Author',
      description: 'Can create, edit, and publish blog posts',
      icon: <AuthorIcon />,
      color: '#ff9800'
    },
    {
      value: 'admin',
      label: 'Admin',
      description: 'Full access to all features and user management',
      icon: <AdminIcon />,
      color: '#f44336'
    }
  ];

  const selectedRole = roles.find(role => role.value === value);

  return (
    <StyledFormControl fullWidth disabled={disabled}>
      <InputLabel>{label}</InputLabel>
      <Select
        value={value}
        onChange={onChange}
        label={label}
        renderValue={(selected) => {
          const role = roles.find(r => r.value === selected);
          return role ? (
            <Box display="flex" alignItems="center" gap={1}>
              {role.icon}
              <Typography>{role.label}</Typography>
              <Chip 
                label={role.value.toUpperCase()} 
                size="small" 
                sx={{ 
                  backgroundColor: role.color,
                  color: 'white',
                  fontWeight: 'bold'
                }}
              />
            </Box>
          ) : selected;
        }}
      >
        {roles.map((role) => (
          <RoleOption key={role.value} value={role.value}>
            <Box display="flex" alignItems="center" gap={2} width="100%">
              <Box sx={{ color: role.color }}>
                {role.icon}
              </Box>
              <Box flex={1}>
                <Typography variant="subtitle1" fontWeight={600}>
                  {role.label}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {role.description}
                </Typography>
              </Box>
              <Chip 
                label={role.value.toUpperCase()} 
                size="small" 
                sx={{ 
                  backgroundColor: role.color,
                  color: 'white',
                  fontWeight: 'bold'
                }}
              />
            </Box>
          </RoleOption>
        ))}
      </Select>
    </StyledFormControl>
  );
};

export default RoleSelector;