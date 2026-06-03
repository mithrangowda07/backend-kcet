require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');

const dbMiddleware = require('./middlewares/dbMiddleware');
const errorHandler = require('./middlewares/errorHandler');

// Initialize App
const app = express();

// Security Middleware
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Allowed Origins
const allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://10.117.193.26:3000'
];

// Add frontend URL from env
if (process.env.FRONTEND_URL) {
    allowedOrigins.push(process.env.FRONTEND_URL);
}

// Add multiple origins from env
if (process.env.CORS_ORIGINS) {
    process.env.CORS_ORIGINS
        .split(',')
        .map(o => o.trim())
        .forEach(o => allowedOrigins.push(o));
}

// CORS Configuration
app.use(cors({
    origin: function (origin, callback) {

        // Allow requests with no origin
        if (!origin) return callback(null, true);

        if (
            allowedOrigins.includes(origin) ||
            origin.endsWith('.vercel.app')
        ) {
            return callback(null, true);
        }

        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
}));

// Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logger
app.use(morgan('dev'));


// =====================================================
// HEALTH ROUTES
// =====================================================

// Basic health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        environment: process.env.NODE_ENV || 'development',
        serverless: !!process.env.VERCEL
    });
});

// Database health check
app.get('/api/db-health', async (req, res) => {
    try {

        res.json({
            status: 'ok',
            connectionState: mongoose.connection.readyState,
            databaseName: mongoose.connection.name
        });

    } catch (err) {

        res.status(500).json({
            status: 'error',
            error: err.name,
            message: err.message
        });

    }
});


// =====================================================
// DATABASE MIDDLEWARE
// =====================================================

app.use(dbMiddleware);


// =====================================================
// ROUTES
// =====================================================

const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/student');
const collegeRoutes = require('./routes/colleges');
const branchRoutes = require('./routes/branches');
const counsellingRoutes = require('./routes/counselling');
const meetingRoutes = require('./routes/meetings');
const reviewRoutes = require('./routes/reviews');
const insightsManagerRoutes = require('./routes/insightsManager');

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/colleges', collegeRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/counselling', counsellingRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/review', reviewRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/admin', insightsManagerRoutes);

// Branch Insights
app.get(
    '/api/branch-insights/:branch_id/',
    require('./controllers/insightsManagerController').getBranchInsight
);

// Legacy Search Route
app.use('/api/search', collegeRoutes);

// Locations Routes
app.get(
    '/api/locations/',
    require('./controllers/collegeController').locationsList
);

app.get(
    '/api/locations',
    require('./controllers/collegeController').locationsList
);


// =====================================================
// CRON / SCHEDULER ROUTE
// =====================================================

app.get('/api/cron/scheduler', async (req, res, next) => {

    const authHeader = req.headers.authorization;

    if (
        process.env.CRON_SECRET &&
        authHeader !== `Bearer ${process.env.CRON_SECRET}`
    ) {
        return res.status(401).json({
            error: 'Unauthorized'
        });
    }

    try {

        const { runSchedulerJob } = require('./utils/scheduler');

        const result = await runSchedulerJob();

        return res.json({
            message: 'Scheduler job executed successfully',
            ...result
        });

    } catch (err) {
        next(err);
    }
});


// =====================================================
// API ROOT ROUTE
// =====================================================

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


// =====================================================
// ERROR HANDLER
// =====================================================

app.use(errorHandler);


// =====================================================
// SERVER STARTUP
// =====================================================

if (!process.env.VERCEL) {

    const startServer = async () => {

        try {

            // MongoDB Connection
            await mongoose.connect(process.env.MONGO_URI);

            console.log('MongoDB Connected');

            // Start Express Server
            const PORT = process.env.PORT || 5000;

            app.listen(PORT, '0.0.0.0', () => {
                console.log(`Server running on port ${PORT}`);
            });

            // Start Scheduler ONLY after DB is connected
            const { runSchedulerJob } = require('./utils/scheduler');

            setInterval(async () => {

                try {

                    console.log(
                        `[Scheduler] Executing scheduled maintenance cycle at ${new Date().toISOString()}`
                    );

                    await runSchedulerJob();

                } catch (e) {

                    console.error(
                        'Local scheduler interval execution failed',
                        e
                    );

                }

            }, 2 * 60 * 1000);

            console.log('Local interval-based scheduler started');

        } catch (err) {

            console.error('MongoDB connection failed:', err);

            process.exit(1);

        }
    };

    startServer();
}

module.exports = app;