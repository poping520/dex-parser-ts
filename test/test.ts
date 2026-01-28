import fs from "node:fs";
import path from "node:path";
import {DexFile, parseDexFile} from "../src";

const dexPath = path.resolve(__dirname, "classes.dex");
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

const maxClasses = Math.min(10, dex.header.classDefsSize);
for (let i = 0; i < maxClasses; i++) {
  console.log(`classDef[${i}]=`, dex.getClassDescriptorByClassDefIdx(i));
}

const classes = parseDexFile(buf);
console.log("parsed classes:", classes.length);

for (const c of classes.slice(0, 5)) {
  console.log("class:", c.name, "extends", c.super);
  if (c.interfaces?.length) console.log("  interfaces:", c.interfaces);
  if (c.fields?.length) console.log("  fields:", c.fields.slice(0, 5));
  if (c.methods?.length) console.log("  methods:", c.methods.slice(0, 5));
}
