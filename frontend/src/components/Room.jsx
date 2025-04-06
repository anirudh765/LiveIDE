import React, { useEffect, useState } from "react";
import io from "socket.io-client";

const socket = io.connect("http://localhost:5000"); // Backend WebSocket connection

function Room({ username, roomId }) {
  const [participants, setParticipants] = useState([]);

  console.log(participants);
  
  useEffect(() => {
    if (!roomId || !username) return;

    // Join room with username and roomId
    socket.emit("join-room", { roomId, username });

    // Update participants when notified by the server
    socket.on("participants-updated", (newParticipants) => {
      if (Array.isArray(newParticipants)) {
        // Ensure mapping is compatible with the user structure in the room schema
        const formattedParticipants = newParticipants.map((p) => ({
          username: p.username || "Unknown User",
          userId: p._id || "Unknown ID",
        }));
        setParticipants(formattedParticipants);
      } else {
        console.error("Invalid participants format received:", newParticipants);
      }
    });

    return () => {
      socket.disconnect(); // Clean up socket connection on unmount
    };
  }, [roomId, username]);

  if (!roomId) {
    return <div>No room selected</div>; // Default message when no room is selected
  }

  return (
    <div>
      <h2>Welcome to Room: {roomId}</h2>
      <p>Username: {username}</p>

      {/* Participants List */}
      <div className="roomParticipantList">
        <h3>Participants:</h3>
        <ul>
          {participants.length > 0 ? (
            participants.map((p, index) => (
              <li key={index} className="roomParticipantItem">
                {p.username} (ID: {p.userId})
              </li>
            ))
          ) : (
            <p>No participants yet</p>
          )}
        </ul>
      </div>
    </div>
  );
}

export default Room;