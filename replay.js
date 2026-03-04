const { Chessboard } = window.CmChessboard

const board = new Chessboard(document.getElementById("board"))

let chess = new Chess()
let moves = []
let timestamps = []
let clocks = []

let whiteTime = 0
let blackTime = 0

const whiteClock = document.getElementById("whiteClock")
const blackClock = document.getElementById("blackClock")

function parseClock(clk){

let parts = clk.split(":").map(Number)

if(parts.length === 3)
return parts[0]*3600 + parts[1]*60 + parts[2]

return parts[0]*60 + parts[1]

}

function formatClock(seconds){

seconds = Math.max(0, seconds)

let m = Math.floor(seconds/60)
let s = seconds%60

return `${m}:${s.toString().padStart(2,"0")}`

}

document.getElementById("pgnUpload").addEventListener("change", e => {

const file = e.target.files[0]

const reader = new FileReader()

reader.onload = () => {

let pgn = reader.result

chess.loadPgn(pgn)

moves = chess.history({ verbose:true })

timestamps = [...pgn.matchAll(/\[%timestamp\s+([0-9]+)\]/g)]
.map(m => parseInt(m[1]))

clocks = [...pgn.matchAll(/\[%clk\s+([0-9:\.]+)\]/g)]
.map(m => parseClock(m[1]))

whiteTime = clocks[0]
blackTime = clocks[1]

whiteClock.textContent = formatClock(whiteTime)
blackClock.textContent = formatClock(blackTime)

console.log("Moves:",moves.length)

}

reader.readAsText(file)

})

function sleep(ms){
return new Promise(resolve => setTimeout(resolve, ms))
}

async function runClock(color,seconds){

for(let i=0;i<seconds;i++){

await sleep(1000)

if(color==="w"){
whiteTime--
whiteClock.textContent = formatClock(whiteTime)
}
else{
blackTime--
blackClock.textContent = formatClock(blackTime)
}

}

}

async function replay(){

const game = new Chess()

let moveIndex = 0

for(const move of moves){

let thinkTime = timestamps[moveIndex] || 0

await runClock(move.color, thinkTime)

game.move(move)

board.setPosition(game.fen())

if(move.color==="w"){
whiteTime = clocks[moveIndex]
whiteClock.textContent = formatClock(whiteTime)
}
else{
blackTime = clocks[moveIndex]
blackClock.textContent = formatClock(blackTime)
}

moveIndex++

}

}

document.getElementById("startReplay").onclick = replay
