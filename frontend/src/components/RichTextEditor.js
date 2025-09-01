import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Toolbar,
  IconButton,
  Divider,
  Typography,
  Tooltip,
  ButtonGroup,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button
} from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  FormatBold as BoldIcon,
  FormatItalic as ItalicIcon,
  FormatUnderlined as UnderlineIcon,
  FormatListBulleted as BulletListIcon,
  FormatListNumbered as NumberListIcon,
  FormatQuote as QuoteIcon,
  Code as CodeIcon,
  Link as LinkIcon,
  Image as ImageIcon,
  FormatSize as HeaderIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  Preview as PreviewIcon
} from '@mui/icons-material';

const EditorContainer = styled(Paper)(({ theme }) => ({
  border: '2px solid transparent',
  borderRadius: theme.spacing(2),
  overflow: 'hidden',
  transition: 'all 0.3s ease',
  '&:hover': {
    borderColor: 'rgba(102, 126, 234, 0.3)',
  },
  '&.focused': {
    borderColor: '#667eea',
    boxShadow: '0 0 0 3px rgba(102, 126, 234, 0.1)',
  },
}));

const EditorToolbar = styled(Toolbar)(({ theme }) => ({
  backgroundColor: 'rgba(248, 250, 252, 0.8)',
  borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
  minHeight: '56px',
  padding: theme.spacing(1, 2),
  gap: theme.spacing(1),
  flexWrap: 'wrap',
}));

const EditorContent = styled(Box)(({ theme }) => ({
  minHeight: '300px',
  padding: theme.spacing(2),
  fontSize: '1rem',
  lineHeight: 1.6,
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  '&:focus': {
    outline: 'none',
  },
  '& h1, & h2, & h3, & h4, & h5, & h6': {
    fontFamily: "'Outfit', sans-serif",
    fontWeight: 700,
    margin: theme.spacing(2, 0, 1, 0),
  },
  '& h1': { fontSize: '2rem' },
  '& h2': { fontSize: '1.75rem' },
  '& h3': { fontSize: '1.5rem' },
  '& p': {
    margin: theme.spacing(1, 0),
  },
  '& blockquote': {
    borderLeft: `4px solid ${theme.palette.primary.main}`,
    paddingLeft: theme.spacing(2),
    margin: theme.spacing(2, 0),
    fontStyle: 'italic',
    backgroundColor: 'rgba(102, 126, 234, 0.05)',
    padding: theme.spacing(1, 2),
    borderRadius: theme.spacing(1),
  },
  '& code': {
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    padding: theme.spacing(0.5, 1),
    borderRadius: theme.spacing(0.5),
    fontFamily: 'monospace',
  },
  '& pre': {
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    padding: theme.spacing(2),
    borderRadius: theme.spacing(1),
    overflow: 'auto',
    '& code': {
      backgroundColor: 'transparent',
      padding: 0,
    },
  },
  '& ul, & ol': {
    paddingLeft: theme.spacing(3),
  },
  '& img': {
    maxWidth: '100%',
    height: 'auto',
    borderRadius: theme.spacing(1),
    margin: theme.spacing(1, 0),
  },
  '& a': {
    color: theme.palette.primary.main,
    textDecoration: 'none',
    '&:hover': {
      textDecoration: 'underline',
    },
  },
}));

const PreviewContainer = styled(Box)(({ theme }) => ({
  padding: theme.spacing(3),
  backgroundColor: 'rgba(248, 250, 252, 0.5)',
  borderRadius: theme.spacing(2),
  border: '1px solid rgba(0, 0, 0, 0.08)',
}));

