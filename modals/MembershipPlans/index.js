const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const membershipPlanSchema = new Schema(
    {
        name: {
            type: String,
            required: true
        },
        description: {
            type: String,
            required: false
        },
        price: {
            type: Number,
            required: true
        },
        // currency: {
        //     type: String,
        //     default: 'USD'
        // },
        billing_interval: {
            type: String,
            enum: ['MONTHLY', '3_MONTHS','6_MONTHS', 'YEARLY'],
            default: 'MONTHLY'
        },
        // class_credits_per_interval: {
        //     type: Number,
        //     required: false
        // },
        benefits: {
            type: [String],
            default: []
        },
        is_active: {
            type: Boolean,
            default: true
        }
    },
    {
        timestamps: true
    }
);

membershipPlanSchema.index({ name: 'text' });

membershipPlanSchema.set('toJSON', {
    transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
    }
});

module.exports = mongoose.model('membershipplan', membershipPlanSchema);


