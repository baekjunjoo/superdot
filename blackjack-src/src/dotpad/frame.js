/* frame.js — 60×40 프레임버퍼 + 그리기 프리미티브 + DotPad 행 인코딩
   셀 인코딩(절대 불변, dotpad-dev): bit = y%4 + (x%2)*4, 행우선 10행×30셀 */

export const W = 60, H = 40;

export function createFrame() { return new Uint8Array(W * H); }
export function clearBuf(buf) { buf.fill(0); }

export function set(buf, x, y, v = 1) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  buf[y * W + x] = v ? 1 : 0;
}
export function get(buf, x, y) {
  if (x < 0 || y < 0 || x >= W || y >= H) return 0;
  return buf[y * W + x];
}

export function line(buf, x0, y0, x1, y1) {
  let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  for (;;) {
    set(buf, x0, y0);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }
}

export function rect(buf, x, y, w, h, opts = {}) {
  if (opts.fill) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) set(buf, xx, yy);
  } else {
    for (let xx = x; xx < x + w; xx++) { set(buf, xx, y); set(buf, xx, y + h - 1); }
    for (let yy = y; yy < y + h; yy++) { set(buf, x, yy); set(buf, x + w - 1, yy); }
  }
}

/* 점선 가로줄 (구분선용 — 카드 테두리와 촉각으로 구별) */
export function dashedHLine(buf, y, on = 3, off = 2) {
  for (let x = 0; x < W; x++) if (x % (on + off) < on) set(buf, x, y);
}

/* 3×5 픽셀 폰트 — 숫자 + 카드 랭크 문자 */
const FONT = {
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'],
  '7': ['111', '001', '010', '010', '010'],
  '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'],
  'A': ['010', '101', '111', '101', '101'],
  'J': ['111', '010', '010', '010', '110'],
  'Q': ['111', '101', '101', '111', '001'],
  'K': ['101', '110', '100', '110', '101']
};

/* 글리프 1개. sx/sy = 가로/세로 배율 */
export function drawGlyph(buf, ch, x, y, sx = 1, sy = 1) {
  const g = FONT[ch];
  if (!g) return;
  for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) {
    if (g[r][c] === '1') {
      for (let dy = 0; dy < sy; dy++) for (let dx = 0; dx < sx; dx++) {
        set(buf, x + c * sx + dx, y + r * sy + dy);
      }
    }
  }
}

/* 문자열 (글리프 폭 3*sx + 1*sx 간격) */
export function drawText(buf, str, x, y, sx = 1, sy = 1) {
  let cx = x;
  for (const ch of String(str)) {
    drawGlyph(buf, ch, cx, y, sx, sy);
    cx += 4 * sx;
  }
  return cx;
}

export function textWidth(str, sx = 1) { return String(str).length * 4 * sx - sx; }

/* 프레임버퍼 → 그래픽 10행 hex(행당 30셀=30바이트=60자) — 검증된 인코딩, 변경 금지 */
export function encodeRows(buf) {
  const rows = [];
  for (let gy = 0; gy < 10; gy++) {
    let hex = '';
    for (let gx = 0; gx < 30; gx++) {
      const px = gx * 2, py = gy * 4;
      let b = 0;
      for (let r = 0; r < 4; r++) {
        if (buf[(py + r) * W + px]) b |= (1 << r);
        if (buf[(py + r) * W + px + 1]) b |= (1 << (r + 4));
      }
      const h = b.toString(16).toUpperCase();
      hex += (h.length < 2 ? '0' : '') + h;
    }
    rows.push(hex);
  }
  return rows;
}
