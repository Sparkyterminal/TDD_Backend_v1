const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const classTypeSchema = new Schema(
    {
        title: {
            type: String,
            required: true
        },
        level: {
            type: String,
            enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ALL'],
            default: 'ALL'
        },
        category: {
            type: String,
            required: false
        },
       
        description: {
            type: String,
            required: false
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

classTypeSchema.index({ title: 'text', category: 'text', description: 'text' });

classTypeSchema.set('toJSON', {
    transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
    }
});

module.exports = mongoose.model('classtype', classTypeSchema);


