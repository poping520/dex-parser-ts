import { DexFile } from "./DexFile";
import type { DexClassDef, DexHeader } from "./DexFile";
import { readUleb128 } from "./leb128";

export { DexFile };
export type { DexHeader, DexClassDef };


export namespace Dex {

    export interface Method {
        accessFlags: number;
        name: string;
        returnType: string;
        parameterTypes: string[];
    }

    export interface Field {
        accessFlags: number;
        name: string;
        type: string;
    }

    export interface Class {
        accessFlags: number;
        name: string;
        super: string;
        interfaces?: string[] | null;
        fields?: Field[] | null;
        methods?: Method[] | null;
    }

    export function parseDexFile(bytes: Uint8Array): Class[] {
        const dex = new DexFile(bytes);
        const r = dex.reader;

        const NO_INDEX = 0xffffffff;

        function readTypeList(off: number): string[] {
            if (off === 0) return [];
            const size = r.u4(off);
            const result: string[] = [];
            let cur = off + 4;
            for (let i = 0; i < size; i++) {
                const typeIdx = r.u2(cur);
                cur += 2;
                result.push(dex.getTypeDescriptorByIdx(typeIdx));
            }
            return result;
        }

        function parseClassData(off: number): {
            staticFields: Field[];
            instanceFields: Field[];
            directMethods: Method[];
            virtualMethods: Method[];
        } {
            if (off === 0) {
                return {
                    staticFields: [],
                    instanceFields: [],
                    directMethods: [],
                    virtualMethods: [],
                };
            }

            let cur = off;

            const sfc = readUleb128(r.bytes, cur);
            cur = sfc.nextOffset;
            const ifc = readUleb128(r.bytes, cur);
            cur = ifc.nextOffset;
            const dmc = readUleb128(r.bytes, cur);
            cur = dmc.nextOffset;
            const vmc = readUleb128(r.bytes, cur);
            cur = vmc.nextOffset;

            const staticFieldsSize = sfc.value;
            const instanceFieldsSize = ifc.value;
            const directMethodsSize = dmc.value;
            const virtualMethodsSize = vmc.value;

            const staticFields: Field[] = [];
            const instanceFields: Field[] = [];
            const directMethods: Method[] = [];
            const virtualMethods: Method[] = [];

            let fieldIdx = 0;
            for (let i = 0; i < staticFieldsSize; i++) {
                const idxDiff = readUleb128(r.bytes, cur);
                cur = idxDiff.nextOffset;
                const access = readUleb128(r.bytes, cur);
                cur = access.nextOffset;

                fieldIdx += idxDiff.value;
                const fid = dex.getFieldId(fieldIdx);
                staticFields.push({
                    accessFlags: access.value,
                    name: dex.getStringById(fid.nameIdx),
                    type: dex.getTypeDescriptorByIdx(fid.typeIdx),
                });
            }

            fieldIdx = 0;
            for (let i = 0; i < instanceFieldsSize; i++) {
                const idxDiff = readUleb128(r.bytes, cur);
                cur = idxDiff.nextOffset;
                const access = readUleb128(r.bytes, cur);
                cur = access.nextOffset;

                fieldIdx += idxDiff.value;
                const fid = dex.getFieldId(fieldIdx);
                instanceFields.push({
                    accessFlags: access.value,
                    name: dex.getStringById(fid.nameIdx),
                    type: dex.getTypeDescriptorByIdx(fid.typeIdx),
                });
            }

            let methodIdx = 0;
            for (let i = 0; i < directMethodsSize; i++) {
                const idxDiff = readUleb128(r.bytes, cur);
                cur = idxDiff.nextOffset;
                const access = readUleb128(r.bytes, cur);
                cur = access.nextOffset;
                const codeOff = readUleb128(r.bytes, cur);
                cur = codeOff.nextOffset;

                methodIdx += idxDiff.value;
                const mid = dex.getMethodId(methodIdx);
                const proto = dex.getProtoId(mid.protoIdx);
                const paramTypes = proto.parametersOff === 0 ? [] : readTypeList(proto.parametersOff);

                directMethods.push({
                    accessFlags: access.value,
                    name: dex.getStringById(mid.nameIdx),
                    returnType: dex.getTypeDescriptorByIdx(proto.returnTypeIdx),
                    parameterTypes: paramTypes,
                });
            }

            methodIdx = 0;
            for (let i = 0; i < virtualMethodsSize; i++) {
                const idxDiff = readUleb128(r.bytes, cur);
                cur = idxDiff.nextOffset;
                const access = readUleb128(r.bytes, cur);
                cur = access.nextOffset;
                const codeOff = readUleb128(r.bytes, cur);
                cur = codeOff.nextOffset;

                methodIdx += idxDiff.value;
                const mid = dex.getMethodId(methodIdx);
                const proto = dex.getProtoId(mid.protoIdx);
                const paramTypes = proto.parametersOff === 0 ? [] : readTypeList(proto.parametersOff);

                virtualMethods.push({
                    accessFlags: access.value,
                    name: dex.getStringById(mid.nameIdx),
                    returnType: dex.getTypeDescriptorByIdx(proto.returnTypeIdx),
                    parameterTypes: paramTypes,
                });
            }

            return { staticFields, instanceFields, directMethods, virtualMethods };
        }

        const classes: Class[] = [];
        for (let i = 0; i < dex.header.classDefsSize; i++) {
            const def = dex.getClassDef(i);

            const name = dex.getTypeDescriptorByIdx(def.classIdx);
            const superName = def.superclassIdx === NO_INDEX ? "" : dex.getTypeDescriptorByIdx(def.superclassIdx);
            const interfaces = def.interfacesOff === 0 ? [] : readTypeList(def.interfacesOff);

            const data = parseClassData(def.classDataOff);
            const fields: Field[] = [...data.staticFields, ...data.instanceFields];
            const methods: Method[] = [...data.directMethods, ...data.virtualMethods];

            classes.push({
                accessFlags: def.accessFlags,
                name,
                super: superName,
                interfaces: interfaces.length ? interfaces : null,
                fields: fields.length ? fields : null,
                methods: methods.length ? methods : null,
            });
        }

        return classes;
    }
}

