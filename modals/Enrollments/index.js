const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;

const enrollmentSchema = new Schema(
    {
        user_id: {
            type: ObjectId,
            ref: 'user',
            required: true
        },
        class_session_id: {
            type: ObjectId,
            ref: 'classsession',
            required: false
        },
        workshop_id: {
            type: ObjectId,
            ref: 'workshop',
            required: false
        },
        status: {
            type: String,
            enum: ['PENDING', 'CONFIRMED', 'CANCELLED', 'ATTENDED', 'NO_SHOW'],
            default: 'CONFIRMED'
        },
        price_paid: {
            type: Number,
            required: false
        },
        attendance: [
            {
                check_in_at: { type: Date },
                status: { type: String, enum: ['PRESENT', 'ABSENT'], default: 'PRESENT' }
            }
        ]
    },
    {
        timestamps: true
    }
);

enrollmentSchema.index({ user_id: 1, class_session_id: 1 });

enrollmentSchema.set('toJSON', {
    transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
    }
});

module.exports = mongoose.model('enrollment', enrollmentSchema);


