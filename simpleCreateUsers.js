// Ultra-simple user creation script
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Import the models directly
const MembershipBooking = require('./modals/MembershipBooking');
const User = require('./modals/Users');

async function createUsersStepByStep() {
  try {
    console.log('🚀 Starting user creation process...');
    
    // Connect to database
    console.log('📡 Connecting to database...');
    await mongoose.connect("mongodb://127.0.0.1:27017/dance_district", {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to database');
    
    // Step 1: Find bookings without users
    console.log('\n🔍 Step 1: Finding bookings without users...');
    const bookingsWithoutUser = await MembershipBooking.find({
      user: { $exists: false }
    });
    
    console.log(`Found ${bookingsWithoutUser.length} bookings without users`);
    
    if (bookingsWithoutUser.length === 0) {
      console.log('✅ All bookings already have users!');
      return;
    }
    
    // Step 2: Process each booking
    console.log('\n👥 Step 2: Creating users for each booking...');
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < bookingsWithoutUser.length; i++) {
      const booking = bookingsWithoutUser[i];
      
      try {
        console.log(`\n📝 Processing ${i + 1}/${bookingsWithoutUser.length}: ${booking.name} (${booking.email})`);
        
        // Check if user already exists
        let user = await User.findOne({ 
          'email_data.temp_email_id': booking.email 
        });
        
        if (user) {
          console.log(`  ✅ User already exists: ${user._id}`);
        } else {
          // Create new user
          const [firstName, ...rest] = (booking.name || '').trim().split(/\s+/);
          const lastName = rest.join(' ');
          const password = `${firstName || 'User'}@123`;
          const hashedPassword = await bcrypt.hash(password, 10);
          
          user = await User.create({
            first_name: firstName || 'User',
            last_name: lastName || 'User', // Set default if empty
            media: [],
            email_data: { 
              temp_email_id: booking.email, 
              is_validated: true 
            },
            phone_data: { 
              phone_number: booking.mobile_number, 
              is_validated: true 
            },
            role: 'USER',
            password: hashedPassword,
            is_active: true,
            is_archived: false
          });
          
          console.log(`  ✅ Created new user: ${user._id}`);
        }
        
        // Update booking with user reference
        await MembershipBooking.findByIdAndUpdate(booking._id, {
          user: user._id
        });
        
        console.log(`  ✅ Updated booking with user reference`);
        successCount++;
        
      } catch (error) {
        console.log(`  ❌ Error: ${error.message}`);
        errorCount++;
      }
    }
    
    // Step 3: Verify results
    console.log('\n📊 Step 3: Verifying results...');
    const remainingBookings = await MembershipBooking.countDocuments({
      user: { $exists: false }
    });
    
    console.log('\n🎉 FINAL RESULTS:');
    console.log(`✅ Successfully processed: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📋 Remaining bookings without users: ${remainingBookings}`);
    
    if (remainingBookings === 0) {
      console.log('\n🎊 SUCCESS! All bookings now have users assigned!');
    } else {
      console.log(`\n⚠️  ${remainingBookings} bookings still need users.`);
    }
    
  } catch (error) {
    console.error('💥 Fatal error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

// Run the function
createUsersStepByStep();
