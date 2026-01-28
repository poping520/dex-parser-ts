import { ByteReader } from "./binary";
import { readUleb128 } from "./leb128";

export type DexHeader = {
  magic: string;
  checksum: number;
  fileSize: number;
  headerSize: number;
  endianTag: number;
  linkSize: number;
  linkOff: number;
  mapOff: number;
  stringIdsSize: number;
  stringIdsOff: number;
  typeIdsSize: number;
  typeIdsOff: number;
  protoIdsSize: number;
  protoIdsOff: number;
  fieldIdsSize: number;
  fieldIdsOff: number;
  methodIdsSize: number;
  methodIdsOff: number;
  classDefsSize: number;
  classDefsOff: number;
  dataSize: number;
  dataOff: number;
};

export type DexClassDef = {
  classIdx: number;
  accessFlags: number;
  superclassIdx: number;
  interfacesOff: number;
  sourceFileIdx: number;
  annotationsOff: number;
  classDataOff: number;
  staticValuesOff: number;
};

export class DexFile {
  public readonly reader: ByteReader;
  public readonly header: DexHeader;

  private stringCache = new Map<number, string>();

  constructor(bytes: Uint8Array) {
    this.reader = new ByteReader(bytes);
    this.header = this.parseHeader();

    if (!this.hasValidMagic(this.header.magic)) {
      throw new Error(`Invalid DEX magic: ${this.header.magic}`);
    }

    if (this.header.fileSize !== bytes.length) {
      // keep behavior close to libdex (it errors unless continue-on-error),
      // but for now throw to keep the TS library strict.
      throw new Error(
        `DEX fileSize mismatch: header=${this.header.fileSize} actual=${bytes.length}`
      );
    }
  }

  static from(bytes: Uint8Array): DexFile {
    return new DexFile(bytes);
  }

  private hasValidMagic(magic: string): boolean {
    // "dex\n035\0" etc
    return /^dex\n\d{3}\0$/.test(magic);
  }

  private parseHeader(): DexHeader {
    const r = this.reader;

    const magicBytes = r.slice(0, 8);
    const magic = new TextDecoder("ascii").decode(magicBytes);

    const checksum = r.u4(8);
    // signature at 12..31 (ignored for now)

    const fileSize = r.u4(32);
    const headerSize = r.u4(36);
    const endianTag = r.u4(40);
    const linkSize = r.u4(44);
    const linkOff = r.u4(48);
    const mapOff = r.u4(52);
    const stringIdsSize = r.u4(56);
    const stringIdsOff = r.u4(60);
    const typeIdsSize = r.u4(64);
    const typeIdsOff = r.u4(68);
    const protoIdsSize = r.u4(72);
    const protoIdsOff = r.u4(76);
    const fieldIdsSize = r.u4(80);
    const fieldIdsOff = r.u4(84);
    const methodIdsSize = r.u4(88);
    const methodIdsOff = r.u4(92);
    const classDefsSize = r.u4(96);
    const classDefsOff = r.u4(100);
    const dataSize = r.u4(104);
    const dataOff = r.u4(108);

    return {
      magic,
      checksum,
      fileSize,
      headerSize,
      endianTag,
      linkSize,
      linkOff,
      mapOff,
      stringIdsSize,
      stringIdsOff,
      typeIdsSize,
      typeIdsOff,
      protoIdsSize,
      protoIdsOff,
      fieldIdsSize,
      fieldIdsOff,
      methodIdsSize,
      methodIdsOff,
      classDefsSize,
      classDefsOff,
      dataSize,
      dataOff,
    };
  }

  getStringIdOffset(stringIdx: number): number {
    if (stringIdx < 0 || stringIdx >= this.header.stringIdsSize) {
      throw new RangeError(`stringIdx out of range: ${stringIdx}`);
    }
    return this.header.stringIdsOff + stringIdx * 4;
  }

  getStringDataOffset(stringIdx: number): number {
    const off = this.getStringIdOffset(stringIdx);
    return this.reader.u4(off);
  }

