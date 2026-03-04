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

function formatClock(sec){

sec = Math.max(0,Math.floor(sec))

let m = Math.floor(sec/60)
let s = sec%60

return `${m}:${s.toString().padStart(2,"0")}`

}

function parseClock(clk){

clk = clk.replace(".","")

let parts = clk.split(":").map(Number)

if(parts.length===3)
return parts[0]*3600 + parts[1]*60 + parts[2]

return parts[0]*60 + parts[1]

}

function sleep(ms){
return new Promise(r=>setTimeout(r,ms))
}

document.getElementById("pgnUpload").addEventListener("change", e => {

const file = e.target.files[0]

const reader = new FileReader()

reader.onload = () => {

let pgn = reader.result

/* load moves using chess.js */

chess.loadPgn(pgn)

moves = chess.history()

/* extract timestamps */

timestamps = [...pgn.matchAll(/\[%timestamp ([0-9]+)\]/g)]
.map(x => parseInt(x[1]))

/* extract clocks */

clocks = [...pgn.matchAll(/\[%clk ([0-9:\.]+)\]/g)]
.map(x => parseClock(x[1]))

/* initialize board */

chess.reset()
board.setPosition(chess.fen())

whiteTime = clocks[0]
blackTime = clocks[1]

whiteClock.textContent = formatClock(whiteTime)
blackClock.textContent = formatClock(blackTime)

console.log("Moves loaded:",moves.length)

}

reader.readAsText(file)

})

async function runClock(color,seconds){

for(let i=0;i<seconds;i++){

await sleep(1000)

if(color==="w"){
whiteTime--
whiteClock.textContent = formatClock(whiteTime)
}else{
blackTime--
blackClock.textContent = formatClock(blackTime)
}

}

}

async function replay(){

for(let i=0;i<moves.length;i++){

let color = (i%2===0) ? "w" : "b"

let thinkTime = timestamps[i] || 0

await runClock(color,thinkTime)

chess.move(moves[i])

board.setPosition(chess.fen())

if(color==="w"){
whiteTime = clocks[i]
whiteClock.textContent = formatClock(whiteTime)
}else{
blackTime = clocks[i]
blackClock.textContent = formatClock(blackTime)
}

}

}

document.getElementById("startReplay").onclick = replay
