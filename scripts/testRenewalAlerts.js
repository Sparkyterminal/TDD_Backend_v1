// Test script to run renewal alerts manually
const mongoose = require('mongoose');
require('dotenv').config();

async function testRenewalAlerts() {
  try {
    console.log('🧪 Testing renewal alerts manually...\n');
    
    // Import the renewal alerts function
    const { sendDailyRenewalAlerts } = require('../cronJobs/renewalAlerts');
    
    // Run the function
    await sendDailyRenewalAlerts();
    
    console.log('\n✅ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
  }
}

testRenewalAlerts();
