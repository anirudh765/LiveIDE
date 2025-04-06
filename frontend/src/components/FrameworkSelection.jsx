import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from 'axios';
import Image5 from "../Images/Image5.png"
import Image9 from "../Images/Image9.jpg"
import Navbar from "./Navbar";

function FrameworkSelection() {
    const [frameworks, setFrameworks] = useState([]);
    const [folder, setFolder] = useState("");
    const [selectedFramework, setSelectedFramework] = useState("");
    const folderOpened = useRef(false);
    const [userFolders, setUserFolders] = useState([]);
    const [selectedFolder, setSelectedFolder] = useState([]);
    const [roomName, setRoomName] = useState("");
    const [roomId, setRoomId] = useState("");
    const [newFoldercreated,setNewFoldercreated]= useState(false);
    const [username,setUsername] = useState(null);
    const navigate = useNavigate();

   useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await axios.get("http://localhost:5000/me", { withCredentials: true });
        setUsername(res.data.username);
      } catch (error) {
        setUsername(null); // Reset username if not authenticated\
        console.log("ERROR : ",error);
      }
     };
     fetchUser();
   }, []);


    const openFolder = () => {
        try {
            console.log("folder : ", userFolders);
            console.log("Selected folder", selectedFolder);
            const folderFramework = selectedFolder.slice(selectedFolder.indexOf(',') + 1,);
            const folder = selectedFolder.slice(0, selectedFolder.indexOf(','));
            folderOpened.current = true;
            const roomId = "1";
            navigation(folderFramework, folder, roomId);
        } catch (error) {
            console.log("Error in opening Folder:", error);
        }
    };

    const deleteFolder = async () => {
        try {
          console.log("Current folders:", userFolders);
          console.log("Selected folder to delete:", selectedFolder);
      
          const folderFramework = selectedFolder.slice(selectedFolder.indexOf(',') + 1);
          const folder = selectedFolder.slice(0, selectedFolder.indexOf(','));
      
          await axios.post("http://localhost:5000/deletefolder", {
            username,
            foldername: folder,
            frameworkname: folderFramework
          }, {
            withCredentials: true
          });
      
          console.log(`Deleted folder ${folder} (${folderFramework})`);
          fetchUserFolders();
        } catch (error) {
          console.error("Error deleting folder:", error);
        }
      };      

     const handleLogout = async ()=>{
         try{
           await axios.get('http://localhost:5000/logout',{
             withCredentials: true 
           });
           console.log("Logout successful, navigating now...");
           navigate("/",{ replace: true });
         }catch(error){
            console.error("Error in logout : ",error);
         }
      }
    // Create a copy folder of the selected framework
    const createFolder = async () => {
        if (!folderOpened.current) {
            try {
                const response = await axios.post(`http://localhost:5000/newfolder`,
                    {
                        username: username,
                        frameworkname: selectedFramework,
                        foldername: folder,
                    },
                    {
                        withCredentials: true
                    }
                );
                folderOpened.current = true;
                setNewFoldercreated(true);
                //navigation(selectedFramework, folder);
            } catch (error) {
                alert("Use another foldername , foldername already exist or Server error");
                console.log("Error in pushing data to backend : ", error);
            }
        }
        else {
            console.log("Not creating a new folder", folderOpened.current)
        }
    }

    const navigation = (framework, folderName, roomID) => {
        console.log("Framework in dashboard:", framework);
        console.log("Folder in dashboard:", folderName);
        console.log("Room ID in dashboard:", roomID);
        console.log("Folder Opened:", folderOpened.current);
        if (folderOpened.current) {

            navigate(`/${username}/editor/${framework}/${folderName}/${roomID}`);
        } else {
            console.log("No folder created or folder selection invalid");
        }
    };

    const fetchFrameworks = async () => {
        try {
            const response = await axios.get('http://localhost:5000/frameworks');
            setFrameworks(response.data);
        } catch (error) {
            console.error('Error fetching frameworks:', error);
        }
    }

    const fetchUserFolders = async () => {
        console.log("username :: ", username);
        try {
            const response = await axios.get(`http://localhost:5000/userFolders/${username}`);
            console.log(response);
            setUserFolders(response.data);
        } catch (error) {
            console.error("Error in fetching user folders", error);
        }
    }

    useEffect(() => {
        console.log("USEeffect username : ",username);
        if (username) {
          fetchFrameworks(); 
          fetchUserFolders();
        }
    }, [username, newFoldercreated]);
      

    const handleCreateRoom = async () => {
        try {
            // Extract folder and framework from selectedFolder
            const folderFramework = selectedFolder.slice(selectedFolder.indexOf(',') + 1);
            const folder = selectedFolder.slice(0, selectedFolder.indexOf(','));

    
            const response = await axios.post("http://localhost:5000/create-room", {
                username,
                roomName,
                creatorFolder: folder,        // <-- Include creatorFolder
                creatorFramework: folderFramework, // <-- Include creatorFramework
            });
    
            const roomId = response.data.roomId;
            console.log("RoomId:", roomId);
    
            folderOpened.current = true;
            if (roomId) navigation(folderFramework, folder, roomId);
        } catch (err) {
            console.error("Error creating room:", err);
        }
    };
    

    const handleJoinRoom = async (roomId) => {
        try {
            if (!roomId || !username) {
                console.error("Missing roomId or username");
                return;
            }
    
            const response = await axios.post("http://localhost:5000/join-room", {
                roomId,
                username
            });
    
            console.log("Join Room Response:", response.data);
            const { folderFramework, folderName : folder  } = response.data;
            
            folderOpened.current = true;
            navigation(folderFramework, folder, roomId);
    
        } catch (err) {
            console.error("Error joining room:", err);
        }
    };
    

    return (
        <div className="frameworkSelection">
            <div className="fsdashboard">
             <Navbar roomPage="true" userName={username}/>
             <span className="logoutbtn">
                <button onClick={handleLogout}>Logout</button>
             </span>
             <div className="roomHandling">
              <div className="leftRoomContent">
                <h1>" Start a room instantly and collaborate with your team. "</h1>
               <div className="createRoom">
                {/*<input
                    type="text"
                    placeholder="Enter Room Name"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                />*/}
                <button onClick={handleCreateRoom} disabled={!username}>
                    New Meeting
                </button>
               </div>

               <div className="joinRoom">
                <input
                    type="text"
                    placeholder="Enter Room ID"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                />
                <button onClick={() => handleJoinRoom(roomId)}>Join Room</button>
               </div>
              </div>

              <div className="rightRoomContent">
                <img src={Image5} alt="Imagee5"></img>
              </div>
            </div>

            <div className="dashboard">
                <div className="folderDisplay">
                    <div className="leftFolderDisplay">
                       <img src={Image9} alt="Image9"></img>
                    </div>

                    <div className="rightFolderDisplay">
                    <div className="userFolders">
                        <select
                            onChange={(e) => setSelectedFolder(e.target.value)}
                            defaultValue=""
                        >
                            <option value="" disabled>Select Your Folder</option>
                            {userFolders.map((folder) => (
                                <option key={folder} value={folder}>{folder[0]}</option>
                            ))}
                        </select>
                        <button onClick={openFolder} id="openFolder">Open Folder</button>
                        <button onClick={deleteFolder} id="deleteFolder">Delete Folder</button>
                    </div>

                    <div className="foldercreation">
                        <input type="text" placeholder="Foldername..." autoComplete="off" value={folder} onChange={(e) => setFolder(e.target.value)}></input>
                        <select
                            onChange={(e) => setSelectedFramework(e.target.value)}
                            defaultValue=""
                        >
                            <option value="" disabled>Select Framework</option>
                            {frameworks.map((fw) => (
                                <option key={fw} value={fw}>{fw}</option>
                            ))}
                        </select>
                        <button onClick={createFolder} id="createFolder">Create Folder</button>
                    </div>
                    </div>
                </div>

            </div>            
            </div>
        </div> 
    );
} 

export default FrameworkSelection;

