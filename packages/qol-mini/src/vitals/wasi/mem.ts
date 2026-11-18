export type Memory = { buffer: ArrayBuffer };

const LE = true;
const IOVEC = 8;

// The guest's linear memory. It can grow: every access takes a fresh view.
export class Mem {
  readonly #memory: Memory;
  public constructor(memory: Memory) {
    this.#memory = memory;
  }
  public get bytes(): Uint8Array {
    return new Uint8Array(this.#memory.buffer);
  }
  public get view(): DataView {
    return new DataView(this.#memory.buffer);
  }
  public text(ptr: number, len: number): string {
    return Buffer.from(this.bytes.subarray(ptr, ptr + len)).toString("utf8");
  }
  public put(ptr: number, data: Uint8Array): void {
    this.bytes.set(data, ptr);
  }
  public u8(ptr: number, value: number): void {
    this.view.setUint8(ptr, value);
  }
  public u32(ptr: number, value: number): void {
    this.view.setUint32(ptr, value, LE);
  }
  public u64(ptr: number, value: bigint): void {
    this.view.setBigUint64(ptr, value, LE);
  }
  // The buffers of an iovec array, as views into the memory
  public iovecs(ptr: number, count: number): Uint8Array[] {
    const { view, bytes } = this;
    return Array.from({ length: count }, (_unused, i) => {
      const at = view.getUint32(ptr + i * IOVEC, LE);
      return bytes.subarray(at, at + view.getUint32(ptr + i * IOVEC + 4, LE));
    });
  }
}
