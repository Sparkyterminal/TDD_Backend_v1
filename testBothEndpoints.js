// Test both API endpoints to verify they return database user data
const axios = require('axios');

async function testBothEndpoints() {
  try {
    console.log('🧪 Testing both API endpoints...\n');
    
    // Test endpoint 1: /bookings (updated function)
    console.log('1️⃣ Testing /api/membership-plan/bookings');
    try {
      const response1 = await axios.get('http://localhost:4044/api/membership-plan/bookings?page=1&limit=2');
      console.log('✅ Status:', response1.status);
      console.log('✅ Success:', response1.data.success);
      
      if (response1.data.success && response1.data.items) {
        console.log('📋 Bookings found:', response1.data.items.length);
        response1.data.items.forEach((booking, index) => {
          console.log(`\n--- Booking ${index + 1} ---`);
          console.log(`ID: ${booking._id}`);
          console.log(`Name: ${booking.name}`);
          console.log(`User Data:`, JSON.stringify(booking.user, null, 2));
        });
      }
    } catch (error) {
      console.log('❌ Error:', error.response?.data?.message || error.message);
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Test endpoint 2: /bookings/all (new function)
    console.log('2️⃣ Testing /api/membership-plan/bookings/all');
    try {
      const response2 = await axios.get('http://localhost:4044/api/membership-plan/bookings/all?page=1&limit=2');
      console.log('✅ Status:', response2.status);
      console.log('✅ Success:', response2.data.success);
      
      if (response2.data.success && response2.data.data.bookings) {
        console.log('📋 Bookings found:', response2.data.data.bookings.length);
        response2.data.data.bookings.forEach((booking, index) => {
          console.log(`\n--- Booking ${index + 1} ---`);
          console.log(`ID: ${booking._id}`);
          console.log(`Name: ${booking.name}`);
          console.log(`User Data:`, JSON.stringify(booking.user, null, 2));
        });
      }
    } catch (error) {
      console.log('❌ Error:', error.response?.data?.message || error.message);
    }
    
  } catch (error) {
    console.error('❌ General error:', error.message);
  }
}

testBothEndpoints();
