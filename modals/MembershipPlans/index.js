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
        dance_type: {
            type: ObjectId,
            ref: 'classtype',
            required: true
        },
        prices: {
            monthly: {
                type: Number,
                required: true
            },
            quarterly: {
                type: Number,
                required: false
            },
            half_yearly: {
                type: Number,
                required: false
            },
            yearly: {
                type: Number,
                required: false
            }
        },
        image: {
            type: ObjectId,
            ref: "media",
            required: false,
        },
        batches: [{
            days: {
                type: [String],
                enum: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'],
                required: true
            },
            start_time: {
                type: String,
                required: true
            },
            end_time: {
                type: String,
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
        plan_for: {
            type: String,
            enum: ['KID', 'KIDS', 'ADULT'],
            default: 'ADULT'
        },
        kids_category: {
            type: String,
            enum: ['JUNIOR', 'ADVANCED'],
            required: function() {
                return this.plan_for === 'KID' || this.plan_for === 'KIDS';
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


