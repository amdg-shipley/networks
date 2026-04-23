// Binary / Hex / ASCII encoding utilities

/**
 * Convert a single character to 8-bit binary string.
 * @param {string} char
 * @returns {string}  e.g. "01001000"
 */
export function charToBinary(char) {
  return char.charCodeAt(0).toString(2).padStart(8, '0');
}

/**
 * Convert a string to an array of 8-bit binary strings.
 * @param {string} str
 * @returns {string[]}
 */
export function stringToBinary(str) {
  return Array.from(str).map(charToBinary);
}

/**
 * Convert a string to an array of individual bits (0s and 1s as strings).
 * @param {string} str
 * @returns {string[]}
 */
export function stringToBits(str) {
  return stringToBinary(str).join('').split('');
}

/**
 * Reassemble a bit array back into a string.
 * Ignores trailing incomplete bytes.
 * @param {string[]} bits
 * @returns {string}
 */
export function bitsToString(bits) {
  const result = [];
  for (let i = 0; i + 7 < bits.length; i += 8) {
    const byte = bits.slice(i, i + 8).join('');
    result.push(String.fromCharCode(parseInt(byte, 2)));
  }
  return result.join('');
}

/**
 * Convert a single character to hex string (e.g. "48").
 * @param {string} char
 * @returns {string}
 */
export function charToHex(char) {
  return char.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0');
}

/**
 * Convert a string to an array of hex strings.
 * @param {string} str
 * @returns {string[]}  e.g. ["48","65","6C","6C","6F"]
 */
export function stringToHex(str) {
  return Array.from(str).map(charToHex);
}

/**
 * Convert space-separated or plain hex string to ASCII.
 * @param {string} hexStr  e.g. "48 65 6C 6C 6F" or "48656C6C6F"
 * @returns {string}
 */
export function hexToString(hexStr) {
  const tokens = hexStr.trim().split(/\s+/).join('').match(/.{1,2}/g) || [];
  return tokens.map(h => String.fromCharCode(parseInt(h, 16))).join('');
}

/**
 * Build a conversion table row for a character.
 * @param {string} char
 * @returns {{ char, decimal, binary, hex }}
 */
export function charTable(char) {
  const code = char.charCodeAt(0);
  return {
    char:    char === ' ' ? '(space)' : char,
    decimal: code,
    binary:  code.toString(2).padStart(8, '0'),
    hex:     code.toString(16).toUpperCase().padStart(2, '0'),
  };
}

/**
 * Build the full printable ASCII table (codes 32–126).
 * @returns {Array<{char, decimal, binary, hex}>}
 */
export function fullASCIITable() {
  const rows = [];
  for (let i = 32; i <= 126; i++) {
    rows.push(charTable(String.fromCharCode(i)));
  }
  return rows;
}

/**
 * Split a binary string into chunks of given size.
 * Returns { chunks: string[], truncated: boolean }
 */
export function chunkBinary(binaryStr, chunkSize) {
  const chunks = [];
  for (let i = 0; i < binaryStr.length; i += chunkSize) {
    chunks.push(binaryStr.slice(i, i + chunkSize));
  }
  const lastChunk = chunks[chunks.length - 1];
  const truncated = lastChunk && lastChunk.length < chunkSize;
  return { chunks, truncated };
}

/**
 * 7-bit ASCII encoding (strips high bit).
 * @param {string} char
 * @returns {string}  7-char binary string
 */
export function charTo7BitASCII(char) {
  return (char.charCodeAt(0) & 0x7F).toString(2).padStart(7, '0');
}