const RichTextEditor = ({ 
  value, 
  onChange, 
  placeholder = "Start writing your blog content...",
  minHeight = 300,
  showPreview = false 
}) => {
  const [focused, setFocused] = useState(false);
  const [showPreviewMode, setShowPreviewMode] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageAlt, setImageAlt] = useState('');
  const [headerMenuAnchor, setHeaderMenuAnchor] = useState(null);
  
  const editorRef = useRef(null);
  const [history, setHistory] = useState([value]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Update history when content changes
  useEffect(() => {
    if (value !== history[historyIndex]) {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(value);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    }
  }, [value]);

  const insertText = (before, after = '', placeholder = '') => {
    const textarea = editorRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    const textToInsert = selectedText || placeholder;
    
    const newValue = 
      value.substring(0, start) + 
      before + textToInsert + after + 
      value.substring(end);
    
    onChange({ target: { value: newValue } });
    
    // Set cursor position
    setTimeout(() => {
      const newCursorPos = start + before.length + textToInsert.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      textarea.focus();
    }, 0);
  };

  const insertAtCursor = (text) => {
    const textarea = editorRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const newValue = 
      value.substring(0, start) + 
      text + 
      value.substring(start);
    
    onChange({ target: { value: newValue } });
    
    setTimeout(() => {
      textarea.setSelectionRange(start + text.length, start + text.length);
      textarea.focus();
    }, 0);
  };

  const handleBold = () => insertText('**', '**', 'bold text');
  const handleItalic = () => insertText('*', '*', 'italic text');
  const handleUnderline = () => insertText('<u>', '</u>', 'underlined text');
  const handleBulletList = () => insertText('\n- ', '', 'list item');
  const handleNumberList = () => insertText('\n1. ', '', 'list item');
  const handleQuote = () => insertText('\n> ', '', 'quote text');
  const handleCode = () => insertText('`', '`', 'code');

  const handleHeader = (level) => {
    const headerPrefix = '#'.repeat(level) + ' ';
    insertText('\n' + headerPrefix, '', `Heading ${level}`);
    setHeaderMenuAnchor(null);
  };

  const handleInsertLink = () => {
    if (linkUrl && linkText) {
      insertAtCursor(`[${linkText}](${linkUrl})`);
      setLinkDialogOpen(false);
      setLinkUrl('');
      setLinkText('');
    }
  };

  const handleInsertImage = () => {
    if (imageUrl) {
      const altText = imageAlt || 'Image';
      insertAtCursor(`![${altText}](${imageUrl})`);
      setImageDialogOpen(false);
      setImageUrl('');
      setImageAlt('');
    }
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      onChange({ target: { value: history[newIndex] } });
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      onChange({ target: { value: history[newIndex] } });
    }
  };

  // Convert markdown to HTML for preview
  const markdownToHtml = (markdown) => {
    return markdown
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*)\*/gim, '<em>$1</em>')
      .replace(/<u>(.*)<\/u>/gim, '<u>$1</u>')
      .replace(/`(.*)`/gim, '<code>$1</code>')
      .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>')
      .replace(/^\- (.*$)/gim, '<li>$1</li>')
      .replace(/^\d+\. (.*$)/gim, '<li>$1</li>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" target="_blank">$1</a>')
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/gim, '<img src="$2" alt="$1" style="max-width: 100%; height: auto;" />')
      .replace(/\n/gim, '<br>');
  };

  return (
    <Box>
      <EditorContainer className={focused ? 'focused' : ''}>
        {/* Toolbar */}
        <EditorToolbar variant="dense">
          {/* History Controls */}
          <ButtonGroup size="small">
            <Tooltip title="Undo">
              <IconButton 
                onClick={handleUndo} 
                disabled={historyIndex === 0}
                size="small"
              >
                <UndoIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Redo">
              <IconButton 
                onClick={handleRedo} 
                disabled={historyIndex === history.length - 1}
                size="small"
              >
                <RedoIcon />
              </IconButton>
            </Tooltip>
          </ButtonGroup>

          <Divider orientation="vertical" flexItem />

          {/* Text Formatting */}
          <ButtonGroup size="small">
            <Tooltip title="Bold">
              <IconButton onClick={handleBold} size="small">
                <BoldIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Italic">
              <IconButton onClick={handleItalic} size="small">
                <ItalicIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Underline">
              <IconButton onClick={handleUnderline} size="small">
                <UnderlineIcon />
              </IconButton>
            </Tooltip>
          </ButtonGroup>

          <Divider orientation="vertical" flexItem />

          {/* Headers */}
          <Tooltip title="Headers">
            <IconButton 
              onClick={(e) => setHeaderMenuAnchor(e.currentTarget)}
              size="small"
            >
              <HeaderIcon />
            </IconButton>
          </Tooltip>

          <Divider orientation="vertical" flexItem />

          {/* Lists and Blocks */}
          <ButtonGroup size="small">
            <Tooltip title="Bullet List">
              <IconButton onClick={handleBulletList} size="small">
                <BulletListIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Numbered List">
              <IconButton onClick={handleNumberList} size="small">
                <NumberListIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Quote">
              <IconButton onClick={handleQuote} size="small">
                <QuoteIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Code">
              <IconButton onClick={handleCode} size="small">
                <CodeIcon />
              </IconButton>
            </Tooltip>
          </ButtonGroup>

          <Divider orientation="vertical" flexItem />

          {/* Media */}
          <ButtonGroup size="small">
            <Tooltip title="Insert Link">
              <IconButton onClick={() => setLinkDialogOpen(true)} size="small">
                <LinkIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Insert Image">
              <IconButton onClick={() => setImageDialogOpen(true)} size="small">
                <ImageIcon />
              </IconButton>
            </Tooltip>
          </ButtonGroup>

          <Box sx={{ flexGrow: 1 }} />

          {/* Preview Toggle */}
          {showPreview && (
            <Tooltip title="Toggle Preview">
              <IconButton 
                onClick={() => setShowPreviewMode(!showPreviewMode)}
                size="small"
                color={showPreviewMode ? 'primary' : 'default'}
              >
                <PreviewIcon />
              </IconButton>
            </Tooltip>
          )}
        </EditorToolbar>

        {/* Editor Content */}
        {!showPreviewMode ? (
          <TextField
            ref={editorRef}
            multiline
            fullWidth
            value={value}
            onChange={onChange}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={placeholder}
            variant="outlined"
            InputProps={{
              style: {
                minHeight: minHeight,
                fontSize: '1rem',
                lineHeight: 1.6,
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              },
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                '& fieldset': {
                  border: 'none',
                },
              },
            }}
          />
        ) : (
          <PreviewContainer>
            <Typography variant="h6" color="primary" mb={2}>
              Preview
            </Typography>
            <Box
              dangerouslySetInnerHTML={{
                __html: markdownToHtml(value)
              }}
              sx={{
                '& h1, & h2, & h3, & h4, & h5, & h6': {
                  fontFamily: "'Outfit', sans-serif",
                  fontWeight: 700,
                },
                '& p': {
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  lineHeight: 1.6,
                },
              }}
            />
          </PreviewContainer>
        )}
      </EditorContainer>

      {/* Header Menu */}
      <Menu
        anchorEl={headerMenuAnchor}
        open={Boolean(headerMenuAnchor)}
        onClose={() => setHeaderMenuAnchor(null)}
      >
        {[1, 2, 3, 4, 5, 6].map(level => (
          <MenuItem key={level} onClick={() => handleHeader(level)}>
            <Typography variant={`h${level}`} component="span">
              Heading {level}
            </Typography>
          </MenuItem>
        ))}
      </Menu>

      {/* Link Dialog */}
      <Dialog open={linkDialogOpen} onClose={() => setLinkDialogOpen(false)}>
        <DialogTitle>Insert Link</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Link Text"
            value={linkText}
            onChange={(e) => setLinkText(e.target.value)}
            margin="normal"
          />
          <TextField
            fullWidth
            label="URL"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            margin="normal"
            placeholder="https://example.com"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLinkDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleInsertLink} variant="contained">Insert</Button>
        </DialogActions>
      </Dialog>

      {/* Image Dialog */}
      <Dialog open={imageDialogOpen} onClose={() => setImageDialogOpen(false)}>
        <DialogTitle>Insert Image</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Image URL"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            margin="normal"
            placeholder="https://example.com/image.jpg"
          />
          <TextField
            fullWidth
            label="Alt Text (Optional)"
            value={imageAlt}
            onChange={(e) => setImageAlt(e.target.value)}
            margin="normal"
            placeholder="Describe the image"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImageDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleInsertImage} variant="contained">Insert</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RichTextEditor;