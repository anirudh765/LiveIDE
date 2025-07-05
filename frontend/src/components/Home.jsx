import React from "react";
import Navbar from "./Navbar";
import Image4 from "../Images/Image4.png"
import Image2 from "../Images/Image2.webp"
import Image5 from "../Images/Image5.png"
import Image6 from "../Images/Image6.png"
import { RiUserCommunityLine } from "react-icons/ri";
import { TbMilitaryRankFilled } from "react-icons/tb";
import { IoBugSharp } from "react-icons/io5";
import {useState,useEffect} from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const Home = ()=>{
    const [LoggedIn,setLoggedIn] = useState(false);
    const navigate = useNavigate();

    const checkIsLoggedIn = async()=>{
         const response = await axios.get("http://localhost:5000/checklogin",{
              withCredentials: true 
         });
         setLoggedIn(response.data.check);
        
    }

    const handleGetStarted = async ()=>{
        if(LoggedIn){
            navigate("/dashboard")
        }else{
            navigate("/login");
        }
    }

    useEffect(()=>{
        checkIsLoggedIn();
    })

    return(
        <div className="home">
            <Navbar/>
            <div className="content1">
                <div className="leftcontent1">
                  <h1 className="maincontent">Live code collaboration IDE</h1>
                  <p>" Collaboration without borders, code without limits."</p>
                  <button id="getstarted" onClick={handleGetStarted}>Get Started</button>
                </div>
                <div className="rightcontent1">
                   <img src={Image4} alt="Image4"></img>
                </div>
            </div>

            <div className="content2">
                <div className="leftcontent2">
                   <img src={Image2} alt="Image2"></img>
                </div>
                <div className="rightcontent2">
                   <h1>Collaborate</h1>
                   <h2>" Work together, no matter where you are. "</h2>
                </div>
            </div>

            <div className="content3">
                <div className="leftcontent3">
                  <h1>Create Room and Join Room</h1>
                  <p>" Instantly set up a secure space to collaborate with others. Share your room link and code together live! "</p>
                </div>
                <div className="rightcontent3">
                   <img src={Image5} alt="Image5"></img>
                </div>
            </div>

            <div className="content4">
               <div className="benefits">
                  <div className="top">Benefits of Live Code Collaboration</div>
                  <div className="bcards">
                       <div className="card">
                           <TbMilitaryRankFilled />
                           <p>Increase Productivity</p>
                       </div>
                       <div className="card">
                           <IoBugSharp />
                           <p>Reduce Errors</p>
                       </div>
                       <div className="card">
                           <RiUserCommunityLine />
                           <p>Improve Morale</p>
                       </div>
                  </div>
                  <div className="bottom">
                    Real-time collaboration reduces development time,streamless workflows,minimizes errors, improves code quality and fosters better communication
                  </div>
               </div>
            </div>

            <div className="content5">
                <div className="leftfooter">
                    <h1>Get Started Today!</h1>
                    <p>Transform Your Team's Coding Experience. Live code collaboration empowers developers to build better software, faster, and more efficiently. Sign up for a free and experience the difference .</p>
                </div>
                <div className="rightfooter">
                    <img src={Image6} alt="Image6"></img>
                </div>
            </div>
        </div>
    );
}

export default Home; 