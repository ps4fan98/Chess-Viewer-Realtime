(() => {
  const pgnFile = document.getElementById("pgnFile");
  const startBtn = document.getElementById("startBtn");
  const stopBtn = document.getElementById("stopBtn");
  const statusEl = document.getElementById("status");
  const wClockEl = document.getElementById("wClock");
  const bClockEl = document.getElementById("bClock");
  const boardEl = document.getElementById("board");

  const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

  const pieceToUnicode = {
    p: "♟", r: "♜", n: "♞", b: "♝", q: "♛", k: "♚",
    P: "♙", R: "♖", N: "♘", B: "♗", Q: "♕", K: "♔"
  };

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
    const clamped = Math.max(0, sec || 0);
    const m = Math.floor(clamped / 60);
    const s = clamped - m * 60;
    const whole = Math.floor(s);
    const tenths = Math.floor((s - whole) * 10);
    return tenths > 0
      ? `${m}:${String(whole).padStart(2, "0")}.${tenths}`
      : `${m}:${String(whole).padStart(2, "0")}`;
  }

  function parseClkToSeconds(clkStr) {
    const parts = clkStr.trim().split(":");
    if (parts.length === 3) {
      return parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseFloat(parts[2]);
    }
    if (parts.length === 2) {
      return parseInt(parts[0], 10) * 60 + parseFloat(parts[1]);
    }
    return parseFloat(parts[0]);
  }

  function parseHeader(pgn, name) {
    const m = pgn.match(new RegExp(`\\[${name}\\s+"([^"]*)"\\]`));
    return m ? m[1] : null;
  }

  function parseTimeControl(pgn) {
    const tc = parseHeader(pgn, "TimeControl");
    if (!tc) return null;
    const mm = tc.trim().match(/^(\d+)(?:\+(\d+))?$/);
    if (!mm) return null;
    return { base: parseInt(mm[1], 10), increment: parseInt(mm[2] || "0", 10) };
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  let chess = null;
  let plies = [];
  let timestamps = [];
  let clocks = [];
  let thinkTimes = [];
  let timingMode = "none";
  let initialFen = START_FEN;
  let wTime = 0;
  let bTime = 0;
  let stopRequested = false;

  async function runClock(color, seconds) {
    let remaining = Math.max(0, seconds || 0);
    const step = 0.1;

    while (remaining > 0) {
      if (stopRequested) return;
      const tick = Math.min(step, remaining);
      await sleep(tick * 1000);
      if (color === "w") wTime = Math.max(0, wTime - tick);
      else bTime = Math.max(0, bTime - tick);
      wClockEl.textContent = fmt(wTime);
      bClockEl.textContent = fmt(bTime);
      remaining -= tick;
    }
  }

  function resetUI() {
    startBtn.disabled = true;
    stopBtn.disabled = true;
    wClockEl.textContent = "--:--";
    bClockEl.textContent = "--:--";
    renderFen(START_FEN);
  }

  function buildThinkTimesFromClocks(pliesIn, clocksIn, timeControl) {
    if (!timeControl || !Number.isFinite(timeControl.base)) return null;
    if (clocksIn.length < pliesIn.length) return null;

    const out = [];
    let prevW = timeControl.base;
    let prevB = timeControl.base;

    for (let i = 0; i < pliesIn.length; i++) {
      const clk = clocksIn[i];
      if (!Number.isFinite(clk)) return null;

      const color = pliesIn[i].color;
      if (color === "w") {
        const think = Math.max(0, prevW - clk + timeControl.increment);
        out.push(think);
        prevW = clk;
      } else {
        const think = Math.max(0, prevB - clk + timeControl.increment);
        out.push(think);
        prevB = clk;
      }
    }

    return out;
  }

  pgnFile.addEventListener("change", async (e) => {
    resetUI();
    stopRequested = true;
    stopRequested = false;

    if (typeof window.Chess === "undefined") {
      setStatus("ERROR: Chess engine failed to load (window.Chess is undefined). Ensure index.html loads vendor/chess.min.js before replay.js.");
      console.error("window.Chess undefined");
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;

    const pgn = await file.text();

    chess = new window.Chess();
    const ok = chess.load_pgn(pgn, { sloppy: true });
    if (!ok) {
      setStatus("PGN failed to load. Export again from Chess.com with clocks/timestamps.");
      return;
    }

    plies = chess.history({ verbose: true });

    timestamps = [...pgn.matchAll(/\[%timestamp\s+(\d+)\]/g)].map(m => parseInt(m[1], 10));
    clocks = [...pgn.matchAll(/\[%clk\s+([0-9:\.]+)\]/g)].map(m => parseClkToSeconds(m[1]));

    const setup = parseHeader(pgn, "SetUp");
    const fenHeader = parseHeader(pgn, "FEN");
    initialFen = (setup === "1" && fenHeader) ? fenHeader : START_FEN;

    const tc = parseTimeControl(pgn);

    if (timestamps.length >= plies.length && plies.length > 0) {
      thinkTimes = timestamps.slice(0, plies.length).map(v => Math.max(0, v));
      timingMode = "timestamp";
    } else {
      const derived = buildThinkTimesFromClocks(plies, clocks, tc);
      if (derived) {
        thinkTimes = derived;
        timingMode = "clock-delta";
      } else {
        thinkTimes = new Array(plies.length).fill(0);
        timingMode = "none";
      }
    }

    wTime = tc?.base ?? clocks[0] ?? 0;
    bTime = tc?.base ?? clocks[1] ?? wTime;

    chess.load(initialFen);
    renderFen(chess.fen());

    wClockEl.textContent = fmt(wTime);
    bClockEl.textContent = fmt(bTime);

    startBtn.disabled = plies.length === 0;
    stopBtn.disabled = true;

    setStatus(`Loaded: plies=${plies.length} clocks=${clocks.length} timestamps=${timestamps.length} timingMode=${timingMode}`);
  });

  startBtn.addEventListener("click", async () => {
    if (typeof window.Chess === "undefined") {
      setStatus("ERROR: Chess engine failed to load (window.Chess is undefined). Ensure index.html loads vendor/chess.min.js before replay.js.");
      return;
    }
    if (!chess || plies.length === 0) return;

    stopRequested = false;
    startBtn.disabled = true;
    stopBtn.disabled = false;

    chess.load(initialFen);
    renderFen(chess.fen());
    setStatus(`Replaying (${timingMode})…`);

    for (let i = 0; i < plies.length; i++) {
      if (stopRequested) break;

      const ply = plies[i];
      const think = thinkTimes[i] ?? 0;

      await runClock(ply.color, think);
      if (stopRequested) break;

      chess.move(ply.san, { sloppy: true });
      renderFen(chess.fen());

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

  if (typeof window.Chess === "undefined") {
    setStatus("ERROR: Chess engine failed to load (window.Chess is undefined). Ensure index.html loads vendor/chess.min.js before replay.js.");
    console.error("window.Chess undefined on page init");
  }
})();
