import { Terminal as XTerminal } from "@xterm/xterm";
import { useEffect, useRef, useState } from "react";
import "@xterm/xterm/css/xterm.css";
import { io } from "socket.io-client";

const socket = io("http://localhost:5000");

const Terminal = () => {
  const terminalRef = useRef();
  const isRendered = useRef(false);
  const [iframeSrc, setIframeSrc] = useState("");

  useEffect(() => {
    if (isRendered.current) return;
    isRendered.current = true;

    const term = new XTerminal({
      rows: 30,
      columns: 20,
    });
    term.open(terminalRef.current);

    term.onData((data) => {
      socket.emit("terminal:write", data);
    });

    socket.on("terminal:data", (data) => {
      console.log(data);
      term.write(data);

      // Extract the URL if it exists in the data
      const urlMatch = data.match(/https?:\/\/[^\s]+/);
      if (urlMatch) {
        const extractedUrl = urlMatch[0]; // Extract the first matching URL
        console.log("the extracted url is ", extractedUrl);
        setIframeSrc(extractedUrl);
      }
    });

    return () => {
      term.dispose();
      socket.off("terminal:data");
    };
  }, []);

  return (
    <>
      <div style={{ display: "flex" }}>
        <div
          ref={terminalRef}
          id="terminal"
          style={{
            flex: 3,
            width: "100%",
            height: "300px",
            border: "1px solid black",
          }}
        />
        <div style={{ flex: "1", }}>
          <p>WebView</p>
          {iframeSrc && (
            <iframe
              src={iframeSrc}
              title="dynamic content frame"
              style={{
                width: "100%",
                height: "500px",
                border: "none",
                marginTop: "20px",
              }}
            />
          )}
        </div>
      </div>
      <a href={iframeSrc} target="_blank">
        Open in new page
      </a>
    </>
  );
};

export default Terminal;
