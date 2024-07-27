const net = require("net");
const fs = require("fs");

const serverhost = "localhost";
const serverport = 3000;

const calltypestreamall = 1;
const calltyperesend = 2;

const packets = [];
let receivedSequences = new Set();

// Function to convert a buffer to an integer (big-endian)
const bufferToInt = (buffer) => buffer.readInt32BE(0);

// Function to parse a packet from the server response
const parsePacket = (data) => {
  const symbol = data.slice(0, 4).toString("ascii");
  const buySellIndicator = data.slice(4, 5).toString("ascii");
  const quantity = bufferToInt(data.slice(5, 9));
  const price = bufferToInt(data.slice(9, 13));
  const sequence = bufferToInt(data.slice(13, 17));

  return { symbol, buySellIndicator, quantity, price, sequence };
};

// Function to send a request to the server
const sendRequest = (client, callType, resendSeq = 0) => {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt8(callType, 0);
  buffer.writeUInt8(resendSeq, 1);
  client.write(buffer);
};

// Function to handle received data from the server
const handleData = (data) => {
  const packet = parsePacket(data);
  packets.push(packet);
  console.log(packet);
  receivedSequences.add(packet.sequence);
};

// Function to check for missing sequences and request them
const requestMissingSequences = (client, maxSequence) => {
  for (let i = 1; i <= maxSequence; i++) {
    if (!receivedSequences.has(i)) {
      sendRequest(client, calltyperesend, i);
    }
  }
};

// Create a TCP client and connect to the server
const client = new net.Socket();
client.connect(serverport, serverhost, () => {
  console.log("Connected to server");
  sendRequest(client, calltypestreamall);
});

// Handle data received from the server
client.on("data", (data) => {
  handleData(data);

  // If the server closed the connection, check for missing sequences
  if (data.length < 17) {
    const maxSequence = Math.max(...Array.from(receivedSequences));
    requestMissingSequences(client, maxSequence);
  }
});

// Handle the end of the connection
client.on("end", () => {
  console.log("Disconnected from server");
  fs.writeFileSync("output.json", JSON.stringify(packets, null, 2));
  console.log("Output saved to output.json");
});

// Handle errors
client.on("error", (err) => {
  console.error(`Error: ${err.message}`);
});
