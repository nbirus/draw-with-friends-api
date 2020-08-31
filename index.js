const app = require('express')()
const http = require('http').Server(app)
const io = require('socket.io')(http)
const _ = require('lodash')
const game = require('./game')
const PORT = process.env.PORT || 3000
const DISABLE_READY = true

const rooms = {}
const users = {}
const defaultRoom = {
	game: game,
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
		roundTimerLength: 30,
	},
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
		room.users[user.userid] = {
			...user,
			ready: false,
			match: false,
			score: 0,
		}

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

	function setReady(flag) {
		let room = rooms[socket.roomid]
		let userValues = Object.values(room.users)

		// set to flag on user
		room.users[socket.userid].ready = flag

		// if all 4 players are ready, start game
		if (userValues.length === 4 && userValues.every(r => r.ready) || DISABLE_READY) {
			startGame(room)
		}

		brodcastRooms()
		brodcastRoomUpdate(room)
	}

	// chat
	function globalChat(message) {
		messages.push(message)
		brodcastGlobalMessages()
	}

	function roomChat(data) {
		let room = rooms[data.roomid]
		if (room !== undefined) {
			room.messages.push({
				userid: data.userid,
				username: data.username,
				message: data.message,
			})
			brodcastRoomUpdate(room)
		}
	}

	// game
	function startGame(room) {
		room.game = new room.game(room, endGame)
		room.active = true
		brodcastStartGame(room)
	}

	function endGame() {
		console.log('END GAME');
	}

	function mouseMove(data) {
		let room = rooms[data.roomid]
		if (room !== undefined) {
			for (const client of room.sockets) {
				client.emit('moving', data)
			}
		}
	}

	function guess(data) {
		let room = rooms[data.roomid]
		if (room !== undefined) {

			// set guesses on room object
			room.guesses.push({
				userid: data.userid,
				username: data.username,
				guess: data.guess,
			})

			// send guess to game obj
			room.game.guess(data, doesMatch => {
				room.users[socket.userid].match = doesMatch
				if (doesMatch) {
					room.users[socket.userid].score++
				}
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

	function brodcastStartGame(room) {
		for (const client of room.sockets) {
			client.emit('start_game')
		}
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

	// game events
	socket.on('ready', setReady)
	socket.on('mousemove', mouseMove)
	socket.on('guess', guess)
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
		game: null,
		sockets: []
	})
}