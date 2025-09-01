import React, { useState, useEffect } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Button,
    Radio,
    RadioGroup,
    FormControlLabel,
    Checkbox,
    FormGroup,
    LinearProgress,
    Chip,
    Avatar,
    IconButton,
    Tooltip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Alert,
    Divider,
    Grid,
    Paper
} from '@mui/material';
import {
    Poll,
    HowToVote,
    BarChart,
    Share,
    Edit,
    Delete,
    Visibility,
    VisibilityOff,
    Timer,
    CheckCircle,
    Cancel
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import socketService from '../services/socketService';

const PollComponent = ({ poll, blogId, onVote, onUpdate, onDelete, isCreator = false }) => {
    const [selectedOptions, setSelectedOptions] = useState([]);
    const [showResults, setShowResults] = useState(false);
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [editForm, setEditForm] = useState({
        question: poll.question,
        options: poll.options.map(opt => ({ text: opt.text, isCorrect: opt.isCorrect })),
        allowMultipleVotes: poll.allowMultipleVotes,
        isAnonymous: poll.isAnonymous,
        expiresAt: poll.expiresAt ? new Date(poll.expiresAt).toISOString().slice(0, 16) : ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        setupRealTimeUpdates();
        
        return () => {
            socketService.removeAllListeners();
        };
    }, [poll._id]);

    const setupRealTimeUpdates = () => {
        const socket = socketService.connect();
        
        socket.on('poll-vote-updated', (data) => {
            if (data.pollId === poll._id) {
                // Update poll data
                Object.assign(poll, data.poll);
                setShowResults(true);
            }
        });

        socket.on('poll-updated', (data) => {
            if (data.pollId === poll._id) {
                // Update poll data
                Object.assign(poll, data.poll);
            }
        });

        socket.on('poll-deleted', (data) => {
            if (data.pollId === poll._id) {
                // Handle poll deletion
                onDelete && onDelete(poll._id);
            }
        });
    };

    const handleOptionChange = (optionText, isChecked) => {
        if (poll.allowMultipleVotes) {
            if (isChecked) {
                setSelectedOptions(prev => [...prev, optionText]);
            } else {
                setSelectedOptions(prev => prev.filter(opt => opt !== optionText));
            }
        } else {
            setSelectedOptions([optionText]);
        }
    };

    const handleVote = async () => {
        if (selectedOptions.length === 0) {
            setError('Please select at least one option');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/poll/${poll._id}/vote`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    optionTexts: selectedOptions
                })
            });

            if (response.ok) {
                const data = await response.json();
                // Update poll data
                Object.assign(poll, data.poll);
                setSelectedOptions([]);
                setShowResults(true);
                onVote && onVote(data.poll);
            } else {
                const errorData = await response.json();
                setError(errorData.message || 'Failed to submit vote');
            }
        } catch (error) {
            setError('Error submitting vote');
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/poll/${poll._id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(editForm)
            });

            if (response.ok) {
                const data = await response.json();
                Object.assign(poll, data.poll);
                setShowEditDialog(false);
                onUpdate && onUpdate(data.poll);
            } else {
                const errorData = await response.json();
                setError(errorData.message || 'Failed to update poll');
            }
        } catch (error) {
            setError('Error updating poll');
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm('Are you sure you want to delete this poll?')) {
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/poll/${poll._id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                onDelete && onDelete(poll._id);
            } else {
                const errorData = await response.json();
                setError(errorData.message || 'Failed to delete poll');
            }
        } catch (error) {
            setError('Error deleting poll');
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const addOption = () => {
        setEditForm(prev => ({
            ...prev,
            options: [...prev.options, { text: '', isCorrect: false }]
        }));
    };

    const removeOption = (index) => {
        setEditForm(prev => ({
            ...prev,
            options: prev.options.filter((_, i) => i !== index)
        }));
    };

    const updateOption = (index, field, value) => {
        setEditForm(prev => ({
            ...prev,
            options: prev.options.map((opt, i) => 
                i === index ? { ...opt, [field]: value } : opt
            )
        }));
    };

    const isExpired = poll.expiresAt && new Date(poll.expiresAt) < new Date();
    const hasVoted = poll.userVotes && poll.userVotes.length > 0;
    const totalVotes = poll.totalVotes || 0;

    return (
        <Card sx={{ mb: 3 }}>
            <CardContent>
                {/* Poll Header */}
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                    <Box display="flex" alignItems="center" gap={1}>
                        <Poll color="primary" />
                        <Typography variant="h6" component="h3">
                            {poll.question}
                        </Typography>
                        {poll.type === 'quiz' && (
                            <Chip label="Quiz" color="secondary" size="small" />
                        )}
                    </Box>
                    <Box display="flex" gap={1}>
                        {isCreator && (
                            <>
                                <Tooltip title="Edit Poll">
                                    <IconButton size="small" onClick={() => setShowEditDialog(true)}>
                                        <Edit />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title="Delete Poll">
                                    <IconButton size="small" color="error" onClick={handleDelete}>
                                        <Delete />
                                    </IconButton>
                                </Tooltip>
                            </>
                        )}
                        <Tooltip title={showResults ? "Hide Results" : "Show Results"}>
                            <IconButton size="small" onClick={() => setShowResults(!showResults)}>
                                {showResults ? <VisibilityOff /> : <Visibility />}
                            </IconButton>
                        </Tooltip>
                    </Box>
                </Box>

                {/* Poll Info */}
                <Box display="flex" alignItems="center" gap={2} mb={2}>
                    <Chip
                        icon={<HowToVote />}
                        label={`${totalVotes} vote${totalVotes !== 1 ? 's' : ''}`}
                        size="small"
                    />
                    {poll.allowMultipleVotes && (
                        <Chip label="Multiple votes allowed" size="small" />
                    )}
                    {poll.isAnonymous && (
                        <Chip label="Anonymous" size="small" />
                    )}
                    {isExpired && (
                        <Chip label="Expired" color="error" size="small" />
                    )}
                    {poll.expiresAt && !isExpired && (
                        <Chip
                            icon={<Timer />}
                            label={`Expires ${formatDistanceToNow(new Date(poll.expiresAt), { addSuffix: true })}`}
                            size="small"
                        />
                    )}
                </Box>

                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}

                {/* Poll Options */}
                {!showResults && !isExpired && !hasVoted && (
                    <Box mb={3}>
                        <Typography variant="subtitle1" gutterBottom>
                            Select your answer{poll.allowMultipleVotes ? '(s)' : ''}:
                        </Typography>
                        
                        {poll.allowMultipleVotes ? (
                            <FormGroup>
                                {poll.options.map((option, index) => (
                                    <FormControlLabel
                                        key={index}
                                        control={
                                            <Checkbox
                                                checked={selectedOptions.includes(option.text)}
                                                onChange={(e) => handleOptionChange(option.text, e.target.checked)}
                                            />
                                        }
                                        label={option.text}
                                    />
                                ))}
                            </FormGroup>
                        ) : (
                            <RadioGroup
                                value={selectedOptions[0] || ''}
                                onChange={(e) => setSelectedOptions([e.target.value])}
                            >
                                {poll.options.map((option, index) => (
                                    <FormControlLabel
                                        key={index}
                                        value={option.text}
                                        control={<Radio />}
                                        label={option.text}
                                    />
                                ))}
                            </RadioGroup>
                        )}

                        <Button
                            variant="contained"
                            onClick={handleVote}
                            disabled={loading || selectedOptions.length === 0}
                            startIcon={<HowToVote />}
                            sx={{ mt: 2 }}
                        >
                            {loading ? 'Submitting...' : 'Submit Vote'}
                        </Button>
                    </Box>
                )}

                {/* Results */}
                {showResults && (
                    <Box>
                        <Typography variant="subtitle1" gutterBottom>
                            Results:
                        </Typography>
                        
                        {poll.options.map((option, index) => {
                            const votes = option.votes ? option.votes.length : 0;
                            const percentage = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
                            const isUserVote = poll.userVotes && poll.userVotes.includes(option.text);
                            
                            return (
                                <Box key={index} mb={2}>
                                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                                        <Box display="flex" alignItems="center" gap={1}>
                                            <Typography variant="body2">
                                                {option.text}
                                            </Typography>
                                            {isUserVote && (
                                                <CheckCircle color="primary" fontSize="small" />
                                            )}
                                            {option.isCorrect && poll.type === 'quiz' && (
                                                <Chip label="Correct" color="success" size="small" />
                                            )}
                                        </Box>
                                        <Typography variant="body2" color="textSecondary">
                                            {votes} vote{votes !== 1 ? 's' : ''} ({percentage.toFixed(1)}%)
                                        </Typography>
                                    </Box>
                                    <LinearProgress
                                        variant="determinate"
                                        value={percentage}
                                        sx={{
                                            height: 8,
                                            borderRadius: 4,
                                            backgroundColor: 'grey.200',
                                            '& .MuiLinearProgress-bar': {
                                                backgroundColor: isUserVote ? 'primary.main' : 'grey.500'
                                            }
                                        }}
                                    />
                                </Box>
                            );
                        })}
                    </Box>
                )}

                {/* User's Vote Display */}
                {hasVoted && !showResults && (
                    <Box>
                        <Typography variant="subtitle1" gutterBottom>
                            Your vote{selectedOptions.length > 1 ? 's' : ''}:
                        </Typography>
                        <Box display="flex" gap={1} flexWrap="wrap">
                            {poll.userVotes.map((vote, index) => (
                                <Chip
                                    key={index}
                                    label={vote}
                                    color="primary"
                                    variant="outlined"
                                />
                            ))}
                        </Box>
                        <Button
                            variant="outlined"
                            onClick={() => setShowResults(true)}
                            startIcon={<BarChart />}
                            sx={{ mt: 2 }}
                        >
                            View Results
                        </Button>
                    </Box>
                )}

                {/* Poll Footer */}
                <Divider sx={{ my: 2 }} />
                <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="caption" color="textSecondary">
                        Created {formatDistanceToNow(new Date(poll.createdAt), { addSuffix: true })}
                    </Typography>
                    <Box display="flex" gap={1}>
                        <Button
                            size="small"
                            startIcon={<Share />}
                            onClick={() => {
                                navigator.share({
                                    title: `Poll: ${poll.question}`,
                                    text: `Check out this poll: ${poll.question}`,
                                    url: window.location.href
                                });
                            }}
                        >
                            Share
                        </Button>
                    </Box>
                </Box>
            </CardContent>

            {/* Edit Dialog */}
            <Dialog
                open={showEditDialog}
                onClose={() => setShowEditDialog(false)}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle>Edit Poll</DialogTitle>
                <DialogContent>
                    <TextField
                        fullWidth
                        label="Question"
                        value={editForm.question}
                        onChange={(e) => setEditForm(prev => ({ ...prev, question: e.target.value }))}
                        margin="normal"
                    />
                    
                    <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
                        Options:
                    </Typography>
                    
                    {editForm.options.map((option, index) => (
                        <Box key={index} display="flex" gap={1} alignItems="center" mb={1}>
                            <TextField
                                fullWidth
                                label={`Option ${index + 1}`}
                                value={option.text}
                                onChange={(e) => updateOption(index, 'text', e.target.value)}
                                size="small"
                            />
                            {poll.type === 'quiz' && (
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={option.isCorrect}
                                            onChange={(e) => updateOption(index, 'isCorrect', e.target.checked)}
                                        />
                                    }
                                    label="Correct"
                                />
                            )}
                            <IconButton
                                size="small"
                                color="error"
                                onClick={() => removeOption(index)}
                                disabled={editForm.options.length <= 2}
                            >
                                <Cancel />
                            </IconButton>
                        </Box>
                    ))}
                    
                    <Button onClick={addOption} sx={{ mt: 1 }}>
                        Add Option
                    </Button>
                    
                    <Box display="flex" gap={2} mt={2}>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={editForm.allowMultipleVotes}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, allowMultipleVotes: e.target.checked }))}
                                />
                            }
                            label="Allow multiple votes"
                        />
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={editForm.isAnonymous}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, isAnonymous: e.target.checked }))}
                                />
                            }
                            label="Anonymous poll"
                        />
                    </Box>
                    
                    <TextField
                        fullWidth
                        type="datetime-local"
                        label="Expires at (optional)"
                        value={editForm.expiresAt}
                        onChange={(e) => setEditForm(prev => ({ ...prev, expiresAt: e.target.value }))}
                        margin="normal"
                        InputLabelProps={{ shrink: true }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowEditDialog(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleEdit}
                        variant="contained"
                        disabled={loading || editForm.question.trim() === '' || editForm.options.some(opt => opt.text.trim() === '')}
                    >
                        {loading ? 'Updating...' : 'Update Poll'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Card>
    );
};

export default PollComponent;
