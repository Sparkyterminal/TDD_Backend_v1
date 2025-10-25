const express = require('express');
const app = express();
const PORT = process.env.PORT || 4044;
const mongoose = require("mongoose");
const morgan = require("morgan");
const helmet = require("helmet");
const path = require("path");
const cors = require("cors");
const cron = require('node-cron');
const fs = require("fs");
require('dotenv').config();

// Schedule cron job to empty certain directories daily at 01:01 AM
cron.schedule('01 01 * * *', () => {
    const empty_these_directories = [
        "assets/district_issues",
        "assets/department_issues",
        "assets/district_reports",
        "assets/dis_reports",
    ];

    empty_these_directories.forEach((directory) => {
        fs.readdir(directory, (err, files) => {
            if (err) throw err;

            for (const file of files) {
                fs.unlink(path.join(directory, file), (err) => {
                    if (err) throw err;
                });
            }
        });
    });
});

// Enable CORS
app.use(cors());

// Security headers with Helmet
app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" }));

// Logger middleware
app.use(morgan("dev"));

// Set payload limit to 2GB
const payloadLimit = 2 * 1024 * 1024 * 1024; // 2GB in bytes
app.use(express.json({ limit: payloadLimit }));
app.use(express.urlencoded({ limit: payloadLimit, extended: true }));

// Serve static assets folder
const API_ROOT = '/api/';
app.use(`${API_ROOT}assets`, express.static(path.join(__dirname, "assets")));

// Disable etag for fresh content on each request
app.disable('etag');

const userRoutes = require('./routes/User');
const mediaTypeRoutes = require('./routes/mediaType');
const mediaRoutes = require('./routes/media');
const classTypeRoutes = require('./routes/ClassTypes');
const workshopRoutes = require('./routes/Workshops');
const classSessionRoutes = require('./routes/ClassSessions');
const membershipPlanRoutes = require('./routes/MembershipPlans');
const bulkMessageRoutes = require('./routes/BulkMessages');
const  rentalContact = require('./routes/RentalContact')
const enquire =require('./routes/Enquire')
const demoClass =require('./routes/DemoClass')

// Routes
app.use(`${API_ROOT}user`, userRoutes);
app.use(`${API_ROOT}media-type`, mediaTypeRoutes);
app.use(`${API_ROOT}media`, mediaRoutes);
app.use(`${API_ROOT}class-type`, classTypeRoutes);
app.use(`${API_ROOT}workshop`, workshopRoutes);
app.use(`${API_ROOT}class-session`, classSessionRoutes);
app.use(`${API_ROOT}membership-plan`, membershipPlanRoutes);
app.use(`${API_ROOT}bulk-messages`, bulkMessageRoutes);
app.use(`${API_ROOT}rental-contact`, rentalContact);
app.use(`${API_ROOT}enquire`, enquire);
app.use(`${API_ROOT}demoClass`, demoClass);



// Root route
app.get('/', (req, res) => {
    res.send('Hello from Node.js backend!');
});

// Database connection and server startup
try {
    const DB_URL = process.env.DANCE_DISTRICT_DB_URL || "mongodb://127.0.0.1:27017/dance_district";
    const DB_PORT = process.env.DANCE_DISTRICT_PORT || PORT;

    mongoose.connect(DB_URL, { useNewUrlParser: true, useUnifiedTopology: true })
        .then(() => {
            console.log("Dance District DB Connection Successful");
            app.listen(DB_PORT, () => {
                console.log(`Server is running on port ${DB_PORT}`);
            });
        })
        .catch(err => {
            console.error("Error in connecting to Dance District DB:", err);
        });
} catch (error) {
    console.error("Error in connecting to Dance District DB:", error);
}
