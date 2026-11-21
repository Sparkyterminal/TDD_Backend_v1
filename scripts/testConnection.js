// Simple test script to create users for bookings
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Connect to MongoDB
const DB_URL = "mongodb://127.0.0.1:27017/dance_district";

async function testConnection() {
  try {
    await mongoose.connect(DB_URL, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB successfully');
    
    // Test if we can access the collections
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log('Available collections:', collections.map(c => c.name));
    
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Connection error:', error);
  }
}

testConnection();
