// Test script for renewal alert APIs
const axios = require('axios');

async function testRenewalAlertAPIs() {
  try {
    console.log('🧪 Testing Renewal Alert APIs...\n');
    
    const baseURL = 'http://localhost:4044/api/renewal-alerts';
    
    // Test 1: Get statistics
    console.log('1️⃣ Testing GET /stats');
    try {
      const statsResponse = await axios.get(`${baseURL}/stats`);
      console.log('✅ Stats Response:', statsResponse.data);
    } catch (error) {
      console.log('❌ Stats Error:', error.response?.data || error.message);
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Test 2: Send bulk alerts
    console.log('2️⃣ Testing POST /send-bulk');
    try {
      const bulkResponse = await axios.post(`${baseURL}/send-bulk`);
      console.log('✅ Bulk Response:', bulkResponse.data);
    } catch (error) {
      console.log('❌ Bulk Error:', error.response?.data || error.message);
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Test 3: Send single alert (replace with actual booking ID)
    console.log('3️⃣ Testing POST /send/{bookingId}');
    console.log('⚠️  Replace BOOKING_ID with an actual booking ID from your database');
    
    // Uncomment and replace BOOKING_ID with actual ID:
    /*
    try {
      const singleResponse = await axios.post(`${baseURL}/send/BOOKING_ID`);
      console.log('✅ Single Response:', singleResponse.data);
    } catch (error) {
      console.log('❌ Single Error:', error.response?.data || error.message);
    }
    */
    
  } catch (error) {
    console.error('❌ General error:', error.message);
  }
}

testRenewalAlertAPIs();
