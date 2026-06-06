(function () {
  const COLS = 10, ROWS = 20, BLOCK = 30;
  const COLORS = [
    null,
    '#00cfcf', // I
    '#f0d000', // O
    '#a000f0', // T
    '#00c000', // S
    '#f00000', // Z
    '#0000f0', // J
    '#f0a000', // L
  ];
  const PIECES = [
    null,
    [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
    [[2,2],[2,2]],                               // O
    [[0,3,0],[3,3,3],[0,0,0]],                   // T
    [[0,4,4],[4,4,0],[0,0,0]],                   // S
    [[5,5,0],[0,5,5],[0,0,0]],                   // Z
    [[6,0,0],[6,6,6],[0,0,0]],                   // J
    [[0,0,7],[7,7,7],[0,0,0]],                   // L
  ];

  const canvas = document.getElementById('tetris-board');
  const ctx = canvas.getContext('2d');
  const nextCanvas = document.getElementById('tetris-next');
  const nextCtx = nextCanvas.getContext('2d');
  const scoreEl = document.getElementById('tetris-score');
  const levelEl = document.getElementById('tetris-level');
  const linesEl = document.getElementById('tetris-lines');
  const startBtn = document.getElementById('tetris-start');

  let board, piece, pieceX, pieceY, nextPiece;
  let score, level, lines, running, animId, lastTime, dropInterval;

  function newBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  }

  function randomPiece() {
    const id = Math.floor(Math.random() * 7) + 1;
    return PIECES[id].map(r => [...r]);
  }

  function rotate(matrix) {
    const n = matrix.length;
    return matrix[0].map((_, i) => matrix.map(row => row[i]).reverse());
  }

  function collides(b, p, ox, oy) {
    for (let r = 0; r < p.length; r++) {
      for (let c = 0; c < p[r].length; c++) {
        if (!p[r][c]) continue;
        const nx = ox + c, ny = oy + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && b[ny][nx]) return true;
      }
    }
    return false;
  }

  function merge() {
    for (let r = 0; r < piece.length; r++) {
      for (let c = 0; c < piece[r].length; c++) {
        if (piece[r][c]) board[pieceY + r][pieceX + c] = piece[r][c];
      }
    }
  }

  function clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r].every(v => v)) {
        board.splice(r, 1);
        board.unshift(Array(COLS).fill(0));
        cleared++;
        r++;
      }
    }
    if (!cleared) return;
    const pts = [0, 100, 300, 500, 800][cleared] * level;
    score += pts;
    lines += cleared;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    scoreEl.textContent = score;
    levelEl.textContent = level;
    linesEl.textContent = lines;
  }

  function spawnPiece() {
    piece = nextPiece;
    nextPiece = randomPiece();
    pieceX = Math.floor((COLS - piece[0].length) / 2);
    pieceY = 0;
    if (collides(board, piece, pieceX, pieceY)) {
      gameOver();
    }
    drawNext();
  }

  function gameOver() {
    running = false;
    cancelAnimationFrame(animId);
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#e94560';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 16);
    ctx.fillStyle = '#eaeaea';
    ctx.font = '16px sans-serif';
    ctx.fillText('Score: ' + score, canvas.width / 2, canvas.height / 2 + 18);
    startBtn.textContent = 'RETRY';
  }

  function drawBlock(c, x, y, size) {
    if (!c) return;
    const color = COLORS[c];
    ctx.fillStyle = color;
    ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(x + 1, y + 1, size - 2, 4);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(x + 1, y + size - 5, size - 2, 4);
  }

  function drawBoard() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // grid
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 0.5;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        ctx.strokeRect(c * BLOCK, r * BLOCK, BLOCK, BLOCK);
        drawBlock(board[r][c], c * BLOCK, r * BLOCK, BLOCK);
      }
    }
  }

  function drawGhost() {
    let gy = pieceY;
    while (!collides(board, piece, pieceX, gy + 1)) gy++;
    if (gy === pieceY) return;
    ctx.globalAlpha = 0.22;
    for (let r = 0; r < piece.length; r++) {
      for (let c = 0; c < piece[r].length; c++) {
        if (piece[r][c]) {
          ctx.fillStyle = COLORS[piece[r][c]];
          ctx.fillRect((pieceX + c) * BLOCK + 1, (gy + r) * BLOCK + 1, BLOCK - 2, BLOCK - 2);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawPiece() {
    for (let r = 0; r < piece.length; r++) {
      for (let c = 0; c < piece[r].length; c++) {
        if (piece[r][c]) drawBlock(piece[r][c], (pieceX + c) * BLOCK, (pieceY + r) * BLOCK, BLOCK);
      }
    }
  }

  function drawNext() {
    nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    const nb = 24;
    const offX = Math.floor((nextCanvas.width - nextPiece[0].length * nb) / 2);
    const offY = Math.floor((nextCanvas.height - nextPiece.length * nb) / 2);
    for (let r = 0; r < nextPiece.length; r++) {
      for (let c = 0; c < nextPiece[r].length; c++) {
        if (!nextPiece[r][c]) continue;
        const color = COLORS[nextPiece[r][c]];
        nextCtx.fillStyle = color;
        nextCtx.fillRect(offX + c * nb + 1, offY + r * nb + 1, nb - 2, nb - 2);
        nextCtx.fillStyle = 'rgba(255,255,255,0.25)';
        nextCtx.fillRect(offX + c * nb + 1, offY + r * nb + 1, nb - 2, 3);
      }
    }
  }

  function loop(ts) {
    if (!running) return;
    animId = requestAnimationFrame(loop);
    const delta = ts - lastTime;
    if (delta >= dropInterval) {
      lastTime = ts;
      if (!collides(board, piece, pieceX, pieceY + 1)) {
        pieceY++;
      } else {
        merge();
        clearLines();
        spawnPiece();
      }
    }
    drawBoard();
    drawGhost();
    drawPiece();
  }

  function startGame() {
    board = newBoard();
    score = 0; level = 1; lines = 0; dropInterval = 1000;
    scoreEl.textContent = 0;
    levelEl.textContent = 1;
    linesEl.textContent = 0;
    nextPiece = randomPiece();
    spawnPiece();
    running = true;
    lastTime = performance.now();
    cancelAnimationFrame(animId);
    animId = requestAnimationFrame(loop);
    startBtn.textContent = 'RESTART';
  }

  startBtn.addEventListener('click', startGame);

  // ── Keyboard ──
  document.addEventListener('keydown', e => {
    if (!running) return;
    switch (e.code) {
      case 'ArrowLeft':
        if (!collides(board, piece, pieceX - 1, pieceY)) pieceX--;
        break;
      case 'ArrowRight':
        if (!collides(board, piece, pieceX + 1, pieceY)) pieceX++;
        break;
      case 'ArrowDown':
        if (!collides(board, piece, pieceX, pieceY + 1)) pieceY++;
        break;
      case 'ArrowUp': case 'KeyZ': {
        const rot = rotate(piece);
        if (!collides(board, rot, pieceX, pieceY)) piece = rot;
        break;
      }
      case 'Space': {
        e.preventDefault();
        while (!collides(board, piece, pieceX, pieceY + 1)) pieceY++;
        merge(); clearLines(); spawnPiece();
        break;
      }
    }
  });

  // ── Touch buttons ──
  document.querySelectorAll('.t-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!running) return;
      switch (btn.dataset.action) {
        case 'left':   if (!collides(board, piece, pieceX - 1, pieceY)) pieceX--; break;
        case 'right':  if (!collides(board, piece, pieceX + 1, pieceY)) pieceX++; break;
        case 'down':   if (!collides(board, piece, pieceX, pieceY + 1)) pieceY++; break;
        case 'rotate': { const rot = rotate(piece); if (!collides(board, rot, pieceX, pieceY)) piece = rot; break; }
        case 'drop':
          while (!collides(board, piece, pieceX, pieceY + 1)) pieceY++;
          merge(); clearLines(); spawnPiece(); break;
      }
    });
  });

  // ── Initial render ──
  ctx.fillStyle = '#0a0a18';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '18px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('START を押してください', canvas.width / 2, canvas.height / 2);
})();
