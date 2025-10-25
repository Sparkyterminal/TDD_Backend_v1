const mongoose = require('mongoose');
const axios = require('axios');
const MembershipBooking = require('../../modals/MembershipBooking');
const User = require('../../modals/Users');

// Send renewal alert to a specific member
exports.sendRenewalAlert = async (req, res) => {
  try {
    const { bookingId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID'
      });
    }

    const booking = await MembershipBooking.findById(bookingId)
      .populate('plan', 'name')
      .populate('user', 'first_name last_name phone_data')
      .lean();

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (!booking.user) {
      return res.status(400).json({
        success: false,
        message: 'No user associated with this booking'
      });
    }

    // Check if membership is expiring (within 30 days) or expired (within 2 days)
    const today = new Date();
    const endDate = new Date(booking.end_date);
    const daysUntilExpiry = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry > 30) {
      return res.status(400).json({
        success: false,
        message: 'Membership is not expiring soon (more than 30 days)'
      });
    }

    if (daysUntilExpiry < -2) {
      return res.status(400).json({
        success: false,
        message: 'Membership expired more than 2 days ago'
      });
    }

    const result = await sendRenewalWhatsAppMessage(booking);
    
    res.status(200).json({
      success: true,
      message: 'Renewal alert sent successfully',
      data: result
    });

  } catch (error) {
    console.error('Error sending renewal alert:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending renewal alert',
      error: error.message
    });
  }
};

// Send renewal alerts to all eligible members
exports.sendBulkRenewalAlerts = async (req, res) => {
  try {
    console.log('Starting bulk renewal alerts...');
    
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

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (const booking of eligibleBookings) {
      try {
        const result = await sendRenewalWhatsAppMessage(booking);
        results.push({
          bookingId: booking._id,
          memberName: booking.name,
          status: 'success',
          message: result.message
        });
        successCount++;
      } catch (error) {
        console.error(`Error sending alert for booking ${booking._id}:`, error.message);
        results.push({
          bookingId: booking._id,
          memberName: booking.name,
          status: 'error',
          error: error.message
        });
        errorCount++;
      }
    }

    res.status(200).json({
      success: true,
      message: `Bulk renewal alerts completed. ${successCount} sent successfully, ${errorCount} failed`,
      data: {
        totalProcessed: eligibleBookings.length,
        successCount,
        errorCount,
        results
      }
    });

  } catch (error) {
    console.error('Error in bulk renewal alerts:', error);
    res.status(500).json({
      success: false,
      message: 'Error in bulk renewal alerts',
      error: error.message
    });
  }
};

// Helper function to send WhatsApp renewal message
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

    // Generate renewal link (you can customize this)
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

    console.log('WhatsApp renewal alert response:', axiosResponse.data);

    if (axiosResponse.data.status === 'success' && !axiosResponse.data.hasError) {
      return {
        success: true,
        message: `Renewal alert sent to ${booking.name}`,
        phoneNumber: mobileNumber,
        endDate: formattedEndDate,
        response: axiosResponse.data
      };
    } else {
      throw new Error('WhatsApp API returned an error');
    }

  } catch (error) {
    console.error('Failed to send WhatsApp renewal alert:', error.response?.data || error.message);
    throw error;
  }
}

// Get renewal alert statistics
exports.getRenewalAlertStats = async (req, res) => {
  try {
    const today = new Date();
    const thirtyDaysFromNow = new Date(today);
    thirtyDaysFromNow.setDate(today.getDate() + 30);
    
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setDate(today.getDate() - 2);

    const stats = await MembershipBooking.aggregate([
      {
        $match: {
          end_date: {
            $gte: twoDaysAgo,
            $lte: thirtyDaysFromNow
          },
          'paymentResult.status': 'COMPLETED',
          user: { $exists: true }
        }
      },
      {
        $group: {
          _id: null,
          totalEligible: { $sum: 1 },
          expiringToday: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gte: ['$end_date', today] },
                    { $lt: ['$end_date', new Date(today.getTime() + 24 * 60 * 60 * 1000)] }
                  ]
                },
                1,
                0
              ]
            }
          },
          expiredRecently: {
            $sum: {
              $cond: [
                { $lt: ['$end_date', today] },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: stats[0] || {
        totalEligible: 0,
        expiringToday: 0,
        expiredRecently: 0
      }
    });

  } catch (error) {
    console.error('Error getting renewal alert stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting renewal alert stats',
      error: error.message
    });
  }
};
