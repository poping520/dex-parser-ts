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

## 6. 从方法定义走到字节码：code_item

大多数进一步的分析（反汇编、控制流、异常处理、调试信息）都依赖 `code_item`。

解析入口通常来自：

- `class_def_item.class_data_off` -> `class_data_item`
- `class_data_item` 内的 `encoded_method.code_off` -> `code_item`

### 6.1 code_item 的头部

`code_item` 的头部字段是定长的：

- `registers_size`：寄存器数量
- `ins_size`：入参寄存器数量
- `outs_size`：调用其它方法时的参数寄存器数量
- `tries_size`：`try_item` 条目数
- `debug_info_off`：调试信息偏移（0 表示无）
- `insns_size`：指令数组长度（以 `u2` 为单位）

随后是 `insns[insns_size]`，即 Dalvik 指令流（每个元素为 16-bit code unit）。

### 6.2 try-catch 与对齐填充

如果 `tries_size > 0`，那么 `insns` 后面会跟异常处理相关的数据。需要注意一个容易踩坑的规则：

- `try_item` 结构要求 32-bit 对齐
- 因此当 `insns_size` 为奇数时，`insns` 末尾会有一个额外的 `u2 padding` 用于对齐

之后依次是：

- `try_item[tries_size]`
- `encoded_catch_handler_list`

### 6.3 try_item

每个 `try_item` 描述一个 try 的覆盖范围以及其异常处理入口：

- `start_addr`：起始地址（以 16-bit code unit 计）
- `insn_count`：覆盖长度（同样以 16-bit code unit 计）
- `handler_off`：指向 `encoded_catch_handler_list` 内某个 handler 的偏移

`handler_off` 的基准是 `encoded_catch_handler_list` 起始处（即其 `size` 字段的起点），不是 `insns` 的起点。

### 6.4 encoded_catch_handler_list / encoded_catch_handler

异常处理器列表采用 LEB128 编码，结构为：

- `uleb128 size`：handler 列表数量
- 重复 `size` 次：`encoded_catch_handler`

每个 `encoded_catch_handler`：

- `sleb128 size`
  - `size > 0`：有 `size` 个 `type_addr_pair`，且没有 catch-all
  - `size <= 0`：有 `-size` 个 `type_addr_pair`，并且末尾额外有一个 `catch_all_addr`
- `type_addr_pair[]`：每个由
  - `uleb128 type_idx`（异常类型索引）
  - `uleb128 addr`（处理器入口地址）
- 可选的 `catch_all_addr`：用于匹配任意异常类型

解析时常见做法是：先把 `encoded_catch_handler_list` 里的各个 handler 的起始偏移记录下来，之后用 `try_item.handler_off` 去匹配。

## 7. debug_info_item：位置表与局部变量表

`debug_info_item` 用于把指令地址映射到源码行号，并描述某些寄存器在特定范围内对应的局部变量。

### 7.1 头部

debug info 由“头部 + opcode 流”构成：

- `uleb128 line_start`
- `uleb128 parameters_size`
- `uleb128p1 parameter_names[parameters_size]`
  - 这里的索引是“+1 编码”：0 表示无名称，否则真实索引为 `n-1`
- `u1 opcodes[]`

### 7.2 opcode 流（概念）

解析器通常维护两个状态变量：

- `address`：当前指令地址（以 16-bit code unit 计）
- `line`：当前行号

常见 opcode（只描述语义，不展开全部细节）：

- `DBG_ADVANCE_PC`：`address += uleb128`
- `DBG_ADVANCE_LINE`：`line += sleb128`
- `DBG_START_LOCAL` / `DBG_END_LOCAL` / `DBG_RESTART_LOCAL`：开始/结束/恢复某寄存器上的局部变量
- `DBG_SET_FILE`：设置源文件名
- special opcode：同时调整 `address` 与 `line`，并产生一个“位置表项（position entry）”

注意：局部变量的描述是“寄存器在某个范围内代表哪个变量”，因此解析时需要维护每个寄存器的 live 状态，并在变量结束时生成一个区间（start/end address）。
