import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Route, Routes, Navigate, useParams } from "react-router-dom";
import FrameworkSelection from "./components/FrameworkSelection";
import FetchFiles from "./components/FetchFiles";
import Home from "./components/Home";
import Login from "./components/Login";
import Signup from "./components/Signup";

function App() {
  const roomID = useParams();
  const [username, setUsername] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [frameworkname, setFrameworks] = useState([]);
  const [foldername, setFolder] = useState("");

  // Fetch the username on app load
  /*useEffect(() => {
    const fetchUsername = async () => {
      try {
        const response = await fetch("http://localhost:5000/get-username", {
          credentials: "include", // Ensures cookies are sent
        });
    
        if (response.ok) {
          const data = await response.json();
          setUsername(data.username);
        } else {
          console.error("Failed to fetch username. Redirecting to login...");
          setUsername(null);
        }
      } catch (err) {
        console.error("Error fetching username:", err);
      }
    };    

    fetchUsername();
  }, []);*/

  // const handleLogin = (username) => {
  //   console.log("Username set in App.js:", username); // Debugging log
  //   setUsername(username);
  // };


  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login onLogin={setUsername} />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/dashboard" element = {<FrameworkSelection />}/>
        <Route path="/:username/editor/:frameworkname/:foldername/:roomId" element={<FetchFiles/>}/>
        {username && (
          <>
            {/*<Route
              path="/dashboard"
              element={
                <div className="dashboardContainer">
                  <FrameworkSelection username={username} setFrameworks={setFrameworks}
                    setFolder={setFolder} />
                </div>
              }
            />*/}
            {/*<Route
              path="/:username/editor/:frameworkname/:foldername/:roomId"
              element={
                <div className="roomContainer">
                  <FetchFiles
                    username={username}
                    frameworkname={frameworkname}
                    foldername={foldername}
                    roomId={roomID}
                  />
                </div>
              }
            />*/}
            <Route path="*" element={<Navigate to="/login" />} />
          </>
        )}
      </Routes>
    </Router>
  );
}

export default App;
