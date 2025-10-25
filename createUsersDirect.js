const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import models
const MembershipBooking = require('./modals/MembershipBooking');
const User = require('./modals/Users');

async function createUsersForExistingBookings() {
  try {
    // Connect to MongoDB
    const DB_URL = process.env.DANCE_DISTRICT_DB_URL || "mongodb://127.0.0.1:27017/dance_district";
    await mongoose.connect(DB_URL, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB');

    // Find all bookings without user field
    const bookingsWithoutUser = await MembershipBooking.find({
      user: { $exists: false }
    }).lean();

    console.log(`Found ${bookingsWithoutUser.length} bookings without users`);

    if (bookingsWithoutUser.length === 0) {
      console.log('No bookings found without users. All bookings already have users assigned.');
      return;
    }

    let createdUsers = 0;
    let existingUsers = 0;
    let errors = 0;

    for (const booking of bookingsWithoutUser) {
      try {
        console.log(`Processing booking: ${booking._id} for ${booking.email}`);

        // Check if user already exists with this email
        let user = await User.findOne({ 'email_data.temp_email_id': booking.email });
        
        if (user) {
          console.log(`  ✓ User already exists: ${user._id}`);
          existingUsers++;
        } else {
          // Create new user
          const [firstName, ...rest] = (booking.name || '').trim().split(/\s+/);
          const lastName = rest.join(' ');
          const password = `${firstName || 'User'}@123`;
          const hashedPassword = await bcrypt.hash(password, 10);

          user = await User.create({
            first_name: firstName || 'User',
            last_name: lastName || 'User', // Set default if empty
            media: [],
            email_data: { temp_email_id: booking.email, is_validated: true },
            phone_data: { phone_number: booking.mobile_number, is_validated: true },
            role: 'USER',
            password: hashedPassword,
            is_active: true,
            is_archived: false
          });

          console.log(`  ✓ Created new user: ${user._id}`);
          createdUsers++;
        }

        // Update booking with user reference
        await MembershipBooking.findByIdAndUpdate(booking._id, {
          user: user._id
        });

        console.log(`  ✓ Updated booking ${booking._id} with user ${user._id}`);

      } catch (error) {
        console.error(`  ✗ Error processing booking ${booking._id}:`, error.message);
        errors++;
      }
    }

    console.log('\n=== SUMMARY ===');
    console.log(`Total bookings processed: ${bookingsWithoutUser.length}`);
    console.log(`New users created: ${createdUsers}`);
    console.log(`Existing users found: ${existingUsers}`);
    console.log(`Errors: ${errors}`);

    // Verify results
    const remainingBookingsWithoutUser = await MembershipBooking.countDocuments({
      user: { $exists: false }
    });
    
    console.log(`Remaining bookings without users: ${remainingBookingsWithoutUser}`);

  } catch (error) {
    console.error('Script error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
createUsersForExistingBookings();
