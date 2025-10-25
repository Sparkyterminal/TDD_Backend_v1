// Daily renewal alert cron job
const mongoose = require('mongoose');
const axios = require('axios');
const MembershipBooking = require('./modals/MembershipBooking');

// Connect to database
async function connectDB() {
  try {
    await mongoose.connect(process.env.DANCE_DISTRICT_DB_URL || "mongodb://127.0.0.1:27017/dance_district");
    console.log('Database connected for renewal alerts');
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
}

// Send renewal alert to a member
async function sendRenewalWhatsAppMessage(booking) {
  try {
    const MSG91_AUTHKEY = process.env.MSG91_AUTHKEY || '473576AtOfLQYl68f619aaP1';
    const WHATSAPP_NUMBER = process.env.WHATSAPP_NUMBER || "15558600955";
    
    // Format phone number
    let mobileNumber = booking.mobile_number?.toString().trim() || '';
    if (mobileNumber) {
      const digits = mobileNumber.replace(/\D/g, '');
      if (digits.length === 10) mobileNumber = `+91${digits}`;
      else if (digits.startsWith('91') && digits.length === 12) mobileNumber = `+${digits}`;
      else if (!mobileNumber.startsWith('+')) mobileNumber = `+${digits}`;
    }

    if (!mobileNumber || mobileNumber.length < 10) {
      throw new Error('Invalid mobile number');
    }

    // Format dates
    const endDate = new Date(booking.end_date);
    const formattedEndDate = endDate.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });

    // Generate renewal link
    const renewalLink = `https://www.thedancedistrict.in/renewalform/${booking._id}`;
    
    // Contact number
    const contactNumber = '+91 9876543210'; // Replace with your contact number

    // Prepare WhatsApp template message
    const messagePayload = {
      integrated_number: WHATSAPP_NUMBER,
      content_type: "template",
      payload: {
        messaging_product: "whatsapp",
        type: "template",
        template: {
          name: "renewal_alert", // Your template name
          language: {
            code: "en_GB",
            policy: "deterministic"
          },
          namespace: "757345ed_855e_4856_b51f_06bc7bcfb953",
          to_and_components: [
            {
              to: [mobileNumber],
              components: {
                body_1: [
                  {
                    type: "text",
                    text: booking.name || 'Member'
                  }
                ],
                body_2: [
                  {
                    type: "text",
                    text: formattedEndDate
                  }
                ],
                body_3: [
                  {
                    type: "text",
                    text: renewalLink
                  }
                ],
                body_4: [
                  {
                    type: "text",
                    text: contactNumber
                  }
                ]
              }
            }
          ]
        }
      }
    };

    const apiURL = 'https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/';

    const axiosResponse = await axios.post(apiURL, messagePayload, {
      headers: {
        'authkey': MSG91_AUTHKEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      maxRedirects: 5
    });

    console.log(`Renewal alert sent to ${booking.name} (${mobileNumber})`);

    return {
      success: true,
      memberName: booking.name,
      phoneNumber: mobileNumber,
      endDate: formattedEndDate
    };

  } catch (error) {
    console.error(`Failed to send renewal alert to ${booking.name}:`, error.response?.data || error.message);
    throw error;
  }
}

// Main function to send daily renewal alerts
async function sendDailyRenewalAlerts() {
  try {
    console.log('Starting daily renewal alerts...');
    
    const today = new Date();
    const thirtyDaysFromNow = new Date(today);
    thirtyDaysFromNow.setDate(today.getDate() + 30);
    
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setDate(today.getDate() - 2);

    // Find bookings that are expiring or recently expired
    const eligibleBookings = await MembershipBooking.find({
      end_date: {
        $gte: twoDaysAgo,
        $lte: thirtyDaysFromNow
      },
      'paymentResult.status': 'COMPLETED', // Only active memberships
      user: { $exists: true } // Must have a user
    })
    .populate('plan', 'name')
    .populate('user', 'first_name last_name phone_data')
    .lean();

    console.log(`Found ${eligibleBookings.length} eligible bookings for renewal alerts`);

    let successCount = 0;
    let errorCount = 0;

    for (const booking of eligibleBookings) {
      try {
        await sendRenewalWhatsAppMessage(booking);
        successCount++;
      } catch (error) {
        console.error(`Error sending alert for booking ${booking._id}:`, error.message);
        errorCount++;
      }
    }

    console.log(`Daily renewal alerts completed: ${successCount} sent successfully, ${errorCount} failed`);

  } catch (error) {
    console.error('Error in daily renewal alerts:', error);
  }
}

// Run the function
async function main() {
  await connectDB();
  await sendDailyRenewalAlerts();
  await mongoose.disconnect();
  console.log('Renewal alerts process completed');
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { sendDailyRenewalAlerts };
