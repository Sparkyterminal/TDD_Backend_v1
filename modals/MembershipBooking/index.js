const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;

// Snapshot of interval values to compute end_date without relying on future plan changes
const INTERVAL_TO_MONTHS = {
    MONTHLY: 1,
    '3_MONTHS': 3,
    '6_MONTHS': 6,
    YEARLY: 12
};

// Add fields to store billing information
const membershipBookingSchema = new Schema(
    {
        user: {
            type: ObjectId,
            ref: 'user',
            required: false
        },
        plan: {
            type: ObjectId,
            ref: 'membershipplan',
            required: true
        },
        // Store billing period information
        billing_period: {
            type: String,
            enum: ['monthly', 'quarterly', 'half_yearly', 'yearly'],
            required: true
        },
        // Snapshot critical plan data at booking time for historical accuracy
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
        start_date: {
            type: Date,
            default: () => new Date()
        },
        end_date: {
            type: Date,
            required: false
        },
       
    },
    {
        timestamps: true
    }
);

// Derive end_date if not provided based on billing_period
membershipBookingSchema.pre('validate', async function (next) {
    try {
        // If end_date already set, trust it
        if (this.end_date) return next();

        if (!this.billing_period || !INTERVAL_TO_MONTHS[this.billing_period.toUpperCase()]) return next();

        const start = this.start_date ? new Date(this.start_date) : new Date();
        const monthsToAdd = INTERVAL_TO_MONTHS[this.billing_period.toUpperCase()];
        const end = new Date(start);
        end.setMonth(end.getMonth() + monthsToAdd);
        this.end_date = end;
        next();
    } catch (err) {
        next(err);
    }
});

membershipBookingSchema.index({ user: 1, plan: 1, start_date: -1 });

membershipBookingSchema.set('toJSON', {
    transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
    }
});

module.exports = mongoose.model('membershipbooking', membershipBookingSchema);


