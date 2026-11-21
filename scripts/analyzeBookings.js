// Check duplicate emails and user creation details
const mongoose = require('mongoose');
const MembershipBooking = require('../models/MembershipBooking');
const User = require('../models/Users');

async function analyzeBookings() {
  try {
    await mongoose.connect("mongodb://127.0.0.1:27017/dance_district");
    console.log('✅ Connected to database');
    
    // Find all bookings without users
    const bookingsWithoutUser = await MembershipBooking.find({
      user: { $exists: false }
    });
    
    console.log(`\n📊 Found ${bookingsWithoutUser.length} bookings without users`);
    
    // Group by email to find duplicates
    const emailGroups = {};
    bookingsWithoutUser.forEach(booking => {
      const email = booking.email;
      if (!emailGroups[email]) {
        emailGroups[email] = [];
      }
      emailGroups[email].push(booking);
    });
    
    console.log(`\n📧 Unique emails: ${Object.keys(emailGroups).length}`);
    
    // Show duplicate emails
    const duplicates = Object.entries(emailGroups).filter(([email, bookings]) => bookings.length > 1);
    console.log(`\n🔄 Duplicate emails: ${duplicates.length}`);
    
    if (duplicates.length > 0) {
      console.log('\n📋 Duplicate email details:');
      duplicates.forEach(([email, bookings]) => {
        console.log(`  ${email}: ${bookings.length} bookings`);
        bookings.forEach(booking => {
          console.log(`    - ${booking.name} (${booking._id})`);
        });
      });
    }
    
    // Check existing users
    const existingUsers = await User.find({});
    console.log(`\n👥 Total existing users: ${existingUsers.length}`);
    
    // Check which emails already have users
    const emailsWithUsers = existingUsers.map(user => user.email_data?.temp_email_id).filter(Boolean);
    console.log(`📧 Emails that already have users: ${emailsWithUsers.length}`);
    
    // Show which bookings will create new users vs use existing
    let willCreateNew = 0;
    let willUseExisting = 0;
    
    Object.entries(emailGroups).forEach(([email, bookings]) => {
      if (emailsWithUsers.includes(email)) {
        willUseExisting += bookings.length;
      } else {
        willCreateNew += 1; // Only 1 user per unique email
      }
    });
    
    console.log(`\n🎯 Expected results:`);
    console.log(`  New users to create: ${willCreateNew}`);
    console.log(`  Bookings that will use existing users: ${willUseExisting}`);
    console.log(`  Total bookings to process: ${willCreateNew + willUseExisting}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

analyzeBookings();
