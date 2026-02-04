# libdex-ts

这是一个用于解析 Android DEX 文件的 TypeScript 库，提供：

- 读取并解析 DEX Header / string_ids / type_ids / proto_ids / field_ids / method_ids / class_defs 等结构
- 基于解析结果进行简单的“类视图”抽象（字段/方法/继承/接口）
- 将类信息以接近 Java 语法的文本形式 dump 输出

## 安装

```bash
npm i libdex-ts
```

## 快速使用

```ts
import { DexFile, DexClassLoader, DexClassDumper } from "libdex-ts";
import { readFileSync } from "node:fs";

const bytes = new Uint8Array(readFileSync("classes.dex"));
const dex = new DexFile(bytes);

const loader = new DexClassLoader(dex);
const cls = loader.findClass("com.foo.FooClass");
if (cls) {
  console.log(DexClassDumper.dump(cls));
}
```

## API 概览

### DexFile

- `new DexFile(bytes: Uint8Array)`
  - 创建并解析一个 DEX 文件
- `DexFile.from(bytes: Uint8Array)`
  - 静态创建方式（等价于 `new DexFile(bytes)`）
- `dex.buffer: ByteBuffer`
  - 底层读取用的缓冲区（提供顺序/随机读取能力）
- `dex.header: DexHeader`
  - 解析后的 DEX Header
- `dex.getStringDataOffset(stringIdx: number): number`
  - 获取 `string_ids[stringIdx]` 对应的 `string_data_item` 偏移
- `dex.getStringById(stringIdx: number): string`
  - 读取字符串表中的字符串（内部有缓存）
- `dex.getTypeDescriptorByIdx(typeIdx: number): string`
  - 获取类型描述符（例如 `Ljava/lang/String;`）
- `dex.getClassNameByIdx(typeIdx: number): string`
  - 将类型描述符转换为点分形式（例如 `java.lang.String`）
- `dex.getTypeListByOff(off: number): DexTypeList`
  - 读取 `type_list`（通常用于接口列表、方法参数列表等）
- `dex.getProtoId(protoIdx: number): DexProtoId`
  - 读取 `proto_id_item`
- `dex.getFieldId(fieldIdx: number): DexFieldId`
  - 读取 `field_id_item`
- `dex.getMethodId(methodIdx: number): DexMethodId`
  - 读取 `method_id_item`
- `dex.getClassDef(classDefIdx: number): DexClassDef`
  - 读取 `class_def_item`
- `dex.getInterfacesList(classDef: DexClassDef): DexTypeList | null`
  - 获取类实现的接口列表（没有则返回 `null`）
- `dex.getMapList(): DexMapItem[]`
  - 读取 `map_list`（DEX 各 section 分布信息）
- `dex.getClassDefByDescriptor(descriptor: string): DexClassDef | null`
  - 通过 descriptor 查找类定义（例如 `Ljava/lang/String;`）
- `dex.getClassData(classDef: DexClassDef): DexClassData`
  - 读取 `class_data_item`（字段/方法定义，ULEB128 编码）

### DexClassLoader

- `new DexClassLoader(dexFile: DexFile)`
  - 基于 `DexFile` 创建类加载器（带缓存）
- `loader.findClass(className: string)`
  - 解析并返回类的“原始视图”（字段/方法/继承/接口的字符串引用）
- `loader.findClass(className: string, { resolveRefs: true })`
  - 返回“解析引用后的视图”，把字段/方法的类型引用解析为具体类对象（不存在则为 stub）

### DexClassDumper

- `DexClassDumper.dump(javaClass): string`
  - 将 `DexClassLoader.findClass(...)` 返回的类信息 dump 成接近 Java 语法的文本

## 更多 DEX 格式说明

如果你想更深入了解 DEX 文件的结构与解析顺序，请查看：[doc/dex-format.md](./doc/dex-format.md)。
