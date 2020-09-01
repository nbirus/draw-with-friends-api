const words = require('./words.json')

const game = function (room, endGame) {
  let timerInterval = null
  let timer = null
  let roundCount = room.settings.numberOfRounds
  let roundWord = ''
  let currentTurnIndex = 0

  function loop() {
    console.log('game:loop', `${roundCount}/${room.settings.numberOfRounds}`)

    // create new word
    roundWord = getRandomWord()

    // brodcast loop start
    brodcastEvent({
      event: 'loop_start',
      turn: getUser(currentTurnIndex),
      roundWord,
    })

    // wait 3 seconds before starting next round
    startTimer(3, startRound)
  }

  // actions
  function startRound() {
    console.log('client:round-start')
    brodcastEvent({
      event: 'round_start',
    })

    // start round timer
    startTimer(room.settings.roundTimerLength, endRound)
  }

  function endRound() {
    console.log('client:round-end')
    brodcastEvent({
      event: 'round_end',
    })

    // move round count down, next user turn
    roundCount--

    // update turn
    incrementTurnIndex()

    // check to see if game is over
    if (roundCount === -1) {
      endGame()
    } else {
      // allow 3 seconds of endtime
      startTimer(3, loop)
    }
  }

  function guess(data, cb) {
    let roundWordMatch =
      data.guess && data.guess.toUpperCase() === roundWord.toUpperCase()
    cb(roundWordMatch)
  }

  // helpers
  function startTimer(timerLength, cb) {
    // set timer length
    timer = timerLength

    // set timer interval
    timerInterval = setInterval(() => {
      updateTimer(cb)
    }, 1000)
  }

  function updateTimer(cb) {
    if (timer === -1) {
      clearTimer()
      cb()
    } else {
      brodcastTimer()
      timer--
    }
  }

  function clearTimer() {
    clearInterval(timerInterval)
    timerInterval = null
    timerCallback = null
  }

  function getUser(index) {
    let user = Object.values(room.users)[index]
    return user ? user : {}
  }

  function incrementTurnIndex() {
    if (currentTurnIndex === 3) {
      currentTurnIndex = 0
    } else {
      currentTurnIndex++
    }
  }

  function getRandomWord() {
    return words[Math.floor(Math.random() * words.length)]
  }

  // brodcasts
  function brodcastTimer() {
    for (const client of room.sockets) {
      client.emit('update_game_timer', timer)
    }
  }

  function brodcastEvent(event) {
    for (const client of room.sockets) {
      client.emit('update_game_event', event)
    }
  }

  // start game
  loop()

  // expose functions
  return {
    guess,
  }
}

module.exports = game
