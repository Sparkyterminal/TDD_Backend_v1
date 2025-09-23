const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;

const rentalSchema = new Schema(
    {
        user_id: {
            type: ObjectId,
            ref: 'user',
            required: true
        },
        space_id: {
            type: ObjectId,
            ref: 'studiospace',
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
            required: true
        },
        status: {
            type: String,
            enum: ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'],
            default: 'PENDING'
        },
        notes: {
            type: String,
            required: false
        },
        payment_id: {
            type: ObjectId,
            ref: 'payment',
            required: false
        },
        is_archived: {
            type: Boolean,
            default: false
        }
    },
    {
        timestamps: true
    }
);

rentalSchema.index({ user_id: 1, space_id: 1, start_at: 1 });

rentalSchema.set('toJSON', {
    transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
    }
});

module.exports = mongoose.model('rental', rentalSchema);


