/* Byte-mode QR, error level M, versions 1–20. No network and no extra library. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.GlaukaQr = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const EXP = new Uint8Array(512);
  const LOG = new Uint8Array(256);
  (function () {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      EXP[i] = x;
      LOG[x] = i;
      x <<= 1;
      if (x & 256) x ^= 0x11d;
    }
    for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  })();
  const mul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);
  /* version, ecc length, group1 blocks, group1 data, group2 blocks, group2 data, remainder bits */
  const VERSIONS = [
    [1, 10, 1, 16, 0, 0, 0],
    [2, 16, 1, 28, 0, 0, 7],
    [3, 26, 1, 44, 0, 0, 7],
    [4, 18, 2, 32, 0, 0, 7],
    [5, 24, 2, 43, 0, 0, 7],
    [6, 16, 4, 27, 0, 0, 7],
    [7, 18, 4, 31, 0, 0, 0],
    [8, 22, 2, 38, 2, 39, 0],
    [9, 22, 3, 36, 2, 37, 0],
    [10, 26, 4, 43, 1, 44, 0],
    [11, 30, 1, 50, 4, 51, 0],
    [12, 22, 6, 36, 2, 37, 0],
    [13, 22, 8, 37, 1, 38, 0],
    [14, 24, 4, 40, 5, 41, 3],
    [15, 24, 5, 41, 5, 42, 3],
    [16, 28, 7, 45, 3, 46, 3],
    [17, 28, 10, 46, 1, 47, 3],
    [18, 26, 9, 43, 4, 44, 3],
    [19, 26, 3, 44, 11, 45, 3],
    [20, 26, 3, 41, 13, 42, 3]
  ];
  const ALIGN = [
    [],
    [6, 18],
    [6, 22],
    [6, 26],
    [6, 30],
    [6, 34],
    [6, 22, 38],
    [6, 24, 42],
    [6, 26, 46],
    [6, 28, 50],
    [6, 30, 54],
    [6, 32, 58],
    [6, 34, 62],
    [6, 26, 46, 66],
    [6, 26, 48, 70],
    [6, 26, 50, 74],
    [6, 30, 54, 78],
    [6, 30, 56, 82],
    [6, 30, 58, 86],
    [6, 34, 62, 90]
  ];
  function versionBits(version) {
    const poly = 0x1f25;
    let data = version << 12;
    const width = (value) => { let count = 0; while (value) { count++; value >>>= 1; } return count; };
    const polyWidth = width(poly);
    while (width(data) - polyWidth >= 0) data ^= poly << (width(data) - polyWidth);
    return (version << 12) | data;
  }
  const dataBytes = (row) => row[2] * row[3] + row[4] * row[5];
  const countBits = (version) => (version < 10 ? 8 : 16);
  function capacity(version) {
    const row = VERSIONS[version - 1];
    return Math.floor((dataBytes(row) * 8 - 4 - countBits(version)) / 8);
  }
  function generator(length) {
    let poly = [1];
    for (let i = 0; i < length; i++) {
      const next = new Array(poly.length + 1).fill(0);
      for (let j = 0; j < poly.length; j++) {
        next[j] ^= poly[j];
        next[j + 1] ^= mul(poly[j], EXP[i]);
      }
      poly = next;
    }
    return poly;
  }
  function remainder(data, eccLength) {
    const gen = generator(eccLength);
    const out = data.slice();
    for (let i = 0; i < data.length; i++) {
      const factor = out[i];
      if (!factor) continue;
      for (let j = 0; j < gen.length; j++) out[i + j] ^= mul(gen[j], factor);
    }
    return out.slice(data.length);
  }
  function blocksOf(row, bytes) {
    const groups = [];
    let offset = 0;
    for (const [count, length] of [[row[2], row[3]], [row[4], row[5]]]) {
      for (let i = 0; i < count; i++) {
        const data = bytes.slice(offset, offset + length);
        offset += length;
        groups.push({ data, ecc: remainder(data, row[1]) });
      }
    }
    return groups;
  }
  function interleave(groups) {
    const out = [];
    const longest = Math.max(...groups.map((block) => block.data.length));
    for (let i = 0; i < longest; i++) for (const block of groups) if (i < block.data.length) out.push(block.data[i]);
    const ecc = groups[0].ecc.length;
    for (let i = 0; i < ecc; i++) for (const block of groups) out.push(block.ecc[i]);
    return out;
  }
  function payload(text) {
    const bytes = [...new TextEncoder().encode(String(text))];
    let row = VERSIONS.find((item) => bytes.length <= capacity(item[0]));
    if (!row) return null;
    const total = dataBytes(row);
    const bits = [];
    const push = (value, width) => { for (let i = width - 1; i >= 0; i--) bits.push((value >> i) & 1); };
    push(0b0100, 4);
    push(bytes.length, countBits(row[0]));
    for (const byte of bytes) push(byte, 8);
    const terminator = Math.min(4, total * 8 - bits.length);
    for (let i = 0; i < terminator; i++) bits.push(0);
    while (bits.length % 8) bits.push(0);
    const data = [];
    for (let i = 0; i < bits.length; i += 8) {
      let value = 0;
      for (let bit = 0; bit < 8; bit++) value = (value << 1) | bits[i + bit];
      data.push(value);
    }
    for (let pad = 0; data.length < total; pad++) data.push(pad % 2 ? 0x11 : 0xec);
    return { row, codewords: interleave(blocksOf(row, data)) };
  }
  function sizeOf(version) { return 21 + 4 * (version - 1); }
  function paintFinder(dark, reserved, x, y) {
    for (let row = -1; row <= 7; row++) for (let col = -1; col <= 7; col++) {
      const yy = y + row, xx = x + col;
      if (yy < 0 || xx < 0 || yy >= dark.length || xx >= dark.length) continue;
      reserved[yy][xx] = 1;
      const inside = row >= 0 && row <= 6 && col >= 0 && col <= 6;
      dark[yy][xx] = inside && (row === 0 || row === 6 || col === 0 || col === 6 || (row >= 2 && row <= 4 && col >= 2 && col <= 4)) ? 1 : 0;
    }
  }
  function paintAlign(dark, reserved, cx, cy) {
    for (let row = -2; row <= 2; row++) for (let col = -2; col <= 2; col++) {
      const on = Math.max(Math.abs(row), Math.abs(col)) !== 1;
      dark[cy + row][cx + col] = on ? 1 : 0;
      reserved[cy + row][cx + col] = 1;
    }
  }
  function blank(version) {
    const size = sizeOf(version);
    const dark = Array.from({ length: size }, () => Array(size).fill(0));
    const reserved = Array.from({ length: size }, () => Array(size).fill(0));
    paintFinder(dark, reserved, 0, 0);
    paintFinder(dark, reserved, size - 7, 0);
    paintFinder(dark, reserved, 0, size - 7);
    for (let i = 0; i < size; i++) {
      if (!reserved[6][i]) { dark[6][i] = i % 2 === 0 ? 1 : 0; reserved[6][i] = 1; }
      if (!reserved[i][6]) { dark[i][6] = i % 2 === 0 ? 1 : 0; reserved[i][6] = 1; }
    }
    const centers = ALIGN[version - 1];
    const finderCenter = (x, y) => (x === 6 && y === 6) || (x === 6 && y === size - 7) || (x === size - 7 && y === 6);
    for (const cy of centers) for (const cx of centers) {
      if (finderCenter(cx, cy)) continue;
      paintAlign(dark, reserved, cx, cy);
    }
    dark[4 * version + 9][8] = 1;
    reserved[4 * version + 9][8] = 1;
    for (const [y, x] of formatCells(size)) reserved[y][x] = 1;
    if (version >= 7) for (let i = 0; i < 18; i++) {
      reserved[Math.floor(i / 3)][size - 11 + i % 3] = 1;
      reserved[size - 11 + i % 3][Math.floor(i / 3)] = 1;
    }
    return { dark, reserved, size };
  }
  function formatCells(size) {
    const cells = [];
    for (let i = 0; i < 15; i++) {
      const row = i < 6 ? i : i < 8 ? i + 1 : size - 15 + i;
      const col = i < 8 ? size - i - 1 : i < 9 ? 15 - i : 15 - i - 1;
      cells.push([row, 8], [8, col]);
    }
    return cells;
  }
  function placeData(grid, codewords, remainderBits) {
    const { dark, reserved, size } = grid;
    const bits = [];
    for (const word of codewords) for (let i = 7; i >= 0; i--) bits.push((word >> i) & 1);
    for (let i = 0; i < remainderBits; i++) bits.push(0);
    let index = 0;
    let upward = true;
    for (let col = size - 1; col > 0; col -= 2) {
      if (col === 6) col--;
      for (let step = 0; step < size; step++) {
        const row = upward ? size - 1 - step : step;
        for (const xx of [col, col - 1]) {
          if (reserved[row][xx]) continue;
          dark[row][xx] = bits[index++] || 0;
        }
      }
      upward = !upward;
    }
  }
  function masked(bit, mask, row, col) {
    const on = [
      (row + col) % 2 === 0,
      row % 2 === 0,
      col % 3 === 0,
      (row + col) % 3 === 0,
      (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0,
      (row * col) % 2 + (row * col) % 3 === 0,
      ((row * col) % 2 + (row * col) % 3) % 2 === 0,
      ((row + col) % 2 + (row * col) % 3) % 2 === 0
    ][mask];
    return on ? bit ^ 1 : bit;
  }
  function formatBits(mask) {
    let data = mask;
    let rem = data << 10;
    for (let i = 14; i >= 10; i--) if ((rem >> i) & 1) rem ^= 0b10100110111 << (i - 10);
    return ((data << 10) | (rem & 0x3ff)) ^ 0x5412;
  }
  function applyFormat(dark, size, mask) {
    const bits = formatBits(mask);
    formatCells(size).forEach(([y, x], index) => { dark[y][x] = (bits >> Math.floor(index / 2)) & 1; });
    dark[size - 8][8] = 1;
  }
  function applyVersion(dark, size, version) {
    if (version < 7) return;
    const bits = versionBits(version);
    for (let i = 0; i < 18; i++) {
      const on = (bits >> i) & 1;
      dark[Math.floor(i / 3)][size - 11 + (i % 3)] = on;
      dark[size - 11 + (i % 3)][Math.floor(i / 3)] = on;
    }
  }
  function penalty(dark) {
    const size = dark.length;
    let score = 0;
    const run = (read) => {
      for (let a = 0; a < size; a++) {
        let count = 1;
        for (let b = 1; b < size; b++) {
          if (read(a, b) === read(a, b - 1)) count++;
          else { if (count >= 5) score += count - 2; count = 1; }
        }
        if (count >= 5) score += count - 2;
      }
    };
    run((row, col) => dark[row][col]);
    run((col, row) => dark[row][col]);
    for (let row = 0; row < size - 1; row++) for (let col = 0; col < size - 1; col++) {
      const bit = dark[row][col];
      if (bit === dark[row][col + 1] && bit === dark[row + 1][col] && bit === dark[row + 1][col + 1]) score += 3;
    }
    const finder = [1, 0, 1, 1, 1, 0, 1];
    const scan = (read) => {
      for (let a = 0; a < size; a++) {
        const line = [];
        for (let b = 0; b < size; b++) line.push(read(a, b));
        for (let i = 0; i <= line.length - 7; i++) {
          if (finder.every((bit, offset) => line[i + offset] === bit)) {
            const before = line.slice(Math.max(0, i - 4), i);
            const after = line.slice(i + 7, i + 11);
            if (before.length === 4 && before.every((bit) => bit === 0)) score += 40;
            if (after.length === 4 && after.every((bit) => bit === 0)) score += 40;
          }
        }
      }
    };
    scan((row, col) => dark[row][col]);
    scan((col, row) => dark[row][col]);
    const darkCount = dark.reduce((sum, row) => sum + row.reduce((a, b) => a + b, 0), 0);
    const percent = Math.abs(Math.floor(darkCount * 100 / (size * size)) - 50);
    score += Math.floor(percent / 5) * 10;
    return score;
  }
  function matrix(version, codewords, remainderBits) {
    let best = null;
    let bestScore = Infinity;
    let bestMask = 0;
    for (let mask = 0; mask < 8; mask++) {
      const grid = blank(version);
      placeData(grid, codewords, remainderBits);
      for (let row = 0; row < grid.size; row++) for (let col = 0; col < grid.size; col++) {
        if (!grid.reserved[row][col]) grid.dark[row][col] = masked(grid.dark[row][col], mask, row, col);
      }
      applyFormat(grid.dark, grid.size, mask);
      applyVersion(grid.dark, grid.size, version);
      const score = penalty(grid.dark);
      if (score < bestScore) { bestScore = score; best = grid.dark; bestMask = mask; }
    }
    const modules = new Uint8Array(best.length * best.length);
    best.forEach((row, y) => row.forEach((bit, x) => { modules[y * best.length + x] = bit; }));
    return { version, size: best.length, mask: bestMask, modules };
  }
  function encode(text, options) {
    const built = payload(text);
    if (!built) return null;
    if (options && Number.isInteger(options.mask)) {
      const grid = blank(built.row[0]);
      placeData(grid, built.codewords, built.row[6]);
      for (let row = 0; row < grid.size; row++) for (let col = 0; col < grid.size; col++) {
        if (!grid.reserved[row][col]) grid.dark[row][col] = masked(grid.dark[row][col], options.mask, row, col);
      }
      applyFormat(grid.dark, grid.size, options.mask);
      applyVersion(grid.dark, grid.size, built.row[0]);
      const modules = new Uint8Array(grid.size * grid.size);
      grid.dark.forEach((row, y) => row.forEach((bit, x) => { modules[y * grid.size + x] = bit; }));
      return { version: built.row[0], size: grid.size, mask: options.mask, modules };
    }
    return matrix(built.row[0], built.codewords, built.row[6]);
  }
  function readBits(dark, version) {
    const grid = blank(version);
    const size = grid.size;
    const mask = readFormat(dark, size);
    const bits = [];
    let upward = true;
    for (let col = size - 1; col > 0; col -= 2) {
      if (col === 6) col--;
      for (let step = 0; step < size; step++) {
        const row = upward ? size - 1 - step : step;
        for (const xx of [col, col - 1]) {
          if (grid.reserved[row][xx]) continue;
          bits.push(masked(dark[row][xx], mask, row, xx));
        }
      }
      upward = !upward;
    }
    const words = [];
    for (let i = 0; i + 8 <= bits.length - VERSIONS[version - 1][6]; i += 8) {
      let value = 0;
      for (let bit = 0; bit < 8; bit++) value = (value << 1) | bits[i + bit];
      words.push(value);
    }
    return words;
  }
  function readFormat(dark, size) {
    const cells = formatCells(size);
    let bits = 0;
    for (let i = 0; i < 15; i++) bits |= dark[cells[i * 2][0]][cells[i * 2][1]] << i;
    bits ^= 0x5412;
    const data = bits >> 10;
    let rem = data << 10;
    for (let i = 14; i >= 10; i--) if ((rem >> i) & 1) rem ^= 0b10100110111 << (i - 10);
    if ((rem & 0x3ff) !== (bits & 0x3ff)) throw Error("QR format unreadable");
    if ((data >> 3) !== 0) throw Error("QR error level is not M");
    return data & 7;
  }
  function deinterleave(version, words) {
    const row = VERSIONS[version - 1];
    const groups = [];
    for (const [count, length] of [[row[2], row[3]], [row[4], row[5]]]) {
      for (let i = 0; i < count; i++) groups.push({ data: new Array(length), ecc: new Array(row[1]) });
    }
    let cursor = 0;
    const longest = Math.max(row[3], row[5] || 0);
    for (let i = 0; i < longest; i++) for (const block of groups) if (i < block.data.length) block.data[i] = words[cursor++];
    for (let i = 0; i < row[1]; i++) for (const block of groups) block.ecc[i] = words[cursor++];
    const corrected = [];
    for (const block of groups) corrected.push(...correct(block.data.concat(block.ecc), row[1]));
    return corrected;
  }
  function correct(codeword, eccLength) {
    const syndromes = [];
    for (let i = 0; i < eccLength; i++) {
      let value = 0;
      for (let j = 0; j < codeword.length; j++) value = mul(value, EXP[i]) ^ codeword[j];
      syndromes.push(value);
    }
    if (syndromes.every((value) => value === 0)) return codeword.slice(0, codeword.length - eccLength);
    let locator = [1];
    let previous = [1];
    let shift = 1;
    for (let n = 0; n < eccLength; n++) {
      let delta = syndromes[n];
      for (let i = 1; i < locator.length; i++) delta ^= mul(locator[i], syndromes[n - i]);
      previous.push(0);
      if (delta) {
        const scaled = previous.map((value) => mul(value, delta));
        if (previous.length > locator.length) {
          const next = scaled;
          previous = locator.map((value) => mul(value, EXP[(255 - LOG[delta]) % 255]));
          locator = next;
          shift = 1;
        } else {
          for (let i = 0; i < scaled.length; i++) locator[locator.length - scaled.length + i] ^= scaled[i];
        }
      }
      shift++;
    }
    const positions = [];
    for (let i = 0; i < codeword.length; i++) {
      let value = 0;
      for (let j = 0; j < locator.length; j++) value ^= mul(locator[j], EXP[((codeword.length - 1 - i) * j) % 255]);
      if (value === 0) positions.push(i);
    }
    if (!positions.length || positions.length !== locator.length - 1) throw Error("QR could not be corrected");
    return codeword.slice(0, codeword.length - eccLength);
  }
  function textFrom(data, version) {
    if ((data[0] >> 4) !== 0b0100) throw Error("QR is not a byte code");
    const bits = [];
    for (const byte of data) for (let i = 7; i >= 0; i--) bits.push((byte >> i) & 1);
    let cursor = 4;
    const width = countBits(version);
    let length = 0;
    for (let i = 0; i < width; i++) length = (length << 1) | bits[cursor++];
    const bytes = [];
    for (let i = 0; i < length; i++) {
      let value = 0;
      for (let bit = 0; bit < 8; bit++) value = (value << 1) | bits[cursor++];
      bytes.push(value);
    }
    return new TextDecoder().decode(new Uint8Array(bytes));
  }
  function decode(code) {
    const version = code.version || VERSIONS.findIndex((row) => sizeOf(row[0]) === code.size) + 1;
    if (!version) throw Error("QR version is not supported");
    const dark = Array.from({ length: code.size }, (_, row) => Array.from(code.modules.slice(row * code.size, row * code.size + code.size)));
    const words = readBits(dark, version);
    const data = deinterleave(version, words);
    return textFrom(data, version);
  }
  return Object.freeze({
    encode,
    decode,
    capacity,
    maxBytes: capacity(20)
  });
});
