// Complete user creation with detailed analysis
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const MembershipBooking = require('./modals/MembershipBooking');
const User = require('./modals/Users');

async function completeUserCreation() {
  try {
    await mongoose.connect("mongodb://127.0.0.1:27017/dance_district");
    console.log('✅ Connected to database');
    
    // Find all bookings without users
    const bookingsWithoutUser = await MembershipBooking.find({
      user: { $exists: false }
    });
    
    console.log(`\n📊 Found ${bookingsWithoutUser.length} bookings without users`);
    
    // Group by email
    const emailGroups = {};
    bookingsWithoutUser.forEach(booking => {
      const email = booking.email;
      if (!emailGroups[email]) {
        emailGroups[email] = [];
      }
      emailGroups[email].push(booking);
    });
    
    console.log(`📧 Unique emails: ${Object.keys(emailGroups).length}`);
    
    // Get existing users
    const existingUsers = await User.find({});
    const emailsWithUsers = existingUsers.map(user => user.email_data?.temp_email_id).filter(Boolean);
    
    let createdUsers = 0;
    let existingUsersUsed = 0;
    let errors = 0;
    
    console.log('\n🔄 Processing each unique email...');
    
    for (const [email, bookings] of Object.entries(emailGroups)) {
      try {
        console.log(`\n📧 Processing email: ${email} (${bookings.length} bookings)`);
        
        let user;
        
        if (emailsWithUsers.includes(email)) {
          // User already exists
          user = await User.findOne({ 'email_data.temp_email_id': email });
          console.log(`  ✅ Using existing user: ${user._id}`);
          existingUsersUsed++;
        } else {
          // Create new user
          const firstName = bookings[0].name.split(' ')[0] || 'User';
          const password = `${firstName}@123`;
          const hashedPassword = await bcrypt.hash(password, 10);
          
          user = await User.create({
            first_name: firstName,
            last_name: 'User',
            media: [],
            email_data: { temp_email_id: email, is_validated: true },
            phone_data: { phone_number: bookings[0].mobile_number, is_validated: true },
            role: 'USER',
            password: hashedPassword,
            is_active: true,
            is_archived: false
          });
          
          console.log(`  ✅ Created new user: ${user._id}`);
          createdUsers++;
        }
        
        // Update all bookings for this email
        for (const booking of bookings) {
          await MembershipBooking.findByIdAndUpdate(booking._id, {
            user: user._id
          });
          console.log(`    ✅ Updated booking: ${booking.name} (${booking._id})`);
        }
        
      } catch (error) {
        console.log(`  ❌ Error processing ${email}: ${error.message}`);
        errors++;
      }
    }
    
    // Final verification
    const remainingBookings = await MembershipBooking.countDocuments({
      user: { $exists: false }
    });
    
    console.log('\n🎉 FINAL RESULTS:');
    console.log(`✅ New users created: ${createdUsers}`);
    console.log(`👥 Existing users used: ${existingUsersUsed}`);
    console.log(`❌ Errors: ${errors}`);
    console.log(`📋 Remaining bookings without users: ${remainingBookings}`);
    
    if (remainingBookings === 0) {
      console.log('\n🎊 SUCCESS! All bookings now have users assigned!');
    }
    
  } catch (error) {
    console.error('💥 Fatal error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

completeUserCreation();
