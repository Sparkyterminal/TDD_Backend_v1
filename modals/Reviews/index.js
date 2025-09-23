const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;

const reviewSchema = new Schema(
    {
        user_id: {
            type: ObjectId,
            ref: 'user',
            required: true
        },
        target_type: {
            type: String,
            enum: ['CLASS', 'INSTRUCTOR', 'SPACE', 'STUDIO'],
            required: true
        },
        // target_id: {
        //     type: ObjectId,
        //     required: false
        // },
        // rating: {
        //     type: Number,
        //     min: 1,
        //     max: 5,
        //     required: true
        // },
        text: {
            type: String,
            required: false
        },
        // video_url: {
        //     type: String,
        //     required: false
        // },
        status: {
            type: String,
            enum: ['PENDING', 'APPROVED', 'REJECTED'],
            default: 'PENDING'
        }
    },
    {
        timestamps: true
    }
);

reviewSchema.index({ target_type: 1, target_id: 1 });

reviewSchema.set('toJSON', {
    transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
    }
});

module.exports = mongoose.model('review', reviewSchema);


