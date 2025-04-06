import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { FaUserCircle } from "react-icons/fa";
import Image8 from "../Images/Image8.png"

const SignUp = () => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post("http://localhost:5000/user/signup", {
        username,
        email,
        password,
      });
  
      if (response.status === 201) {
        // Navigate to login on successful signup
        navigate("/login");
      } else {
        // Handle unexpected non-error responses (shouldn't happen here)
        alert("Unexpected response. Please try again.");
      }
    } catch (error) {
      if (error.response?.status === 400) {
        // Show specific backend error
        alert(error.response.data.message);
      } else {
        // Generic error for all other cases
        alert("Something went wrong. Please try again!");
      }
    }
  };
  

  return (
    <div className="signup">
      <div className="signupPage">
        <div className="signupImage">
           <img src={Image8} alt="Image8"></img>
        </div>
        <div className="signupForm">
         <FaUserCircle className="userIcon"/>
         <form onSubmit={handleSubmit}>
          <input
            type="text"
            name="username"
            placeholder="Username..."
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="off"
          />
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
          <button type="submit" id="signupBtn">
            Signup
          </button>
         </form>
         <p>Welcome to Live code collaboration IDE :)</p>
        </div>
      </div>
    </div>
  );
};

export default SignUp;
