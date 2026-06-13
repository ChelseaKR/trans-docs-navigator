// Hand-written declarations for resume-crypto.js (the runtime module is plain JS so
// the browser can import it unbundled; src/secure-resume.ts re-exports through this).
export declare const PBKDF2_ITERATIONS: number;
export declare function encryptState(plaintext: string, passphrase: string): Promise<string>;
export declare function decryptState(blob: string, passphrase: string): Promise<string>;
