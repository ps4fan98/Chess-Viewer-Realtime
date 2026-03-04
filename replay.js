let chess = new Chess()

let board = Chessboard('board','start')

let moves=[]
let timestamps=[]
let clocks=[]

let whiteTime=0
let blackTime=0

const whiteClock=document.getElementById("whiteClock")
const blackClock=document.getElementById("blackClock")

function sleep(ms){
return new Promise(r=>setTimeout(r,ms))
}

function formatClock(sec){

sec=Math.max(0,Math.floor(sec))

let m=Math.floor(sec/60)
let s=sec%60

return m+":"+s.toString().padStart(2,"0")

}

function parseClock(clk){

clk=clk.replace(".","")

let parts=clk.split(":").map(Number)

if(parts.length===3)
return parts[0]*3600+parts[1]*60+parts[2]

return parts[0]*60+parts[1]

}

document.getElementById("pgnFile").addEventListener("change",e=>{

let reader=new FileReader()

reader.onload=function(){

let pgn=reader.result

chess.load_pgn(pgn)

moves=chess.history()

timestamps=[...pgn.matchAll(/\[%timestamp ([0-9]+)\]/g)]
.map(x=>parseInt(x[1]))

clocks=[...pgn.matchAll(/\[%clk ([0-9:\.]+)\]/g)]
.map(x=>parseClock(x[1]))

whiteTime=clocks[0]
blackTime=clocks[1]

whiteClock.textContent=formatClock(whiteTime)
blackClock.textContent=formatClock(blackTime)

console.log("Moves:",moves.length)

}

reader.readAsText(e.target.files[0])

})

async function runClock(color,time){

for(let i=0;i<time;i++){

await sleep(1000)

if(color==="w"){
whiteTime--
whiteClock.textContent=formatClock(whiteTime)
}else{
blackTime--
blackClock.textContent=formatClock(blackTime)
}

}

}

document.getElementById("startBtn").onclick=async function(){

chess.reset()
board.position('start')

for(let i=0;i<moves.length;i++){

let color=i%2===0?"w":"b"

let think=timestamps[i]||0

await runClock(color,think)

chess.move(moves[i])

board.position(chess.fen())

if(color==="w"){
whiteTime=clocks[i]
whiteClock.textContent=formatClock(whiteTime)
}else{
blackTime=clocks[i]
blackClock.textContent=formatClock(blackTime)
}

}

}
