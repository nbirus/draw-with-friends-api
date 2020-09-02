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

  // wait for users to redirect to game page
  setTimeout(() => {
    room.game = room.game(room, () => endGame(room))
  }, 1000)
  broadcastStartGame(room)
}

function endGame(room) {
  log('end', room.roomid)
  brodcastEndGame(room)
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
  let user = room.users[data.userid]
  if (room !== undefined) {
    user.guesses.push({
      guess: data.guess,
    })

    // send guess to game obj
    room.game.guess(data, (doesMatch) => {
      user.match = doesMatch
      if (doesMatch) {
        user.score++
      }
    })
    broadcastRoomUpdate(room)
  }
}

// broadcasts
function broadcastStartGame(room) {
  for (const client of room.sockets) {
    client.emit('game_start')
  }
}

function brodcastEndGame(room) {
  for (const client of room.sockets) {
    client.emit('game_over')
  }
}

function broadcastRoomUpdate(room) {
  log('broadcast-room-update', room.roomid)
  for (const client of room.sockets) {
    client.emit('update_room', formatRoom(room))
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

function formatRoom(room) {
  return _.cloneDeep({
    ...room,
    game: null,
    sockets: [],
  })
}

module.exports = {
  startGame,
}