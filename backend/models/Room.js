const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const roomSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
      unique: true,
    },
    roomName: {
      type: String,
      required: true,
    },
    creatorId: {
      type: String, // Reference to the User schema
      ref: "User",
      required: true,
    },
    creatorFolder: {
      type: String, // Folder name of the creator
      required: true,
    },
    creatorFramework: {
      type: String, // Framework used by the creator
      required: true,
    },
    users: {
      type: [String], // List of user IDs
      default: [],
    },
  },
  { timestamps: true }
);

const Room = mongoose.model("Room", roomSchema);

module.exports = Room;
