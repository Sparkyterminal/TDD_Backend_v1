// Simple test to check the API response
const axios = require('axios');

async function testAPI() {
  try {
    console.log('🧪 Testing getAllMembershipBookings API...\n');
    
    // Test with a simple request
    const response = await axios.get('http://localhost:4044/api/membership-plan/bookings/all?page=1&limit=2');
    
    console.log('📊 Response Status:', response.status);
    console.log('📊 Success:', response.data.success);
    
    if (response.data.success) {
      const bookings = response.data.data.bookings;
      console.log('\n📋 Bookings found:', bookings.length);
      
      bookings.forEach((booking, index) => {
        console.log(`\n--- Booking ${index + 1} ---`);
        console.log(`ID: ${booking._id}`);
        console.log(`Name: ${booking.name}`);
        console.log(`Email: ${booking.email}`);
        
        if (booking.user) {
          console.log('✅ User data:');
          console.log(`  First Name: ${booking.user.first_name}`);
          console.log(`  Last Name: ${booking.user.last_name}`);
          console.log(`  Email: ${booking.user.email_data?.temp_email_id}`);
          console.log(`  Phone: ${booking.user.phone_data?.phone_number}`);
        } else {
          console.log('❌ No user data found');
        }
      });
    } else {
      console.log('❌ API returned error:', response.data.message);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testAPI();
