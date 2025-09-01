import React from 'react';
import {
  Box,
  Paper,
  Grid,
  IconButton,
  Typography,
  Tabs,
  Tab
} from '@mui/material';

const EmojiPicker = ({ onEmojiSelect }) => {
  const [activeTab, setActiveTab] = React.useState(0);

  const emojiCategories = [
    {
      name: 'Smileys',
      emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳']
    },
    {
      name: 'Gestures',
      emojis: ['👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕']
    },
    {
      name: 'Hearts',
      emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '♥️', '💌', '💋', '💯', '💢', '💥', '💫', '💦', '💨', '🕳️', '💬', '🗨️']
    },
    {
      name: 'Animals',
      emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴']
    },
    {
      name: 'Food',
      emojis: ['🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🥑', '🥦', '🥬', '🥒', '🌶️', '🌽', '🥕', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀']
    },
    {
      name: 'Activities',
      emojis: ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🥅', '⛳', '🥊', '🥋', '🎽', '🛹', '🛷', '⛸️', '🥌', '🎿', '⛷️', '🏂', '🏋️', '🤼']
    }
  ];

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleEmojiClick = (emoji) => {
    onEmojiSelect(emoji);
  };

  return (
    <Paper
      elevation={8}
      sx={{
        width: 320,
        maxHeight: 400,
        overflow: 'hidden',
        borderRadius: 2
      }}
    >
      {/* Header */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="subtitle2" sx={{ p: 1, textAlign: 'center' }}>
          Emoji
        </Typography>
      </Box>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={handleTabChange}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ borderBottom: 1, borderColor: 'divider' }}
      >
        {emojiCategories.map((category, index) => (
          <Tab
            key={index}
            label={category.name}
            sx={{ minWidth: 'auto', px: 1 }}
          />
        ))}
      </Tabs>

      {/* Emoji Grid */}
      <Box sx={{ p: 1, maxHeight: 300, overflow: 'auto' }}>
        <Grid container spacing={0.5}>
          {emojiCategories[activeTab].emojis.map((emoji, index) => (
            <Grid item key={index}>
              <IconButton
                size="small"
                onClick={() => handleEmojiClick(emoji)}
                sx={{
                  width: 32,
                  height: 32,
                  fontSize: '1.2rem',
                  '&:hover': {
                    bgcolor: 'action.hover'
                  }
                }}
              >
                {emoji}
              </IconButton>
            </Grid>
          ))}
        </Grid>
      </Box>
    </Paper>
  );
};

export default EmojiPicker;
