import { DexUtils } from "./utils";

const kSHA1DigestLen = 20;

// https://android.googlesource.com/platform/dalvik/+/refs/tags/android-4.4.4_r2.0.1/libdex/DexFile.h#216
export interface DexHeader {
    magic: string;         /* u1[8], includes version number */
    checksum: number;      /* u4, adler32 checksum */
    signature: Uint8Array; /* u1[20], SHA-1 hash */
    fileSize: number;      /* u4, length of entire file */
    headerSize: number;    /* u4, offset to start of next section */
    endianTag: number;     /* u4, endianness tag */
    linkSize: number;      /* u4, size of link section */
    linkOff: number;       /* u4, file offset of link section */
    mapOff: number;        /* u4, file offset of map section */
    stringIdsSize: number; /* u4, size of stringIds section */
    stringIdsOff: number;  /* u4, file offset of stringIds section */
    typeIdsSize: number;   /* u4, size of typeIds section */
    typeIdsOff: number;    /* u4, file offset of typeIds section */
    protoIdsSize: number;  /* u4, size of protoIds section */
    protoIdsOff: number;   /* u4, file offset of protoIds section */
    fieldIdsSize: number;  /* u4, size of fieldIds section */
    fieldIdsOff: number;   /* u4, file offset of fieldIds section */
    methodIdsSize: number;
    methodIdsOff: number;
    classDefsSize: number;
    classDefsOff: number;
    dataSize: number;
    dataOff: number;
}

export interface DexFieldId {
    classIdx: number; /* u2, index into typeIds list for defining class */
    typeIdx: number;  /* u2, index into typeIds for field type */
    nameIdx: number;  /* u4, index into stringIds for field name */
}

export interface DexMethodId {
    classIdx: number; /* u2, index into typeIds list for defining class */
    protoIdx: number; /* u2, index into protoIds for method prototype */
    nameIdx: number;  /* u4, index into stringIds for method name */
}

export interface DexProtoId {
    shortyIdx: number;     /* u4, index into stringIds for shorty descriptor */
    returnTypeIdx: number; /* u4, index into typeIds list for return type */
    parametersOff: number; /* u4, file offset to type_list for parameter types */
}

export interface DexClassDef {
    classIdx: number;        /* u4, index into typeIds for this class */
    accessFlags: number;     /* u4, access flags */
    superclassIdx: number;   /* u4, index into typeIds for superclass */
    interfacesOff: number;   /* u4, file offset to DexTypeList */
    sourceFileIdx: number;   /* u4, index into stringIds for source file name */
    annotationsOff: number;  /* u4, file offset to annotations_directory_item */
    classDataOff: number;    /* u4, file offset to class_data_item */
    staticValuesOff: number; /* u4, file offset to DexEncodedArray */
}

export interface DexTypeList {
    size: number; /* u4 #of entries in list */
    typeIdxList: number[]; /* u2[] entries */
}

export interface DexMapItem {
    type: number;      /* u2, type code (see kDexType* above) */
    unused: number;    /* u2, unused */
    size: number;      /* u4, count of items of the indicated type */
    offset: number;    /* u4, file offset to the start of data */
}

// https://android.googlesource.com/platform/dalvik/+/refs/tags/android-4.4.4_r2.0.1/libdex/DexClass.h#28

/* expanded form of a class_data_item header */
export interface DexClassDataHeader {
    staticFieldsSize: number;   // u4
    instanceFieldsSize: number; // u4
    directMethodsSize: number;  // u4
    virtualMethodsSize: number; // u4
}

/* expanded form of encoded_field */
export interface DexField {
    fieldIdx: number;    /* u4 index to a field_id_item */
    accessFlags: number; /* u4 */
}

/* expanded form of encoded_method */
export interface DexMethod {
    methodIdx: number;    /* u4 index to a method_id_item */
    accessFlags: number;  /* u4 */
    codeOff: number;      /* u4 file offset to a code_item */
}

/* expanded form of class_data_item */
export interface DexClassData {
    header: DexClassDataHeader;
    staticFields: DexField[];
    instanceFields: DexField[];
    directMethods: DexMethod[];
    virtualMethods: DexMethod[];
}

export enum DexAccessFlag {
    Public                  = 0x00000001,
    Private                 = 0x00000002,
    Protected               = 0x00000004,
    Static                  = 0x00000008,
    Final                   = 0x00000010,
    Synchronized            = 0x00000020,
    Super                   = 0x00000020,       // class (not used in Dalvik)
    Volatile                = 0x00000040,
    Bridge                  = 0x00000040,       // method (1.5)
    Transient               = 0x00000080,
    Varargs                 = 0x00000080,       // method (1.5)
    Native                  = 0x00000100,
    Interface               = 0x00000200,
    Abstract                = 0x00000400,
    Strict                  = 0x00000800,
    Synthetic               = 0x00001000,
    Annotation              = 0x00002000,
    Enum                    = 0x00004000,
    Constructor             = 0x00010000,
    DeclaredSynchronized    = 0x00020000,

