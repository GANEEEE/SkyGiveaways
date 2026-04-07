var http = require('http');

http.createServer(function (req, res) {
    res.write("I'm Alive");
    res.end('Hello World!');
}).listen(5000, '0.0.0.0');
