require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dbMiddleware = require('./middlewares/dbMiddleware');
const errorHandler = require('./middlewares/errorHandler');

// Initialize App
const app = express();

// Middlewares
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" } // Safe policy for API resource sharing
}));

// CORS Dynamic Configuration
const allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://10.117.193.26:3000'
];

if (process.env.FRONTEND_URL) {
    allowedOrigins.push(process.env.FRONTEND_URL);
}
if (process.env.CORS_ORIGINS) {
    process.env.CORS_ORIGINS.split(',').map(o => o.trim()).forEach(o => allowedOrigins.push(o));
}

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, curl, or Postman)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
            return callback(null, true);
        }
        
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// 1. Lightweight Health Check (No DB required)
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        environment: process.env.NODE_ENV || 'development',
        serverless: !!process.env.VERCEL
    });
});

// 2. Deep Health Check (DB connectivity check)
app.get('/api/db-health', async (req, res) => {
    try {
        const connectDB = require('./config/db');
        const db = await connectDB();
        res.json({
            status: 'ok',
            connectionState: db.connection.readyState, // should be 1
            databaseName: db.connection.name
        });
    } catch (err) {
        res.status(500).json({
            status: 'error',
            error: err.name,
            message: err.message
        });
    }
});

// Apply Database Connection Middleware globally to ensure connectivity for all subsequent API endpoints
app.use(dbMiddleware);

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
app.get('/api/cron/scheduler', async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
        const { runSchedulerJob } = require('./utils/scheduler');
        const result = await runSchedulerJob();
        return res.json({ message: 'Scheduler job executed successfully', ...result });
    } catch (err) {
        next(err);
    }
});

// Static URL Map Endpoint
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
        health: "/api/health",
        db_health: "/api/db-health"
    });
});

// Register Global Error Handling Middleware (must be registered last!)
app.use(errorHandler);

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
