const io = require('../socket.js').getio()
const global = require('./global')
const game = require('./game')
const gameLoop = require('../game-loop')
const _ = require('lodash')
const LOG = true
const DISABLE_READY = true

// vars
const defaultRoom = {
  game: gameLoop,
  name: '',
  roomid: '',
  userid: '',
  colors: [],
  active: false,
  users: {},
  sockets: [],
  messages: [],
  guesses: [],
  settings: {
    numberOfRounds: 5,
    roundTimerLength: 10,
  },
}
const defaultRoomUser = {
  connected: true,
  ready: false,
  match: false,
  score: 0,
}

// socket events
io.on('connection', (socket) => {
  socket.on('create_room', (room) => createRoom(room, socket))
  socket.on('remove_room', (roomid) => removeRoom(roomid))
  socket.on('join_room', (roomid) => joinRoom(roomid, socket))
  socket.on('leave_room', (roomid) => leaveRoom(roomid, socket))
  socket.on('ready', (flag) => setReady(flag, socket))

  // remove from room if disconnected
  socket.on('disconnecting', () => {
    if (socket.roomid) {
      leaveRoom(socket.roomid, socket)
    }
  })
})

// event handlers
function createRoom(room, socket) {
  log('create-room', room.roomid, socket.userid)
  global.addRoom({
    ..._.cloneDeep(defaultRoom),
    ...room,
  })
}
function removeRoom(roomid) {
  log('remove-room', roomid)
  global.removeRoom(roomid)
}
function joinRoom(roomid, socket) {
  log('join-room', roomid, socket.userid)

  // get connecting user/room
  let user = global.users[socket.userid]
  let room = global.rooms[roomid]

  if (room === undefined || user === undefined) {
    log('join-room-error', roomid, socket.userid)
    brodcastJoinError(socket)
    return
  }

  // add roomid to user
  user.roomid = roomid

  // add socket
  room.sockets.push(socket)

  // if user already exists, set to connected
  if (Object.keys(room.users).includes(user.userid)) {
    room.users[user.userid].connected = true
  } else {
    room.users[user.userid] = {
      ..._.cloneDeep(defaultRoomUser),
      ...user,
    }
  }

  // join room
  socket.join(roomid, () => {
    socket.roomid = roomid
  })

  brodcastRoomJoin(room, socket)
  brodcastRoomUpdate(room)
  global.brodcastRooms()
}
function leaveRoom(roomid, socket) {
  log('leave-room', roomid, socket.userid)

  // get connecting user/room
  let user = global.users[socket.userid]
  let room = global.rooms[roomid]

  if (room === undefined || user === undefined) {
    log('leave-room-error', roomid, socket.userid)
    return
  }

  // leave room
  socket.leave(roomid, () => {
    socket.roomid = ''
  })

  // remove roomid from user
  user.roomid = ''

  let roomUsersLength = Object.keys(room.users).length
  let isHost = room.userid === user.userid

  // if there is only one user in the room, delete the room
  if (roomUsersLength === 1) {
    removeRoom(roomid)
  } else {
    // remove socket
    const index = room.sockets.findIndex((s) => s.id === socket.id)
    if (index > -1) {
      room.sockets.splice(index, 1)
    }

    // if host, replace with another user
    if (isHost) {
      room.userid = room.users[Object.keys(room.users)[0]].userid
    }

    // if the game is inactive, remove the user completely
    if (!room.active) {
      delete room.users[user.userid]
    } else {
      room.users[user.userid].connected = false
    }
  }

  brodcastRoomUpdate(room)
  global.brodcastRooms()
}
function setReady(flag, socket) {
  log('user-ready', socket.roomid, socket.userid)
  let room = global.rooms[socket.roomid]
  let userValues = Object.values(room.users)

  // set to flag on user
  room.users[socket.userid].ready = flag

  // if all 4 players are ready, start game
  if (
    (userValues.length === 4 && userValues.every((r) => r.ready)) ||
    DISABLE_READY
  ) {
    room.active = true
    game.startGame(room)
  }

  brodcastRoomUpdate(room)
  global.brodcastRooms()
}

// brodcasts
function brodcastRoomJoin(room, socket) {
  log('brodcast-room-join', room.roomid, socket.userid)
  socket.emit('join_room', formatRoom(room))
}
function brodcastJoinError(socket) {
  socket.emit('join_room_error')
}
function brodcastRoomUpdate(room) {
  log('brodcast-room-update', room.roomid)
  for (const client of room.sockets) {
    client.emit('update_room', formatRoom(room))
  }
}

// helpers
function log(message, roomid, userid) {
  if (LOG) {
    if (userid) {
      console.log(`room:${message}`, roomid, userid)
    } else {
      console.log(`room:${message}`, roomid)
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

// exports
module.exports = {}
