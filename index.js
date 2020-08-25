var app = require('express')()
var http = require('http').Server(app)
var io = require('socket.io')(http)
var port = process.env.PORT || 3000

app.get('/', function (req, res) {
  res.sendFile(__dirname + '/index.html')
})

http.listen(port, function () {
  console.log('listening on *:' + port)
})

// If the URL of the socket server is opened in a browser
function handler(request, response) {
  fileServer.serve(request, response)
  // request.addListener('end', function () {
  //   fileServer.serve(request, response) // this will return the correct file
  // })
}

// Delete this row if you want to see debug messages
io.set('log level', 1)

// Listen for incoming connections from clients
io.sockets.on('connection', function (socket) {
  // Start listening for mouse move events
  socket.on('mousemove', function (data) {
    // This line sends the event (broadcasts it)
    // to everyone except the originating client.
    socket.broadcast.emit('moving', data)
  })
})
