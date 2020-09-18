const _ = require('lodash')
const words = require('./words.json')
const LOG = true

// intervals
let timerInterval = null

// vars
const defaultGameState = {
  started: false,
  event: '',
  timer: 0,
  word: '',
  round: 1,
  roundEnd: 5,
  turn: 1,
  turnEnd: 2,
  turnLength: 32,
  turnUser: {},
}


const game = function (room, endGame) {

  function gameStop() {
    clearTimer()
    room.gameState = _.cloneDeep(defaultGameState)
    broadcastGameUpdate()
  }

  function gameStart() {
    log('start')

    // init game state
    room.gameState = _.cloneDeep(defaultGameState)
    room.gameState.turnEnd = Object.keys(room.users).length
    room.gameState.started = true

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

    // round end each user takes a turn after 10 second delay
    startTimer(12, loopTurns)

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
      preTurnStart()
    } else {
      roundEnd()
    }
  }

  // turn
  function preTurnStart() {
    log('pre-turn')

    // update vars
    room.gameState.event = 'turn-pre'
    room.gameState.word = getRandomWord()
    room.gameState.turnUser = getUserAtIndex(room.gameState.turn, room)

    // reset all mactches
    resetRoomMatches(room)

    // end turn after turn length
    startTimer(7, turnStart)

    // broadcast update
    broadcastGameUpdate()

  }

  function turnStart() {
    log('start-turn')

    // set event
    room.gameState.event = 'turn-start'

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
      clearBoard()
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

  function clearBoard() {
    for (const client of room.sockets) {
      client.emit('clear_board')
    }
  }

  // helpers
  function startTimer(timerLength, cb) {
    // set timer length
    room.gameState.timer = timerLength - 2

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
    if (timerInterval !== null) {
      clearInterval(timerInterval)
      timerInterval = null
    }
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
    gameStop,
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