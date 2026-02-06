/**
 * Migration script: Fix QUARTERLY bookings that have wrong end_date (1 month instead of 3 months)
 * Also normalizes billing_interval to lowercase "quarterly"
 *
 * Run: node fixQuarterlyEndDates.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

const DB_URL = process.env.DANCE_DISTRICT_DB_URL || "mongodb+srv://naveengc3005_db_user:waTdC4tnosVOJCcO@thedancedistrict.41vcz15.mongodb.net/dance_district";

const QUARTERLY_VARIANTS = ['QUARTERLY', 'quarterly', '3_MONTHS', '3_months'];
const QUARTERLY_MONTHS = 3;

async function fixQuarterlyEndDates() {
  try {
    await mongoose.connect(DB_URL);
    console.log('Connected to database');

    const db = mongoose.connection.db;
    const collection = db.collection('membershipbookings');

    // Find all quarterly bookings
    const quarterlyBookings = await collection.find({
      billing_interval: { $in: QUARTERLY_VARIANTS }
    }).toArray();

    console.log(`\nFound ${quarterlyBookings.length} QUARTERLY bookings\n`);

    let fixed = 0;
    let skipped = 0;

    for (const booking of quarterlyBookings) {
      const startDate = booking.start_date ? new Date(booking.start_date) : new Date(booking.createdAt);

      // Correct end_date = start_date + 3 months
      const correctEndDate = new Date(startDate);
      correctEndDate.setMonth(correctEndDate.getMonth() + QUARTERLY_MONTHS);

      const updateFields = {
        billing_interval: 'quarterly',
        end_date: correctEndDate
      };

      const needsUpdate = booking.billing_interval !== 'quarterly' ||
        !booking.end_date ||
        Math.abs(new Date(booking.end_date) - correctEndDate) > 2 * 24 * 60 * 60 * 1000;  // more than 2 days off

      if (needsUpdate) {
        await collection.updateOne(
          { _id: booking._id },
          { $set: updateFields }
        );
        fixed++;
        const oldEnd = booking.end_date ? new Date(booking.end_date).toISOString().split('T')[0] : 'none';
        console.log(`Fixed: ${booking.name} | ${oldEnd} → ${correctEndDate.toISOString().split('T')[0]}`);
      } else {
        skipped++;
      }
    }

    console.log(`\nDone. Fixed: ${fixed}, Skipped (already correct): ${skipped}`);

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from database');
    process.exit(0);
  }
}

fixQuarterlyEndDates();
