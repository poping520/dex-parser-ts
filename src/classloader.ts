import {DexFile} from "./dex-file";

export function dotToDescriptor(str: string): string {
    if (str == null) {
        throw new TypeError("str is null or undefined");
    }
    if (str.length === 0) {
        throw new Error("str is empty");
    }

    const wrapElSemi = str[0] !== "[";
    const replaced = str.replace(/\./g, "/");
    return wrapElSemi ? `L${replaced};` : replaced;
}

export function descriptorToDot(str: string): string {
    if (str == null) {
        throw new TypeError("str is null or undefined");
    }

    let s = str;
    if (s.length >= 2 && s[0] === "L" && s[s.length - 1] === ";") {
        s = s.substring(1, s.length - 1);
    }

    return s.replace(/\//g, ".");
}

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

        const NO_INDEX = 0xffffffff;
        const superName = classDef.superclassIdx === NO_INDEX
            ? ""
            : this.dexFile.getTypeDescriptorByIdx(classDef.superclassIdx);

        const cls: JavaClass = {
            accessFlags: classDef.accessFlags,
            name: className,
            super: superName,
            interfaces: null,
            fields: null,
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
        return dotToDescriptor(className);
    }
}
