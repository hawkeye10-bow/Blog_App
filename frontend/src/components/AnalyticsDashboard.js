import React, { useState, useEffect } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Grid,
    Tabs,
    Tab,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Chip,
    IconButton,
    Tooltip,
    LinearProgress,
    CircularProgress,
    Alert,
    Button,
    Select,
    MenuItem,
    FormControl,
    InputLabel
} from '@mui/material';
import {
    Visibility,
    ThumbUp,
    Comment,
    Share,
    Bookmark,
    TrendingUp,
    People,
    Timeline,
    Refresh,
    Download,
    Analytics as AnalyticsIcon,
    ShowChart,
    Assessment
} from '@mui/icons-material';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip as ChartTooltip,
    Legend,
    ArcElement,
    BarElement
} from 'chart.js';
import { formatDistanceToNow } from 'date-fns';
import socketService from '../services/socketService';

// Register Chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    ChartTooltip,
    Legend,
    ArcElement,
    BarElement
);

const AnalyticsDashboard = ({ blogId, isAdmin = false }) => {
    const [activeTab, setActiveTab] = useState(0);
    const [period, setPeriod] = useState('30d');
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [realTimeData, setRealTimeData] = useState({
        currentViewers: 0,
        recentActivity: []
    });

    useEffect(() => {
        fetchAnalytics();
        setupRealTimeUpdates();
        
        return () => {
            // Cleanup socket listeners
            socketService.removeAllListeners();
        };
    }, [blogId, period]);

    const setupRealTimeUpdates = () => {
        const socket = socketService.connect();
        
        socket.on('page-view-tracked', (data) => {
            if (data.blogId === blogId) {
                updateRealTimeData();
            }
        });

        socket.on('engagement-tracked', (data) => {
            if (data.blogId === blogId) {
                updateRealTimeData();
            }
        });

        // Update real-time data every 30 seconds
        const interval = setInterval(updateRealTimeData, 30000);
        
        return () => clearInterval(interval);
    };

    const updateRealTimeData = async () => {
        try {
            const response = await fetch(`/api/analytics/blog/${blogId}/realtime`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                setRealTimeData(data.analytics);
            }
        } catch (error) {
            console.error('Error updating real-time data:', error);
        }
    };

    const fetchAnalytics = async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/analytics/blog/${blogId}?period=${period}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setAnalytics(data.analytics);
            } else {
                setError('Failed to fetch analytics data');
            }
        } catch (error) {
            setError('Error fetching analytics data');
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleTabChange = (event, newValue) => {
        setActiveTab(newValue);
    };

    const handlePeriodChange = (event) => {
        setPeriod(event.target.value);
    };

    const exportAnalytics = () => {
        if (!analytics) return;
        
        const dataStr = JSON.stringify(analytics, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `analytics-${blogId}-${period}.json`;
        link.click();
        URL.revokeObjectURL(url);
    };

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Alert severity="error" sx={{ mb: 2 }}>
                {error}
            </Alert>
        );
    }

    if (!analytics) {
        return (
            <Alert severity="info">
                No analytics data available for this blog.
            </Alert>
        );
    }

    const { overview, trends, demographics, realTime } = analytics;

    // Chart data for trends
    const trendsChartData = {
        labels: trends.views?.map(item => item.date) || [],
        datasets: [
            {
                label: 'Views',
                data: trends.views?.map(item => item.count) || [],
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                tension: 0.1
            },
            {
                label: 'Likes',
                data: trends.likes?.map(item => item.count) || [],
                borderColor: 'rgb(255, 99, 132)',
                backgroundColor: 'rgba(255, 99, 132, 0.2)',
                tension: 0.1
            },
            {
                label: 'Comments',
                data: trends.comments?.map(item => item.count) || [],
                borderColor: 'rgb(54, 162, 235)',
                backgroundColor: 'rgba(54, 162, 235, 0.2)',
                tension: 0.1
            }
        ]
    };

    // Chart data for demographics
    const deviceChartData = {
        labels: demographics.devices?.map(item => item.device) || [],
        datasets: [{
            data: demographics.devices?.map(item => item.count) || [],
            backgroundColor: [
                '#FF6384',
                '#36A2EB',
                '#FFCE56',
                '#4BC0C0',
                '#9966FF'
            ]
        }]
    };

    const browserChartData = {
        labels: demographics.browsers?.map(item => item.browser) || [],
        datasets: [{
            data: demographics.browsers?.map(item => item.count) || [],
            backgroundColor: [
                '#FF6384',
                '#36A2EB',
                '#FFCE56',
                '#4BC0C0',
                '#9966FF'
            ]
        }]
    };

    return (
        <Box sx={{ p: 3 }}>
            {/* Header */}
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Box display="flex" alignItems="center" gap={2}>
                    <AnalyticsIcon color="primary" sx={{ fontSize: 32 }} />
                    <Typography variant="h4" component="h1">
                        Analytics Dashboard
                    </Typography>
                </Box>
                <Box display="flex" gap={2}>
                    <FormControl size="small">
                        <InputLabel>Period</InputLabel>
                        <Select
                            value={period}
                            label="Period"
                            onChange={handlePeriodChange}
                        >
                            <MenuItem value="7d">Last 7 days</MenuItem>
                            <MenuItem value="30d">Last 30 days</MenuItem>
                            <MenuItem value="90d">Last 90 days</MenuItem>
                            <MenuItem value="1y">Last year</MenuItem>
                        </Select>
                    </FormControl>
                    <Button
                        variant="outlined"
                        startIcon={<Refresh />}
                        onClick={fetchAnalytics}
                    >
                        Refresh
                    </Button>
                    <Button
                        variant="contained"
                        startIcon={<Download />}
                        onClick={exportAnalytics}
                    >
                        Export
                    </Button>
                </Box>
            </Box>

            {/* Overview Cards */}
            <Grid container spacing={3} mb={3}>
                <Grid item xs={12} sm={6} md={3}>
                    <Card>
                        <CardContent>
                            <Box display="flex" alignItems="center" gap={2}>
                                <Visibility color="primary" />
                                <Box>
                                    <Typography variant="h4" component="div">
                                        {overview.totalViews.toLocaleString()}
                                    </Typography>
                                    <Typography color="textSecondary">
                                        Total Views
                                    </Typography>
                                </Box>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Card>
                        <CardContent>
                            <Box display="flex" alignItems="center" gap={2}>
                                <ThumbUp color="primary" />
                                <Box>
                                    <Typography variant="h4" component="div">
                                        {overview.totalLikes.toLocaleString()}
                                    </Typography>
                                    <Typography color="textSecondary">
                                        Total Likes
                                    </Typography>
                                </Box>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Card>
                        <CardContent>
                            <Box display="flex" alignItems="center" gap={2}>
                                <Comment color="primary" />
                                <Box>
                                    <Typography variant="h4" component="div">
                                        {overview.totalComments.toLocaleString()}
                                    </Typography>
                                    <Typography color="textSecondary">
                                        Total Comments
                                    </Typography>
                                </Box>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Card>
                        <CardContent>
                            <Box display="flex" alignItems="center" gap={2}>
                                <TrendingUp color="primary" />
                                <Box>
                                    <Typography variant="h4" component="div">
                                        {overview.engagementRate}%
                                    </Typography>
                                    <Typography color="textSecondary">
                                        Engagement Rate
                                    </Typography>
                                </Box>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Real-time Activity */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" gutterBottom>
                        Real-time Activity
                    </Typography>
                    <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                            <Box display="flex" alignItems="center" gap={2}>
                                <People color="primary" />
                                <Typography variant="h5">
                                    {realTimeData.currentViewers || 0}
                                </Typography>
                                <Typography color="textSecondary">
                                    Active Viewers
                                </Typography>
                            </Box>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <Box display="flex" alignItems="center" gap={2}>
                                <Timeline color="primary" />
                                <Typography variant="h5">
                                    {realTimeData.recentActivity?.length || 0}
                                </Typography>
                                <Typography color="textSecondary">
                                    Recent Activities
                                </Typography>
                            </Box>
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>

            {/* Tabs */}
            <Card>
                <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                    <Tabs value={activeTab} onChange={handleTabChange}>
                        <Tab label="Trends" icon={<ShowChart />} />
                        <Tab label="Demographics" icon={<Assessment />} />
                        <Tab label="Performance" icon={<TrendingUp />} />
                    </Tabs>
                </Box>

                <CardContent>
                    {/* Trends Tab */}
                    {activeTab === 0 && (
                        <Box>
                            <Typography variant="h6" gutterBottom>
                                Engagement Trends
                            </Typography>
                            <Box sx={{ height: 400, mb: 3 }}>
                                <Line
                                    data={trendsChartData}
                                    options={{
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        plugins: {
                                            legend: {
                                                position: 'top',
                                            },
                                            title: {
                                                display: true,
                                                text: 'Engagement Over Time'
                                            }
                                        },
                                        scales: {
                                            y: {
                                                beginAtZero: true
                                            }
                                        }
                                    }}
                                />
                            </Box>
                        </Box>
                    )}

                    {/* Demographics Tab */}
                    {activeTab === 1 && (
                        <Grid container spacing={3}>
                            <Grid item xs={12} md={6}>
                                <Typography variant="h6" gutterBottom>
                                    Device Distribution
                                </Typography>
                                <Box sx={{ height: 300 }}>
                                    <Doughnut
                                        data={deviceChartData}
                                        options={{
                                            responsive: true,
                                            maintainAspectRatio: false,
                                            plugins: {
                                                legend: {
                                                    position: 'bottom'
                                                }
                                            }
                                        }}
                                    />
                                </Box>
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <Typography variant="h6" gutterBottom>
                                    Browser Distribution
                                </Typography>
                                <Box sx={{ height: 300 }}>
                                    <Doughnut
                                        data={browserChartData}
                                        options={{
                                            responsive: true,
                                            maintainAspectRatio: false,
                                            plugins: {
                                                legend: {
                                                    position: 'bottom'
                                                }
                                            }
                                        }}
                                    />
                                </Box>
                            </Grid>
                        </Grid>
                    )}

                    {/* Performance Tab */}
                    {activeTab === 2 && (
                        <Box>
                            <Typography variant="h6" gutterBottom>
                                Performance Metrics
                            </Typography>
                            <Grid container spacing={3}>
                                <Grid item xs={12} md={6}>
                                    <Typography variant="subtitle1" gutterBottom>
                                        Bounce Rate
                                    </Typography>
                                    <Box display="flex" alignItems="center" gap={2}>
                                        <LinearProgress
                                            variant="determinate"
                                            value={overview.bounceRate}
                                            sx={{ flexGrow: 1 }}
                                        />
                                        <Typography variant="body2">
                                            {overview.bounceRate}%
                                        </Typography>
                                    </Box>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <Typography variant="subtitle1" gutterBottom>
                                        Engagement Rate
                                    </Typography>
                                    <Box display="flex" alignItems="center" gap={2}>
                                        <LinearProgress
                                            variant="determinate"
                                            value={overview.engagementRate}
                                            sx={{ flexGrow: 1 }}
                                        />
                                        <Typography variant="body2">
                                            {overview.engagementRate}%
                                        </Typography>
                                    </Box>
                                </Grid>
                            </Grid>

                            {/* Recent Activity Table */}
                            <Box mt={3}>
                                <Typography variant="h6" gutterBottom>
                                    Recent Activity
                                </Typography>
                                <TableContainer component={Paper}>
                                    <Table>
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>Type</TableCell>
                                                <TableCell>User</TableCell>
                                                <TableCell>Time</TableCell>
                                                <TableCell>Details</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {realTimeData.recentActivity?.slice(0, 10).map((activity, index) => (
                                                <TableRow key={index}>
                                                    <TableCell>
                                                        <Chip
                                                            label={activity.type}
                                                            color={
                                                                activity.type === 'like' ? 'primary' :
                                                                activity.type === 'comment' ? 'secondary' :
                                                                activity.type === 'share' ? 'success' : 'default'
                                                            }
                                                            size="small"
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        {activity.user?.name || 'Anonymous'}
                                                    </TableCell>
                                                    <TableCell>
                                                        {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                                                    </TableCell>
                                                    <TableCell>
                                                        {activity.metadata?.comment || '-'}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </Box>
                        </Box>
                    )}
                </CardContent>
            </Card>
        </Box>
    );
};

export default AnalyticsDashboard;
