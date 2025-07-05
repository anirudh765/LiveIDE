const express = require("express");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { execSync, exec, spawn } = require("child_process");
const { Server } = require("socket.io");
const bodyParser = require("body-parser");
const cors = require("cors");
const s3Client = require("./storjClient");
const connectDB = require("./connectDB");
const Users = require("./models/User");
const Room = require("./models/Room");
const { hashPassword, comparePasswords } = require('./hashPassword');
const session = require("express-session");
const MongoStore = require("connect-mongo")
require('dotenv').config();
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

const Docker = require("dockerode");
const docker = new Docker();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true, 
  },
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());


const JWTSECRET_KEY = process.env.JWT_SECRET 
const verifyToken = (req, res, next) => {
  const token = req.cookies.userToken

  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  jwt.verify(token, JWTSECRET_KEY, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: "Invalid token" });
    }

    req.user = decoded; 
    next(); 
  });
};

const webrtcServer = exec("node y-webrtc/bin/server.js");

webrtcServer.stdout.on("data", (data) => {
  console.log(`WebRTC Server: ${data}`);
});

webrtcServer.stderr.on("data", (data) => {
  console.error(`WebRTC Server Error: ${data}`);
});

webrtcServer.on("exit", (code) => {
  console.log(`WebRTC Server exited with code ${code}`);
});
// Connecting with cloud data base for users
connectDB();

app.use((req, res, next) => {
  res.setHeader("X-Frame-Options", "ALLOWALL"); // Allow all origins
  res.setHeader("Content-Security-Policy", "frame-ancestors 'self' *");
  res.setHeader('Cache-Control', 'no-store');
  next();
});
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(bodyParser.json());

app.use(cors({ origin: "http://localhost:3000", credentials: true }));

app.use(session({
  secret: process.env.SECRET_KEY,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI, 
    collectionName: "sessions", 
    ttl: 24 * 60 * 60, 
    autoRemove: "native"
  }),
  proxy: true,
  cookie: { secure: false, httpOnly: true, sameSite: "lax" ,maxAge: 24 * 60 * 60 * 1000 }
}));

const BUCKET_NAME = "finaltask";
const BASE_FOLDER = "base/";

const BASE_PORT = 5050;
const MAX_PORT = 5150;
let freePorts = [];
let nextAvailablePort = BASE_PORT;
let userIdcounter = 1;
const userContainers = {};

