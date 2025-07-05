import  { useState, useEffect } from "react";
import axios from "axios";
import io from "socket.io-client";
import { useParams } from "react-router-dom";
import { Editor } from "@monaco-editor/react";
import * as Y from "yjs";
import { WebrtcProvider } from "y-webrtc";
import { MonacoBinding } from "y-monaco";
import * as monaco from "monaco-editor";
import { FaTrashCan } from "react-icons/fa6";
import { FaFileCirclePlus } from "react-icons/fa6";
import { FaFolderClosed } from "react-icons/fa6";
import { HiUserGroup } from "react-icons/hi2";
import { FaUserTie } from "react-icons/fa";
import { IoExtensionPuzzleSharp } from "react-icons/io5";
import { HiMiniCommandLine } from "react-icons/hi2";
import { SiGoogleclassroom } from "react-icons/si";
import { useNavigate } from "react-router-dom";
import Navbar from "./Navbar";
 
const socket = io.connect("http://localhost:5000"); 

const FetchFiles = () => {
  const { username, frameworkname, foldername,roomId } = useParams();
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [code, setCode] = useState("");
  const [editorLanguage, setEditorLanguage] = useState("plaintext");
  const [deleted, setDeleted] = useState(false);
  const [newFileAdded, setNewFileAdded] = useState(false);
  const [newFile, setNewFile] = useState("");
  const [extensions, setExtensions] = useState([]);
  const [saved, setSaved] = useState(false);
  const [iframeSrc, setIframeSrc] = useState("");
  const [participants, setParticipants] = useState([]);
  const [editor, setEditor] = useState(null);
  const [decorations, setDecorations] = useState([]);
  const [output, setOutput] = useState("");
  const [userId, setUserId] = useState("");
  const [url , seturl] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    if (!roomId || !username) return;

    socket.emit("join-room", { roomId, username });

    socket.on("participants-updated", (newParticipants) => {
      if (Array.isArray(newParticipants)) {
         const formattedParticipants = newParticipants.map((p) => ({
          username: p.username || "Unknown User",
          userId: p.userId || "Unknown ID",
        }));
        setParticipants(formattedParticipants);
      } else {
        console.error("Invalid participants format received:", newParticipants);
      }
    });

    return () => {
      //socket.disconnect(); 
    };
    
  }, []);

  useEffect(() => {
    const storedUserId = localStorage.getItem("userId") || crypto.randomUUID();
    localStorage.setItem("userId", storedUserId);
    setUserId(storedUserId);
  
    socket.emit("INIT_CONTAINER", {
      envType: frameworkname,
      userId: storedUserId,
    });
  
    socket.on("USER_ID_UPDATED", ({ userId }) => {
      console.log("Updated userId received:", userId);
  
      localStorage.setItem("userId", userId);
      setUserId(userId);
    });
  
    socket.on("OUTPUT", (data) => {
      setOutput((prev) => prev + "\n" + data);
    });
  
    socket.on("CONTAINER_CREATED", (data) => {
      console.log(`Your environment is ready at: ${data.url}`);
      seturl(data.url);
      const link = document.getElementById("url");
      if (link) {
        link.innerText = data.url;
      }
      else{
       console.log("nothing here");
      }
    });

    return () => {
      socket.off("USER_ID_UPDATED");
      socket.off("OUTPUT");
      socket.off("CONTAINER_CREATED");
    };
  }, [frameworkname, socket]); 
  
  useEffect(() => {
    if (!roomId || roomId === "1" || !username || !editor) return;
  
    const ydoc = new Y.Doc();
    const yText = ydoc.getText("monaco");
    const provider = new WebrtcProvider(roomId, ydoc, {
      signaling: ['ws://localhost:4444'],
    });
  
    provider.on("status", (event) => {
      console.log("Yjs WebRTC connection status:", event.connected ? "Connected" : "Disconnected");
    });
  
    const awareness = provider.awareness;
  
    awareness.setLocalState({
      name: username,
      color: `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0")}`,
      cursor: null,
    });
  
    const updateCursors = () => {
      if (!editor) return;
  
      document.querySelectorAll(".username-label").forEach((el) => el.remove());
      const states = Array.from(awareness.getStates().values());
  
      setDecorations(editor.deltaDecorations(decorations, []));
  
      const isFullScreen = window.innerWidth >= 1000; 
  
      const newDecorations = states
        .filter((state) => state.cursor && state.name !== username)
        .map((state) => {
          const { line, column } = state.cursor;
  
          const nameTag = document.createElement("div");
          nameTag.className = "username-label";
          nameTag.innerText = state.name;
          nameTag.style.position = "absolute";
          nameTag.style.backgroundColor = "rgba(0, 0, 0, 0.75)";
          nameTag.style.color = "white";
          nameTag.style.fontSize = "12px";
          nameTag.style.padding = "2px 6px";
          nameTag.style.borderRadius = "3px";
          nameTag.style.whiteSpace = "nowrap";
          nameTag.style.zIndex = "100";
          nameTag.style.pointerEvents = "none";
  
          const cursorPos = editor.getScrolledVisiblePosition({
            lineNumber: line,
            column: column,
          });
  
          if (cursorPos) {
            if (isFullScreen) {
              nameTag.style.left = `${cursorPos.left + 390}px`;
              nameTag.style.top = `${cursorPos.top + 130}px`;
            } else {
              nameTag.style.left = `${cursorPos.left + 270}px`;
              nameTag.style.top = `${cursorPos.top + 135}px`;
            }
          }
  
          document.body.appendChild(nameTag);
  
          return {
            range: new monaco.Range(line, column, line, column + 1),
            options: {
              className: "remote-cursor",
              inlineClassName: "cursor-label",
              stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTyping,
            },
          };
        });
  
      setDecorations(editor.deltaDecorations(decorations,[]));
    };
  
    const handleCursorChange = () => {
      if (!editor) return;
      const position = editor.getPosition();
      awareness.setLocalStateField("cursor", {
        line: position.lineNumber,
        column: position.column,
      });
      updateCursors();
    };
  
    editor.onDidChangeCursorPosition(handleCursorChange);
    awareness.on("change", updateCursors);
  
    const binding = new MonacoBinding(yText, editor.getModel(), new Set([editor]), awareness);
  
    return () => {
      document.querySelectorAll(".username-label").forEach((el) => el.remove());
      awareness.off("change", updateCursors);
      binding.destroy();
      provider.destroy();
      ydoc.destroy();
    };
  }, [editor]);  
 
  useEffect(() => {
    if (iframeSrc) {
      const iframe = document.getElementById("outputIframe");
      iframe.src = iframeSrc;
    }
  }, [iframeSrc]);
  
  const fetchFiles = async () => {
    if (!foldername) return;
    try {
        const response = await axios.get(`http://localhost:5000/folder/${foldername}`);
        setFiles(response.data);
    } catch (error) {
        console.error("Error fetching the files:", error);
    }
}

