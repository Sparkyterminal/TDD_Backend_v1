const mongoose = require('mongoose');
const MembershipBooking = require('../../models/MembershipBooking');
const { sendRenewalReminder } = require('../../services/whatsapp');
const { findBookingsDueForRenewal } = require('../../cronJobs/renewalAlerts');

const formatResult = (booking, sent) => ({
  success: true,
  message: `Renewal alert sent to ${booking.name}`,
  phoneNumber: sent.mobileNumber,
  endDate: sent.formattedEndDate,
  response: sent.response
});

// Send renewal alert to a specific member
exports.sendRenewalAlert = async (req, res) => {
  try {
    const { bookingId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({ success: false, message: 'Invalid booking ID' });
    }

    const booking = await MembershipBooking.findById(bookingId)
      .populate('plan', 'name')
      .populate('user', 'first_name last_name phone_data')
      .lean();

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    if (!booking.user) {
      return res.status(400).json({ success: false, message: 'No user associated with this booking' });
    }

    // Only for memberships expiring within 30 days or expired within the last 2 days
    const daysUntilExpiry = Math.ceil((new Date(booking.end_date) - new Date()) / (1000 * 60 * 60 * 24));
    if (daysUntilExpiry > 30) {
      return res.status(400).json({ success: false, message: 'Membership is not expiring soon (more than 30 days)' });
    }
    if (daysUntilExpiry < -2) {
      return res.status(400).json({ success: false, message: 'Membership expired more than 2 days ago' });
    }

    const sent = await sendRenewalReminder(booking);
    res.status(200).json({
      success: true,
      message: 'Renewal alert sent successfully',
      data: formatResult(booking, sent)
    });
  } catch (error) {
    console.error('Error sending renewal alert:', error.response?.data || error);
    res.status(500).json({ success: false, message: 'Error sending renewal alert', error: error.message });
  }
};

// Send renewal alerts to all eligible members
exports.sendBulkRenewalAlerts = async (req, res) => {
  try {
    const eligibleBookings = await findBookingsDueForRenewal();
    console.log(`Found ${eligibleBookings.length} eligible bookings for renewal alerts`);

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (const booking of eligibleBookings) {
      try {
        const sent = await sendRenewalReminder(booking);
        results.push({
          bookingId: booking._id,
          memberName: booking.name,
          status: 'success',
          message: formatResult(booking, sent).message
        });
        successCount++;
      } catch (error) {
        console.error(`Error sending alert for booking ${booking._id}:`, error.message);
        results.push({ bookingId: booking._id, memberName: booking.name, status: 'error', error: error.message });
        errorCount++;
      }
    }

    res.status(200).json({
      success: true,
      message: `Bulk renewal alerts completed. ${successCount} sent successfully, ${errorCount} failed`,
      data: { totalProcessed: eligibleBookings.length, successCount, errorCount, results }
    });
  } catch (error) {
    console.error('Error in bulk renewal alerts:', error);
    res.status(500).json({ success: false, message: 'Error in bulk renewal alerts', error: error.message });
  }
};
