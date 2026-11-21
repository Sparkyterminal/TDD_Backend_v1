const express = require('express');
const mongoose = require('mongoose');
const morgan = require('morgan');
const helmet = require('helmet');
const path = require('path');
const cors = require('cors');
const cron = require('node-cron');
const fs = require('fs');

const config = require('./config');
const { sendDailyRenewalAlerts } = require('./cronJobs/renewalAlerts');

const app = express();
const API_ROOT = '/api/';
const CRON_TIMEZONE = 'Asia/Kolkata';

// Upload code writes to paths relative to the repo root, so always run from here
// and make sure the upload directories exist (git does not track empty folders).
process.chdir(__dirname);
for (const dir of [
    'assets/temp_resources',
    'assets/images/full/high_res',
    'assets/images/full/low_res',
    'assets/images/thumb/high_res',
    'assets/images/thumb/low_res',
    'assets/documents',
]) {
    fs.mkdirSync(path.join(__dirname, dir), { recursive: true });
}

// ---------------------------------------------------------------------------
// Scheduled jobs
// ---------------------------------------------------------------------------
if (config.enableCron) {
    // Daily 01:01 IST: empty scratch directories. Missing directories are skipped; errors are logged, never thrown
    // (a throw inside an fs callback is an uncaught exception and used to crash the server every night).
    const SCRATCH_DIRECTORIES = [
        'assets/district_issues',
        'assets/department_issues',
        'assets/district_reports',
        'assets/dis_reports',
    ];
    cron.schedule('01 01 * * *', () => {
        for (const relativeDir of SCRATCH_DIRECTORIES) {
            const directory = path.join(__dirname, relativeDir);
            if (!fs.existsSync(directory)) continue;
            fs.readdir(directory, (readErr, files) => {
                if (readErr) return console.error(`Cleanup: cannot read ${relativeDir}:`, readErr.message);
                for (const file of files) {
                    fs.unlink(path.join(directory, file), (unlinkErr) => {
                        if (unlinkErr) console.error(`Cleanup: cannot delete ${relativeDir}/${file}:`, unlinkErr.message);
                    });
                }
            });
        }
    }, { timezone: CRON_TIMEZONE });

    // Daily 10:56 IST: WhatsApp renewal reminders.
    cron.schedule('56 10 * * *', async () => {
        console.log('Running daily renewal alerts...');
        try {
            await sendDailyRenewalAlerts();
        } catch (error) {
            console.error('Error in renewal alerts cron job:', error);
        }
    }, { timezone: CRON_TIMEZONE });
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.set('trust proxy', 1); // behind a load balancer / reverse proxy in production
app.disable('etag'); // fresh content on each request
app.disable('x-powered-by');

app.use(cors({
    origin(origin, callback) {
        // No Origin header: same-origin requests, server-to-server calls, PhonePe redirects, curl.
        if (!origin || config.corsOrigins.includes(origin)) return callback(null, true);
        return callback(null, false);
    },
}));
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Uploaded files
app.use(`${API_ROOT}assets`, express.static(path.join(__dirname, 'assets')));

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.use(`${API_ROOT}user`, require('./routes/User'));
app.use(`${API_ROOT}media-type`, require('./routes/mediaType'));
app.use(`${API_ROOT}media`, require('./routes/media'));
app.use(`${API_ROOT}class-type`, require('./routes/ClassTypes'));
app.use(`${API_ROOT}workshop`, require('./routes/Workshops'));
app.use(`${API_ROOT}class-session`, require('./routes/ClassSessions'));
app.use(`${API_ROOT}membership-plan`, require('./routes/MembershipPlans'));
app.use(`${API_ROOT}bulk-messages`, require('./routes/BulkMessages'));
app.use(`${API_ROOT}renewal-alerts`, require('./routes/RenewalAlerts'));
app.use(`${API_ROOT}rental-contact`, require('./routes/RentalContact'));
app.use(`${API_ROOT}enquire`, require('./routes/Enquire'));
app.use(`${API_ROOT}demoClass`, require('./routes/DemoClass'));

// Health check (used by load balancers / uptime monitors)
app.get(API_ROOT, (req, res) => {
    res.send('Hello from Node.js backend!');
});
app.get(`${API_ROOT}health`, (req, res) => {
    const dbConnected = mongoose.connection.readyState === 1;
    res.status(dbConnected ? 200 : 503).json({ status: dbConnected ? 'ok' : 'db_disconnected' });
});

// Unknown API routes
app.use(API_ROOT, (req, res) => {
    res.status(404).json({ message: 'Not Found' });
});

// Central error handler (Express 5 forwards rejected async handlers here)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    console.error(`Unhandled error on ${req.method} ${req.originalUrl}:`, err);
    if (res.headersSent) return;
    const status = err.status || err.statusCode || (err.name === 'MulterError' ? 400 : 500);
    res.status(status).json({ message: status === 500 ? 'Internal Server Error' : err.message });
});

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled promise rejection:', reason);
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
// Always start here (no require.main check: process managers such as PM2 load this file via require()).
mongoose.connect(config.dbUrl)
    .then(() => {
        console.log('Dance District DB Connection Successful');
        app.listen(config.port, () => {
            console.log(`Server is running on port ${config.port}`);
        });
    })
    .catch((err) => {
        console.error('Error in connecting to Dance District DB:', err);
        process.exit(1);
    });
