/** Small, data-only avatars: no remote URLs or executable image payloads in keys. */
export interface CryptAvatar { version: 1; pixels: string }
export const AVATAR_SIZE = 8;
export const AVATAR_COLORS = 16;

export function parseAvatar(raw: unknown): CryptAvatar | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const value = raw as Record<string, unknown>;
  return value.version === 1 && typeof value.pixels === 'string' && /^[0-9a-f]{64}$/.test(value.pixels)
    ? { version: 1, pixels: value.pixels } : undefined;
}

export function accountAvatar(account: string): CryptAvatar {
  let seed = 2166136261;
  for (const ch of account) seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619) >>> 0;
  const color = (1 + seed % 15).toString(16);
  const rows: string[] = [];
  for (let y = 0; y < 8; y++) {
    const half: string[] = [];
    for (let x = 0; x < 4; x++) {
      seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
      half.push((seed >>> 0) % 2 ? color : '0');
    }
    rows.push([...half, ...half.slice().reverse()].join(''));
  }
  return { version: 1, pixels: rows.join('') };
}

/** Quantize canvas RGBA to the same palette used by the painter. */
export function quantizeAvatar(data: ArrayLike<number>, palette: number[][]): CryptAvatar {
  if (data.length !== 256 || palette.length !== AVATAR_COLORS) throw new Error('Invalid avatar image');
  let pixels = '';
  for (let i = 0; i < 64; i++) {
    if (data[i * 4 + 3] < 128) { pixels += '0'; continue; }
    let nearest = 1, distance = Infinity;
    for (let c = 1; c < palette.length; c++) {
      const d = palette[c].reduce((sum, value, channel) => sum + (value - data[i * 4 + channel]) ** 2, 0);
      if (d < distance) { nearest = c; distance = d; }
    }
    pixels += nearest.toString(16);
  }
  return { version: 1, pixels };
}