const getImageForType = (type) => {
  switch (type) {
    case "python":
      return "python:latest";
    case "nodejs":
      return "node:20";
    case "cpp":
      return "gcc:latest";
    case "rust":
      return "rust:latest";
    case "django":
      return "python:3.10";
    case "ruby":
      return "ruby:latest";
    default:
      return "ubuntu";
  }
};

 
const roomParticipants = {};   

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);
   
  socket.on("update-frameworks", (frameworks) => {
    io.emit("frameworks-updated", frameworks);
  });

  socket.on("code-updated", (updatedFile) => {
    io.emit("file-updated", updatedFile);
  });

  socket.on("INIT_CONTAINER", async ({ envType, userId }) => {
    const newUserId = userIdcounter++;
    userId = newUserId;
    if (!userId) {
      
      console.log("userId is required");
      return;
    }

    if (userContainers[userId]) {
      console.log(`User ${userId} reconnected. Reusing existing container.`);
      userContainers[userId].socket = socket;
     
      console.log("Reconnected to existing container.");
      return;
    }

    const image = getImageForType(envType);
  
      const assignedPort = nextAvailablePort;
      nextAvailablePort++;
      console.log(`Spinning up container with image: ${image}`);

    const cmd =
      envType === "python"
        ? [
            "/bin/sh",
            "-c",
            `
 mkdir -p /home/app && cd /home/app &&
 apt update &&
 apt install -y python3-pip &&
 pip install flask flask-cors &&
 /bin/sh
`,
          ]
        : envType === "nodejs"
        ? [
            "/bin/sh",
            "-c",
            `
 mkdir -p /home/app && cd /home/app &&
 apt update &&
 apt install -y curl &&
 curl -fsSL https://deb.nodesource.com/setup_20.x | bash - &&
 apt install -y nodejs &&
 npm config set prefix /home/app &&
 npm install express &&
 /bin/sh
`,
          ]
        : envType === "cpp"
        ? [
            "/bin/sh",
            "-c",
            `
 mkdir -p /home/app && cd /home/app &&
 apt update &&
 apt install -y g++ make &&
 /bin/sh
`,
          ]
        : envType === "rust"
        ? [
            "/bin/sh",
            "-c",
            `
 mkdir -p /home/app && cd /home/app && \
 apt update && apt install -y curl && \
 curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y && \
 export PATH="$HOME/.cargo/bin:$PATH" && \
 cargo init --bin && \
 echo 'actix-web = "4"' >> Cargo.toml && \
 echo 'use actix_web::{web, App, HttpResponse, HttpServer, Responder}; async fn index() -> impl Responder { HttpResponse::Ok().body("Hello from Rust inside the container!") } #[actix_web::main] async fn main() -> std::io::Result<()> { HttpServer::new(|| App::new().route("/", web::get().to(index))).bind("0.0.0.0:5000")?.run().await }' > src/main.rs && \
 tail -f /dev/null
`,
          ]
        : envType === "django"
        ? [
            "/bin/sh",
            "-c",
            `
       mkdir -p /home/app && cd /home/app &&
       pip install django &&
       django-admin startproject myproject . &&
       tail -f /dev/null
     `,
          ]
        : envType === "ruby"
        ? [
            "/bin/sh",
            "-c",
            `
         mkdir -p /home/app && cd /home/app &&
         apt update &&
         apt install -y ruby-full &&
         gem install sinatra rackup puma &&
         tail -f /dev/null
       `,
          ]
        : ["/bin/sh"];

    try {
      const container = await docker.createContainer({
        Image: image,
        Tty: true,
        //Cmd: ["/bin/sh"],
        Cmd: cmd,
        WorkingDir: "/home/app",
        OpenStdin: true,
        AttachStdin: true,
        AttachStdout: true,
        AttachStderr: true,
        ExposedPorts: { "5000/tcp": {} },
        HostConfig: {
          PortBindings: { "5000/tcp": [{ HostPort: assignedPort.toString() }] },
        },
      });

      await container.start();
      console.log("container created");
      userContainers[userId] = { container, port: assignedPort, socket };
      console.log("containers userId", userId);
      if (assignedPort === nextAvailablePort) nextAvailablePort++;

      socket.emit("USER_ID_UPDATED", { userId });

      socket.emit("CONTAINER_CREATED", {
        userId,
        port: assignedPort,
        url: `http://localhost:${assignedPort}`,
      });
    } catch (error) {
      console.log("showing error : ", error);
      socket.emit(error);
    }
  });

  socket.on("COMMAND", async ({ command, userId }) => {
    console.log(command);
    const userData = userContainers[userId];
    console.log("command userId", userId);
    if (!userData) return;
    const { container } = userData;

    try {
      const exec = await container.exec({
        AttachStdin: true,
        AttachStdout: true,
        AttachStderr: true,
        Tty: true,
        Cmd: ["/bin/sh", "-c", command],
      });

      const stream = await exec.start({ hijack: true, stdin: true });
      stream.on("data", (data) => socket.emit("OUTPUT", data.toString()));
    } catch (error) {
      // socket.emit("ERROR", error.message);
      console.log(error);
    }
  });

  socket.on("SAVE_FILE", async ({ userId, filename, content }) => {
    console.log("save file userid : ", userId);
    const workingDir = "/home/app";
    const trimmedFilename = filename.split("/").pop(); // Removes the folder path
    filename = trimmedFilename;
    const isCodeFile =
      filename.endsWith(".js") ||
      filename.endsWith(".json") ||
      filename.endsWith(".py") ||
      filename.endsWith(".cpp") ||
      filename.endsWith(".rs") ||
      filename.endsWith(".html") ||
      filename.endsWith(".css") ||
      filename.endsWith(".toml") ||
      filename.endsWith(".rb") ||
      filename.endsWith(".gitignore") ||
      filename.endsWith(".env"); // Added support for Rust files

    //const filePath = isCodeFile ? `${workingDir}/${filename}` : `/${filename}`;

    const isRustFile = filename.endsWith(".rs");
    const filePath = isRustFile
      ? `${workingDir}/src/bin/${filename}`
      : `${workingDir}/${filename}`;

    const userData = userContainers[userId];
   
    const container = userData.container;

    const exec = await container.exec({
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
      Cmd: [
        "/bin/sh",
        "-c",
        `mkdir -p ${isRustFile ? `${workingDir}/src/bin` : workingDir} && echo '${content.replace(
          /'/g,
          "'\\''"
        )}' > ${filePath}`,
      ],
    });

    const stream = await exec.start({ hijack: true, stdin: true });
    let response = "";

    stream.on("data", (data) => {
      response += data.toString();
    });

    stream.on("end", () => {
      io.emit("OUTPUT", `File ${filename} saved successfully!`);
    });
  });

  socket.on("RUN_FILE", async ({ userId, filename, envType }) => {
    const userData = userContainers[userId];
    const trimmedFilename = filename.split("/").pop(); // Removes the folder path
    filename = trimmedFilename;
    if (!userData) return;
    const container = userData.container;

    const filePath = `/home/app/${filename}`;

    let runCommand;
    if (filename.endsWith(".js")) {
      runCommand = `cd /home/app &&
            ls -l ${filePath} &&  # Debugging step to check if the file exists
            export PATH=$PATH:/usr/local/bin &&
            node ${filePath}`;
    } else if (filename.endsWith(".py") && envType === "python") {
      runCommand = `
          cd /home/app &&
          FLASK_APP=${filename} flask run --host=0.0.0.0 --port=5000 --no-reload > /flask_output.log 2>&1 || echo "FLASK_FAILED" &&
          cat /flask_output.log
        `;
    } else if (filename.endsWith(".cpp")) {
      runCommand = `
              cd /home/app &&
              g++ -fno-diagnostics-color ${filePath} -o /home/app/test.out 2>/dev/null &&
              chmod +x /home/app/test.out &&
              /home/app/test.out
          `;
    } else if (filename.endsWith(".rs")) {
      const binaryName = filename.replace(/\.rs$/, ""); // Remove ".rs" extension
      runCommand = `
          cd /home/app &&
          cargo build --release --bin ${binaryName} --quiet &&
          chmod +x target/release/${binaryName} &&
          target/release/${binaryName} | tr -cd '\\11\\12\\15\\40-\\176'
        `;
    } else if (filename.endsWith(".py") && envType === "django") {
      // Assuming Django projects use .django for execution
      runCommand = `
            cd /home/app &&
            python3 ${filename} migrate &&  # Apply migrations (only needed once)
            python3 ${filename} runserver 0.0.0.0:5000  # Start Django server
          `;
    } else if (filename.endsWith(".rb")) {
      runCommand = `cd /home/app && ruby ${filePath}`;
    } else {
      // ws.send("Unsupported file type.");
      console.log("unsupported file type");
      return;
    }

    const exec = await container.exec({
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
      Cmd: ["/bin/sh", "-c", runCommand],
    });

    const stream = await exec.start({ hijack: true, stdin: true });
    let response = "";

    stream.on("data", (data) => {
      response += data.toString();
    });

    stream.on("error", (error) => {
      response += error.toString(); // Capture errors properly
    });

    stream.on("end", async () => {
      if (response.includes("Running on")) {
        const inspectData = await container.inspect();
        const mappedPort =
          inspectData.NetworkSettings.Ports["5000/tcp"]?.[0]?.HostPort;
        if (mappedPort) {
          //console.log(mappedPort);
          socket.emit(
            "OUTPUT",
            `Flask app available at: <a href='http://localhost:${mappedPort}' target='_blank'>http://localhost:${mappedPort}</a>`
          );
        } else {
          // ws.send("Error: Could not retrieve mapped port");
          socket.emit("OUTPUT", "Could not retrieve mapped port");
        }
      }
      // ws.send(response.trim() || "No output from execution.");
      io.emit("OUTPUT", response.trim() || "No output from execution.");
    });
  });

  socket.on("join-room", ({ roomId, username }) => {
    if (!roomId || !username) return;

    // Ensure room exists
    if (!roomParticipants[roomId]) {
        roomParticipants[roomId] = [];
    }

    // Remove any duplicate entries for the same username
    roomParticipants[roomId] = roomParticipants[roomId].filter(
      (participant) => participant.username !== username
    );
    
    socket.join(roomId);
    console.log(`${username} joined room: ${roomId}`);
    roomParticipants[roomId].push({ username, socketId: socket.id });
    
    
    socket.emit("room-joined", { roomId, username });

    // Emit the updated list of participants to all users in the room, including the new user
    io.to(roomId).emit(
      "participants-updated",
      roomParticipants[roomId].map((participant) => ({
        username: participant.username,
        userId: participant.socketId, // Or use actual user ID from database if available
      }))
    );
});

  socket.on("disconnect", async () => {
    // Find and remove the user from all rooms
    for (const [roomId, participants] of Object.entries(roomParticipants)) {
      roomParticipants[roomId] = participants.filter(
        (participant) => participant.socketId !== socket.id
      );

      // Notify remaining participants in the room
      io.to(roomId).emit(
        "participants-updated",
        roomParticipants[roomId].map((participant) => ({
          username: participant.username,
        }))
      );

    }

    console.log(`Socket disconnected: ${socket.id}`);
//

    const userId = Object.keys(userContainers).find(
      (id) => userContainers[id].socket.id === socket.id
    );
    if (!userId) return;

    const { container, port } = userContainers[userId];
    try {
      const inspect = await container.inspect();
      if (inspect.State.Running) await container.stop({ force: true });
      await container.remove({ force: true });
      console.log(`Freed port ${port}`);
      freePorts.push(port);
    } catch (error) {
      console.error("Error stopping/removing container:", error.message);
    }
    delete userContainers[userId];

    //
  });

  socket.on("exit-room", ({ roomId, username }) => {
    if (!roomParticipants[roomId]) return;
  
    // Remove user from memory
    roomParticipants[roomId] = roomParticipants[roomId].filter(
      (participant) => participant.socketId !== socket.id
    );
  
    // Notify remaining participants
    io.to(roomId).emit(
      "participants-updated",
      roomParticipants[roomId].map((participant) => ({
        username: participant.username,
      }))
    );
  
    // Leave the socket room
    socket.leave(roomId);
    console.log(`User ${username} exited room ${roomId}`);
  });

  socket.on("code-updated", ({ roomId, updatedFile }) => {
    io.to(roomId).emit("file-updated", updatedFile); // Broadcast to specific room
  });
  
  socket.on("code-change", ({ roomId, newCode }) => {
    console.log(`Code updated in room ${roomId}`);
    io.to(roomId).emit("code-updated", newCode); // Broadcast code to all participants
  });

  socket.on("leave-room", ({ roomId, username }) => {
    socket.leave(roomId);
    console.log(`${username} left room: ${roomId}`);
    io.to(roomId).emit("participants-updated", [...new Set(getParticipants(roomId))]);
  });
});

