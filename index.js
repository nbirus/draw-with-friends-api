const e = require('express')

var app = require('express')()
var http = require('http').Server(app)
var io = require('socket.io')(http)
var port = process.env.PORT || 3000

let lobby = []

app.get('/', function (req, res) {
  res.sendFile(__dirname + '/index.html')
})

http.listen(port, function () {
  console.log('listening on *:' + port)
})

// Delete this row if you want to see debug messages
io.set('log level', 1)

// Listen for incoming connections from clients
io.sockets.on('connection', function (socket) {
  // Start listening for players joining
  socket.on('join', function (data) {
    let playerIndex = lobby.findIndex((player) => player.id === data.id)
    if (playerIndex === -1) {
      lobby.push(data)
    } else {
      lobby[playerIndex].username = data.username
    }

    socket.emit('lobby', lobby)
  })

  // Start listening for mouse move events
  socket.on('mousemove', function (data) {
    console.log(data)
    // This line sends the event (broadcasts it)
    // to everyone except the originating client.
    socket.broadcast.emit('moving', data)
  })
})
