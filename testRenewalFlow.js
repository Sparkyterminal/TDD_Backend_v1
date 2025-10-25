// Test the renewal flow to ensure it updates existing user
const mongoose = require('mongoose');
const MembershipBooking = require('./modals/MembershipBooking');
const User = require('./modals/Users');

async function testRenewalFlow() {
  try {
    await mongoose.connect("mongodb://127.0.0.1:27017/dance_district");
    console.log('✅ Connected to database');
    
    // Find a booking with a user
    const bookingWithUser = await MembershipBooking.findOne({ user: { $exists: true } }).lean();
    
    if (bookingWithUser) {
      console.log('\n📊 Found booking with user:');
      console.log(`Booking ID: ${bookingWithUser._id}`);
      console.log(`User ID: ${bookingWithUser.user}`);
      console.log(`Name: ${bookingWithUser.name}`);
      console.log(`Email: ${bookingWithUser.email}`);
      
      // Check if user exists
      const user = await User.findById(bookingWithUser.user);
      if (user) {
        console.log('\n✅ User found:');
        console.log(`User ID: ${user._id}`);
        console.log(`Name: ${user.first_name} ${user.last_name}`);
        console.log(`Email: ${user.email_data?.temp_email_id}`);
      } else {
        console.log('\n❌ User not found in database');
      }
      
      // Check if this would be detected as a renewal
      if (bookingWithUser.user) {
        console.log('\n🔄 This booking would be detected as a RENEWAL');
        console.log('✅ User ID exists, so renewal flow will be used');
      } else {
        console.log('\n🆕 This booking would be detected as a NEW BOOKING');
        console.log('❌ No user ID, so new user creation flow will be used');
      }
      
    } else {
      console.log('\n❌ No bookings with users found');
      
      // Check bookings without users
      const bookingsWithoutUser = await MembershipBooking.find({ user: { $exists: false } }).limit(3);
      console.log(`\n📋 Found ${bookingsWithoutUser.length} bookings without users:`);
      bookingsWithoutUser.forEach((booking, index) => {
        console.log(`  ${index + 1}. ${booking.name} (${booking.email})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

testRenewalFlow();
