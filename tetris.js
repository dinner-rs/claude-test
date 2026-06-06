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

  const FACE_URL = 'https://www.biteki.com/wp-content/uploads/2025/05/202507g-teranishi-main.jpg';

  const canvas = document.getElementById('tetris-board');
  const ctx = canvas.getContext('2d');
  const nextCanvas = document.getElementById('tetris-next');
  const nextCtx = nextCanvas.getContext('2d');
  const scoreEl = document.getElementById('tetris-score');
  const levelEl = document.getElementById('tetris-level');
  const linesEl = document.getElementById('tetris-lines');
  const startBtn = document.getElementById('tetris-start');

  // ── Face image loading ──
  // faceImg holds the actual usable Image element once loaded.
  let faceImg = null;

  (function loadFace() {
    const img1 = new Image();
    img1.crossOrigin = 'anonymous';
    img1.onload = () => { faceImg = img1; };
    img1.onerror = () => {
      // CORS failed — retry without crossOrigin (canvas will be tainted but still renders)
      const img2 = new Image();
      img2.onload = () => { faceImg = img2; };
      img2.src = FACE_URL;
    };
    img1.src = FACE_URL;
  })();

  // Draw faceImg cropped to cover (size × size), biased toward top for face area
  function drawFaceCover(c, size) {
    if (!faceImg || !faceImg.naturalWidth) return false;
    const iw = faceImg.naturalWidth, ih = faceImg.naturalHeight;
    const scale = Math.max(size / iw, size / ih);
    const sw = size / scale, sh = size / scale;
    const sx = (iw - sw) / 2;
    const sy = (ih - sh) * 0.15;
    try {
      c.drawImage(faceImg, sx, sy, sw, sh, 0, 0, size, size);
      return true;
    } catch (_) {
      faceImg = null; // taint or security error — disable face
      return false;
    }
  }

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
    return matrix[0].map((_, i) => matrix.map(row => row[i]).reverse());
  }

  function collides(b, p, ox, oy) {
    for (let r = 0; r < p.length; r++)
      for (let c = 0; c < p[r].length; c++) {
        if (!p[r][c]) continue;
        const nx = ox + c, ny = oy + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && b[ny][nx]) return true;
      }
    return false;
  }

  function merge() {
    for (let r = 0; r < piece.length; r++)
      for (let c = 0; c < piece[r].length; c++)
        if (piece[r][c]) board[pieceY + r][pieceX + c] = piece[r][c];
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
    score += [0, 100, 300, 500, 800][cleared] * level;
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
    if (collides(board, piece, pieceX, pieceY)) gameOver();
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

  // Draw one block at (x, y) with given size, into context c.
  // Uses face image when available; falls back to solid color.
  function drawBlock(color, x, y, size, c) {
    c = c || ctx;
    c.save();
    // Clip to block area so face image doesn't bleed outside
    c.beginPath();
    c.rect(x + 1, y + 1, size - 2, size - 2);
    c.clip();

    if (faceImg) {
      // Translate so drawFaceCover draws at (x+1, y+1)
      c.translate(x + 1, y + 1);
      const drawn = drawFaceCover(c, size - 2);
      c.translate(-(x + 1), -(y + 1));

      if (drawn) {
        // Semi-transparent color tint to distinguish piece types
        c.fillStyle = color + '50';
        c.fillRect(x + 1, y + 1, size - 2, size - 2);
      } else {
        c.fillStyle = color;
        c.fillRect(x + 1, y + 1, size - 2, size - 2);
      }
    } else {
      c.fillStyle = color;
      c.fillRect(x + 1, y + 1, size - 2, size - 2);
      c.fillStyle = 'rgba(255,255,255,0.25)';
      c.fillRect(x + 1, y + 1, size - 2, 4);
      c.fillStyle = 'rgba(0,0,0,0.2)';
      c.fillRect(x + 1, y + size - 5, size - 2, 4);
    }

    c.restore(); // restores clip and transform

    // Border drawn outside clip (save/restore scope)
    c.strokeStyle = color;
    c.lineWidth = 1.5;
    c.strokeRect(x + 1.75, y + 1.75, size - 3.5, size - 3.5);
  }

  function drawBoard() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 0.5;
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        ctx.strokeRect(c * BLOCK, r * BLOCK, BLOCK, BLOCK);
        if (board[r][c]) drawBlock(COLORS[board[r][c]], c * BLOCK, r * BLOCK, BLOCK);
      }
  }

  // Ghost: simple outlined rectangles — no drawBlock to avoid canvas state issues
  function drawGhost() {
    let gy = pieceY;
    while (!collides(board, piece, pieceX, gy + 1)) gy++;
    if (gy === pieceY) return;
    ctx.save();
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.45;
    for (let r = 0; r < piece.length; r++)
      for (let c = 0; c < piece[r].length; c++)
        if (piece[r][c]) {
          ctx.strokeStyle = COLORS[piece[r][c]];
          ctx.strokeRect(
            (pieceX + c) * BLOCK + 2,
            (gy + r) * BLOCK + 2,
            BLOCK - 4,
            BLOCK - 4
          );
        }
    ctx.restore();
  }

  function drawPiece() {
    for (let r = 0; r < piece.length; r++)
      for (let c = 0; c < piece[r].length; c++)
        if (piece[r][c]) drawBlock(COLORS[piece[r][c]], (pieceX + c) * BLOCK, (pieceY + r) * BLOCK, BLOCK);
  }

  function drawNext() {
    nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    const nb = 24;
    const offX = Math.floor((nextCanvas.width - nextPiece[0].length * nb) / 2);
    const offY = Math.floor((nextCanvas.height - nextPiece.length * nb) / 2);
    for (let r = 0; r < nextPiece.length; r++)
      for (let c = 0; c < nextPiece[r].length; c++)
        if (nextPiece[r][c])
          drawBlock(COLORS[nextPiece[r][c]], offX + c * nb, offY + r * nb, nb, nextCtx);
  }

  function loop(ts) {
    if (!running) return;
    animId = requestAnimationFrame(loop);
    if (ts - lastTime >= dropInterval) {
      lastTime = ts;
      if (!collides(board, piece, pieceX, pieceY + 1)) pieceY++;
      else { merge(); clearLines(); spawnPiece(); }
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

  document.addEventListener('keydown', e => {
    if (!running) return;
    switch (e.code) {
      case 'ArrowLeft':  if (!collides(board, piece, pieceX - 1, pieceY)) pieceX--; break;
      case 'ArrowRight': if (!collides(board, piece, pieceX + 1, pieceY)) pieceX++; break;
      case 'ArrowDown':  if (!collides(board, piece, pieceX, pieceY + 1)) pieceY++; break;
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

  ctx.fillStyle = '#0a0a18';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '18px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('START を押してください', canvas.width / 2, canvas.height / 2);
})();
