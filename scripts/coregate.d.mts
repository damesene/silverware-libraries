// Types of scripts/coregate.mjs, for the TypeScript tests importing it
export declare const NEEDS: Readonly<Record<string, string>>;
export declare const GATE_MARK: string;
export declare function keyOf(library: string): string;
export declare function apiFunctionsOf(key: string, apiPage: string): string[];
export declare function gateBlock(gate: { key: string; title: string; need: string; stubs: readonly string[] }): string;
export declare function withGate(page: string, block: string): string;
export declare function validateGuarded(page: string, key: string): string | undefined;
export declare function gatePages(library: string): Promise<{ api: string | undefined; init: string | undefined; title: string | undefined; gatePath: string }>;
export declare function coreGates(check: boolean): Promise<number>;
export declare function validateOthersTaken(page: string, key: string, stubs: Readonly<Record<string, readonly string[]>>): string | undefined;
