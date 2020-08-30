const app = require('express')()
const http = require('http').Server(app)
const io = require('socket.io')(http)
const _ = require('lodash')
const PORT = process.env.PORT || 3000
const NUM_ROUNDS = 10

const rooms = {}
const users = {}
const defaultRoom = {
	name: '',
	roomid: '',
	userid: '',
	colors: [],
	numberOfRounds: 10,
	users: {},
	sockets: [],
}
const defaultUser = {
	userid: '',
	username: '',
	roomid: ''
}
const messages = []

io.on('connection', (socket) => {
	console.log('client:connected');

	init()

	// events
	function disconnecting() {
		console.log('client:disconnecting');
		removeUser(socket.userid)
	}

	function setUser(user) {
		socket.id = user.userid
		socket.userid = user.userid
		users[user.userid] = {
			..._.cloneDeep(defaultUser),
			...user,
		}
		brodcastUsers()
	}

	function removeUser(userid) {
		// remove from user object
		delete users[userid]

		// remove from rooms
		Object.keys(rooms).forEach(roomid => {

			let room = rooms[roomid]

			// delete user
			delete room.users[userid]

			// delete room if no users left
			if (Object.keys(rooms[roomid].users).length === 0) {
				delete rooms[roomid]
			}
			// set new host if not
			else if (room.userid === userid) {
				room.userid = Object.keys(rooms[roomid].users)[0]
			}
		})

		brodcastUsers()
		brodcastRooms()
	}

	function createRoom(room) {
		rooms[room.roomid] = {
			..._.cloneDeep(defaultRoom),
			...room,
		}
		joinRoom(room.userid)
	}

	function joinRoom(roomid) {
		let room = rooms[roomid]

		if (room === undefined) {
			console.log('error:no-room', roomid);
			brodcastJoinError()
			return
		}


		let user = users[socket.userid]
		users[socket.userid].roomid = roomid
		room.sockets.push(socket)
		room.users[user.userid] = user

		socket.join(roomid, () => {
			socket.roomid = roomid
		})

		brodcastRoom(room)
		brodcastRooms()
	}

	function removeRoom(roomid) {
		delete users[roomid]
		brodcastRooms()
	}

	function globalChat(message) {
		messages.push(message)
		brodcastGlobalMessages()
	}

	// brodcasts
	function brodcastUsers() {
		socket.emit('update_users', users)
		socket.broadcast.emit('update_users', users)
	}

	function brodcastRooms() {
		socket.emit('update_rooms', formatRooms())
		socket.broadcast.emit('update_rooms', formatRooms())
	}

	function brodcastRoom(room) {
		socket.emit('join_room', formatRoom(room))
	}

	function brodcastJoinError() {
		socket.emit('join_room_error')
	}

	function brodcastGlobalMessages() {
		socket.emit('global_messages', messages)
		socket.broadcast.emit('global_messages', messages)
	}

	// other
	function init() {
		socket.emit('update_rooms', formatRooms())
		socket.emit('update_users', users)
		socket.emit('global_messages', messages)
	}

	// register events
	socket.on('set_user', setUser)
	socket.on('remove_user', removeUser)
	socket.on('create_room', createRoom)
	socket.on('join_room', joinRoom)
	socket.on('remove_room', removeRoom)
	socket.on('disconnecting', disconnecting)

	// chat events
	socket.on('global_message', globalChat)
})


// start server
http.listen(PORT, function () {
	console.log(`listening on *:${PORT}`)
})

// helpers
function formatRooms() {
	let returnRooms = {}
	let roomids = Object.keys(_.cloneDeep(rooms))

	roomids.forEach(roomid => {
		returnRooms[roomid] = formatRoom(_.cloneDeep(rooms[roomid]))
	})

	return returnRooms
}

function formatRoom(room) {
	delete room['sockets']
	return room
}