const getParticipants = (roomId) => {
  const room = io.sockets.adapter.rooms.get(roomId);
  return room ? Array.from(room) : [];
};

app.post(`/:frameworkname/:selectedFile/:foldername`, async (req, res) => {
  const framework = req.params.frameworkname;
  const filename = req.params.selectedFile;
  const foldername = req.params.foldername;

  const { hostPort } = req.body;
  if (framework == "nodejs") {
    try {
      const uniqueTag = `node-app-image:${Date.now()}`;

      console.log("Building Docker image...");
      execSync(`docker build -t ${uniqueTag} .`, {
        cwd: path.join(__dirname, foldername),
        stdio: "inherit",
      });

      console.log("Stopping existing container (if any)...");
      execSync(`docker rm -f node-container || true`, { stdio: "inherit" });

      console.log("Starting new container...");
      execSync(
        `docker run -d -p ${hostPort}:3000 --name node-container ${uniqueTag}`,
        { stdio: "inherit" }
      );

      const appUrl = `http://localhost:${hostPort}`;
      console.log(`Node.js app deployed at ${appUrl}`);
      res.json({ url: appUrl });
    } catch (error) {
      console.error("Deployment error:", error.message);
      res.status(500).json({ error: error.message });
    }
  }
  else if (framework == "python") {
    try {
      const uniqueTag = `flask-app-image:${Date.now()}`;
      const appFolder = path.join(__dirname, foldername);

      console.log("Building Docker image...");
      execSync(`docker build -t ${uniqueTag} .`, {
        cwd: appFolder,
        stdio: "inherit",
      });

      console.log("Stopping existing container (if any)...");
      execSync(`docker rm -f flask-container || true`, { stdio: "inherit" });

      console.log("Starting new container...");
      execSync(
        `docker run -d -p ${hostPort}:5000 --name flask-container ${uniqueTag}`,
        { stdio: "inherit" }
      );

      const appUrl = `http://localhost:${hostPort}`;
      console.log(`Flask app deployed at ${appUrl}`);
      res.json({ url: appUrl });
    } catch (error) {
      console.error("Deployment error:", error.message);
      res.status(500).json({ error: error.message });
    }
  }
  else if (framework == "reactjs") {
    try {
      const uniqueTag = `react-app-image:${Date.now()}`;

      console.log("Building Docker image...");
      execSync(`docker build -t ${uniqueTag} .`, {
        cwd: path.join(__dirname, foldername),
        stdio: "inherit",
      });

      console.log("Stopping existing container (if any)...");
      execSync(`docker rm -f react-container || true`, { stdio: "inherit" });

      console.log("Starting new container...");
      execSync(
        `docker run -d -p ${hostPort}:3000 --name react-container ${uniqueTag}`,
        { stdio: "inherit" }
      );

      const appUrl = `http://localhost:${hostPort}`;
      console.log(`React app deployed at ${appUrl}`);
      res.json({ url: appUrl });
    } catch (error) {
      console.error("Deployment error:", error.message);
      res.status(500).json({ error: error.message });
    }
  }
  else {
    try {
      const folderAbsolutePath = path.join(__dirname, foldername);
      const filePath = path.join(folderAbsolutePath, filename);

      if (!filename.endsWith(".cpp")) {
        return res.status(400).json({
          output: "Error: Only .cpp files are allowed.",
          success: false,
        });
      }

      const outputFilePath = filePath.replace(".cpp", ".exe");

      exec(`g++ ${filePath} -o ${outputFilePath} -I${folderAbsolutePath}`, (compileError) => {
        if (compileError) {
          return res.status(400).json({
            output: `Compilation Error: ${compileError.message}`,
            success: false,
          });
        }

        console.log("Compilation successful, running the program...");

        exec(outputFilePath, { cwd: folderAbsolutePath }, (runError, stdout, stderr) => {
          if (runError) {
            return res.status(400).json({
              output: `Runtime Error: ${runError.message}`,
              success: false,
            });
          }

          res.json({
            output: stdout || stderr || "Program executed successfully, but no output.",
            success: true,
          });
        });
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        output: "An unexpected error occurred.",
        error: error.message,
        success: false,
      });
    }

  };
});

