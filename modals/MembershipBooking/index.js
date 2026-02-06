const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;

// Snapshot of interval values to compute end_date without relying on future plan changes
const INTERVAL_TO_MONTHS = {
    // Uppercase
    MONTHLY: 1,
    QUARTERLY: 3,
    '3_MONTHS': 3,
    '6_MONTHS': 6,
    YEARLY: 12,
    // Lowercase (canonical - matches plan.prices keys)
    monthly: 1,
    quarterly: 3,
    half_yearly: 6,
    yearly: 12
};

// Normalize any billing_interval variant to canonical lowercase form (matches plan.prices)
const NORMALIZE_INTERVAL = {
    monthly: 'monthly', MONTHLY: 'monthly',
    quarterly: 'quarterly', QUARTERLY: 'quarterly', '3_MONTHS': 'quarterly', '3_months': 'quarterly',
    half_yearly: 'half_yearly', HALF_YEARLY: 'half_yearly', '6_MONTHS': 'half_yearly', '6_months': 'half_yearly',
    yearly: 'yearly', YEARLY: 'yearly'
};

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
        billing_interval: {
            type: String,
            required: true,
        },
        batchId: {
            type: ObjectId,
            ref: 'membershipplan.batches',
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
        renewal_date: {
            type: Date,
            required: false
        },
        discontinued: {
            type: Boolean,
            default: false
          },
       
    },
    {
        timestamps: true
    }
);

// Normalize billing_interval to canonical form (lowercase) before any processing
membershipBookingSchema.pre('save', function (next) {
    if (this.billing_interval) {
        const normalized = NORMALIZE_INTERVAL[this.billing_interval];
        if (normalized) {
            this.billing_interval = normalized;
        }
    }
    next();
});

// Derive end_date if not provided based on billing_interval
membershipBookingSchema.pre('validate', async function (next) {
    try {
        // Normalize billing_interval first (in case pre-save hasn't run yet in this flow)
        if (this.billing_interval && NORMALIZE_INTERVAL[this.billing_interval]) {
            this.billing_interval = NORMALIZE_INTERVAL[this.billing_interval];
        }

        // If end_date already set, trust it
        if (this.end_date) return next();

        let interval = this.billing_interval;
        // If not present in snapshot, attempt to fetch from plan
        if (!interval && this.plan) {
            const PlanModel = mongoose.model('membershipplan');
            const planDoc = await PlanModel.findById(this.plan).lean();
            if (planDoc) {
                interval = planDoc.billing_interval;
                this.billing_interval = this.billing_interval || planDoc.billing_interval;
                this.plan_for = this.plan_for || planDoc.plan_for;
                this.plan_name = this.plan_name || planDoc.name;
                this.amount_paid = this.amount_paid == null ? planDoc.price : this.amount_paid;
            }
        }

        if (!interval || !INTERVAL_TO_MONTHS[interval]) return next();

        const start = this.start_date ? new Date(this.start_date) : new Date();
        // Set renewal_date to start_date for initial creation when not provided
        if (!this.renewal_date) {
            this.renewal_date = new Date(start);
        }
        const monthsToAdd = INTERVAL_TO_MONTHS[interval];
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


