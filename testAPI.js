// Test the API endpoint
const axios = require('axios');

async function testAPI() {
  try {
    console.log('🧪 Testing API endpoint...');
    
    const response = await axios.post('http://localhost:4044/api/membership-plan/create-users-for-bookings', {}, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 second timeout
    });
    
    console.log('✅ API Response:', response.data);
    
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

testAPI();