    ClassMask               = (Public | Final | Interface | Abstract
        | Synthetic | Annotation | Enum),

    InnerClassMask          = (ClassMask | Private | Protected | Static),

    FieldMask               = (Public | Private | Protected | Static | Final
        | Volatile | Transient | Synthetic | Enum),

    MethodMask              = (Public | Private | Protected | Static | Final
        | Synchronized | Bridge | Varargs | Native
        | Abstract | Strict | Synthetic | Constructor
        | DeclaredSynchronized)
}

class ByteBuffer {
    public readonly bytes: Uint8Array;
    private readonly view: DataView;
    private position: number;

    constructor(bytes: Uint8Array) {
        this.bytes = bytes;
        this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        this.position = 0;
    }

    setPosition(position: number): ByteBuffer {
        if (position < 0 || position > this.bytes.length) {
            throw new RangeError(`Position out of bounds: ${position}`);
        }
        this.position = position;
        return this;
    }

    getPosition(): number {
        return this.position;
    }

    skip(len: number) {
        this.position += len;
    }

    // Sequential reading
    readU8(): number {
        const val = this.view.getUint8(this.position);
        this.position += 1;
        return val;
    }

    readU16(): number {
        const val = this.view.getUint16(this.position, true);
        this.position += 2;
        return val;
    }

    readU32(): number {
        const val = this.view.getUint32(this.position, true);
        this.position += 4;
        return val;
    }

    readULeb128(): number {
        let shift = 0;
        let result = 0;
        let tmpPos = this.position;

        while (true) {
            if (tmpPos >= this.bytes.length) {
                throw new RangeError("ULEB128 out of range");
            }

            const b = this.bytes[tmpPos++];
            result |= (b & 0x7f) << shift;

            if ((tmpPos - this.position) > 5) {
                throw new Error("ULEB128 too large");
            }

            if ((b & 0x80) === 0) {
                break;
            }

            shift += 7;
        }
        this.position = tmpPos;
        return result;
    }

    readString(len: number): string {
        const array = this.bytes.subarray(this.position, this.position + len);
        this.position += len;
        return new TextDecoder("ascii").decode(array);
    }

    readStringUtf8NextZero(): string {
        let end = this.position;
        while (end < this.bytes.length && this.bytes[end] !== 0) {
            end++;
        }
        const str = new TextDecoder("utf-8").decode(
            this.bytes.subarray(this.position, end)
        );
        this.position = end + 1;
        return str;
    }

    readBytes(len: number): Uint8Array {
        const val = this.bytes.subarray(this.position, this.position + len);
        this.position += len;
        return val;
    }

    // Random position reading
    readU32At(off: number): number {
        return this.view.getUint32(off, true);
    }

    readBytesAt(off: number, len: number): Uint8Array {
        return this.bytes.subarray(off, off + len);
    }

    readStringUtf8At(off: number, len: number): string {
        const array = this.bytes.subarray(off, off + len);
        return new TextDecoder("utf-8").decode(array);
    }
}

/**
 * DEX 文件解析器：负责解析 Header、字符串表、类型表、方法/字段/类定义等结构。
 */
export class DexFile {
    public readonly buffer: ByteBuffer;
    public readonly header: DexHeader;

    private readonly stringCache = new Map<number, string>();
    private readonly classDefIdxByDescriptorCache = new Map<string, number>();

