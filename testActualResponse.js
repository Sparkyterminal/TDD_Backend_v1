// Test the actual API response to see what user data is returned
const mongoose = require('mongoose');
const MembershipBooking = require('./modals/MembershipBooking');

async function testActualAPIResponse() {
  try {
    await mongoose.connect("mongodb://127.0.0.1:27017/dance_district");
    console.log('✅ Connected to database');
    
    // Test the exact same aggregation pipeline as the API
    const pipeline = [
      { $match: {} }, // Get all bookings
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
      {
        $addFields: {
          user: { $arrayElemAt: ['$userData', 0] },
          plan: { $arrayElemAt: ['$planData', 0] }
        }
      },
      {
        $unset: ['userData', 'planData']
      },
      { $limit: 2 } // Get only 2 results
    ];
    
    const result = await MembershipBooking.aggregate(pipeline);
    
    console.log('\n📊 Raw aggregation result:');
    console.log(JSON.stringify(result, null, 2));
    
    // Check if user data is null/undefined
    result.forEach((booking, index) => {
      console.log(`\n--- Booking ${index + 1} ---`);
      console.log(`Booking ID: ${booking._id}`);
      console.log(`User field exists: ${!!booking.user}`);
      console.log(`User data:`, booking.user);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

testActualAPIResponse();