app.post("/stop", async (req, res) => {
  const { hostPort, framework } = req.body;

  try {
    console.log(`Stopping container for framework ${framework} on port ${hostPort}...`);

    let containerName;
    switch (framework) {
      case "nodejs":
        containerName = "node-container";
        break;
      case "reactjs":
        containerName = "react-container";
        break;
      case "python":
        containerName = "flask-container";
        break;
      default:
        return res.status(400).json({ error: "Invalid framework specified." });
    }

    execSync(`docker rm -f ${containerName} || true`, { stdio: "inherit" });

    console.log(`Container for ${framework} stopped and port ${hostPort} freed.`);
    res.json({ message: `${framework} app stopped successfully.` });
  } catch (error) {
    console.error("Error stopping container:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/createFolderFromS3", async (req, res) => {
  const { folderName, files, framework } = req.body;

  if (!folderName || !Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ error: "Folder name and files are required." });
  }

  const folderPath = path.join(__dirname, folderName);

  try {
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath);
    }

    for (const fileKey of files) {
      try {
        const params = { Bucket: BUCKET_NAME, Key: fileKey };
        const data = await s3Client.getObject(params).promise();

        const filePath = path.join(folderPath, path.basename(fileKey));
        fs.writeFileSync(filePath, data.Body.toString("utf-8"));
      } catch (error) {
        console.error(`Error fetching file '${fileKey}':`, error);
      }
    }

    if (framework && framework.toLowerCase() !== "cpp") {
      const dockerfilePath = path.join(folderPath, "Dockerfile");
      let dockerfileContent = "";

      switch (framework.toLowerCase()) {
        case "nodejs":
          dockerfileContent = `
FROM node:16

# Set the working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy the application code
COPY . .

# Command to run your Node.js application
CMD [\"node\", \"example.js\"]`;
          break;

        case "python":
          dockerfileContent = `
FROM python:3.9-slim

# Set the working directory inside the container
WORKDIR /app

# Copy the requirements file into the container
COPY requirements.txt .

# Install dependencies
RUN pip install -r requirements.txt

# Copy the rest of the application code into the container
COPY . .

# Expose the port that Flask will run on
EXPOSE 5000

# Run the Flask app
CMD [\"python\", \"main.py\"]`;
          break;

        case "reactjs":
          dockerfileContent = `
FROM node:16

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application files
COPY . .

# Build the React app
RUN npm run build

# Use a lightweight HTTP server for serving the app
RUN npm install -g serve

# Expose the port the app runs on
EXPOSE 3000

# Start the app
CMD [\"serve\", \"-s\", \"build\"]`;
          break;

        default:
          console.warn("Unsupported framework specified, no Dockerfile created.");
          break;
      }

      if (dockerfileContent) {
        fs.writeFileSync(dockerfilePath, dockerfileContent);
      }
    }

    res.status(200).json({
      message: `Folder '${folderName}' created with files from S3.`,
    });
  } catch (error) {
    console.error("Error creating folder or fetching files:", error);
    res.status(500).json({ error: "Failed to create folder or fetch files." });
  }
});


