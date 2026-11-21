// Daily WhatsApp renewal reminders.
// Scheduled from app.js; can also be run standalone: `node cronJobs/renewalAlerts.js`
const mongoose = require('mongoose');
const config = require('../config');
const MembershipBooking = require('../models/MembershipBooking');
// Register the models used by populate() so this also works when run standalone (outside app.js).
require('../models/MembershipPlans');
require('../models/Users');
const { sendRenewalReminder } = require('../services/whatsapp');

/** Members whose membership ends within the next 30 days or ended in the last 2 days. */
async function findBookingsDueForRenewal() {
    const today = new Date();
    const thirtyDaysFromNow = new Date(today);
    thirtyDaysFromNow.setDate(today.getDate() + 30);
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setDate(today.getDate() - 2);

    return MembershipBooking.find({
        end_date: { $gte: twoDaysAgo, $lte: thirtyDaysFromNow },
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

module.exports = { sendDailyRenewalAlerts, findBookingsDueForRenewal };
