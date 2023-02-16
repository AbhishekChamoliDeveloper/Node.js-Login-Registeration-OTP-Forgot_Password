const app = require("./app");
const http = require("http");

const port = process.env.PORT || 3000;

// Create HTTP server
const server = http.createServer(app);

// Start the server
server.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
