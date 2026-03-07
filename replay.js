(() => {
  const pgnFile = document.getElementById("pgnFile");
  const startBtn = document.getElementById("startBtn");
  const stopBtn  = document.getElementById("stopBtn");
  const statusEl = document.getElementById("status");
  const wClockEl = document.getElementById("wClock");
  const bClockEl = document.getElementById("bClock");
  const boardEl  = document.getElementById("board");

  const pieceToUnicode = {
    p:"♟", r:"♜", n:"♞", b:"♝", q:"♛", k:"♚",
    P:"♙", R:"♖", N:"♘", B:"♗", Q:"♕", K:"♔"
  };

  // build board squares once
  const squares = [];
  boardEl.innerHTML = "";
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const sq = document.createElement("div");
      sq.className = "sq " + ((r + f) % 2 === 0 ? "light" : "dark");
      boardEl.appendChild(sq);
      squares.push(sq);
    }
  }

  function renderFen(fen) {
    const placement = fen.split(" ")[0];
    const ranks = placement.split("/");
    let idx = 0;
    for (const rank of ranks) {
      for (const ch of rank) {
        if (/\d/.test(ch)) {
          const n = parseInt(ch, 10);
          for (let i = 0; i < n; i++) squares[idx++].textContent = "";
        } else {
          squares[idx++].textContent = pieceToUnicode[ch] || "";
        }
      }
    }
  }

  function setStatus(msg) { statusEl.textContent = msg; }

  function fmt(sec) {
    sec = Math.max(0, Math.floor(sec));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2,"0")}`;
  }

  function parseClkToSeconds(clkStr) {
    const parts = clkStr.trim().split(":");
    if (parts.length === 3) {
      return parseInt(parts[0],10)*3600 + parseInt(parts[1],10)*60 + parseFloat(parts[2]);
    }
    if (parts.length === 2) {
      return parseInt(parts[0],10)*60 + parseFloat(parts[1]);
    }
    return parseFloat(parts[0]);
  }

  function parseTimeControlSeconds(pgn) {
    const m = pgn.match(/\[TimeControl\s+"([^"]+)"\]/);
    if (!m) return null;
    const tc = m[1].trim(); // e.g. "600" or "600+5"
    const mm = tc.match(/^(\d+)(?:\+(\d+))?$/);
    if (!mm) return null;
    return parseInt(mm[1], 10);
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  function hasChessEngine() {
    return typeof window.Chess === "function";
  }

  function showMissingChessError() {
    setStatus("ERROR: Chess engine failed to load (window.Chess missing). Ensure index.html loads only vendor/chess.min.js as a classic script.");
    startBtn.disabled = true;
    stopBtn.disabled = true;
    console.error("window.Chess is undefined. A module chess.js build may have been loaded by mistake.");
  }

  let chess = null;
  let plies = [];
  let timestamps = [];
  let clocks = [];
  let wTime = 0;
  let bTime = 0;
  let stopRequested = false;

  async function runClock(color, seconds) {
    for (let i = 0; i < seconds; i++) {
      if (stopRequested) return;
      await sleep(1000);
      if (color === "w") wTime = Math.max(0, wTime - 1);
      else bTime = Math.max(0, bTime - 1);
      wClockEl.textContent = fmt(wTime);
      bClockEl.textContent = fmt(bTime);
    }
  }

  function resetUI() {
    startBtn.disabled = true;
    stopBtn.disabled = true;
    wClockEl.textContent = "--:--";
    bClockEl.textContent = "--:--";
    renderFen("8/8/8/8/8/8/8/8 w - - 0 1");
  }

  pgnFile.addEventListener("change", async (e) => {
    resetUI();
    stopRequested = true;
    stopRequested = false;

    if (!hasChessEngine()) {
      showMissingChessError();
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;

    const pgn = await file.text();

    chess = new window.Chess();
    const ok = chess.load_pgn(pgn, { sloppy: true });
    if (!ok) {
      setStatus("PGN failed to load. Export again from Chess.com with timestamps enabled.");
      return;
    }

    plies = chess.history({ verbose: true });

    // Chess.com can insert newlines inside these tags -> \s+
    timestamps = [...pgn.matchAll(/\[%timestamp\s+(\d+)\]/g)].map(m => parseInt(m[1],10));
    clocks     = [...pgn.matchAll(/\[%clk\s+([0-9:\.]+)\]/g)].map(m => parseClkToSeconds(m[1]));

    const base = parseTimeControlSeconds(pgn);
    wTime = base ?? clocks[0] ?? 0;
    bTime = base ?? clocks[1] ?? wTime;

    chess.reset();
    renderFen(chess.fen());

    wClockEl.textContent = fmt(wTime);
    bClockEl.textContent = fmt(bTime);

    startBtn.disabled = plies.length === 0;
    stopBtn.disabled = true;

    setStatus(`Loaded: plies=${plies.length} timestamps=${timestamps.length} clocks=${clocks.length}`);
  });

  startBtn.addEventListener("click", async () => {
    if (!chess || plies.length === 0) return;

    stopRequested = false;
    startBtn.disabled = true;
    stopBtn.disabled = false;

    chess.reset();
    renderFen(chess.fen());
    setStatus("Replaying…");

    for (let i = 0; i < plies.length; i++) {
      if (stopRequested) break;

      const ply = plies[i];
      const think = timestamps[i] ?? 0;

      await runClock(ply.color, think);
      if (stopRequested) break;

      chess.move(ply.san, { sloppy: true });
      renderFen(chess.fen());

      // snap to recorded remaining time (handles increment + tenths)
      const recorded = clocks[i];
      if (typeof recorded === "number") {
        if (ply.color === "w") wTime = recorded;
        else bTime = recorded;
        wClockEl.textContent = fmt(wTime);
        bClockEl.textContent = fmt(bTime);
      }
    }

    stopBtn.disabled = true;
    startBtn.disabled = false;
    setStatus(stopRequested ? "Stopped." : "Finished.");
  });

  stopBtn.addEventListener("click", () => {
    stopRequested = true;
    stopBtn.disabled = true;
    startBtn.disabled = false;
    setStatus("Stopping…");
  });

  resetUI();
  if (!hasChessEngine()) {
    showMissingChessError();
  }
})();
