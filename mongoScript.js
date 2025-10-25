// MongoDB Script to create users for existing bookings
// Run this in MongoDB Compass or mongo shell

// Step 1: Find all bookings without users
db.membershipbookings.find({user: {$exists: false}}).count()

// Step 2: For each booking, create a user and update the booking
// This is a simplified version - you'll need to run this for each booking

// Example for one booking:
// 1. Create user
db.users.insertOne({
  first_name: "Sanmitha",
  last_name: "",
  media: [],
  email_data: {
    temp_email_id: "sub@gmail.com",
    is_validated: true
  },
  phone_data: {
    phone_number: "8892957359",
    is_validated: true
  },
  role: "USER",
  password: "$2b$10$hashedpassword", // You'll need to hash this
  is_active: true,
  is_archived: false,
  createdAt: new Date(),
  updatedAt: new Date()
})

// 2. Update booking with user reference
db.membershipbookings.updateOne(
  {_id: ObjectId("68fb0c6c5eadb0fd9b518ffb")},
  {$set: {user: ObjectId("new_user_id")}}
)