  getStringById(stringIdx: number): string {
    const cached = this.stringCache.get(stringIdx);
    if (cached !== undefined) return cached;

    const dataOff = this.getStringDataOffset(stringIdx);
    // string_data_item: uleb128 utf16_size + MUTF-8 bytes + '\0'
    const { nextOffset } = readUleb128(this.reader.bytes, dataOff);
    const end = this.reader.indexOfZero(nextOffset);
    if (end < 0) {
      throw new Error(`Unterminated string_data_item at offset ${dataOff}`);
    }

    // NOTE: DEX uses MUTF-8. For common ASCII / UTF-8 it works; for edge cases
    // (U+0000 and some surrogate handling) this may differ.
    const raw = this.reader.slice(nextOffset, end - nextOffset);
    const str = new TextDecoder("utf-8").decode(raw);

    this.stringCache.set(stringIdx, str);
    return str;
  }

  getTypeDescriptorByIdx(typeIdx: number): string {
    if (typeIdx < 0 || typeIdx >= this.header.typeIdsSize) {
      throw new RangeError(`typeIdx out of range: ${typeIdx}`);
    }

    const off = this.header.typeIdsOff + typeIdx * 4;
    const descriptorIdx = this.reader.u4(off);
    return this.getStringById(descriptorIdx);
  }

  getMethodId(methodIdx: number): { classIdx: number; protoIdx: number; nameIdx: number } {
    if (methodIdx < 0 || methodIdx >= this.header.methodIdsSize) {
      throw new RangeError(`methodIdx out of range: ${methodIdx}`);
    }

    const off = this.header.methodIdsOff + methodIdx * 8;
    const classIdx = this.reader.u2(off);
    const protoIdx = this.reader.u2(off + 2);
    const nameIdx = this.reader.u4(off + 4);
    return { classIdx, protoIdx, nameIdx };
  }

  getFieldId(fieldIdx: number): { classIdx: number; typeIdx: number; nameIdx: number } {
    if (fieldIdx < 0 || fieldIdx >= this.header.fieldIdsSize) {
      throw new RangeError(`fieldIdx out of range: ${fieldIdx}`);
    }

    const off = this.header.fieldIdsOff + fieldIdx * 8;
    const classIdx = this.reader.u2(off);
    const typeIdx = this.reader.u2(off + 2);
    const nameIdx = this.reader.u4(off + 4);
    return { classIdx, typeIdx, nameIdx };
  }

  getProtoId(protoIdx: number): { shortyIdx: number; returnTypeIdx: number; parametersOff: number } {
    if (protoIdx < 0 || protoIdx >= this.header.protoIdsSize) {
      throw new RangeError(`protoIdx out of range: ${protoIdx}`);
    }

    const off = this.header.protoIdsOff + protoIdx * 12;
    const shortyIdx = this.reader.u4(off);
    const returnTypeIdx = this.reader.u4(off + 4);
    const parametersOff = this.reader.u4(off + 8);
    return { shortyIdx, returnTypeIdx, parametersOff };
  }

  getClassDef(classDefIdx: number): DexClassDef {
    if (classDefIdx < 0 || classDefIdx >= this.header.classDefsSize) {
      throw new RangeError(`classDefIdx out of range: ${classDefIdx}`);
    }

    const off = this.header.classDefsOff + classDefIdx * 32;
    return {
      classIdx: this.reader.u4(off),
      accessFlags: this.reader.u4(off + 4),
      superclassIdx: this.reader.u4(off + 8),
      interfacesOff: this.reader.u4(off + 12),
      sourceFileIdx: this.reader.u4(off + 16),
      annotationsOff: this.reader.u4(off + 20),
      classDataOff: this.reader.u4(off + 24),
      staticValuesOff: this.reader.u4(off + 28),
    };
  }

  getClassDescriptorByClassDefIdx(classDefIdx: number): string {
    const def = this.getClassDef(classDefIdx);
    return this.getTypeDescriptorByIdx(def.classIdx);
  }
}
