const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;

const bookingSchema = new Schema({
  workshop: { type: ObjectId, ref: 'workshop', required: true },
  batch_id: { type: ObjectId, required: true },
  // User form details:
  name: {
    type: String,
    required: true,
  },
  age: {
    type: Number,
    required: true,
    min: 0,
  },
  email: {
    type: String,
    required: true,
  },
  mobile_number: {
    type: String,
    required: true,
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other'],
    required: true,
  },
  paymentResult: {
    status: String,
  },
  pricing_tier: {
    type: String,
    enum: ['EARLY_BIRD', 'REGULAR', 'ON_THE_SPOT'],
  },
  price_charged: {
    type: Number,
  },
  bookedAt: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ['INITIATED', 'CONFIRMED', 'CANCELLED'],
    default: 'INITIATED',
  }
}, { timestamps: true });

module.exports = mongoose.model('booking', bookingSchema);
