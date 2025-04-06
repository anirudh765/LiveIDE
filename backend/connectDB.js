const mongoose = require("mongoose");
require("dotenv").config(); // Load environment variables

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 20000, // 20 seconds timeout
    });
    console.log("Database connected successfully");
  } catch (error) {
    console.error("Database connection error:", error.message);
    process.exit(1); // Exit process on failure
  }
};

module.exports = connectDB;
