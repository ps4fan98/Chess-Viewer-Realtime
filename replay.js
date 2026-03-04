const board = new Chessboard("board")

let chess = new Chess()
let moves = []
let clocks = []

let whiteClock = document.getElementById("whiteClock")
let blackClock = document.getElementById("blackClock")

function parseClock(clk){

let parts = clk.split(":").map(Number)

if(parts.length === 3)
return parts[0]*3600 + parts[1]*60 + parts[2]

return parts[0]*60 + parts[1]

}

function formatClock(seconds){

let m = Math.floor(seconds/60)
let s = seconds%60

return `${m}:${s.toString().padStart(2,"0")}`

}

document.getElementById("pgnUpload").addEventListener("change",function(e){

let reader = new FileReader()

reader.onload = function(){

let pgn = reader.result

chess.loadPgn(pgn)

moves = chess.history({verbose:true})

let clkMatches = [...pgn.matchAll(/\[%clk\s+([^\]]+)\]/g)]

clocks = clkMatches.map(m=>parseClock(m[1]))

}

reader.readAsText(e.target.files[0])

})

async function replay(){

let game = new Chess()

let moveIndex = 0
let clockIndex = 0

let wTime = clocks[0]
let bTime = clocks[1]

whiteClock.textContent = formatClock(wTime)
blackClock.textContent = formatClock(bTime)

for(const move of moves){

let prevClock = clocks[clockIndex]
clockIndex++

let nextClock = clocks[clockIndex]

let thinkTime = Math.abs(prevClock - nextClock)

let activeColor = move.color

await runClock(activeColor, thinkTime)

game.move(move)
board.setPosition(game.fen())

if(activeColor === "w")
wTime = nextClock
else
bTime = nextClock

whiteClock.textContent = formatClock(wTime)
blackClock.textContent = formatClock(bTime)

}

}

function runClock(color,seconds){

return new Promise(resolve=>{

let remaining = seconds

let interval = setInterval(()=>{

remaining--

if(color==="w"){
let cur = parseClock(whiteClock.textContent)
whiteClock.textContent = formatClock(cur-1)
}
else{
let cur = parseClock(blackClock.textContent)
blackClock.textContent = formatClock(cur-1)
}

if(remaining<=0){
clearInterval(interval)
resolve()
}

},1000)

})

}

document.getElementById("startReplay").onclick = replay
