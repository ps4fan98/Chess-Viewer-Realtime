(() => {
  const pgnFile = document.getElementById("pgnFile");
  const startBtn = document.getElementById("startBtn");
  const stopBtn  = document.getElementById("stopBtn");
  const statusEl = document.getElementById("status");
  const wClockEl = document.getElementById("wClock");
  const bClockEl = document.getElementById("bClock");
  const boardEl  = document.getElementById("board");

  // ---------- board rendering (no external board libs) ----------
  const pieceToUnicode = {
    p:"♟", r:"♜", n:"♞", b:"♝", q:"♛", k:"♚",
    P:"♙", R:"♖", N:"♘", B:"♗", Q:"♕", K:"♔"
  };

  // build 64 squares once
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
    let idx = 0; // squares array is rank 8 -> 1, file a -> h already
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

  // ---------- PGN + timing ----------
  let chess = null;
  let plies = [];        // verbose moves
  let timestamps = [];   // seconds per ply (Chess.com: [%timestamp N])
  let clocks = [];       // remaining time after ply (Chess.com: [%clk 0:09:56.1])
  let wTime = 0;
  let bTime = 0;
  let stopRequested = false;

  function setStatus(msg) { statusEl.textContent = msg; }

  function parseTimeControlSeconds(pgn) {
    const m = pgn.match(/\[TimeControl\s+"([^"]+)"\]/);
    if (!m) return null;
    const tc = m[1].trim();          // e.g. "600" or "600+5"
    const mm = tc.match(/^(\d+)(?:\+(\d+))?$/);
    if (!mm) return null;
    return parseInt(mm[1], 10);      // base seconds
  }

  function parseClkToSeconds(clkStr) {
    // clkStr like "0:09:56.1" or "9:56.1"
    const parts = clkStr.trim().split(":");
    if (parts.length === 3) {
      return parseInt(parts[0],10)*3600 + parseInt(parts[1],10)*60 + parseFloat(parts[2]);
    }
    if (parts.length === 2) {
      return parseInt(parts[0],10)*60 + parseFloat(parts[1]);
    }
    return parseFloat(parts[0]);
  }

  function fmt(sec) {
    sec = Math.max(0, Math.floor(sec));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2,"0")}`;
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

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
    stopRequested = true; // stop any prior replay
    stopRequested = false;

    const file = e.target.files?.[0];
    if (!file) return;

    const pgn = await file.text();

    // Create chess instance and load PGN
    chess = new Chess();
    const ok = chess.load_pgn(pgn, { sloppy: true });
    if (!ok) {
      setStatus("PGN failed to load. (Try exporting again from Chess.com Analysis > Share > PGN with clock.)");
      return;
    }

    // Get verbose plies (color included)
    plies = chess.history({ verbose: true });

    // IMPORTANT: Chess.com may insert newlines => use \s+ not " "
    timestamps = [...pgn.matchAll(/\[%timestamp\s+(\d+)\]/g)].map(m => parseInt(m[1],10));
    clocks     = [...pgn.matchAll(/\[%clk\s+([0-9:\.]+)\]/g)].map(m => parseClkToSeconds(m[1]));

    // Init times: prefer TimeControl base (e.g. 600), else fall back to first seen clocks
    const base = parseTimeControlSeconds(pgn);
    wTime = base ?? clocks[0] ?? 0;
    bTime = base ?? clocks[1] ?? wTime;

    // Reset position for display
    chess.reset();
    renderFen(chess.fen());

    wClockEl.textContent = fmt(wTime);
    bClockEl.textContent = fmt(bTime);

    // Enable start if we have moves
    startBtn.disabled = plies.length === 0;
    stopBtn.disabled = true;

    setStatus(`Loaded: plies=${plies.length}, timestamps=${timestamps.length}, clocks=${clocks.length}. (Your game should be plies=86)`);
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

      // tick down while thinking
      await runClock(ply.color, think);
      if (stopRequested) break;

      // play move (use SAN already in verbose move)
      chess.move(ply.san, { sloppy: true });
      renderFen(chess.fen());

      // snap clocks to Chess.com recorded remaining time (accounts for increment + tenths)
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

  // initial UI
  resetUI();
})();
