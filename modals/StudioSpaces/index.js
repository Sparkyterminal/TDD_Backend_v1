const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;

const studioSpaceSchema = new Schema(
    {
        name: {
            type: String,
            required: true
        },
        description: {
            type: String,
            required: false
        },
        photos: {
            type: [String],
            default: []
        },
        amenities: {
            type: [String],
            default: []
        },
        capacity: {
            type: Number,
            required: false
        },
        hourly_rate: {
            type: Number,
            required: false
        },
        location: {
            address_line1: { type: String, required: false },
            address_line2: { type: String, required: false },
            city: { type: String, required: false },
            state: { type: String, required: false },
            postal_code: { type: String, required: false },
            country: { type: String, required: false },
            geo: {
                lat: { type: Number, required: false },
                lng: { type: Number, required: false }
            }
        },
        is_active: {
            type: Boolean,
            default: true
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

studioSpaceSchema.index({ name: 'text', description: 'text', amenities: 'text' });

studioSpaceSchema.set('toJSON', {
    transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
    }
});

module.exports = mongoose.model('studiospace', studioSpaceSchema);


