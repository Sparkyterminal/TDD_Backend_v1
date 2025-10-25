// Test the getAllMembershipBookings API to see what user data is returned
const axios = require('axios');

async function testGetAllMembershipBookings() {
  try {
    console.log('🧪 Testing getAllMembershipBookings API...\n');
    
    const response = await axios.get('http://localhost:4044/api/membership-plan/bookings/all?page=1&limit=3');
    
    console.log('📊 API Response Status:', response.status);
    console.log('📊 Success:', response.data.success);
    
    if (response.data.success && response.data.data.bookings) {
      console.log('\n📋 Bookings found:', response.data.data.bookings.length);
      
      response.data.data.bookings.forEach((booking, index) => {
        console.log(`\n--- Booking ${index + 1} ---`);
        console.log(`ID: ${booking._id}`);
        console.log(`Name: ${booking.name}`);
        console.log(`Email: ${booking.email}`);
        console.log(`Mobile: ${booking.mobile_number}`);
        
        if (booking.user) {
          console.log('✅ User data found:');
          console.log(`  - First Name: ${booking.user.first_name}`);
          console.log(`  - Last Name: ${booking.user.last_name}`);
          console.log(`  - Email: ${booking.user.email_data?.temp_email_id}`);
          console.log(`  - Phone: ${booking.user.phone_data?.phone_number}`);
        } else {
          console.log('❌ No user data found');
        }
        
        if (booking.plan) {
          console.log('✅ Plan data found:');
          console.log(`  - Plan Name: ${booking.plan.name}`);
          console.log(`  - Price: ${booking.plan.price}`);
        } else {
          console.log('❌ No plan data found');
        }
      });
      
      console.log('\n📊 Pagination Info:');
      console.log(JSON.stringify(response.data.data.pagination, null, 2));
      
    } else {
      console.log('❌ No bookings found or error in response');
      console.log('Response:', JSON.stringify(response.data, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Error calling API:', error.response?.data || error.message);
  }
}

testGetAllMembershipBookings();
