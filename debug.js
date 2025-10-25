// Simple debug script to check what's happening
const mongoose = require('mongoose');

async function debugDatabase() {
  try {
    console.log('Attempting to connect to MongoDB...');
    await mongoose.connect("mongodb://127.0.0.1:27017/dance_district", { 
      useNewUrlParser: true, 
      useUnifiedTopology: true 
    });
    console.log('✅ Connected to MongoDB successfully');
    
    const db = mongoose.connection.db;
    
    // Check if collections exist
    const collections = await db.listCollections().toArray();
    console.log('\n📁 Available collections:');
    collections.forEach(col => console.log(`  - ${col.name}`));
    
    // Check membershipbookings collection
    if (collections.some(c => c.name === 'membershipbookings')) {
      const totalBookings = await db.collection('membershipbookings').countDocuments();
      const bookingsWithoutUser = await db.collection('membershipbookings').countDocuments({
        user: { $exists: false }
      });
      
      console.log('\n📊 Membership Bookings Status:');
      console.log(`  Total bookings: ${totalBookings}`);
      console.log(`  Bookings without users: ${bookingsWithoutUser}`);
      
      if (bookingsWithoutUser > 0) {
        console.log('\n🔍 Sample booking without user:');
        const sampleBooking = await db.collection('membershipbookings').findOne({
          user: { $exists: false }
        });
        console.log(JSON.stringify(sampleBooking, null, 2));
      }
    } else {
      console.log('❌ membershipbookings collection not found');
    }
    
    // Check users collection
    if (collections.some(c => c.name === 'users')) {
      const totalUsers = await db.collection('users').countDocuments();
      console.log(`\n👥 Total users: ${totalUsers}`);
    } else {
      console.log('❌ users collection not found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Full error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

debugDatabase();
