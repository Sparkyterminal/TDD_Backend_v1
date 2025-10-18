const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;

const enquire = new Schema(
    {
    
        name: {
            type: String,
            required: true
        },
        phone_number:{
            type: Number,
            required: true
        },
        email_id: {
            type: String,
            required: false
        },
        purpose: {
            type: String,
            required: true
        },
        is_contacted:{
            type: Boolean,
            default: false
        }
    },
    {
        timestamps: true
    }
);

enquire.index({ user_id: 1, space_id: 1, start_at: 1 });

enquire.set('toJSON', {
    transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
    }
});

module.exports = mongoose.model('enquire', enquire);