    /**
     * 创建并解析一个 DEX 文件。
     * @param bytes DEX 文件的原始字节数组
     */
    constructor(bytes: Uint8Array) {
        this.buffer = new ByteBuffer(bytes);
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

    private parseHeader(): DexHeader {
        return {
            magic: this.buffer.readString(8),
            checksum: this.buffer.readU32(),
            signature: this.buffer.readBytes(kSHA1DigestLen),
            fileSize: this.buffer.readU32(),
            headerSize: this.buffer.readU32(),
            endianTag: this.buffer.readU32(),
            linkSize: this.buffer.readU32(),
            linkOff: this.buffer.readU32(),
            mapOff: this.buffer.readU32(),
            stringIdsSize: this.buffer.readU32(),
            stringIdsOff: this.buffer.readU32(),
            typeIdsSize: this.buffer.readU32(),
            typeIdsOff: this.buffer.readU32(),
            protoIdsSize: this.buffer.readU32(),
            protoIdsOff: this.buffer.readU32(),
            fieldIdsSize: this.buffer.readU32(),
            fieldIdsOff: this.buffer.readU32(),
            methodIdsSize: this.buffer.readU32(),
            methodIdsOff: this.buffer.readU32(),
            classDefsSize: this.buffer.readU32(),
            classDefsOff: this.buffer.readU32(),
            dataSize: this.buffer.readU32(),
            dataOff: this.buffer.readU32()
        } as DexHeader;
    }

    /**
     * 从字节数组创建 Dexfile 实例。
     */
    static from(bytes: Uint8Array): DexFile {
        return new DexFile(bytes);
    }

    private hasValidMagic(magic: string): boolean {
        // "dex\n035\0" etc
        return /^dex\n\d{3}\0$/.test(magic);
    }

    /**
     * 根据 stringIds 索引获取对应的 string_data_item 偏移。
     */
    getStringDataOffset(stringIdx: number): number {
        if (stringIdx < 0 || stringIdx >= this.header.stringIdsSize) {
            throw new RangeError(`stringIdx out of range: ${stringIdx}`);
        }
        const off = this.header.stringIdsOff + stringIdx * 4;
        return this.buffer.readU32At(off);
    }

    /**
     * 根据 stringIds 索引读取字符串（带缓存）。
     */
    getStringById(stringIdx: number): string {
        const cached = this.stringCache.get(stringIdx);
        if (cached !== undefined) {
            return cached;
        }

        const dataOff = this.getStringDataOffset(stringIdx);

        // string_data_item {
        //   uleb128 utf16_size; 
        //   MUTF-8 bytes + '\0'
        // }
        const utf16Size = this.buffer.setPosition(dataOff).readULeb128();
        // NOTE: DEX uses MUTF-8. For common ASCII / UTF-8 it works; for edge cases
        const str = this.buffer.readStringUtf8NextZero();

        this.stringCache.set(stringIdx, str);
        return str;
    }

    /**
     * 根据 typeIds 索引获取类型描述符（如 "Ljava/lang/String;"）。
     */
    getTypeDescriptorByIdx(typeIdx: number): string {
        if (typeIdx < 0 || typeIdx >= this.header.typeIdsSize) {
            throw new RangeError(`typeIdx out of range: ${typeIdx}`);
        }

        const off = this.header.typeIdsOff + typeIdx * 4;
        const descriptorIdx = this.buffer.readU32At(off);
        return this.getStringById(descriptorIdx);
    }

    /**
     * 将类型描述符转换为点分格式类名（如 "java.lang.String"）。
     */
    getClassNameByIdx(typeIdx: number): string {
        return DexUtils.descriptorToJavaType(this.getTypeDescriptorByIdx(typeIdx));
    }

    getTypeListByOff(off: number): DexTypeList {
        const size = this.buffer.setPosition(off).readU32();
        const idxList: number[] = [];
        for (let i = 0; i < size; i++) {
            idxList.push(this.buffer.readU16());
        }
        return {
            size: size,
            typeIdxList: idxList
        }
    }

    /**
     * 读取 proto_id_item。
     */
    getProtoId(protoIdx: number): DexProtoId {
        if (protoIdx < 0 || protoIdx >= this.header.protoIdsSize) {
            throw new RangeError(`protoIdx out of range: ${protoIdx}`);
        }

        const off = this.header.protoIdsOff + protoIdx * 12;
        const shortyIdx = this.buffer.setPosition(off).readU32();
        const returnTypeIdx = this.buffer.readU32();
        const parametersOff = this.buffer.readU32();
        return {shortyIdx, returnTypeIdx, parametersOff};
    }

    /**
     * 读取 field_id_item。
     */
    getFieldId(fieldIdx: number): DexFieldId {
        if (fieldIdx < 0 || fieldIdx >= this.header.fieldIdsSize) {
            throw new RangeError(`fieldIdx out of range: ${fieldIdx}`);
        }

        const off = this.header.fieldIdsOff + fieldIdx * 8;
        const classIdx = this.buffer.setPosition(off).readU16();
        const typeIdx = this.buffer.readU16();
        const nameIdx = this.buffer.readU32();
        return {classIdx, typeIdx, nameIdx};
    }

    /**
     * 读取 method_id_item。
     */
    getMethodId(methodIdx: number): DexMethodId {
        if (methodIdx < 0 || methodIdx >= this.header.methodIdsSize) {
            throw new RangeError(`methodIdx out of range: ${methodIdx}`);
        }

        const off = this.header.methodIdsOff + methodIdx * 8;
        const classIdx = this.buffer.setPosition(off).readU16();
        const protoIdx = this.buffer.readU16();
        const nameIdx = this.buffer.readU32();
        return {classIdx, protoIdx, nameIdx};
    }

    /**
     * 读取 class_def_item。
     */
    getClassDef(classDefIdx: number): DexClassDef {
        if (classDefIdx < 0 || classDefIdx >= this.header.classDefsSize) {
            throw new RangeError(`classDefIdx out of range: ${classDefIdx}`);
        }

        const off = this.header.classDefsOff + classDefIdx * 32;
        return {
            classIdx: this.buffer.setPosition(off).readU32(),
            accessFlags: this.buffer.readU32(),
            superclassIdx: this.buffer.readU32(),
            interfacesOff: this.buffer.readU32(),
            sourceFileIdx: this.buffer.readU32(),
            annotationsOff: this.buffer.readU32(),
            classDataOff: this.buffer.readU32(),
            staticValuesOff: this.buffer.readU32(),
        };
    }

    /**
     * 获取类实现的接口列表（type_list）。
     * @returns 没有接口则返回 null
     */
    getInterfacesList(classDef: DexClassDef): DexTypeList | null {
        if (classDef.interfacesOff === 0) {
            return null;
        }
        return this.getTypeListByOff(classDef.interfacesOff);
    }

    /**
     * 解析 map_list（描述 DEX 各 section 的分布）。
     */
    getMapList(): DexMapItem[] {
        const mapList = this.buffer.setPosition(this.header.mapOff);
        const size = mapList.readU32();
        const items: DexMapItem[] = [];

        for (let i = 0; i < size; i++) {
            items.push({
                type: mapList.readU16(),
                unused: mapList.readU16(),
                size: mapList.readU32(),
                offset: mapList.readU32(),
            });
        }
        return items;
    }

    // getClassDescriptorByClassDefIdx(classDefIdx: number): string {
    //     const def = this.getClassDef(classDefIdx);
    //     return this.getTypeDescriptorByIdx(def.classIdx);
    // }

    /**
     * 通过类型描述符查找对应的 class_def_item（带缓存）。
     * @param descriptor 形如 "Ljava/lang/String;"
     */
    getClassDefByDescriptor(descriptor: string): DexClassDef | null {
        const cachedIdx = this.classDefIdxByDescriptorCache.get(descriptor);
        if (cachedIdx !== undefined) {
            if (cachedIdx < 0) {
                return null;
            }
            return this.getClassDef(cachedIdx);
        }

        for (let i = 0; i < this.header.classDefsSize; i++) {
            const def = this.getClassDef(i);
            const defDescriptor = this.getTypeDescriptorByIdx(def.classIdx);
            if (defDescriptor === descriptor) {
                this.classDefIdxByDescriptorCache.set(descriptor, i);
                return def;
            }
        }

        this.classDefIdxByDescriptorCache.set(descriptor, -1);
        return null;
    }

    /**
     * 解析 class_data_item（字段/方法定义，ULEB128 编码）。
     */
    getClassData(classDef: DexClassDef): DexClassData {

        const staticFieldsSize = this.buffer
            .setPosition(classDef.classDataOff)
            .readULeb128();
        const instanceFieldsSize = this.buffer.readULeb128();
        const directMethodsSize = this.buffer.readULeb128();
        const virtualMethodsSize = this.buffer.readULeb128();

        const staticFields: DexField[] = [];
        for (let i = 0; i < staticFieldsSize; i++) {
            staticFields.push({
                fieldIdx: this.buffer.readULeb128(),
                accessFlags: this.buffer.readULeb128()
            });
        }

        const instanceFields: DexField[] = [];
        for (let i = 0; i < instanceFieldsSize; i++) {
            instanceFields.push({
                fieldIdx: this.buffer.readULeb128(),
                accessFlags: this.buffer.readULeb128()
            });
        }

        const directMethods: DexMethod[] = [];
        for (let i = 0; i < directMethodsSize; i++) {
            directMethods.push({
                methodIdx: this.buffer.readULeb128(),
                accessFlags: this.buffer.readULeb128(),
                codeOff: this.buffer.readULeb128()
            });
        }

        const virtualMethods: DexMethod[] = [];
        for (let i = 0; i < virtualMethodsSize; i++) {
            virtualMethods.push({
                methodIdx: this.buffer.readULeb128(),
                accessFlags: this.buffer.readULeb128(),
                codeOff: this.buffer.readULeb128()
            });
        }

        return {
            header: {
                staticFieldsSize,
                instanceFieldsSize,
                directMethodsSize,
                virtualMethodsSize,
            },
            staticFields: staticFields,
            instanceFields: instanceFields,
            directMethods: directMethods,
            virtualMethods: virtualMethods
        };
    }
}
