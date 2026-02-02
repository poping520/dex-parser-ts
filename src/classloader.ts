import {DexFile} from "./dex-file";
import { DexUtils } from "./utils";

export function computeUtf8Hash(utf8Str: string): number {
    if (utf8Str == null) {
        throw new TypeError("utf8Str is null or undefined");
    }

    const bytes = new TextEncoder().encode(utf8Str);
    let hash = 1 >>> 0;
    for (let i = 0; i < bytes.length; i++) {
        hash = (hash * 31 + bytes[i]) >>> 0;
    }
    return hash;
}

export interface JavaMethod {
    accessFlags: number;
    name: string;
    returnType: string;
    parameterTypes: string[];
}

export interface JavaField {
    accessFlags: number;
    name: string;
    type: string;
}

export interface JavaClass {
    accessFlags: number;
    name: string;
    super: string;
    interfaces?: string[] | null;
    fields?: JavaField[] | null;
    methods?: JavaMethod[] | null;
}

export class DexClassLoader {

    private readonly dexFile: DexFile;

    private readonly classCache = new Map<string, JavaClass | null>();

    constructor(dexFile: DexFile) {
        this.dexFile = dexFile;
    }

    findClass(className: string): JavaClass | null {
        const descriptor = this.normalizeToDescriptor(className);

        const cached = this.classCache.get(descriptor);
        if (cached !== undefined) {
            return cached;
        }

        const classDef = this.dexFile.getClassDefByDescriptor(descriptor);
        if (!classDef) {
            this.classCache.set(descriptor, null);
            return null;
        }

        const superClassName = this.dexFile.getClassNameByIdx(classDef.superclassIdx);

        // Interfaces
        let interfaces = [];
        const typeList = this.dexFile.getInterfacesList(classDef);
        if (typeList !== null) {
            for (let i = 0; i < typeList.size; i++) {
                const typeIdx = typeList.typeIdxList[i];
                const className = this.dexFile.getClassNameByIdx(typeIdx);
                interfaces.push(className);
            }
        }

        // Fields
        const fields: JavaField[] = []
        const classData = this.dexFile.getClassData(classDef);
        let fieldIdx = 0;
        for (const df of classData.instanceFields) {
            fieldIdx += df.fieldIdx;
            const fieldId = this.dexFile.getFieldId(fieldIdx);
            const typeName = this.dexFile.getClassNameByIdx(fieldId.typeIdx);
            const name = this.dexFile.getStringById(fieldId.nameIdx);

            fields.push({
                accessFlags: df.accessFlags,
                name: name,
                type: typeName
            });
        }

        // Methods


        const cls: JavaClass = {
            accessFlags: classDef.accessFlags,
            name: className,
            super: superClassName,
            interfaces: interfaces,
            fields: fields,
            methods: null,
        };

        this.classCache.set(descriptor, cls);
        return cls;
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
}
