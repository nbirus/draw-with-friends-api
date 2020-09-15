const io = require('../socket.js').getio()
const _ = require('lodash')
const LOG = false

// vars
const messages = []
const users = {}
const rooms = {}

// socket events
io.on('connection', function (socket) {
  // init
  broadcastUsers()
  broadcastRooms()
  broadcastGlobalMessages()

  // events
  socket.on('global_message', addMessage)
})

// actions
function addUser(user) {
  log('add-user')
  users[user.userid] = user
  broadcastUsers()
}

function removeUser(userid) {
  delete users[userid]
  broadcastUsers()
}

function addRoom(room) {
  log('add-room')
  rooms[room.roomid] = room
  broadcastRooms()
}

function removeRoom(roomid) {
  delete rooms[roomid]
  broadcastRooms()
}

function addMessage(data) {
  messages.push({
    user: users[data.userid],
    message: data.message,
  })
  broadcastGlobalMessages()
}

// broadcasts
function broadcastUsers() {
  log('broadcast-users')
  io.emit('update_users', users)
}

function broadcastRooms() {
  log('broadcast-rooms')
  io.emit('update_rooms', formatRooms(rooms))
}

function broadcastGlobalMessages() {
  log('broadcast-messages')
  io.emit('global_messages', messages)
}

// helpers
function log(message) {
  if (LOG) {
    console.log(`global:${message}`)
  }
}

function formatRooms() {
  let returnRooms = {}
  let roomids = Object.keys(_.cloneDeep(rooms))

  roomids.forEach((roomid) => {
    returnRooms[roomid] = formatRoom(_.cloneDeep(rooms[roomid]))
  })

  return returnRooms
}

function formatRoom(room) {
  return _.cloneDeep({
    ...room,
    game: null,
    sockets: [],
  })
}

// exports
module.exports = {
  addUser,
  removeUser,
  addRoom,
  removeRoom,
  addMessage,
  broadcastRooms,
  rooms,
  users,
}