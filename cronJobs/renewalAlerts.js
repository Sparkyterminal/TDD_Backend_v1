// Daily WhatsApp renewal reminders.
// Scheduled from app.js; can also be run standalone: `node cronJobs/renewalAlerts.js`
const mongoose = require('mongoose');
const config = require('../config');
const MembershipBooking = require('../models/MembershipBooking');
// Register the models used by populate() so this also works when run standalone (outside app.js).
require('../models/MembershipPlans');
require('../models/Users');
const { sendRenewalReminder } = require('../services/whatsapp');

// Reminders go out exactly this many days before the membership end date (0 = on the expiry day).
const REMINDER_DAYS_BEFORE_EXPIRY = [7, 1, 0];

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000; // India has no daylight saving

/** [start, end) of the India-time calendar day that is `daysFromToday` days from today. */
function istDayRange(daysFromToday, now = new Date()) {
    const istNow = new Date(now.getTime() + IST_OFFSET_MS);
    const istMidnightUtcMs = Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate()) - IST_OFFSET_MS;
    const start = new Date(istMidnightUtcMs + daysFromToday * 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return { start, end };
}

/** Paid memberships whose end date falls exactly 7 days, 1 day, or 0 days from today (India time). */
async function findBookingsDueForRenewal(now = new Date()) {
    return MembershipBooking.find({
        $or: REMINDER_DAYS_BEFORE_EXPIRY.map((days) => {
            const { start, end } = istDayRange(days, now);
            return { end_date: { $gte: start, $lt: end } };
        }),
        'paymentResult.status': 'COMPLETED', // only paid memberships
        user: { $exists: true },
    })
        .populate('plan', 'name')
        .populate('user', 'first_name last_name phone_data')
        .lean();
}

async function sendDailyRenewalAlerts() {
    try {
        console.log('Starting daily renewal alerts...');
        const eligibleBookings = await findBookingsDueForRenewal();
        console.log(`Found ${eligibleBookings.length} eligible bookings for renewal alerts`);

        let successCount = 0;
        let errorCount = 0;
        for (const booking of eligibleBookings) {
            try {
                const { mobileNumber } = await sendRenewalReminder(booking);
                console.log(`Renewal alert sent to ${booking.name} (${mobileNumber})`);
                successCount++;
            } catch (error) {
                console.error(`Error sending alert for booking ${booking._id}:`, error.response?.data || error.message);
                errorCount++;
            }
        }
        console.log(`Daily renewal alerts completed: ${successCount} sent successfully, ${errorCount} failed`);
        return { successCount, errorCount };
    } catch (error) {
        console.error('Error in daily renewal alerts:', error);
        return { successCount: 0, errorCount: 0, error: error.message };
    }
}

async function main() {
    await mongoose.connect(config.dbUrl);
    console.log('Database connected for renewal alerts');
    await sendDailyRenewalAlerts();
    await mongoose.disconnect();
    console.log('Renewal alerts process completed');
}

if (require.main === module) {
    main().catch((error) => {
        console.error(error);
        process.exit(1);
    });
}

module.exports = { sendDailyRenewalAlerts, findBookingsDueForRenewal, istDayRange, REMINDER_DAYS_BEFORE_EXPIRY };
