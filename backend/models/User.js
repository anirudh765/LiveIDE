const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true, // Removes extra spaces
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true, // Ensures all emails are stored in lowercase
    },
    password: {
      type: String,
      required: true,
    },
    folders: {
      type: [[String]],
      default: [],
    },
    rooms: {
      type: [
        {
          roomId: { type: String, required: true }, // Room ID
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

module.exports = User;
