const mongoose = require('mongoose');
const { scanOnce } = require('../services/moderationService');
// Ensure your environment variables are loaded (dotenv)
require('dotenv').config(); 

const run = async () => {
  try {
    console.log('Connecting to MongoDB...');
    
    // Replace the URL with your actual DB environment variable
    const DB_URL = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/your_db_name';
    
    await mongoose.connect(DB_URL);
    console.log('Connected successfully.');

    console.log('Manually triggering moderation scan...');
    await scanOnce();
    console.log('Moderation scan finished.');
    
    // Gracefully close the connection and exit
    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('Error during moderation script:', err);
    process.exit(1);
  }
};

run();