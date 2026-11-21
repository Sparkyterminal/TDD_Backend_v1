const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;

const bookingSchema = new Schema({
  workshop: { type: ObjectId, ref: 'workshop', required: true },
  batch_ids: { type: [ObjectId], required: true },
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
    required: false,
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
    status: String,                                   // initiated | COMPLETED | FAILED | ...
    paymentDate: Date,
    phonepeResponse: { type: Schema.Types.Mixed },
    processing: { type: Boolean, default: false },    // set while check-status is confirming the order
  },
  pricing_details: [
    {
      batch_id: { type: ObjectId, required: true },
      pricing_tier: { type: String, enum: ['EARLY_BIRD', 'REGULAR', 'ON_THE_SPOT'] },
      price: { type: Number }
    }
  ],
  price_charged: { type: Number },
  bookedAt: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ['INITIATED', 'CONFIRMED', 'CANCELLED', 'FAILED'],
    default: 'INITIATED',
  }
}, { timestamps: true });

bookingSchema.index({ workshop: 1, status: 1 });

// Model name 'booking' (collection "bookings") is kept for existing data. Do not register another 'booking' model.
module.exports = mongoose.model('booking', bookingSchema);
