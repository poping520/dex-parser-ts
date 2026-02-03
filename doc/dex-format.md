# DEX 如何被解析（解析路线图）

本文档聚焦：**DEX 文件的解析顺序与数据依赖关系**。核心思想是：DEX 的所有“表（table）”都靠 **Header 给出的 `size/off`** 定位；很多条目的字段不是直接字符串，而是“索引到另一张表”，解析时需要按依赖逐层解引用。

## 1. 解析入口：先读 Header，得到所有 section 的索引

解析 DEX 的第一步永远是读取 **Header（通常 0x70 字节）**，拿到每个 section 的：

- **大小（`xxxIdsSize`）**
- **偏移（`xxxIdsOff`）**

之后所有解析都建立在这些偏移上。

常用的索引表（ids sections）包括：

- `string_ids`（每个条目指向一个 `string_data_item`）
- `type_ids`（每个条目指向一个“描述符字符串”）
- `proto_ids`（方法原型：返回类型 + 参数列表偏移 + shorty 字符串索引）
- `field_ids`（字段三元组：class/type/name）
- `method_ids`（方法三元组：class/proto/name）
- `class_defs`（类定义：class/super/… + class_data/code 等偏移）

## 2. DEX 整体数据结构（高层视图）

```text
+------------------------------+
| header (固定 0x70 字节)      |
+------------------------------+
| link section (可选)          |
+------------------------------+
| map_list (可选，但常见)      |
+------------------------------+
| string_ids (u4[]，定长)      |
+------------------------------+
| type_ids (u4[]，定长)        |
+------------------------------+
| proto_ids (定长)             |
+------------------------------+
| field_ids (定长)             |
+------------------------------+
| method_ids (定长)            |
+------------------------------+
| class_defs (定长)            |
+------------------------------+
| data section (变长数据集合)  |
|  - string_data_item ...      |
|  - type_list ...             |
|  - class_data_item ...       |
|  - code_item ...             |
|  - annotations ...           |
|  - debug_info_item ...       |
|  - ...                       |
+------------------------------+
```

> 注：文件内部排列可能不完全固定，但解析必须以 Header 的 offset/size 为准。

## 3. 解析路线图（从“表”到“内容”）

下图表示常见依赖关系（箭头表示“需要进一步解引用/跳转才能拿到最终内容”）：

```text
Header
  |
  +--> string_ids[i] -> string_data_off -> string_data_item -> (string)
  |
  +--> type_ids[i]   -> descriptor_idx -> string_ids[descriptor_idx] -> (type descriptor string)
  |
  +--> proto_ids[i]  -> (return_type_idx -> type_ids) + (parameters_off -> type_list) + (shorty_idx -> string_ids)
  |
  +--> field_ids[i]  -> (class_idx -> type_ids) + (type_idx -> type_ids) + (name_idx -> string_ids)
  |
  +--> method_ids[i] -> (class_idx -> type_ids) + (proto_idx -> proto_ids) + (name_idx -> string_ids)
  |
  +--> class_defs[i] -> class_idx/superclass_idx -> type_ids -> string_ids
                    -> interfaces_off -> type_list
                    -> source_file_idx -> string_ids
                    -> class_data_off -> class_data_item -> encoded_method -> code_off -> code_item
```

## 4. 读取字符串（DEX 解析中最基础的一环）

几乎所有“可读信息”（类型描述符、方法名、字段名、shorty 等）最终都会落到 **string** 上，因此字符串解析是基础能力。

### 4.1 string 的两层结构：`string_ids` -> `string_data_item`

- **`string_ids`**：定长数组，每个条目 4 字节
  - 内容是 `string_data_off`（指向 data 区）
- **`string_data_item`**：变长
  - `uleb128 utf16_size`（UTF-16 code unit 数量）
  - `MUTF-8 bytes` + `0x00`（以 0 结尾）

### 4.2 读取流程（规范层面的步骤）

给定 `string_idx`：

1. **从 Header 定位 `string_ids` 表**
   - `string_ids_off = header.stringIdsOff`
   - `string_ids_size = header.stringIdsSize`
2. **在 `string_ids` 中找到第 `string_idx` 个条目**
   - `string_id_item_off = string_ids_off + string_idx * 4`
