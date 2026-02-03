import { Dexfile, DexField, DexMethod } from "./dexfile";
import { DexUtils } from "./utils";

export interface JavaMethodT<TType> {
    accessFlags: number;
    name: string;
    returnType: TType;
    parameterTypes: TType[];
}

export interface JavaFieldT<TType> {
    accessFlags: number;
    name: string;
    type: TType;
}

export interface JavaClassT<TType> {
    stub: boolean;       // 如果一个类不在当前的 Dex 中，则 stub 为 true
    accessFlags: number;
    name: string;
    super?: TType | null;
    interfaces: TType[];
    fields: JavaFieldT<TType>[];
    methods: JavaMethodT<TType>[];
}

export type JavaClassRaw = JavaClassT<string>;

export type JavaMethodRaw = JavaMethodT<string>;

export type JavaFieldRaw = JavaFieldT<string>;

export type JavaClassResolved = JavaClassT<JavaClassResolved>;

export type JavaMethodResolved = JavaMethodT<JavaClassResolved>;

export type JavaFieldResolved = JavaFieldT<JavaClassResolved>;


export class DexClassLoader {

    private readonly dexFile: Dexfile;

    private readonly rawClassCache = new Map<string, JavaClassRaw | null>();

    private readonly resolvedClassCache = new Map<string, JavaClassResolved | null>();

    /**
     * 创建一个基于 DexFile 的类加载器（带缓存）。
     */
    constructor(dexFile: Dexfile) {
        this.dexFile = dexFile;
    }

    /**
     * 查找并解析指定类。
     * @param className 点分名（java.lang.String）或描述符（Ljava/lang/String;）
     */
    findClass(className: string): JavaClassRaw | null;
    findClass(className: string, options: { resolveRefs: true }): JavaClassResolved | null;
    findClass(className: string, options?: { resolveRefs?: boolean }): JavaClassRaw | JavaClassResolved | null {
        if (options?.resolveRefs) {
            return this.findClassResolved(className);
        }
        return this.findClassRaw(className);
    }

    findClassRaw(className: string): JavaClassRaw | null {
        const cached = this.rawClassCache.get(className);
        if (cached !== undefined) {
            return cached;
        }

        const classDef = this.dexFile.getClassDefByDescriptor(this.normalizeToDescriptor(className));
        if (!classDef) {
            this.rawClassCache.set(className, null);
            return null;
        }

        const NO_INDEX = 0xffffffff;
        const superClassName = classDef.superclassIdx === NO_INDEX
                ? "java.lang.Object"
                : this.dexFile.getClassNameByIdx(classDef.superclassIdx);

        // Interfaces
        const interfaces: string[] = [];
        const typeList = this.dexFile.getInterfacesList(classDef);
        if (typeList !== null) {
            for (let i = 0; i < typeList.size; i++) {
                const typeIdx = typeList.typeIdxList[i];
                const ifaceName = this.dexFile.getClassNameByIdx(typeIdx);
                interfaces.push(ifaceName);
            }
        }

        let fields: JavaFieldRaw[] = [];
        let methods: JavaMethodRaw[] = [];

        if (classDef.classDataOff !== 0) {
            const classData = this.dexFile.getClassData(classDef);

            // Fields
            fields = [];
            this.parseDexFields(classData.instanceFields, fields);
            this.parseDexFields(classData.staticFields, fields);

            // Methods
            methods = [];
            this.parseDexMethods(classData.directMethods, methods);
            this.parseDexMethods(classData.virtualMethods, methods);
        }

        const cls: JavaClassRaw = {
            stub: false,
            accessFlags: classDef.accessFlags,
            name: className,
            super: superClassName,
            interfaces: interfaces,
            fields: fields,
            methods: methods
        };

        this.rawClassCache.set(className, cls);
        return cls;
    }

    findClassResolved(className: string): JavaClassResolved | null {
        const cached = this.resolvedClassCache.get(className);
        if (cached !== undefined) {
            return cached;
        }

        const raw = this.findClassRaw(className);
        if (!raw) {
            return null;
        }

        const resolved: JavaClassResolved = {
            stub: false,
            accessFlags: raw.accessFlags,
            name: className,
            super: null,
            interfaces: [],
            fields: [],
            methods: []
        };

        // Insert early to break cycles (e.g. self-referential or mutually-referential classes)
        this.resolvedClassCache.set(className, resolved);
        if (raw.super !== null) {
            resolved.super = this.resolveTypeRef(raw.super!);
        }
        resolved.interfaces = raw.interfaces.map((i) => this.resolveTypeRef(i));
        resolved.fields = raw.fields.map((f) => ({
            accessFlags: f.accessFlags,
            name: f.name,
            type: this.resolveTypeRef(f.type)
        }));
        resolved.methods = raw.methods.map((m) => ({
            accessFlags: m.accessFlags,
            name: m.name,
            returnType: this.resolveTypeRef(m.returnType),
            parameterTypes: m.parameterTypes.map((p) => this.resolveTypeRef(p))
        }));

        return resolved;
    }

    private parseDexFields(dexFields: DexField[], out: JavaFieldRaw[]): void {
        let fieldIdx = 0;
        for (const df of dexFields) {
            fieldIdx += df.fieldIdx;
            const fieldId = this.dexFile.getFieldId(fieldIdx);
            const type = this.dexFile.getClassNameByIdx(fieldId.typeIdx);
            const name = this.dexFile.getStringById(fieldId.nameIdx);
            out.push({
                accessFlags: df.accessFlags,
                name,
                type
            });
        }
    }

    private parseDexMethods(dexMethods: DexMethod[], out: JavaMethodRaw[]): void {
        let methodIdx = 0;
        for (const dm of dexMethods) {
            methodIdx += dm.methodIdx;
            const methodId = this.dexFile.getMethodId(methodIdx);
            const name = this.dexFile.getStringById(methodId.nameIdx);

            const protoId = this.dexFile.getProtoId(methodId.protoIdx);

            // const shorty = this.dexFile.getStringById(protoId.shortyIdx);
            const returnType = this.dexFile.getClassNameByIdx(protoId.returnTypeIdx);

            const parameterTypes: string[] = [];
            if (protoId.parametersOff > 0) {
                const typeList = this.dexFile.getTypeListByOff(protoId.parametersOff);
                for (const typeIdx of typeList.typeIdxList) {
                    const className = this.dexFile.getClassNameByIdx(typeIdx);
                    parameterTypes.push(className);
                }
            }

            out.push({
                accessFlags: dm.accessFlags,
                name,
                returnType,
                parameterTypes
            });
        }
    }

    private normalizeToDescriptor(className: string): string {
        if (className.length > 0 && className[0] === "[") {
            return className.replace(/\./g, "/");
        }
        if (className.length > 1 && className[0] === "L" && className[className.length - 1] === ";") {
            return className.replace(/\./g, "/");
        }
        return DexUtils.dotToDescriptor(className);
    }

    private resolveTypeRef(className: string): JavaClassResolved {
        let ret = this.findClassResolved(className);

        if (ret == null) {
            ret = {
                stub: true,
                accessFlags: 0,
                name: className,
                interfaces: [],
                fields: [],
                methods: []
            }
            this.resolvedClassCache.set(className, ret);
        }
        return ret;
    }
}


