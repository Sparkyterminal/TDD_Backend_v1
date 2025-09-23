const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;

const subscriptionSchema = new Schema(
    {
        user_id: {
            type: ObjectId,
            ref: 'user',
            required: true
        },
        plan_id: {
            type: ObjectId,
            ref: 'membershipplan',
            required: true
        },
        // provider: {
        //     type: String,
        //     enum: ['STRIPE', 'PAYPAL', 'OTHER'],
        //     default: 'STRIPE'
        // },
        // provider_subscription_id: {
        //     type: String,
        //     required: false
        // },
        status: {
            type: String,
            enum: ['TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'INCOMPLETE', 'INCOMPLETE_EXPIRED'],
            default: 'ACTIVE'
        },
        current_period_start: {
            type: Date,
            required: false
        },
        current_period_end: {
            type: Date,
            required: false
        },
        cancel_at_period_end: {
            type: Boolean,
            default: false
        },
        metadata: {
            type: Object,
            required: false
        }
    },
    {
        timestamps: true
    }
);

subscriptionSchema.index({ user_id: 1, plan_id: 1, status: 1 });

subscriptionSchema.set('toJSON', {
    transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
    }
});

module.exports = mongoose.model('subscription', subscriptionSchema);


