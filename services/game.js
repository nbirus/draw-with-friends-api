const io = require('../socket.js').getio()
const _ = require('lodash')
const global = require('./global')
const LOG = true

// socket events
io.on('connection', (socket) => {
  socket.on('mousemove', mouseMove)
  socket.on('guess', guess)
})

// actions
function startGame(room) {
  log('start', room.roomid)
  room.game = room.game(room, () => endGame(room))
  brodcastStartGame(room)
}
function endGame(room) {
  log('end', room.roomid)
}

// event handlers
function mouseMove(data) {
  let room = global.rooms[data.roomid]
  if (room !== undefined) {
    for (const client of room.sockets) {
      client.emit('moving', data)
    }
  }
}
function guess(data) {
  log('guess', data.roomid, data.userid)
  let room = global.rooms[data.roomid]
  if (room !== undefined) {
    // set guesses on room object
    room.guesses.push({
      userid: data.userid,
      username: data.username,
      guess: data.guess,
    })
    // send guess to game obj
    room.game.guess(data, (doesMatch) => {
      room.users[socket.userid].match = doesMatch
      if (doesMatch) {
        room.users[socket.userid].score++
      }
    })
    brodcastRoomUpdate(room)
  }
}

// brodcasts
function brodcastStartGame(room) {
  for (const client of room.sockets) {
    client.emit('room_ready')
  }
}

// helpers
function log(message, roomid, userid) {
  if (LOG) {
    if (userid) {
      console.log(`game:${message}`, roomid, userid)
    } else {
      console.log(`game:${message}`, roomid)
    }
  }
}

module.exports = {
  startGame,
}