app.get("/", (req, res) => {
  res.send("Live Code Collaboration IDE!");
});

app.get("/frameworks", async (req, res) => {
  try {
    const data = await s3Client
      .listObjectsV2({
        Bucket: BUCKET_NAME,
        Prefix: BASE_FOLDER,
        Delimiter: "/",
      })
      .promise();
    const frameworks = data.CommonPrefixes.map(
      (prefix) => prefix.Prefix.split("/")[1]
    );
    res.status(200).json(frameworks);
  } catch (error) {
    console.error("Error fetching frameworks:", error);
    res.status(500).json({ error: "Failed to fetch frameworks." });
  }
});

app.get("/folder/:name", async (req, res) => {
  const foldername = req.params.name;

  try {
    const data = await s3Client
      .listObjectsV2({ Bucket: BUCKET_NAME, Prefix: `${foldername}/` })
      .promise();
    if (!data.Contents.length) {
      return res.status(404).json({ error: "Folder not found." });
    }

    const files = data.Contents.map((file) => ({
      key: file.Key,
      size: file.Size,
    }));
    res.status(200).json(files);
  } catch (error) {
    console.error("Error retrieving folder files:", error);
    res.status(500).json({ error: "Failed to retrieve folder files." });
  }
});

app.get("/file", async (req, res) => {
  const { key } = req.query;

  if (!key) {
    return res.status(400).json({ error: "File key is required." });
  }

  try {
    const params = { Bucket: BUCKET_NAME, Key: key };
    const data = await s3Client.getObject(params).promise();
    res.status(200).send(data.Body.toString("utf-8"));
  } 
  catch (error) {
    console.error("Error retrieving file content:", error);
    res.status(500).json({ error: "Failed to retrieve file content." });
  }
});

