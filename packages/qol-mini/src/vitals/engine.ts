// The two WebAssembly calls the gate runner makes. Node provides the global;
// its types live in the DOM library, which this project does not load.
type Engine = {
  compile: (bytes: Uint8Array) => Promise<object>;
  instantiate: (module: object, imports: object) => Promise<object>;
};

export const engine = (globalThis as unknown as { WebAssembly: Engine }).WebAssembly;
