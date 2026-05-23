const http = require("http");
const fs = require("fs");
const path = require("path");

http.createServer((req, res) => {
  const raw = req.url === "/" ? "index.html" : req.url.slice(1);
  const file = raw.split("?")[0];
  const filePath = path.join(__dirname, "files", file);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end("Not found");
    } else {
      res.writeHead(200);
    }
    res.end(data);
  });
}).listen(3011);