// Central configuration. Every environment-dependent value is read here and nowhere else.
// Secrets must come from the environment (.env locally, the host's env/secret store in production).
require('dotenv').config({ quiet: true });

function required(key) {
    const value = process.env[key];
    if (!value || !value.trim()) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value.trim();
}

function optional(key, fallback) {
    const value = process.env[key];
    return value && value.trim() ? value.trim() : fallback;
}

const stripTrailingSlash = (url) => url.replace(/\/+$/, '');

// Public site, e.g. https://www.thedancedistrictbysahitya.in (no trailing slash)
const FRONTEND_URL = stripTrailingSlash(optional('FRONTEND_URL', 'https://www.thedancedistrictbysahitya.in'));
// Public API root as seen by browsers / PhonePe, e.g. https://www.thedancedistrictbysahitya.in/api
const PUBLIC_API_URL = stripTrailingSlash(optional('PUBLIC_API_URL', `${FRONTEND_URL}/api`));

const defaultCorsOrigins = [
    'https://www.thedancedistrictbysahitya.in',
    'https://thedancedistrictbysahitya.in',
    'https://www.thedancedistrict.in',
    'https://thedancedistrict.in',
    'http://localhost:5173',
    'http://localhost:5174',
];

module.exports = {
    port: Number(optional('DANCE_DISTRICT_PORT', optional('PORT', '4044'))),

    dbUrl: required('DANCE_DISTRICT_DB_URL'),

    jwt: {
        secret: required('DANCE_DISTRICT_JWT_SECRET'),
        accessTokenTtl: optional('DANCE_DISTRICT_TOKEN_VALIDITY', '1d'),
        refreshTokenTtl: optional('DANCE_DISTRICT_TOKEN_MAX_VALIDITY', '7d'),
    },

    phonepe: {
        clientId: required('CLIENT_ID'),
        clientSecret: required('CLIENT_SECRET'),
        clientVersion: Number(optional('PHONEPE_CLIENT_VERSION', '1')),
        env: optional('PHONEPE_ENV', 'PRODUCTION'), // PRODUCTION | SANDBOX
    },

    msg91: {
        authKey: optional('MSG91_AUTHKEY', ''),
        whatsappNumber: optional('WHATSAPP_NUMBER', ''),
    },

    urls: {
        frontend: FRONTEND_URL,
        publicApi: PUBLIC_API_URL,
        paymentSuccess: `${FRONTEND_URL}/payment-success`,
        paymentFailure: `${FRONTEND_URL}/payment-failure`,
        renewalForm: (bookingId) => `${FRONTEND_URL}/renewalform/${bookingId}`,
    },

    studio: {
        contactNumber: optional('STUDIO_CONTACT_NUMBER', '+91 8073139244'),
        address: optional('STUDIO_ADDRESS', 'The Dance District Studio, Gubalaala Main Road Bengaluru'),
    },

    // Membership one-time registration fee (₹) added to first bookings; workshop processing fee (₹).
    fees: {
        membershipRegistration: Number(optional('MEMBERSHIP_REGISTRATION_FEE', '500')),
        workshopProcessing: Number(optional('WORKSHOP_PROCESSING_FEE', '50')),
    },

    corsOrigins: optional('CORS_ORIGINS', '')
        ? optional('CORS_ORIGINS', '').split(',').map((o) => stripTrailingSlash(o.trim())).filter(Boolean)
        : defaultCorsOrigins,

    // Run cron jobs in this process. Set to "false" on extra instances if you ever run more than one.
    enableCron: optional('ENABLE_CRON', 'true') !== 'false',
};
