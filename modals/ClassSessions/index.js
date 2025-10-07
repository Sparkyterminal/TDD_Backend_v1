const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;

const classSessionSchema = new Schema(
    {
        class_type_id: {
            type: ObjectId,
            ref: 'classtype',
            required: true
        },
        instructor_user_id: {
            type: ObjectId,
            ref: 'user',
            required: true
        },
        class_name: {
            type: String,
            required: true
        },
        // space_id: {
        //     type: ObjectId,
        //     ref: 'studiospace',
        //     required: false
        // },
        start_at: {
            type: Date,
            required: true
        },
        end_at: {
            type: Date,
            required: true
        },
        capacity: {
            type: Number,
            required: false
        },
        price_drop_in: {
            type: Number,
            required: false
        },
        duration_minutes: {
            type: Number,
            required: false
        },
        is_cancelled: {
            type: Boolean,
            default: false
        }
    },
    {
        timestamps: true
    }
);

classSessionSchema.index({ class_type_id: 1, start_at: 1 });

classSessionSchema.set('toJSON', {
    transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
    }
});

module.exports = mongoose.model('classsession', classSessionSchema);