// Creating a new folder
const getFileName = (filename) => {
  let file = filename.toString();
  let index = file.lastIndexOf("/");
  return file.slice(index + 1);
};

app.post("/newfolder", verifyToken,async (req, res) => {
  const { frameworkname, foldername } = req.body;
  const username = req.user.username;

  if (!username || !frameworkname || !foldername) {
    return res.status(400).send("Missing required fields");
  }

  try {
    const user = await Users.findOne({ username });
    if (!user) {
      return res.status(404).send("User not found");
    }

    const folderData = await s3Client
      .listObjectsV2({ Bucket: BUCKET_NAME, Prefix: foldername + '/', Delimiter: '/' })
      .promise();

    if (folderData.KeyCount === 0) {
      const fileData = await s3Client
        .listObjectsV2({ Bucket: BUCKET_NAME, Prefix: `base/${frameworkname}/` })
        .promise();

      const fileContentPromises = fileData.Contents.map(async (file) => {
        const key = file.Key;
        const params = {
          Bucket: BUCKET_NAME,
          Key: key,
        };
        const data = await s3Client.getObject(params).promise();
        return {
          filename: key,
          content: data.Body.toString("utf-8"),
        };
      });
      const filesContent = await Promise.all(fileContentPromises);

      const fileUploadPromises = filesContent.map(async (file) => {
        const filename = getFileName(file.filename);
        const fileparams = {
          Bucket: BUCKET_NAME,
          Key: `${foldername}/${filename}`,
          Body: file.content,
        };
        await s3Client.putObject(fileparams).promise();
      });
      await Promise.all(fileUploadPromises);

      user.folders.push([foldername, frameworkname]);
      await user.save();

      return res.status(200).send(`Folder created: ${foldername}`);
    } else {
      return res.status(400).send("Folder already exists. Use another folder name.");
    }
  } catch (error) {
    console.error("Error in creating folder", error);
    res.status(500).send("Server error while creating folder");
  }
});

app.put("/codeUpdate", async (req, res) => {
  const { fileKey, newCode } = req.body; // Extract file key and updated content

  if (!fileKey || !newCode) {
    return res.status(400).json({ error: "File key and new code are required." });
  }

  try {
    // Upload the updated file content to Storj S3
    const s3Params = {
      Bucket: BUCKET_NAME,
      Key: fileKey,
      Body: newCode,
      ContentType: "text/plain", // Adjust based on file type
    };

    const s3Response = await s3Client.putObject(s3Params).promise();

    res.status(200).json({ message: "File updated successfully", s3Response });
  } catch (error) {
    console.error("Error in updating code:", error);
    res.status(500).json({ error: "Error in updating code" });
  }
});


