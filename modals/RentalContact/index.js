const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;

const rentalContacts = new Schema(
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
            enum : ['Wellness',"Interviews", "Wedding",'Dance'],
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

rentalContacts.index({ user_id: 1, space_id: 1, start_at: 1 });

rentalContacts.set('toJSON', {
    transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
    }
});

module.exports = mongoose.model('rental_contacts', rentalContacts);


