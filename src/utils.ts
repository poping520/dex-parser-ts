export namespace DexUtils {
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
}