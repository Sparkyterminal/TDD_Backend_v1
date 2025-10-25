// Quick check script
const mongoose = require('mongoose');

async function checkBookings() {
  try {
    await mongoose.connect("mongodb://127.0.0.1:27017/dance_district");
    console.log('Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // Count bookings without users
    const bookingsWithoutUser = await db.collection('membershipbookings').countDocuments({
      user: { $exists: false }
    });
    
    // Count total bookings
    const totalBookings = await db.collection('membershipbookings').countDocuments();
    
    // Count total users
    const totalUsers = await db.collection('users').countDocuments();
    
    console.log('\n=== CURRENT STATUS ===');
    console.log(`Total bookings: ${totalBookings}`);
    console.log(`Bookings without users: ${bookingsWithoutUser}`);
    console.log(`Total users: ${totalUsers}`);
    
    if (bookingsWithoutUser > 0) {
      console.log(`\n⚠️  You have ${bookingsWithoutUser} bookings that need users created.`);
      console.log('Run the API endpoint or script to create users for these bookings.');
    } else {
      console.log('\n✅ All bookings already have users assigned!');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkBookings();
