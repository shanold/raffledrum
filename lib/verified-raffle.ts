export type VerifiedTicket = { name: string; number: number };
export const VERIFIED_MAX_TICKETS = 100000;

function parsePositiveInteger(value: string) {
  const text = value.trim();
  if (!/^\d+$/.test(text) && !/^\d{1,3}(,\d{3})+$/.test(text)) return null;
  const number = Number(text.replaceAll(",", ""));
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

export function expandVerifiedEntries(value: string, firstTicketText: string) {
  const firstTicket = parsePositiveInteger(firstTicketText);
  if (!firstTicket)
    return {
      tickets: [] as VerifiedTicket[],
      error: "Enter a valid first automatic ticket number.",
    };
  const specs: { name: string; count: number; start?: number; end?: number }[] =
    [];
  for (const raw of value.split(/\r?\n/)) {
    const entry = raw.trim();
    if (!entry) continue;
    const manual = entry.match(/^(.+?)\s+#\s*([\d,]+)\s*[-–]\s*([\d,]+)$/);
    const weighted = entry.match(/^(.+?)\s+[×x]\s*([\d,]+)$/i);
    if (manual) {
      const start = parsePositiveInteger(manual[2]),
        end = parsePositiveInteger(manual[3]);
      if (!start || !end || end < start)
        return {
          tickets: [] as VerifiedTicket[],
          error: `“${entry}” has an invalid ticket range.`,
        };
      specs.push({
        name: manual[1].trim(),
        count: end - start + 1,
        start,
        end,
      });
    } else if (weighted) {
      const count = parsePositiveInteger(weighted[2]);
      if (!count)
        return {
          tickets: [] as VerifiedTicket[],
          error: `“${weighted[2]}” is not a valid ticket count.`,
        };
      specs.push({ name: weighted[1].trim(), count });
    } else if (/\s[×x]\s|\s#\s/.test(entry)) {
      return {
        tickets: [] as VerifiedTicket[],
        error: `“${entry}” is not formatted correctly.`,
      };
    } else specs.push({ name: entry, count: 1 });
  }
  const total = specs.reduce((sum, s) => sum + s.count, 0);
  if (!total)
    return {
      tickets: [] as VerifiedTicket[],
      error: "Add at least one ticket first.",
    };
  if (total > VERIFIED_MAX_TICKETS)
    return {
      tickets: [] as VerifiedTicket[],
      error: `Verified drawings currently support up to ${VERIFIED_MAX_TICKETS.toLocaleString()} tickets.`,
    };
  const tickets: VerifiedTicket[] = [],
    used = new Set<number>();
  for (const spec of specs.filter((s) => s.start !== undefined)) {
    for (let number = spec.start!; number <= spec.end!; number++) {
      if (used.has(number))
        return {
          tickets: [] as VerifiedTicket[],
          error: `Ticket #${number.toLocaleString()} is assigned more than once.`,
        };
      used.add(number);
      tickets.push({ name: spec.name, number });
    }
  }
  let next = firstTicket;
  for (const spec of specs.filter((s) => s.start === undefined)) {
    for (let i = 0; i < spec.count; i++) {
      while (used.has(next)) next++;
      used.add(next);
      tickets.push({ name: spec.name, number: next++ });
    }
  }
  return { tickets, error: null };
}

export function maskName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  return [
    parts[0],
    ...parts
      .slice(1)
      .map((part) => part[0]?.toUpperCase())
      .filter(Boolean),
  ].join(" ");
}

export async function sha256Hex(value: string | Uint8Array) {
  const bytes =
    typeof value === "string" ? new TextEncoder().encode(value) : value;
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest(
      "SHA-256",
      new Uint8Array(bytes).buffer,
    );
    return [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }
  return sha256Fallback(bytes);
}

function sha256Fallback(bytes: Uint8Array) {
  const constants = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
      0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
      0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
      0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
      0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
      0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
      0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
      0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
      0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
    ],
    words = new Uint32Array(64),
    bitLength = bytes.length * 8,
    paddedLength = Math.ceil((bytes.length + 9) / 64) * 64,
    padded = new Uint8Array(paddedLength),
    view = new DataView(padded.buffer);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000));
  view.setUint32(paddedLength - 4, bitLength >>> 0);
  const hash = new Uint32Array([
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
      0x1f83d9ab, 0x5be0cd19,
    ]),
    rotate = (number: number, bits: number) =>
      (number >>> bits) | (number << (32 - bits));
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index++)
      words[index] = view.getUint32(offset + index * 4);
    for (let index = 16; index < 64; index++) {
      const a = words[index - 15],
        b = words[index - 2],
        s0 = rotate(a, 7) ^ rotate(a, 18) ^ (a >>> 3),
        s1 = rotate(b, 17) ^ rotate(b, 19) ^ (b >>> 10);
      words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index++) {
      const s1 = rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25),
        choice = (e & f) ^ (~e & g),
        temp1 = (h + s1 + choice + constants[index] + words[index]) >>> 0,
        s0 = rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22),
        majority = (a & b) ^ (a & c) ^ (b & c),
        temp2 = (s0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    [a, b, c, d, e, f, g, h].forEach(
      (part, index) => (hash[index] = (hash[index] + part) >>> 0),
    );
  }
  return [...hash].map((part) => part.toString(16).padStart(8, "0")).join("");
}

export async function manifestHash(tickets: VerifiedTicket[]) {
  return sha256Hex(
    tickets
      .map((ticket) => `${ticket.number}\t${ticket.name.normalize("NFC")}\n`)
      .join(""),
  );
}

export function randomToken(bytes = 24) {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return btoa(String.fromCharCode(...value))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

export async function deterministicIndex(
  manifest: string,
  round: number,
  randomness: string,
  count: number,
) {
  for (let counter = 0; ; counter++) {
    const hex = await sha256Hex(
      `raffle-drum-v1|${manifest}|${round}|${randomness}|${counter}`,
    );
    const value = Number.parseInt(hex.slice(0, 12), 16),
      range = 281474976710656,
      limit = range - (range % count);
    if (value < limit) return value % count;
  }
}

export function hexToBytes(hex: string) {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2)
    throw new Error("Invalid hexadecimal value.");
  return new Uint8Array(
    hex.match(/../g)!.map((part) => Number.parseInt(part, 16)),
  );
}
