import { DexAccessFlag } from "./dexfile";

export namespace DexUtils {

    /**
     * 计算 UTF-8 字符串的 31-based hash（与 Java String.hashCode 类似）。
     */
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

    export function descriptorToJavaType(descriptor: string): string {
        if (descriptor == null) {
            throw new TypeError("descriptor is null or undefined");
        }
        if (descriptor.length === 0) {
            throw new Error("descriptor is empty");
        }

        let arrayDim = 0;
        while (arrayDim < descriptor.length && descriptor[arrayDim] === "[") {
            arrayDim++;
        }

        const base = descriptor.substring(arrayDim);
        let typeName: string;
        switch (base[0]) {
            case "B": typeName = "byte"; break;
            case "C": typeName = "char"; break;
            case "D": typeName = "double"; break;
            case "F": typeName = "float"; break;
            case "I": typeName = "int"; break;
            case "J": typeName = "long"; break;
            case "S": typeName = "short"; break;
            case "V": typeName = "void"; break;
            case "Z": typeName = "boolean"; break;
            case "L": {
                typeName = descriptorToDot(base);
                break;
            }
            default:
                typeName = descriptorToDot(base);
                break;
        }

        for (let i = 0; i < arrayDim; i++) {
            typeName += "[]";
        }
        return typeName;
    }

    export type AccessFlagKind = "class" | "field" | "method";

    export function accessFlagsToJavaModifierString(accessFlags: number, kind: AccessFlagKind): string {
        const mods: string[] = [];

        const isInterface = (accessFlags & DexAccessFlag.Interface) !== 0;
        const isEnum = (accessFlags & DexAccessFlag.Enum) !== 0;

        if (accessFlags & DexAccessFlag.Public)  mods.push("public");
        else if (accessFlags & DexAccessFlag.Protected) mods.push("protected");
        else if (accessFlags & DexAccessFlag.Private) mods.push("private");

        if (accessFlags & DexAccessFlag.Abstract) {
            if (!(kind === "class" && isInterface)) {
                mods.push("abstract");
            }
        }

        if (accessFlags & DexAccessFlag.Static) {
            if (kind === "field" || kind === "method" || kind === "class") {
                mods.push("static");
            }
        }

        if (accessFlags & DexAccessFlag.Final) {
            if (!(kind === "class" && (isInterface || isEnum))) {
                mods.push("final");
            }
        }

        if (kind === "field") {
            if (accessFlags & DexAccessFlag.Transient) mods.push("transient");
            if (accessFlags & DexAccessFlag.Volatile) mods.push("volatile");
        }

        if (kind === "method") {
            if (accessFlags & DexAccessFlag.Synchronized) mods.push("synchronized");
            if (accessFlags & DexAccessFlag.Native) mods.push("native");
            if (accessFlags & DexAccessFlag.Strict) mods.push("strictfp");
        }

        return mods.join(" ");
    }
}