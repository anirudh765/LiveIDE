import React from "react";
import {Link} from "react-router-dom";
import { useNavigate } from "react-router-dom";

const Navbar = ({roomPage,userName})=>{
    const navigate = useNavigate();

    const handleLogin = ()=>{
       navigate('/login');
    }

    const handleSignUp = ()=>{
       navigate('/signup');
    }
    return (
       <div className="navbar">
           <div className="logo"><span>Live</span>IDE</div>
           {roomPage ? <div className="user" style={{fontSize:"30px" , fontFamily:"monospace"}}><h1>Welcome {userName}!</h1></div>: 
            <div className="authentication">
            <button onClick={handleLogin} id="login"><Link id="loginLink" to="/login">Login</Link></button>
            <button onClick={handleSignUp} id="signup"><Link id="signupLink" to="/signup">SignUP</Link></button>
          </div> }
          
       </div>
    );
}

export default Navbar;