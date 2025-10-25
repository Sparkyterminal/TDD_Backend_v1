// Direct database test to see what the aggregation returns
const mongoose = require('mongoose');
const MembershipBooking = require('./modals/MembershipBooking');

async function testDirectAggregation() {
  try {
    await mongoose.connect("mongodb://127.0.0.1:27017/dance_district");
    console.log('✅ Connected to database');
    
    // Test the exact same aggregation pipeline as getAllMembershipBookings
    const pipeline = [
      { $match: {} }, // Get all bookings
      
      // Lookup user data
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userData',
          pipeline: [
            {
              $project: {
                first_name: 1,
                last_name: 1,
                'email_data.temp_email_id': 1,
                'phone_data.phone_number': 1
              }
            }
          ]
        }
      },
      
      // Lookup plan data
      {
        $lookup: {
          from: 'membershipplans',
          localField: 'plan',
          foreignField: '_id',
          as: 'planData',
          pipeline: [
            {
              $project: {
                name: 1,
                price: 1,
                billing_interval: 1,
                plan_for: 1
              }
            }
          ]
        }
      },
      
      // Add fields to reshape the data
      {
        $addFields: {
          user: { $arrayElemAt: ['$userData', 0] },
          plan: { $arrayElemAt: ['$planData', 0] }
        }
      },
      
      // Remove the temporary arrays
      {
        $unset: ['userData', 'planData']
      },
      
      { $limit: 3 } // Get only 3 results
    ];
    
    const result = await MembershipBooking.aggregate(pipeline);
    
    console.log('\n📊 Direct aggregation result:');
    console.log('Number of bookings found:', result.length);
    
    result.forEach((booking, index) => {
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
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

testDirectAggregation();
