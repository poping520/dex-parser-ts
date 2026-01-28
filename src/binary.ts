export class ByteReader {
  public readonly bytes: Uint8Array;
  private readonly view: DataView;

  constructor(bytes: Uint8Array) {
    this.bytes = bytes;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  u1(off: number): number {
    return this.view.getUint8(off);
  }

  u2(off: number): number {
    return this.view.getUint16(off, true);
  }

  u4(off: number): number {
    return this.view.getUint32(off, true);
  }

  slice(off: number, len: number): Uint8Array {
    return this.bytes.subarray(off, off + len);
  }

  indexOfZero(off: number): number {
    for (let i = off; i < this.bytes.length; i++) {
      if (this.bytes[i] === 0) return i;
    }
    return -1;
  }
}