const sendCommand = (e) => {
  if (e.key === "Enter") {
    socket.emit("COMMAND", { command: e.target.value, userId });
    e.target.value = "";
  }
};

const saveFile = () => {
  if (!selectedFile) {
    console.error("No file selected to save.");
    return;
  }

  const fileData = {
    type: "SAVE_FILE",
    userId,
    filename: selectedFile, // Using the selected file from state
    content: code, // Using the code from state
  };

  console.log(fileData);
  socket.emit("SAVE_FILE", fileData);
  setSaved(true); // Mark file as saved
};

const runFile = () => {
  if (!selectedFile) {
    console.error("No file selected to run.");
    return;
  }

  setTimeout(() => {
    setIframeSrc(prevSrc => prevSrc); // Forces reload
  }, 5000);

  socket.emit("RUN_FILE", {
    filename: selectedFile,
    userId,
    envType: frameworkname,
  });
};


const getExtensions = async () => {
    try {
        const response = await axios.get(`http://localhost:5000/extensions/${frameworkname}`);
        setExtensions(response.data);
    } catch (error) {
        console.error("Error in getting extensions:", error);
    }
}

useEffect(()=>{
   getExtensions();
},[extensions])

useEffect(() => {
  fetchFiles();
}, [files]);

  useEffect(() => {
    
    const languageMap = {
      nodejs: "javascript",
      python: "python",
      cpp: "cpp",
      ruby: "ruby",
      rust: "rust",
      django: "python",
    };
    setEditorLanguage(languageMap[frameworkname] || "plaintext");
  }, [frameworkname, deleted, newFileAdded, extensions, saved]);

  const handleFileSelect = async (fileKey) => {
    setSelectedFile(fileKey);
    try {
      const response = await axios.get("http://localhost:5000/file", {
        params: { key: fileKey },
      });
      console.log(response.data);
      setCode(response.data);
    } catch (error) {
      console.error("Error fetching file content:", error);
    }
  };

  const handleCodeChange = (value) => {
    setCode(value);
  };

  const handleUpdateCode = async () => {
    setSaved(true);
    try {
      await axios.put(`http://localhost:5000/codeUpdate`, {
        fileKey: selectedFile,
        newCode: code,
        foldername: foldername,
      });
      setSaved(false);

      if (!selectedFile) {
        console.error("No file selected to save.");
        return;
      }
      console.log("hello from savefile");
    const fileData = {
      type: "SAVE_FILE",
      userId,
      filename: selectedFile,
      content: code, 
    };
  
    console.log(fileData);
    socket.emit("SAVE_FILE", fileData);

    } catch (error) {
      console.error("Error in Updating code : ", error);
    }
  };

  // Add a new file
  const handleAddFile = async (newFile) => {
    setNewFileAdded(false);
    console.log(foldername);
    try {
      await axios.post(
        `http://localhost:5000/addFile/${frameworkname}/${foldername}/${newFile}`
      );
      setNewFileAdded(true);
      setNewFile("");
    } catch (error) {
      console.error("Error in adding file : ", error);
    }
  };

  // Delete a file
  const handleDeleteFile = async (Key) => {
    setDeleted(false);
    try {
      await axios.delete(`http://localhost:5000/deleteFile`, {
        params: {
          fileKey: Key,
          foldername: foldername,
        },
      });
      setDeleted(true);
    } catch (error) {
      console.error("Error in deleting file", error);
    }
  };

  const handleExitRoom = async () => {
    socket.emit("exit-room", { roomId, username });
    navigate("/dashboard");
  };
  

  return (
    <div className="Editor">
    <div className="editorNav"><Navbar roomPage="true" userName={username}/></div>
    <div className="frameworkEditor">
      <div className="menu">

        <div className="headername">
        <h3 ><FaFolderClosed id="folderIcon" /> {foldername}</h3><hr />
        </div>

        <div className="fileList">
        <ul style={{ listStyleType: "none", padding: 0 }}>
          {files.map((file) => (
            <li key={file.key}>
              <div
                className="fileSelection"
                style={{
                  backgroundColor: selectedFile === file.key ? "#276EF1" : "",
                }}
                onClick={() => {
                  handleFileSelect(file.key);
                  console.log(file.key);
                }}
              >
                {file.key.split("/").pop()}
                <FaTrashCan id="trash" onClick={() => handleDeleteFile(file.key)}/>
              </div>
            </li>
          ))}
        </ul>
        </div>

        <div className="addFile">
            <input
              type="text"
              value={newFile}
              onChange={(e) => setNewFile(e.target.value)}
              placeholder="Enter file name..."
            ></input>
             <FaFileCirclePlus id="addFileIcon" onClick={() => handleAddFile(newFile)}/>
        </div>

        <div className="extensions">
          <h2><IoExtensionPuzzleSharp id="extIcon"/>Extensions : </h2>
          <div className="extensionsList">
            {extensions ? (
              extensions.map((extension, index) => (
                <div className="extension" key={index}>
                  {extension}
                </div>
              ))
            ) : (
              <p>Empty...</p>
            )}
          </div>
        </div>
        
        <div className="roomIdMain">
          {roomId !== "1" && 
        <div className="roomIdDisplay">
          <h1><SiGoogleclassroom id="roomIcon"/>Room ID : </h1>
          <h2>{roomId}</h2>
        </div> 
          }
        </div>

        <div className="participants">
        {
         roomId !== "1" && 
        <div className="participants">
          <h3><HiUserGroup id="teamIcon"/> Participants :</h3>
         <div className="roomParticipantList">
           <div style={{width:"100%"}}>
           {participants.length > 0 ? (
            participants.map((p, index) => (
             <div key={index} className="roomParticipantItem">
              <FaUserTie />{p.username} 
             </div>
           ))
           ) : (
           <p>No participants yet</p>
           )}
           </div>
         </div>
       </div>
       }
        </div>

        <div className="exit">
          <button  type="submit" onClick={handleExitRoom}>Exit Room</button>
        </div>

      </div>
 
      <div className="editorTerminal">
        <div className="editor">
          <div className={saved === true ? "saved" : "unsaved"}>
            <span>Saved</span>
            <p>Your code has been saved successfully</p>
          </div> 

          <div className="monacoEditor">
           <Editor
            width="100%"
            height="500px"
            language={editorLanguage}
            theme="vs-dark"
            position="relative"
            value={code}
            onChange={handleCodeChange}
            onMount={(ed) => setEditor(ed)}
           />
          </div>
        
          <div className="execBtns"> 
            <button id="runBtn" onClick={runFile}>Run</button>
            <button id="saveBtn" onClick={handleUpdateCode}>Save</button>
          </div>
        </div>

        <div className="commandPrompt">
            <div className="cmdInner">
             <HiMiniCommandLine id="cmdIcon"/>
             <input
               type="text"
               onKeyDown={sendCommand}
               placeholder="Type command and press Enter..."
             />
            </div>

            <div id="url">Open : {url}</div>
            <div id="codeOutput"><pre>{output}</pre></div>
        </div>
        
      </div>
    </div>
</div>
  );
};

export default FetchFiles;