3. **读取 `string_data_off`**（一个 `u4`）
4. **跳转到 `string_data_off` 处读取 `string_data_item`**
   - 先读 `uleb128 utf16_size`
   - 再读取后续的字节序列，直到遇到 `0x00`
   - 按 MUTF-8 解码得到字符串

> 本项目目前的实现：对常见文本按 UTF-8 解码通常可用，但严格来说 DEX 使用的是 **MUTF-8**。

## 5. 基于字符串之上的常见解析

### 5.1 解析类型描述符（type descriptor）

给定 `type_idx`：

1. 在 `type_ids[type_idx]` 取到 `descriptor_idx`
2. 将 `descriptor_idx` 作为 `string_idx`，走一遍“读取字符串”的流程

常见类型描述符示例：

- `Ljava/lang/String;`
- `I`（int）
- `[B`（byte[]）

### 5.2 解析方法/字段标识（method_id / field_id）

这些条目本质上是“索引拼装”：

- `field_id`：`(class_idx -> type)` + `(type_idx -> type)` + `(name_idx -> string)`
- `method_id`：`(class_idx -> type)` + `(proto_idx -> proto)` + `(name_idx -> string)`

调试时的经验：很多“看不懂的数字索引”，最终都会落到 `string_ids`（人类可读文本）或 `type_ids`（类型描述符字符串）。当你把索引逐层解引用到 string 后，结构就会清晰很多。

### 5.3 解析方法原型（proto_id）

`proto_id` 给出三块信息：

- `returnTypeIdx`：索引到 `type_ids`
- `parametersOff`：偏移到 data 区某个 `type_list`（参数类型列表）
- `shortyIdx`：索引到 `string_ids`（shorty 描述符字符串）

一个把 `methodIdx` 还原成“可读签名”的思路（伪代码）：

```ts
// 1) method_id_item
//   - class_idx: type_idx
//   - proto_idx: proto_idx
//   - name_idx:  string_idx
// 2) proto_id_item
//   - return_type_idx: type_idx
//   - parameters_off:  type_list_off (0 means empty)
// 3) type_idx -> type_ids[type_idx].descriptor_idx -> string_ids[descriptor_idx] -> descriptor string
// 4) string_idx -> string_ids[string_idx] -> string_data_item -> string

// signature = <declaringClass>.<name>(<paramTypes...>): <returnType>
```

### 5.4 解析类定义（class_def_item）到“可读类名”

`class_def_item` 自身依然是索引集合（很多字段最终都会落到 string/type 上）：

- `classIdx`：这个类自己的类型（type_idx）
- `superclassIdx`：父类类型（type_idx），特殊值 `0xffffffff` 表示无父类（通常当作 `java.lang.Object`）
- `interfacesOff`：接口列表 `type_list` 的偏移（可能为 0）
- `sourceFileIdx`：源文件名（string_idx），可能为 `0xffffffff`

常见还原目标：

- 类名：`classIdx (type_idx)` -> `type_ids` -> `string_ids` -> descriptor -> 进一步转成点分格式
- 父类名：`superclassIdx (type_idx)` 同上（特殊值 `0xffffffff`）
- 接口列表：`interfacesOff` 指向 `type_list`，逐个 `type_idx` 走 type 解引用
- 源文件名：`sourceFileIdx (string_idx)` 走 string 解引用（特殊值 `0xffffffff`）

### 5.5 从 class_data_item 还原字段/方法列表（索引增量编码）

`class_data_item`（即 `DexClassDef.classDataOff` 指向的数据）存储了：

- staticFields / instanceFields
- directMethods / virtualMethods

这里有一个非常关键的点：`encoded_field.field_idx_diff` / `encoded_method.method_idx_diff` 是**增量（diff）编码**，不是绝对索引。

还原方式（要点）：

- 读取每个 encoded_field / encoded_method 时，先维护一个累计的 `field_idx` / `method_idx`
- 对每一项：
  - `field_idx += field_idx_diff`
  - `method_idx += method_idx_diff`
- 然后用得到的绝对 `field_idx` / `method_idx` 去 `field_ids` / `method_ids` 表中读取条目

调试建议：当你看到某个类“字段/方法数量不对”时，优先检查是否正确处理了 diff 累加。
