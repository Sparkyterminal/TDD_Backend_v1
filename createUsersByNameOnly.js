// Create users based on names only - one user per booking
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const MembershipBooking = require('./modals/MembershipBooking');
const User = require('./modals/Users');

async function createUsersByNameOnly() {
  try {
    await mongoose.connect("mongodb://127.0.0.1:27017/dance_district");
    console.log('✅ Connected to database');
    
    // Find all bookings without users
    const bookingsWithoutUser = await MembershipBooking.find({
      user: { $exists: false }
    });
    
    console.log(`\n📊 Found ${bookingsWithoutUser.length} bookings without users`);
    
    let createdUsers = 0;
    let errors = 0;
    
    console.log('\n🔄 Creating users for each booking based on name...');
    
    for (let i = 0; i < bookingsWithoutUser.length; i++) {
      const booking = bookingsWithoutUser[i];
      
      try {
        console.log(`\n📝 Processing ${i + 1}/${bookingsWithoutUser.length}: ${booking.name}`);
        
        // Split name into first and last name
        const [firstName, ...rest] = (booking.name || '').trim().split(/\s+/);
        const lastName = rest.join(' ') || 'User';
        
        // Create unique email based on name and booking ID
        const uniqueEmail = `${firstName.toLowerCase()}_${booking._id}@temp.com`;
        
        // Create password based on name
        const password = `${firstName}@123`;
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Create new user for this booking
        const user = await User.create({
          first_name: firstName || 'User',
          last_name: lastName,
          media: [],
          email_data: { 
            temp_email_id: uniqueEmail, 
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
        
        console.log(`  ✅ Created user: ${user._id} (${firstName} ${lastName})`);
        console.log(`  📧 Email: ${uniqueEmail}`);
        
        // Update booking with user reference
        await MembershipBooking.findByIdAndUpdate(booking._id, {
          user: user._id
        });
        
        console.log(`  ✅ Updated booking ${booking._id} with user ${user._id}`);
        createdUsers++;
        
      } catch (error) {
        console.log(`  ❌ Error processing booking ${booking._id}: ${error.message}`);
        errors++;
      }
    }
    
    // Final verification
    const remainingBookings = await MembershipBooking.countDocuments({
      user: { $exists: false }
    });
    
    console.log('\n🎉 FINAL RESULTS:');
    console.log(`✅ Users created: ${createdUsers}`);
    console.log(`❌ Errors: ${errors}`);
    console.log(`📋 Remaining bookings without users: ${remainingBookings}`);
    
    if (remainingBookings === 0) {
      console.log('\n🎊 SUCCESS! All bookings now have users assigned!');
      console.log(`📊 Total users created: ${createdUsers}`);
    }
    
  } catch (error) {
    console.error('💥 Fatal error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

createUsersByNameOnly();
