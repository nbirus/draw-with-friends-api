const app = require('express')()
const http = require('http').Server(app)
const PORT = process.env.PORT || 3000
const io = require('./socket.js').init(http)

require('./services/global.js')
require('./services/user.js')
require('./services/room.js')
// const game = require('./services/game.js')

// listen for connection
io.on('connection', function () {
  console.log('socket:new-connection')
})

// start server
http.listen(PORT, function () {
  console.log(`listening on *:${PORT}`)
})
