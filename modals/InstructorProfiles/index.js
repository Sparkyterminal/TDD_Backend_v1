const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;

const instructorProfileSchema = new Schema(
    {
        user_id: {
            type: ObjectId,
            ref: 'user',
            required: true,
            unique: true
        },
        bio: {
            type: String,
            required: false
        },
        specialties: {
            type: [String],
            default: []
        },
        socials: {
            instagram: { type: String, required: false },
            youtube: { type: String, required: false },
            tiktok: { type: String, required: false },
            website: { type: String, required: false }
        },
        video_intro_url: {
            type: String,
            required: false
        },
        headshot_url: {
            type: String,
            required: false
        },
        spotlight: {
            type: Boolean,
            default: false
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

instructorProfileSchema.index({ specialties: 'text', bio: 'text' });

instructorProfileSchema.set('toJSON', {
    transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
    }
});

module.exports = mongoose.model('instructorprofile', instructorProfileSchema);


