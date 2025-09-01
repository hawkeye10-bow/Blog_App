import Poll from "../model/Poll.js";
import Blog from "../model/Blog.js";
import User from "../model/User.js";
import Notification from "../model/Notification.js";
import { io } from "../app.js";

// Create a new poll
export const createPoll = async (req, res) => {
    try {
        const { blogId, question, type, options, allowMultipleVotes, isAnonymous, expiresAt } = req.body;
        const userId = req.user.id;

        // Verify blog exists and user has permission
        const blog = await Blog.findById(blogId);
        if (!blog) {
            return res.status(404).json({ message: "Blog not found" });
        }

        if (blog.user.toString() !== userId && blog.collaborators.find(c => c.user.toString() === userId && c.role === 'editor')) {
            return res.status(403).json({ message: "You don't have permission to create polls for this blog" });
        }

        // Validate options
        if (!options || options.length < 2) {
            return res.status(400).json({ message: "Poll must have at least 2 options" });
        }

        if (type === 'single_choice' && allowMultipleVotes) {
            return res.status(400).json({ message: "Single choice polls cannot allow multiple votes" });
        }

        const poll = new Poll({
            blog: blogId,
            question,
            type,
            options: options.map(option => ({ text: option.text, isCorrect: option.isCorrect || false })),
            allowMultipleVotes,
            isAnonymous,
            expiresAt,
            createdBy: userId
        });

        await poll.save();

        // Populate creator info
        await poll.populate('createdBy', 'name profile.profilePicture');

        // Emit real-time update
        io.to(`blog-${blogId}`).emit('poll-created', {
            poll,
            blogId
        });

        res.status(201).json({
            message: "Poll created successfully",
            poll
        });

    } catch (error) {
        console.error("Error creating poll:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Get polls for a blog
export const getBlogPolls = async (req, res) => {
    try {
        const { blogId } = req.params;
        const userId = req.user?.id;

        const polls = await Poll.find({ blog: blogId, isActive: true })
            .populate('createdBy', 'name profile.profilePicture')
            .sort({ createdAt: -1 });

        // If user is logged in, show their votes
        if (userId) {
            const pollsWithUserVotes = polls.map(poll => {
                const pollObj = poll.toObject();
                const userVotes = poll.options.filter(option => 
                    option.votes.some(vote => vote.user.toString() === userId)
                );
                pollObj.userVotes = userVotes.map(option => option.text);
                pollObj.hasVoted = userVotes.length > 0;
                return pollObj;
            });

            return res.json({
                polls: pollsWithUserVotes
            });
        }

        res.json({ polls });

    } catch (error) {
        console.error("Error getting blog polls:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Vote on a poll
export const voteOnPoll = async (req, res) => {
    try {
        const { pollId } = req.params;
        const { optionTexts } = req.body; // Array of option texts
        const userId = req.user.id;

        const poll = await Poll.findById(pollId);
        if (!poll) {
            return res.status(404).json({ message: "Poll not found" });
        }

        if (!poll.isActive) {
            return res.status(400).json({ message: "Poll is not active" });
        }

        if (poll.expiresAt && poll.expiresAt < new Date()) {
            return res.status(400).json({ message: "Poll has expired" });
        }

        // Check if user has already voted
        const hasVoted = poll.options.some(option => 
            option.votes.some(vote => vote.user.toString() === userId)
        );

        if (hasVoted && !poll.allowMultipleVotes) {
            return res.status(400).json({ message: "You have already voted on this poll" });
        }

        // Validate option texts
        const validOptions = poll.options.filter(option => 
            optionTexts.includes(option.text)
        );

        if (validOptions.length !== optionTexts.length) {
            return res.status(400).json({ message: "Invalid option selected" });
        }

        // Add votes
        validOptions.forEach(option => {
            // Check if user already voted for this option
            const alreadyVoted = option.votes.some(vote => 
                vote.user.toString() === userId
            );

            if (!alreadyVoted) {
                option.votes.push({
                    user: userId,
                    votedAt: new Date()
                });
            }
        });

        await poll.save();

        // Create notification for poll creator (if not anonymous)
        if (!poll.isAnonymous && poll.createdBy.toString() !== userId) {
            const voter = await User.findById(userId);
            await Notification.createNotification({
                recipient: poll.createdBy,
                sender: userId,
                type: 'poll_vote',
                title: 'New Poll Vote',
                message: `${voter.name} voted on your poll "${poll.question}"`,
                data: {
                    poll: pollId,
                    blog: poll.blog
                }
            });
        }

        // Emit real-time update
        io.to(`blog-${poll.blog}`).emit('poll-vote-updated', {
            pollId,
            poll: await poll.populate('createdBy', 'name profile.profilePicture')
        });

        res.json({
            message: "Vote recorded successfully",
            poll: await poll.populate('createdBy', 'name profile.profilePicture')
        });

    } catch (error) {
        console.error("Error voting on poll:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Get poll results
export const getPollResults = async (req, res) => {
    try {
        const { pollId } = req.params;
        const userId = req.user?.id;

        const poll = await Poll.findById(pollId)
            .populate('createdBy', 'name profile.profilePicture');

        if (!poll) {
            return res.status(404).json({ message: "Poll not found" });
        }

        // Calculate results
        const results = poll.options.map(option => ({
            text: option.text,
            votes: option.votes.length,
            percentage: poll.totalVotes > 0 ? ((option.votes.length / poll.totalVotes) * 100).toFixed(1) : 0,
            isCorrect: option.isCorrect
        }));

        // Show user's vote if they're logged in
        let userVote = null;
        if (userId) {
            const votedOption = poll.options.find(option => 
                option.votes.some(vote => vote.user.toString() === userId)
            );
            if (votedOption) {
                userVote = votedOption.text;
            }
        }

        res.json({
            poll: {
                ...poll.toObject(),
                results,
                userVote
            }
        });

    } catch (error) {
        console.error("Error getting poll results:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Update poll
export const updatePoll = async (req, res) => {
    try {
        const { pollId } = req.params;
        const updates = req.body;
        const userId = req.user.id;

        const poll = await Poll.findById(pollId);
        if (!poll) {
            return res.status(404).json({ message: "Poll not found" });
        }

        // Check permissions
        if (poll.createdBy.toString() !== userId) {
            return res.status(403).json({ message: "You can only edit your own polls" });
        }

        // Don't allow editing if poll has votes
        if (poll.totalVotes > 0) {
            return res.status(400).json({ message: "Cannot edit poll after votes have been cast" });
        }

        // Update allowed fields
        const allowedUpdates = ['question', 'options', 'allowMultipleVotes', 'isAnonymous', 'expiresAt', 'isActive'];
        allowedUpdates.forEach(field => {
            if (updates[field] !== undefined) {
                poll[field] = updates[field];
            }
        });

        await poll.save();

        // Emit real-time update
        io.to(`blog-${poll.blog}`).emit('poll-updated', {
            pollId,
            poll: await poll.populate('createdBy', 'name profile.profilePicture')
        });

        res.json({
            message: "Poll updated successfully",
            poll: await poll.populate('createdBy', 'name profile.profilePicture')
        });

    } catch (error) {
        console.error("Error updating poll:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Delete poll
export const deletePoll = async (req, res) => {
    try {
        const { pollId } = req.params;
        const userId = req.user.id;

        const poll = await Poll.findById(pollId);
        if (!poll) {
            return res.status(404).json({ message: "Poll not found" });
        }

        // Check permissions
        if (poll.createdBy.toString() !== userId) {
            return res.status(403).json({ message: "You can only delete your own polls" });
        }

        await Poll.findByIdAndDelete(pollId);

        // Emit real-time update
        io.to(`blog-${poll.blog}`).emit('poll-deleted', {
            pollId,
            blogId: poll.blog
        });

        res.json({ message: "Poll deleted successfully" });

    } catch (error) {
        console.error("Error deleting poll:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Get trending polls
export const getTrendingPolls = async (req, res) => {
    try {
        const { limit = 10 } = req.query;

        const trendingPolls = await Poll.aggregate([
            { $match: { isActive: true } },
            { $addFields: { voteCount: { $size: "$options.votes" } } },
            { $sort: { voteCount: -1, createdAt: -1 } },
            { $limit: parseInt(limit) },
            {
                $lookup: {
                    from: 'users',
                    localField: 'createdBy',
                    foreignField: '_id',
                    as: 'creator'
                }
            },
            { $unwind: '$creator' },
            {
                $project: {
                    _id: 1,
                    question: 1,
                    type: 1,
                    totalVotes: 1,
                    createdAt: 1,
                    'creator.name': 1,
                    'creator.profile.profilePicture': 1
                }
            }
        ]);

        res.json({ trendingPolls });

    } catch (error) {
        console.error("Error getting trending polls:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Get user's polls
export const getUserPolls = async (req, res) => {
    try {
        const { userId } = req.params;
        const { limit = 20, page = 1 } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const polls = await Poll.find({ createdBy: userId })
            .populate('blog', 'title slug')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Poll.countDocuments({ createdBy: userId });

        res.json({
            polls,
            pagination: {
                current: parseInt(page),
                total: Math.ceil(total / parseInt(limit)),
                hasNext: skip + polls.length < total,
                hasPrev: parseInt(page) > 1
            }
        });

    } catch (error) {
        console.error("Error getting user polls:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Get poll analytics
export const getPollAnalytics = async (req, res) => {
    try {
        const { pollId } = req.params;
        const userId = req.user.id;

        const poll = await Poll.findById(pollId);
        if (!poll) {
            return res.status(404).json({ message: "Poll not found" });
        }

        // Check permissions
        if (poll.createdBy.toString() !== userId) {
            return res.status(403).json({ message: "You can only view analytics for your own polls" });
        }

        // Calculate analytics
        const analytics = {
            totalVotes: poll.totalVotes,
            uniqueVoters: new Set(poll.options.flatMap(option => 
                option.votes.map(vote => vote.user.toString())
            )).size,
            options: poll.options.map(option => ({
                text: option.text,
                votes: option.votes.length,
                percentage: poll.totalVotes > 0 ? ((option.votes.length / poll.totalVotes) * 100).toFixed(1) : 0
            })),
            votesByHour: {},
            votesByDay: {},
            recentVotes: poll.options.flatMap(option => 
                option.votes.map(vote => ({
                    option: option.text,
                    timestamp: vote.votedAt,
                    user: vote.user
                }))
            ).sort((a, b) => b.timestamp - a.timestamp).slice(0, 10)
        };

        // Calculate time-based analytics
        poll.options.forEach(option => {
            option.votes.forEach(vote => {
                const hour = new Date(vote.votedAt).getHours();
                const day = new Date(vote.votedAt).getDay();
                
                analytics.votesByHour[hour] = (analytics.votesByHour[hour] || 0) + 1;
                analytics.votesByDay[day] = (analytics.votesByDay[day] || 0) + 1;
            });
        });

        res.json({ analytics });

    } catch (error) {
        console.error("Error getting poll analytics:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
