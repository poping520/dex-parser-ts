import fs from "node:fs";
import path from "node:path";
import { DexFile, DexClassLoader, DexClassDumper } from "../src";

const dexPath = path.resolve(__dirname, "boot-okhttp.dex");
const buf = fs.readFileSync(dexPath);

const dex = new DexFile(buf);

console.log("magic:", dex.header.magic);
console.log("fileSize:", dex.header.fileSize);
console.log("stringIds:", dex.header.stringIdsSize);
console.log("typeIds:", dex.header.typeIdsSize);
console.log("protoIds:", dex.header.protoIdsSize);
console.log("fieldIds:", dex.header.fieldIdsSize);
console.log("methodIds:", dex.header.methodIdsSize);
console.log("classDefs:", dex.header.classDefsSize);


const maxStrings = Math.min(10, dex.header.stringIdsSize);
for (let i = 0; i < maxStrings; i++) {
    console.log(`string[${i}]=`, dex.getStringById(i));
}

const maxTypes = Math.min(10, dex.header.typeIdsSize);
for (let i = 0; i < maxTypes; i++) {
    console.log(`type[${i}]=`, dex.getTypeDescriptorByIdx(i));
}

console.log("protoId[0]:", dex.getProtoId(0));
console.log("protoId[1]:", dex.getProtoId(1));

const mapList = dex.getMapList();
console.log("mapList:", mapList);

const classDef = dex.getClassDef(15);

const classData = dex.getClassData(classDef);
console.log("classData:", classData);

const classLoader = new DexClassLoader(dex);
const javaClass = classLoader.findClassResolved("com.android.okhttp.Response")

console.log(javaClass);