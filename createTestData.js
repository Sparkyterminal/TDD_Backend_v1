// Script to create test data for renewal alerts
const mongoose = require('mongoose');
const MembershipBooking = require('./modals/MembershipBooking');
const MembershipPlan = require('./modals/MembershipPlans');
const User = require('./modals/Users');

async function createTestData() {
  try {
    await mongoose.connect(process.env.DANCE_DISTRICT_DB_URL || "mongodb://127.0.0.1:27017/dance_district");
    console.log('✅ Connected to database');
    
    // Find an existing plan
    const plan = await MembershipPlan.findOne().lean();
    if (!plan) {
      console.log('❌ No membership plans found. Please create a plan first.');
      return;
    }
    
    console.log(`📋 Using plan: ${plan.name}`);
    
    // Create test bookings with different expiry dates
    const today = new Date();
    
    // Booking 1: Expires in 5 days
    const expiry1 = new Date(today);
    expiry1.setDate(today.getDate() + 5);
    
    // Booking 2: Expires in 15 days
    const expiry2 = new Date(today);
    expiry2.setDate(today.getDate() + 15);
    
    // Booking 3: Expired 1 day ago
    const expiry3 = new Date(today);
    expiry3.setDate(today.getDate() - 1);
    
    const testBookings = [
      {
        plan: plan._id,
        name: 'Test User 1',
        age: 25,
        email: 'test1@example.com',
        mobile_number: '9876543210',
        gender: 'Male',
        billing_interval: 'MONTHLY',
        start_date: new Date(today.getTime() - 25 * 24 * 60 * 60 * 1000), // 25 days ago
        end_date: expiry1,
        paymentResult: { status: 'COMPLETED' }
      },
      {
        plan: plan._id,
        name: 'Test User 2',
        age: 30,
        email: 'test2@example.com',
        mobile_number: '9876543211',
        gender: 'Female',
        billing_interval: 'MONTHLY',
        start_date: new Date(today.getTime() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
        end_date: expiry2,
        paymentResult: { status: 'COMPLETED' }
      },
      {
        plan: plan._id,
        name: 'Test User 3',
        age: 28,
        email: 'test3@example.com',
        mobile_number: '9876543212',
        gender: 'Male',
        billing_interval: 'MONTHLY',
        start_date: new Date(today.getTime() - 31 * 24 * 60 * 60 * 1000), // 31 days ago
        end_date: expiry3,
        paymentResult: { status: 'COMPLETED' }
      }
    ];
    
    console.log('\n📝 Creating test bookings...');
    
    for (const bookingData of testBookings) {
      const booking = await MembershipBooking.create(bookingData);
      console.log(`✅ Created booking: ${booking.name} (expires: ${booking.end_date.toLocaleDateString()})`);
    }
    
    console.log('\n🎉 Test data created successfully!');
    console.log('\n📱 Now you can test the renewal alerts:');
    console.log('1. Run: node testRenewalAlerts.js');
    console.log('2. Or test APIs: node testRenewalAlertAPIs.js');
    
  } catch (error) {
    console.error('❌ Error creating test data:', error);
  } finally {
    await mongoose.disconnect();
  }
}

createTestData();
