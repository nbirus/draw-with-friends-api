const io = require('../socket.js').getio()
const global = require('./global')
const game = require('./game')
const colors = require('../colors').default
const gameLoop = require('../game-loop')
const _ = require('lodash')
const LOG = false
const DISABLE_READY = false

// vars
const defaultRoom = {
  game: gameLoop,
  name: '',
  roomid: '',
  userid: '',
  active: false,
  users: {},
  sockets: [],
  messages: [],
  gameState: {},
}
const defaultRoomUser = {
  guesses: [],
  connected: true,
  ready: false,
  match: false,
  color: '',
  score: 0,
}

// socket events
io.on('connection', (socket) => {
  socket.on('create_room', (room) => createRoom(room, socket))
  socket.on('remove_room', (roomid) => removeRoom(roomid))
  socket.on('join_room', (roomid) => joinRoom(roomid, socket))
  socket.on('leave_room', (roomid) => leaveRoom(roomid, socket))
  socket.on('room_message', (data) => roomMessage(data, socket))
  socket.on('ready', (flag) => setReady(flag, socket))
  socket.on('color', (color) => setColor(color, socket))

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
  game.endGame(global.rooms[roomid])
  global.removeRoom(roomid)
}

function joinRoom(roomid, socket) {
  log('join-room', roomid, socket.userid)

  // get connecting user/room
  let user = global.users[socket.userid]
  let room = global.rooms[roomid]

  if (room === undefined || user === undefined) {
    log('join-room-error', roomid, socket.userid)
    broadcastJoinError(socket)
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

  // add color to user
  room.users[user.userid].color = getColor(room.users)

  // join room
  socket.join(roomid, () => {
    socket.roomid = roomid

    // brodcast join
    roomMessage({
      event: 'join',
      userid: user.userid,
      user,
    }, socket)
  })

  broadcastRoomJoin(room, socket)
  broadcastRoomUpdate(room)
  global.broadcastRooms()

  if (room.active) {
    game.broadcastRoomUpdate(room)
  }
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

  // brodcast join
  roomMessage({
    event: 'leave',
    userid: user.userid,
    user,
  }, socket)

  // leave room
  socket.leave(roomid, () => {
    socket.roomid = ''
  })

  // remove roomid from user
  user.roomid = ''

  let roomUsersLength = Object.keys(room.users).length
  let isHost = room.userid === user.userid

  // if the game is inactive, remove the user completely
  if (!room.active) {
    delete room.users[user.userid]
  } else {
    room.users[user.userid].connected = false
  }

  // if there is only one user in the room, delete the room
  if (roomUsersLength === 1 || Object.values(room.users).every(u => !u.connected)) {
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


  }

  broadcastRoomUpdate(room)
  global.broadcastRooms()
}

function setReady(flag, socket) {
  log('user-ready', socket.roomid, socket.userid)

  let room = global.rooms[socket.roomid]

  if (room === undefined) {
    log('user-ready-error', socket.roomid, socket.userid)
    return
  }

  let userValues = Object.values(room.users)

  // set to flag on user
  room.users[socket.userid].ready = flag

  if (flag) {
    roomMessage({
      user: global.users[socket.userid],
      event: 'ready',
      userid: socket.userid,
    }, socket)
  } else {
    cancelCountDown(socket)
    roomMessage({
      user: global.users[socket.userid],
      event: 'not-ready',
      userid: socket.userid,
    }, socket)
  }

  // if all 4 players are ready, start game
  if (
    (userValues.length > 1 && userValues.every((r) => r.ready)) ||
    DISABLE_READY
  ) {
    room.active = true
    startCountDown(game, room, socket)
  }

  broadcastRoomUpdate(room)
  global.broadcastRooms()
}

function setColor(color, socket) {
  log('color', socket.roomid, socket.userid)

  let room = global.rooms[socket.roomid]

  if (room === undefined) {
    log('user-color-error', socket.roomid, socket.userid)
    return
  }
  // set color
  room.users[socket.userid].color = color

  broadcastRoomUpdate(room)
  global.broadcastRooms()
}

function roomMessage(data, socket) {
  let room = global.rooms[socket.roomid]
  if (data.event === 'not-ready') {
    room.messages.forEach((message, i) => {
      if (data.userid === message.userid && message.event === 'ready') {
        room.messages.splice(i, 1)
      }
    })
  } else if (data.message || data.event) {
    room.messages.push({
      user: global.users[data.userid],
      message: data.message,
      event: data.event,
      userid: data.userid,
    })
  }
  broadcastRoomUpdate(room)
}

let countDownInterval = null

function startCountDown(game, room, socket) {
  let count = 3
  countDown()
  countDownInterval = setInterval(countDown, 1250);

  function countDown() {
    roomMessage({
      event: 'countdown',
      message: count,
      userid: socket.userid,
    }, socket)

    if (count === 0) {
      clearInterval(countDownInterval)
      countDownInterval = null
      game.startGame(room)
    }

    count--
  }
}


function cancelCountDown(socket) {
  if (countDownInterval) {
    clearInterval(countDownInterval)
    countDownInterval = null
    roomMessage({
      event: 'countdown-cancel',
      userid: socket.userid,
    }, socket)
  }
}


// broadcasts
function broadcastRoomJoin(room, socket) {
  log('broadcast-room-join', room.roomid, socket.userid)
  socket.emit('join_room', formatRoom(room))
}

function broadcastJoinError(socket) {
  socket.emit('join_room_error')
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

function getColor(users) {
  let activeIndexes = []
  for (let userid in users) {
    let color = users[userid].color
    let colorIndex = colors.findIndex(c => c === color)
    if (colorIndex !== -1) {
      activeIndexes.push(colorIndex)
    }
  }

  function generateRandom(min, max) {
    var num = Math.floor(Math.random() * (max - min + 1)) + min;
    return activeIndexes.includes(num) ? generateRandom(min, max) : num;
  }

  return colors[generateRandom(0, 5)]
}


// exports
module.exports = {
  broadcastRoomUpdate,
}