let chess = new Chess()

let moves = []
let timestamps = []
let clocks = []

let whiteClock = document.getElementById("whiteClock")
let blackClock = document.getElementById("blackClock")

let whiteTime = 0
let blackTime = 0

function formatClock(sec){

sec = Math.max(0,Math.floor(sec))

let m = Math.floor(sec/60)
let s = sec % 60

return m + ":" + s.toString().padStart(2,"0")

}

function parseClock(clk){

clk = clk.replace(".","")

let parts = clk.split(":").map(Number)

if(parts.length === 3)
return parts[0]*3600 + parts[1]*60 + parts[2]

return parts[0]*60 + parts[1]

}

function sleep(ms){
return new Promise(r => setTimeout(r,ms))
}

document.getElementById("pgnFile").addEventListener("change",e=>{

let file = e.target.files[0]

let reader = new FileReader()

reader.onload = function(){

let pgn = reader.result

chess.loadPgn(pgn)

moves = chess.history()

timestamps = [...pgn.matchAll(/\[%timestamp ([0-9]+)\]/g)]
.map(x => parseInt(x[1]))

clocks = [...pgn.matchAll(/\[%clk ([0-9:\.]+)\]/g)]
.map(x => parseClock(x[1]))

whiteTime = clocks[0]
blackTime = clocks[1]

whiteClock.textContent = formatClock(whiteTime)
blackClock.textContent = formatClock(blackTime)

console.log("Loaded",moves.length,"moves")

}

reader.readAsText(file)

})

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

async function startReplay(){

chess.reset()

for(let i=0;i<moves.length;i++){

let color = i%2===0 ? "w" : "b"

let think = timestamps[i] || 0

await runClock(color,think)

chess.move(moves[i])

console.log("Move:",moves[i])

}

}
