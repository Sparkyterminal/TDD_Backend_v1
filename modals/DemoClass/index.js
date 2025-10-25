const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;


const demoBooking = new Schema(
    {
    
        plan: {
            type: ObjectId,
            ref: 'membershipplan',
            required: true
        },
        name: {
            type: String,
            required: true,
          },
          age: {
            type: Number,
            required: true,
            min: 0,
          },
          email: {
            type: String,
            required: true,
          },
          mobile_number: {
            type: String,
            required: true,
          },
          gender: {
            type: String,
            enum: ['Male', 'Female', 'Other'],
            required: true,
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



demoBooking.set('toJSON', {
    transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
    }
});

module.exports = mongoose.model('demo_booking', demoBooking);


