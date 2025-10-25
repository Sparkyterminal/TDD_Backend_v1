// Test the getAllMembershipBookings API
const axios = require('axios');

async function testBookingsAPI() {
  try {
    console.log('🧪 Testing getAllMembershipBookings API...');
    
    const response = await axios.get('http://localhost:4044/api/membership-plan/bookings', {
      params: {
        page: 1,
        limit: 5
      },
      timeout: 10000
    });
    
    console.log('✅ API Response Status:', response.status);
    console.log('📊 Total bookings:', response.data.data.pagination.totalItems);
    console.log('📋 Sample booking with user data:');
    
    if (response.data.data.bookings.length > 0) {
      const sampleBooking = response.data.data.bookings[0];
      console.log(JSON.stringify(sampleBooking, null, 2));
    }
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ Server is not running. Please start the server first:');
      console.log('   cd /Users/ceg/Desktop/dds_dance/dance_district');
      console.log('   npm start');
    } else if (error.response) {
      console.log('❌ API Error:', error.response.status, error.response.data);
    } else {
      console.log('❌ Error:', error.message);
    }
  }
}

testBookingsAPI();
