const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;

const workshopSchema = new Schema(
    {
        title: {
            type: String,
            required: true
        },
        description: {
            type: String,
            required: false
        },
        // instructor_user_ids: {
        //     type: [ObjectId],
        //     ref: 'user',
        //     default: []
        // },
        media: [
            {
            type: ObjectId,
            ref: "media",
            required: false,
            }
          ],   
        // space_id: {
        //     type: ObjectId,
        //     ref: 'studiospace',
        //     required: false
        // },
        paymentResult: {
            status: String,
          },
        date: {
            type: Date,
            required: true
        },
        batches: [{
            start_time: {
                type: Date,
                required: true
            },
            end_time: {
                type: Date,
                required: true
            },
            name: {
                type: String,
                required: false
            },
            capacity: {
                type: Number,
                required: false
            },
            pricing: {
                early_bird: {
                    price: {
                        type: Number,
                        required: false
                    },
                    capacity_limit: {
                        type: Number,
                        required: false
                    }
                },
                regular: {
                    price: {
                        type: Number,
                        required: false
                    }
                },
                on_the_spot: {
                    price: {
                        type: Number,
                        required: false
                    }
                }
            },
            is_cancelled: {
                type: Boolean,
                default: false
            }
        }],
        
        price: {
            type: Number,
            required: false
        },
        tags: {
            type: [String],
            default: []
        },
        // media: {
        //     cover_image_url: { type: String, required: false },
        //     gallery_urls: { type: [String], default: [] }
        // },
        is_cancelled: {
            type: Boolean,
            default: false
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

workshopSchema.index({ start_at: 1 });
workshopSchema.index({ title: 'text', description: 'text', tags: 'text' });

workshopSchema.set('toJSON', {
    transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
    }
});

module.exports = mongoose.model('workshop', workshopSchema);


