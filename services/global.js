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
  brodcastUsers()
  brodcastRooms()
  brodcastGlobalMessages()

  // events
  socket.on('global_message', addMessage)
})

// actions
function addUser(user) {
  log('add-user')
  users[user.userid] = user
  brodcastUsers()
}
function removeUser(userid) {
  delete users[userid]
  brodcastUsers()
}
function addRoom(room) {
  log('add-room')
  rooms[room.roomid] = room
  brodcastRooms()
}
function removeRoom(roomid) {
  delete rooms[roomid]
  brodcastRooms()
}
function addMessage(message) {
  messages.push(message)
  brodcastGlobalMessages()
}

// brodcasts
function brodcastUsers() {
  log('brodcast-users')
  io.emit('update_users', users)
}
function brodcastRooms() {
  log('brodcast-rooms')
  io.emit('update_rooms', formatRooms(rooms))
}
function brodcastGlobalMessages() {
  log('brodcast-messages')
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
  brodcastRooms,
  rooms,
  users,
}
