const { Chessboard } = window.CmChessboard
const board = new Chessboard(document.getElementById("board"))

let chess = new Chess()

let moveData = []

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

parsePGN(pgn)

console.log("moves parsed:",moveData.length)

}

reader.readAsText(file)

})

function parsePGN(pgn){

moveData = []

let regex = /([a-hKQRNB0O\-+=#]+)[^{}]*\{\[%clk ([^\]]+)\]\[%timestamp ([^\]]+)\]\}/g

let match

while((match = regex.exec(pgn)) !== null){

moveData.push({
move: match[1],
clock: parseClock(match[2]),
think: parseInt(match[3])
})

}

if(moveData.length>0){

whiteTime = moveData[0].clock
blackTime = moveData[1]?.clock || moveData[0].clock

whiteClock.textContent = formatClock(whiteTime)
blackClock.textContent = formatClock(blackTime)

}

}

async function runClock(color,time){

for(let i=0;i<time;i++){

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

chess.reset()

for(let i=0;i<moveData.length;i++){

let data = moveData[i]

let color = (i%2===0) ? "w" : "b"

await runClock(color,data.think)

chess.move(data.move)

board.setPosition(chess.fen())

if(color==="w"){
whiteTime = data.clock
whiteClock.textContent = formatClock(whiteTime)
}else{
blackTime = data.clock
blackClock.textContent = formatClock(blackTime)
}

}

}

document.getElementById("startReplay").onclick = replay
