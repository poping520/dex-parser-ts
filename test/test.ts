import fs from "node:fs";
import path from "node:path";

import {DexFile} from "../src/dexfile";
import {DexClassLoader} from "../src/classloader";
import {DexClassDumper} from "../src/classdump";


const dexPath = path.resolve(__dirname, "boot-okhttp.dex");
const buf = fs.readFileSync(dexPath);

const dex = new DexFile(buf);
const loader = new DexClassLoader(dex);

function testDexHeader() {
    console.log("magic:", dex.header.magic);
    console.log("fileSize:", dex.header.fileSize);
    console.log("stringIds:", dex.header.stringIdsSize);
    console.log("typeIds:", dex.header.typeIdsSize);
    console.log("protoIds:", dex.header.protoIdsSize);
    console.log("fieldIds:", dex.header.fieldIdsSize);
    console.log("methodIds:", dex.header.methodIdsSize);
    console.log("classDefs:", dex.header.classDefsSize);
}

function testDexCode() {
    const classDef = dex.getClassDefByDescriptor("Lcom/android/okhttp/Connection;")
    const classData = dex.getClassData(classDef!);

    // public boolean com.android.okhttp.Connection.isReadable()
    const method = classData.virtualMethods[11];
    const code = dex.getDexCode(method);
    console.log("code:", code);

    const debugInfo = dex.getDexDebugInfo(code!);
    console.log("debugInfo:", debugInfo);
}

function testClassLoder() {
    const cls = loader.findClass("com.android.okhttp.Request");
    console.log("class:", cls);

    const cls2 = loader.findClassResolved("com.android.okhttp.Request")
    console.log("class2: ", cls2);
}

function testClassDump() {

    const cls = loader.findClass("com.android.okhttp.Request");
    const cls2 = loader.findClassResolved("com.android.okhttp.Request")

    let code1 = DexClassDumper.dump(cls!);
    let code2 = DexClassDumper.dump(cls2!);

    console.log(code1)
    console.log(code2)
}

// testDexCode();
testClassDump();
