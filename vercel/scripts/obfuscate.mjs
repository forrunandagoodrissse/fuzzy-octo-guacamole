import JavaScriptObfuscator from "javascript-obfuscator";

/** @type {import('javascript-obfuscator').ObfuscatorOptions} */
export const OBFUSCATOR_OPTIONS = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.5,
  deadCodeInjection: false,
  debugProtection: false,
  disableConsoleOutput: false,
  identifierNamesGenerator: "hexadecimal",
  log: false,
  numbersToExpressions: true,
  renameGlobals: false,
  selfDefending: false,
  simplify: true,
  splitStrings: true,
  splitStringsChunkLength: 8,
  stringArray: true,
  stringArrayCallsTransform: true,
  stringArrayEncoding: ["base64"],
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayWrappersCount: 1,
  stringArrayWrappersChainedCalls: true,
  stringArrayWrappersType: "function",
  transformObjectKeys: true,
  unicodeEscapeSequence: false,
  reservedNames: ["^__WALLET_EMBED_CONFIG__$", "^ReownWalletEmbed$"],
  reservedStrings: [
    "__WALLET_EMBED_CONFIG__",
    "wallet-connect-init",
    "wallet-connect-retry",
    "wallet-connect-popup-ready",
  ],
};

/**
 * @param {string} source
 * @param {import('javascript-obfuscator').ObfuscatorOptions} [overrides]
 */
export function obfuscateJs(source, overrides = {}) {
  return JavaScriptObfuscator.obfuscate(source, {
    ...OBFUSCATOR_OPTIONS,
    ...overrides,
  }).getObfuscatedCode();
}
