export type Uleb128Result = {
  value: number;
  nextOffset: number;
};

export function readUleb128(bytes: Uint8Array, offset: number): Uleb128Result {
  let result = 0;
  let cur = offset;
  let count = 0;
  let shift = 0;

  while (true) {
    if (cur >= bytes.length) {
      throw new RangeError("ULEB128 out of range");
    }

    const b = bytes[cur++];
    result |= (b & 0x7f) << shift;

    count++;
    if (count > 5) {
      throw new Error("ULEB128 too large");
    }

    if ((b & 0x80) === 0) {
      break;
    }

    shift += 7;
  }

  return { value: result >>> 0, nextOffset: cur };
}
