// Test the correct API endpoint
const axios = require('axios');

async function testCorrectEndpoint() {
  try {
    console.log('🧪 Testing the correct API endpoint...');
    
    const response = await axios.get('http://localhost:4044/api/membership-plan/bookings/all?page=1&limit=3');
    
    console.log('\n📊 API Response:');
    console.log('Status:', response.status);
    console.log('Success:', response.data.success);
    
    if (response.data.success && response.data.data.bookings) {
      console.log('\n📋 Bookings with user data:');
      response.data.data.bookings.forEach((booking, index) => {
        console.log(`\n--- Booking ${index + 1} ---`);
        console.log(`ID: ${booking._id}`);
        console.log(`Name: ${booking.name}`);
        console.log(`Email: ${booking.email}`);
        console.log(`User Data:`, JSON.stringify(booking.user, null, 2));
        console.log(`Plan Data:`, JSON.stringify(booking.plan, null, 2));
      });
    } else {
      console.log('❌ No bookings found or error in response');
      console.log('Response:', JSON.stringify(response.data, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Error calling API:', error.response?.data || error.message);
  }
}

testCorrectEndpoint();
