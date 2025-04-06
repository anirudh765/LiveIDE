import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { FaUser } from "react-icons/fa";
import Image7 from "../Images/Image7.jpg"

const Login = ({ onLogin }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate(); 

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post("http://localhost:5000/user/login", {
        email,
        password,
      },{
        withCredentials: true // This sends cookies with requests
      });

      const { username, email: userEmail } = response.data; // Safely destructure response

      const token = response.data.token;
      document.cookie = `userToken=${token}; path=/; HttpOnly; Secure`; 

      console.log("Login successful, username:", username, "email:", userEmail); // Debugging log

      if (username) {
        console.log("navigating...");
        onLogin(username); // Update session state in App.js
        navigate(`/dashboard`); // Redirect to dashboard
      }
    } catch (error) {
      console.error("Login error:", error.response?.data || error.message); // Log error details
      alert("Invalid credentials or Server error");
    }
};

  return (
    <div className="login">
      <div className="loginPage">
       <div className="loginForm">
        <FaUser className="userIcon"/>
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            name="email"
            placeholder="Email..."
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="off"
          />
          <input
            type="password"
            name="password"
            placeholder="Password..."
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="off"
          />
          <button type="submit">Login</button>
        </form>
        <p>
          Don't have an account? <Link id="createAccount" to="/signup">Create account</Link>
        </p>
       </div>
       <div className="loginImage">
         <img src={Image7} alt="Image7"></img>
       </div>
      </div>
      
    </div>
  );
};

export default Login;
