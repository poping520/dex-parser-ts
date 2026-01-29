import fs from "node:fs";
import path from "node:path";
import {DexFile, DexClassLoader} from "../src";

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
console.log("findClass:", classLoader.findClass("com.android.okhttp.OkHttpClient"));


// const maxClasses = Math.min(10, dex.header.classDefsSize);
// for (let i = 0; i < maxClasses; i++) {
//     console.log(`classDef[${i}]=`, dex.getClassDescriptorByClassDefIdx(i));
// }

// const classes = parseDexFile(buf);
// console.log("parsed classes:", classes.length);

// for (const c of classes.slice(0, 5)) {
//     console.log("class:", c.name, "extends", c.super);
//     if (c.interfaces?.length) console.log("  interfaces:", c.interfaces);
//     if (c.fields?.length) console.log("  fields:", c.fields.slice(0, 5));
//     if (c.methods?.length) console.log("  methods:", c.methods.slice(0, 5));
// }
