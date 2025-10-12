const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;

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
        class_type: {
            type: ObjectId,
            ref: 'classtype',
            required: true
        },
        media: [
            {
                type: ObjectId,
                ref: "media",
                required: false,
            }
        ],
        batches: [{
            start_time: {
                type: Date,
                required: true
            },
            end_time: {
                type: Date,
                required: true
            },
            capacity: {
                type: Number,
                required: false
            },
            is_active: {
                type: Boolean,
                default: true
            }
        }],
        paymentResult: {
            status: String,
          },
        billing_interval: {
            type: String,
            enum: ['MONTHLY', '3_MONTHS','6_MONTHS', 'YEARLY'],
            default: 'MONTHLY'
        },
        plan_for: {
            type: String,
            enum: ['KIDS', 'ADULTS'],
            default: 'ADULTS'
        },
        subcategory: {
            type: String,
            enum: ['JUNIOR', 'ADVANCED'],
            required: function() {
                return this.plan_for === 'KIDS';
            }
        },
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


