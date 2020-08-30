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
	messages: [],
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

		// get disconnecting user
		let user = users[socket.userid]

		// disconnect from room
		if (user.roomid) {
			leaveRoom(user.roomid)
		}

		// remove user
		delete users[user.userid]
		brodcastUsers()
	}

	// user events
	function setUser(user) {
		socket.id = user.userid
		socket.userid = user.userid
		users[user.userid] = {
			..._.cloneDeep(defaultUser),
			...user,
		}
		brodcastUsers()
	}

	// room events
	function createRoom(room) {
		console.log('client:create-room', room.roomid);
		rooms[room.roomid] = {
			..._.cloneDeep(defaultRoom),
			...room,
		}
	}

	function removeRoom(roomid) {
		console.log('client:remove-room', roomid);
		delete rooms[roomid]
		brodcastRooms()
	}

	function joinRoom(roomid) {
		console.log('client:join-room', roomid, socket.userid);

		// get connecting user/room
		let user = users[socket.userid]
		let room = rooms[roomid]

		if (room === undefined || user === undefined) {
			console.log('client:join-room-error', roomid);
			brodcastJoinError()
			return
		}

		// add socket
		room.sockets.push(socket)

		// add room to user
		user.roomid = roomid

		// add user
		room.users[user.userid] = user

		// join room
		socket.join(roomid, () => {
			socket.roomid = roomid
		})

		brodcastRooms()
		brodcastRoomJoin(room)
		brodcastRoomUpdate(room)
	}

	function leaveRoom(roomid) {
		console.log('client:leave-room', roomid, socket.userid);

		// get connecting user/room
		let user = users[socket.userid]
		let room = rooms[roomid]

		if (room === undefined || user === undefined) {
			console.log('client:leave-room-error', roomid, user);
			return
		}

		// leave room
		socket.leave(roomid, () => {
			socket.roomid = ''
		})

		// remove roomid from user
		user.roomid = ''

		// remove room if last user
		if (Object.keys(room.users).length > 1) {

			// remove socket
			const index = room.sockets.findIndex(s => s.id === socket.id);
			if (index > -1) {
				room.sockets.splice(index, 1);
			}

			delete room.users[user.userid]

			// replace host if nessesary
			if (room.userid === user.userid) {
				room.userid = room.users[Object.keys(room.users)[0]].userid
			}

			brodcastRooms()
			brodcastRoomUpdate(room)
		}
		// delete user 
		else {
			removeRoom(roomid)
		}
	}

	// chat
	function globalChat(message) {
		messages.push(message)
		brodcastGlobalMessages()
	}

	function roomChat(params) {
		let room = rooms[params.roomid]
		if (room !== undefined) {
			room.messages.push({
				userid: params.userid,
				username: params.username,
				message: params.message,
			})
			brodcastRoomUpdate(room)
		}
	}

	// brodcasts
	function brodcastUsers() {
		socket.emit('update_users', users)
		socket.broadcast.emit('update_users', users)
	}

	function brodcastRooms() {
		console.log('brodcast:rooms');
		socket.emit('update_rooms', formatRooms())
		socket.broadcast.emit('update_rooms', formatRooms())
	}

	function brodcastRoomJoin(room) {
		socket.emit('join_room', formatRoom(room))
	}

	function brodcastRoomUpdate(room) {
		console.log('brodcast:room-update');
		for (const client of room.sockets) {
			client.emit('update_room', formatRoom(room))
		}
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
	socket.on('create_room', createRoom)
	socket.on('join_room', joinRoom)
	socket.on('leave_room', leaveRoom)
	socket.on('remove_room', removeRoom)
	socket.on('disconnecting', disconnecting)

	// chat events
	socket.on('global_message', globalChat)
	socket.on('room_message', roomChat)
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
	return _.cloneDeep({
		...room,
		sockets: []
	})
}