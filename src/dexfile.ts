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

// try_item
export interface DexTry {
    startAddr: number;      // u4    try 范围起始地址
    insnCount: number;      // u2    try 范围指令数量
    handlerOff: number;     // u2    try 处理器偏移量
}

// type_addr_pair
export interface DexTypeAddrPair {
    typeIdx: number;    // uleb128  捕获异常类型的 typeIds 索引
    address: number;    // uleb128  handler 入口地址（以 16-bit code unit 为单位）
}

// encoded_catch_handler
export interface DexEncodedCatchHandler {
    offset: number;                 // 相对于 encoded_catch_handler_list 起点的偏移；与 try_item.handlerOff 对应
    catchesAll: boolean;            // size<=0 时为 true，表示存在 catch_all_addr
    handlers: DexTypeAddrPair[];    // type_addr_pair[]，数量为 abs(size)
    catchAllAddr: number | null;    // uleb128  catch_all_addr；不存在则为 null
}

export interface DexDebugPosition {
    address: number;    // 指令地址（以 16-bit code unit 为单位）
    line: number;       // 源代码行号
}

export interface DexDebugLocal {
    reg: number;
    startAddress: number;
    endAddress: number;
    name: string | null;
    descriptor: string | null;
    signature: string | null;
}

export interface DexDebugInfo {
    lineStart: number;
    parametersSize: number;
    parameterNames: Array<string | null>;
    positions: DexDebugPosition[];
    locals: DexDebugLocal[];
    sourceFile: string | null;
    prologueEndAddresses: number[];
    epilogueBeginAddresses: number[];
}

export enum DexDebugOpcode {
    EndSequence = 0x00,
    AdvancePc = 0x01,
    AdvanceLine = 0x02,
    StartLocal = 0x03,
    StartLocalExtended = 0x04,
    EndLocal = 0x05,
    RestartLocal = 0x06,
    SetPrologueEnd = 0x07,
    SetEpilogueBegin = 0x08,
    SetFile = 0x09,
    FirstSpecial = 0x0a,
}

export const DBG_LINE_BASE = -4;
export const DBG_LINE_RANGE = 15;

// code_item
export interface DexCode {
    registersSize: number;  // u2    方法寄存器数量
    insSize: number;        // u2    方法参数数量
    outsSize: number;       // u2    方法返回值数量
    triesSize: number;      // u2    方法 try-catch 异常处理数量
    debugInfoOff: number;   // u4    调试信息偏移量
    insnsSize: number;      // u4    指令数量
    insns: Uint16Array;     // u2[]  指令

    /* followed by optional u2 padding  仅当 triesSize>0 且 insnsSize 为奇数时存在 */

    tries: DexTry[];                            // followed by try_item[triesSize]
    handlersSize: number;                       // followed by uleb128 handlersSize (encoded_catch_handler_list.size)
    catchHandlers: DexEncodedCatchHandler[];    // followed by encoded_catch_handler[handlersSize]
}


// https://android.googlesource.com/platform/dalvik/+/refs/tags/android-4.4.4_r2.0.1/libdex/DexClass.h#28

/* class_data_item header */
export interface DexClassDataHeader {
    staticFieldsSize: number;   // u4  静态字段数量
    instanceFieldsSize: number; // u4  实例字段数量
    directMethodsSize: number;  // u4  直接方法数量
    virtualMethodsSize: number; // u4  虚拟方法数量
}

/* encoded_field */
export interface DexField {
    fieldIdx: number;    // u4  字段索引
    accessFlags: number; // u4  访问标志
}

/* encoded_method */
export interface DexMethod {
    methodIdx: number;    // u4  方法索引
    accessFlags: number;  // u4  访问标志
    codeOff: number;      // u4  代码偏移量
}

