import { DexAccessFlag } from "./dexfile";
import { JavaClassRaw, JavaMethodRaw, JavaFieldRaw, JavaClassResolved } from "./classloader";
import { DexUtils } from "./utils";

type JavaType = string | JavaClassResolved;

export class DexClassDumper {

    static dump(javaClass: JavaClassRaw | JavaClassResolved): string {
        const mod = DexUtils.accessFlagsToJavaModifierString(javaClass.accessFlags, "class");
        const isInterface = (javaClass.accessFlags & DexAccessFlag.Interface) !== 0;
        const isEnum = (javaClass.accessFlags & DexAccessFlag.Enum) !== 0;

        const keyword = isEnum ? "enum" : (isInterface ? "interface" : "class");

        const parts: string[] = [];
        if (mod) parts.push(mod);
        parts.push(keyword);
        parts.push(javaClass.name);

        const ifaces = (javaClass.interfaces ?? [])
            .map((i) => this.typeRefToName(i))
            .filter((s) => s && s.length > 0);

        if (isInterface) {
            if (ifaces.length > 0) {
                parts.push("extends");
                parts.push(ifaces.join(", "));
            }
        } else {
            const hasMeaningfulSuper =
                !!javaClass.super &&
                this.typeRefToName(javaClass.super) !== "java.lang.Object" &&
                !isEnum;
            if (hasMeaningfulSuper) {
                parts.push("extends");
                parts.push(this.typeRefToName(javaClass.super!));
            }

            if (ifaces.length > 0) {
                parts.push("implements");
                parts.push(ifaces.join(", "));
            }
        }

        const fieldLines = (javaClass.fields ?? [])
            .filter((f) => !!f)
            .map((f) => `    ${this.dumpField(f)};`);
        if (fieldLines.length === 0) {
            return `${parts.join(" ")} { }`;
        }
        const methodLines = (javaClass.methods ?? [])
            .filter((m) => !!m)
            .map((m) => `\n    ${this.dumpMethod(m, javaClass.name)}`);

        const bodyLines = [...fieldLines, ...methodLines];
        return `${parts.join(" ")} {\n${bodyLines.join("\n")}\n}`;
    }
    
    private static dumpField(field: JavaFieldRaw | any): string {
        const mod = DexUtils.accessFlagsToJavaModifierString(field.accessFlags, "field");
        const t = this.typeRefToName(field.type);
        return mod ? `${mod} ${t} ${field.name}` : `${t} ${field.name}`;
    }

    private static dumpMethod(method: JavaMethodRaw | any, declaringClassName: string): string {
        if (method.name === "<clinit>") {
            return "static { }";
        }

        const isAbstract = (method.accessFlags & DexAccessFlag.Abstract) !== 0;
        const isNative = (method.accessFlags & DexAccessFlag.Native) !== 0;
        const params = (method.parameterTypes ?? [])
            .map((t: JavaType, i: number) => `${this.typeRefToName(t)} arg${i}`);

        if (method.name === "<init>") {
            const simpleName = declaringClassName.split(".").pop() || declaringClassName;

            let mod = DexUtils.accessFlagsToJavaModifierString(method.accessFlags, "method");
            if (mod) {
                mod = mod
                    .split(/\s+/g)
                    .filter((m) => m.length > 0 && m !== "static")
                    .join(" ");
            }

            const headParts: string[] = [];
            if (mod) headParts.push(mod);
            headParts.push(`${simpleName}(${params.join(", ")})`);
            const head = headParts.join(" ");
            if (isAbstract || isNative) {
                return `${head};`;
            }
            return `${head} { }`;
        }

        const mod = DexUtils.accessFlagsToJavaModifierString(method.accessFlags, "method");
        const headParts: string[] = [];
        if (mod) headParts.push(mod);
        headParts.push(this.typeRefToName(method.returnType));
        headParts.push(`${method.name}(${params.join(", ")})`);

        const head = headParts.join(" ");
        if (isAbstract || isNative) {
            return `${head};`;
        }
        return `${head} { }`;
    }

    private static typeRefToName(typeRef?: JavaType): string {
        if (!typeRef) {
            return "";
        }

        if (typeof typeRef === "string") {
            return typeRef;
        }

        return typeRef.name;
    }
}