app.post("/addFile/:framework/:folder/:filename", async (req, res) => {
  const newFileName = req.params.filename;
  const frameworkname = req.params.framework;
  const foldername = req.params.folder;

  if (newFileName) {
    const dotIndex = newFileName.lastIndexOf(".");
    const extension = newFileName.slice(dotIndex + 1);

    if (dotIndex < newFileName.length && dotIndex > 0) {
      try {
        const fileData = await s3Client
          .listObjectsV2({
            Bucket: BUCKET_NAME,
            Prefix: `base/${frameworkname}/`,
          })
          .promise();

        let copyFileContent;

        for (let file of fileData.Contents) {
          const key = file.Key;
          const ext = key.slice(key.lastIndexOf(".") + 1);

          if (ext === extension) {
            const params = {
              Bucket: BUCKET_NAME,
              Key: key,
            };
            const data = await s3Client.getObject(params).promise();
            copyFileContent = data.Body.toString("utf-8");
            break;
          }
        }

        if (!copyFileContent) {
          console.error("No content found for the file.");
          return res.status(400).send("Content not found for the file.");
        }

        const newParams = {
          Bucket: BUCKET_NAME,
          Key: `${foldername}/${newFileName}`,
          Body: copyFileContent,
        };
        await s3Client.putObject(newParams).promise();

        const localDirectory = path.join(__dirname, foldername);

        if (!fs.existsSync(localDirectory)) {
          console.log(`${foldername} directory does not exist. Creating it...`);
          fs.mkdirSync(localDirectory, { recursive: true });
        } else {
          console.log(`${foldername} directory already exists.`);
        }

        const localFilePath = path.join(localDirectory, newFileName);

        try {
          fs.writeFileSync(localFilePath, copyFileContent, "utf-8");
          console.log(`File ${newFileName} successfully written to Code1 folder.`);
        } catch (err) {
          console.error(`Failed to write file ${newFileName}:`, err);
          return res.status(500).send("Failed to write file locally.");
        }

        res.status(200).send("File added successfully");
      } catch (error) {
        console.error("Error in adding file to the folder:", error);
        res.status(500).send("Error in adding new file");
      }
    } else {
      res.status(400).send("Invalid filename");
    }
  } else {
    console.log("Filename is not defined");
    res.status(400).send("Filename is not defined");
  }
});

app.post("/deletefolder", async (req, res) => {
  const { username, foldername, frameworkname } = req.body;

  try {
    const user = await Users.findOne({ username });

    if (!user) return res.status(404).json({ message: "User not found" });

    // Filter out the folder to delete
    user.folders = user.folders.filter(
      (folder) => !(folder[0] === foldername && folder[1] === frameworkname)
    );

    await user.save();

    res.status(200).json({ message: "Folder reference removed successfully" });
  } catch (err) {
    console.error("Error deleting folder:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Delete File
app.delete("/deleteFile", async (req, res) => {
  const { fileKey, foldername } = req.query;

  if (!fileKey || !foldername) {
    return res.status(400).send("File key and folder name are required");
  }

  try {
    const params = {
      Bucket: BUCKET_NAME,
      Key: fileKey,
    };

    await s3Client.deleteObject(params).promise();
    console.log(`File ${fileKey} successfully deleted from cloud storage.`);

    const localFilePath = path.join(__dirname, foldername, path.basename(fileKey));
    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
      console.log(`File ${localFilePath} successfully deleted from local folder.`);
    } else {
      console.log(`File ${localFilePath} does not exist locally.`);
    }

    res.status(200).send("File deleted successfully");
  } catch (error) {
    console.error("Error in deleting file:", error);
    res.status(500).send("Error in deleting file");
  }
});


app.get("/extensions/:framework", async (req, res) => {
  const frameworkname = req.params.framework;

  try {
    const fileData = await s3Client
      .listObjectsV2({ Bucket: BUCKET_NAME, Prefix: `base/${frameworkname}/` })
      .promise();
    const extensions = fileData.Contents.map((file) => {
      const key = file.Key;
      const ext = key.slice(key.lastIndexOf("."));
     
      return ext;
    });
    res.status(200).send(extensions);
  } catch (error) {
    console.error("Error in fetching extensions", error);
    res.send(500, "Error in fetching extensions");
  }
});

// signup
app.post("/user/signup", async (req, res) => {
  const { username, email, password } = req.body;

  try {
    const existingUsername = await Users.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({ message: "Username already exists" });
    }

    const existingEmail = await Users.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const hashedPassword = await hashPassword(password);
    await Users.create({ username, email, password: hashedPassword });

    res.status(201).json({ message: "User created successfully" });
  } catch (error) {
    console.error("Signup Error:", error); // Log error for debugging
    res.status(500).json({ message: "Error in user signup" });
  }
});


// login
app.post("/user/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await Users.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User doesn't exist, check email" });
    }

    const hashedPassword = user.password;
    const plainPassword = password;

    const token = jwt.sign({ userId: user.id, username: user.username }, JWTSECRET_KEY, { expiresIn: "15d" });
    res.cookie("userToken", token, {
      httpOnly: true,
      secure: false,
      sameSite: "Strict",
      maxAge: 15 * 24 * 60 * 60 * 1000,
      path: '/'
    });


    if (await comparePasswords(plainPassword, hashedPassword)) {
      return res.status(200).json({
        message: "Login successful",
        username: user.username,
        email: user.email,
        token:token
      });
    } else {
      return res.status(400).json({ message: "Wrong password" });
    }
  } catch (error) {
    console.error("Error in user login:", error);
    res.status(500).json({ message: "Error in user login" });
  }
});

