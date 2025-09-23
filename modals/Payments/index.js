const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;

const paymentSchema = new Schema(
    {
        user_id: {
            type: ObjectId,
            ref: 'user',
            required: true
        },
        amount: {
            type: Number,
            required: true
        },
        // currency: {
        //     type: String,
        //     default: 'USD'
        // },
        // method: {
        //     type: String,
        //     enum: ['CARD', 'CASH', 'OTHER'],
        //     default: 'CARD'
        // },
        // provider: {
        //     type: String,
        //     enum: ['STRIPE', 'PAYPAL', 'PHONEPE', 'OTHER'],
        //     default: 'PHONEPE'
        // },
        // provider_charge_id: {
        //     type: String,
        //     required: false
        // },
        // provider_order_id: {
        //     type: String,
        //     required: false
        // },
        // provider_transaction_id: {
        //     type: String,
        //     required: false
        // },
        // provider_reference_id: {
        //     type: String,
        //     required: false
        // },
        status: {
            type: String,
            enum: ['REQUIRES_ACTION', 'PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED'],
            default: 'PENDING'
        },
        items: [
            {
                description: { type: String },
                resource_type: { type: String },
                resource_id: { type: ObjectId },
                amount: { type: Number }
            }
        ],
        phonepe: {
            payment_state: { type: String, required: false },
            response_code: { type: String, required: false },
            response_message: { type: String, required: false },
            instrument: {
                type: { type: String, required: false },
                utr: { type: String, required: false },
                upi_transaction_id: { type: String, required: false },
                vpa: { type: String, required: false }
            }
        }
    },
    {
        timestamps: true
    }
);

paymentSchema.index({ user_id: 1, provider_charge_id: 1 });
paymentSchema.index({ provider: 1, provider_order_id: 1 });
paymentSchema.index({ provider: 1, provider_transaction_id: 1 });

paymentSchema.set('toJSON', {
    transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
    }
});

module.exports = mongoose.model('payment', paymentSchema);