/* class_data_item */
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

    readSLeb128(): number {
        let shift = 0;
        let result = 0;
        let tmpPos = this.position;
        let b = 0;

        while (true) {
            if (tmpPos >= this.bytes.length) {
                throw new RangeError("SLEB128 out of range");
            }

            b = this.bytes[tmpPos++];
            result |= (b & 0x7f) << shift;
            shift += 7;

            if ((tmpPos - this.position) > 5) {
                throw new Error("SLEB128 too large");
            }

            if ((b & 0x80) === 0) {
                break;
            }
        }

        if (shift < 32 && (b & 0x40) !== 0) {
            result |= (-1 << shift);
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
     * 从字节数组创建 DexFile 实例。
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

    getDexCode(dexMethod: DexMethod): DexCode | null {
        if (dexMethod.codeOff === 0) {
            return null;
        }

        const registersSize = this.buffer.setPosition(dexMethod.codeOff).readU16();
        const insSize = this.buffer.readU16();
        const outsSize = this.buffer.readU16();
        const triesSize = this.buffer.readU16();
        const debugInfoOff = this.buffer.readU32();
        const insnsSize = this.buffer.readU32();

        const insns = new Uint16Array(insnsSize);
        for (let i = 0; i < insnsSize; i++) {
            insns[i] = this.buffer.readU16();
        }

        if (triesSize > 0 && (insnsSize & 1) !== 0) {
            this.buffer.skip(2);
        }

        const tryItems: DexTry[] = [];
        for (let i = 0; i < triesSize; i++) {
            tryItems.push({
                startAddr: this.buffer.readU32(),
                insnCount: this.buffer.readU16(),
                handlerOff: this.buffer.readU16(),
            });
        }

        const encodedCatchHandlerListStart = this.buffer.getPosition();
        const handlersSize = triesSize > 0 ? this.buffer.readULeb128() : 0;
        const catchHandlers: DexEncodedCatchHandler[] = [];

        if (handlersSize > 0) {
            for (let i = 0; i < handlersSize; i++) {
                const offset = this.buffer.getPosition() - encodedCatchHandlerListStart;
                let size = this.buffer.readSLeb128();
                let catchesAll = false;
                
                if (size <= 0) {
                    catchesAll = true;
                    size = -size;
                }

                const handlers: DexTypeAddrPair[] = [];
                for (let j = 0; j < size; j++) {
                    const typeIdx = this.buffer.readULeb128();
                    const address = this.buffer.readULeb128();
                    handlers.push({ typeIdx, address });
                }

                const catchAllAddr = catchesAll ? this.buffer.readULeb128() : null;

                catchHandlers.push({
                    offset,
                    catchesAll,
                    handlers,
                    catchAllAddr,
                });
            }
        }

        return {
            registersSize,
            insSize,
            outsSize,
            triesSize,
            debugInfoOff,
            insnsSize,
            insns,
            tries: tryItems,
            handlersSize,
            catchHandlers
        }
    }

    getDexDebugInfo(dexCode: DexCode): DexDebugInfo {
        if (dexCode.debugInfoOff === 0) {
            return {
                lineStart: 0,
                parametersSize: 0,
                parameterNames: [],
                positions: [],
                locals: [],
                sourceFile: null,
                prologueEndAddresses: [],
                epilogueBeginAddresses: []
            };
        }

        const readStringIdx = (): string | null => {
            const stringIdx = this.buffer.readULeb128();
            if (stringIdx === 0) {
                return null;
            }
            const savedPos = this.buffer.getPosition();
            const val = this.getStringById(stringIdx - 1);
            this.buffer.setPosition(savedPos);
            return val;
        };

        const readTypeIdx = (): string | null => {
            const typeIdx = this.buffer.readULeb128();
            if (typeIdx === 0) {
                return null;
            }
            const savedPos = this.buffer.getPosition();
            const val = this.getTypeDescriptorByIdx(typeIdx - 1);
            this.buffer.setPosition(savedPos);
            return val;
        };

        this.buffer.setPosition(dexCode.debugInfoOff);
        const lineStart = this.buffer.readULeb128();
        const parametersSize = this.buffer.readULeb128();

        const parameterNames: Array<string | null> = [];
        for (let i = 0; i < parametersSize; i++) {
            parameterNames.push(readStringIdx());
        }

        const positions: DexDebugPosition[] = [];
        const locals: DexDebugLocal[] = [];

        type LocalInfo = {
            name: string | null;
            descriptor: string | null;
            signature: string | null;
            startAddress: number;
            live: boolean;
        };

        const localInReg: LocalInfo[] = new Array(dexCode.registersSize);
        for (let i = 0; i < localInReg.length; i++) {
            localInReg[i] = { name: null, descriptor: null, signature: null, startAddress: 0, live: false };
        }

        const emitLocalIfLive = (reg: number, endAddress: number) => {
            const info = localInReg[reg];
            if (info.live) {
                locals.push({
                    reg,
                    startAddress: info.startAddress,
                    endAddress,
                    name: info.name,
                    descriptor: info.descriptor,
                    signature: info.signature
                });
            }
        };

        let address = 0;
        let line = lineStart;
        let sourceFile: string | null = null;
        const prologueEndAddresses: number[] = [];
        const epilogueBeginAddresses: number[] = [];

        const finalize = (): DexDebugInfo => {
            locals.sort((a, b) => {
                if (a.endAddress !== b.endAddress) return a.endAddress - b.endAddress;
                return a.reg - b.reg;
            });
            return {
                lineStart,
                parametersSize,
                parameterNames,
                positions,
                locals,
                sourceFile,
                prologueEndAddresses,
                epilogueBeginAddresses
            };
        };

        for (;;) {
            const opcode = this.buffer.readU8();

            switch (opcode) {
                case DexDebugOpcode.EndSequence: {
                    for (let reg = 0; reg < dexCode.registersSize; reg++) {
                        emitLocalIfLive(reg, dexCode.insnsSize);
                    }
                    return finalize();
                }

                case DexDebugOpcode.AdvancePc:
                    address += this.buffer.readULeb128();
                    break;

                case DexDebugOpcode.AdvanceLine:
                    line += this.buffer.readSLeb128();
                    break;

                case DexDebugOpcode.StartLocal:
                case DexDebugOpcode.StartLocalExtended: {
                    const reg = this.buffer.readULeb128();
                    if (reg >= dexCode.registersSize) {
                        for (let r = 0; r < dexCode.registersSize; r++) {
                            emitLocalIfLive(r, dexCode.insnsSize);
                        }
                        return finalize();
                    }

                    emitLocalIfLive(reg, address);

                    localInReg[reg].name = readStringIdx();
                    localInReg[reg].descriptor = readTypeIdx();
                    localInReg[reg].signature = opcode === DexDebugOpcode.StartLocalExtended ? readStringIdx() : null;
                    localInReg[reg].startAddress = address;
                    localInReg[reg].live = true;
                    break;
                }

                case DexDebugOpcode.EndLocal: {
                    const reg = this.buffer.readULeb128();
                    if (reg < dexCode.registersSize) {
                        emitLocalIfLive(reg, address);
                        localInReg[reg].live = false;
                    }
                    break;
                }

                case DexDebugOpcode.RestartLocal: {
                    const reg = this.buffer.readULeb128();
                    if (reg >= dexCode.registersSize) {
                        throw new Error(`Invalid debug info stream: DBG_RESTART_LOCAL reg out of range: ${reg}`);
                    }

                    if (localInReg[reg].name == null || localInReg[reg].descriptor == null) {
                        throw new Error(`Invalid debug info stream: DBG_RESTART_LOCAL without prior START_LOCAL for reg ${reg}`);
                    }

                    if (!localInReg[reg].live) {
                        localInReg[reg].startAddress = address;
                        localInReg[reg].live = true;
                    }
                    break;
                }

                case DexDebugOpcode.SetPrologueEnd:
                    prologueEndAddresses.push(address);
                    break;

                case DexDebugOpcode.SetEpilogueBegin:
                    epilogueBeginAddresses.push(address);
                    break;

                case DexDebugOpcode.SetFile:
                    sourceFile = readStringIdx();
                    break;

                default: {
                    const adjopcode = opcode - DexDebugOpcode.FirstSpecial;
                    if (adjopcode < 0) {
                        break;
                    }

                    address += Math.floor(adjopcode / DBG_LINE_RANGE);
                    line += DBG_LINE_BASE + (adjopcode % DBG_LINE_RANGE);
                    positions.push({ address, line });
                    break;
                }
            }
        }
    }
}