// Getting user folders
app.get("/userFolders/:username", async (req, res) => {
  const  username = req.params.username;
  try {
    const user = await Users.findOne({ username });
    
    if (!user) return res.status(404).send("No user found");

    res.status(200).send(user.folders);
  } catch (error) {
    res.status(500).json({ ERROR: error });
  }
})


app.post("/create-room",async (req, res) => {
  const { username,roomName, creatorFolder, creatorFramework } = req.body; 

  try {
    const user = await Users.findOne({ username });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
  
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    let roomId = "";
    for (let i = 0; i < 10; i++) {
      roomId += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    
    // Create a new room
    const newRoom = new Room({
      roomId,
      roomName: roomName || `Room of ${username}`,
      creatorId: user._id, 
      creatorFolder,     
      creatorFramework,  
      users: [user._id],  
    });

    await newRoom.save();

    user.rooms.push({ roomId });
    await user.save();

    res.status(201).json({ roomId, roomName: newRoom.roomName });
  } catch (error) {
    console.error("Error creating room:", error);
    res.status(500).send("Error creating room");
  }
});

app.post("/join-room",async (req, res) => {
  const { username,roomId } = req.body;
  try {
    const user = await Users.findOne({ username });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const room = await Room.findOne({ roomId });
    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    if (!room.users.includes(user._id)) {
      room.users.push(user._id);
      await room.save();

      if (!user.rooms.some((roomEntry) => roomEntry.roomId === roomId)) {
        user.rooms.push({ roomId });
        await user.save();
      }
    }

    res.status(200).json({
      message: "Successfully joined the room",
      folderFramework: room.creatorFramework,
      folderName: room.creatorFolder,
    });
  } catch (error) {
    console.error("Error joining room:", error);
    res.status(500).json({ message: "Error joining room" });
  }
});

app.get("/user-rooms/:username", async (req, res) => {
  const username = req.params.username;

  try {
    const userRooms = await Room.find({ users: username });
    res.status(200).json(userRooms);
  } catch (error) {
    console.error("Error fetching rooms:", error);
    res.status(500).send("Error fetching user rooms");
  }
});

app.get("/me", verifyToken, (req, res) => {
  res.status(200).json({ username: req.user.username });
});

app.get("/checklogin",verifyToken,(req,res)=>{
   try{
     const user = req.user;
     if(user){
       res.status(200).json({ check : true });
     }
     else{
      res.status(200).json({ check : false });
     }
   }catch(error){
      res.status(500).json({ message : "Server ERROR!!"})
   }
});

app.post("/exit-room", async (req, res) => {
  const { username, roomId } = req.body;
  try {
    const user = await Users.findOne({ username });
    if (!user) return res.status(404).json({ message: "User not found" });

    const room = await Room.findOne({ roomId });
    if (!room) return res.status(404).json({ message: "Room not found" });

    room.users = room.users.filter(id => id.toString() !== user._id.toString());
    await room.save();

    user.rooms = user.rooms.filter(r => r.roomId !== roomId);
    await user.save();

    res.status(200).json({ message: "Successfully exited the room" });
  } catch (err) {
    console.error("Error exiting room:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/logout",async(req,res)=>{
   try{
    res.clearCookie("userToken", {
      httpOnly: true,
      sameSite: "strict",
      secure: false,
      path: "/",
    });
    res.status(200).json({ message: "Logged out" });
   }catch(error){
    console.error("Error fetching rooms:", error);
    res.status(500).send("Error in logout");
   }
})

server.listen(PORT, () => {
  console.log(`Server running on http://localhost : ${PORT}`);
});