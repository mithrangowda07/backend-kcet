require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const connectDB = require('./config/db');

// Initialize App
const app = express();

// Connect to Database
connectDB().catch(err => {
    console.error('Initial MongoDB connection failed:', err);
});

// Middlewares
app.use(helmet());
app.use(cors({
    origin: [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://10.117.193.26:3000'
    ],
    credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/student');
const collegeRoutes = require('./routes/colleges');
const branchRoutes = require('./routes/branches');
const counsellingRoutes = require('./routes/counselling');
const meetingRoutes = require('./routes/meetings');
const reviewRoutes = require('./routes/reviews');
const insightsManagerRoutes = require('./routes/insightsManager');

app.use('/api/auth', authRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/colleges', collegeRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/counselling', counsellingRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/review', reviewRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/admin', insightsManagerRoutes);
app.get('/api/branch-insights/:branch_id/', require('./controllers/insightsManagerController').getBranchInsight);

// Legacy routing
app.use('/api/search', collegeRoutes);

app.get('/api/locations/', require('./controllers/collegeController').locationsList);
app.get('/api/locations', require('./controllers/collegeController').locationsList);

// Vercel Cron/HTTP Scheduler Endpoint
app.get('/api/cron/scheduler', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
        const { runSchedulerJob } = require('./utils/scheduler');
        const result = await runSchedulerJob();
        return res.json({ message: 'Scheduler job executed successfully', ...result });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// Health check
app.get('/api/', (req, res) => {
    res.json({
        auth: "/api/auth/",
        colleges: "/api/colleges/",
        branches: "/api/branches/",
        search: "/api/search/?query=<text>",
        counselling: "/api/counselling/",
        reviews: "/api/reviews/",
        meetings: "/api/meetings/",
        branch_insights: "/api/branch-insights/<branch_id>/",
        admin: "/api/admin/",
        cron_scheduler: "/api/cron/scheduler",
    });
});

// Start local scheduler if not running on Vercel
if (!process.env.VERCEL) {
    const { runSchedulerJob } = require('./utils/scheduler');
    setInterval(async () => {
        try {
            await runSchedulerJob();
        } catch (e) {
            console.error('Local scheduler interval execution failed', e);
        }
    }, 2 * 60 * 1000); // run every 2 minutes
    console.log('Local interval-based scheduler started');
}

// Start Server locally if not running serverless (Vercel)
if (!process.env.VERCEL) {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

module.exports = app;
