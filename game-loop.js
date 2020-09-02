const _ = require('lodash')
const words = require('./words.json')
const LOG = true

// intervals
let timerInterval = null

// vars
const defaultGameState = {
  event: '',
  timer: 0,
  word: '',
  round: 1,
  roundEnd: 5,
  turn: 1,
  turnEnd: 2,
  turnLength: 5,
  turnUser: {},
}

// game starts
// 5 rounds
// user 1 draws
// user 2 draws
// 4 rounds

const game = function (room, endGame) {

  function gameStart() {
    log('start')

    // init game state
    room.gameState = _.cloneDeep(defaultGameState)
    room.gameState.turnEnd = Object.keys(room.users).length

    loopRounds()
  }

  function gameEnd() {
    log('end')
    endGame()
  }

  // loop
  function loopRounds() {
    if (room.gameState.round <= room.gameState.roundEnd) {
      roundStart()
    } else {
      gameEnd()
    }
  }

  // round
  function roundStart() {
    log('round-start', `${room.gameState.round}/${room.gameState.roundEnd}`)
    room.gameState.event = 'round-start'

    // reset vars
    room.gameState.turn = 1

    // each user takes a turn after 3 second delay
    startTimer(3, loopTurns)

    // broadcast update
    broadcastGameUpdate()
  }

  function roundEnd() {
    log('round-end')
    room.gameState.event = 'round-end'
    room.gameState.round++

    // loop back
    loopRounds()

    // broadcast update
    broadcastGameUpdate()
  }

  // loop
  function loopTurns() {
    if (room.gameState.turn <= room.gameState.turnEnd) {
      turnStart()
    } else {
      roundEnd()
    }
  }

  // turn
  function turnStart() {
    log('start-turn')

    // update vars
    room.gameState.event = 'turn-start'
    room.gameState.word = getRandomWord()
    room.gameState.turnUser = getUserAtIndex(room.gameState.turn, room)

    // reset all mactches
    resetRoomMatches(room)

    // end turn after turn length
    startTimer(room.gameState.turnLength, turnEnd)

    // broadcast update
    broadcastGameUpdate()
  }

  function turnEnd() {
    log('end-turn')

    // update vars
    room.gameState.event = 'turn-end'

    // loop back
    startTimer(3, () => {
      room.gameState.turn++
      loopTurns()
    })

    // broadcast update
    broadcastGameUpdate()
  }

  // guessing
  function guess(data, cb) {
    let roundWordMatch =
      data.guess &&
      data.guess.toUpperCase() === room.gameState.word.toUpperCase()
    cb(roundWordMatch)
  }


  // broadcasts
  function broadcastGameUpdate() {
    for (const client of room.sockets) {
      client.emit('update_game', room.gameState)
      client.emit('update_room', formatRoom(room))
    }
  }

  function broadcastTimer() {
    for (const client of room.sockets) {
      client.emit('update_game_timer', room.gameState.timer)
    }
  }


  // helpers
  function startTimer(timerLength, cb) {
    // set timer length
    room.gameState.timer = timerLength

    // set timer interval
    timerInterval = setInterval(() => {
      updateTimer(cb)
    }, 1000)
  }

  function updateTimer(cb) {
    if (room.gameState.timer === -1) {
      clearTimer()
      cb()
    } else {
      broadcastTimer()
      room.gameState.timer--
    }
  }

  function clearTimer() {
    clearInterval(timerInterval)
    timerInterval = null
  }

  function resetRoomMatches() {
    Object.keys(room.users).forEach(key => {
      room.users[key].match = false
      room.users[key].guesses = []
    })
  }

  // start game
  gameStart()

  // expose functions
  return {
    guess,
  }
}

module.exports = game

// helpers
function getRandomWord() {
  return words[Math.floor(Math.random() * words.length)]
}

function formatRoom(room) {
  return _.cloneDeep({
    ...room,
    game: null,
    sockets: [],
  })
}

function getUserAtIndex(index, room) {
  let userid = Object.keys(room.users)[index - 1]
  return {
    userid,
    username: room.users[userid].username,
  }
}

function log(message) {
  if (LOG) {
    console.log(`game:${message}`)
  }
}