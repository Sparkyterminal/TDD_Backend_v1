const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;

const bookingSchema = new Schema(
    {
        user_id: {
            type: ObjectId,
            ref: 'user',
            required: true
        },
        resource_type: {
            type: String,
            enum: ['SPACE', 'CLASS', 'WORKSHOP', 'PODCAST', 'RETREAT'],
            required: true
        },
        resource_id: {
            type: ObjectId,
            required: true
        },
        start_at: {
            type: Date,
            required: true
        },
        end_at: {
            type: Date,
            required: true
        },
        price: {
            type: Number,
            required: false
        },
        payment_id: {
            type: ObjectId,
            ref: 'payment',
            required: false
        },
        status: {
            type: String,
            enum: ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'],
            default: 'PENDING'
        }
    },
    {
        timestamps: true
    }
);

bookingSchema.index({ resource_type: 1, resource_id: 1, start_at: 1 });

bookingSchema.set('toJSON', {
    transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
    }
});

module.exports = mongoose.model('booking', bookingSchema);


