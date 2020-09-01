const LOG = false
const io = require('../socket.js').getio()
const _ = require('lodash')
const global = require('./global')

// vars
const defaultUser = {
  userid: '',
  username: '',
  roomid: '',
}

// socket events
io.on('connection', (socket) => {
  socket.on('set_user', (user) => setUser(user, socket))
  socket.on('disconnecting', () => {
    // wait for rooms to be disconnected
    setTimeout(() => {
      removeUser(socket.userid)
    }, 100)
  })
})

// actions
function setUser(user, socket) {
  log('set-user')
  socket.id = user.userid
  socket.userid = user.userid

  global.addUser({
    ..._.cloneDeep(defaultUser),
    ...user,
  })
}
function removeUser(userid) {
  log('remove-user')
  global.removeUser(userid)
}

// helpers
function log(message) {
  if (LOG) {
    console.log(`user:${message}`)
  }
}
