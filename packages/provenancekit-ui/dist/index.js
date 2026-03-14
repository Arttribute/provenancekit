var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/context/provenance-kit-provider.tsx
import { createContext, useContext, useMemo } from "react";

// ../../node_modules/.pnpm/@noble+ed25519@3.0.0/node_modules/@noble/ed25519/index.js
var ed25519_CURVE = {
  p: 0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffedn,
  n: 0x1000000000000000000000000000000014def9dea2f79cd65812631a5cf5d3edn,
  h: 8n,
  a: 0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffecn,
  d: 0x52036cee2b6ffe738cc740797779e89800700a4d4141d8ab75eb4dca135978a3n,
  Gx: 0x216936d3cd6e53fec0a4e231fdd6dc5c692cc7609525a7b2c9562d608f25d51an,
  Gy: 0x6666666666666666666666666666666666666666666666666666666666666658n
};
var { p: P, n: N, Gx, Gy, a: _a, d: _d, h } = ed25519_CURVE;
var L = 32;
var L2 = 64;
var captureTrace = (...args) => {
  if ("captureStackTrace" in Error && typeof Error.captureStackTrace === "function") {
    Error.captureStackTrace(...args);
  }
};
var err = (message = "") => {
  const e = new Error(message);
  captureTrace(e, err);
  throw e;
};
var isBig = (n) => typeof n === "bigint";
var isStr = (s) => typeof s === "string";
var isBytes = (a) => a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array";
var abytes = (value, length, title = "") => {
  const bytes = isBytes(value);
  const len = value?.length;
  const needsLen = length !== void 0;
  if (!bytes || needsLen && len !== length) {
    const prefix = title && `"${title}" `;
    const ofLen = needsLen ? ` of length ${length}` : "";
    const got = bytes ? `length=${len}` : `type=${typeof value}`;
    err(prefix + "expected Uint8Array" + ofLen + ", got " + got);
  }
  return value;
};
var u8n = (len) => new Uint8Array(len);
var u8fr = (buf) => Uint8Array.from(buf);
var padh = (n, pad) => n.toString(16).padStart(pad, "0");
var bytesToHex = (b) => Array.from(abytes(b)).map((e) => padh(e, 2)).join("");
var C = { _0: 48, _9: 57, A: 65, F: 70, a: 97, f: 102 };
var _ch = (ch) => {
  if (ch >= C._0 && ch <= C._9)
    return ch - C._0;
  if (ch >= C.A && ch <= C.F)
    return ch - (C.A - 10);
  if (ch >= C.a && ch <= C.f)
    return ch - (C.a - 10);
  return;
};
var hexToBytes = (hex) => {
  const e = "hex invalid";
  if (!isStr(hex))
    return err(e);
  const hl = hex.length;
  const al = hl / 2;
  if (hl % 2)
    return err(e);
  const array = u8n(al);
  for (let ai = 0, hi = 0; ai < al; ai++, hi += 2) {
    const n1 = _ch(hex.charCodeAt(hi));
    const n2 = _ch(hex.charCodeAt(hi + 1));
    if (n1 === void 0 || n2 === void 0)
      return err(e);
    array[ai] = n1 * 16 + n2;
  }
  return array;
};
var cr = () => globalThis?.crypto;
var subtle = () => cr()?.subtle ?? err("crypto.subtle must be defined, consider polyfill");
var concatBytes = (...arrs) => {
  const r = u8n(arrs.reduce((sum, a) => sum + abytes(a).length, 0));
  let pad = 0;
  arrs.forEach((a) => {
    r.set(a, pad);
    pad += a.length;
  });
  return r;
};
var big = BigInt;
var assertRange = (n, min, max, msg = "bad number: out of range") => isBig(n) && min <= n && n < max ? n : err(msg);
var M = (a, b = P) => {
  const r = a % b;
  return r >= 0n ? r : b + r;
};
var modN = (a) => M(a, N);
var invert = (num, md) => {
  if (num === 0n || md <= 0n)
    err("no inverse n=" + num + " mod=" + md);
  let a = M(num, md), b = md, x = 0n, y = 1n, u = 1n, v = 0n;
  while (a !== 0n) {
    const q = b / a, r = b % a;
    const m = x - u * q, n = y - v * q;
    b = a, a = r, x = u, y = v, u = m, v = n;
  }
  return b === 1n ? M(x, md) : err("no inverse");
};
var apoint = (p) => p instanceof Point ? p : err("Point expected");
var B256 = 2n ** 256n;
var Point = class _Point {
  static BASE;
  static ZERO;
  X;
  Y;
  Z;
  T;
  constructor(X2, Y, Z, T) {
    const max = B256;
    this.X = assertRange(X2, 0n, max);
    this.Y = assertRange(Y, 0n, max);
    this.Z = assertRange(Z, 1n, max);
    this.T = assertRange(T, 0n, max);
    Object.freeze(this);
  }
  static CURVE() {
    return ed25519_CURVE;
  }
  static fromAffine(p) {
    return new _Point(p.x, p.y, 1n, M(p.x * p.y));
  }
  /** RFC8032 5.1.3: Uint8Array to Point. */
  static fromBytes(hex, zip215 = false) {
    const d = _d;
    const normed = u8fr(abytes(hex, L));
    const lastByte = hex[31];
    normed[31] = lastByte & ~128;
    const y = bytesToNumLE(normed);
    const max = zip215 ? B256 : P;
    assertRange(y, 0n, max);
    const y2 = M(y * y);
    const u = M(y2 - 1n);
    const v = M(d * y2 + 1n);
    let { isValid: isValid2, value: x } = uvRatio(u, v);
    if (!isValid2)
      err("bad point: y not sqrt");
    const isXOdd = (x & 1n) === 1n;
    const isLastByteOdd = (lastByte & 128) !== 0;
    if (!zip215 && x === 0n && isLastByteOdd)
      err("bad point: x==0, isLastByteOdd");
    if (isLastByteOdd !== isXOdd)
      x = M(-x);
    return new _Point(x, y, 1n, M(x * y));
  }
  static fromHex(hex, zip215) {
    return _Point.fromBytes(hexToBytes(hex), zip215);
  }
  get x() {
    return this.toAffine().x;
  }
  get y() {
    return this.toAffine().y;
  }
  /** Checks if the point is valid and on-curve. */
  assertValidity() {
    const a = _a;
    const d = _d;
    const p = this;
    if (p.is0())
      return err("bad point: ZERO");
    const { X: X2, Y, Z, T } = p;
    const X22 = M(X2 * X2);
    const Y2 = M(Y * Y);
    const Z2 = M(Z * Z);
    const Z4 = M(Z2 * Z2);
    const aX2 = M(X22 * a);
    const left = M(Z2 * M(aX2 + Y2));
    const right = M(Z4 + M(d * M(X22 * Y2)));
    if (left !== right)
      return err("bad point: equation left != right (1)");
    const XY = M(X2 * Y);
    const ZT = M(Z * T);
    if (XY !== ZT)
      return err("bad point: equation left != right (2)");
    return this;
  }
  /** Equality check: compare points P&Q. */
  equals(other) {
    const { X: X1, Y: Y1, Z: Z1 } = this;
    const { X: X2, Y: Y2, Z: Z2 } = apoint(other);
    const X1Z2 = M(X1 * Z2);
    const X2Z1 = M(X2 * Z1);
    const Y1Z2 = M(Y1 * Z2);
    const Y2Z1 = M(Y2 * Z1);
    return X1Z2 === X2Z1 && Y1Z2 === Y2Z1;
  }
  is0() {
    return this.equals(I);
  }
  /** Flip point over y coordinate. */
  negate() {
    return new _Point(M(-this.X), this.Y, this.Z, M(-this.T));
  }
  /** Point doubling. Complete formula. Cost: `4M + 4S + 1*a + 6add + 1*2`. */
  double() {
    const { X: X1, Y: Y1, Z: Z1 } = this;
    const a = _a;
    const A = M(X1 * X1);
    const B = M(Y1 * Y1);
    const C2 = M(2n * M(Z1 * Z1));
    const D = M(a * A);
    const x1y1 = X1 + Y1;
    const E = M(M(x1y1 * x1y1) - A - B);
    const G3 = D + B;
    const F = G3 - C2;
    const H2 = D - B;
    const X3 = M(E * F);
    const Y3 = M(G3 * H2);
    const T3 = M(E * H2);
    const Z3 = M(F * G3);
    return new _Point(X3, Y3, Z3, T3);
  }
  /** Point addition. Complete formula. Cost: `8M + 1*k + 8add + 1*2`. */
  add(other) {
    const { X: X1, Y: Y1, Z: Z1, T: T1 } = this;
    const { X: X2, Y: Y2, Z: Z2, T: T2 } = apoint(other);
    const a = _a;
    const d = _d;
    const A = M(X1 * X2);
    const B = M(Y1 * Y2);
    const C2 = M(T1 * d * T2);
    const D = M(Z1 * Z2);
    const E = M((X1 + Y1) * (X2 + Y2) - A - B);
    const F = M(D - C2);
    const G3 = M(D + C2);
    const H2 = M(B - a * A);
    const X3 = M(E * F);
    const Y3 = M(G3 * H2);
    const T3 = M(E * H2);
    const Z3 = M(F * G3);
    return new _Point(X3, Y3, Z3, T3);
  }
  subtract(other) {
    return this.add(apoint(other).negate());
  }
  /**
   * Point-by-scalar multiplication. Scalar must be in range 1 <= n < CURVE.n.
   * Uses {@link wNAF} for base point.
   * Uses fake point to mitigate side-channel leakage.
   * @param n scalar by which point is multiplied
   * @param safe safe mode guards against timing attacks; unsafe mode is faster
   */
  multiply(n, safe = true) {
    if (!safe && (n === 0n || this.is0()))
      return I;
    assertRange(n, 1n, N);
    if (n === 1n)
      return this;
    if (this.equals(G))
      return wNAF(n).p;
    let p = I;
    let f = G;
    for (let d = this; n > 0n; d = d.double(), n >>= 1n) {
      if (n & 1n)
        p = p.add(d);
      else if (safe)
        f = f.add(d);
    }
    return p;
  }
  multiplyUnsafe(scalar) {
    return this.multiply(scalar, false);
  }
  /** Convert point to 2d xy affine point. (X, Y, Z) ∋ (x=X/Z, y=Y/Z) */
  toAffine() {
    const { X: X2, Y, Z } = this;
    if (this.equals(I))
      return { x: 0n, y: 1n };
    const iz = invert(Z, P);
    if (M(Z * iz) !== 1n)
      err("invalid inverse");
    const x = M(X2 * iz);
    const y = M(Y * iz);
    return { x, y };
  }
  toBytes() {
    const { x, y } = this.assertValidity().toAffine();
    const b = numTo32bLE(y);
    b[31] |= x & 1n ? 128 : 0;
    return b;
  }
  toHex() {
    return bytesToHex(this.toBytes());
  }
  clearCofactor() {
    return this.multiply(big(h), false);
  }
  isSmallOrder() {
    return this.clearCofactor().is0();
  }
  isTorsionFree() {
    let p = this.multiply(N / 2n, false).double();
    if (N % 2n)
      p = p.add(this);
    return p.is0();
  }
};
var G = new Point(Gx, Gy, 1n, M(Gx * Gy));
var I = new Point(0n, 1n, 1n, 0n);
Point.BASE = G;
Point.ZERO = I;
var numTo32bLE = (num) => hexToBytes(padh(assertRange(num, 0n, B256), L2)).reverse();
var bytesToNumLE = (b) => big("0x" + bytesToHex(u8fr(abytes(b)).reverse()));
var pow2 = (x, power) => {
  let r = x;
  while (power-- > 0n) {
    r *= r;
    r %= P;
  }
  return r;
};
var pow_2_252_3 = (x) => {
  const x2 = x * x % P;
  const b2 = x2 * x % P;
  const b4 = pow2(b2, 2n) * b2 % P;
  const b5 = pow2(b4, 1n) * x % P;
  const b10 = pow2(b5, 5n) * b5 % P;
  const b20 = pow2(b10, 10n) * b10 % P;
  const b40 = pow2(b20, 20n) * b20 % P;
  const b80 = pow2(b40, 40n) * b40 % P;
  const b160 = pow2(b80, 80n) * b80 % P;
  const b240 = pow2(b160, 80n) * b80 % P;
  const b250 = pow2(b240, 10n) * b10 % P;
  const pow_p_5_8 = pow2(b250, 2n) * x % P;
  return { pow_p_5_8, b2 };
};
var RM1 = 0x2b8324804fc1df0b2b4d00993dfbd7a72f431806ad2fe478c4ee1b274a0ea0b0n;
var uvRatio = (u, v) => {
  const v3 = M(v * v * v);
  const v7 = M(v3 * v3 * v);
  const pow = pow_2_252_3(u * v7).pow_p_5_8;
  let x = M(u * v3 * pow);
  const vx2 = M(v * x * x);
  const root1 = x;
  const root2 = M(x * RM1);
  const useRoot1 = vx2 === u;
  const useRoot2 = vx2 === M(-u);
  const noRoot = vx2 === M(-u * RM1);
  if (useRoot1)
    x = root1;
  if (useRoot2 || noRoot)
    x = root2;
  if ((M(x) & 1n) === 1n)
    x = M(-x);
  return { isValid: useRoot1 || useRoot2, value: x };
};
var modL_LE = (hash) => modN(bytesToNumLE(hash));
var sha512a = (...m) => hashes.sha512Async(concatBytes(...m));
var hash2extK = (hashed) => {
  const head = hashed.slice(0, L);
  head[0] &= 248;
  head[31] &= 127;
  head[31] |= 64;
  const prefix = hashed.slice(L, L2);
  const scalar = modL_LE(head);
  const point = G.multiply(scalar);
  const pointBytes = point.toBytes();
  return { head, prefix, scalar, point, pointBytes };
};
var getExtendedPublicKeyAsync = (secretKey) => sha512a(abytes(secretKey, L)).then(hash2extK);
var getPublicKeyAsync = (secretKey) => getExtendedPublicKeyAsync(secretKey).then((p) => p.pointBytes);
var hashFinishA = (res) => sha512a(res.hashable).then(res.finish);
var _sign = (e, rBytes, msg) => {
  const { pointBytes: P2, scalar: s } = e;
  const r = modL_LE(rBytes);
  const R = G.multiply(r).toBytes();
  const hashable = concatBytes(R, P2, msg);
  const finish = (hashed) => {
    const S = modN(r + modL_LE(hashed) * s);
    return abytes(concatBytes(R, numTo32bLE(S)), L2);
  };
  return { hashable, finish };
};
var signAsync = async (message, secretKey) => {
  const m = abytes(message);
  const e = await getExtendedPublicKeyAsync(secretKey);
  const rBytes = await sha512a(e.prefix, m);
  return hashFinishA(_sign(e, rBytes, m));
};
var hashes = {
  sha512Async: async (message) => {
    const s = subtle();
    const m = concatBytes(message);
    return u8n(await s.digest("SHA-512", m.buffer));
  },
  sha512: void 0
};
var W = 8;
var scalarBits = 256;
var pwindows = Math.ceil(scalarBits / W) + 1;
var pwindowSize = 2 ** (W - 1);
var precompute = () => {
  const points = [];
  let p = G;
  let b = p;
  for (let w = 0; w < pwindows; w++) {
    b = p;
    points.push(b);
    for (let i = 1; i < pwindowSize; i++) {
      b = b.add(p);
      points.push(b);
    }
    p = b.double();
  }
  return points;
};
var Gpows = void 0;
var ctneg = (cnd, p) => {
  const n = p.negate();
  return cnd ? n : p;
};
var wNAF = (n) => {
  const comp = Gpows || (Gpows = precompute());
  let p = I;
  let f = G;
  const pow_2_w = 2 ** W;
  const maxNum = pow_2_w;
  const mask = big(pow_2_w - 1);
  const shiftBy = big(W);
  for (let w = 0; w < pwindows; w++) {
    let wbits = Number(n & mask);
    n >>= shiftBy;
    if (wbits > pwindowSize) {
      wbits -= maxNum;
      n += 1n;
    }
    const off = w * pwindowSize;
    const offF = off;
    const offP = off + Math.abs(wbits) - 1;
    const isEven = w % 2 !== 0;
    const isNeg = wbits < 0;
    if (wbits === 0) {
      f = f.add(ctneg(isEven, comp[offF]));
    } else {
      p = p.add(ctneg(isNeg, comp[offP]));
    }
  }
  if (n !== 0n)
    err("invalid wnaf");
  return { p, f };
};

// ../provenancekit-sdk/dist/chunk-A65G23TF.mjs
function canonicalizeAction(payload) {
  const normalized = {
    actionType: payload.actionType,
    entityId: payload.entityId,
    inputs: [...payload.inputs].sort(),
    timestamp: payload.timestamp
  };
  return JSON.stringify(normalized, Object.keys(normalized).sort());
}
async function signAction(payload, privateKeyHex) {
  const privateKey = hexToBytes2(privateKeyHex);
  const publicKey = await getPublicKeyAsync(privateKey);
  const canonical = canonicalizeAction(payload);
  const message = new TextEncoder().encode(canonical);
  const sig = await signAsync(message, privateKey);
  return {
    algorithm: "Ed25519",
    publicKey: bytesToHex2(publicKey),
    signature: bytesToHex2(sig),
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function bytesToHex2(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function hexToBytes2(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

// ../../node_modules/.pnpm/@noble+ciphers@1.3.0/node_modules/@noble/ciphers/esm/utils.js
function isBytes2(a) {
  return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array";
}
function abool(b) {
  if (typeof b !== "boolean")
    throw new Error(`boolean expected, not ${b}`);
}
function anumber(n) {
  if (!Number.isSafeInteger(n) || n < 0)
    throw new Error("positive integer expected, got " + n);
}
function abytes2(b, ...lengths) {
  if (!isBytes2(b))
    throw new Error("Uint8Array expected");
  if (lengths.length > 0 && !lengths.includes(b.length))
    throw new Error("Uint8Array expected of length " + lengths + ", got length=" + b.length);
}
function aexists(instance, checkFinished = true) {
  if (instance.destroyed)
    throw new Error("Hash instance has been destroyed");
  if (checkFinished && instance.finished)
    throw new Error("Hash#digest() has already been called");
}
function aoutput(out, instance) {
  abytes2(out);
  const min = instance.outputLen;
  if (out.length < min) {
    throw new Error("digestInto() expects output buffer of length at least " + min);
  }
}
function u8(arr) {
  return new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
}
function u32(arr) {
  return new Uint32Array(arr.buffer, arr.byteOffset, Math.floor(arr.byteLength / 4));
}
function clean(...arrays) {
  for (let i = 0; i < arrays.length; i++) {
    arrays[i].fill(0);
  }
}
function createView(arr) {
  return new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
}
var isLE = /* @__PURE__ */ (() => new Uint8Array(new Uint32Array([287454020]).buffer)[0] === 68)();
function utf8ToBytes(str) {
  if (typeof str !== "string")
    throw new Error("string expected");
  return new Uint8Array(new TextEncoder().encode(str));
}
function toBytes(data) {
  if (typeof data === "string")
    data = utf8ToBytes(data);
  else if (isBytes2(data))
    data = copyBytes(data);
  else
    throw new Error("Uint8Array expected, got " + typeof data);
  return data;
}
function checkOpts(defaults, opts) {
  if (opts == null || typeof opts !== "object")
    throw new Error("options must be defined");
  const merged = Object.assign(defaults, opts);
  return merged;
}
function equalBytes(a, b) {
  if (a.length !== b.length)
    return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++)
    diff |= a[i] ^ b[i];
  return diff === 0;
}
var wrapCipher = /* @__NO_SIDE_EFFECTS__ */ (params, constructor) => {
  function wrappedCipher(key, ...args) {
    abytes2(key);
    if (!isLE)
      throw new Error("Non little-endian hardware is not yet supported");
    if (params.nonceLength !== void 0) {
      const nonce = args[0];
      if (!nonce)
        throw new Error("nonce / iv required");
      if (params.varSizeNonce)
        abytes2(nonce);
      else
        abytes2(nonce, params.nonceLength);
    }
    const tagl = params.tagLength;
    if (tagl && args[1] !== void 0) {
      abytes2(args[1]);
    }
    const cipher = constructor(key, ...args);
    const checkOutput = (fnLength, output) => {
      if (output !== void 0) {
        if (fnLength !== 2)
          throw new Error("cipher output not supported");
        abytes2(output);
      }
    };
    let called = false;
    const wrCipher = {
      encrypt(data, output) {
        if (called)
          throw new Error("cannot encrypt() twice with same key + nonce");
        called = true;
        abytes2(data);
        checkOutput(cipher.encrypt.length, output);
        return cipher.encrypt(data, output);
      },
      decrypt(data, output) {
        abytes2(data);
        if (tagl && data.length < tagl)
          throw new Error("invalid ciphertext length: smaller than tagLength=" + tagl);
        checkOutput(cipher.decrypt.length, output);
        return cipher.decrypt(data, output);
      }
    };
    return wrCipher;
  }
  Object.assign(wrappedCipher, params);
  return wrappedCipher;
};
function getOutput(expectedLength, out, onlyAligned = true) {
  if (out === void 0)
    return new Uint8Array(expectedLength);
  if (out.length !== expectedLength)
    throw new Error("invalid output length, expected " + expectedLength + ", got: " + out.length);
  if (onlyAligned && !isAligned32(out))
    throw new Error("invalid output, must be aligned");
  return out;
}
function setBigUint64(view, byteOffset, value, isLE2) {
  if (typeof view.setBigUint64 === "function")
    return view.setBigUint64(byteOffset, value, isLE2);
  const _32n2 = BigInt(32);
  const _u32_max = BigInt(4294967295);
  const wh = Number(value >> _32n2 & _u32_max);
  const wl = Number(value & _u32_max);
  const h2 = isLE2 ? 4 : 0;
  const l = isLE2 ? 0 : 4;
  view.setUint32(byteOffset + h2, wh, isLE2);
  view.setUint32(byteOffset + l, wl, isLE2);
}
function u64Lengths(dataLength, aadLength, isLE2) {
  abool(isLE2);
  const num = new Uint8Array(16);
  const view = createView(num);
  setBigUint64(view, 0, BigInt(aadLength), isLE2);
  setBigUint64(view, 8, BigInt(dataLength), isLE2);
  return num;
}
function isAligned32(bytes) {
  return bytes.byteOffset % 4 === 0;
}
function copyBytes(bytes) {
  return Uint8Array.from(bytes);
}

// ../../node_modules/.pnpm/@noble+ciphers@1.3.0/node_modules/@noble/ciphers/esm/_arx.js
var _utf8ToBytes = (str) => Uint8Array.from(str.split("").map((c) => c.charCodeAt(0)));
var sigma16 = _utf8ToBytes("expand 16-byte k");
var sigma32 = _utf8ToBytes("expand 32-byte k");
var sigma16_32 = u32(sigma16);
var sigma32_32 = u32(sigma32);
function rotl(a, b) {
  return a << b | a >>> 32 - b;
}
function isAligned322(b) {
  return b.byteOffset % 4 === 0;
}
var BLOCK_LEN = 64;
var BLOCK_LEN32 = 16;
var MAX_COUNTER = 2 ** 32 - 1;
var U32_EMPTY = new Uint32Array();
function runCipher(core, sigma, key, nonce, data, output, counter, rounds) {
  const len = data.length;
  const block = new Uint8Array(BLOCK_LEN);
  const b32 = u32(block);
  const isAligned = isAligned322(data) && isAligned322(output);
  const d32 = isAligned ? u32(data) : U32_EMPTY;
  const o32 = isAligned ? u32(output) : U32_EMPTY;
  for (let pos = 0; pos < len; counter++) {
    core(sigma, key, nonce, b32, counter, rounds);
    if (counter >= MAX_COUNTER)
      throw new Error("arx: counter overflow");
    const take = Math.min(BLOCK_LEN, len - pos);
    if (isAligned && take === BLOCK_LEN) {
      const pos32 = pos / 4;
      if (pos % 4 !== 0)
        throw new Error("arx: invalid block position");
      for (let j = 0, posj; j < BLOCK_LEN32; j++) {
        posj = pos32 + j;
        o32[posj] = d32[posj] ^ b32[j];
      }
      pos += BLOCK_LEN;
      continue;
    }
    for (let j = 0, posj; j < take; j++) {
      posj = pos + j;
      output[posj] = data[posj] ^ block[j];
    }
    pos += take;
  }
}
function createCipher(core, opts) {
  const { allowShortKeys, extendNonceFn, counterLength, counterRight, rounds } = checkOpts({ allowShortKeys: false, counterLength: 8, counterRight: false, rounds: 20 }, opts);
  if (typeof core !== "function")
    throw new Error("core must be a function");
  anumber(counterLength);
  anumber(rounds);
  abool(counterRight);
  abool(allowShortKeys);
  return (key, nonce, data, output, counter = 0) => {
    abytes2(key);
    abytes2(nonce);
    abytes2(data);
    const len = data.length;
    if (output === void 0)
      output = new Uint8Array(len);
    abytes2(output);
    anumber(counter);
    if (counter < 0 || counter >= MAX_COUNTER)
      throw new Error("arx: counter overflow");
    if (output.length < len)
      throw new Error(`arx: output (${output.length}) is shorter than data (${len})`);
    const toClean = [];
    let l = key.length;
    let k;
    let sigma;
    if (l === 32) {
      toClean.push(k = copyBytes(key));
      sigma = sigma32_32;
    } else if (l === 16 && allowShortKeys) {
      k = new Uint8Array(32);
      k.set(key);
      k.set(key, 16);
      sigma = sigma16_32;
      toClean.push(k);
    } else {
      throw new Error(`arx: invalid 32-byte key, got length=${l}`);
    }
    if (!isAligned322(nonce))
      toClean.push(nonce = copyBytes(nonce));
    const k32 = u32(k);
    if (extendNonceFn) {
      if (nonce.length !== 24)
        throw new Error(`arx: extended nonce must be 24 bytes`);
      extendNonceFn(sigma, k32, u32(nonce.subarray(0, 16)), k32);
      nonce = nonce.subarray(16);
    }
    const nonceNcLen = 16 - counterLength;
    if (nonceNcLen !== nonce.length)
      throw new Error(`arx: nonce must be ${nonceNcLen} or 16 bytes`);
    if (nonceNcLen !== 12) {
      const nc3 = new Uint8Array(12);
      nc3.set(nonce, counterRight ? 0 : 12 - nonce.length);
      nonce = nc3;
      toClean.push(nonce);
    }
    const n32 = u32(nonce);
    runCipher(core, sigma, k32, n32, data, output, counter, rounds);
    clean(...toClean);
    return output;
  };
}

// ../../node_modules/.pnpm/@noble+ciphers@1.3.0/node_modules/@noble/ciphers/esm/_poly1305.js
var u8to16 = (a, i) => a[i++] & 255 | (a[i++] & 255) << 8;
var Poly1305 = class {
  constructor(key) {
    this.blockLen = 16;
    this.outputLen = 16;
    this.buffer = new Uint8Array(16);
    this.r = new Uint16Array(10);
    this.h = new Uint16Array(10);
    this.pad = new Uint16Array(8);
    this.pos = 0;
    this.finished = false;
    key = toBytes(key);
    abytes2(key, 32);
    const t0 = u8to16(key, 0);
    const t1 = u8to16(key, 2);
    const t2 = u8to16(key, 4);
    const t3 = u8to16(key, 6);
    const t4 = u8to16(key, 8);
    const t5 = u8to16(key, 10);
    const t6 = u8to16(key, 12);
    const t7 = u8to16(key, 14);
    this.r[0] = t0 & 8191;
    this.r[1] = (t0 >>> 13 | t1 << 3) & 8191;
    this.r[2] = (t1 >>> 10 | t2 << 6) & 7939;
    this.r[3] = (t2 >>> 7 | t3 << 9) & 8191;
    this.r[4] = (t3 >>> 4 | t4 << 12) & 255;
    this.r[5] = t4 >>> 1 & 8190;
    this.r[6] = (t4 >>> 14 | t5 << 2) & 8191;
    this.r[7] = (t5 >>> 11 | t6 << 5) & 8065;
    this.r[8] = (t6 >>> 8 | t7 << 8) & 8191;
    this.r[9] = t7 >>> 5 & 127;
    for (let i = 0; i < 8; i++)
      this.pad[i] = u8to16(key, 16 + 2 * i);
  }
  process(data, offset, isLast = false) {
    const hibit = isLast ? 0 : 1 << 11;
    const { h: h2, r } = this;
    const r0 = r[0];
    const r1 = r[1];
    const r2 = r[2];
    const r3 = r[3];
    const r4 = r[4];
    const r5 = r[5];
    const r6 = r[6];
    const r7 = r[7];
    const r8 = r[8];
    const r9 = r[9];
    const t0 = u8to16(data, offset + 0);
    const t1 = u8to16(data, offset + 2);
    const t2 = u8to16(data, offset + 4);
    const t3 = u8to16(data, offset + 6);
    const t4 = u8to16(data, offset + 8);
    const t5 = u8to16(data, offset + 10);
    const t6 = u8to16(data, offset + 12);
    const t7 = u8to16(data, offset + 14);
    let h0 = h2[0] + (t0 & 8191);
    let h1 = h2[1] + ((t0 >>> 13 | t1 << 3) & 8191);
    let h22 = h2[2] + ((t1 >>> 10 | t2 << 6) & 8191);
    let h3 = h2[3] + ((t2 >>> 7 | t3 << 9) & 8191);
    let h4 = h2[4] + ((t3 >>> 4 | t4 << 12) & 8191);
    let h5 = h2[5] + (t4 >>> 1 & 8191);
    let h6 = h2[6] + ((t4 >>> 14 | t5 << 2) & 8191);
    let h7 = h2[7] + ((t5 >>> 11 | t6 << 5) & 8191);
    let h8 = h2[8] + ((t6 >>> 8 | t7 << 8) & 8191);
    let h9 = h2[9] + (t7 >>> 5 | hibit);
    let c = 0;
    let d0 = c + h0 * r0 + h1 * (5 * r9) + h22 * (5 * r8) + h3 * (5 * r7) + h4 * (5 * r6);
    c = d0 >>> 13;
    d0 &= 8191;
    d0 += h5 * (5 * r5) + h6 * (5 * r4) + h7 * (5 * r3) + h8 * (5 * r2) + h9 * (5 * r1);
    c += d0 >>> 13;
    d0 &= 8191;
    let d1 = c + h0 * r1 + h1 * r0 + h22 * (5 * r9) + h3 * (5 * r8) + h4 * (5 * r7);
    c = d1 >>> 13;
    d1 &= 8191;
    d1 += h5 * (5 * r6) + h6 * (5 * r5) + h7 * (5 * r4) + h8 * (5 * r3) + h9 * (5 * r2);
    c += d1 >>> 13;
    d1 &= 8191;
    let d2 = c + h0 * r2 + h1 * r1 + h22 * r0 + h3 * (5 * r9) + h4 * (5 * r8);
    c = d2 >>> 13;
    d2 &= 8191;
    d2 += h5 * (5 * r7) + h6 * (5 * r6) + h7 * (5 * r5) + h8 * (5 * r4) + h9 * (5 * r3);
    c += d2 >>> 13;
    d2 &= 8191;
    let d3 = c + h0 * r3 + h1 * r2 + h22 * r1 + h3 * r0 + h4 * (5 * r9);
    c = d3 >>> 13;
    d3 &= 8191;
    d3 += h5 * (5 * r8) + h6 * (5 * r7) + h7 * (5 * r6) + h8 * (5 * r5) + h9 * (5 * r4);
    c += d3 >>> 13;
    d3 &= 8191;
    let d4 = c + h0 * r4 + h1 * r3 + h22 * r2 + h3 * r1 + h4 * r0;
    c = d4 >>> 13;
    d4 &= 8191;
    d4 += h5 * (5 * r9) + h6 * (5 * r8) + h7 * (5 * r7) + h8 * (5 * r6) + h9 * (5 * r5);
    c += d4 >>> 13;
    d4 &= 8191;
    let d5 = c + h0 * r5 + h1 * r4 + h22 * r3 + h3 * r2 + h4 * r1;
    c = d5 >>> 13;
    d5 &= 8191;
    d5 += h5 * r0 + h6 * (5 * r9) + h7 * (5 * r8) + h8 * (5 * r7) + h9 * (5 * r6);
    c += d5 >>> 13;
    d5 &= 8191;
    let d6 = c + h0 * r6 + h1 * r5 + h22 * r4 + h3 * r3 + h4 * r2;
    c = d6 >>> 13;
    d6 &= 8191;
    d6 += h5 * r1 + h6 * r0 + h7 * (5 * r9) + h8 * (5 * r8) + h9 * (5 * r7);
    c += d6 >>> 13;
    d6 &= 8191;
    let d7 = c + h0 * r7 + h1 * r6 + h22 * r5 + h3 * r4 + h4 * r3;
    c = d7 >>> 13;
    d7 &= 8191;
    d7 += h5 * r2 + h6 * r1 + h7 * r0 + h8 * (5 * r9) + h9 * (5 * r8);
    c += d7 >>> 13;
    d7 &= 8191;
    let d8 = c + h0 * r8 + h1 * r7 + h22 * r6 + h3 * r5 + h4 * r4;
    c = d8 >>> 13;
    d8 &= 8191;
    d8 += h5 * r3 + h6 * r2 + h7 * r1 + h8 * r0 + h9 * (5 * r9);
    c += d8 >>> 13;
    d8 &= 8191;
    let d9 = c + h0 * r9 + h1 * r8 + h22 * r7 + h3 * r6 + h4 * r5;
    c = d9 >>> 13;
    d9 &= 8191;
    d9 += h5 * r4 + h6 * r3 + h7 * r2 + h8 * r1 + h9 * r0;
    c += d9 >>> 13;
    d9 &= 8191;
    c = (c << 2) + c | 0;
    c = c + d0 | 0;
    d0 = c & 8191;
    c = c >>> 13;
    d1 += c;
    h2[0] = d0;
    h2[1] = d1;
    h2[2] = d2;
    h2[3] = d3;
    h2[4] = d4;
    h2[5] = d5;
    h2[6] = d6;
    h2[7] = d7;
    h2[8] = d8;
    h2[9] = d9;
  }
  finalize() {
    const { h: h2, pad } = this;
    const g = new Uint16Array(10);
    let c = h2[1] >>> 13;
    h2[1] &= 8191;
    for (let i = 2; i < 10; i++) {
      h2[i] += c;
      c = h2[i] >>> 13;
      h2[i] &= 8191;
    }
    h2[0] += c * 5;
    c = h2[0] >>> 13;
    h2[0] &= 8191;
    h2[1] += c;
    c = h2[1] >>> 13;
    h2[1] &= 8191;
    h2[2] += c;
    g[0] = h2[0] + 5;
    c = g[0] >>> 13;
    g[0] &= 8191;
    for (let i = 1; i < 10; i++) {
      g[i] = h2[i] + c;
      c = g[i] >>> 13;
      g[i] &= 8191;
    }
    g[9] -= 1 << 13;
    let mask = (c ^ 1) - 1;
    for (let i = 0; i < 10; i++)
      g[i] &= mask;
    mask = ~mask;
    for (let i = 0; i < 10; i++)
      h2[i] = h2[i] & mask | g[i];
    h2[0] = (h2[0] | h2[1] << 13) & 65535;
    h2[1] = (h2[1] >>> 3 | h2[2] << 10) & 65535;
    h2[2] = (h2[2] >>> 6 | h2[3] << 7) & 65535;
    h2[3] = (h2[3] >>> 9 | h2[4] << 4) & 65535;
    h2[4] = (h2[4] >>> 12 | h2[5] << 1 | h2[6] << 14) & 65535;
    h2[5] = (h2[6] >>> 2 | h2[7] << 11) & 65535;
    h2[6] = (h2[7] >>> 5 | h2[8] << 8) & 65535;
    h2[7] = (h2[8] >>> 8 | h2[9] << 5) & 65535;
    let f = h2[0] + pad[0];
    h2[0] = f & 65535;
    for (let i = 1; i < 8; i++) {
      f = (h2[i] + pad[i] | 0) + (f >>> 16) | 0;
      h2[i] = f & 65535;
    }
    clean(g);
  }
  update(data) {
    aexists(this);
    data = toBytes(data);
    abytes2(data);
    const { buffer, blockLen } = this;
    const len = data.length;
    for (let pos = 0; pos < len; ) {
      const take = Math.min(blockLen - this.pos, len - pos);
      if (take === blockLen) {
        for (; blockLen <= len - pos; pos += blockLen)
          this.process(data, pos);
        continue;
      }
      buffer.set(data.subarray(pos, pos + take), this.pos);
      this.pos += take;
      pos += take;
      if (this.pos === blockLen) {
        this.process(buffer, 0, false);
        this.pos = 0;
      }
    }
    return this;
  }
  destroy() {
    clean(this.h, this.r, this.buffer, this.pad);
  }
  digestInto(out) {
    aexists(this);
    aoutput(out, this);
    this.finished = true;
    const { buffer, h: h2 } = this;
    let { pos } = this;
    if (pos) {
      buffer[pos++] = 1;
      for (; pos < 16; pos++)
        buffer[pos] = 0;
      this.process(buffer, 0, true);
    }
    this.finalize();
    let opos = 0;
    for (let i = 0; i < 8; i++) {
      out[opos++] = h2[i] >>> 0;
      out[opos++] = h2[i] >>> 8;
    }
    return out;
  }
  digest() {
    const { buffer, outputLen } = this;
    this.digestInto(buffer);
    const res = buffer.slice(0, outputLen);
    this.destroy();
    return res;
  }
};
function wrapConstructorWithKey(hashCons) {
  const hashC = (msg, key) => hashCons(key).update(toBytes(msg)).digest();
  const tmp = hashCons(new Uint8Array(32));
  hashC.outputLen = tmp.outputLen;
  hashC.blockLen = tmp.blockLen;
  hashC.create = (key) => hashCons(key);
  return hashC;
}
var poly1305 = wrapConstructorWithKey((key) => new Poly1305(key));

// ../../node_modules/.pnpm/@noble+ciphers@1.3.0/node_modules/@noble/ciphers/esm/chacha.js
function chachaCore(s, k, n, out, cnt, rounds = 20) {
  let y00 = s[0], y01 = s[1], y02 = s[2], y03 = s[3], y04 = k[0], y05 = k[1], y06 = k[2], y07 = k[3], y08 = k[4], y09 = k[5], y10 = k[6], y11 = k[7], y12 = cnt, y13 = n[0], y14 = n[1], y15 = n[2];
  let x00 = y00, x01 = y01, x02 = y02, x03 = y03, x04 = y04, x05 = y05, x06 = y06, x07 = y07, x08 = y08, x09 = y09, x10 = y10, x11 = y11, x12 = y12, x13 = y13, x14 = y14, x15 = y15;
  for (let r = 0; r < rounds; r += 2) {
    x00 = x00 + x04 | 0;
    x12 = rotl(x12 ^ x00, 16);
    x08 = x08 + x12 | 0;
    x04 = rotl(x04 ^ x08, 12);
    x00 = x00 + x04 | 0;
    x12 = rotl(x12 ^ x00, 8);
    x08 = x08 + x12 | 0;
    x04 = rotl(x04 ^ x08, 7);
    x01 = x01 + x05 | 0;
    x13 = rotl(x13 ^ x01, 16);
    x09 = x09 + x13 | 0;
    x05 = rotl(x05 ^ x09, 12);
    x01 = x01 + x05 | 0;
    x13 = rotl(x13 ^ x01, 8);
    x09 = x09 + x13 | 0;
    x05 = rotl(x05 ^ x09, 7);
    x02 = x02 + x06 | 0;
    x14 = rotl(x14 ^ x02, 16);
    x10 = x10 + x14 | 0;
    x06 = rotl(x06 ^ x10, 12);
    x02 = x02 + x06 | 0;
    x14 = rotl(x14 ^ x02, 8);
    x10 = x10 + x14 | 0;
    x06 = rotl(x06 ^ x10, 7);
    x03 = x03 + x07 | 0;
    x15 = rotl(x15 ^ x03, 16);
    x11 = x11 + x15 | 0;
    x07 = rotl(x07 ^ x11, 12);
    x03 = x03 + x07 | 0;
    x15 = rotl(x15 ^ x03, 8);
    x11 = x11 + x15 | 0;
    x07 = rotl(x07 ^ x11, 7);
    x00 = x00 + x05 | 0;
    x15 = rotl(x15 ^ x00, 16);
    x10 = x10 + x15 | 0;
    x05 = rotl(x05 ^ x10, 12);
    x00 = x00 + x05 | 0;
    x15 = rotl(x15 ^ x00, 8);
    x10 = x10 + x15 | 0;
    x05 = rotl(x05 ^ x10, 7);
    x01 = x01 + x06 | 0;
    x12 = rotl(x12 ^ x01, 16);
    x11 = x11 + x12 | 0;
    x06 = rotl(x06 ^ x11, 12);
    x01 = x01 + x06 | 0;
    x12 = rotl(x12 ^ x01, 8);
    x11 = x11 + x12 | 0;
    x06 = rotl(x06 ^ x11, 7);
    x02 = x02 + x07 | 0;
    x13 = rotl(x13 ^ x02, 16);
    x08 = x08 + x13 | 0;
    x07 = rotl(x07 ^ x08, 12);
    x02 = x02 + x07 | 0;
    x13 = rotl(x13 ^ x02, 8);
    x08 = x08 + x13 | 0;
    x07 = rotl(x07 ^ x08, 7);
    x03 = x03 + x04 | 0;
    x14 = rotl(x14 ^ x03, 16);
    x09 = x09 + x14 | 0;
    x04 = rotl(x04 ^ x09, 12);
    x03 = x03 + x04 | 0;
    x14 = rotl(x14 ^ x03, 8);
    x09 = x09 + x14 | 0;
    x04 = rotl(x04 ^ x09, 7);
  }
  let oi = 0;
  out[oi++] = y00 + x00 | 0;
  out[oi++] = y01 + x01 | 0;
  out[oi++] = y02 + x02 | 0;
  out[oi++] = y03 + x03 | 0;
  out[oi++] = y04 + x04 | 0;
  out[oi++] = y05 + x05 | 0;
  out[oi++] = y06 + x06 | 0;
  out[oi++] = y07 + x07 | 0;
  out[oi++] = y08 + x08 | 0;
  out[oi++] = y09 + x09 | 0;
  out[oi++] = y10 + x10 | 0;
  out[oi++] = y11 + x11 | 0;
  out[oi++] = y12 + x12 | 0;
  out[oi++] = y13 + x13 | 0;
  out[oi++] = y14 + x14 | 0;
  out[oi++] = y15 + x15 | 0;
}
function hchacha(s, k, i, o32) {
  let x00 = s[0], x01 = s[1], x02 = s[2], x03 = s[3], x04 = k[0], x05 = k[1], x06 = k[2], x07 = k[3], x08 = k[4], x09 = k[5], x10 = k[6], x11 = k[7], x12 = i[0], x13 = i[1], x14 = i[2], x15 = i[3];
  for (let r = 0; r < 20; r += 2) {
    x00 = x00 + x04 | 0;
    x12 = rotl(x12 ^ x00, 16);
    x08 = x08 + x12 | 0;
    x04 = rotl(x04 ^ x08, 12);
    x00 = x00 + x04 | 0;
    x12 = rotl(x12 ^ x00, 8);
    x08 = x08 + x12 | 0;
    x04 = rotl(x04 ^ x08, 7);
    x01 = x01 + x05 | 0;
    x13 = rotl(x13 ^ x01, 16);
    x09 = x09 + x13 | 0;
    x05 = rotl(x05 ^ x09, 12);
    x01 = x01 + x05 | 0;
    x13 = rotl(x13 ^ x01, 8);
    x09 = x09 + x13 | 0;
    x05 = rotl(x05 ^ x09, 7);
    x02 = x02 + x06 | 0;
    x14 = rotl(x14 ^ x02, 16);
    x10 = x10 + x14 | 0;
    x06 = rotl(x06 ^ x10, 12);
    x02 = x02 + x06 | 0;
    x14 = rotl(x14 ^ x02, 8);
    x10 = x10 + x14 | 0;
    x06 = rotl(x06 ^ x10, 7);
    x03 = x03 + x07 | 0;
    x15 = rotl(x15 ^ x03, 16);
    x11 = x11 + x15 | 0;
    x07 = rotl(x07 ^ x11, 12);
    x03 = x03 + x07 | 0;
    x15 = rotl(x15 ^ x03, 8);
    x11 = x11 + x15 | 0;
    x07 = rotl(x07 ^ x11, 7);
    x00 = x00 + x05 | 0;
    x15 = rotl(x15 ^ x00, 16);
    x10 = x10 + x15 | 0;
    x05 = rotl(x05 ^ x10, 12);
    x00 = x00 + x05 | 0;
    x15 = rotl(x15 ^ x00, 8);
    x10 = x10 + x15 | 0;
    x05 = rotl(x05 ^ x10, 7);
    x01 = x01 + x06 | 0;
    x12 = rotl(x12 ^ x01, 16);
    x11 = x11 + x12 | 0;
    x06 = rotl(x06 ^ x11, 12);
    x01 = x01 + x06 | 0;
    x12 = rotl(x12 ^ x01, 8);
    x11 = x11 + x12 | 0;
    x06 = rotl(x06 ^ x11, 7);
    x02 = x02 + x07 | 0;
    x13 = rotl(x13 ^ x02, 16);
    x08 = x08 + x13 | 0;
    x07 = rotl(x07 ^ x08, 12);
    x02 = x02 + x07 | 0;
    x13 = rotl(x13 ^ x02, 8);
    x08 = x08 + x13 | 0;
    x07 = rotl(x07 ^ x08, 7);
    x03 = x03 + x04 | 0;
    x14 = rotl(x14 ^ x03, 16);
    x09 = x09 + x14 | 0;
    x04 = rotl(x04 ^ x09, 12);
    x03 = x03 + x04 | 0;
    x14 = rotl(x14 ^ x03, 8);
    x09 = x09 + x14 | 0;
    x04 = rotl(x04 ^ x09, 7);
  }
  let oi = 0;
  o32[oi++] = x00;
  o32[oi++] = x01;
  o32[oi++] = x02;
  o32[oi++] = x03;
  o32[oi++] = x12;
  o32[oi++] = x13;
  o32[oi++] = x14;
  o32[oi++] = x15;
}
var chacha20 = /* @__PURE__ */ createCipher(chachaCore, {
  counterRight: false,
  counterLength: 4,
  allowShortKeys: false
});
var xchacha20 = /* @__PURE__ */ createCipher(chachaCore, {
  counterRight: false,
  counterLength: 8,
  extendNonceFn: hchacha,
  allowShortKeys: false
});
var ZEROS16 = /* @__PURE__ */ new Uint8Array(16);
var updatePadded = (h2, msg) => {
  h2.update(msg);
  const left = msg.length % 16;
  if (left)
    h2.update(ZEROS16.subarray(left));
};
var ZEROS32 = /* @__PURE__ */ new Uint8Array(32);
function computeTag(fn, key, nonce, data, AAD) {
  const authKey = fn(key, nonce, ZEROS32);
  const h2 = poly1305.create(authKey);
  if (AAD)
    updatePadded(h2, AAD);
  updatePadded(h2, data);
  const num = u64Lengths(data.length, AAD ? AAD.length : 0, true);
  h2.update(num);
  const res = h2.digest();
  clean(authKey, num);
  return res;
}
var _poly1305_aead = (xorStream) => (key, nonce, AAD) => {
  const tagLength = 16;
  return {
    encrypt(plaintext, output) {
      const plength = plaintext.length;
      output = getOutput(plength + tagLength, output, false);
      output.set(plaintext);
      const oPlain = output.subarray(0, -tagLength);
      xorStream(key, nonce, oPlain, oPlain, 1);
      const tag = computeTag(xorStream, key, nonce, oPlain, AAD);
      output.set(tag, plength);
      clean(tag);
      return output;
    },
    decrypt(ciphertext, output) {
      output = getOutput(ciphertext.length - tagLength, output, false);
      const data = ciphertext.subarray(0, -tagLength);
      const passedTag = ciphertext.subarray(-tagLength);
      const tag = computeTag(xorStream, key, nonce, data, AAD);
      if (!equalBytes(passedTag, tag))
        throw new Error("invalid tag");
      output.set(ciphertext.subarray(0, -tagLength));
      xorStream(key, nonce, output, output, 1);
      clean(tag);
      return output;
    }
  };
};
var chacha20poly1305 = /* @__PURE__ */ wrapCipher({ blockSize: 64, nonceLength: 12, tagLength: 16 }, _poly1305_aead(chacha20));
var xchacha20poly1305 = /* @__PURE__ */ wrapCipher({ blockSize: 64, nonceLength: 24, tagLength: 16 }, _poly1305_aead(xchacha20));

// ../../node_modules/.pnpm/@noble+ciphers@1.3.0/node_modules/@noble/ciphers/esm/_polyval.js
var BLOCK_SIZE = 16;
var ZEROS162 = /* @__PURE__ */ new Uint8Array(16);
var ZEROS322 = u32(ZEROS162);
var POLY = 225;
var mul2 = (s0, s1, s2, s3) => {
  const hiBit = s3 & 1;
  return {
    s3: s2 << 31 | s3 >>> 1,
    s2: s1 << 31 | s2 >>> 1,
    s1: s0 << 31 | s1 >>> 1,
    s0: s0 >>> 1 ^ POLY << 24 & -(hiBit & 1)
    // reduce % poly
  };
};
var swapLE = (n) => (n >>> 0 & 255) << 24 | (n >>> 8 & 255) << 16 | (n >>> 16 & 255) << 8 | n >>> 24 & 255 | 0;
function _toGHASHKey(k) {
  k.reverse();
  const hiBit = k[15] & 1;
  let carry = 0;
  for (let i = 0; i < k.length; i++) {
    const t = k[i];
    k[i] = t >>> 1 | carry;
    carry = (t & 1) << 7;
  }
  k[0] ^= -hiBit & 225;
  return k;
}
var estimateWindow = (bytes) => {
  if (bytes > 64 * 1024)
    return 8;
  if (bytes > 1024)
    return 4;
  return 2;
};
var GHASH = class {
  // We select bits per window adaptively based on expectedLength
  constructor(key, expectedLength) {
    this.blockLen = BLOCK_SIZE;
    this.outputLen = BLOCK_SIZE;
    this.s0 = 0;
    this.s1 = 0;
    this.s2 = 0;
    this.s3 = 0;
    this.finished = false;
    key = toBytes(key);
    abytes2(key, 16);
    const kView = createView(key);
    let k0 = kView.getUint32(0, false);
    let k1 = kView.getUint32(4, false);
    let k2 = kView.getUint32(8, false);
    let k3 = kView.getUint32(12, false);
    const doubles = [];
    for (let i = 0; i < 128; i++) {
      doubles.push({ s0: swapLE(k0), s1: swapLE(k1), s2: swapLE(k2), s3: swapLE(k3) });
      ({ s0: k0, s1: k1, s2: k2, s3: k3 } = mul2(k0, k1, k2, k3));
    }
    const W2 = estimateWindow(expectedLength || 1024);
    if (![1, 2, 4, 8].includes(W2))
      throw new Error("ghash: invalid window size, expected 2, 4 or 8");
    this.W = W2;
    const bits = 128;
    const windows = bits / W2;
    const windowSize = this.windowSize = 2 ** W2;
    const items = [];
    for (let w = 0; w < windows; w++) {
      for (let byte = 0; byte < windowSize; byte++) {
        let s0 = 0, s1 = 0, s2 = 0, s3 = 0;
        for (let j = 0; j < W2; j++) {
          const bit = byte >>> W2 - j - 1 & 1;
          if (!bit)
            continue;
          const { s0: d0, s1: d1, s2: d2, s3: d3 } = doubles[W2 * w + j];
          s0 ^= d0, s1 ^= d1, s2 ^= d2, s3 ^= d3;
        }
        items.push({ s0, s1, s2, s3 });
      }
    }
    this.t = items;
  }
  _updateBlock(s0, s1, s2, s3) {
    s0 ^= this.s0, s1 ^= this.s1, s2 ^= this.s2, s3 ^= this.s3;
    const { W: W2, t, windowSize } = this;
    let o0 = 0, o1 = 0, o2 = 0, o3 = 0;
    const mask = (1 << W2) - 1;
    let w = 0;
    for (const num of [s0, s1, s2, s3]) {
      for (let bytePos = 0; bytePos < 4; bytePos++) {
        const byte = num >>> 8 * bytePos & 255;
        for (let bitPos = 8 / W2 - 1; bitPos >= 0; bitPos--) {
          const bit = byte >>> W2 * bitPos & mask;
          const { s0: e0, s1: e1, s2: e2, s3: e3 } = t[w * windowSize + bit];
          o0 ^= e0, o1 ^= e1, o2 ^= e2, o3 ^= e3;
          w += 1;
        }
      }
    }
    this.s0 = o0;
    this.s1 = o1;
    this.s2 = o2;
    this.s3 = o3;
  }
  update(data) {
    aexists(this);
    data = toBytes(data);
    abytes2(data);
    const b32 = u32(data);
    const blocks = Math.floor(data.length / BLOCK_SIZE);
    const left = data.length % BLOCK_SIZE;
    for (let i = 0; i < blocks; i++) {
      this._updateBlock(b32[i * 4 + 0], b32[i * 4 + 1], b32[i * 4 + 2], b32[i * 4 + 3]);
    }
    if (left) {
      ZEROS162.set(data.subarray(blocks * BLOCK_SIZE));
      this._updateBlock(ZEROS322[0], ZEROS322[1], ZEROS322[2], ZEROS322[3]);
      clean(ZEROS322);
    }
    return this;
  }
  destroy() {
    const { t } = this;
    for (const elm of t) {
      elm.s0 = 0, elm.s1 = 0, elm.s2 = 0, elm.s3 = 0;
    }
  }
  digestInto(out) {
    aexists(this);
    aoutput(out, this);
    this.finished = true;
    const { s0, s1, s2, s3 } = this;
    const o32 = u32(out);
    o32[0] = s0;
    o32[1] = s1;
    o32[2] = s2;
    o32[3] = s3;
    return out;
  }
  digest() {
    const res = new Uint8Array(BLOCK_SIZE);
    this.digestInto(res);
    this.destroy();
    return res;
  }
};
var Polyval = class extends GHASH {
  constructor(key, expectedLength) {
    key = toBytes(key);
    abytes2(key);
    const ghKey = _toGHASHKey(copyBytes(key));
    super(ghKey, expectedLength);
    clean(ghKey);
  }
  update(data) {
    data = toBytes(data);
    aexists(this);
    const b32 = u32(data);
    const left = data.length % BLOCK_SIZE;
    const blocks = Math.floor(data.length / BLOCK_SIZE);
    for (let i = 0; i < blocks; i++) {
      this._updateBlock(swapLE(b32[i * 4 + 3]), swapLE(b32[i * 4 + 2]), swapLE(b32[i * 4 + 1]), swapLE(b32[i * 4 + 0]));
    }
    if (left) {
      ZEROS162.set(data.subarray(blocks * BLOCK_SIZE));
      this._updateBlock(swapLE(ZEROS322[3]), swapLE(ZEROS322[2]), swapLE(ZEROS322[1]), swapLE(ZEROS322[0]));
      clean(ZEROS322);
    }
    return this;
  }
  digestInto(out) {
    aexists(this);
    aoutput(out, this);
    this.finished = true;
    const { s0, s1, s2, s3 } = this;
    const o32 = u32(out);
    o32[0] = s0;
    o32[1] = s1;
    o32[2] = s2;
    o32[3] = s3;
    return out.reverse();
  }
};
function wrapConstructorWithKey2(hashCons) {
  const hashC = (msg, key) => hashCons(key, msg.length).update(toBytes(msg)).digest();
  const tmp = hashCons(new Uint8Array(16), 0);
  hashC.outputLen = tmp.outputLen;
  hashC.blockLen = tmp.blockLen;
  hashC.create = (key, expectedLength) => hashCons(key, expectedLength);
  return hashC;
}
var ghash = wrapConstructorWithKey2((key, expectedLength) => new GHASH(key, expectedLength));
var polyval = wrapConstructorWithKey2((key, expectedLength) => new Polyval(key, expectedLength));

// ../../node_modules/.pnpm/@noble+ciphers@1.3.0/node_modules/@noble/ciphers/esm/aes.js
var BLOCK_SIZE2 = 16;
var BLOCK_SIZE32 = 4;
var EMPTY_BLOCK = /* @__PURE__ */ new Uint8Array(BLOCK_SIZE2);
var POLY2 = 283;
function mul22(n) {
  return n << 1 ^ POLY2 & -(n >> 7);
}
function mul(a, b) {
  let res = 0;
  for (; b > 0; b >>= 1) {
    res ^= a & -(b & 1);
    a = mul22(a);
  }
  return res;
}
var sbox = /* @__PURE__ */ (() => {
  const t = new Uint8Array(256);
  for (let i = 0, x = 1; i < 256; i++, x ^= mul22(x))
    t[i] = x;
  const box = new Uint8Array(256);
  box[0] = 99;
  for (let i = 0; i < 255; i++) {
    let x = t[255 - i];
    x |= x << 8;
    box[t[i]] = (x ^ x >> 4 ^ x >> 5 ^ x >> 6 ^ x >> 7 ^ 99) & 255;
  }
  clean(t);
  return box;
})();
var rotr32_8 = (n) => n << 24 | n >>> 8;
var rotl32_8 = (n) => n << 8 | n >>> 24;
function genTtable(sbox2, fn) {
  if (sbox2.length !== 256)
    throw new Error("Wrong sbox length");
  const T0 = new Uint32Array(256).map((_, j) => fn(sbox2[j]));
  const T1 = T0.map(rotl32_8);
  const T2 = T1.map(rotl32_8);
  const T3 = T2.map(rotl32_8);
  const T01 = new Uint32Array(256 * 256);
  const T23 = new Uint32Array(256 * 256);
  const sbox22 = new Uint16Array(256 * 256);
  for (let i = 0; i < 256; i++) {
    for (let j = 0; j < 256; j++) {
      const idx = i * 256 + j;
      T01[idx] = T0[i] ^ T1[j];
      T23[idx] = T2[i] ^ T3[j];
      sbox22[idx] = sbox2[i] << 8 | sbox2[j];
    }
  }
  return { sbox: sbox2, sbox2: sbox22, T0, T1, T2, T3, T01, T23 };
}
var tableEncoding = /* @__PURE__ */ genTtable(sbox, (s) => mul(s, 3) << 24 | s << 16 | s << 8 | mul(s, 2));
var xPowers = /* @__PURE__ */ (() => {
  const p = new Uint8Array(16);
  for (let i = 0, x = 1; i < 16; i++, x = mul22(x))
    p[i] = x;
  return p;
})();
function expandKeyLE(key) {
  abytes2(key);
  const len = key.length;
  if (![16, 24, 32].includes(len))
    throw new Error("aes: invalid key size, should be 16, 24 or 32, got " + len);
  const { sbox2 } = tableEncoding;
  const toClean = [];
  if (!isAligned32(key))
    toClean.push(key = copyBytes(key));
  const k32 = u32(key);
  const Nk = k32.length;
  const subByte = (n) => applySbox(sbox2, n, n, n, n);
  const xk = new Uint32Array(len + 28);
  xk.set(k32);
  for (let i = Nk; i < xk.length; i++) {
    let t = xk[i - 1];
    if (i % Nk === 0)
      t = subByte(rotr32_8(t)) ^ xPowers[i / Nk - 1];
    else if (Nk > 6 && i % Nk === 4)
      t = subByte(t);
    xk[i] = xk[i - Nk] ^ t;
  }
  clean(...toClean);
  return xk;
}
function apply0123(T01, T23, s0, s1, s2, s3) {
  return T01[s0 << 8 & 65280 | s1 >>> 8 & 255] ^ T23[s2 >>> 8 & 65280 | s3 >>> 24 & 255];
}
function applySbox(sbox2, s0, s1, s2, s3) {
  return sbox2[s0 & 255 | s1 & 65280] | sbox2[s2 >>> 16 & 255 | s3 >>> 16 & 65280] << 16;
}
function encrypt(xk, s0, s1, s2, s3) {
  const { sbox2, T01, T23 } = tableEncoding;
  let k = 0;
  s0 ^= xk[k++], s1 ^= xk[k++], s2 ^= xk[k++], s3 ^= xk[k++];
  const rounds = xk.length / 4 - 2;
  for (let i = 0; i < rounds; i++) {
    const t02 = xk[k++] ^ apply0123(T01, T23, s0, s1, s2, s3);
    const t12 = xk[k++] ^ apply0123(T01, T23, s1, s2, s3, s0);
    const t22 = xk[k++] ^ apply0123(T01, T23, s2, s3, s0, s1);
    const t32 = xk[k++] ^ apply0123(T01, T23, s3, s0, s1, s2);
    s0 = t02, s1 = t12, s2 = t22, s3 = t32;
  }
  const t0 = xk[k++] ^ applySbox(sbox2, s0, s1, s2, s3);
  const t1 = xk[k++] ^ applySbox(sbox2, s1, s2, s3, s0);
  const t2 = xk[k++] ^ applySbox(sbox2, s2, s3, s0, s1);
  const t3 = xk[k++] ^ applySbox(sbox2, s3, s0, s1, s2);
  return { s0: t0, s1: t1, s2: t2, s3: t3 };
}
function ctr32(xk, isLE2, nonce, src, dst) {
  abytes2(nonce, BLOCK_SIZE2);
  abytes2(src);
  dst = getOutput(src.length, dst);
  const ctr = nonce;
  const c32 = u32(ctr);
  const view = createView(ctr);
  const src32 = u32(src);
  const dst32 = u32(dst);
  const ctrPos = isLE2 ? 0 : 12;
  const srcLen = src.length;
  let ctrNum = view.getUint32(ctrPos, isLE2);
  let { s0, s1, s2, s3 } = encrypt(xk, c32[0], c32[1], c32[2], c32[3]);
  for (let i = 0; i + 4 <= src32.length; i += 4) {
    dst32[i + 0] = src32[i + 0] ^ s0;
    dst32[i + 1] = src32[i + 1] ^ s1;
    dst32[i + 2] = src32[i + 2] ^ s2;
    dst32[i + 3] = src32[i + 3] ^ s3;
    ctrNum = ctrNum + 1 >>> 0;
    view.setUint32(ctrPos, ctrNum, isLE2);
    ({ s0, s1, s2, s3 } = encrypt(xk, c32[0], c32[1], c32[2], c32[3]));
  }
  const start = BLOCK_SIZE2 * Math.floor(src32.length / BLOCK_SIZE32);
  if (start < srcLen) {
    const b32 = new Uint32Array([s0, s1, s2, s3]);
    const buf = u8(b32);
    for (let i = start, pos = 0; i < srcLen; i++, pos++)
      dst[i] = src[i] ^ buf[pos];
    clean(b32);
  }
  return dst;
}
function computeTag2(fn, isLE2, key, data, AAD) {
  const aadLength = AAD ? AAD.length : 0;
  const h2 = fn.create(key, data.length + aadLength);
  if (AAD)
    h2.update(AAD);
  const num = u64Lengths(8 * data.length, 8 * aadLength, isLE2);
  h2.update(data);
  h2.update(num);
  const res = h2.digest();
  clean(num);
  return res;
}
var gcm = /* @__PURE__ */ wrapCipher({ blockSize: 16, nonceLength: 12, tagLength: 16, varSizeNonce: true }, function aesgcm(key, nonce, AAD) {
  if (nonce.length < 8)
    throw new Error("aes/gcm: invalid nonce length");
  const tagLength = 16;
  function _computeTag(authKey, tagMask, data) {
    const tag = computeTag2(ghash, false, authKey, data, AAD);
    for (let i = 0; i < tagMask.length; i++)
      tag[i] ^= tagMask[i];
    return tag;
  }
  function deriveKeys() {
    const xk = expandKeyLE(key);
    const authKey = EMPTY_BLOCK.slice();
    const counter = EMPTY_BLOCK.slice();
    ctr32(xk, false, counter, counter, authKey);
    if (nonce.length === 12) {
      counter.set(nonce);
    } else {
      const nonceLen = EMPTY_BLOCK.slice();
      const view = createView(nonceLen);
      setBigUint64(view, 8, BigInt(nonce.length * 8), false);
      const g = ghash.create(authKey).update(nonce).update(nonceLen);
      g.digestInto(counter);
      g.destroy();
    }
    const tagMask = ctr32(xk, false, counter, EMPTY_BLOCK);
    return { xk, authKey, counter, tagMask };
  }
  return {
    encrypt(plaintext) {
      const { xk, authKey, counter, tagMask } = deriveKeys();
      const out = new Uint8Array(plaintext.length + tagLength);
      const toClean = [xk, authKey, counter, tagMask];
      if (!isAligned32(plaintext))
        toClean.push(plaintext = copyBytes(plaintext));
      ctr32(xk, false, counter, plaintext, out.subarray(0, plaintext.length));
      const tag = _computeTag(authKey, tagMask, out.subarray(0, out.length - tagLength));
      toClean.push(tag);
      out.set(tag, plaintext.length);
      clean(...toClean);
      return out;
    },
    decrypt(ciphertext) {
      const { xk, authKey, counter, tagMask } = deriveKeys();
      const toClean = [xk, authKey, tagMask, counter];
      if (!isAligned32(ciphertext))
        toClean.push(ciphertext = copyBytes(ciphertext));
      const data = ciphertext.subarray(0, -tagLength);
      const passedTag = ciphertext.subarray(-tagLength);
      const tag = _computeTag(authKey, tagMask, data);
      toClean.push(tag);
      if (!equalBytes(tag, passedTag))
        throw new Error("aes/gcm: invalid ghash tag");
      const out = ctr32(xk, false, counter, data);
      clean(...toClean);
      return out;
    }
  };
});
var limit = (name, min, max) => (value) => {
  if (!Number.isSafeInteger(value) || min > value || value > max) {
    const minmax = "[" + min + ".." + max + "]";
    throw new Error("" + name + ": expected value in range " + minmax + ", got " + value);
  }
};
var gcmsiv = /* @__PURE__ */ wrapCipher({ blockSize: 16, nonceLength: 12, tagLength: 16, varSizeNonce: true }, function aessiv(key, nonce, AAD) {
  const tagLength = 16;
  const AAD_LIMIT = limit("AAD", 0, 2 ** 36);
  const PLAIN_LIMIT = limit("plaintext", 0, 2 ** 36);
  const NONCE_LIMIT = limit("nonce", 12, 12);
  const CIPHER_LIMIT = limit("ciphertext", 16, 2 ** 36 + 16);
  abytes2(key, 16, 24, 32);
  NONCE_LIMIT(nonce.length);
  if (AAD !== void 0)
    AAD_LIMIT(AAD.length);
  function deriveKeys() {
    const xk = expandKeyLE(key);
    const encKey = new Uint8Array(key.length);
    const authKey = new Uint8Array(16);
    const toClean = [xk, encKey];
    let _nonce = nonce;
    if (!isAligned32(_nonce))
      toClean.push(_nonce = copyBytes(_nonce));
    const n32 = u32(_nonce);
    let s0 = 0, s1 = n32[0], s2 = n32[1], s3 = n32[2];
    let counter = 0;
    for (const derivedKey of [authKey, encKey].map(u32)) {
      const d32 = u32(derivedKey);
      for (let i = 0; i < d32.length; i += 2) {
        const { s0: o0, s1: o1 } = encrypt(xk, s0, s1, s2, s3);
        d32[i + 0] = o0;
        d32[i + 1] = o1;
        s0 = ++counter;
      }
    }
    const res = { authKey, encKey: expandKeyLE(encKey) };
    clean(...toClean);
    return res;
  }
  function _computeTag(encKey, authKey, data) {
    const tag = computeTag2(polyval, true, authKey, data, AAD);
    for (let i = 0; i < 12; i++)
      tag[i] ^= nonce[i];
    tag[15] &= 127;
    const t32 = u32(tag);
    let s0 = t32[0], s1 = t32[1], s2 = t32[2], s3 = t32[3];
    ({ s0, s1, s2, s3 } = encrypt(encKey, s0, s1, s2, s3));
    t32[0] = s0, t32[1] = s1, t32[2] = s2, t32[3] = s3;
    return tag;
  }
  function processSiv(encKey, tag, input) {
    let block = copyBytes(tag);
    block[15] |= 128;
    const res = ctr32(encKey, true, block, input);
    clean(block);
    return res;
  }
  return {
    encrypt(plaintext) {
      PLAIN_LIMIT(plaintext.length);
      const { encKey, authKey } = deriveKeys();
      const tag = _computeTag(encKey, authKey, plaintext);
      const toClean = [encKey, authKey, tag];
      if (!isAligned32(plaintext))
        toClean.push(plaintext = copyBytes(plaintext));
      const out = new Uint8Array(plaintext.length + tagLength);
      out.set(tag, plaintext.length);
      out.set(processSiv(encKey, tag, plaintext));
      clean(...toClean);
      return out;
    },
    decrypt(ciphertext) {
      CIPHER_LIMIT(ciphertext.length);
      const tag = ciphertext.subarray(-tagLength);
      const { encKey, authKey } = deriveKeys();
      const toClean = [encKey, authKey];
      if (!isAligned32(ciphertext))
        toClean.push(ciphertext = copyBytes(ciphertext));
      const plaintext = processSiv(encKey, tag, ciphertext.subarray(0, -tagLength));
      const expectedTag = _computeTag(encKey, authKey, plaintext);
      toClean.push(expectedTag);
      if (!equalBytes(tag, expectedTag)) {
        clean(...toClean);
        throw new Error("invalid polyval tag");
      }
      clean(...toClean);
      return plaintext;
    }
  };
});
var siv = gcmsiv;

// ../../node_modules/.pnpm/@noble+ciphers@1.3.0/node_modules/@noble/ciphers/esm/cryptoNode.js
import * as nc from "crypto";
var crypto2 = nc && typeof nc === "object" && "webcrypto" in nc ? nc.webcrypto : nc && typeof nc === "object" && "randomBytes" in nc ? nc : void 0;

// ../../node_modules/.pnpm/@noble+ciphers@1.3.0/node_modules/@noble/ciphers/esm/webcrypto.js
function randomBytes(bytesLength = 32) {
  if (crypto2 && typeof crypto2.getRandomValues === "function") {
    return crypto2.getRandomValues(new Uint8Array(bytesLength));
  }
  if (crypto2 && typeof crypto2.randomBytes === "function") {
    return Uint8Array.from(crypto2.randomBytes(bytesLength));
  }
  throw new Error("crypto.getRandomValues must be defined");
}

// ../../node_modules/.pnpm/@noble+hashes@1.8.0/node_modules/@noble/hashes/esm/cryptoNode.js
import * as nc2 from "crypto";
var crypto3 = nc2 && typeof nc2 === "object" && "webcrypto" in nc2 ? nc2.webcrypto : nc2 && typeof nc2 === "object" && "randomBytes" in nc2 ? nc2 : void 0;

// ../../node_modules/.pnpm/@noble+hashes@1.8.0/node_modules/@noble/hashes/esm/utils.js
function isBytes3(a) {
  return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array";
}
function anumber2(n) {
  if (!Number.isSafeInteger(n) || n < 0)
    throw new Error("positive integer expected, got " + n);
}
function abytes3(b, ...lengths) {
  if (!isBytes3(b))
    throw new Error("Uint8Array expected");
  if (lengths.length > 0 && !lengths.includes(b.length))
    throw new Error("Uint8Array expected of length " + lengths + ", got length=" + b.length);
}
function ahash(h2) {
  if (typeof h2 !== "function" || typeof h2.create !== "function")
    throw new Error("Hash should be wrapped by utils.createHasher");
  anumber2(h2.outputLen);
  anumber2(h2.blockLen);
}
function aexists2(instance, checkFinished = true) {
  if (instance.destroyed)
    throw new Error("Hash instance has been destroyed");
  if (checkFinished && instance.finished)
    throw new Error("Hash#digest() has already been called");
}
function aoutput2(out, instance) {
  abytes3(out);
  const min = instance.outputLen;
  if (out.length < min) {
    throw new Error("digestInto() expects output buffer of length at least " + min);
  }
}
function clean2(...arrays) {
  for (let i = 0; i < arrays.length; i++) {
    arrays[i].fill(0);
  }
}
function createView2(arr) {
  return new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
}
function rotr(word, shift) {
  return word << 32 - shift | word >>> shift;
}
var hasHexBuiltin = /* @__PURE__ */ (() => (
  // @ts-ignore
  typeof Uint8Array.from([]).toHex === "function" && typeof Uint8Array.fromHex === "function"
))();
var hexes = /* @__PURE__ */ Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0"));
function bytesToHex3(bytes) {
  abytes3(bytes);
  if (hasHexBuiltin)
    return bytes.toHex();
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += hexes[bytes[i]];
  }
  return hex;
}
var asciis = { _0: 48, _9: 57, A: 65, F: 70, a: 97, f: 102 };
function asciiToBase16(ch) {
  if (ch >= asciis._0 && ch <= asciis._9)
    return ch - asciis._0;
  if (ch >= asciis.A && ch <= asciis.F)
    return ch - (asciis.A - 10);
  if (ch >= asciis.a && ch <= asciis.f)
    return ch - (asciis.a - 10);
  return;
}
function hexToBytes3(hex) {
  if (typeof hex !== "string")
    throw new Error("hex string expected, got " + typeof hex);
  if (hasHexBuiltin)
    return Uint8Array.fromHex(hex);
  const hl = hex.length;
  const al = hl / 2;
  if (hl % 2)
    throw new Error("hex string expected, got unpadded hex of length " + hl);
  const array = new Uint8Array(al);
  for (let ai = 0, hi = 0; ai < al; ai++, hi += 2) {
    const n1 = asciiToBase16(hex.charCodeAt(hi));
    const n2 = asciiToBase16(hex.charCodeAt(hi + 1));
    if (n1 === void 0 || n2 === void 0) {
      const char = hex[hi] + hex[hi + 1];
      throw new Error('hex string expected, got non-hex character "' + char + '" at index ' + hi);
    }
    array[ai] = n1 * 16 + n2;
  }
  return array;
}
function utf8ToBytes2(str) {
  if (typeof str !== "string")
    throw new Error("string expected");
  return new Uint8Array(new TextEncoder().encode(str));
}
function toBytes2(data) {
  if (typeof data === "string")
    data = utf8ToBytes2(data);
  abytes3(data);
  return data;
}
function kdfInputToBytes(data) {
  if (typeof data === "string")
    data = utf8ToBytes2(data);
  abytes3(data);
  return data;
}
function concatBytes3(...arrays) {
  let sum = 0;
  for (let i = 0; i < arrays.length; i++) {
    const a = arrays[i];
    abytes3(a);
    sum += a.length;
  }
  const res = new Uint8Array(sum);
  for (let i = 0, pad = 0; i < arrays.length; i++) {
    const a = arrays[i];
    res.set(a, pad);
    pad += a.length;
  }
  return res;
}
function checkOpts2(defaults, opts) {
  if (opts !== void 0 && {}.toString.call(opts) !== "[object Object]")
    throw new Error("options should be object or undefined");
  const merged = Object.assign(defaults, opts);
  return merged;
}
var Hash2 = class {
};
function createHasher(hashCons) {
  const hashC = (msg) => hashCons().update(toBytes2(msg)).digest();
  const tmp = hashCons();
  hashC.outputLen = tmp.outputLen;
  hashC.blockLen = tmp.blockLen;
  hashC.create = () => hashCons();
  return hashC;
}
function randomBytes2(bytesLength = 32) {
  if (crypto3 && typeof crypto3.getRandomValues === "function") {
    return crypto3.getRandomValues(new Uint8Array(bytesLength));
  }
  if (crypto3 && typeof crypto3.randomBytes === "function") {
    return Uint8Array.from(crypto3.randomBytes(bytesLength));
  }
  throw new Error("crypto.getRandomValues must be defined");
}

// ../../node_modules/.pnpm/@noble+hashes@1.8.0/node_modules/@noble/hashes/esm/hmac.js
var HMAC = class extends Hash2 {
  constructor(hash, _key) {
    super();
    this.finished = false;
    this.destroyed = false;
    ahash(hash);
    const key = toBytes2(_key);
    this.iHash = hash.create();
    if (typeof this.iHash.update !== "function")
      throw new Error("Expected instance of class which extends utils.Hash");
    this.blockLen = this.iHash.blockLen;
    this.outputLen = this.iHash.outputLen;
    const blockLen = this.blockLen;
    const pad = new Uint8Array(blockLen);
    pad.set(key.length > blockLen ? hash.create().update(key).digest() : key);
    for (let i = 0; i < pad.length; i++)
      pad[i] ^= 54;
    this.iHash.update(pad);
    this.oHash = hash.create();
    for (let i = 0; i < pad.length; i++)
      pad[i] ^= 54 ^ 92;
    this.oHash.update(pad);
    clean2(pad);
  }
  update(buf) {
    aexists2(this);
    this.iHash.update(buf);
    return this;
  }
  digestInto(out) {
    aexists2(this);
    abytes3(out, this.outputLen);
    this.finished = true;
    this.iHash.digestInto(out);
    this.oHash.update(out);
    this.oHash.digestInto(out);
    this.destroy();
  }
  digest() {
    const out = new Uint8Array(this.oHash.outputLen);
    this.digestInto(out);
    return out;
  }
  _cloneInto(to) {
    to || (to = Object.create(Object.getPrototypeOf(this), {}));
    const { oHash, iHash, finished, destroyed, blockLen, outputLen } = this;
    to = to;
    to.finished = finished;
    to.destroyed = destroyed;
    to.blockLen = blockLen;
    to.outputLen = outputLen;
    to.oHash = oHash._cloneInto(to.oHash);
    to.iHash = iHash._cloneInto(to.iHash);
    return to;
  }
  clone() {
    return this._cloneInto();
  }
  destroy() {
    this.destroyed = true;
    this.oHash.destroy();
    this.iHash.destroy();
  }
};
var hmac = (hash, key, message) => new HMAC(hash, key).update(message).digest();
hmac.create = (hash, key) => new HMAC(hash, key);

// ../../node_modules/.pnpm/@noble+hashes@1.8.0/node_modules/@noble/hashes/esm/pbkdf2.js
function pbkdf2Init(hash, _password, _salt, _opts) {
  ahash(hash);
  const opts = checkOpts2({ dkLen: 32, asyncTick: 10 }, _opts);
  const { c, dkLen, asyncTick } = opts;
  anumber2(c);
  anumber2(dkLen);
  anumber2(asyncTick);
  if (c < 1)
    throw new Error("iterations (c) should be >= 1");
  const password = kdfInputToBytes(_password);
  const salt = kdfInputToBytes(_salt);
  const DK = new Uint8Array(dkLen);
  const PRF = hmac.create(hash, password);
  const PRFSalt = PRF._cloneInto().update(salt);
  return { c, dkLen, asyncTick, DK, PRF, PRFSalt };
}
function pbkdf2Output(PRF, PRFSalt, DK, prfW, u) {
  PRF.destroy();
  PRFSalt.destroy();
  if (prfW)
    prfW.destroy();
  clean2(u);
  return DK;
}
function pbkdf2(hash, password, salt, opts) {
  const { c, dkLen, DK, PRF, PRFSalt } = pbkdf2Init(hash, password, salt, opts);
  let prfW;
  const arr = new Uint8Array(4);
  const view = createView2(arr);
  const u = new Uint8Array(PRF.outputLen);
  for (let ti = 1, pos = 0; pos < dkLen; ti++, pos += PRF.outputLen) {
    const Ti = DK.subarray(pos, pos + PRF.outputLen);
    view.setInt32(0, ti, false);
    (prfW = PRFSalt._cloneInto(prfW)).update(arr).digestInto(u);
    Ti.set(u.subarray(0, Ti.length));
    for (let ui = 1; ui < c; ui++) {
      PRF._cloneInto(prfW).update(u).digestInto(u);
      for (let i = 0; i < Ti.length; i++)
        Ti[i] ^= u[i];
    }
  }
  return pbkdf2Output(PRF, PRFSalt, DK, prfW, u);
}

// ../../node_modules/.pnpm/@noble+hashes@1.8.0/node_modules/@noble/hashes/esm/_md.js
function setBigUint642(view, byteOffset, value, isLE2) {
  if (typeof view.setBigUint64 === "function")
    return view.setBigUint64(byteOffset, value, isLE2);
  const _32n2 = BigInt(32);
  const _u32_max = BigInt(4294967295);
  const wh = Number(value >> _32n2 & _u32_max);
  const wl = Number(value & _u32_max);
  const h2 = isLE2 ? 4 : 0;
  const l = isLE2 ? 0 : 4;
  view.setUint32(byteOffset + h2, wh, isLE2);
  view.setUint32(byteOffset + l, wl, isLE2);
}
function Chi(a, b, c) {
  return a & b ^ ~a & c;
}
function Maj(a, b, c) {
  return a & b ^ a & c ^ b & c;
}
var HashMD = class extends Hash2 {
  constructor(blockLen, outputLen, padOffset, isLE2) {
    super();
    this.finished = false;
    this.length = 0;
    this.pos = 0;
    this.destroyed = false;
    this.blockLen = blockLen;
    this.outputLen = outputLen;
    this.padOffset = padOffset;
    this.isLE = isLE2;
    this.buffer = new Uint8Array(blockLen);
    this.view = createView2(this.buffer);
  }
  update(data) {
    aexists2(this);
    data = toBytes2(data);
    abytes3(data);
    const { view, buffer, blockLen } = this;
    const len = data.length;
    for (let pos = 0; pos < len; ) {
      const take = Math.min(blockLen - this.pos, len - pos);
      if (take === blockLen) {
        const dataView = createView2(data);
        for (; blockLen <= len - pos; pos += blockLen)
          this.process(dataView, pos);
        continue;
      }
      buffer.set(data.subarray(pos, pos + take), this.pos);
      this.pos += take;
      pos += take;
      if (this.pos === blockLen) {
        this.process(view, 0);
        this.pos = 0;
      }
    }
    this.length += data.length;
    this.roundClean();
    return this;
  }
  digestInto(out) {
    aexists2(this);
    aoutput2(out, this);
    this.finished = true;
    const { buffer, view, blockLen, isLE: isLE2 } = this;
    let { pos } = this;
    buffer[pos++] = 128;
    clean2(this.buffer.subarray(pos));
    if (this.padOffset > blockLen - pos) {
      this.process(view, 0);
      pos = 0;
    }
    for (let i = pos; i < blockLen; i++)
      buffer[i] = 0;
    setBigUint642(view, blockLen - 8, BigInt(this.length * 8), isLE2);
    this.process(view, 0);
    const oview = createView2(out);
    const len = this.outputLen;
    if (len % 4)
      throw new Error("_sha2: outputLen should be aligned to 32bit");
    const outLen = len / 4;
    const state = this.get();
    if (outLen > state.length)
      throw new Error("_sha2: outputLen bigger than state");
    for (let i = 0; i < outLen; i++)
      oview.setUint32(4 * i, state[i], isLE2);
  }
  digest() {
    const { buffer, outputLen } = this;
    this.digestInto(buffer);
    const res = buffer.slice(0, outputLen);
    this.destroy();
    return res;
  }
  _cloneInto(to) {
    to || (to = new this.constructor());
    to.set(...this.get());
    const { blockLen, buffer, length, finished, destroyed, pos } = this;
    to.destroyed = destroyed;
    to.finished = finished;
    to.length = length;
    to.pos = pos;
    if (length % blockLen)
      to.buffer.set(buffer);
    return to;
  }
  clone() {
    return this._cloneInto();
  }
};
var SHA256_IV = /* @__PURE__ */ Uint32Array.from([
  1779033703,
  3144134277,
  1013904242,
  2773480762,
  1359893119,
  2600822924,
  528734635,
  1541459225
]);
var SHA384_IV = /* @__PURE__ */ Uint32Array.from([
  3418070365,
  3238371032,
  1654270250,
  914150663,
  2438529370,
  812702999,
  355462360,
  4144912697,
  1731405415,
  4290775857,
  2394180231,
  1750603025,
  3675008525,
  1694076839,
  1203062813,
  3204075428
]);
var SHA512_IV = /* @__PURE__ */ Uint32Array.from([
  1779033703,
  4089235720,
  3144134277,
  2227873595,
  1013904242,
  4271175723,
  2773480762,
  1595750129,
  1359893119,
  2917565137,
  2600822924,
  725511199,
  528734635,
  4215389547,
  1541459225,
  327033209
]);

// ../../node_modules/.pnpm/@noble+hashes@1.8.0/node_modules/@noble/hashes/esm/_u64.js
var U32_MASK64 = /* @__PURE__ */ BigInt(2 ** 32 - 1);
var _32n = /* @__PURE__ */ BigInt(32);
function fromBig(n, le = false) {
  if (le)
    return { h: Number(n & U32_MASK64), l: Number(n >> _32n & U32_MASK64) };
  return { h: Number(n >> _32n & U32_MASK64) | 0, l: Number(n & U32_MASK64) | 0 };
}
function split(lst, le = false) {
  const len = lst.length;
  let Ah = new Uint32Array(len);
  let Al = new Uint32Array(len);
  for (let i = 0; i < len; i++) {
    const { h: h2, l } = fromBig(lst[i], le);
    [Ah[i], Al[i]] = [h2, l];
  }
  return [Ah, Al];
}
var shrSH = (h2, _l, s) => h2 >>> s;
var shrSL = (h2, l, s) => h2 << 32 - s | l >>> s;
var rotrSH = (h2, l, s) => h2 >>> s | l << 32 - s;
var rotrSL = (h2, l, s) => h2 << 32 - s | l >>> s;
var rotrBH = (h2, l, s) => h2 << 64 - s | l >>> s - 32;
var rotrBL = (h2, l, s) => h2 >>> s - 32 | l << 64 - s;
function add(Ah, Al, Bh, Bl) {
  const l = (Al >>> 0) + (Bl >>> 0);
  return { h: Ah + Bh + (l / 2 ** 32 | 0) | 0, l: l | 0 };
}
var add3L = (Al, Bl, Cl) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0);
var add3H = (low, Ah, Bh, Ch) => Ah + Bh + Ch + (low / 2 ** 32 | 0) | 0;
var add4L = (Al, Bl, Cl, Dl) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0) + (Dl >>> 0);
var add4H = (low, Ah, Bh, Ch, Dh) => Ah + Bh + Ch + Dh + (low / 2 ** 32 | 0) | 0;
var add5L = (Al, Bl, Cl, Dl, El) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0) + (Dl >>> 0) + (El >>> 0);
var add5H = (low, Ah, Bh, Ch, Dh, Eh) => Ah + Bh + Ch + Dh + Eh + (low / 2 ** 32 | 0) | 0;

// ../../node_modules/.pnpm/@noble+hashes@1.8.0/node_modules/@noble/hashes/esm/sha2.js
var SHA256_K = /* @__PURE__ */ Uint32Array.from([
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
]);
var SHA256_W = /* @__PURE__ */ new Uint32Array(64);
var SHA256 = class extends HashMD {
  constructor(outputLen = 32) {
    super(64, outputLen, 8, false);
    this.A = SHA256_IV[0] | 0;
    this.B = SHA256_IV[1] | 0;
    this.C = SHA256_IV[2] | 0;
    this.D = SHA256_IV[3] | 0;
    this.E = SHA256_IV[4] | 0;
    this.F = SHA256_IV[5] | 0;
    this.G = SHA256_IV[6] | 0;
    this.H = SHA256_IV[7] | 0;
  }
  get() {
    const { A, B, C: C2, D, E, F, G: G3, H: H2 } = this;
    return [A, B, C2, D, E, F, G3, H2];
  }
  // prettier-ignore
  set(A, B, C2, D, E, F, G3, H2) {
    this.A = A | 0;
    this.B = B | 0;
    this.C = C2 | 0;
    this.D = D | 0;
    this.E = E | 0;
    this.F = F | 0;
    this.G = G3 | 0;
    this.H = H2 | 0;
  }
  process(view, offset) {
    for (let i = 0; i < 16; i++, offset += 4)
      SHA256_W[i] = view.getUint32(offset, false);
    for (let i = 16; i < 64; i++) {
      const W15 = SHA256_W[i - 15];
      const W2 = SHA256_W[i - 2];
      const s0 = rotr(W15, 7) ^ rotr(W15, 18) ^ W15 >>> 3;
      const s1 = rotr(W2, 17) ^ rotr(W2, 19) ^ W2 >>> 10;
      SHA256_W[i] = s1 + SHA256_W[i - 7] + s0 + SHA256_W[i - 16] | 0;
    }
    let { A, B, C: C2, D, E, F, G: G3, H: H2 } = this;
    for (let i = 0; i < 64; i++) {
      const sigma1 = rotr(E, 6) ^ rotr(E, 11) ^ rotr(E, 25);
      const T1 = H2 + sigma1 + Chi(E, F, G3) + SHA256_K[i] + SHA256_W[i] | 0;
      const sigma0 = rotr(A, 2) ^ rotr(A, 13) ^ rotr(A, 22);
      const T2 = sigma0 + Maj(A, B, C2) | 0;
      H2 = G3;
      G3 = F;
      F = E;
      E = D + T1 | 0;
      D = C2;
      C2 = B;
      B = A;
      A = T1 + T2 | 0;
    }
    A = A + this.A | 0;
    B = B + this.B | 0;
    C2 = C2 + this.C | 0;
    D = D + this.D | 0;
    E = E + this.E | 0;
    F = F + this.F | 0;
    G3 = G3 + this.G | 0;
    H2 = H2 + this.H | 0;
    this.set(A, B, C2, D, E, F, G3, H2);
  }
  roundClean() {
    clean2(SHA256_W);
  }
  destroy() {
    this.set(0, 0, 0, 0, 0, 0, 0, 0);
    clean2(this.buffer);
  }
};
var K512 = /* @__PURE__ */ (() => split([
  "0x428a2f98d728ae22",
  "0x7137449123ef65cd",
  "0xb5c0fbcfec4d3b2f",
  "0xe9b5dba58189dbbc",
  "0x3956c25bf348b538",
  "0x59f111f1b605d019",
  "0x923f82a4af194f9b",
  "0xab1c5ed5da6d8118",
  "0xd807aa98a3030242",
  "0x12835b0145706fbe",
  "0x243185be4ee4b28c",
  "0x550c7dc3d5ffb4e2",
  "0x72be5d74f27b896f",
  "0x80deb1fe3b1696b1",
  "0x9bdc06a725c71235",
  "0xc19bf174cf692694",
  "0xe49b69c19ef14ad2",
  "0xefbe4786384f25e3",
  "0x0fc19dc68b8cd5b5",
  "0x240ca1cc77ac9c65",
  "0x2de92c6f592b0275",
  "0x4a7484aa6ea6e483",
  "0x5cb0a9dcbd41fbd4",
  "0x76f988da831153b5",
  "0x983e5152ee66dfab",
  "0xa831c66d2db43210",
  "0xb00327c898fb213f",
  "0xbf597fc7beef0ee4",
  "0xc6e00bf33da88fc2",
  "0xd5a79147930aa725",
  "0x06ca6351e003826f",
  "0x142929670a0e6e70",
  "0x27b70a8546d22ffc",
  "0x2e1b21385c26c926",
  "0x4d2c6dfc5ac42aed",
  "0x53380d139d95b3df",
  "0x650a73548baf63de",
  "0x766a0abb3c77b2a8",
  "0x81c2c92e47edaee6",
  "0x92722c851482353b",
  "0xa2bfe8a14cf10364",
  "0xa81a664bbc423001",
  "0xc24b8b70d0f89791",
  "0xc76c51a30654be30",
  "0xd192e819d6ef5218",
  "0xd69906245565a910",
  "0xf40e35855771202a",
  "0x106aa07032bbd1b8",
  "0x19a4c116b8d2d0c8",
  "0x1e376c085141ab53",
  "0x2748774cdf8eeb99",
  "0x34b0bcb5e19b48a8",
  "0x391c0cb3c5c95a63",
  "0x4ed8aa4ae3418acb",
  "0x5b9cca4f7763e373",
  "0x682e6ff3d6b2b8a3",
  "0x748f82ee5defb2fc",
  "0x78a5636f43172f60",
  "0x84c87814a1f0ab72",
  "0x8cc702081a6439ec",
  "0x90befffa23631e28",
  "0xa4506cebde82bde9",
  "0xbef9a3f7b2c67915",
  "0xc67178f2e372532b",
  "0xca273eceea26619c",
  "0xd186b8c721c0c207",
  "0xeada7dd6cde0eb1e",
  "0xf57d4f7fee6ed178",
  "0x06f067aa72176fba",
  "0x0a637dc5a2c898a6",
  "0x113f9804bef90dae",
  "0x1b710b35131c471b",
  "0x28db77f523047d84",
  "0x32caab7b40c72493",
  "0x3c9ebe0a15c9bebc",
  "0x431d67c49c100d4c",
  "0x4cc5d4becb3e42b6",
  "0x597f299cfc657e2a",
  "0x5fcb6fab3ad6faec",
  "0x6c44198c4a475817"
].map((n) => BigInt(n))))();
var SHA512_Kh = /* @__PURE__ */ (() => K512[0])();
var SHA512_Kl = /* @__PURE__ */ (() => K512[1])();
var SHA512_W_H = /* @__PURE__ */ new Uint32Array(80);
var SHA512_W_L = /* @__PURE__ */ new Uint32Array(80);
var SHA512 = class extends HashMD {
  constructor(outputLen = 64) {
    super(128, outputLen, 16, false);
    this.Ah = SHA512_IV[0] | 0;
    this.Al = SHA512_IV[1] | 0;
    this.Bh = SHA512_IV[2] | 0;
    this.Bl = SHA512_IV[3] | 0;
    this.Ch = SHA512_IV[4] | 0;
    this.Cl = SHA512_IV[5] | 0;
    this.Dh = SHA512_IV[6] | 0;
    this.Dl = SHA512_IV[7] | 0;
    this.Eh = SHA512_IV[8] | 0;
    this.El = SHA512_IV[9] | 0;
    this.Fh = SHA512_IV[10] | 0;
    this.Fl = SHA512_IV[11] | 0;
    this.Gh = SHA512_IV[12] | 0;
    this.Gl = SHA512_IV[13] | 0;
    this.Hh = SHA512_IV[14] | 0;
    this.Hl = SHA512_IV[15] | 0;
  }
  // prettier-ignore
  get() {
    const { Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl } = this;
    return [Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl];
  }
  // prettier-ignore
  set(Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl) {
    this.Ah = Ah | 0;
    this.Al = Al | 0;
    this.Bh = Bh | 0;
    this.Bl = Bl | 0;
    this.Ch = Ch | 0;
    this.Cl = Cl | 0;
    this.Dh = Dh | 0;
    this.Dl = Dl | 0;
    this.Eh = Eh | 0;
    this.El = El | 0;
    this.Fh = Fh | 0;
    this.Fl = Fl | 0;
    this.Gh = Gh | 0;
    this.Gl = Gl | 0;
    this.Hh = Hh | 0;
    this.Hl = Hl | 0;
  }
  process(view, offset) {
    for (let i = 0; i < 16; i++, offset += 4) {
      SHA512_W_H[i] = view.getUint32(offset);
      SHA512_W_L[i] = view.getUint32(offset += 4);
    }
    for (let i = 16; i < 80; i++) {
      const W15h = SHA512_W_H[i - 15] | 0;
      const W15l = SHA512_W_L[i - 15] | 0;
      const s0h = rotrSH(W15h, W15l, 1) ^ rotrSH(W15h, W15l, 8) ^ shrSH(W15h, W15l, 7);
      const s0l = rotrSL(W15h, W15l, 1) ^ rotrSL(W15h, W15l, 8) ^ shrSL(W15h, W15l, 7);
      const W2h = SHA512_W_H[i - 2] | 0;
      const W2l = SHA512_W_L[i - 2] | 0;
      const s1h = rotrSH(W2h, W2l, 19) ^ rotrBH(W2h, W2l, 61) ^ shrSH(W2h, W2l, 6);
      const s1l = rotrSL(W2h, W2l, 19) ^ rotrBL(W2h, W2l, 61) ^ shrSL(W2h, W2l, 6);
      const SUMl = add4L(s0l, s1l, SHA512_W_L[i - 7], SHA512_W_L[i - 16]);
      const SUMh = add4H(SUMl, s0h, s1h, SHA512_W_H[i - 7], SHA512_W_H[i - 16]);
      SHA512_W_H[i] = SUMh | 0;
      SHA512_W_L[i] = SUMl | 0;
    }
    let { Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl } = this;
    for (let i = 0; i < 80; i++) {
      const sigma1h = rotrSH(Eh, El, 14) ^ rotrSH(Eh, El, 18) ^ rotrBH(Eh, El, 41);
      const sigma1l = rotrSL(Eh, El, 14) ^ rotrSL(Eh, El, 18) ^ rotrBL(Eh, El, 41);
      const CHIh = Eh & Fh ^ ~Eh & Gh;
      const CHIl = El & Fl ^ ~El & Gl;
      const T1ll = add5L(Hl, sigma1l, CHIl, SHA512_Kl[i], SHA512_W_L[i]);
      const T1h = add5H(T1ll, Hh, sigma1h, CHIh, SHA512_Kh[i], SHA512_W_H[i]);
      const T1l = T1ll | 0;
      const sigma0h = rotrSH(Ah, Al, 28) ^ rotrBH(Ah, Al, 34) ^ rotrBH(Ah, Al, 39);
      const sigma0l = rotrSL(Ah, Al, 28) ^ rotrBL(Ah, Al, 34) ^ rotrBL(Ah, Al, 39);
      const MAJh = Ah & Bh ^ Ah & Ch ^ Bh & Ch;
      const MAJl = Al & Bl ^ Al & Cl ^ Bl & Cl;
      Hh = Gh | 0;
      Hl = Gl | 0;
      Gh = Fh | 0;
      Gl = Fl | 0;
      Fh = Eh | 0;
      Fl = El | 0;
      ({ h: Eh, l: El } = add(Dh | 0, Dl | 0, T1h | 0, T1l | 0));
      Dh = Ch | 0;
      Dl = Cl | 0;
      Ch = Bh | 0;
      Cl = Bl | 0;
      Bh = Ah | 0;
      Bl = Al | 0;
      const All = add3L(T1l, sigma0l, MAJl);
      Ah = add3H(All, T1h, sigma0h, MAJh);
      Al = All | 0;
    }
    ({ h: Ah, l: Al } = add(this.Ah | 0, this.Al | 0, Ah | 0, Al | 0));
    ({ h: Bh, l: Bl } = add(this.Bh | 0, this.Bl | 0, Bh | 0, Bl | 0));
    ({ h: Ch, l: Cl } = add(this.Ch | 0, this.Cl | 0, Ch | 0, Cl | 0));
    ({ h: Dh, l: Dl } = add(this.Dh | 0, this.Dl | 0, Dh | 0, Dl | 0));
    ({ h: Eh, l: El } = add(this.Eh | 0, this.El | 0, Eh | 0, El | 0));
    ({ h: Fh, l: Fl } = add(this.Fh | 0, this.Fl | 0, Fh | 0, Fl | 0));
    ({ h: Gh, l: Gl } = add(this.Gh | 0, this.Gl | 0, Gh | 0, Gl | 0));
    ({ h: Hh, l: Hl } = add(this.Hh | 0, this.Hl | 0, Hh | 0, Hl | 0));
    this.set(Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl);
  }
  roundClean() {
    clean2(SHA512_W_H, SHA512_W_L);
  }
  destroy() {
    clean2(this.buffer);
    this.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
  }
};
var SHA384 = class extends SHA512 {
  constructor() {
    super(48);
    this.Ah = SHA384_IV[0] | 0;
    this.Al = SHA384_IV[1] | 0;
    this.Bh = SHA384_IV[2] | 0;
    this.Bl = SHA384_IV[3] | 0;
    this.Ch = SHA384_IV[4] | 0;
    this.Cl = SHA384_IV[5] | 0;
    this.Dh = SHA384_IV[6] | 0;
    this.Dl = SHA384_IV[7] | 0;
    this.Eh = SHA384_IV[8] | 0;
    this.El = SHA384_IV[9] | 0;
    this.Fh = SHA384_IV[10] | 0;
    this.Fl = SHA384_IV[11] | 0;
    this.Gh = SHA384_IV[12] | 0;
    this.Gl = SHA384_IV[13] | 0;
    this.Hh = SHA384_IV[14] | 0;
    this.Hl = SHA384_IV[15] | 0;
  }
};
var sha256 = /* @__PURE__ */ createHasher(() => new SHA256());
var sha512 = /* @__PURE__ */ createHasher(() => new SHA512());
var sha384 = /* @__PURE__ */ createHasher(() => new SHA384());

// ../../node_modules/.pnpm/@noble+hashes@1.8.0/node_modules/@noble/hashes/esm/sha256.js
var sha2562 = sha256;

// ../../node_modules/.pnpm/@noble+hashes@1.8.0/node_modules/@noble/hashes/esm/sha512.js
var sha5122 = sha512;
var sha3842 = sha384;

// ../../node_modules/.pnpm/@noble+hashes@1.8.0/node_modules/@noble/hashes/esm/hkdf.js
function extract(hash, ikm, salt) {
  ahash(hash);
  if (salt === void 0)
    salt = new Uint8Array(hash.outputLen);
  return hmac(hash, toBytes2(salt), toBytes2(ikm));
}
var HKDF_COUNTER = /* @__PURE__ */ Uint8Array.from([0]);
var EMPTY_BUFFER = /* @__PURE__ */ Uint8Array.of();
function expand(hash, prk, info, length = 32) {
  ahash(hash);
  anumber2(length);
  const olen = hash.outputLen;
  if (length > 255 * olen)
    throw new Error("Length should be <= 255*HashLen");
  const blocks = Math.ceil(length / olen);
  if (info === void 0)
    info = EMPTY_BUFFER;
  const okm = new Uint8Array(blocks * olen);
  const HMAC2 = hmac.create(hash, prk);
  const HMACTmp = HMAC2._cloneInto();
  const T = new Uint8Array(HMAC2.outputLen);
  for (let counter = 0; counter < blocks; counter++) {
    HKDF_COUNTER[0] = counter + 1;
    HMACTmp.update(counter === 0 ? EMPTY_BUFFER : T).update(info).update(HKDF_COUNTER).digestInto(T);
    okm.set(T, olen * counter);
    HMAC2._cloneInto(HMACTmp);
  }
  HMAC2.destroy();
  HMACTmp.destroy();
  clean2(T, HKDF_COUNTER);
  return okm.slice(0, length);
}
var hkdf = (hash, ikm, salt, info, length) => expand(hash, extract(hash, ikm, salt), info, length);

// ../../node_modules/.pnpm/@noble+curves@1.9.7/node_modules/@noble/curves/esm/utils.js
var _0n = /* @__PURE__ */ BigInt(0);
var _1n = /* @__PURE__ */ BigInt(1);
function _abool2(value, title = "") {
  if (typeof value !== "boolean") {
    const prefix = title && `"${title}"`;
    throw new Error(prefix + "expected boolean, got type=" + typeof value);
  }
  return value;
}
function _abytes2(value, length, title = "") {
  const bytes = isBytes3(value);
  const len = value?.length;
  const needsLen = length !== void 0;
  if (!bytes || needsLen && len !== length) {
    const prefix = title && `"${title}" `;
    const ofLen = needsLen ? ` of length ${length}` : "";
    const got = bytes ? `length=${len}` : `type=${typeof value}`;
    throw new Error(prefix + "expected Uint8Array" + ofLen + ", got " + got);
  }
  return value;
}
function numberToHexUnpadded(num) {
  const hex = num.toString(16);
  return hex.length & 1 ? "0" + hex : hex;
}
function hexToNumber(hex) {
  if (typeof hex !== "string")
    throw new Error("hex string expected, got " + typeof hex);
  return hex === "" ? _0n : BigInt("0x" + hex);
}
function bytesToNumberBE(bytes) {
  return hexToNumber(bytesToHex3(bytes));
}
function bytesToNumberLE(bytes) {
  abytes3(bytes);
  return hexToNumber(bytesToHex3(Uint8Array.from(bytes).reverse()));
}
function numberToBytesBE(n, len) {
  return hexToBytes3(n.toString(16).padStart(len * 2, "0"));
}
function numberToBytesLE(n, len) {
  return numberToBytesBE(n, len).reverse();
}
function ensureBytes(title, hex, expectedLength) {
  let res;
  if (typeof hex === "string") {
    try {
      res = hexToBytes3(hex);
    } catch (e) {
      throw new Error(title + " must be hex string or Uint8Array, cause: " + e);
    }
  } else if (isBytes3(hex)) {
    res = Uint8Array.from(hex);
  } else {
    throw new Error(title + " must be hex string or Uint8Array");
  }
  const len = res.length;
  if (typeof expectedLength === "number" && len !== expectedLength)
    throw new Error(title + " of length " + expectedLength + " expected, got " + len);
  return res;
}
var isPosBig = (n) => typeof n === "bigint" && _0n <= n;
function inRange(n, min, max) {
  return isPosBig(n) && isPosBig(min) && isPosBig(max) && min <= n && n < max;
}
function aInRange(title, n, min, max) {
  if (!inRange(n, min, max))
    throw new Error("expected valid " + title + ": " + min + " <= n < " + max + ", got " + n);
}
function bitLen(n) {
  let len;
  for (len = 0; n > _0n; n >>= _1n, len += 1)
    ;
  return len;
}
var bitMask = (n) => (_1n << BigInt(n)) - _1n;
function createHmacDrbg(hashLen, qByteLen, hmacFn) {
  if (typeof hashLen !== "number" || hashLen < 2)
    throw new Error("hashLen must be a number");
  if (typeof qByteLen !== "number" || qByteLen < 2)
    throw new Error("qByteLen must be a number");
  if (typeof hmacFn !== "function")
    throw new Error("hmacFn must be a function");
  const u8n2 = (len) => new Uint8Array(len);
  const u8of = (byte) => Uint8Array.of(byte);
  let v = u8n2(hashLen);
  let k = u8n2(hashLen);
  let i = 0;
  const reset = () => {
    v.fill(1);
    k.fill(0);
    i = 0;
  };
  const h2 = (...b) => hmacFn(k, v, ...b);
  const reseed = (seed = u8n2(0)) => {
    k = h2(u8of(0), seed);
    v = h2();
    if (seed.length === 0)
      return;
    k = h2(u8of(1), seed);
    v = h2();
  };
  const gen = () => {
    if (i++ >= 1e3)
      throw new Error("drbg: tried 1000 values");
    let len = 0;
    const out = [];
    while (len < qByteLen) {
      v = h2();
      const sl = v.slice();
      out.push(sl);
      len += v.length;
    }
    return concatBytes3(...out);
  };
  const genUntil = (seed, pred) => {
    reset();
    reseed(seed);
    let res = void 0;
    while (!(res = pred(gen())))
      reseed();
    reset();
    return res;
  };
  return genUntil;
}
function _validateObject(object, fields, optFields = {}) {
  if (!object || typeof object !== "object")
    throw new Error("expected valid options object");
  function checkField(fieldName, expectedType, isOpt) {
    const val = object[fieldName];
    if (isOpt && val === void 0)
      return;
    const current = typeof val;
    if (current !== expectedType || val === null)
      throw new Error(`param "${fieldName}" is invalid: expected ${expectedType}, got ${current}`);
  }
  Object.entries(fields).forEach(([k, v]) => checkField(k, v, false));
  Object.entries(optFields).forEach(([k, v]) => checkField(k, v, true));
}
function memoized(fn) {
  const map = /* @__PURE__ */ new WeakMap();
  return (arg, ...args) => {
    const val = map.get(arg);
    if (val !== void 0)
      return val;
    const computed = fn(arg, ...args);
    map.set(arg, computed);
    return computed;
  };
}

// ../../node_modules/.pnpm/@noble+curves@1.9.7/node_modules/@noble/curves/esm/abstract/modular.js
var _0n2 = BigInt(0);
var _1n2 = BigInt(1);
var _2n = /* @__PURE__ */ BigInt(2);
var _3n = /* @__PURE__ */ BigInt(3);
var _4n = /* @__PURE__ */ BigInt(4);
var _5n = /* @__PURE__ */ BigInt(5);
var _7n = /* @__PURE__ */ BigInt(7);
var _8n = /* @__PURE__ */ BigInt(8);
var _9n = /* @__PURE__ */ BigInt(9);
var _16n = /* @__PURE__ */ BigInt(16);
function mod(a, b) {
  const result = a % b;
  return result >= _0n2 ? result : b + result;
}
function pow22(x, power, modulo) {
  let res = x;
  while (power-- > _0n2) {
    res *= res;
    res %= modulo;
  }
  return res;
}
function invert2(number, modulo) {
  if (number === _0n2)
    throw new Error("invert: expected non-zero number");
  if (modulo <= _0n2)
    throw new Error("invert: expected positive modulus, got " + modulo);
  let a = mod(number, modulo);
  let b = modulo;
  let x = _0n2, y = _1n2, u = _1n2, v = _0n2;
  while (a !== _0n2) {
    const q = b / a;
    const r = b % a;
    const m = x - u * q;
    const n = y - v * q;
    b = a, a = r, x = u, y = v, u = m, v = n;
  }
  const gcd = b;
  if (gcd !== _1n2)
    throw new Error("invert: does not exist");
  return mod(x, modulo);
}
function assertIsSquare(Fp, root, n) {
  if (!Fp.eql(Fp.sqr(root), n))
    throw new Error("Cannot find square root");
}
function sqrt3mod4(Fp, n) {
  const p1div4 = (Fp.ORDER + _1n2) / _4n;
  const root = Fp.pow(n, p1div4);
  assertIsSquare(Fp, root, n);
  return root;
}
function sqrt5mod8(Fp, n) {
  const p5div8 = (Fp.ORDER - _5n) / _8n;
  const n2 = Fp.mul(n, _2n);
  const v = Fp.pow(n2, p5div8);
  const nv = Fp.mul(n, v);
  const i = Fp.mul(Fp.mul(nv, _2n), v);
  const root = Fp.mul(nv, Fp.sub(i, Fp.ONE));
  assertIsSquare(Fp, root, n);
  return root;
}
function sqrt9mod16(P2) {
  const Fp_ = Field(P2);
  const tn = tonelliShanks(P2);
  const c1 = tn(Fp_, Fp_.neg(Fp_.ONE));
  const c2 = tn(Fp_, c1);
  const c3 = tn(Fp_, Fp_.neg(c1));
  const c4 = (P2 + _7n) / _16n;
  return (Fp, n) => {
    let tv1 = Fp.pow(n, c4);
    let tv2 = Fp.mul(tv1, c1);
    const tv3 = Fp.mul(tv1, c2);
    const tv4 = Fp.mul(tv1, c3);
    const e1 = Fp.eql(Fp.sqr(tv2), n);
    const e2 = Fp.eql(Fp.sqr(tv3), n);
    tv1 = Fp.cmov(tv1, tv2, e1);
    tv2 = Fp.cmov(tv4, tv3, e2);
    const e3 = Fp.eql(Fp.sqr(tv2), n);
    const root = Fp.cmov(tv1, tv2, e3);
    assertIsSquare(Fp, root, n);
    return root;
  };
}
function tonelliShanks(P2) {
  if (P2 < _3n)
    throw new Error("sqrt is not defined for small field");
  let Q = P2 - _1n2;
  let S = 0;
  while (Q % _2n === _0n2) {
    Q /= _2n;
    S++;
  }
  let Z = _2n;
  const _Fp = Field(P2);
  while (FpLegendre(_Fp, Z) === 1) {
    if (Z++ > 1e3)
      throw new Error("Cannot find square root: probably non-prime P");
  }
  if (S === 1)
    return sqrt3mod4;
  let cc = _Fp.pow(Z, Q);
  const Q1div2 = (Q + _1n2) / _2n;
  return function tonelliSlow(Fp, n) {
    if (Fp.is0(n))
      return n;
    if (FpLegendre(Fp, n) !== 1)
      throw new Error("Cannot find square root");
    let M2 = S;
    let c = Fp.mul(Fp.ONE, cc);
    let t = Fp.pow(n, Q);
    let R = Fp.pow(n, Q1div2);
    while (!Fp.eql(t, Fp.ONE)) {
      if (Fp.is0(t))
        return Fp.ZERO;
      let i = 1;
      let t_tmp = Fp.sqr(t);
      while (!Fp.eql(t_tmp, Fp.ONE)) {
        i++;
        t_tmp = Fp.sqr(t_tmp);
        if (i === M2)
          throw new Error("Cannot find square root");
      }
      const exponent = _1n2 << BigInt(M2 - i - 1);
      const b = Fp.pow(c, exponent);
      M2 = i;
      c = Fp.sqr(b);
      t = Fp.mul(t, c);
      R = Fp.mul(R, b);
    }
    return R;
  };
}
function FpSqrt(P2) {
  if (P2 % _4n === _3n)
    return sqrt3mod4;
  if (P2 % _8n === _5n)
    return sqrt5mod8;
  if (P2 % _16n === _9n)
    return sqrt9mod16(P2);
  return tonelliShanks(P2);
}
var FIELD_FIELDS = [
  "create",
  "isValid",
  "is0",
  "neg",
  "inv",
  "sqrt",
  "sqr",
  "eql",
  "add",
  "sub",
  "mul",
  "pow",
  "div",
  "addN",
  "subN",
  "mulN",
  "sqrN"
];
function validateField(field) {
  const initial = {
    ORDER: "bigint",
    MASK: "bigint",
    BYTES: "number",
    BITS: "number"
  };
  const opts = FIELD_FIELDS.reduce((map, val) => {
    map[val] = "function";
    return map;
  }, initial);
  _validateObject(field, opts);
  return field;
}
function FpPow(Fp, num, power) {
  if (power < _0n2)
    throw new Error("invalid exponent, negatives unsupported");
  if (power === _0n2)
    return Fp.ONE;
  if (power === _1n2)
    return num;
  let p = Fp.ONE;
  let d = num;
  while (power > _0n2) {
    if (power & _1n2)
      p = Fp.mul(p, d);
    d = Fp.sqr(d);
    power >>= _1n2;
  }
  return p;
}
function FpInvertBatch(Fp, nums, passZero = false) {
  const inverted = new Array(nums.length).fill(passZero ? Fp.ZERO : void 0);
  const multipliedAcc = nums.reduce((acc, num, i) => {
    if (Fp.is0(num))
      return acc;
    inverted[i] = acc;
    return Fp.mul(acc, num);
  }, Fp.ONE);
  const invertedAcc = Fp.inv(multipliedAcc);
  nums.reduceRight((acc, num, i) => {
    if (Fp.is0(num))
      return acc;
    inverted[i] = Fp.mul(acc, inverted[i]);
    return Fp.mul(acc, num);
  }, invertedAcc);
  return inverted;
}
function FpLegendre(Fp, n) {
  const p1mod2 = (Fp.ORDER - _1n2) / _2n;
  const powered = Fp.pow(n, p1mod2);
  const yes = Fp.eql(powered, Fp.ONE);
  const zero = Fp.eql(powered, Fp.ZERO);
  const no = Fp.eql(powered, Fp.neg(Fp.ONE));
  if (!yes && !zero && !no)
    throw new Error("invalid Legendre symbol result");
  return yes ? 1 : zero ? 0 : -1;
}
function nLength(n, nBitLength) {
  if (nBitLength !== void 0)
    anumber2(nBitLength);
  const _nBitLength = nBitLength !== void 0 ? nBitLength : n.toString(2).length;
  const nByteLength = Math.ceil(_nBitLength / 8);
  return { nBitLength: _nBitLength, nByteLength };
}
function Field(ORDER, bitLenOrOpts, isLE2 = false, opts = {}) {
  if (ORDER <= _0n2)
    throw new Error("invalid field: expected ORDER > 0, got " + ORDER);
  let _nbitLength = void 0;
  let _sqrt = void 0;
  let modFromBytes = false;
  let allowedLengths = void 0;
  if (typeof bitLenOrOpts === "object" && bitLenOrOpts != null) {
    if (opts.sqrt || isLE2)
      throw new Error("cannot specify opts in two arguments");
    const _opts = bitLenOrOpts;
    if (_opts.BITS)
      _nbitLength = _opts.BITS;
    if (_opts.sqrt)
      _sqrt = _opts.sqrt;
    if (typeof _opts.isLE === "boolean")
      isLE2 = _opts.isLE;
    if (typeof _opts.modFromBytes === "boolean")
      modFromBytes = _opts.modFromBytes;
    allowedLengths = _opts.allowedLengths;
  } else {
    if (typeof bitLenOrOpts === "number")
      _nbitLength = bitLenOrOpts;
    if (opts.sqrt)
      _sqrt = opts.sqrt;
  }
  const { nBitLength: BITS, nByteLength: BYTES } = nLength(ORDER, _nbitLength);
  if (BYTES > 2048)
    throw new Error("invalid field: expected ORDER of <= 2048 bytes");
  let sqrtP;
  const f = Object.freeze({
    ORDER,
    isLE: isLE2,
    BITS,
    BYTES,
    MASK: bitMask(BITS),
    ZERO: _0n2,
    ONE: _1n2,
    allowedLengths,
    create: (num) => mod(num, ORDER),
    isValid: (num) => {
      if (typeof num !== "bigint")
        throw new Error("invalid field element: expected bigint, got " + typeof num);
      return _0n2 <= num && num < ORDER;
    },
    is0: (num) => num === _0n2,
    // is valid and invertible
    isValidNot0: (num) => !f.is0(num) && f.isValid(num),
    isOdd: (num) => (num & _1n2) === _1n2,
    neg: (num) => mod(-num, ORDER),
    eql: (lhs, rhs) => lhs === rhs,
    sqr: (num) => mod(num * num, ORDER),
    add: (lhs, rhs) => mod(lhs + rhs, ORDER),
    sub: (lhs, rhs) => mod(lhs - rhs, ORDER),
    mul: (lhs, rhs) => mod(lhs * rhs, ORDER),
    pow: (num, power) => FpPow(f, num, power),
    div: (lhs, rhs) => mod(lhs * invert2(rhs, ORDER), ORDER),
    // Same as above, but doesn't normalize
    sqrN: (num) => num * num,
    addN: (lhs, rhs) => lhs + rhs,
    subN: (lhs, rhs) => lhs - rhs,
    mulN: (lhs, rhs) => lhs * rhs,
    inv: (num) => invert2(num, ORDER),
    sqrt: _sqrt || ((n) => {
      if (!sqrtP)
        sqrtP = FpSqrt(ORDER);
      return sqrtP(f, n);
    }),
    toBytes: (num) => isLE2 ? numberToBytesLE(num, BYTES) : numberToBytesBE(num, BYTES),
    fromBytes: (bytes, skipValidation = true) => {
      if (allowedLengths) {
        if (!allowedLengths.includes(bytes.length) || bytes.length > BYTES) {
          throw new Error("Field.fromBytes: expected " + allowedLengths + " bytes, got " + bytes.length);
        }
        const padded = new Uint8Array(BYTES);
        padded.set(bytes, isLE2 ? 0 : padded.length - bytes.length);
        bytes = padded;
      }
      if (bytes.length !== BYTES)
        throw new Error("Field.fromBytes: expected " + BYTES + " bytes, got " + bytes.length);
      let scalar = isLE2 ? bytesToNumberLE(bytes) : bytesToNumberBE(bytes);
      if (modFromBytes)
        scalar = mod(scalar, ORDER);
      if (!skipValidation) {
        if (!f.isValid(scalar))
          throw new Error("invalid field element: outside of range 0..ORDER");
      }
      return scalar;
    },
    // TODO: we don't need it here, move out to separate fn
    invertBatch: (lst) => FpInvertBatch(f, lst),
    // We can't move this out because Fp6, Fp12 implement it
    // and it's unclear what to return in there.
    cmov: (a, b, c) => c ? b : a
  });
  return Object.freeze(f);
}
function getFieldBytesLength(fieldOrder) {
  if (typeof fieldOrder !== "bigint")
    throw new Error("field order must be bigint");
  const bitLength = fieldOrder.toString(2).length;
  return Math.ceil(bitLength / 8);
}
function getMinHashLength(fieldOrder) {
  const length = getFieldBytesLength(fieldOrder);
  return length + Math.ceil(length / 2);
}
function mapHashToField(key, fieldOrder, isLE2 = false) {
  const len = key.length;
  const fieldLen = getFieldBytesLength(fieldOrder);
  const minLen = getMinHashLength(fieldOrder);
  if (len < 16 || len < minLen || len > 1024)
    throw new Error("expected " + minLen + "-1024 bytes of input, got " + len);
  const num = isLE2 ? bytesToNumberLE(key) : bytesToNumberBE(key);
  const reduced = mod(num, fieldOrder - _1n2) + _1n2;
  return isLE2 ? numberToBytesLE(reduced, fieldLen) : numberToBytesBE(reduced, fieldLen);
}

// ../../node_modules/.pnpm/@noble+curves@1.9.7/node_modules/@noble/curves/esm/abstract/curve.js
var _0n3 = BigInt(0);
var _1n3 = BigInt(1);
function negateCt(condition, item) {
  const neg = item.negate();
  return condition ? neg : item;
}
function normalizeZ(c, points) {
  const invertedZs = FpInvertBatch(c.Fp, points.map((p) => p.Z));
  return points.map((p, i) => c.fromAffine(p.toAffine(invertedZs[i])));
}
function validateW(W2, bits) {
  if (!Number.isSafeInteger(W2) || W2 <= 0 || W2 > bits)
    throw new Error("invalid window size, expected [1.." + bits + "], got W=" + W2);
}
function calcWOpts(W2, scalarBits2) {
  validateW(W2, scalarBits2);
  const windows = Math.ceil(scalarBits2 / W2) + 1;
  const windowSize = 2 ** (W2 - 1);
  const maxNumber = 2 ** W2;
  const mask = bitMask(W2);
  const shiftBy = BigInt(W2);
  return { windows, windowSize, mask, maxNumber, shiftBy };
}
function calcOffsets(n, window, wOpts) {
  const { windowSize, mask, maxNumber, shiftBy } = wOpts;
  let wbits = Number(n & mask);
  let nextN = n >> shiftBy;
  if (wbits > windowSize) {
    wbits -= maxNumber;
    nextN += _1n3;
  }
  const offsetStart = window * windowSize;
  const offset = offsetStart + Math.abs(wbits) - 1;
  const isZero = wbits === 0;
  const isNeg = wbits < 0;
  const isNegF = window % 2 !== 0;
  const offsetF = offsetStart;
  return { nextN, offset, isZero, isNeg, isNegF, offsetF };
}
function validateMSMPoints(points, c) {
  if (!Array.isArray(points))
    throw new Error("array expected");
  points.forEach((p, i) => {
    if (!(p instanceof c))
      throw new Error("invalid point at index " + i);
  });
}
function validateMSMScalars(scalars, field) {
  if (!Array.isArray(scalars))
    throw new Error("array of scalars expected");
  scalars.forEach((s, i) => {
    if (!field.isValid(s))
      throw new Error("invalid scalar at index " + i);
  });
}
var pointPrecomputes = /* @__PURE__ */ new WeakMap();
var pointWindowSizes = /* @__PURE__ */ new WeakMap();
function getW(P2) {
  return pointWindowSizes.get(P2) || 1;
}
function assert0(n) {
  if (n !== _0n3)
    throw new Error("invalid wNAF");
}
var wNAF2 = class {
  // Parametrized with a given Point class (not individual point)
  constructor(Point2, bits) {
    this.BASE = Point2.BASE;
    this.ZERO = Point2.ZERO;
    this.Fn = Point2.Fn;
    this.bits = bits;
  }
  // non-const time multiplication ladder
  _unsafeLadder(elm, n, p = this.ZERO) {
    let d = elm;
    while (n > _0n3) {
      if (n & _1n3)
        p = p.add(d);
      d = d.double();
      n >>= _1n3;
    }
    return p;
  }
  /**
   * Creates a wNAF precomputation window. Used for caching.
   * Default window size is set by `utils.precompute()` and is equal to 8.
   * Number of precomputed points depends on the curve size:
   * 2^(𝑊−1) * (Math.ceil(𝑛 / 𝑊) + 1), where:
   * - 𝑊 is the window size
   * - 𝑛 is the bitlength of the curve order.
   * For a 256-bit curve and window size 8, the number of precomputed points is 128 * 33 = 4224.
   * @param point Point instance
   * @param W window size
   * @returns precomputed point tables flattened to a single array
   */
  precomputeWindow(point, W2) {
    const { windows, windowSize } = calcWOpts(W2, this.bits);
    const points = [];
    let p = point;
    let base = p;
    for (let window = 0; window < windows; window++) {
      base = p;
      points.push(base);
      for (let i = 1; i < windowSize; i++) {
        base = base.add(p);
        points.push(base);
      }
      p = base.double();
    }
    return points;
  }
  /**
   * Implements ec multiplication using precomputed tables and w-ary non-adjacent form.
   * More compact implementation:
   * https://github.com/paulmillr/noble-secp256k1/blob/47cb1669b6e506ad66b35fe7d76132ae97465da2/index.ts#L502-L541
   * @returns real and fake (for const-time) points
   */
  wNAF(W2, precomputes, n) {
    if (!this.Fn.isValid(n))
      throw new Error("invalid scalar");
    let p = this.ZERO;
    let f = this.BASE;
    const wo = calcWOpts(W2, this.bits);
    for (let window = 0; window < wo.windows; window++) {
      const { nextN, offset, isZero, isNeg, isNegF, offsetF } = calcOffsets(n, window, wo);
      n = nextN;
      if (isZero) {
        f = f.add(negateCt(isNegF, precomputes[offsetF]));
      } else {
        p = p.add(negateCt(isNeg, precomputes[offset]));
      }
    }
    assert0(n);
    return { p, f };
  }
  /**
   * Implements ec unsafe (non const-time) multiplication using precomputed tables and w-ary non-adjacent form.
   * @param acc accumulator point to add result of multiplication
   * @returns point
   */
  wNAFUnsafe(W2, precomputes, n, acc = this.ZERO) {
    const wo = calcWOpts(W2, this.bits);
    for (let window = 0; window < wo.windows; window++) {
      if (n === _0n3)
        break;
      const { nextN, offset, isZero, isNeg } = calcOffsets(n, window, wo);
      n = nextN;
      if (isZero) {
        continue;
      } else {
        const item = precomputes[offset];
        acc = acc.add(isNeg ? item.negate() : item);
      }
    }
    assert0(n);
    return acc;
  }
  getPrecomputes(W2, point, transform) {
    let comp = pointPrecomputes.get(point);
    if (!comp) {
      comp = this.precomputeWindow(point, W2);
      if (W2 !== 1) {
        if (typeof transform === "function")
          comp = transform(comp);
        pointPrecomputes.set(point, comp);
      }
    }
    return comp;
  }
  cached(point, scalar, transform) {
    const W2 = getW(point);
    return this.wNAF(W2, this.getPrecomputes(W2, point, transform), scalar);
  }
  unsafe(point, scalar, transform, prev) {
    const W2 = getW(point);
    if (W2 === 1)
      return this._unsafeLadder(point, scalar, prev);
    return this.wNAFUnsafe(W2, this.getPrecomputes(W2, point, transform), scalar, prev);
  }
  // We calculate precomputes for elliptic curve point multiplication
  // using windowed method. This specifies window size and
  // stores precomputed values. Usually only base point would be precomputed.
  createCache(P2, W2) {
    validateW(W2, this.bits);
    pointWindowSizes.set(P2, W2);
    pointPrecomputes.delete(P2);
  }
  hasCache(elm) {
    return getW(elm) !== 1;
  }
};
function mulEndoUnsafe(Point2, point, k1, k2) {
  let acc = point;
  let p1 = Point2.ZERO;
  let p2 = Point2.ZERO;
  while (k1 > _0n3 || k2 > _0n3) {
    if (k1 & _1n3)
      p1 = p1.add(acc);
    if (k2 & _1n3)
      p2 = p2.add(acc);
    acc = acc.double();
    k1 >>= _1n3;
    k2 >>= _1n3;
  }
  return { p1, p2 };
}
function pippenger(c, fieldN, points, scalars) {
  validateMSMPoints(points, c);
  validateMSMScalars(scalars, fieldN);
  const plength = points.length;
  const slength = scalars.length;
  if (plength !== slength)
    throw new Error("arrays of points and scalars must have equal length");
  const zero = c.ZERO;
  const wbits = bitLen(BigInt(plength));
  let windowSize = 1;
  if (wbits > 12)
    windowSize = wbits - 3;
  else if (wbits > 4)
    windowSize = wbits - 2;
  else if (wbits > 0)
    windowSize = 2;
  const MASK = bitMask(windowSize);
  const buckets = new Array(Number(MASK) + 1).fill(zero);
  const lastBits = Math.floor((fieldN.BITS - 1) / windowSize) * windowSize;
  let sum = zero;
  for (let i = lastBits; i >= 0; i -= windowSize) {
    buckets.fill(zero);
    for (let j = 0; j < slength; j++) {
      const scalar = scalars[j];
      const wbits2 = Number(scalar >> BigInt(i) & MASK);
      buckets[wbits2] = buckets[wbits2].add(points[j]);
    }
    let resI = zero;
    for (let j = buckets.length - 1, sumI = zero; j > 0; j--) {
      sumI = sumI.add(buckets[j]);
      resI = resI.add(sumI);
    }
    sum = sum.add(resI);
    if (i !== 0)
      for (let j = 0; j < windowSize; j++)
        sum = sum.double();
  }
  return sum;
}
function createField(order, field, isLE2) {
  if (field) {
    if (field.ORDER !== order)
      throw new Error("Field.ORDER must match order: Fp == p, Fn == n");
    validateField(field);
    return field;
  } else {
    return Field(order, { isLE: isLE2 });
  }
}
function _createCurveFields(type, CURVE, curveOpts = {}, FpFnLE) {
  if (FpFnLE === void 0)
    FpFnLE = type === "edwards";
  if (!CURVE || typeof CURVE !== "object")
    throw new Error(`expected valid ${type} CURVE object`);
  for (const p of ["p", "n", "h"]) {
    const val = CURVE[p];
    if (!(typeof val === "bigint" && val > _0n3))
      throw new Error(`CURVE.${p} must be positive bigint`);
  }
  const Fp = createField(CURVE.p, curveOpts.Fp, FpFnLE);
  const Fn = createField(CURVE.n, curveOpts.Fn, FpFnLE);
  const _b = type === "weierstrass" ? "b" : "d";
  const params = ["Gx", "Gy", "a", _b];
  for (const p of params) {
    if (!Fp.isValid(CURVE[p]))
      throw new Error(`CURVE.${p} must be valid field element of CURVE.Fp`);
  }
  CURVE = Object.freeze(Object.assign({}, CURVE));
  return { CURVE, Fp, Fn };
}

// ../../node_modules/.pnpm/@noble+curves@1.9.7/node_modules/@noble/curves/esm/abstract/weierstrass.js
var divNearest = (num, den) => (num + (num >= 0 ? den : -den) / _2n2) / den;
function _splitEndoScalar(k, basis, n) {
  const [[a1, b1], [a2, b2]] = basis;
  const c1 = divNearest(b2 * k, n);
  const c2 = divNearest(-b1 * k, n);
  let k1 = k - c1 * a1 - c2 * a2;
  let k2 = -c1 * b1 - c2 * b2;
  const k1neg = k1 < _0n4;
  const k2neg = k2 < _0n4;
  if (k1neg)
    k1 = -k1;
  if (k2neg)
    k2 = -k2;
  const MAX_NUM = bitMask(Math.ceil(bitLen(n) / 2)) + _1n4;
  if (k1 < _0n4 || k1 >= MAX_NUM || k2 < _0n4 || k2 >= MAX_NUM) {
    throw new Error("splitScalar (endomorphism): failed, k=" + k);
  }
  return { k1neg, k1, k2neg, k2 };
}
function validateSigFormat(format) {
  if (!["compact", "recovered", "der"].includes(format))
    throw new Error('Signature format must be "compact", "recovered", or "der"');
  return format;
}
function validateSigOpts(opts, def) {
  const optsn = {};
  for (let optName of Object.keys(def)) {
    optsn[optName] = opts[optName] === void 0 ? def[optName] : opts[optName];
  }
  _abool2(optsn.lowS, "lowS");
  _abool2(optsn.prehash, "prehash");
  if (optsn.format !== void 0)
    validateSigFormat(optsn.format);
  return optsn;
}
var DERErr = class extends Error {
  constructor(m = "") {
    super(m);
  }
};
var DER = {
  // asn.1 DER encoding utils
  Err: DERErr,
  // Basic building block is TLV (Tag-Length-Value)
  _tlv: {
    encode: (tag, data) => {
      const { Err: E } = DER;
      if (tag < 0 || tag > 256)
        throw new E("tlv.encode: wrong tag");
      if (data.length & 1)
        throw new E("tlv.encode: unpadded data");
      const dataLen = data.length / 2;
      const len = numberToHexUnpadded(dataLen);
      if (len.length / 2 & 128)
        throw new E("tlv.encode: long form length too big");
      const lenLen = dataLen > 127 ? numberToHexUnpadded(len.length / 2 | 128) : "";
      const t = numberToHexUnpadded(tag);
      return t + lenLen + len + data;
    },
    // v - value, l - left bytes (unparsed)
    decode(tag, data) {
      const { Err: E } = DER;
      let pos = 0;
      if (tag < 0 || tag > 256)
        throw new E("tlv.encode: wrong tag");
      if (data.length < 2 || data[pos++] !== tag)
        throw new E("tlv.decode: wrong tlv");
      const first = data[pos++];
      const isLong = !!(first & 128);
      let length = 0;
      if (!isLong)
        length = first;
      else {
        const lenLen = first & 127;
        if (!lenLen)
          throw new E("tlv.decode(long): indefinite length not supported");
        if (lenLen > 4)
          throw new E("tlv.decode(long): byte length is too big");
        const lengthBytes = data.subarray(pos, pos + lenLen);
        if (lengthBytes.length !== lenLen)
          throw new E("tlv.decode: length bytes not complete");
        if (lengthBytes[0] === 0)
          throw new E("tlv.decode(long): zero leftmost byte");
        for (const b of lengthBytes)
          length = length << 8 | b;
        pos += lenLen;
        if (length < 128)
          throw new E("tlv.decode(long): not minimal encoding");
      }
      const v = data.subarray(pos, pos + length);
      if (v.length !== length)
        throw new E("tlv.decode: wrong value length");
      return { v, l: data.subarray(pos + length) };
    }
  },
  // https://crypto.stackexchange.com/a/57734 Leftmost bit of first byte is 'negative' flag,
  // since we always use positive integers here. It must always be empty:
  // - add zero byte if exists
  // - if next byte doesn't have a flag, leading zero is not allowed (minimal encoding)
  _int: {
    encode(num) {
      const { Err: E } = DER;
      if (num < _0n4)
        throw new E("integer: negative integers are not allowed");
      let hex = numberToHexUnpadded(num);
      if (Number.parseInt(hex[0], 16) & 8)
        hex = "00" + hex;
      if (hex.length & 1)
        throw new E("unexpected DER parsing assertion: unpadded hex");
      return hex;
    },
    decode(data) {
      const { Err: E } = DER;
      if (data[0] & 128)
        throw new E("invalid signature integer: negative");
      if (data[0] === 0 && !(data[1] & 128))
        throw new E("invalid signature integer: unnecessary leading zero");
      return bytesToNumberBE(data);
    }
  },
  toSig(hex) {
    const { Err: E, _int: int, _tlv: tlv } = DER;
    const data = ensureBytes("signature", hex);
    const { v: seqBytes, l: seqLeftBytes } = tlv.decode(48, data);
    if (seqLeftBytes.length)
      throw new E("invalid signature: left bytes after parsing");
    const { v: rBytes, l: rLeftBytes } = tlv.decode(2, seqBytes);
    const { v: sBytes, l: sLeftBytes } = tlv.decode(2, rLeftBytes);
    if (sLeftBytes.length)
      throw new E("invalid signature: left bytes after parsing");
    return { r: int.decode(rBytes), s: int.decode(sBytes) };
  },
  hexFromSig(sig) {
    const { _tlv: tlv, _int: int } = DER;
    const rs = tlv.encode(2, int.encode(sig.r));
    const ss = tlv.encode(2, int.encode(sig.s));
    const seq = rs + ss;
    return tlv.encode(48, seq);
  }
};
var _0n4 = BigInt(0);
var _1n4 = BigInt(1);
var _2n2 = BigInt(2);
var _3n2 = BigInt(3);
var _4n2 = BigInt(4);
function _normFnElement(Fn, key) {
  const { BYTES: expected } = Fn;
  let num;
  if (typeof key === "bigint") {
    num = key;
  } else {
    let bytes = ensureBytes("private key", key);
    try {
      num = Fn.fromBytes(bytes);
    } catch (error) {
      throw new Error(`invalid private key: expected ui8a of size ${expected}, got ${typeof key}`);
    }
  }
  if (!Fn.isValidNot0(num))
    throw new Error("invalid private key: out of range [1..N-1]");
  return num;
}
function weierstrassN(params, extraOpts = {}) {
  const validated = _createCurveFields("weierstrass", params, extraOpts);
  const { Fp, Fn } = validated;
  let CURVE = validated.CURVE;
  const { h: cofactor, n: CURVE_ORDER } = CURVE;
  _validateObject(extraOpts, {}, {
    allowInfinityPoint: "boolean",
    clearCofactor: "function",
    isTorsionFree: "function",
    fromBytes: "function",
    toBytes: "function",
    endo: "object",
    wrapPrivateKey: "boolean"
  });
  const { endo } = extraOpts;
  if (endo) {
    if (!Fp.is0(CURVE.a) || typeof endo.beta !== "bigint" || !Array.isArray(endo.basises)) {
      throw new Error('invalid endo: expected "beta": bigint and "basises": array');
    }
  }
  const lengths = getWLengths(Fp, Fn);
  function assertCompressionIsSupported() {
    if (!Fp.isOdd)
      throw new Error("compression is not supported: Field does not have .isOdd()");
  }
  function pointToBytes(_c, point, isCompressed) {
    const { x, y } = point.toAffine();
    const bx = Fp.toBytes(x);
    _abool2(isCompressed, "isCompressed");
    if (isCompressed) {
      assertCompressionIsSupported();
      const hasEvenY = !Fp.isOdd(y);
      return concatBytes3(pprefix(hasEvenY), bx);
    } else {
      return concatBytes3(Uint8Array.of(4), bx, Fp.toBytes(y));
    }
  }
  function pointFromBytes(bytes) {
    _abytes2(bytes, void 0, "Point");
    const { publicKey: comp, publicKeyUncompressed: uncomp } = lengths;
    const length = bytes.length;
    const head = bytes[0];
    const tail = bytes.subarray(1);
    if (length === comp && (head === 2 || head === 3)) {
      const x = Fp.fromBytes(tail);
      if (!Fp.isValid(x))
        throw new Error("bad point: is not on curve, wrong x");
      const y2 = weierstrassEquation(x);
      let y;
      try {
        y = Fp.sqrt(y2);
      } catch (sqrtError) {
        const err2 = sqrtError instanceof Error ? ": " + sqrtError.message : "";
        throw new Error("bad point: is not on curve, sqrt error" + err2);
      }
      assertCompressionIsSupported();
      const isYOdd = Fp.isOdd(y);
      const isHeadOdd = (head & 1) === 1;
      if (isHeadOdd !== isYOdd)
        y = Fp.neg(y);
      return { x, y };
    } else if (length === uncomp && head === 4) {
      const L3 = Fp.BYTES;
      const x = Fp.fromBytes(tail.subarray(0, L3));
      const y = Fp.fromBytes(tail.subarray(L3, L3 * 2));
      if (!isValidXY(x, y))
        throw new Error("bad point: is not on curve");
      return { x, y };
    } else {
      throw new Error(`bad point: got length ${length}, expected compressed=${comp} or uncompressed=${uncomp}`);
    }
  }
  const encodePoint = extraOpts.toBytes || pointToBytes;
  const decodePoint = extraOpts.fromBytes || pointFromBytes;
  function weierstrassEquation(x) {
    const x2 = Fp.sqr(x);
    const x3 = Fp.mul(x2, x);
    return Fp.add(Fp.add(x3, Fp.mul(x, CURVE.a)), CURVE.b);
  }
  function isValidXY(x, y) {
    const left = Fp.sqr(y);
    const right = weierstrassEquation(x);
    return Fp.eql(left, right);
  }
  if (!isValidXY(CURVE.Gx, CURVE.Gy))
    throw new Error("bad curve params: generator point");
  const _4a3 = Fp.mul(Fp.pow(CURVE.a, _3n2), _4n2);
  const _27b2 = Fp.mul(Fp.sqr(CURVE.b), BigInt(27));
  if (Fp.is0(Fp.add(_4a3, _27b2)))
    throw new Error("bad curve params: a or b");
  function acoord(title, n, banZero = false) {
    if (!Fp.isValid(n) || banZero && Fp.is0(n))
      throw new Error(`bad point coordinate ${title}`);
    return n;
  }
  function aprjpoint(other) {
    if (!(other instanceof Point2))
      throw new Error("ProjectivePoint expected");
  }
  function splitEndoScalarN(k) {
    if (!endo || !endo.basises)
      throw new Error("no endo");
    return _splitEndoScalar(k, endo.basises, Fn.ORDER);
  }
  const toAffineMemo = memoized((p, iz) => {
    const { X: X2, Y, Z } = p;
    if (Fp.eql(Z, Fp.ONE))
      return { x: X2, y: Y };
    const is0 = p.is0();
    if (iz == null)
      iz = is0 ? Fp.ONE : Fp.inv(Z);
    const x = Fp.mul(X2, iz);
    const y = Fp.mul(Y, iz);
    const zz = Fp.mul(Z, iz);
    if (is0)
      return { x: Fp.ZERO, y: Fp.ZERO };
    if (!Fp.eql(zz, Fp.ONE))
      throw new Error("invZ was invalid");
    return { x, y };
  });
  const assertValidMemo = memoized((p) => {
    if (p.is0()) {
      if (extraOpts.allowInfinityPoint && !Fp.is0(p.Y))
        return;
      throw new Error("bad point: ZERO");
    }
    const { x, y } = p.toAffine();
    if (!Fp.isValid(x) || !Fp.isValid(y))
      throw new Error("bad point: x or y not field elements");
    if (!isValidXY(x, y))
      throw new Error("bad point: equation left != right");
    if (!p.isTorsionFree())
      throw new Error("bad point: not in prime-order subgroup");
    return true;
  });
  function finishEndo(endoBeta, k1p, k2p, k1neg, k2neg) {
    k2p = new Point2(Fp.mul(k2p.X, endoBeta), k2p.Y, k2p.Z);
    k1p = negateCt(k1neg, k1p);
    k2p = negateCt(k2neg, k2p);
    return k1p.add(k2p);
  }
  class Point2 {
    /** Does NOT validate if the point is valid. Use `.assertValidity()`. */
    constructor(X2, Y, Z) {
      this.X = acoord("x", X2);
      this.Y = acoord("y", Y, true);
      this.Z = acoord("z", Z);
      Object.freeze(this);
    }
    static CURVE() {
      return CURVE;
    }
    /** Does NOT validate if the point is valid. Use `.assertValidity()`. */
    static fromAffine(p) {
      const { x, y } = p || {};
      if (!p || !Fp.isValid(x) || !Fp.isValid(y))
        throw new Error("invalid affine point");
      if (p instanceof Point2)
        throw new Error("projective point not allowed");
      if (Fp.is0(x) && Fp.is0(y))
        return Point2.ZERO;
      return new Point2(x, y, Fp.ONE);
    }
    static fromBytes(bytes) {
      const P2 = Point2.fromAffine(decodePoint(_abytes2(bytes, void 0, "point")));
      P2.assertValidity();
      return P2;
    }
    static fromHex(hex) {
      return Point2.fromBytes(ensureBytes("pointHex", hex));
    }
    get x() {
      return this.toAffine().x;
    }
    get y() {
      return this.toAffine().y;
    }
    /**
     *
     * @param windowSize
     * @param isLazy true will defer table computation until the first multiplication
     * @returns
     */
    precompute(windowSize = 8, isLazy = true) {
      wnaf.createCache(this, windowSize);
      if (!isLazy)
        this.multiply(_3n2);
      return this;
    }
    // TODO: return `this`
    /** A point on curve is valid if it conforms to equation. */
    assertValidity() {
      assertValidMemo(this);
    }
    hasEvenY() {
      const { y } = this.toAffine();
      if (!Fp.isOdd)
        throw new Error("Field doesn't support isOdd");
      return !Fp.isOdd(y);
    }
    /** Compare one point to another. */
    equals(other) {
      aprjpoint(other);
      const { X: X1, Y: Y1, Z: Z1 } = this;
      const { X: X2, Y: Y2, Z: Z2 } = other;
      const U1 = Fp.eql(Fp.mul(X1, Z2), Fp.mul(X2, Z1));
      const U2 = Fp.eql(Fp.mul(Y1, Z2), Fp.mul(Y2, Z1));
      return U1 && U2;
    }
    /** Flips point to one corresponding to (x, -y) in Affine coordinates. */
    negate() {
      return new Point2(this.X, Fp.neg(this.Y), this.Z);
    }
    // Renes-Costello-Batina exception-free doubling formula.
    // There is 30% faster Jacobian formula, but it is not complete.
    // https://eprint.iacr.org/2015/1060, algorithm 3
    // Cost: 8M + 3S + 3*a + 2*b3 + 15add.
    double() {
      const { a, b } = CURVE;
      const b3 = Fp.mul(b, _3n2);
      const { X: X1, Y: Y1, Z: Z1 } = this;
      let X3 = Fp.ZERO, Y3 = Fp.ZERO, Z3 = Fp.ZERO;
      let t0 = Fp.mul(X1, X1);
      let t1 = Fp.mul(Y1, Y1);
      let t2 = Fp.mul(Z1, Z1);
      let t3 = Fp.mul(X1, Y1);
      t3 = Fp.add(t3, t3);
      Z3 = Fp.mul(X1, Z1);
      Z3 = Fp.add(Z3, Z3);
      X3 = Fp.mul(a, Z3);
      Y3 = Fp.mul(b3, t2);
      Y3 = Fp.add(X3, Y3);
      X3 = Fp.sub(t1, Y3);
      Y3 = Fp.add(t1, Y3);
      Y3 = Fp.mul(X3, Y3);
      X3 = Fp.mul(t3, X3);
      Z3 = Fp.mul(b3, Z3);
      t2 = Fp.mul(a, t2);
      t3 = Fp.sub(t0, t2);
      t3 = Fp.mul(a, t3);
      t3 = Fp.add(t3, Z3);
      Z3 = Fp.add(t0, t0);
      t0 = Fp.add(Z3, t0);
      t0 = Fp.add(t0, t2);
      t0 = Fp.mul(t0, t3);
      Y3 = Fp.add(Y3, t0);
      t2 = Fp.mul(Y1, Z1);
      t2 = Fp.add(t2, t2);
      t0 = Fp.mul(t2, t3);
      X3 = Fp.sub(X3, t0);
      Z3 = Fp.mul(t2, t1);
      Z3 = Fp.add(Z3, Z3);
      Z3 = Fp.add(Z3, Z3);
      return new Point2(X3, Y3, Z3);
    }
    // Renes-Costello-Batina exception-free addition formula.
    // There is 30% faster Jacobian formula, but it is not complete.
    // https://eprint.iacr.org/2015/1060, algorithm 1
    // Cost: 12M + 0S + 3*a + 3*b3 + 23add.
    add(other) {
      aprjpoint(other);
      const { X: X1, Y: Y1, Z: Z1 } = this;
      const { X: X2, Y: Y2, Z: Z2 } = other;
      let X3 = Fp.ZERO, Y3 = Fp.ZERO, Z3 = Fp.ZERO;
      const a = CURVE.a;
      const b3 = Fp.mul(CURVE.b, _3n2);
      let t0 = Fp.mul(X1, X2);
      let t1 = Fp.mul(Y1, Y2);
      let t2 = Fp.mul(Z1, Z2);
      let t3 = Fp.add(X1, Y1);
      let t4 = Fp.add(X2, Y2);
      t3 = Fp.mul(t3, t4);
      t4 = Fp.add(t0, t1);
      t3 = Fp.sub(t3, t4);
      t4 = Fp.add(X1, Z1);
      let t5 = Fp.add(X2, Z2);
      t4 = Fp.mul(t4, t5);
      t5 = Fp.add(t0, t2);
      t4 = Fp.sub(t4, t5);
      t5 = Fp.add(Y1, Z1);
      X3 = Fp.add(Y2, Z2);
      t5 = Fp.mul(t5, X3);
      X3 = Fp.add(t1, t2);
      t5 = Fp.sub(t5, X3);
      Z3 = Fp.mul(a, t4);
      X3 = Fp.mul(b3, t2);
      Z3 = Fp.add(X3, Z3);
      X3 = Fp.sub(t1, Z3);
      Z3 = Fp.add(t1, Z3);
      Y3 = Fp.mul(X3, Z3);
      t1 = Fp.add(t0, t0);
      t1 = Fp.add(t1, t0);
      t2 = Fp.mul(a, t2);
      t4 = Fp.mul(b3, t4);
      t1 = Fp.add(t1, t2);
      t2 = Fp.sub(t0, t2);
      t2 = Fp.mul(a, t2);
      t4 = Fp.add(t4, t2);
      t0 = Fp.mul(t1, t4);
      Y3 = Fp.add(Y3, t0);
      t0 = Fp.mul(t5, t4);
      X3 = Fp.mul(t3, X3);
      X3 = Fp.sub(X3, t0);
      t0 = Fp.mul(t3, t1);
      Z3 = Fp.mul(t5, Z3);
      Z3 = Fp.add(Z3, t0);
      return new Point2(X3, Y3, Z3);
    }
    subtract(other) {
      return this.add(other.negate());
    }
    is0() {
      return this.equals(Point2.ZERO);
    }
    /**
     * Constant time multiplication.
     * Uses wNAF method. Windowed method may be 10% faster,
     * but takes 2x longer to generate and consumes 2x memory.
     * Uses precomputes when available.
     * Uses endomorphism for Koblitz curves.
     * @param scalar by which the point would be multiplied
     * @returns New point
     */
    multiply(scalar) {
      const { endo: endo2 } = extraOpts;
      if (!Fn.isValidNot0(scalar))
        throw new Error("invalid scalar: out of range");
      let point, fake;
      const mul3 = (n) => wnaf.cached(this, n, (p) => normalizeZ(Point2, p));
      if (endo2) {
        const { k1neg, k1, k2neg, k2 } = splitEndoScalarN(scalar);
        const { p: k1p, f: k1f } = mul3(k1);
        const { p: k2p, f: k2f } = mul3(k2);
        fake = k1f.add(k2f);
        point = finishEndo(endo2.beta, k1p, k2p, k1neg, k2neg);
      } else {
        const { p, f } = mul3(scalar);
        point = p;
        fake = f;
      }
      return normalizeZ(Point2, [point, fake])[0];
    }
    /**
     * Non-constant-time multiplication. Uses double-and-add algorithm.
     * It's faster, but should only be used when you don't care about
     * an exposed secret key e.g. sig verification, which works over *public* keys.
     */
    multiplyUnsafe(sc) {
      const { endo: endo2 } = extraOpts;
      const p = this;
      if (!Fn.isValid(sc))
        throw new Error("invalid scalar: out of range");
      if (sc === _0n4 || p.is0())
        return Point2.ZERO;
      if (sc === _1n4)
        return p;
      if (wnaf.hasCache(this))
        return this.multiply(sc);
      if (endo2) {
        const { k1neg, k1, k2neg, k2 } = splitEndoScalarN(sc);
        const { p1, p2 } = mulEndoUnsafe(Point2, p, k1, k2);
        return finishEndo(endo2.beta, p1, p2, k1neg, k2neg);
      } else {
        return wnaf.unsafe(p, sc);
      }
    }
    multiplyAndAddUnsafe(Q, a, b) {
      const sum = this.multiplyUnsafe(a).add(Q.multiplyUnsafe(b));
      return sum.is0() ? void 0 : sum;
    }
    /**
     * Converts Projective point to affine (x, y) coordinates.
     * @param invertedZ Z^-1 (inverted zero) - optional, precomputation is useful for invertBatch
     */
    toAffine(invertedZ) {
      return toAffineMemo(this, invertedZ);
    }
    /**
     * Checks whether Point is free of torsion elements (is in prime subgroup).
     * Always torsion-free for cofactor=1 curves.
     */
    isTorsionFree() {
      const { isTorsionFree } = extraOpts;
      if (cofactor === _1n4)
        return true;
      if (isTorsionFree)
        return isTorsionFree(Point2, this);
      return wnaf.unsafe(this, CURVE_ORDER).is0();
    }
    clearCofactor() {
      const { clearCofactor } = extraOpts;
      if (cofactor === _1n4)
        return this;
      if (clearCofactor)
        return clearCofactor(Point2, this);
      return this.multiplyUnsafe(cofactor);
    }
    isSmallOrder() {
      return this.multiplyUnsafe(cofactor).is0();
    }
    toBytes(isCompressed = true) {
      _abool2(isCompressed, "isCompressed");
      this.assertValidity();
      return encodePoint(Point2, this, isCompressed);
    }
    toHex(isCompressed = true) {
      return bytesToHex3(this.toBytes(isCompressed));
    }
    toString() {
      return `<Point ${this.is0() ? "ZERO" : this.toHex()}>`;
    }
    // TODO: remove
    get px() {
      return this.X;
    }
    get py() {
      return this.X;
    }
    get pz() {
      return this.Z;
    }
    toRawBytes(isCompressed = true) {
      return this.toBytes(isCompressed);
    }
    _setWindowSize(windowSize) {
      this.precompute(windowSize);
    }
    static normalizeZ(points) {
      return normalizeZ(Point2, points);
    }
    static msm(points, scalars) {
      return pippenger(Point2, Fn, points, scalars);
    }
    static fromPrivateKey(privateKey) {
      return Point2.BASE.multiply(_normFnElement(Fn, privateKey));
    }
  }
  Point2.BASE = new Point2(CURVE.Gx, CURVE.Gy, Fp.ONE);
  Point2.ZERO = new Point2(Fp.ZERO, Fp.ONE, Fp.ZERO);
  Point2.Fp = Fp;
  Point2.Fn = Fn;
  const bits = Fn.BITS;
  const wnaf = new wNAF2(Point2, extraOpts.endo ? Math.ceil(bits / 2) : bits);
  Point2.BASE.precompute(8);
  return Point2;
}
function pprefix(hasEvenY) {
  return Uint8Array.of(hasEvenY ? 2 : 3);
}
function getWLengths(Fp, Fn) {
  return {
    secretKey: Fn.BYTES,
    publicKey: 1 + Fp.BYTES,
    publicKeyUncompressed: 1 + 2 * Fp.BYTES,
    publicKeyHasPrefix: true,
    signature: 2 * Fn.BYTES
  };
}
function ecdh(Point2, ecdhOpts = {}) {
  const { Fn } = Point2;
  const randomBytes_ = ecdhOpts.randomBytes || randomBytes2;
  const lengths = Object.assign(getWLengths(Point2.Fp, Fn), { seed: getMinHashLength(Fn.ORDER) });
  function isValidSecretKey(secretKey) {
    try {
      return !!_normFnElement(Fn, secretKey);
    } catch (error) {
      return false;
    }
  }
  function isValidPublicKey(publicKey, isCompressed) {
    const { publicKey: comp, publicKeyUncompressed } = lengths;
    try {
      const l = publicKey.length;
      if (isCompressed === true && l !== comp)
        return false;
      if (isCompressed === false && l !== publicKeyUncompressed)
        return false;
      return !!Point2.fromBytes(publicKey);
    } catch (error) {
      return false;
    }
  }
  function randomSecretKey(seed = randomBytes_(lengths.seed)) {
    return mapHashToField(_abytes2(seed, lengths.seed, "seed"), Fn.ORDER);
  }
  function getPublicKey(secretKey, isCompressed = true) {
    return Point2.BASE.multiply(_normFnElement(Fn, secretKey)).toBytes(isCompressed);
  }
  function keygen(seed) {
    const secretKey = randomSecretKey(seed);
    return { secretKey, publicKey: getPublicKey(secretKey) };
  }
  function isProbPub(item) {
    if (typeof item === "bigint")
      return false;
    if (item instanceof Point2)
      return true;
    const { secretKey, publicKey, publicKeyUncompressed } = lengths;
    if (Fn.allowedLengths || secretKey === publicKey)
      return void 0;
    const l = ensureBytes("key", item).length;
    return l === publicKey || l === publicKeyUncompressed;
  }
  function getSharedSecret(secretKeyA, publicKeyB, isCompressed = true) {
    if (isProbPub(secretKeyA) === true)
      throw new Error("first arg must be private key");
    if (isProbPub(publicKeyB) === false)
      throw new Error("second arg must be public key");
    const s = _normFnElement(Fn, secretKeyA);
    const b = Point2.fromHex(publicKeyB);
    return b.multiply(s).toBytes(isCompressed);
  }
  const utils2 = {
    isValidSecretKey,
    isValidPublicKey,
    randomSecretKey,
    // TODO: remove
    isValidPrivateKey: isValidSecretKey,
    randomPrivateKey: randomSecretKey,
    normPrivateKeyToScalar: (key) => _normFnElement(Fn, key),
    precompute(windowSize = 8, point = Point2.BASE) {
      return point.precompute(windowSize, false);
    }
  };
  return Object.freeze({ getPublicKey, getSharedSecret, keygen, Point: Point2, utils: utils2, lengths });
}
function ecdsa(Point2, hash, ecdsaOpts = {}) {
  ahash(hash);
  _validateObject(ecdsaOpts, {}, {
    hmac: "function",
    lowS: "boolean",
    randomBytes: "function",
    bits2int: "function",
    bits2int_modN: "function"
  });
  const randomBytes3 = ecdsaOpts.randomBytes || randomBytes2;
  const hmac2 = ecdsaOpts.hmac || ((key, ...msgs) => hmac(hash, key, concatBytes3(...msgs)));
  const { Fp, Fn } = Point2;
  const { ORDER: CURVE_ORDER, BITS: fnBits } = Fn;
  const { keygen, getPublicKey, getSharedSecret, utils: utils2, lengths } = ecdh(Point2, ecdsaOpts);
  const defaultSigOpts = {
    prehash: false,
    lowS: typeof ecdsaOpts.lowS === "boolean" ? ecdsaOpts.lowS : false,
    format: void 0,
    //'compact' as ECDSASigFormat,
    extraEntropy: false
  };
  const defaultSigOpts_format = "compact";
  function isBiggerThanHalfOrder(number) {
    const HALF = CURVE_ORDER >> _1n4;
    return number > HALF;
  }
  function validateRS(title, num) {
    if (!Fn.isValidNot0(num))
      throw new Error(`invalid signature ${title}: out of range 1..Point.Fn.ORDER`);
    return num;
  }
  function validateSigLength(bytes, format) {
    validateSigFormat(format);
    const size = lengths.signature;
    const sizer = format === "compact" ? size : format === "recovered" ? size + 1 : void 0;
    return _abytes2(bytes, sizer, `${format} signature`);
  }
  class Signature {
    constructor(r, s, recovery) {
      this.r = validateRS("r", r);
      this.s = validateRS("s", s);
      if (recovery != null)
        this.recovery = recovery;
      Object.freeze(this);
    }
    static fromBytes(bytes, format = defaultSigOpts_format) {
      validateSigLength(bytes, format);
      let recid;
      if (format === "der") {
        const { r: r2, s: s2 } = DER.toSig(_abytes2(bytes));
        return new Signature(r2, s2);
      }
      if (format === "recovered") {
        recid = bytes[0];
        format = "compact";
        bytes = bytes.subarray(1);
      }
      const L3 = Fn.BYTES;
      const r = bytes.subarray(0, L3);
      const s = bytes.subarray(L3, L3 * 2);
      return new Signature(Fn.fromBytes(r), Fn.fromBytes(s), recid);
    }
    static fromHex(hex, format) {
      return this.fromBytes(hexToBytes3(hex), format);
    }
    addRecoveryBit(recovery) {
      return new Signature(this.r, this.s, recovery);
    }
    recoverPublicKey(messageHash) {
      const FIELD_ORDER = Fp.ORDER;
      const { r, s, recovery: rec } = this;
      if (rec == null || ![0, 1, 2, 3].includes(rec))
        throw new Error("recovery id invalid");
      const hasCofactor = CURVE_ORDER * _2n2 < FIELD_ORDER;
      if (hasCofactor && rec > 1)
        throw new Error("recovery id is ambiguous for h>1 curve");
      const radj = rec === 2 || rec === 3 ? r + CURVE_ORDER : r;
      if (!Fp.isValid(radj))
        throw new Error("recovery id 2 or 3 invalid");
      const x = Fp.toBytes(radj);
      const R = Point2.fromBytes(concatBytes3(pprefix((rec & 1) === 0), x));
      const ir = Fn.inv(radj);
      const h2 = bits2int_modN(ensureBytes("msgHash", messageHash));
      const u1 = Fn.create(-h2 * ir);
      const u2 = Fn.create(s * ir);
      const Q = Point2.BASE.multiplyUnsafe(u1).add(R.multiplyUnsafe(u2));
      if (Q.is0())
        throw new Error("point at infinify");
      Q.assertValidity();
      return Q;
    }
    // Signatures should be low-s, to prevent malleability.
    hasHighS() {
      return isBiggerThanHalfOrder(this.s);
    }
    toBytes(format = defaultSigOpts_format) {
      validateSigFormat(format);
      if (format === "der")
        return hexToBytes3(DER.hexFromSig(this));
      const r = Fn.toBytes(this.r);
      const s = Fn.toBytes(this.s);
      if (format === "recovered") {
        if (this.recovery == null)
          throw new Error("recovery bit must be present");
        return concatBytes3(Uint8Array.of(this.recovery), r, s);
      }
      return concatBytes3(r, s);
    }
    toHex(format) {
      return bytesToHex3(this.toBytes(format));
    }
    // TODO: remove
    assertValidity() {
    }
    static fromCompact(hex) {
      return Signature.fromBytes(ensureBytes("sig", hex), "compact");
    }
    static fromDER(hex) {
      return Signature.fromBytes(ensureBytes("sig", hex), "der");
    }
    normalizeS() {
      return this.hasHighS() ? new Signature(this.r, Fn.neg(this.s), this.recovery) : this;
    }
    toDERRawBytes() {
      return this.toBytes("der");
    }
    toDERHex() {
      return bytesToHex3(this.toBytes("der"));
    }
    toCompactRawBytes() {
      return this.toBytes("compact");
    }
    toCompactHex() {
      return bytesToHex3(this.toBytes("compact"));
    }
  }
  const bits2int = ecdsaOpts.bits2int || function bits2int_def(bytes) {
    if (bytes.length > 8192)
      throw new Error("input is too large");
    const num = bytesToNumberBE(bytes);
    const delta = bytes.length * 8 - fnBits;
    return delta > 0 ? num >> BigInt(delta) : num;
  };
  const bits2int_modN = ecdsaOpts.bits2int_modN || function bits2int_modN_def(bytes) {
    return Fn.create(bits2int(bytes));
  };
  const ORDER_MASK = bitMask(fnBits);
  function int2octets(num) {
    aInRange("num < 2^" + fnBits, num, _0n4, ORDER_MASK);
    return Fn.toBytes(num);
  }
  function validateMsgAndHash(message, prehash) {
    _abytes2(message, void 0, "message");
    return prehash ? _abytes2(hash(message), void 0, "prehashed message") : message;
  }
  function prepSig(message, privateKey, opts) {
    if (["recovered", "canonical"].some((k) => k in opts))
      throw new Error("sign() legacy options not supported");
    const { lowS, prehash, extraEntropy } = validateSigOpts(opts, defaultSigOpts);
    message = validateMsgAndHash(message, prehash);
    const h1int = bits2int_modN(message);
    const d = _normFnElement(Fn, privateKey);
    const seedArgs = [int2octets(d), int2octets(h1int)];
    if (extraEntropy != null && extraEntropy !== false) {
      const e = extraEntropy === true ? randomBytes3(lengths.secretKey) : extraEntropy;
      seedArgs.push(ensureBytes("extraEntropy", e));
    }
    const seed = concatBytes3(...seedArgs);
    const m = h1int;
    function k2sig(kBytes) {
      const k = bits2int(kBytes);
      if (!Fn.isValidNot0(k))
        return;
      const ik = Fn.inv(k);
      const q = Point2.BASE.multiply(k).toAffine();
      const r = Fn.create(q.x);
      if (r === _0n4)
        return;
      const s = Fn.create(ik * Fn.create(m + r * d));
      if (s === _0n4)
        return;
      let recovery = (q.x === r ? 0 : 2) | Number(q.y & _1n4);
      let normS = s;
      if (lowS && isBiggerThanHalfOrder(s)) {
        normS = Fn.neg(s);
        recovery ^= 1;
      }
      return new Signature(r, normS, recovery);
    }
    return { seed, k2sig };
  }
  function sign(message, secretKey, opts = {}) {
    message = ensureBytes("message", message);
    const { seed, k2sig } = prepSig(message, secretKey, opts);
    const drbg = createHmacDrbg(hash.outputLen, Fn.BYTES, hmac2);
    const sig = drbg(seed, k2sig);
    return sig;
  }
  function tryParsingSig(sg) {
    let sig = void 0;
    const isHex = typeof sg === "string" || isBytes3(sg);
    const isObj = !isHex && sg !== null && typeof sg === "object" && typeof sg.r === "bigint" && typeof sg.s === "bigint";
    if (!isHex && !isObj)
      throw new Error("invalid signature, expected Uint8Array, hex string or Signature instance");
    if (isObj) {
      sig = new Signature(sg.r, sg.s);
    } else if (isHex) {
      try {
        sig = Signature.fromBytes(ensureBytes("sig", sg), "der");
      } catch (derError) {
        if (!(derError instanceof DER.Err))
          throw derError;
      }
      if (!sig) {
        try {
          sig = Signature.fromBytes(ensureBytes("sig", sg), "compact");
        } catch (error) {
          return false;
        }
      }
    }
    if (!sig)
      return false;
    return sig;
  }
  function verify(signature, message, publicKey, opts = {}) {
    const { lowS, prehash, format } = validateSigOpts(opts, defaultSigOpts);
    publicKey = ensureBytes("publicKey", publicKey);
    message = validateMsgAndHash(ensureBytes("message", message), prehash);
    if ("strict" in opts)
      throw new Error("options.strict was renamed to lowS");
    const sig = format === void 0 ? tryParsingSig(signature) : Signature.fromBytes(ensureBytes("sig", signature), format);
    if (sig === false)
      return false;
    try {
      const P2 = Point2.fromBytes(publicKey);
      if (lowS && sig.hasHighS())
        return false;
      const { r, s } = sig;
      const h2 = bits2int_modN(message);
      const is = Fn.inv(s);
      const u1 = Fn.create(h2 * is);
      const u2 = Fn.create(r * is);
      const R = Point2.BASE.multiplyUnsafe(u1).add(P2.multiplyUnsafe(u2));
      if (R.is0())
        return false;
      const v = Fn.create(R.x);
      return v === r;
    } catch (e) {
      return false;
    }
  }
  function recoverPublicKey(signature, message, opts = {}) {
    const { prehash } = validateSigOpts(opts, defaultSigOpts);
    message = validateMsgAndHash(message, prehash);
    return Signature.fromBytes(signature, "recovered").recoverPublicKey(message).toBytes();
  }
  return Object.freeze({
    keygen,
    getPublicKey,
    getSharedSecret,
    utils: utils2,
    lengths,
    Point: Point2,
    sign,
    verify,
    recoverPublicKey,
    Signature,
    hash
  });
}
function _weierstrass_legacy_opts_to_new(c) {
  const CURVE = {
    a: c.a,
    b: c.b,
    p: c.Fp.ORDER,
    n: c.n,
    h: c.h,
    Gx: c.Gx,
    Gy: c.Gy
  };
  const Fp = c.Fp;
  let allowedLengths = c.allowedPrivateKeyLengths ? Array.from(new Set(c.allowedPrivateKeyLengths.map((l) => Math.ceil(l / 2)))) : void 0;
  const Fn = Field(CURVE.n, {
    BITS: c.nBitLength,
    allowedLengths,
    modFromBytes: c.wrapPrivateKey
  });
  const curveOpts = {
    Fp,
    Fn,
    allowInfinityPoint: c.allowInfinityPoint,
    endo: c.endo,
    isTorsionFree: c.isTorsionFree,
    clearCofactor: c.clearCofactor,
    fromBytes: c.fromBytes,
    toBytes: c.toBytes
  };
  return { CURVE, curveOpts };
}
function _ecdsa_legacy_opts_to_new(c) {
  const { CURVE, curveOpts } = _weierstrass_legacy_opts_to_new(c);
  const ecdsaOpts = {
    hmac: c.hmac,
    randomBytes: c.randomBytes,
    lowS: c.lowS,
    bits2int: c.bits2int,
    bits2int_modN: c.bits2int_modN
  };
  return { CURVE, curveOpts, hash: c.hash, ecdsaOpts };
}
function _ecdsa_new_output_to_legacy(c, _ecdsa) {
  const Point2 = _ecdsa.Point;
  return Object.assign({}, _ecdsa, {
    ProjectivePoint: Point2,
    CURVE: Object.assign({}, c, nLength(Point2.Fn.ORDER, Point2.Fn.BITS))
  });
}
function weierstrass(c) {
  const { CURVE, curveOpts, hash, ecdsaOpts } = _ecdsa_legacy_opts_to_new(c);
  const Point2 = weierstrassN(CURVE, curveOpts);
  const signs = ecdsa(Point2, hash, ecdsaOpts);
  return _ecdsa_new_output_to_legacy(c, signs);
}

// ../../node_modules/.pnpm/@noble+curves@1.9.7/node_modules/@noble/curves/esm/_shortw_utils.js
function createCurve(curveDef, defHash) {
  const create = (hash) => weierstrass({ ...curveDef, hash });
  return { ...create(defHash), create };
}

// ../../node_modules/.pnpm/@noble+curves@1.9.7/node_modules/@noble/curves/esm/secp256k1.js
var secp256k1_CURVE = {
  p: BigInt("0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f"),
  n: BigInt("0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141"),
  h: BigInt(1),
  a: BigInt(0),
  b: BigInt(7),
  Gx: BigInt("0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798"),
  Gy: BigInt("0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8")
};
var secp256k1_ENDO = {
  beta: BigInt("0x7ae96a2b657c07106e64479eac3434e99cf0497512f58995c1396c28719501ee"),
  basises: [
    [BigInt("0x3086d221a7d46bcde86c90e49284eb15"), -BigInt("0xe4437ed6010e88286f547fa90abfe4c3")],
    [BigInt("0x114ca50f7a8e2f3f657c1108d9d44cfd8"), BigInt("0x3086d221a7d46bcde86c90e49284eb15")]
  ]
};
var _2n3 = /* @__PURE__ */ BigInt(2);
function sqrtMod(y) {
  const P2 = secp256k1_CURVE.p;
  const _3n3 = BigInt(3), _6n = BigInt(6), _11n = BigInt(11), _22n = BigInt(22);
  const _23n = BigInt(23), _44n = BigInt(44), _88n = BigInt(88);
  const b2 = y * y * y % P2;
  const b3 = b2 * b2 * y % P2;
  const b6 = pow22(b3, _3n3, P2) * b3 % P2;
  const b9 = pow22(b6, _3n3, P2) * b3 % P2;
  const b11 = pow22(b9, _2n3, P2) * b2 % P2;
  const b22 = pow22(b11, _11n, P2) * b11 % P2;
  const b44 = pow22(b22, _22n, P2) * b22 % P2;
  const b88 = pow22(b44, _44n, P2) * b44 % P2;
  const b176 = pow22(b88, _88n, P2) * b88 % P2;
  const b220 = pow22(b176, _44n, P2) * b44 % P2;
  const b223 = pow22(b220, _3n3, P2) * b3 % P2;
  const t1 = pow22(b223, _23n, P2) * b22 % P2;
  const t2 = pow22(t1, _6n, P2) * b2 % P2;
  const root = pow22(t2, _2n3, P2);
  if (!Fpk1.eql(Fpk1.sqr(root), y))
    throw new Error("Cannot find square root");
  return root;
}
var Fpk1 = Field(secp256k1_CURVE.p, { sqrt: sqrtMod });
var secp256k1 = createCurve({ ...secp256k1_CURVE, Fp: Fpk1, lowS: true, endo: secp256k1_ENDO }, sha256);

// ../provenancekit-privacy/dist/index.mjs
var KEY_LENGTH = 32;
var NONCE_LENGTHS = {
  "xchacha20-poly1305": 24,
  // Extended nonce - safe for random generation
  "chacha20-poly1305": 12,
  // Standard nonce
  "aes-256-gcm": 12,
  // Standard nonce
  "aes-256-gcm-siv": 12
  // Standard nonce, but nonce-misuse resistant
};
var DEFAULT_ALGORITHM = "xchacha20-poly1305";
function getCipher(algorithm, key, nonce) {
  switch (algorithm) {
    case "xchacha20-poly1305":
      return xchacha20poly1305(key, nonce);
    case "chacha20-poly1305":
      return chacha20poly1305(key, nonce);
    case "aes-256-gcm":
      return gcm(key, nonce);
    case "aes-256-gcm-siv":
      return siv(key, nonce);
    default:
      throw new Error(`Unsupported algorithm: ${algorithm}`);
  }
}
function validateKey(key) {
  if (key.length !== KEY_LENGTH) {
    throw new Error(`Invalid key length: expected ${KEY_LENGTH} bytes, got ${key.length}`);
  }
}
function validateNonce(nonce, algorithm) {
  const expected = NONCE_LENGTHS[algorithm];
  if (nonce.length !== expected) {
    throw new Error(
      `Invalid nonce length for ${algorithm}: expected ${expected} bytes, got ${nonce.length}`
    );
  }
}
function generateNonce(algorithm = DEFAULT_ALGORITHM) {
  return randomBytes(NONCE_LENGTHS[algorithm]);
}
function encrypt2(data, key, algorithm = DEFAULT_ALGORITHM, nonce) {
  validateKey(key);
  const actualNonce = nonce ?? generateNonce(algorithm);
  validateNonce(actualNonce, algorithm);
  const cipher = getCipher(algorithm, key, actualNonce);
  const ciphertext = cipher.encrypt(data);
  return {
    ciphertext,
    nonce: actualNonce,
    algorithm
  };
}
function decrypt(ciphertext, key, nonce, algorithm = DEFAULT_ALGORITHM) {
  validateKey(key);
  validateNonce(nonce, algorithm);
  const cipher = getCipher(algorithm, key, nonce);
  return cipher.decrypt(ciphertext);
}
function fromBase64(base64) {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(base64, "base64"));
  }
  return new Uint8Array(
    atob(base64).split("").map((c) => c.charCodeAt(0))
  );
}
function fromEnvelope(envelope) {
  return {
    ciphertext: fromBase64(envelope.ciphertext),
    nonce: fromBase64(envelope.nonce),
    algorithm: envelope.algorithm
  };
}
var NobleEncryptionProvider = class {
  constructor() {
    this.name = "noble-ciphers";
    this.supportedAlgorithms = [
      "xchacha20-poly1305",
      "chacha20-poly1305",
      "aes-256-gcm",
      "aes-256-gcm-siv"
    ];
  }
  async encrypt(data, key, algorithm = DEFAULT_ALGORITHM) {
    return encrypt2(data, key, algorithm);
  }
  async decrypt(ciphertext, key, nonce, algorithm = DEFAULT_ALGORITHM) {
    return decrypt(ciphertext, key, nonce, algorithm);
  }
};
var defaultEncryptionProvider = new NobleEncryptionProvider();
var DEFAULT_ITERATIONS = 1e5;
var DEFAULT_SALT_LENGTH = 32;
var WALLET_KEY_DOMAIN = "provenancekit:encryption:v1";
function getHashFunction(algo) {
  switch (algo) {
    case "SHA-256":
      return sha2562;
    case "SHA-384":
      return sha3842;
    case "SHA-512":
      return sha5122;
    default:
      throw new Error(`Unsupported hash algorithm: ${algo}`);
  }
}
function deriveKeyFromPassword(password, salt, iterations = DEFAULT_ITERATIONS, hash = "SHA-256") {
  const actualSalt = salt ?? randomBytes(DEFAULT_SALT_LENGTH);
  const hashFn = getHashFunction(hash);
  const key = pbkdf2(hashFn, password, actualSalt, {
    c: iterations,
    dkLen: KEY_LENGTH
  });
  return {
    key,
    salt: actualSalt,
    method: "password"
  };
}
function deriveKeyFromWallet(signature, message, domain = WALLET_KEY_DOMAIN) {
  const sigBytes = hexToBytes4(signature);
  const info = new TextEncoder().encode(`${domain}:${message}`);
  const salt = sha2562(info);
  const key = hkdf(sha2562, sigBytes, salt, info, KEY_LENGTH);
  return {
    key,
    method: "wallet"
  };
}
function wrapDirectKey(key) {
  if (key.length !== KEY_LENGTH) {
    throw new Error(`Invalid key length: expected ${KEY_LENGTH} bytes, got ${key.length}`);
  }
  return {
    key: new Uint8Array(key),
    // Copy to prevent mutation
    method: "direct"
  };
}
function deriveKey(options) {
  switch (options.method) {
    case "password":
      return deriveKeyFromPassword(
        options.password,
        options.salt,
        options.iterations,
        options.hash
      );
    case "wallet":
      return deriveKeyFromWallet(options.signature, options.message, options.domain);
    case "direct":
      return wrapDirectKey(options.key);
    default:
      throw new Error(`Unsupported key derivation method`);
  }
}
var DefaultKeyManager = class {
  async deriveKey(options) {
    return deriveKey(options);
  }
  generateKey(length = KEY_LENGTH) {
    return randomBytes(length);
  }
  generateNonce(algorithm) {
    return randomBytes(NONCE_LENGTHS[algorithm]);
  }
};
var defaultKeyManager = new DefaultKeyManager();
function hexToBytes4(hex) {
  const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (cleanHex.length % 2 !== 0) {
    throw new Error("Invalid hex string: odd length");
  }
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
function bytesToHex4(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
var G2 = secp256k1.ProjectivePoint.BASE;
var H_SEED = "ProvenanceKit-Pedersen-H-v2";
function modSqrt(a, p) {
  const exp = (p - 1n) / 2n;
  const legendre = modPow(a, exp, p);
  if (legendre !== 1n) {
    return null;
  }
  const sqrtExp = (p + 1n) / 4n;
  return modPow(a, sqrtExp, p);
}
function modPow(base, exp, m) {
  let result = 1n;
  base = base % m;
  while (exp > 0n) {
    if (exp % 2n === 1n) {
      result = result * base % m;
    }
    exp = exp / 2n;
    base = base * base % m;
  }
  return result;
}
function deriveH() {
  const p = 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2fn;
  let hash = sha2562(new TextEncoder().encode(H_SEED));
  for (let i = 0; i < 256; i++) {
    const x = BigInt("0x" + bytesToHex4(hash)) % p;
    if (x === 0n) {
      hash = sha2562(hash);
      continue;
    }
    const x3 = x * x * x % p;
    const rhs = (x3 + 7n) % p;
    const y = modSqrt(rhs, p);
    if (y !== null) {
      const yEven = y % 2n === 0n ? y : p - y;
      try {
        const point = secp256k1.ProjectivePoint.fromAffine({
          x,
          y: yEven
        });
        point.assertValidity();
        return point;
      } catch {
      }
    }
    hash = sha2562(hash);
  }
  throw new Error("Failed to derive H generator after 256 attempts");
}
var H = deriveH();
var N2 = secp256k1.CURVE.n;

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/external.js
var external_exports = {};
__export(external_exports, {
  BRAND: () => BRAND,
  DIRTY: () => DIRTY,
  EMPTY_PATH: () => EMPTY_PATH,
  INVALID: () => INVALID,
  NEVER: () => NEVER,
  OK: () => OK,
  ParseStatus: () => ParseStatus,
  Schema: () => ZodType,
  ZodAny: () => ZodAny,
  ZodArray: () => ZodArray,
  ZodBigInt: () => ZodBigInt,
  ZodBoolean: () => ZodBoolean,
  ZodBranded: () => ZodBranded,
  ZodCatch: () => ZodCatch,
  ZodDate: () => ZodDate,
  ZodDefault: () => ZodDefault,
  ZodDiscriminatedUnion: () => ZodDiscriminatedUnion,
  ZodEffects: () => ZodEffects,
  ZodEnum: () => ZodEnum,
  ZodError: () => ZodError,
  ZodFirstPartyTypeKind: () => ZodFirstPartyTypeKind,
  ZodFunction: () => ZodFunction,
  ZodIntersection: () => ZodIntersection,
  ZodIssueCode: () => ZodIssueCode,
  ZodLazy: () => ZodLazy,
  ZodLiteral: () => ZodLiteral,
  ZodMap: () => ZodMap,
  ZodNaN: () => ZodNaN,
  ZodNativeEnum: () => ZodNativeEnum,
  ZodNever: () => ZodNever,
  ZodNull: () => ZodNull,
  ZodNullable: () => ZodNullable,
  ZodNumber: () => ZodNumber,
  ZodObject: () => ZodObject,
  ZodOptional: () => ZodOptional,
  ZodParsedType: () => ZodParsedType,
  ZodPipeline: () => ZodPipeline,
  ZodPromise: () => ZodPromise,
  ZodReadonly: () => ZodReadonly,
  ZodRecord: () => ZodRecord,
  ZodSchema: () => ZodType,
  ZodSet: () => ZodSet,
  ZodString: () => ZodString,
  ZodSymbol: () => ZodSymbol,
  ZodTransformer: () => ZodEffects,
  ZodTuple: () => ZodTuple,
  ZodType: () => ZodType,
  ZodUndefined: () => ZodUndefined,
  ZodUnion: () => ZodUnion,
  ZodUnknown: () => ZodUnknown,
  ZodVoid: () => ZodVoid,
  addIssueToContext: () => addIssueToContext,
  any: () => anyType,
  array: () => arrayType,
  bigint: () => bigIntType,
  boolean: () => booleanType,
  coerce: () => coerce,
  custom: () => custom,
  date: () => dateType,
  datetimeRegex: () => datetimeRegex,
  defaultErrorMap: () => en_default,
  discriminatedUnion: () => discriminatedUnionType,
  effect: () => effectsType,
  enum: () => enumType,
  function: () => functionType,
  getErrorMap: () => getErrorMap,
  getParsedType: () => getParsedType,
  instanceof: () => instanceOfType,
  intersection: () => intersectionType,
  isAborted: () => isAborted,
  isAsync: () => isAsync,
  isDirty: () => isDirty,
  isValid: () => isValid,
  late: () => late,
  lazy: () => lazyType,
  literal: () => literalType,
  makeIssue: () => makeIssue,
  map: () => mapType,
  nan: () => nanType,
  nativeEnum: () => nativeEnumType,
  never: () => neverType,
  null: () => nullType,
  nullable: () => nullableType,
  number: () => numberType,
  object: () => objectType,
  objectUtil: () => objectUtil,
  oboolean: () => oboolean,
  onumber: () => onumber,
  optional: () => optionalType,
  ostring: () => ostring,
  pipeline: () => pipelineType,
  preprocess: () => preprocessType,
  promise: () => promiseType,
  quotelessJson: () => quotelessJson,
  record: () => recordType,
  set: () => setType,
  setErrorMap: () => setErrorMap,
  strictObject: () => strictObjectType,
  string: () => stringType,
  symbol: () => symbolType,
  transformer: () => effectsType,
  tuple: () => tupleType,
  undefined: () => undefinedType,
  union: () => unionType,
  unknown: () => unknownType,
  util: () => util,
  void: () => voidType
});

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/helpers/util.js
var util;
(function(util2) {
  util2.assertEqual = (_) => {
  };
  function assertIs(_arg) {
  }
  util2.assertIs = assertIs;
  function assertNever(_x) {
    throw new Error();
  }
  util2.assertNever = assertNever;
  util2.arrayToEnum = (items) => {
    const obj = {};
    for (const item of items) {
      obj[item] = item;
    }
    return obj;
  };
  util2.getValidEnumValues = (obj) => {
    const validKeys = util2.objectKeys(obj).filter((k) => typeof obj[obj[k]] !== "number");
    const filtered = {};
    for (const k of validKeys) {
      filtered[k] = obj[k];
    }
    return util2.objectValues(filtered);
  };
  util2.objectValues = (obj) => {
    return util2.objectKeys(obj).map(function(e) {
      return obj[e];
    });
  };
  util2.objectKeys = typeof Object.keys === "function" ? (obj) => Object.keys(obj) : (object) => {
    const keys = [];
    for (const key in object) {
      if (Object.prototype.hasOwnProperty.call(object, key)) {
        keys.push(key);
      }
    }
    return keys;
  };
  util2.find = (arr, checker) => {
    for (const item of arr) {
      if (checker(item))
        return item;
    }
    return void 0;
  };
  util2.isInteger = typeof Number.isInteger === "function" ? (val) => Number.isInteger(val) : (val) => typeof val === "number" && Number.isFinite(val) && Math.floor(val) === val;
  function joinValues(array, separator = " | ") {
    return array.map((val) => typeof val === "string" ? `'${val}'` : val).join(separator);
  }
  util2.joinValues = joinValues;
  util2.jsonStringifyReplacer = (_, value) => {
    if (typeof value === "bigint") {
      return value.toString();
    }
    return value;
  };
})(util || (util = {}));
var objectUtil;
(function(objectUtil2) {
  objectUtil2.mergeShapes = (first, second) => {
    return {
      ...first,
      ...second
      // second overwrites first
    };
  };
})(objectUtil || (objectUtil = {}));
var ZodParsedType = util.arrayToEnum([
  "string",
  "nan",
  "number",
  "integer",
  "float",
  "boolean",
  "date",
  "bigint",
  "symbol",
  "function",
  "undefined",
  "null",
  "array",
  "object",
  "unknown",
  "promise",
  "void",
  "never",
  "map",
  "set"
]);
var getParsedType = (data) => {
  const t = typeof data;
  switch (t) {
    case "undefined":
      return ZodParsedType.undefined;
    case "string":
      return ZodParsedType.string;
    case "number":
      return Number.isNaN(data) ? ZodParsedType.nan : ZodParsedType.number;
    case "boolean":
      return ZodParsedType.boolean;
    case "function":
      return ZodParsedType.function;
    case "bigint":
      return ZodParsedType.bigint;
    case "symbol":
      return ZodParsedType.symbol;
    case "object":
      if (Array.isArray(data)) {
        return ZodParsedType.array;
      }
      if (data === null) {
        return ZodParsedType.null;
      }
      if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
        return ZodParsedType.promise;
      }
      if (typeof Map !== "undefined" && data instanceof Map) {
        return ZodParsedType.map;
      }
      if (typeof Set !== "undefined" && data instanceof Set) {
        return ZodParsedType.set;
      }
      if (typeof Date !== "undefined" && data instanceof Date) {
        return ZodParsedType.date;
      }
      return ZodParsedType.object;
    default:
      return ZodParsedType.unknown;
  }
};

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/ZodError.js
var ZodIssueCode = util.arrayToEnum([
  "invalid_type",
  "invalid_literal",
  "custom",
  "invalid_union",
  "invalid_union_discriminator",
  "invalid_enum_value",
  "unrecognized_keys",
  "invalid_arguments",
  "invalid_return_type",
  "invalid_date",
  "invalid_string",
  "too_small",
  "too_big",
  "invalid_intersection_types",
  "not_multiple_of",
  "not_finite"
]);
var quotelessJson = (obj) => {
  const json = JSON.stringify(obj, null, 2);
  return json.replace(/"([^"]+)":/g, "$1:");
};
var ZodError = class _ZodError extends Error {
  get errors() {
    return this.issues;
  }
  constructor(issues) {
    super();
    this.issues = [];
    this.addIssue = (sub) => {
      this.issues = [...this.issues, sub];
    };
    this.addIssues = (subs = []) => {
      this.issues = [...this.issues, ...subs];
    };
    const actualProto = new.target.prototype;
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto);
    } else {
      this.__proto__ = actualProto;
    }
    this.name = "ZodError";
    this.issues = issues;
  }
  format(_mapper) {
    const mapper = _mapper || function(issue) {
      return issue.message;
    };
    const fieldErrors = { _errors: [] };
    const processError = (error) => {
      for (const issue of error.issues) {
        if (issue.code === "invalid_union") {
          issue.unionErrors.map(processError);
        } else if (issue.code === "invalid_return_type") {
          processError(issue.returnTypeError);
        } else if (issue.code === "invalid_arguments") {
          processError(issue.argumentsError);
        } else if (issue.path.length === 0) {
          fieldErrors._errors.push(mapper(issue));
        } else {
          let curr = fieldErrors;
          let i = 0;
          while (i < issue.path.length) {
            const el = issue.path[i];
            const terminal = i === issue.path.length - 1;
            if (!terminal) {
              curr[el] = curr[el] || { _errors: [] };
            } else {
              curr[el] = curr[el] || { _errors: [] };
              curr[el]._errors.push(mapper(issue));
            }
            curr = curr[el];
            i++;
          }
        }
      }
    };
    processError(this);
    return fieldErrors;
  }
  static assert(value) {
    if (!(value instanceof _ZodError)) {
      throw new Error(`Not a ZodError: ${value}`);
    }
  }
  toString() {
    return this.message;
  }
  get message() {
    return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2);
  }
  get isEmpty() {
    return this.issues.length === 0;
  }
  flatten(mapper = (issue) => issue.message) {
    const fieldErrors = {};
    const formErrors = [];
    for (const sub of this.issues) {
      if (sub.path.length > 0) {
        const firstEl = sub.path[0];
        fieldErrors[firstEl] = fieldErrors[firstEl] || [];
        fieldErrors[firstEl].push(mapper(sub));
      } else {
        formErrors.push(mapper(sub));
      }
    }
    return { formErrors, fieldErrors };
  }
  get formErrors() {
    return this.flatten();
  }
};
ZodError.create = (issues) => {
  const error = new ZodError(issues);
  return error;
};

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/locales/en.js
var errorMap = (issue, _ctx) => {
  let message;
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === ZodParsedType.undefined) {
        message = "Required";
      } else {
        message = `Expected ${issue.expected}, received ${issue.received}`;
      }
      break;
    case ZodIssueCode.invalid_literal:
      message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util.jsonStringifyReplacer)}`;
      break;
    case ZodIssueCode.unrecognized_keys:
      message = `Unrecognized key(s) in object: ${util.joinValues(issue.keys, ", ")}`;
      break;
    case ZodIssueCode.invalid_union:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_union_discriminator:
      message = `Invalid discriminator value. Expected ${util.joinValues(issue.options)}`;
      break;
    case ZodIssueCode.invalid_enum_value:
      message = `Invalid enum value. Expected ${util.joinValues(issue.options)}, received '${issue.received}'`;
      break;
    case ZodIssueCode.invalid_arguments:
      message = `Invalid function arguments`;
      break;
    case ZodIssueCode.invalid_return_type:
      message = `Invalid function return type`;
      break;
    case ZodIssueCode.invalid_date:
      message = `Invalid date`;
      break;
    case ZodIssueCode.invalid_string:
      if (typeof issue.validation === "object") {
        if ("includes" in issue.validation) {
          message = `Invalid input: must include "${issue.validation.includes}"`;
          if (typeof issue.validation.position === "number") {
            message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
          }
        } else if ("startsWith" in issue.validation) {
          message = `Invalid input: must start with "${issue.validation.startsWith}"`;
        } else if ("endsWith" in issue.validation) {
          message = `Invalid input: must end with "${issue.validation.endsWith}"`;
        } else {
          util.assertNever(issue.validation);
        }
      } else if (issue.validation !== "regex") {
        message = `Invalid ${issue.validation}`;
      } else {
        message = "Invalid";
      }
      break;
    case ZodIssueCode.too_small:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "bigint")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.too_big:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "bigint")
        message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.custom:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_intersection_types:
      message = `Intersection results could not be merged`;
      break;
    case ZodIssueCode.not_multiple_of:
      message = `Number must be a multiple of ${issue.multipleOf}`;
      break;
    case ZodIssueCode.not_finite:
      message = "Number must be finite";
      break;
    default:
      message = _ctx.defaultError;
      util.assertNever(issue);
  }
  return { message };
};
var en_default = errorMap;

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/errors.js
var overrideErrorMap = en_default;
function setErrorMap(map) {
  overrideErrorMap = map;
}
function getErrorMap() {
  return overrideErrorMap;
}

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/helpers/parseUtil.js
var makeIssue = (params) => {
  const { data, path, errorMaps, issueData } = params;
  const fullPath = [...path, ...issueData.path || []];
  const fullIssue = {
    ...issueData,
    path: fullPath
  };
  if (issueData.message !== void 0) {
    return {
      ...issueData,
      path: fullPath,
      message: issueData.message
    };
  }
  let errorMessage = "";
  const maps = errorMaps.filter((m) => !!m).slice().reverse();
  for (const map of maps) {
    errorMessage = map(fullIssue, { data, defaultError: errorMessage }).message;
  }
  return {
    ...issueData,
    path: fullPath,
    message: errorMessage
  };
};
var EMPTY_PATH = [];
function addIssueToContext(ctx, issueData) {
  const overrideMap = getErrorMap();
  const issue = makeIssue({
    issueData,
    data: ctx.data,
    path: ctx.path,
    errorMaps: [
      ctx.common.contextualErrorMap,
      // contextual error map is first priority
      ctx.schemaErrorMap,
      // then schema-bound map if available
      overrideMap,
      // then global override map
      overrideMap === en_default ? void 0 : en_default
      // then global default map
    ].filter((x) => !!x)
  });
  ctx.common.issues.push(issue);
}
var ParseStatus = class _ParseStatus {
  constructor() {
    this.value = "valid";
  }
  dirty() {
    if (this.value === "valid")
      this.value = "dirty";
  }
  abort() {
    if (this.value !== "aborted")
      this.value = "aborted";
  }
  static mergeArray(status, results) {
    const arrayValue = [];
    for (const s of results) {
      if (s.status === "aborted")
        return INVALID;
      if (s.status === "dirty")
        status.dirty();
      arrayValue.push(s.value);
    }
    return { status: status.value, value: arrayValue };
  }
  static async mergeObjectAsync(status, pairs) {
    const syncPairs = [];
    for (const pair of pairs) {
      const key = await pair.key;
      const value = await pair.value;
      syncPairs.push({
        key,
        value
      });
    }
    return _ParseStatus.mergeObjectSync(status, syncPairs);
  }
  static mergeObjectSync(status, pairs) {
    const finalObject = {};
    for (const pair of pairs) {
      const { key, value } = pair;
      if (key.status === "aborted")
        return INVALID;
      if (value.status === "aborted")
        return INVALID;
      if (key.status === "dirty")
        status.dirty();
      if (value.status === "dirty")
        status.dirty();
      if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
        finalObject[key.value] = value.value;
      }
    }
    return { status: status.value, value: finalObject };
  }
};
var INVALID = Object.freeze({
  status: "aborted"
});
var DIRTY = (value) => ({ status: "dirty", value });
var OK = (value) => ({ status: "valid", value });
var isAborted = (x) => x.status === "aborted";
var isDirty = (x) => x.status === "dirty";
var isValid = (x) => x.status === "valid";
var isAsync = (x) => typeof Promise !== "undefined" && x instanceof Promise;

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/helpers/errorUtil.js
var errorUtil;
(function(errorUtil2) {
  errorUtil2.errToObj = (message) => typeof message === "string" ? { message } : message || {};
  errorUtil2.toString = (message) => typeof message === "string" ? message : message?.message;
})(errorUtil || (errorUtil = {}));

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/types.js
var ParseInputLazyPath = class {
  constructor(parent, value, path, key) {
    this._cachedPath = [];
    this.parent = parent;
    this.data = value;
    this._path = path;
    this._key = key;
  }
  get path() {
    if (!this._cachedPath.length) {
      if (Array.isArray(this._key)) {
        this._cachedPath.push(...this._path, ...this._key);
      } else {
        this._cachedPath.push(...this._path, this._key);
      }
    }
    return this._cachedPath;
  }
};
var handleResult = (ctx, result) => {
  if (isValid(result)) {
    return { success: true, data: result.value };
  } else {
    if (!ctx.common.issues.length) {
      throw new Error("Validation failed but no issues detected.");
    }
    return {
      success: false,
      get error() {
        if (this._error)
          return this._error;
        const error = new ZodError(ctx.common.issues);
        this._error = error;
        return this._error;
      }
    };
  }
};
function processCreateParams(params) {
  if (!params)
    return {};
  const { errorMap: errorMap2, invalid_type_error, required_error, description } = params;
  if (errorMap2 && (invalid_type_error || required_error)) {
    throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
  }
  if (errorMap2)
    return { errorMap: errorMap2, description };
  const customMap = (iss, ctx) => {
    const { message } = params;
    if (iss.code === "invalid_enum_value") {
      return { message: message ?? ctx.defaultError };
    }
    if (typeof ctx.data === "undefined") {
      return { message: message ?? required_error ?? ctx.defaultError };
    }
    if (iss.code !== "invalid_type")
      return { message: ctx.defaultError };
    return { message: message ?? invalid_type_error ?? ctx.defaultError };
  };
  return { errorMap: customMap, description };
}
var ZodType = class {
  get description() {
    return this._def.description;
  }
  _getType(input) {
    return getParsedType(input.data);
  }
  _getOrReturnCtx(input, ctx) {
    return ctx || {
      common: input.parent.common,
      data: input.data,
      parsedType: getParsedType(input.data),
      schemaErrorMap: this._def.errorMap,
      path: input.path,
      parent: input.parent
    };
  }
  _processInputParams(input) {
    return {
      status: new ParseStatus(),
      ctx: {
        common: input.parent.common,
        data: input.data,
        parsedType: getParsedType(input.data),
        schemaErrorMap: this._def.errorMap,
        path: input.path,
        parent: input.parent
      }
    };
  }
  _parseSync(input) {
    const result = this._parse(input);
    if (isAsync(result)) {
      throw new Error("Synchronous parse encountered promise.");
    }
    return result;
  }
  _parseAsync(input) {
    const result = this._parse(input);
    return Promise.resolve(result);
  }
  parse(data, params) {
    const result = this.safeParse(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  safeParse(data, params) {
    const ctx = {
      common: {
        issues: [],
        async: params?.async ?? false,
        contextualErrorMap: params?.errorMap
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const result = this._parseSync({ data, path: ctx.path, parent: ctx });
    return handleResult(ctx, result);
  }
  "~validate"(data) {
    const ctx = {
      common: {
        issues: [],
        async: !!this["~standard"].async
      },
      path: [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    if (!this["~standard"].async) {
      try {
        const result = this._parseSync({ data, path: [], parent: ctx });
        return isValid(result) ? {
          value: result.value
        } : {
          issues: ctx.common.issues
        };
      } catch (err2) {
        if (err2?.message?.toLowerCase()?.includes("encountered")) {
          this["~standard"].async = true;
        }
        ctx.common = {
          issues: [],
          async: true
        };
      }
    }
    return this._parseAsync({ data, path: [], parent: ctx }).then((result) => isValid(result) ? {
      value: result.value
    } : {
      issues: ctx.common.issues
    });
  }
  async parseAsync(data, params) {
    const result = await this.safeParseAsync(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  async safeParseAsync(data, params) {
    const ctx = {
      common: {
        issues: [],
        contextualErrorMap: params?.errorMap,
        async: true
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
    const result = await (isAsync(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult));
    return handleResult(ctx, result);
  }
  refine(check, message) {
    const getIssueProperties = (val) => {
      if (typeof message === "string" || typeof message === "undefined") {
        return { message };
      } else if (typeof message === "function") {
        return message(val);
      } else {
        return message;
      }
    };
    return this._refinement((val, ctx) => {
      const result = check(val);
      const setError = () => ctx.addIssue({
        code: ZodIssueCode.custom,
        ...getIssueProperties(val)
      });
      if (typeof Promise !== "undefined" && result instanceof Promise) {
        return result.then((data) => {
          if (!data) {
            setError();
            return false;
          } else {
            return true;
          }
        });
      }
      if (!result) {
        setError();
        return false;
      } else {
        return true;
      }
    });
  }
  refinement(check, refinementData) {
    return this._refinement((val, ctx) => {
      if (!check(val)) {
        ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
        return false;
      } else {
        return true;
      }
    });
  }
  _refinement(refinement) {
    return new ZodEffects({
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "refinement", refinement }
    });
  }
  superRefine(refinement) {
    return this._refinement(refinement);
  }
  constructor(def) {
    this.spa = this.safeParseAsync;
    this._def = def;
    this.parse = this.parse.bind(this);
    this.safeParse = this.safeParse.bind(this);
    this.parseAsync = this.parseAsync.bind(this);
    this.safeParseAsync = this.safeParseAsync.bind(this);
    this.spa = this.spa.bind(this);
    this.refine = this.refine.bind(this);
    this.refinement = this.refinement.bind(this);
    this.superRefine = this.superRefine.bind(this);
    this.optional = this.optional.bind(this);
    this.nullable = this.nullable.bind(this);
    this.nullish = this.nullish.bind(this);
    this.array = this.array.bind(this);
    this.promise = this.promise.bind(this);
    this.or = this.or.bind(this);
    this.and = this.and.bind(this);
    this.transform = this.transform.bind(this);
    this.brand = this.brand.bind(this);
    this.default = this.default.bind(this);
    this.catch = this.catch.bind(this);
    this.describe = this.describe.bind(this);
    this.pipe = this.pipe.bind(this);
    this.readonly = this.readonly.bind(this);
    this.isNullable = this.isNullable.bind(this);
    this.isOptional = this.isOptional.bind(this);
    this["~standard"] = {
      version: 1,
      vendor: "zod",
      validate: (data) => this["~validate"](data)
    };
  }
  optional() {
    return ZodOptional.create(this, this._def);
  }
  nullable() {
    return ZodNullable.create(this, this._def);
  }
  nullish() {
    return this.nullable().optional();
  }
  array() {
    return ZodArray.create(this);
  }
  promise() {
    return ZodPromise.create(this, this._def);
  }
  or(option) {
    return ZodUnion.create([this, option], this._def);
  }
  and(incoming) {
    return ZodIntersection.create(this, incoming, this._def);
  }
  transform(transform) {
    return new ZodEffects({
      ...processCreateParams(this._def),
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "transform", transform }
    });
  }
  default(def) {
    const defaultValueFunc = typeof def === "function" ? def : () => def;
    return new ZodDefault({
      ...processCreateParams(this._def),
      innerType: this,
      defaultValue: defaultValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodDefault
    });
  }
  brand() {
    return new ZodBranded({
      typeName: ZodFirstPartyTypeKind.ZodBranded,
      type: this,
      ...processCreateParams(this._def)
    });
  }
  catch(def) {
    const catchValueFunc = typeof def === "function" ? def : () => def;
    return new ZodCatch({
      ...processCreateParams(this._def),
      innerType: this,
      catchValue: catchValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodCatch
    });
  }
  describe(description) {
    const This = this.constructor;
    return new This({
      ...this._def,
      description
    });
  }
  pipe(target) {
    return ZodPipeline.create(this, target);
  }
  readonly() {
    return ZodReadonly.create(this);
  }
  isOptional() {
    return this.safeParse(void 0).success;
  }
  isNullable() {
    return this.safeParse(null).success;
  }
};
var cuidRegex = /^c[^\s-]{8,}$/i;
var cuid2Regex = /^[0-9a-z]+$/;
var ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
var uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
var nanoidRegex = /^[a-z0-9_-]{21}$/i;
var jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
var durationRegex = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
var emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
var _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
var emojiRegex;
var ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
var ipv4CidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/;
var ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
var ipv6CidrRegex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
var base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
var base64urlRegex = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
var dateRegexSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
var dateRegex = new RegExp(`^${dateRegexSource}$`);
function timeRegexSource(args) {
  let secondsRegexSource = `[0-5]\\d`;
  if (args.precision) {
    secondsRegexSource = `${secondsRegexSource}\\.\\d{${args.precision}}`;
  } else if (args.precision == null) {
    secondsRegexSource = `${secondsRegexSource}(\\.\\d+)?`;
  }
  const secondsQuantifier = args.precision ? "+" : "?";
  return `([01]\\d|2[0-3]):[0-5]\\d(:${secondsRegexSource})${secondsQuantifier}`;
}
function timeRegex(args) {
  return new RegExp(`^${timeRegexSource(args)}$`);
}
function datetimeRegex(args) {
  let regex = `${dateRegexSource}T${timeRegexSource(args)}`;
  const opts = [];
  opts.push(args.local ? `Z?` : `Z`);
  if (args.offset)
    opts.push(`([+-]\\d{2}:?\\d{2})`);
  regex = `${regex}(${opts.join("|")})`;
  return new RegExp(`^${regex}$`);
}
function isValidIP(ip, version) {
  if ((version === "v4" || !version) && ipv4Regex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6Regex.test(ip)) {
    return true;
  }
  return false;
}
function isValidJWT(jwt, alg) {
  if (!jwtRegex.test(jwt))
    return false;
  try {
    const [header] = jwt.split(".");
    if (!header)
      return false;
    const base64 = header.replace(/-/g, "+").replace(/_/g, "/").padEnd(header.length + (4 - header.length % 4) % 4, "=");
    const decoded = JSON.parse(atob(base64));
    if (typeof decoded !== "object" || decoded === null)
      return false;
    if ("typ" in decoded && decoded?.typ !== "JWT")
      return false;
    if (!decoded.alg)
      return false;
    if (alg && decoded.alg !== alg)
      return false;
    return true;
  } catch {
    return false;
  }
}
function isValidCidr(ip, version) {
  if ((version === "v4" || !version) && ipv4CidrRegex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6CidrRegex.test(ip)) {
    return true;
  }
  return false;
}
var ZodString = class _ZodString extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = String(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.string) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.string,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.length < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.length > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "length") {
        const tooBig = input.data.length > check.value;
        const tooSmall = input.data.length < check.value;
        if (tooBig || tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          if (tooBig) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          } else if (tooSmall) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          }
          status.dirty();
        }
      } else if (check.kind === "email") {
        if (!emailRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "email",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "emoji") {
        if (!emojiRegex) {
          emojiRegex = new RegExp(_emojiRegex, "u");
        }
        if (!emojiRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "emoji",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "uuid") {
        if (!uuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "uuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "nanoid") {
        if (!nanoidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "nanoid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid") {
        if (!cuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid2") {
        if (!cuid2Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid2",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ulid") {
        if (!ulidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ulid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "url") {
        try {
          new URL(input.data);
        } catch {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "regex") {
        check.regex.lastIndex = 0;
        const testResult = check.regex.test(input.data);
        if (!testResult) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "regex",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "trim") {
        input.data = input.data.trim();
      } else if (check.kind === "includes") {
        if (!input.data.includes(check.value, check.position)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { includes: check.value, position: check.position },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "toLowerCase") {
        input.data = input.data.toLowerCase();
      } else if (check.kind === "toUpperCase") {
        input.data = input.data.toUpperCase();
      } else if (check.kind === "startsWith") {
        if (!input.data.startsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { startsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "endsWith") {
        if (!input.data.endsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { endsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "datetime") {
        const regex = datetimeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "datetime",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "date") {
        const regex = dateRegex;
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "date",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "time") {
        const regex = timeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "time",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "duration") {
        if (!durationRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "duration",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ip") {
        if (!isValidIP(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ip",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "jwt") {
        if (!isValidJWT(input.data, check.alg)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "jwt",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cidr") {
        if (!isValidCidr(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cidr",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64") {
        if (!base64Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64url") {
        if (!base64urlRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _regex(regex, validation, message) {
    return this.refinement((data) => regex.test(data), {
      validation,
      code: ZodIssueCode.invalid_string,
      ...errorUtil.errToObj(message)
    });
  }
  _addCheck(check) {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  email(message) {
    return this._addCheck({ kind: "email", ...errorUtil.errToObj(message) });
  }
  url(message) {
    return this._addCheck({ kind: "url", ...errorUtil.errToObj(message) });
  }
  emoji(message) {
    return this._addCheck({ kind: "emoji", ...errorUtil.errToObj(message) });
  }
  uuid(message) {
    return this._addCheck({ kind: "uuid", ...errorUtil.errToObj(message) });
  }
  nanoid(message) {
    return this._addCheck({ kind: "nanoid", ...errorUtil.errToObj(message) });
  }
  cuid(message) {
    return this._addCheck({ kind: "cuid", ...errorUtil.errToObj(message) });
  }
  cuid2(message) {
    return this._addCheck({ kind: "cuid2", ...errorUtil.errToObj(message) });
  }
  ulid(message) {
    return this._addCheck({ kind: "ulid", ...errorUtil.errToObj(message) });
  }
  base64(message) {
    return this._addCheck({ kind: "base64", ...errorUtil.errToObj(message) });
  }
  base64url(message) {
    return this._addCheck({
      kind: "base64url",
      ...errorUtil.errToObj(message)
    });
  }
  jwt(options) {
    return this._addCheck({ kind: "jwt", ...errorUtil.errToObj(options) });
  }
  ip(options) {
    return this._addCheck({ kind: "ip", ...errorUtil.errToObj(options) });
  }
  cidr(options) {
    return this._addCheck({ kind: "cidr", ...errorUtil.errToObj(options) });
  }
  datetime(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "datetime",
        precision: null,
        offset: false,
        local: false,
        message: options
      });
    }
    return this._addCheck({
      kind: "datetime",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      offset: options?.offset ?? false,
      local: options?.local ?? false,
      ...errorUtil.errToObj(options?.message)
    });
  }
  date(message) {
    return this._addCheck({ kind: "date", message });
  }
  time(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "time",
        precision: null,
        message: options
      });
    }
    return this._addCheck({
      kind: "time",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      ...errorUtil.errToObj(options?.message)
    });
  }
  duration(message) {
    return this._addCheck({ kind: "duration", ...errorUtil.errToObj(message) });
  }
  regex(regex, message) {
    return this._addCheck({
      kind: "regex",
      regex,
      ...errorUtil.errToObj(message)
    });
  }
  includes(value, options) {
    return this._addCheck({
      kind: "includes",
      value,
      position: options?.position,
      ...errorUtil.errToObj(options?.message)
    });
  }
  startsWith(value, message) {
    return this._addCheck({
      kind: "startsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  endsWith(value, message) {
    return this._addCheck({
      kind: "endsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  min(minLength, message) {
    return this._addCheck({
      kind: "min",
      value: minLength,
      ...errorUtil.errToObj(message)
    });
  }
  max(maxLength, message) {
    return this._addCheck({
      kind: "max",
      value: maxLength,
      ...errorUtil.errToObj(message)
    });
  }
  length(len, message) {
    return this._addCheck({
      kind: "length",
      value: len,
      ...errorUtil.errToObj(message)
    });
  }
  /**
   * Equivalent to `.min(1)`
   */
  nonempty(message) {
    return this.min(1, errorUtil.errToObj(message));
  }
  trim() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "trim" }]
    });
  }
  toLowerCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toLowerCase" }]
    });
  }
  toUpperCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toUpperCase" }]
    });
  }
  get isDatetime() {
    return !!this._def.checks.find((ch) => ch.kind === "datetime");
  }
  get isDate() {
    return !!this._def.checks.find((ch) => ch.kind === "date");
  }
  get isTime() {
    return !!this._def.checks.find((ch) => ch.kind === "time");
  }
  get isDuration() {
    return !!this._def.checks.find((ch) => ch.kind === "duration");
  }
  get isEmail() {
    return !!this._def.checks.find((ch) => ch.kind === "email");
  }
  get isURL() {
    return !!this._def.checks.find((ch) => ch.kind === "url");
  }
  get isEmoji() {
    return !!this._def.checks.find((ch) => ch.kind === "emoji");
  }
  get isUUID() {
    return !!this._def.checks.find((ch) => ch.kind === "uuid");
  }
  get isNANOID() {
    return !!this._def.checks.find((ch) => ch.kind === "nanoid");
  }
  get isCUID() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid");
  }
  get isCUID2() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid2");
  }
  get isULID() {
    return !!this._def.checks.find((ch) => ch.kind === "ulid");
  }
  get isIP() {
    return !!this._def.checks.find((ch) => ch.kind === "ip");
  }
  get isCIDR() {
    return !!this._def.checks.find((ch) => ch.kind === "cidr");
  }
  get isBase64() {
    return !!this._def.checks.find((ch) => ch.kind === "base64");
  }
  get isBase64url() {
    return !!this._def.checks.find((ch) => ch.kind === "base64url");
  }
  get minLength() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxLength() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodString.create = (params) => {
  return new ZodString({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodString,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
function floatSafeRemainder(val, step) {
  const valDecCount = (val.toString().split(".")[1] || "").length;
  const stepDecCount = (step.toString().split(".")[1] || "").length;
  const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
  const valInt = Number.parseInt(val.toFixed(decCount).replace(".", ""));
  const stepInt = Number.parseInt(step.toFixed(decCount).replace(".", ""));
  return valInt % stepInt / 10 ** decCount;
}
var ZodNumber = class _ZodNumber extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
    this.step = this.multipleOf;
  }
  _parse(input) {
    if (this._def.coerce) {
      input.data = Number(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.number) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.number,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "int") {
        if (!util.isInteger(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: "integer",
            received: "float",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (floatSafeRemainder(input.data, check.value) !== 0) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "finite") {
        if (!Number.isFinite(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_finite,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodNumber({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodNumber({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  int(message) {
    return this._addCheck({
      kind: "int",
      message: errorUtil.toString(message)
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  finite(message) {
    return this._addCheck({
      kind: "finite",
      message: errorUtil.toString(message)
    });
  }
  safe(message) {
    return this._addCheck({
      kind: "min",
      inclusive: true,
      value: Number.MIN_SAFE_INTEGER,
      message: errorUtil.toString(message)
    })._addCheck({
      kind: "max",
      inclusive: true,
      value: Number.MAX_SAFE_INTEGER,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
  get isInt() {
    return !!this._def.checks.find((ch) => ch.kind === "int" || ch.kind === "multipleOf" && util.isInteger(ch.value));
  }
  get isFinite() {
    let max = null;
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
        return true;
      } else if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      } else if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return Number.isFinite(min) && Number.isFinite(max);
  }
};
ZodNumber.create = (params) => {
  return new ZodNumber({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodNumber,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
var ZodBigInt = class _ZodBigInt extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
  }
  _parse(input) {
    if (this._def.coerce) {
      try {
        input.data = BigInt(input.data);
      } catch {
        return this._getInvalidInput(input);
      }
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.bigint) {
      return this._getInvalidInput(input);
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            type: "bigint",
            minimum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            type: "bigint",
            maximum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (input.data % check.value !== BigInt(0)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _getInvalidInput(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.bigint,
      received: ctx.parsedType
    });
    return INVALID;
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodBigInt({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodBigInt({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodBigInt.create = (params) => {
  return new ZodBigInt({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodBigInt,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
var ZodBoolean = class extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = Boolean(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.boolean) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.boolean,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodBoolean.create = (params) => {
  return new ZodBoolean({
    typeName: ZodFirstPartyTypeKind.ZodBoolean,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
var ZodDate = class _ZodDate extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = new Date(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.date) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.date,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    if (Number.isNaN(input.data.getTime())) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_date
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.getTime() < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            message: check.message,
            inclusive: true,
            exact: false,
            minimum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.getTime() > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            message: check.message,
            inclusive: true,
            exact: false,
            maximum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return {
      status: status.value,
      value: new Date(input.data.getTime())
    };
  }
  _addCheck(check) {
    return new _ZodDate({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  min(minDate, message) {
    return this._addCheck({
      kind: "min",
      value: minDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  max(maxDate, message) {
    return this._addCheck({
      kind: "max",
      value: maxDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  get minDate() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min != null ? new Date(min) : null;
  }
  get maxDate() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max != null ? new Date(max) : null;
  }
};
ZodDate.create = (params) => {
  return new ZodDate({
    checks: [],
    coerce: params?.coerce || false,
    typeName: ZodFirstPartyTypeKind.ZodDate,
    ...processCreateParams(params)
  });
};
var ZodSymbol = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.symbol) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.symbol,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodSymbol.create = (params) => {
  return new ZodSymbol({
    typeName: ZodFirstPartyTypeKind.ZodSymbol,
    ...processCreateParams(params)
  });
};
var ZodUndefined = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.undefined,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodUndefined.create = (params) => {
  return new ZodUndefined({
    typeName: ZodFirstPartyTypeKind.ZodUndefined,
    ...processCreateParams(params)
  });
};
var ZodNull = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.null) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.null,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodNull.create = (params) => {
  return new ZodNull({
    typeName: ZodFirstPartyTypeKind.ZodNull,
    ...processCreateParams(params)
  });
};
var ZodAny = class extends ZodType {
  constructor() {
    super(...arguments);
    this._any = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodAny.create = (params) => {
  return new ZodAny({
    typeName: ZodFirstPartyTypeKind.ZodAny,
    ...processCreateParams(params)
  });
};
var ZodUnknown = class extends ZodType {
  constructor() {
    super(...arguments);
    this._unknown = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodUnknown.create = (params) => {
  return new ZodUnknown({
    typeName: ZodFirstPartyTypeKind.ZodUnknown,
    ...processCreateParams(params)
  });
};
var ZodNever = class extends ZodType {
  _parse(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.never,
      received: ctx.parsedType
    });
    return INVALID;
  }
};
ZodNever.create = (params) => {
  return new ZodNever({
    typeName: ZodFirstPartyTypeKind.ZodNever,
    ...processCreateParams(params)
  });
};
var ZodVoid = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.void,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodVoid.create = (params) => {
  return new ZodVoid({
    typeName: ZodFirstPartyTypeKind.ZodVoid,
    ...processCreateParams(params)
  });
};
var ZodArray = class _ZodArray extends ZodType {
  _parse(input) {
    const { ctx, status } = this._processInputParams(input);
    const def = this._def;
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (def.exactLength !== null) {
      const tooBig = ctx.data.length > def.exactLength.value;
      const tooSmall = ctx.data.length < def.exactLength.value;
      if (tooBig || tooSmall) {
        addIssueToContext(ctx, {
          code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
          minimum: tooSmall ? def.exactLength.value : void 0,
          maximum: tooBig ? def.exactLength.value : void 0,
          type: "array",
          inclusive: true,
          exact: true,
          message: def.exactLength.message
        });
        status.dirty();
      }
    }
    if (def.minLength !== null) {
      if (ctx.data.length < def.minLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.minLength.message
        });
        status.dirty();
      }
    }
    if (def.maxLength !== null) {
      if (ctx.data.length > def.maxLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.maxLength.message
        });
        status.dirty();
      }
    }
    if (ctx.common.async) {
      return Promise.all([...ctx.data].map((item, i) => {
        return def.type._parseAsync(new ParseInputLazyPath(ctx, item, ctx.path, i));
      })).then((result2) => {
        return ParseStatus.mergeArray(status, result2);
      });
    }
    const result = [...ctx.data].map((item, i) => {
      return def.type._parseSync(new ParseInputLazyPath(ctx, item, ctx.path, i));
    });
    return ParseStatus.mergeArray(status, result);
  }
  get element() {
    return this._def.type;
  }
  min(minLength, message) {
    return new _ZodArray({
      ...this._def,
      minLength: { value: minLength, message: errorUtil.toString(message) }
    });
  }
  max(maxLength, message) {
    return new _ZodArray({
      ...this._def,
      maxLength: { value: maxLength, message: errorUtil.toString(message) }
    });
  }
  length(len, message) {
    return new _ZodArray({
      ...this._def,
      exactLength: { value: len, message: errorUtil.toString(message) }
    });
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodArray.create = (schema, params) => {
  return new ZodArray({
    type: schema,
    minLength: null,
    maxLength: null,
    exactLength: null,
    typeName: ZodFirstPartyTypeKind.ZodArray,
    ...processCreateParams(params)
  });
};
function deepPartialify(schema) {
  if (schema instanceof ZodObject) {
    const newShape = {};
    for (const key in schema.shape) {
      const fieldSchema = schema.shape[key];
      newShape[key] = ZodOptional.create(deepPartialify(fieldSchema));
    }
    return new ZodObject({
      ...schema._def,
      shape: () => newShape
    });
  } else if (schema instanceof ZodArray) {
    return new ZodArray({
      ...schema._def,
      type: deepPartialify(schema.element)
    });
  } else if (schema instanceof ZodOptional) {
    return ZodOptional.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodNullable) {
    return ZodNullable.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodTuple) {
    return ZodTuple.create(schema.items.map((item) => deepPartialify(item)));
  } else {
    return schema;
  }
}
var ZodObject = class _ZodObject extends ZodType {
  constructor() {
    super(...arguments);
    this._cached = null;
    this.nonstrict = this.passthrough;
    this.augment = this.extend;
  }
  _getCached() {
    if (this._cached !== null)
      return this._cached;
    const shape = this._def.shape();
    const keys = util.objectKeys(shape);
    this._cached = { shape, keys };
    return this._cached;
  }
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.object) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const { status, ctx } = this._processInputParams(input);
    const { shape, keys: shapeKeys } = this._getCached();
    const extraKeys = [];
    if (!(this._def.catchall instanceof ZodNever && this._def.unknownKeys === "strip")) {
      for (const key in ctx.data) {
        if (!shapeKeys.includes(key)) {
          extraKeys.push(key);
        }
      }
    }
    const pairs = [];
    for (const key of shapeKeys) {
      const keyValidator = shape[key];
      const value = ctx.data[key];
      pairs.push({
        key: { status: "valid", value: key },
        value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (this._def.catchall instanceof ZodNever) {
      const unknownKeys = this._def.unknownKeys;
      if (unknownKeys === "passthrough") {
        for (const key of extraKeys) {
          pairs.push({
            key: { status: "valid", value: key },
            value: { status: "valid", value: ctx.data[key] }
          });
        }
      } else if (unknownKeys === "strict") {
        if (extraKeys.length > 0) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.unrecognized_keys,
            keys: extraKeys
          });
          status.dirty();
        }
      } else if (unknownKeys === "strip") {
      } else {
        throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
      }
    } else {
      const catchall = this._def.catchall;
      for (const key of extraKeys) {
        const value = ctx.data[key];
        pairs.push({
          key: { status: "valid", value: key },
          value: catchall._parse(
            new ParseInputLazyPath(ctx, value, ctx.path, key)
            //, ctx.child(key), value, getParsedType(value)
          ),
          alwaysSet: key in ctx.data
        });
      }
    }
    if (ctx.common.async) {
      return Promise.resolve().then(async () => {
        const syncPairs = [];
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          syncPairs.push({
            key,
            value,
            alwaysSet: pair.alwaysSet
          });
        }
        return syncPairs;
      }).then((syncPairs) => {
        return ParseStatus.mergeObjectSync(status, syncPairs);
      });
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get shape() {
    return this._def.shape();
  }
  strict(message) {
    errorUtil.errToObj;
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strict",
      ...message !== void 0 ? {
        errorMap: (issue, ctx) => {
          const defaultError = this._def.errorMap?.(issue, ctx).message ?? ctx.defaultError;
          if (issue.code === "unrecognized_keys")
            return {
              message: errorUtil.errToObj(message).message ?? defaultError
            };
          return {
            message: defaultError
          };
        }
      } : {}
    });
  }
  strip() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strip"
    });
  }
  passthrough() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "passthrough"
    });
  }
  // const AugmentFactory =
  //   <Def extends ZodObjectDef>(def: Def) =>
  //   <Augmentation extends ZodRawShape>(
  //     augmentation: Augmentation
  //   ): ZodObject<
  //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
  //     Def["unknownKeys"],
  //     Def["catchall"]
  //   > => {
  //     return new ZodObject({
  //       ...def,
  //       shape: () => ({
  //         ...def.shape(),
  //         ...augmentation,
  //       }),
  //     }) as any;
  //   };
  extend(augmentation) {
    return new _ZodObject({
      ...this._def,
      shape: () => ({
        ...this._def.shape(),
        ...augmentation
      })
    });
  }
  /**
   * Prior to zod@1.0.12 there was a bug in the
   * inferred type of merged objects. Please
   * upgrade if you are experiencing issues.
   */
  merge(merging) {
    const merged = new _ZodObject({
      unknownKeys: merging._def.unknownKeys,
      catchall: merging._def.catchall,
      shape: () => ({
        ...this._def.shape(),
        ...merging._def.shape()
      }),
      typeName: ZodFirstPartyTypeKind.ZodObject
    });
    return merged;
  }
  // merge<
  //   Incoming extends AnyZodObject,
  //   Augmentation extends Incoming["shape"],
  //   NewOutput extends {
  //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
  //       ? Augmentation[k]["_output"]
  //       : k extends keyof Output
  //       ? Output[k]
  //       : never;
  //   },
  //   NewInput extends {
  //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
  //       ? Augmentation[k]["_input"]
  //       : k extends keyof Input
  //       ? Input[k]
  //       : never;
  //   }
  // >(
  //   merging: Incoming
  // ): ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"],
  //   NewOutput,
  //   NewInput
  // > {
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  setKey(key, schema) {
    return this.augment({ [key]: schema });
  }
  // merge<Incoming extends AnyZodObject>(
  //   merging: Incoming
  // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
  // ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"]
  // > {
  //   // const mergedShape = objectUtil.mergeShapes(
  //   //   this._def.shape(),
  //   //   merging._def.shape()
  //   // );
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  catchall(index) {
    return new _ZodObject({
      ...this._def,
      catchall: index
    });
  }
  pick(mask) {
    const shape = {};
    for (const key of util.objectKeys(mask)) {
      if (mask[key] && this.shape[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  omit(mask) {
    const shape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (!mask[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  /**
   * @deprecated
   */
  deepPartial() {
    return deepPartialify(this);
  }
  partial(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      const fieldSchema = this.shape[key];
      if (mask && !mask[key]) {
        newShape[key] = fieldSchema;
      } else {
        newShape[key] = fieldSchema.optional();
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  required(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (mask && !mask[key]) {
        newShape[key] = this.shape[key];
      } else {
        const fieldSchema = this.shape[key];
        let newField = fieldSchema;
        while (newField instanceof ZodOptional) {
          newField = newField._def.innerType;
        }
        newShape[key] = newField;
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  keyof() {
    return createZodEnum(util.objectKeys(this.shape));
  }
};
ZodObject.create = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.strictCreate = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strict",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.lazycreate = (shape, params) => {
  return new ZodObject({
    shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
var ZodUnion = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const options = this._def.options;
    function handleResults(results) {
      for (const result of results) {
        if (result.result.status === "valid") {
          return result.result;
        }
      }
      for (const result of results) {
        if (result.result.status === "dirty") {
          ctx.common.issues.push(...result.ctx.common.issues);
          return result.result;
        }
      }
      const unionErrors = results.map((result) => new ZodError(result.ctx.common.issues));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return Promise.all(options.map(async (option) => {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        return {
          result: await option._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: childCtx
          }),
          ctx: childCtx
        };
      })).then(handleResults);
    } else {
      let dirty = void 0;
      const issues = [];
      for (const option of options) {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        const result = option._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: childCtx
        });
        if (result.status === "valid") {
          return result;
        } else if (result.status === "dirty" && !dirty) {
          dirty = { result, ctx: childCtx };
        }
        if (childCtx.common.issues.length) {
          issues.push(childCtx.common.issues);
        }
      }
      if (dirty) {
        ctx.common.issues.push(...dirty.ctx.common.issues);
        return dirty.result;
      }
      const unionErrors = issues.map((issues2) => new ZodError(issues2));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
  }
  get options() {
    return this._def.options;
  }
};
ZodUnion.create = (types, params) => {
  return new ZodUnion({
    options: types,
    typeName: ZodFirstPartyTypeKind.ZodUnion,
    ...processCreateParams(params)
  });
};
var getDiscriminator = (type) => {
  if (type instanceof ZodLazy) {
    return getDiscriminator(type.schema);
  } else if (type instanceof ZodEffects) {
    return getDiscriminator(type.innerType());
  } else if (type instanceof ZodLiteral) {
    return [type.value];
  } else if (type instanceof ZodEnum) {
    return type.options;
  } else if (type instanceof ZodNativeEnum) {
    return util.objectValues(type.enum);
  } else if (type instanceof ZodDefault) {
    return getDiscriminator(type._def.innerType);
  } else if (type instanceof ZodUndefined) {
    return [void 0];
  } else if (type instanceof ZodNull) {
    return [null];
  } else if (type instanceof ZodOptional) {
    return [void 0, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodNullable) {
    return [null, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodBranded) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodReadonly) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodCatch) {
    return getDiscriminator(type._def.innerType);
  } else {
    return [];
  }
};
var ZodDiscriminatedUnion = class _ZodDiscriminatedUnion extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const discriminator = this.discriminator;
    const discriminatorValue = ctx.data[discriminator];
    const option = this.optionsMap.get(discriminatorValue);
    if (!option) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union_discriminator,
        options: Array.from(this.optionsMap.keys()),
        path: [discriminator]
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return option._parseAsync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    } else {
      return option._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    }
  }
  get discriminator() {
    return this._def.discriminator;
  }
  get options() {
    return this._def.options;
  }
  get optionsMap() {
    return this._def.optionsMap;
  }
  /**
   * The constructor of the discriminated union schema. Its behaviour is very similar to that of the normal z.union() constructor.
   * However, it only allows a union of objects, all of which need to share a discriminator property. This property must
   * have a different value for each object in the union.
   * @param discriminator the name of the discriminator property
   * @param types an array of object schemas
   * @param params
   */
  static create(discriminator, options, params) {
    const optionsMap = /* @__PURE__ */ new Map();
    for (const type of options) {
      const discriminatorValues = getDiscriminator(type.shape[discriminator]);
      if (!discriminatorValues.length) {
        throw new Error(`A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`);
      }
      for (const value of discriminatorValues) {
        if (optionsMap.has(value)) {
          throw new Error(`Discriminator property ${String(discriminator)} has duplicate value ${String(value)}`);
        }
        optionsMap.set(value, type);
      }
    }
    return new _ZodDiscriminatedUnion({
      typeName: ZodFirstPartyTypeKind.ZodDiscriminatedUnion,
      discriminator,
      options,
      optionsMap,
      ...processCreateParams(params)
    });
  }
};
function mergeValues(a, b) {
  const aType = getParsedType(a);
  const bType = getParsedType(b);
  if (a === b) {
    return { valid: true, data: a };
  } else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
    const bKeys = util.objectKeys(b);
    const sharedKeys = util.objectKeys(a).filter((key) => bKeys.indexOf(key) !== -1);
    const newObj = { ...a, ...b };
    for (const key of sharedKeys) {
      const sharedValue = mergeValues(a[key], b[key]);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newObj[key] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  } else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
    if (a.length !== b.length) {
      return { valid: false };
    }
    const newArray = [];
    for (let index = 0; index < a.length; index++) {
      const itemA = a[index];
      const itemB = b[index];
      const sharedValue = mergeValues(itemA, itemB);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  } else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a === +b) {
    return { valid: true, data: a };
  } else {
    return { valid: false };
  }
}
var ZodIntersection = class extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const handleParsed = (parsedLeft, parsedRight) => {
      if (isAborted(parsedLeft) || isAborted(parsedRight)) {
        return INVALID;
      }
      const merged = mergeValues(parsedLeft.value, parsedRight.value);
      if (!merged.valid) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_intersection_types
        });
        return INVALID;
      }
      if (isDirty(parsedLeft) || isDirty(parsedRight)) {
        status.dirty();
      }
      return { status: status.value, value: merged.data };
    };
    if (ctx.common.async) {
      return Promise.all([
        this._def.left._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        }),
        this._def.right._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        })
      ]).then(([left, right]) => handleParsed(left, right));
    } else {
      return handleParsed(this._def.left._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }), this._def.right._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }));
    }
  }
};
ZodIntersection.create = (left, right, params) => {
  return new ZodIntersection({
    left,
    right,
    typeName: ZodFirstPartyTypeKind.ZodIntersection,
    ...processCreateParams(params)
  });
};
var ZodTuple = class _ZodTuple extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (ctx.data.length < this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_small,
        minimum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      return INVALID;
    }
    const rest = this._def.rest;
    if (!rest && ctx.data.length > this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_big,
        maximum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      status.dirty();
    }
    const items = [...ctx.data].map((item, itemIndex) => {
      const schema = this._def.items[itemIndex] || this._def.rest;
      if (!schema)
        return null;
      return schema._parse(new ParseInputLazyPath(ctx, item, ctx.path, itemIndex));
    }).filter((x) => !!x);
    if (ctx.common.async) {
      return Promise.all(items).then((results) => {
        return ParseStatus.mergeArray(status, results);
      });
    } else {
      return ParseStatus.mergeArray(status, items);
    }
  }
  get items() {
    return this._def.items;
  }
  rest(rest) {
    return new _ZodTuple({
      ...this._def,
      rest
    });
  }
};
ZodTuple.create = (schemas, params) => {
  if (!Array.isArray(schemas)) {
    throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
  }
  return new ZodTuple({
    items: schemas,
    typeName: ZodFirstPartyTypeKind.ZodTuple,
    rest: null,
    ...processCreateParams(params)
  });
};
var ZodRecord = class _ZodRecord extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const pairs = [];
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    for (const key in ctx.data) {
      pairs.push({
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, key)),
        value: valueType._parse(new ParseInputLazyPath(ctx, ctx.data[key], ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (ctx.common.async) {
      return ParseStatus.mergeObjectAsync(status, pairs);
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get element() {
    return this._def.valueType;
  }
  static create(first, second, third) {
    if (second instanceof ZodType) {
      return new _ZodRecord({
        keyType: first,
        valueType: second,
        typeName: ZodFirstPartyTypeKind.ZodRecord,
        ...processCreateParams(third)
      });
    }
    return new _ZodRecord({
      keyType: ZodString.create(),
      valueType: first,
      typeName: ZodFirstPartyTypeKind.ZodRecord,
      ...processCreateParams(second)
    });
  }
};
var ZodMap = class extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.map) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.map,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    const pairs = [...ctx.data.entries()].map(([key, value], index) => {
      return {
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, [index, "key"])),
        value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index, "value"]))
      };
    });
    if (ctx.common.async) {
      const finalMap = /* @__PURE__ */ new Map();
      return Promise.resolve().then(async () => {
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          if (key.status === "aborted" || value.status === "aborted") {
            return INVALID;
          }
          if (key.status === "dirty" || value.status === "dirty") {
            status.dirty();
          }
          finalMap.set(key.value, value.value);
        }
        return { status: status.value, value: finalMap };
      });
    } else {
      const finalMap = /* @__PURE__ */ new Map();
      for (const pair of pairs) {
        const key = pair.key;
        const value = pair.value;
        if (key.status === "aborted" || value.status === "aborted") {
          return INVALID;
        }
        if (key.status === "dirty" || value.status === "dirty") {
          status.dirty();
        }
        finalMap.set(key.value, value.value);
      }
      return { status: status.value, value: finalMap };
    }
  }
};
ZodMap.create = (keyType, valueType, params) => {
  return new ZodMap({
    valueType,
    keyType,
    typeName: ZodFirstPartyTypeKind.ZodMap,
    ...processCreateParams(params)
  });
};
var ZodSet = class _ZodSet extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.set) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.set,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const def = this._def;
    if (def.minSize !== null) {
      if (ctx.data.size < def.minSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.minSize.message
        });
        status.dirty();
      }
    }
    if (def.maxSize !== null) {
      if (ctx.data.size > def.maxSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.maxSize.message
        });
        status.dirty();
      }
    }
    const valueType = this._def.valueType;
    function finalizeSet(elements2) {
      const parsedSet = /* @__PURE__ */ new Set();
      for (const element of elements2) {
        if (element.status === "aborted")
          return INVALID;
        if (element.status === "dirty")
          status.dirty();
        parsedSet.add(element.value);
      }
      return { status: status.value, value: parsedSet };
    }
    const elements = [...ctx.data.values()].map((item, i) => valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i)));
    if (ctx.common.async) {
      return Promise.all(elements).then((elements2) => finalizeSet(elements2));
    } else {
      return finalizeSet(elements);
    }
  }
  min(minSize, message) {
    return new _ZodSet({
      ...this._def,
      minSize: { value: minSize, message: errorUtil.toString(message) }
    });
  }
  max(maxSize, message) {
    return new _ZodSet({
      ...this._def,
      maxSize: { value: maxSize, message: errorUtil.toString(message) }
    });
  }
  size(size, message) {
    return this.min(size, message).max(size, message);
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodSet.create = (valueType, params) => {
  return new ZodSet({
    valueType,
    minSize: null,
    maxSize: null,
    typeName: ZodFirstPartyTypeKind.ZodSet,
    ...processCreateParams(params)
  });
};
var ZodFunction = class _ZodFunction extends ZodType {
  constructor() {
    super(...arguments);
    this.validate = this.implement;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.function) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.function,
        received: ctx.parsedType
      });
      return INVALID;
    }
    function makeArgsIssue(args, error) {
      return makeIssue({
        data: args,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_arguments,
          argumentsError: error
        }
      });
    }
    function makeReturnsIssue(returns, error) {
      return makeIssue({
        data: returns,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_return_type,
          returnTypeError: error
        }
      });
    }
    const params = { errorMap: ctx.common.contextualErrorMap };
    const fn = ctx.data;
    if (this._def.returns instanceof ZodPromise) {
      const me = this;
      return OK(async function(...args) {
        const error = new ZodError([]);
        const parsedArgs = await me._def.args.parseAsync(args, params).catch((e) => {
          error.addIssue(makeArgsIssue(args, e));
          throw error;
        });
        const result = await Reflect.apply(fn, this, parsedArgs);
        const parsedReturns = await me._def.returns._def.type.parseAsync(result, params).catch((e) => {
          error.addIssue(makeReturnsIssue(result, e));
          throw error;
        });
        return parsedReturns;
      });
    } else {
      const me = this;
      return OK(function(...args) {
        const parsedArgs = me._def.args.safeParse(args, params);
        if (!parsedArgs.success) {
          throw new ZodError([makeArgsIssue(args, parsedArgs.error)]);
        }
        const result = Reflect.apply(fn, this, parsedArgs.data);
        const parsedReturns = me._def.returns.safeParse(result, params);
        if (!parsedReturns.success) {
          throw new ZodError([makeReturnsIssue(result, parsedReturns.error)]);
        }
        return parsedReturns.data;
      });
    }
  }
  parameters() {
    return this._def.args;
  }
  returnType() {
    return this._def.returns;
  }
  args(...items) {
    return new _ZodFunction({
      ...this._def,
      args: ZodTuple.create(items).rest(ZodUnknown.create())
    });
  }
  returns(returnType) {
    return new _ZodFunction({
      ...this._def,
      returns: returnType
    });
  }
  implement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  strictImplement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  static create(args, returns, params) {
    return new _ZodFunction({
      args: args ? args : ZodTuple.create([]).rest(ZodUnknown.create()),
      returns: returns || ZodUnknown.create(),
      typeName: ZodFirstPartyTypeKind.ZodFunction,
      ...processCreateParams(params)
    });
  }
};
var ZodLazy = class extends ZodType {
  get schema() {
    return this._def.getter();
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const lazySchema = this._def.getter();
    return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
  }
};
ZodLazy.create = (getter, params) => {
  return new ZodLazy({
    getter,
    typeName: ZodFirstPartyTypeKind.ZodLazy,
    ...processCreateParams(params)
  });
};
var ZodLiteral = class extends ZodType {
  _parse(input) {
    if (input.data !== this._def.value) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_literal,
        expected: this._def.value
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
  get value() {
    return this._def.value;
  }
};
ZodLiteral.create = (value, params) => {
  return new ZodLiteral({
    value,
    typeName: ZodFirstPartyTypeKind.ZodLiteral,
    ...processCreateParams(params)
  });
};
function createZodEnum(values, params) {
  return new ZodEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodEnum,
    ...processCreateParams(params)
  });
}
var ZodEnum = class _ZodEnum extends ZodType {
  _parse(input) {
    if (typeof input.data !== "string") {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(this._def.values);
    }
    if (!this._cache.has(input.data)) {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get options() {
    return this._def.values;
  }
  get enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Values() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  extract(values, newDef = this._def) {
    return _ZodEnum.create(values, {
      ...this._def,
      ...newDef
    });
  }
  exclude(values, newDef = this._def) {
    return _ZodEnum.create(this.options.filter((opt) => !values.includes(opt)), {
      ...this._def,
      ...newDef
    });
  }
};
ZodEnum.create = createZodEnum;
var ZodNativeEnum = class extends ZodType {
  _parse(input) {
    const nativeEnumValues = util.getValidEnumValues(this._def.values);
    const ctx = this._getOrReturnCtx(input);
    if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(util.getValidEnumValues(this._def.values));
    }
    if (!this._cache.has(input.data)) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get enum() {
    return this._def.values;
  }
};
ZodNativeEnum.create = (values, params) => {
  return new ZodNativeEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
    ...processCreateParams(params)
  });
};
var ZodPromise = class extends ZodType {
  unwrap() {
    return this._def.type;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.promise,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const promisified = ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data);
    return OK(promisified.then((data) => {
      return this._def.type.parseAsync(data, {
        path: ctx.path,
        errorMap: ctx.common.contextualErrorMap
      });
    }));
  }
};
ZodPromise.create = (schema, params) => {
  return new ZodPromise({
    type: schema,
    typeName: ZodFirstPartyTypeKind.ZodPromise,
    ...processCreateParams(params)
  });
};
var ZodEffects = class extends ZodType {
  innerType() {
    return this._def.schema;
  }
  sourceType() {
    return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const effect = this._def.effect || null;
    const checkCtx = {
      addIssue: (arg) => {
        addIssueToContext(ctx, arg);
        if (arg.fatal) {
          status.abort();
        } else {
          status.dirty();
        }
      },
      get path() {
        return ctx.path;
      }
    };
    checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
    if (effect.type === "preprocess") {
      const processed = effect.transform(ctx.data, checkCtx);
      if (ctx.common.async) {
        return Promise.resolve(processed).then(async (processed2) => {
          if (status.value === "aborted")
            return INVALID;
          const result = await this._def.schema._parseAsync({
            data: processed2,
            path: ctx.path,
            parent: ctx
          });
          if (result.status === "aborted")
            return INVALID;
          if (result.status === "dirty")
            return DIRTY(result.value);
          if (status.value === "dirty")
            return DIRTY(result.value);
          return result;
        });
      } else {
        if (status.value === "aborted")
          return INVALID;
        const result = this._def.schema._parseSync({
          data: processed,
          path: ctx.path,
          parent: ctx
        });
        if (result.status === "aborted")
          return INVALID;
        if (result.status === "dirty")
          return DIRTY(result.value);
        if (status.value === "dirty")
          return DIRTY(result.value);
        return result;
      }
    }
    if (effect.type === "refinement") {
      const executeRefinement = (acc) => {
        const result = effect.refinement(acc, checkCtx);
        if (ctx.common.async) {
          return Promise.resolve(result);
        }
        if (result instanceof Promise) {
          throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
        }
        return acc;
      };
      if (ctx.common.async === false) {
        const inner = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inner.status === "aborted")
          return INVALID;
        if (inner.status === "dirty")
          status.dirty();
        executeRefinement(inner.value);
        return { status: status.value, value: inner.value };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
          if (inner.status === "aborted")
            return INVALID;
          if (inner.status === "dirty")
            status.dirty();
          return executeRefinement(inner.value).then(() => {
            return { status: status.value, value: inner.value };
          });
        });
      }
    }
    if (effect.type === "transform") {
      if (ctx.common.async === false) {
        const base = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (!isValid(base))
          return INVALID;
        const result = effect.transform(base.value, checkCtx);
        if (result instanceof Promise) {
          throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
        }
        return { status: status.value, value: result };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base) => {
          if (!isValid(base))
            return INVALID;
          return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({
            status: status.value,
            value: result
          }));
        });
      }
    }
    util.assertNever(effect);
  }
};
ZodEffects.create = (schema, effect, params) => {
  return new ZodEffects({
    schema,
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    effect,
    ...processCreateParams(params)
  });
};
ZodEffects.createWithPreprocess = (preprocess, schema, params) => {
  return new ZodEffects({
    schema,
    effect: { type: "preprocess", transform: preprocess },
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    ...processCreateParams(params)
  });
};
var ZodOptional = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.undefined) {
      return OK(void 0);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodOptional.create = (type, params) => {
  return new ZodOptional({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodOptional,
    ...processCreateParams(params)
  });
};
var ZodNullable = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.null) {
      return OK(null);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodNullable.create = (type, params) => {
  return new ZodNullable({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodNullable,
    ...processCreateParams(params)
  });
};
var ZodDefault = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    let data = ctx.data;
    if (ctx.parsedType === ZodParsedType.undefined) {
      data = this._def.defaultValue();
    }
    return this._def.innerType._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  removeDefault() {
    return this._def.innerType;
  }
};
ZodDefault.create = (type, params) => {
  return new ZodDefault({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodDefault,
    defaultValue: typeof params.default === "function" ? params.default : () => params.default,
    ...processCreateParams(params)
  });
};
var ZodCatch = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const newCtx = {
      ...ctx,
      common: {
        ...ctx.common,
        issues: []
      }
    };
    const result = this._def.innerType._parse({
      data: newCtx.data,
      path: newCtx.path,
      parent: {
        ...newCtx
      }
    });
    if (isAsync(result)) {
      return result.then((result2) => {
        return {
          status: "valid",
          value: result2.status === "valid" ? result2.value : this._def.catchValue({
            get error() {
              return new ZodError(newCtx.common.issues);
            },
            input: newCtx.data
          })
        };
      });
    } else {
      return {
        status: "valid",
        value: result.status === "valid" ? result.value : this._def.catchValue({
          get error() {
            return new ZodError(newCtx.common.issues);
          },
          input: newCtx.data
        })
      };
    }
  }
  removeCatch() {
    return this._def.innerType;
  }
};
ZodCatch.create = (type, params) => {
  return new ZodCatch({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodCatch,
    catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
    ...processCreateParams(params)
  });
};
var ZodNaN = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.nan) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.nan,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
};
ZodNaN.create = (params) => {
  return new ZodNaN({
    typeName: ZodFirstPartyTypeKind.ZodNaN,
    ...processCreateParams(params)
  });
};
var BRAND = /* @__PURE__ */ Symbol("zod_brand");
var ZodBranded = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const data = ctx.data;
    return this._def.type._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  unwrap() {
    return this._def.type;
  }
};
var ZodPipeline = class _ZodPipeline extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.common.async) {
      const handleAsync = async () => {
        const inResult = await this._def.in._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inResult.status === "aborted")
          return INVALID;
        if (inResult.status === "dirty") {
          status.dirty();
          return DIRTY(inResult.value);
        } else {
          return this._def.out._parseAsync({
            data: inResult.value,
            path: ctx.path,
            parent: ctx
          });
        }
      };
      return handleAsync();
    } else {
      const inResult = this._def.in._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
      if (inResult.status === "aborted")
        return INVALID;
      if (inResult.status === "dirty") {
        status.dirty();
        return {
          status: "dirty",
          value: inResult.value
        };
      } else {
        return this._def.out._parseSync({
          data: inResult.value,
          path: ctx.path,
          parent: ctx
        });
      }
    }
  }
  static create(a, b) {
    return new _ZodPipeline({
      in: a,
      out: b,
      typeName: ZodFirstPartyTypeKind.ZodPipeline
    });
  }
};
var ZodReadonly = class extends ZodType {
  _parse(input) {
    const result = this._def.innerType._parse(input);
    const freeze = (data) => {
      if (isValid(data)) {
        data.value = Object.freeze(data.value);
      }
      return data;
    };
    return isAsync(result) ? result.then((data) => freeze(data)) : freeze(result);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodReadonly.create = (type, params) => {
  return new ZodReadonly({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodReadonly,
    ...processCreateParams(params)
  });
};
function cleanParams(params, data) {
  const p = typeof params === "function" ? params(data) : typeof params === "string" ? { message: params } : params;
  const p2 = typeof p === "string" ? { message: p } : p;
  return p2;
}
function custom(check, _params = {}, fatal) {
  if (check)
    return ZodAny.create().superRefine((data, ctx) => {
      const r = check(data);
      if (r instanceof Promise) {
        return r.then((r2) => {
          if (!r2) {
            const params = cleanParams(_params, data);
            const _fatal = params.fatal ?? fatal ?? true;
            ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
          }
        });
      }
      if (!r) {
        const params = cleanParams(_params, data);
        const _fatal = params.fatal ?? fatal ?? true;
        ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
      }
      return;
    });
  return ZodAny.create();
}
var late = {
  object: ZodObject.lazycreate
};
var ZodFirstPartyTypeKind;
(function(ZodFirstPartyTypeKind2) {
  ZodFirstPartyTypeKind2["ZodString"] = "ZodString";
  ZodFirstPartyTypeKind2["ZodNumber"] = "ZodNumber";
  ZodFirstPartyTypeKind2["ZodNaN"] = "ZodNaN";
  ZodFirstPartyTypeKind2["ZodBigInt"] = "ZodBigInt";
  ZodFirstPartyTypeKind2["ZodBoolean"] = "ZodBoolean";
  ZodFirstPartyTypeKind2["ZodDate"] = "ZodDate";
  ZodFirstPartyTypeKind2["ZodSymbol"] = "ZodSymbol";
  ZodFirstPartyTypeKind2["ZodUndefined"] = "ZodUndefined";
  ZodFirstPartyTypeKind2["ZodNull"] = "ZodNull";
  ZodFirstPartyTypeKind2["ZodAny"] = "ZodAny";
  ZodFirstPartyTypeKind2["ZodUnknown"] = "ZodUnknown";
  ZodFirstPartyTypeKind2["ZodNever"] = "ZodNever";
  ZodFirstPartyTypeKind2["ZodVoid"] = "ZodVoid";
  ZodFirstPartyTypeKind2["ZodArray"] = "ZodArray";
  ZodFirstPartyTypeKind2["ZodObject"] = "ZodObject";
  ZodFirstPartyTypeKind2["ZodUnion"] = "ZodUnion";
  ZodFirstPartyTypeKind2["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
  ZodFirstPartyTypeKind2["ZodIntersection"] = "ZodIntersection";
  ZodFirstPartyTypeKind2["ZodTuple"] = "ZodTuple";
  ZodFirstPartyTypeKind2["ZodRecord"] = "ZodRecord";
  ZodFirstPartyTypeKind2["ZodMap"] = "ZodMap";
  ZodFirstPartyTypeKind2["ZodSet"] = "ZodSet";
  ZodFirstPartyTypeKind2["ZodFunction"] = "ZodFunction";
  ZodFirstPartyTypeKind2["ZodLazy"] = "ZodLazy";
  ZodFirstPartyTypeKind2["ZodLiteral"] = "ZodLiteral";
  ZodFirstPartyTypeKind2["ZodEnum"] = "ZodEnum";
  ZodFirstPartyTypeKind2["ZodEffects"] = "ZodEffects";
  ZodFirstPartyTypeKind2["ZodNativeEnum"] = "ZodNativeEnum";
  ZodFirstPartyTypeKind2["ZodOptional"] = "ZodOptional";
  ZodFirstPartyTypeKind2["ZodNullable"] = "ZodNullable";
  ZodFirstPartyTypeKind2["ZodDefault"] = "ZodDefault";
  ZodFirstPartyTypeKind2["ZodCatch"] = "ZodCatch";
  ZodFirstPartyTypeKind2["ZodPromise"] = "ZodPromise";
  ZodFirstPartyTypeKind2["ZodBranded"] = "ZodBranded";
  ZodFirstPartyTypeKind2["ZodPipeline"] = "ZodPipeline";
  ZodFirstPartyTypeKind2["ZodReadonly"] = "ZodReadonly";
})(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
var instanceOfType = (cls, params = {
  message: `Input not instance of ${cls.name}`
}) => custom((data) => data instanceof cls, params);
var stringType = ZodString.create;
var numberType = ZodNumber.create;
var nanType = ZodNaN.create;
var bigIntType = ZodBigInt.create;
var booleanType = ZodBoolean.create;
var dateType = ZodDate.create;
var symbolType = ZodSymbol.create;
var undefinedType = ZodUndefined.create;
var nullType = ZodNull.create;
var anyType = ZodAny.create;
var unknownType = ZodUnknown.create;
var neverType = ZodNever.create;
var voidType = ZodVoid.create;
var arrayType = ZodArray.create;
var objectType = ZodObject.create;
var strictObjectType = ZodObject.strictCreate;
var unionType = ZodUnion.create;
var discriminatedUnionType = ZodDiscriminatedUnion.create;
var intersectionType = ZodIntersection.create;
var tupleType = ZodTuple.create;
var recordType = ZodRecord.create;
var mapType = ZodMap.create;
var setType = ZodSet.create;
var functionType = ZodFunction.create;
var lazyType = ZodLazy.create;
var literalType = ZodLiteral.create;
var enumType = ZodEnum.create;
var nativeEnumType = ZodNativeEnum.create;
var promiseType = ZodPromise.create;
var effectsType = ZodEffects.create;
var optionalType = ZodOptional.create;
var nullableType = ZodNullable.create;
var preprocessType = ZodEffects.createWithPreprocess;
var pipelineType = ZodPipeline.create;
var ostring = () => stringType().optional();
var onumber = () => numberType().optional();
var oboolean = () => booleanType().optional();
var coerce = {
  string: ((arg) => ZodString.create({ ...arg, coerce: true })),
  number: ((arg) => ZodNumber.create({ ...arg, coerce: true })),
  boolean: ((arg) => ZodBoolean.create({
    ...arg,
    coerce: true
  })),
  bigint: ((arg) => ZodBigInt.create({ ...arg, coerce: true })),
  date: ((arg) => ZodDate.create({ ...arg, coerce: true }))
};
var NEVER = INVALID;

// ../provenancekit-extensions/dist/index.mjs
var CONTRIB_NAMESPACE = "ext:contrib@1.0.0";
var ContribBasis = external_exports.enum(["points", "percentage", "absolute"]);
var ContribSource = external_exports.enum([
  "self-declared",
  // Contributor claimed it
  "agreed",
  // All parties agreed
  "calculated",
  // Algorithm (git blame, etc.)
  "verified",
  // Third-party verified
  "default"
  // System default
]);
var ContribExtension = external_exports.object({
  /** Weight value (interpretation depends on basis) */
  weight: external_exports.number().min(0),
  /** How to interpret weight. Default: "points" (basis points, 6000 = 60%) */
  basis: ContribBasis.default("points"),
  /** How this weight was determined */
  source: ContribSource.optional(),
  /** Who verified this contribution (Entity.id) */
  verifiedBy: external_exports.string().optional(),
  /** When the contribution was verified (ISO 8601) */
  verifiedAt: external_exports.string().datetime().optional(),
  /** Category of contribution (e.g., "code", "design", "concept") */
  category: external_exports.string().optional(),
  /** Human-readable note about the contribution */
  note: external_exports.string().optional()
});
function getContrib(attr) {
  const data = attr.extensions?.[CONTRIB_NAMESPACE];
  if (!data) return void 0;
  return ContribExtension.parse(data);
}
var LICENSE_NAMESPACE = "ext:license@1.0.0";
var LicenseExtension = external_exports.object({
  /** License identifier (SPDX or custom) */
  type: external_exports.string(),
  /** Commercial use allowed? */
  commercial: external_exports.boolean().optional(),
  /** Derivative works allowed? */
  derivatives: external_exports.boolean().optional(),
  /** ShareAlike required? */
  shareAlike: external_exports.boolean().optional(),
  /** Attribution requirement */
  attribution: external_exports.enum(["required", "requested", "none"]).optional(),
  /** Specific attribution text to use */
  attributionText: external_exports.string().optional(),
  /** URL to full license terms */
  termsUrl: external_exports.string().url().optional(),
  /** Geographic jurisdiction */
  jurisdiction: external_exports.string().optional(),
  /** License expiration date (ISO 8601) */
  expires: external_exports.string().datetime().optional(),
  /** Entity ID of who granted the rights (for per-entity grants on attributions) */
  grantedBy: external_exports.string().optional(),
  /** How rights were acquired: license, purchase, transfer, open, agreement */
  grantType: external_exports.enum(["license", "purchase", "transfer", "open", "agreement"]).optional(),
  /** Reference to a payment/purchase transaction backing this grant */
  transactionRef: external_exports.string().optional(),
  /**
   * Whether use of this work for AI training is permitted, reserved, or unspecified.
   *
   * - `"permitted"` — Rights holder explicitly allows AI training use
   * - `"reserved"` — Rights holder reserves this right; AI training is NOT permitted
   *   (machine-readable DSM Article 4(3) opt-out / EU AI Act Art. 53(1)(c))
   * - `"unspecified"` — No explicit position stated (default)
   *
   * @remarks
   * DSM Directive Art. 4(3) requires rightsholders to be able to reserve rights
   * for text and data mining "in an appropriate manner, such as machine-readable means".
   * Setting this field to "reserved" satisfies that requirement.
   *
   * @example
   * ```typescript
   * // Opt out of AI training
   * const resource = withLicense(res, {
   *   ...Licenses.CC_BY,
   *   aiTraining: "reserved",
   * });
   * ```
   */
  aiTraining: external_exports.enum(["permitted", "reserved", "unspecified"]).optional()
});
function getLicense(obj) {
  const data = obj.extensions?.[LICENSE_NAMESPACE];
  if (!data) return void 0;
  return LicenseExtension.parse(data);
}
var PaymentRecipient = external_exports.object({
  /** Payment address or identifier */
  address: external_exports.string(),
  /** Chain ID for on-chain payments */
  chainId: external_exports.number().optional(),
  /** Human-readable name (ENS, etc.) */
  name: external_exports.string().optional(),
  /** Network/protocol (e.g., "ethereum", "bitcoin", "lightning") */
  network: external_exports.string().optional()
});
var PaymentExtension = external_exports.object({
  /** Payment recipient */
  recipient: PaymentRecipient,
  /** Payment method (any string - use PAYMENT_METHODS for common ones) */
  method: external_exports.string().optional(),
  /** Currency/token identifier */
  currency: external_exports.string().optional(),
  /** Split in basis points (6000 = 60%) */
  splitBps: external_exports.number().min(0).max(1e4).optional(),
  /** Minimum amount to trigger payment */
  minAmount: external_exports.string().optional(),
  /** Method-specific configuration */
  config: external_exports.record(external_exports.unknown()).optional()
});
var ONCHAIN_NAMESPACE = "ext:onchain@1.0.0";
var OnchainExtension = external_exports.object({
  /** Chain ID (e.g., 8453 for Base, 1 for Ethereum) */
  chainId: external_exports.number(),
  /** Human-readable chain name */
  chainName: external_exports.string().optional(),
  /** Block number where the event was recorded */
  blockNumber: external_exports.number(),
  /** Block timestamp (ISO 8601) */
  blockTimestamp: external_exports.string().datetime().optional(),
  /** Transaction hash */
  transactionHash: external_exports.string(),
  /** Log index within the transaction */
  logIndex: external_exports.number().optional(),
  /** Contract address that emitted the event */
  contractAddress: external_exports.string().optional(),
  /** Whether the transaction is confirmed */
  confirmed: external_exports.boolean().optional(),
  /** Number of confirmations */
  confirmations: external_exports.number().optional()
});
function getOnchain(obj) {
  const data = obj.extensions?.[ONCHAIN_NAMESPACE];
  if (!data) return void 0;
  return OnchainExtension.parse(data);
}
var ReplicaStatus = external_exports.enum([
  "pending",
  // Upload in progress
  "active",
  // Successfully stored
  "failed",
  // Storage failed
  "expired"
  // Storage expired
]);
var StorageReplica = external_exports.object({
  /** Storage provider */
  provider: external_exports.string(),
  /** Replica status */
  status: ReplicaStatus,
  /** Geographic region (optional) */
  region: external_exports.string().optional(),
  /** When the storage expires (ISO 8601) */
  expiresAt: external_exports.string().datetime().optional(),
  /** Provider-specific metadata */
  metadata: external_exports.record(external_exports.unknown()).optional()
});
var StorageExtension = external_exports.object({
  /** Whether the content is pinned (for IPFS) */
  pinned: external_exports.boolean().optional(),
  /** Storage replicas across providers */
  replicas: external_exports.array(StorageReplica).optional(),
  /** Total size in bytes */
  totalSize: external_exports.number().optional(),
  /** Whether the content is encrypted */
  encrypted: external_exports.boolean().optional(),
  /** Content MIME type */
  contentType: external_exports.string().optional(),
  /** When storage was last verified (ISO 8601) */
  lastVerified: external_exports.string().datetime().optional(),
  /** Checksum for integrity verification */
  checksum: external_exports.string().optional()
});
var AI_NAMESPACE = "ext:ai@1.0.0";
var AIToolExtension = external_exports.object({
  /** AI provider */
  provider: external_exports.string(),
  /** Model identifier */
  model: external_exports.string(),
  /** Model version */
  version: external_exports.string().optional(),
  /** Hash of the prompt (privacy-preserving) */
  promptHash: external_exports.string().optional(),
  /** The actual prompt (if disclosure is acceptable) */
  prompt: external_exports.string().optional(),
  /** System prompt used */
  systemPrompt: external_exports.string().optional(),
  /** Model parameters (temperature, etc.) */
  parameters: external_exports.record(external_exports.unknown()).optional(),
  /** Tokens consumed */
  tokensUsed: external_exports.number().optional(),
  /** Generation time in milliseconds */
  generationTime: external_exports.number().optional(),
  /** Seed for reproducibility */
  seed: external_exports.number().optional()
});
var AIAgentExtension = external_exports.object({
  /** Underlying model powering this agent */
  model: external_exports.object({
    provider: external_exports.string(),
    model: external_exports.string(),
    version: external_exports.string().optional()
  }).optional(),
  /** Agent framework/orchestration system */
  framework: external_exports.string().optional(),
  /** Entity ID who delegated authority to this agent */
  delegatedBy: external_exports.string().optional(),
  /**
   * Level of autonomy:
   * - "full": Acts independently without human approval
   * - "supervised": Human monitors but doesn't approve each action
   * - "assisted": Human approves significant actions
   * - "tool": Effectively used as a tool (prefer AIToolExtension)
   */
  autonomyLevel: external_exports.string().optional(),
  /** Capabilities/permissions granted to this agent */
  capabilities: external_exports.array(external_exports.string()).optional(),
  /** Session/task ID for grouping collaborative work */
  sessionId: external_exports.string().optional(),
  /** Other agents this agent collaborates with (Entity IDs) */
  collaborators: external_exports.array(external_exports.string()).optional(),
  /** Role in multi-agent system (e.g., "coordinator", "specialist", "reviewer") */
  agentRole: external_exports.string().optional(),
  /** Agent-specific configuration */
  config: external_exports.record(external_exports.unknown()).optional()
});
function getAIExtension(obj) {
  return obj.extensions?.[AI_NAMESPACE];
}
function getAITool(action) {
  const ext = getAIExtension(action);
  if (!ext?.tool) return void 0;
  return AIToolExtension.parse(ext.tool);
}
function getAIAgent(entity) {
  const ext = getAIExtension(entity);
  if (!ext?.agent) return void 0;
  return AIAgentExtension.parse(ext.agent);
}
var ProofExtension = external_exports.object({
  /** Signing algorithm used */
  algorithm: external_exports.enum(["Ed25519", "ECDSA-secp256k1"]),
  /** Public key of the signer (hex-encoded) */
  publicKey: external_exports.string(),
  /** Signature bytes (hex-encoded) */
  signature: external_exports.string(),
  /** When the proof was created (ISO 8601) */
  timestamp: external_exports.string().datetime()
});
var IdentityProofExtension = external_exports.object({
  /** Method used to prove identity */
  method: external_exports.enum(["key-ownership", "did-auth", "custom"]),
  /** When the identity was verified (ISO 8601) */
  verifiedAt: external_exports.string().datetime(),
  /** Signature over the deterministic registration message (for key-ownership method) */
  registrationSignature: external_exports.string().optional()
});
var WITNESS_NAMESPACE = "ext:witness@1.0.0";
var EnvironmentAttestation = external_exports.object({
  /**
   * The attesting environment type.
   * Well-known: "intel-sgx" | "aws-nitro" | "marlin-oyster" | "amd-sev-snp" | "tpm"
   */
  type: external_exports.string(),
  /** Base64-encoded raw attestation document produced by the environment */
  report: external_exports.string(),
  /**
   * Environment-specific measurement values extracted from the report.
   * SGX: { mrenclave, mrsigner }
   * Nitro: { pcr0, pcr1, pcr2 }
   * TPM: { pcr0, pcr7, ... }
   */
  measurements: external_exports.record(external_exports.string()).optional(),
  /** Freshness nonce that was included when requesting the attestation */
  nonce: external_exports.string().optional()
});
var WitnessExtension = external_exports.object({
  /** Action ID that produced this output */
  actionId: external_exports.string(),
  /** The entity that performed the action */
  entityId: external_exports.string(),
  /** The output CID computed by the server */
  outputCid: external_exports.string(),
  /** SHA-256 hash of the entity's action proof, linking witness to intent */
  actionProofHash: external_exports.string(),
  /** Server's Ed25519 signature over the witness payload */
  serverSignature: external_exports.string(),
  /** Server's public key (hex-encoded) */
  serverPublicKey: external_exports.string(),
  /** When the witness attestation was created (ISO 8601) */
  timestamp: external_exports.string().datetime(),
  /**
   * Environment attestation report.
   * Present when the server ran inside a verifiable attested environment
   * (TEE, TPM, HSM, etc.). Upgrades the software witness to an environment-
   * attested witness — verifiers can independently check the report to confirm
   * the witness was produced by the expected, unmodified server code.
   */
  attestation: EnvironmentAttestation.optional()
});
function getWitness(obj) {
  const data = obj.extensions?.[WITNESS_NAMESPACE];
  if (!data) return void 0;
  return WitnessExtension.parse(data);
}
var ToolAttestationLevel = external_exports.enum([
  "provider-signed",
  "receipt-backed",
  "self-declared"
]);
var ProviderSignature = external_exports.object({
  /** Provider's public key (hex-encoded) */
  publicKey: external_exports.string(),
  /** Provider's signature (hex-encoded) */
  signature: external_exports.string(),
  /** Signing algorithm */
  algorithm: external_exports.enum(["Ed25519", "ECDSA-secp256k1"]),
  /** Hash of the signed payload (for transparency) */
  signedPayloadHash: external_exports.string()
});
var ToolReceipt = external_exports.object({
  /** Request ID from the API response */
  requestId: external_exports.string().optional(),
  /** Hash of the API response body */
  responseHash: external_exports.string().optional(),
  /** Relevant response headers (e.g., x-request-id, x-model-version) */
  headers: external_exports.record(external_exports.string()).optional(),
  /** Timestamp from the API response */
  responseTimestamp: external_exports.string().optional()
});
var ToolAttestationExtension = external_exports.object({
  /** Attestation trust level */
  level: ToolAttestationLevel,
  /** Provider's cryptographic signature (for provider-signed level) */
  providerSignature: ProviderSignature.optional(),
  /** API receipt evidence (for receipt-backed level) */
  receipt: ToolReceipt.optional(),
  /** Hash of the tool's output for comparison with the resource */
  outputHash: external_exports.string().optional()
});
var VERIFICATION_NAMESPACE = "ext:verification@1.0.0";
var ClaimStatus = external_exports.enum([
  "verified",
  "receipt-backed",
  "unverified",
  "failed",
  "skipped"
]);
var ClaimDetail = external_exports.object({
  /** Verification status for this claim */
  status: ClaimStatus,
  /** Human-readable detail about the verification */
  detail: external_exports.string().optional()
});
var VerificationExtension = external_exports.object({
  /** Overall verification status */
  status: external_exports.enum(["verified", "partial", "unverified", "skipped"]),
  /** Per-claim verification breakdown */
  claims: external_exports.object({
    /** Entity identity verification */
    identity: ClaimDetail,
    /** Action authorization verification */
    action: ClaimDetail,
    /** Output binding verification */
    output: ClaimDetail,
    /** Tool usage attestation (optional — only present if tool was declared) */
    tool: ClaimDetail.optional(),
    /** Input existence validation (optional — only present if inputs were declared) */
    inputs: ClaimDetail.optional(),
    /**
     * Environment attestation (optional — only present when server ran inside an
     * attested environment). "verified" means an attestation report was attached
     * to the witness. Verifiers should independently check the report in
     * ext:witness@1.0.0.attestation.
     */
    attestation: ClaimDetail.optional()
  }),
  /** When verification was performed (ISO 8601) */
  verifiedAt: external_exports.string().datetime(),
  /** The proof policy that was active during verification */
  policyUsed: external_exports.enum(["enforce", "warn", "off"])
});
function getVerification(obj) {
  const data = obj.extensions?.[VERIFICATION_NAMESPACE];
  if (!data) return void 0;
  return VerificationExtension.parse(data);
}
var MAX_SAFE_WEIGHT = Number.MAX_SAFE_INTEGER;
var AuthorizationStatus = external_exports.enum([
  "authorized",
  "unauthorized",
  "pending",
  "revoked"
]);
var AuthorizationExtension = external_exports.object({
  /**
   * Whether this use was explicitly authorised.
   * "unauthorized" is a valid and useful value — it records that a use
   * was NOT authorised, which is important for enforcement and audit trails.
   */
  status: AuthorizationStatus,
  /**
   * Entity ID of who granted the authorisation.
   * Should reference an Entity.id in the provenance bundle.
   * For self-authorisation, this is the same as the performing entity.
   */
  authorizedBy: external_exports.string().optional(),
  /**
   * When the authorisation was granted (ISO 8601 timestamp).
   */
  authorizedAt: external_exports.string().datetime().optional(),
  /**
   * When the authorisation expires (ISO 8601 timestamp).
   * Absence means no expiry. Use isAuthorized() to check current status.
   */
  expiresAt: external_exports.string().datetime().optional(),
  /**
   * Free-form reference to the authorisation instrument.
   * Examples:
   * - "contract:2025-license-001" — contract identifier
   * - "0xabc...def" — on-chain transaction hash
   * - "gdpr-consent:session-xyz" — consent record reference
   * - "purchase:stripe-pi-abc" — purchase confirmation
   */
  reference: external_exports.string().optional(),
  /**
   * Human-readable description of what was authorised and under what terms.
   * Keep concise. Full terms should be in a Resource or referenced via `reference`.
   */
  scope: external_exports.string().optional(),
  /**
   * Cryptographic proof of authorisation.
   * Can be a signature, on-chain transaction hash, or commitment hash.
   * Format is implementation-defined; recommended: "0x..." for EVM tx hashes,
   * base64 for signatures.
   */
  proof: external_exports.string().optional()
});
var OwnershipEvidenceType = external_exports.enum([
  "self-declaration",
  // No external proof — just a formal assertion
  "signed-content",
  // Claimant can produce a signature over the raw content bytes
  "external-timestamp",
  // Third-party timestamp (OpenTimestamps, RFC 3161, etc.)
  "legal-document",
  // Court order, registered copyright, contract
  "third-party-attestation"
  // Another entity vouches for this claimant
]);
var OwnershipClaimExtension = external_exports.object({
  /** Content reference of the resource being claimed */
  targetRef: external_exports.string(),
  /**
   * Type of evidence the claimant provides.
   * The system records this without validating it — resolution is external.
   */
  evidenceType: OwnershipEvidenceType,
  /**
   * Opaque reference to the evidence: a hash, URL, document ID, or any
   * string meaningful to the evidence type. Optional — a self-declaration
   * has no external reference by definition.
   */
  evidenceRef: external_exports.string().optional(),
  /** Human-readable note providing context for the claim */
  note: external_exports.string().optional()
});
var OwnershipTransferType = external_exports.enum([
  "voluntary",
  // The current owner willingly transferred ownership
  "authorized",
  // A system operator or trusted party authorized the transfer
  "adjudicated"
  // An external arbiter (court, DAO vote, etc.) resolved a dispute
]);
var OwnershipTransferExtension = external_exports.object({
  /** Content reference of the resource being transferred */
  targetRef: external_exports.string(),
  /** Entity ID of the previous owner at the time of this transfer */
  fromEntityId: external_exports.string(),
  /** Entity ID of the new owner after this transfer */
  toEntityId: external_exports.string(),
  /**
   * The authority under which this transfer is happening.
   * Does not affect system behaviour — informational for consumers.
   */
  transferType: OwnershipTransferType,
  /**
   * Optional reference linking this transfer to an authorizing event:
   * the Action ID of a prior claim, an external document hash, a legal ref, etc.
   */
  authorizationRef: external_exports.string().optional(),
  /** Human-readable note */
  note: external_exports.string().optional()
});
var X402Requirements = external_exports.object({
  /**
   * Payment amount as a human-readable decimal string.
   * Examples: "0.001", "1.50", "10"
   * Does NOT represent wei — use a standard unit (USDC = 6 decimals, ETH = 18).
   */
  amount: external_exports.string(),
  /**
   * Currency or token identifier.
   * Examples: "USDC", "ETH", "WETH", "DAI"
   */
  currency: external_exports.string(),
  /**
   * Human-readable network name.
   * Examples: "base", "base-sepolia", "arbitrum", "optimism"
   */
  network: external_exports.string(),
  /**
   * EVM chain ID for on-chain payment validation.
   * Examples: 8453 (Base), 84532 (Base Sepolia), 42161 (Arbitrum)
   */
  chainId: external_exports.number().int().positive(),
  /**
   * Payment recipient address.
   * Can be a direct wallet or a revenue-split contract (e.g., 0xSplits).
   * EIP-55 checksum is recommended but not enforced at this layer.
   */
  recipient: external_exports.string(),
  /**
   * Optional: contract address for revenue distribution.
   * If provided, payments to `recipient` are auto-split by this contract.
   */
  splitContract: external_exports.string().optional(),
  /**
   * Optional: expiry timestamp for these payment terms.
   * After this time the requirements may change (price update, etc.).
   * ISO 8601 datetime string.
   */
  expiresAt: external_exports.string().datetime().optional()
});
var X402Proof = external_exports.object({
  /**
   * Transaction hash of the payment on-chain.
   * This is the primary cryptographic proof of payment.
   */
  paymentTxHash: external_exports.string(),
  /**
   * Amount paid (decimal string, same unit as requirements).
   */
  amount: external_exports.string().optional(),
  /**
   * Currency paid.
   */
  currency: external_exports.string().optional(),
  /**
   * Chain ID where the payment was made.
   */
  chainId: external_exports.number().int().positive().optional(),
  /**
   * When payment was verified (ISO 8601).
   */
  paidAt: external_exports.string().datetime(),
  /**
   * Whether the payment has been independently verified on-chain.
   * false = recorded but not yet verified; true = verified
   */
  verified: external_exports.boolean().default(false),
  /**
   * The payer's address.
   */
  payer: external_exports.string().optional()
});
var X402Split = external_exports.object({
  /**
   * Revenue share in basis points (0–10000).
   * 10000 = 100%, 5000 = 50%, 250 = 2.5%
   */
  splitBps: external_exports.number().int().min(0).max(1e4),
  /**
   * The 0xSplits or other revenue-split contract address.
   * If set, on-chain payments to the contract auto-distribute.
   */
  splitContract: external_exports.string().optional(),
  /**
   * Chain ID for the split contract.
   */
  chainId: external_exports.number().int().positive().optional(),
  /**
   * Direct payment address for this contributor (alternative to splitContract).
   * Used when paying contributors directly without a split contract.
   */
  paymentAddress: external_exports.string().optional(),
  /**
   * Preferred currency for payouts.
   */
  currency: external_exports.string().optional()
});
var X402Extension = external_exports.object({
  /** Payment requirements (set on Resource) */
  requirements: X402Requirements.optional(),
  /** Payment proof (set on Action after payment verified) */
  proof: X402Proof.optional(),
  /** Revenue split configuration (set on Attribution) */
  split: X402Split.optional()
}).refine(
  (data) => data.requirements !== void 0 || data.proof !== void 0 || data.split !== void 0,
  { message: "At least one of requirements, proof, or split must be provided" }
);

// ../provenancekit-sdk/dist/index.mjs
var ProvenanceKitError = class _ProvenanceKitError extends Error {
  code;
  status;
  recovery;
  details;
  constructor(code, message, status, recovery, details) {
    super(message);
    this.code = code;
    this.status = status;
    this.recovery = recovery;
    this.details = details;
  }
  static fromResponse(status, body) {
    const { code, message, recovery, details } = body.error;
    return new _ProvenanceKitError(code, message, status, recovery, details);
  }
  toString() {
    return this.recovery ? `${this.message}. ${this.recovery}` : this.message;
  }
};
var Api = class {
  base;
  key;
  f;
  constructor(opts) {
    this.base = (opts.baseUrl ?? "https://api.provenancekit.com").replace(/\/$/, "");
    this.key = opts.apiKey;
    this.f = opts.fetchFn ?? fetch.bind(globalThis);
  }
  h(extra = {}) {
    return this.key ? { Authorization: `Bearer ${this.key}`, ...extra } : extra;
  }
  async parse(res) {
    const txt = await res.text();
    if (!res.ok) {
      let body;
      try {
        body = JSON.parse(txt);
      } catch {
      }
      if (body?.error) throw ProvenanceKitError.fromResponse(res.status, body);
      throw new ProvenanceKitError("Server", txt || res.statusText, res.status);
    }
    return txt ? JSON.parse(txt) : void 0;
  }
  get(path) {
    return this.f(`${this.base}${path}`, { headers: this.h() }).then(
      (r) => this.parse(r)
    );
  }
  postJSON(path, body) {
    return this.f(`${this.base}${path}`, {
      method: "POST",
      headers: this.h({ "Content-Type": "application/json" }),
      body: JSON.stringify(body)
    }).then((r) => this.parse(r));
  }
  postForm(path, form) {
    return this.f(`${this.base}${path}`, {
      method: "POST",
      headers: this.h(),
      body: form
    }).then((r) => this.parse(r));
  }
};
function decryptVector(blob, key) {
  const envelope = JSON.parse(blob);
  const { ciphertext, nonce, algorithm } = fromEnvelope(envelope);
  const plainBytes = decrypt(ciphertext, key, nonce, algorithm);
  return new Float32Array(plainBytes.buffer, plainBytes.byteOffset, plainBytes.byteLength / 4);
}
function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
function searchVectors(query, vectors, opts = {}) {
  const { topK = 5, minScore = 0, type } = opts;
  const scored = [];
  for (const entry of vectors) {
    if (type && entry.kind !== type) continue;
    const score = cosineSimilarity(query, entry.vec);
    if (score >= minScore) {
      scored.push({ ref: entry.ref, score });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}
function resolveKey(key) {
  if (key instanceof Uint8Array) return key;
  return fromBase64(key);
}
function mergeResults(server, encrypted, topK) {
  const seen = /* @__PURE__ */ new Set();
  const all = [];
  for (const r of [...server, ...encrypted]) {
    if (!seen.has(r.cid)) {
      seen.add(r.cid);
      all.push(r);
    }
  }
  all.sort((a, b) => b.score - a.score);
  return all.slice(0, topK);
}
function asBlob(input) {
  if (input instanceof Blob) return input;
  if (typeof Buffer !== "undefined" && input instanceof Buffer)
    return new Blob([input]);
  if (input instanceof Uint8Array) return new Blob([input]);
  throw new TypeError("Unsupported binary type");
}
var ProvenanceKit = class {
  api;
  projectId;
  signingKey;
  signingEntityId;
  chainAdapter;
  unclaimed = "ent:unclaimed";
  constructor(opts = {}) {
    this.api = new Api(opts);
    this.projectId = opts.projectId;
    this.signingKey = opts.signingKey;
    this.signingEntityId = opts.signingEntityId;
    this.chainAdapter = opts.chain;
    if (this.signingKey && !this.signingEntityId) {
      throw new Error("signingEntityId is required when signingKey is set");
    }
  }
  form(file, json) {
    const f = new FormData();
    f.append("file", asBlob(file), file.name ?? "file.bin");
    const base = typeof json === "object" && json !== null ? json : {};
    const payload = this.projectId ? { ...base, projectId: this.projectId } : base;
    f.append("json", JSON.stringify(payload));
    return f;
  }
  uploadAndMatch(file, o = {}) {
    const qs = `topK=${o.topK ?? 5}&min=${o.min ?? 0}${o.type ? `&type=${o.type}` : ""}`;
    const form = new FormData();
    form.append("file", asBlob(file), file.name ?? "file.bin");
    return this.api.postForm(`/search/file?${qs}`, form);
  }
  async file(file, opts) {
    let finalOpts = opts;
    if (this.signingKey && !opts.action?.actionProof) {
      const entityId = opts.entity.id ?? this.signingEntityId;
      const actionType = opts.action?.type ?? "create";
      const inputCids = opts.action?.inputCids ?? [];
      const timestamp = (/* @__PURE__ */ new Date()).toISOString();
      const payload = {
        entityId,
        actionType,
        inputs: inputCids,
        timestamp
      };
      const actionProof = await signAction(payload, this.signingKey);
      finalOpts = {
        ...opts,
        action: { ...opts.action, actionProof }
      };
    }
    try {
      const res = await this.api.postForm("/activity", this.form(file, finalOpts));
      const result = { ...res };
      if (this.chainAdapter) {
        try {
          const onchainResult = await this.chainAdapter.recordAction({
            actionType: finalOpts.action?.type ?? "create",
            inputs: finalOpts.action?.inputCids ?? [],
            outputs: [res.cid]
          });
          result.onchain = {
            txHash: onchainResult.txHash,
            actionId: onchainResult.actionId,
            chainId: this.chainAdapter.chainId,
            chainName: this.chainAdapter.chainName,
            contractAddress: this.chainAdapter.contractAddress
          };
        } catch {
        }
      }
      return result;
    } catch (e) {
      if (e instanceof ProvenanceKitError && e.code === "Duplicate") {
        const d = e.details;
        return {
          cid: d.cid,
          duplicate: d,
          matched: {
            cid: d.cid,
            score: d.similarity,
            type: opts.resourceType ?? "unknown"
          }
        };
      }
      throw e;
    }
  }
  graph(cid, depth = 10) {
    return this.api.get(`/graph/${cid}?depth=${depth}`);
  }
  async entity(e) {
    const r = await this.api.postJSON("/entity", e);
    return r.id;
  }
  /*─────────────────────────────────────────────────────────────*\
   | Session Provenance                                          |
   |                                                              |
   | Sessions are managed by the consuming app. Pass sessionId    |
   | when creating activities to link them. Query provenance      |
   | for a session using this method.                             |
  \*─────────────────────────────────────────────────────────────*/
  /*─────────────────────────────────────────────────────────────*\
   | Health                                                       |
  \*─────────────────────────────────────────────────────────────*/
  health() {
    return this.api.get("/");
  }
  /*─────────────────────────────────────────────────────────────*\
   | Entity Queries                                               |
  \*─────────────────────────────────────────────────────────────*/
  /**
   * Get a single entity by ID, including AI agent info if applicable.
   */
  getEntity(id) {
    return this.api.get(`/entity/${encodeURIComponent(id)}`);
  }
  /**
   * List entities with optional filtering by role and pagination.
   */
  listEntities(opts = {}) {
    const params = new URLSearchParams();
    if (opts.role) params.set("role", opts.role);
    if (opts.limit !== void 0) params.set("limit", String(opts.limit));
    if (opts.offset !== void 0) params.set("offset", String(opts.offset));
    const qs = params.toString();
    return this.api.get(`/entities${qs ? `?${qs}` : ""}`);
  }
  /**
   * Get AI agent extension data for an entity.
   * Throws if the entity is not an AI agent.
   */
  getAIAgent(id) {
    return this.api.get(`/entity/${encodeURIComponent(id)}/ai-agent`);
  }
  /*─────────────────────────────────────────────────────────────*\
   | Ownership                                                    |
  \*─────────────────────────────────────────────────────────────*/
  /**
   * Get the current ownership state and full history for a resource.
   */
  ownership(cid) {
    return this.api.get(`/resource/${cid}/ownership`);
  }
  /**
   * Record an ownership claim for a resource.
   * Does NOT change ownership state — trust level is conveyed via
   * ext:verification@1.0.0 on the returned action.
   */
  ownershipClaim(cid, opts) {
    return this.api.postJSON(
      `/resource/${cid}/ownership/claim`,
      opts
    );
  }
  /**
   * Transfer ownership of a resource to a new entity.
   * Always updates ownership state. The returned action carries
   * ext:verification@1.0.0 showing whether the transfer was authorized.
   */
  ownershipTransfer(cid, opts) {
    return this.api.postJSON(
      `/resource/${cid}/ownership/transfer`,
      opts
    );
  }
  /**
   * Get all provenance records linked to an app-managed session.
   * Returns actions, resources, entities, and attributions
   * that were created with the given sessionId.
   *
   * Scoped by projectId: uses the value set on this client instance,
   * or the project embedded in the API key when using dashboard-issued keys.
   */
  sessionProvenance(sessionId) {
    const qs = this.projectId ? `?projectId=${encodeURIComponent(this.projectId)}` : "";
    return this.api.get(`/session/${sessionId}/provenance${qs}`);
  }
  /*─────────────────────────────────────────────────────────────*\
   | Provenance Bundle & Chain                                    |
  \*─────────────────────────────────────────────────────────────*/
  /**
   * Get the full provenance bundle for a resource.
   * Includes resource, actions, entities, attributions, and lineage.
   */
  bundle(cid) {
    return this.api.get(`/bundle/${cid}`);
  }
  /**
   * Get the provenance chain for a resource.
   * Returns the same data as bundle() - alias for compatibility.
   */
  provenance(cid) {
    return this.api.get(`/provenance/${cid}`);
  }
  /**
   * Find resources similar to the given resource.
   */
  similar(cid, topK = 5) {
    return this.api.get(`/similar/${cid}?topK=${topK}`);
  }
  /*─────────────────────────────────────────────────────────────*\
   | Search                                                       |
  \*─────────────────────────────────────────────────────────────*/
  /**
   * Search for similar resources by text query.
   */
  searchText(query, opts = {}) {
    return this.api.postJSON("/search/text", {
      query,
      topK: opts.topK ?? 5,
      type: opts.type
    });
  }
  /**
   * Unified search across encrypted and non-encrypted resources.
   *
   * Non-encrypted resources: server-side pgvector similarity search (fast, scalable).
   * Encrypted resources: SDK fetches encrypted vector blobs from the server,
   * decrypts them locally with the provided key, runs brute-force cosine
   * similarity in-memory, and merges results with server-side matches.
   *
   * The server never sees plaintext vectors for encrypted resources.
   * Without an encryptionKey, only non-encrypted results are returned.
   */
  async search(query, opts = {}) {
    const { topK = 5, minScore = 0, type, encryptionKey } = opts;
    const serverPromise = this.api.postJSON("/search/text", {
      text: query,
      topK,
      minScore,
      type
    }).then(
      (r) => r.matches.map((m) => ({
        cid: m.cid,
        score: m.score,
        type: m.type,
        encrypted: false
      }))
    ).catch(() => []);
    let encryptedResults = [];
    if (encryptionKey) {
      try {
        encryptedResults = await this.searchEncryptedVectors(
          query,
          encryptionKey,
          { topK, minScore, type }
        );
      } catch {
      }
    }
    const serverResults = await serverPromise;
    return mergeResults(serverResults, encryptedResults, topK);
  }
  /**
   * Fetch encrypted vector blobs, decrypt locally, and run similarity search.
   * This is the client-side leg of the unified search — the server only
   * provides opaque encrypted blobs it cannot read.
   */
  async searchEncryptedVectors(query, encryptionKey, opts) {
    const key = resolveKey(encryptionKey);
    const qs = opts.type ? `&kind=${opts.type}` : "";
    const response = await this.api.get(`/embeddings/encrypted?limit=10000${qs}`);
    if (!response.embeddings.length) return [];
    const decrypted = [];
    for (const record of response.embeddings) {
      try {
        const vec = decryptVector(record.blob, key);
        decrypted.push({ ref: record.ref, vec, kind: record.kind });
      } catch {
      }
    }
    if (!decrypted.length) return [];
    const queryEmbedding = await this.api.postJSON(
      "/search/text/vector",
      { text: query }
    ).catch(() => null);
    if (!queryEmbedding?.vector) return [];
    const queryVec = new Float32Array(queryEmbedding.vector);
    const results = searchVectors(queryVec, decrypted, opts);
    return results.map((r) => ({
      cid: r.ref,
      score: r.score,
      type: opts.type,
      encrypted: true
    }));
  }
  /*─────────────────────────────────────────────────────────────*\
   | Distribution / Payments                                      |
  \*─────────────────────────────────────────────────────────────*/
  /**
   * Calculate payment distribution for a resource based on its attributions.
   */
  distribution(cid) {
    return this.api.get(`/distribution/${cid}`);
  }
  /**
   * Preview distribution for multiple resources.
   * Optionally combine them into a single distribution.
   */
  distributionPreview(cids, combine = false) {
    return this.api.postJSON("/distribution/preview", {
      cids,
      combine
    });
  }
  /*─────────────────────────────────────────────────────────────*\
   | Media / C2PA                                                 |
  \*─────────────────────────────────────────────────────────────*/
  /**
   * Get list of supported media formats for C2PA operations.
   */
  mediaFormats() {
    return this.api.get("/media/formats");
  }
  /**
   * Read C2PA manifest from a media file.
   */
  mediaRead(file) {
    const form = new FormData();
    form.append("file", asBlob(file), file.name ?? "file.bin");
    return this.api.postForm("/media/read", form);
  }
  /**
   * Verify C2PA manifest in a media file.
   */
  mediaVerify(file) {
    const form = new FormData();
    form.append("file", asBlob(file), file.name ?? "file.bin");
    return this.api.postForm("/media/verify", form);
  }
  /**
   * Import C2PA provenance from a media file as EAA records.
   */
  mediaImport(file, opts = {}) {
    const form = new FormData();
    form.append("file", asBlob(file), file.name ?? "file.bin");
    if (opts.sessionId) {
      form.append("sessionId", opts.sessionId);
    }
    return this.api.postForm("/media/import", form);
  }
  /**
   * Check if a resource was AI-generated based on C2PA or extension data.
   */
  aiCheck(cid) {
    return this.api.get(`/media/ai-check/${cid}`);
  }
};

// src/context/provenance-kit-provider.tsx
import { jsx } from "react/jsx-runtime";
var ProvenanceKitContext = createContext({ pk: null });
function themeToCssVars(theme) {
  const map = {
    "--pk-node-resource": theme.nodeResourceColor,
    "--pk-node-action": theme.nodeActionColor,
    "--pk-node-entity": theme.nodeEntityColor,
    "--pk-role-human": theme.roleHumanColor,
    "--pk-role-ai": theme.roleAiColor,
    "--pk-role-org": theme.roleOrgColor,
    "--pk-verified": theme.verifiedColor,
    "--pk-partial": theme.partialColor,
    "--pk-failed": theme.failedColor,
    "--pk-badge-bg": theme.badgeBg,
    "--pk-badge-fg": theme.badgeFg,
    "--pk-radius": theme.radius
  };
  const result = {};
  for (const [key, value] of Object.entries(map)) {
    if (value != null) result[key] = value;
  }
  return result;
}
function ProvenanceKitProvider({
  children,
  pk: pkProp,
  apiUrl,
  apiKey,
  theme
}) {
  const pk = useMemo(() => {
    if (pkProp) return pkProp;
    if (apiUrl) {
      return new ProvenanceKit({ baseUrl: apiUrl, apiKey });
    }
    return null;
  }, [pkProp, apiUrl, apiKey]);
  const style = theme ? themeToCssVars(theme) : void 0;
  return /* @__PURE__ */ jsx(ProvenanceKitContext.Provider, { value: { pk }, children: style ? /* @__PURE__ */ jsx("div", { style, children }) : children });
}
function useProvenanceKit() {
  return useContext(ProvenanceKitContext);
}

// src/hooks/use-provenance-graph.ts
import { useState, useEffect, useCallback } from "react";
function useProvenanceGraph(cid, options) {
  const { pk } = useProvenanceKit();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const enabled = options?.enabled !== false;
  const depth = options?.depth ?? 10;
  const fetchData = useCallback(async () => {
    if (!cid || !pk || !enabled) return;
    setLoading(true);
    setError(null);
    try {
      const result = await pk.graph(cid, depth);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [cid, pk, depth, enabled]);
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  return { data, loading, error, refetch: fetchData };
}

// src/hooks/use-provenance-bundle.ts
import { useState as useState2, useEffect as useEffect2, useCallback as useCallback2 } from "react";
function useProvenanceBundle(cid, options) {
  const { pk } = useProvenanceKit();
  const [data, setData] = useState2(null);
  const [loading, setLoading] = useState2(false);
  const [error, setError] = useState2(null);
  const enabled = options?.enabled !== false;
  const fetchData = useCallback2(async () => {
    if (!cid || !pk || !enabled) return;
    setLoading(true);
    setError(null);
    try {
      const result = await pk.bundle(cid);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [cid, pk, enabled]);
  useEffect2(() => {
    fetchData();
  }, [fetchData]);
  return { data, loading, error, refetch: fetchData };
}

// src/hooks/use-session-provenance.ts
import { useState as useState3, useEffect as useEffect3, useRef, useCallback as useCallback3 } from "react";
function useSessionProvenance(sessionId, options) {
  const { pk } = useProvenanceKit();
  const [data, setData] = useState3(null);
  const [loading, setLoading] = useState3(false);
  const [error, setError] = useState3(null);
  const intervalRef = useRef(null);
  const enabled = options?.enabled !== false;
  const pollInterval = options?.pollInterval;
  const fetchData = useCallback3(async () => {
    if (!sessionId || !pk || !enabled) return;
    setLoading(true);
    setError(null);
    try {
      const result = await pk.sessionProvenance(sessionId);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [sessionId, pk, enabled]);
  useEffect3(() => {
    fetchData();
  }, [fetchData]);
  useEffect3(() => {
    if (!pollInterval || pollInterval <= 0) return;
    intervalRef.current = setInterval(fetchData, pollInterval);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData, pollInterval]);
  return { data, loading, error, refetch: fetchData };
}

// src/hooks/use-distribution.ts
import { useState as useState4, useEffect as useEffect4, useCallback as useCallback4 } from "react";
function useDistribution(cid, options) {
  const { pk } = useProvenanceKit();
  const [data, setData] = useState4(null);
  const [loading, setLoading] = useState4(false);
  const [error, setError] = useState4(null);
  const enabled = options?.enabled !== false;
  const fetchData = useCallback4(async () => {
    if (!cid || !pk || !enabled) return;
    setLoading(true);
    setError(null);
    try {
      const result = await pk.distribution(cid);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [cid, pk, enabled]);
  useEffect4(() => {
    fetchData();
  }, [fetchData]);
  return { data, loading, error, refetch: fetchData };
}

// src/lib/utils.ts
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// src/lib/format.ts
function formatCid(cid, prefixLen = 6, suffixLen = 4) {
  if (!cid) return "";
  if (cid.length <= prefixLen + suffixLen + 3) return cid;
  return `${cid.slice(0, prefixLen)}...${cid.slice(-suffixLen)}`;
}
function formatDate(iso) {
  if (!iso) return "";
  try {
    const date = new Date(iso);
    const now = Date.now();
    const diff = now - date.getTime();
    const seconds = Math.floor(diff / 1e3);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);
    if (seconds < 60) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 30) return `${days}d ago`;
    if (months < 12) return `${months}mo ago`;
    return `${years}y ago`;
  } catch {
    return iso;
  }
}
function formatDateAbsolute(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(void 0, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return iso;
  }
}
function formatBps(bps) {
  if (bps == null) return "0%";
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 1)}%`;
}
function formatRole(role) {
  if (!role) return "Unknown";
  const clean3 = role.replace(/^ext:/, "").replace(/@[\d.]+$/, "");
  return clean3.charAt(0).toUpperCase() + clean3.slice(1);
}
function formatActionType(type) {
  if (!type) return "Unknown";
  const clean3 = type.replace(/^ext:/, "").replace(/@[\d.]+$/, "").replace(/[.:]/g, " ");
  return clean3.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}
function formatChainName(chainId) {
  if (chainId == null) return "Unknown chain";
  const names = {
    1: "Ethereum",
    10: "Optimism",
    137: "Polygon",
    8453: "Base",
    42161: "Arbitrum",
    84532: "Base Sepolia",
    11155111: "Sepolia"
  };
  return names[chainId] ?? `Chain ${chainId}`;
}
function formatTxHash(hash) {
  return formatCid(hash, 8, 6);
}
function formatBytes(bytes) {
  if (bytes == null || bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

// src/lib/extensions.ts
function getAIToolSafe(action) {
  if (!action) return null;
  try {
    return getAITool(action) ?? null;
  } catch {
    return null;
  }
}
function getAIAgentSafe(entity) {
  if (!entity) return null;
  try {
    return getAIAgent(entity) ?? null;
  } catch {
    return null;
  }
}
function getLicenseSafe(target) {
  if (!target) return null;
  try {
    return getLicense(target) ?? null;
  } catch {
    return null;
  }
}
function getContribSafe(attribution) {
  if (!attribution) return null;
  try {
    return getContrib(attribution) ?? null;
  } catch {
    return null;
  }
}
function getOnchainSafe(target) {
  if (!target) return null;
  try {
    return getOnchain(target) ?? null;
  } catch {
    return null;
  }
}
function getVerificationSafe(action) {
  if (!action) return null;
  try {
    return getVerification(action) ?? null;
  } catch {
    return null;
  }
}
function getWitnessSafe(action) {
  if (!action) return null;
  try {
    return getWitness(action) ?? null;
  } catch {
    return null;
  }
}
function bundleHasAI(actions) {
  return actions.some((a) => getAIToolSafe(a) !== null);
}
function getPrimaryCreator(attributions, entities) {
  const creatorAttr = attributions.find((a) => a.role === "creator") ?? attributions[0];
  if (!creatorAttr) return null;
  return entities.find((e) => e.id === creatorAttr.entityId) ?? null;
}

// src/components/primitives/entity-avatar.tsx
import { User, Bot, Building2 } from "lucide-react";
import { jsx as jsx2, jsxs } from "react/jsx-runtime";
var sizeMap = {
  xs: { px: 20, icon: 10 },
  sm: { px: 24, icon: 12 },
  md: { px: 32, icon: 14 },
  lg: { px: 40, icon: 18 }
};
var roleConfig = {
  human: { Icon: User, color: "var(--pk-role-human, #3b82f6)", bg: "rgba(59,130,246,0.12)", dot: "#3b82f6" },
  ai: { Icon: Bot, color: "var(--pk-role-ai, #7c3aed)", bg: "rgba(124,58,237,0.12)", dot: "#7c3aed" },
  organization: { Icon: Building2, color: "var(--pk-role-org, #22c55e)", bg: "rgba(34,197,94,0.12)", dot: "#22c55e" }
};
function initials(name) {
  if (!name) return "";
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}
function EntityAvatar({ role = "human", name, size = "md", className }) {
  const sz = sizeMap[size];
  const cfg = roleConfig[role] ?? roleConfig.human;
  const { Icon } = cfg;
  const init = initials(name);
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className,
      style: { position: "relative", display: "inline-flex", flexShrink: 0 },
      children: [
        /* @__PURE__ */ jsx2(
          "div",
          {
            style: {
              width: sz.px,
              height: sz.px,
              borderRadius: "50%",
              background: cfg.bg,
              border: `1.5px solid ${cfg.color}30`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: cfg.color
            },
            children: init ? /* @__PURE__ */ jsx2("span", { style: { fontSize: sz.icon - 2, fontWeight: 700, lineHeight: 1 }, children: init }) : /* @__PURE__ */ jsx2(Icon, { size: sz.icon, strokeWidth: 1.8 })
          }
        ),
        /* @__PURE__ */ jsx2(
          "span",
          {
            style: {
              position: "absolute",
              bottom: -1,
              right: -1,
              width: sz.icon * 0.55,
              height: sz.icon * 0.55,
              borderRadius: "50%",
              background: cfg.dot,
              border: "2px solid var(--pk-surface, #fff)",
              display: "block"
            }
          }
        )
      ]
    }
  );
}

// src/components/primitives/role-badge.tsx
import { jsx as jsx3 } from "react/jsx-runtime";
var roleStyles = {
  human: { bg: "rgba(59,130,246,0.1)", color: "#2563eb", border: "rgba(59,130,246,0.25)" },
  ai: { bg: "rgba(124,58,237,0.1)", color: "#7c3aed", border: "rgba(124,58,237,0.25)" },
  organization: { bg: "rgba(34,197,94,0.1)", color: "#16a34a", border: "rgba(34,197,94,0.25)" },
  creator: { bg: "rgba(59,130,246,0.1)", color: "#2563eb", border: "rgba(59,130,246,0.25)" },
  contributor: { bg: "rgba(124,58,237,0.1)", color: "#7c3aed", border: "rgba(124,58,237,0.25)" },
  source: { bg: "rgba(245,158,11,0.1)", color: "#d97706", border: "rgba(245,158,11,0.25)" }
};
var defaultStyle = { bg: "rgba(100,116,139,0.1)", color: "#64748b", border: "rgba(100,116,139,0.2)" };
function formatRole2(r) {
  return r.charAt(0).toUpperCase() + r.slice(1);
}
function RoleBadge({ role = "human", className }) {
  const s = roleStyles[role] ?? defaultStyle;
  return /* @__PURE__ */ jsx3(
    "span",
    {
      className,
      style: {
        display: "inline-flex",
        alignItems: "center",
        padding: "1px 8px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
        lineHeight: "1.6"
      },
      children: formatRole2(role)
    }
  );
}

// src/components/primitives/verification-indicator.tsx
import { ShieldCheck, ShieldAlert, ShieldOff, Shield } from "lucide-react";
import { jsx as jsx4, jsxs as jsxs2 } from "react/jsx-runtime";
var statusConfig = {
  verified: {
    Icon: ShieldCheck,
    label: "Verified",
    className: "text-[var(--pk-verified)]"
  },
  partial: {
    Icon: ShieldAlert,
    label: "Partially verified",
    className: "text-[var(--pk-partial)]"
  },
  unverified: {
    Icon: ShieldOff,
    label: "Unverified",
    className: "text-[var(--pk-unverified)]"
  },
  skipped: {
    Icon: Shield,
    label: "Skipped",
    className: "text-[var(--pk-unverified)]"
  },
  failed: {
    Icon: ShieldOff,
    label: "Failed",
    className: "text-[var(--pk-failed)]"
  }
};
function VerificationIndicator({
  status,
  showLabel = false,
  size = "md",
  className
}) {
  const cfg = statusConfig[status] ?? statusConfig.unverified;
  const { Icon } = cfg;
  const iconSize = size === "sm" ? 12 : 16;
  return /* @__PURE__ */ jsxs2(
    "span",
    {
      className: cn("inline-flex items-center gap-1", cfg.className, className),
      title: cfg.label,
      children: [
        /* @__PURE__ */ jsx4(Icon, { size: iconSize, strokeWidth: 2 }),
        showLabel && /* @__PURE__ */ jsx4("span", { className: "text-xs font-medium", children: cfg.label })
      ]
    }
  );
}

// src/components/primitives/license-chip.tsx
import { Scale, DollarSign, GitBranch, Share2 } from "lucide-react";
import { Fragment, jsx as jsx5, jsxs as jsxs3 } from "react/jsx-runtime";
function formatLicenseLabel(type) {
  const shorts = {
    "CC-BY-4.0": "CC BY",
    "CC-BY-SA-4.0": "CC BY-SA",
    "CC-BY-NC-4.0": "CC BY-NC",
    "CC-BY-NC-SA-4.0": "CC BY-NC-SA",
    "CC-BY-ND-4.0": "CC BY-ND",
    "CC0-1.0": "CC0",
    MIT: "MIT",
    "Apache-2.0": "Apache 2.0"
  };
  return shorts[type] ?? type;
}
function LicenseChip({
  license,
  spdxId,
  showIcons = true,
  className
}) {
  const licenseType = license?.type ?? spdxId;
  if (!licenseType) return null;
  const label = formatLicenseLabel(licenseType);
  const isPublicDomain = licenseType === "CC0-1.0" || licenseType === "CC0";
  return /* @__PURE__ */ jsxs3(
    "span",
    {
      className: cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
        "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200",
        "dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
        className
      ),
      title: `License: ${licenseType}${license?.termsUrl ? ` \u2014 ${license.termsUrl}` : ""}`,
      children: [
        /* @__PURE__ */ jsx5(Scale, { size: 10, strokeWidth: 2, className: "shrink-0" }),
        /* @__PURE__ */ jsx5("span", { children: label }),
        showIcons && !isPublicDomain && license && /* @__PURE__ */ jsxs3(Fragment, { children: [
          license.commercial === false && /* @__PURE__ */ jsx5("span", { title: "Non-commercial", children: /* @__PURE__ */ jsx5(DollarSign, { size: 10, strokeWidth: 2, className: "shrink-0 text-amber-500", "aria-label": "Non-commercial" }) }),
          license.derivatives === false && /* @__PURE__ */ jsx5("span", { title: "No derivatives", children: /* @__PURE__ */ jsx5(GitBranch, { size: 10, strokeWidth: 2, className: "shrink-0 text-amber-500", "aria-label": "No derivatives" }) }),
          license.shareAlike && /* @__PURE__ */ jsx5("span", { title: "Share alike required", children: /* @__PURE__ */ jsx5(Share2, { size: 10, strokeWidth: 2, className: "shrink-0 text-blue-500", "aria-label": "Share alike required" }) })
        ] })
      ]
    }
  );
}

// src/components/primitives/timestamp.tsx
import { useState as useState5 } from "react";
import { jsx as jsx6 } from "react/jsx-runtime";
function Timestamp({ iso, className }) {
  const [showAbsolute, setShowAbsolute] = useState5(false);
  if (!iso) return null;
  return /* @__PURE__ */ jsx6(
    "time",
    {
      dateTime: iso,
      className: cn("text-xs text-[var(--pk-muted-foreground)] cursor-default", className),
      title: formatDateAbsolute(iso),
      onMouseEnter: () => setShowAbsolute(true),
      onMouseLeave: () => setShowAbsolute(false),
      children: showAbsolute ? formatDateAbsolute(iso) : formatDate(iso)
    }
  );
}

// src/components/primitives/cid-display.tsx
import { useState as useState6 } from "react";
import { Copy, Check } from "lucide-react";
import { jsx as jsx7, jsxs as jsxs4 } from "react/jsx-runtime";
function CidDisplay({
  cid,
  prefixLen: prefixLenProp,
  suffixLen: suffixLenProp,
  short = false,
  showCopy = true,
  className
}) {
  const prefixLen = short ? 8 : prefixLenProp ?? 8;
  const suffixLen = short ? 4 : suffixLenProp ?? 6;
  const [copied, setCopied] = useState6(false);
  if (!cid) return null;
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(cid);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
    }
  };
  return /* @__PURE__ */ jsxs4("span", { className: cn("inline-flex items-center gap-1 group", className), children: [
    /* @__PURE__ */ jsx7(
      "span",
      {
        className: "font-mono text-xs text-[var(--pk-muted-foreground)] cursor-default",
        title: cid,
        children: formatCid(cid, prefixLen, suffixLen)
      }
    ),
    showCopy && /* @__PURE__ */ jsx7(
      "button",
      {
        type: "button",
        onClick: handleCopy,
        className: "opacity-0 group-hover:opacity-100 transition-opacity text-[var(--pk-muted-foreground)] hover:text-[var(--pk-foreground)]",
        title: "Copy CID",
        "aria-label": "Copy CID to clipboard",
        children: copied ? /* @__PURE__ */ jsx7(Check, { size: 11, strokeWidth: 2.5 }) : /* @__PURE__ */ jsx7(Copy, { size: 11, strokeWidth: 2 })
      }
    )
  ] });
}

// src/components/primitives/contribution-bar.tsx
import { jsx as jsx8, jsxs as jsxs5 } from "react/jsx-runtime";
function ContributionBar({ value, className }) {
  const pct = Math.min(100, Math.max(0, value * 100));
  return /* @__PURE__ */ jsxs5("div", { className, style: { display: "flex", alignItems: "center", gap: 8 }, children: [
    /* @__PURE__ */ jsx8(
      "div",
      {
        style: {
          flex: 1,
          height: 6,
          borderRadius: 999,
          background: "var(--pk-surface-border, #e2e8f0)",
          overflow: "hidden"
        },
        role: "progressbar",
        "aria-valuenow": pct,
        "aria-valuemin": 0,
        "aria-valuemax": 100,
        children: /* @__PURE__ */ jsx8(
          "div",
          {
            style: {
              width: `${pct}%`,
              height: "100%",
              borderRadius: 999,
              background: "var(--pk-node-resource, #3b82f6)",
              transition: "width 0.4s ease"
            }
          }
        )
      }
    ),
    /* @__PURE__ */ jsxs5(
      "span",
      {
        style: {
          fontSize: 12,
          fontWeight: 600,
          color: "var(--pk-foreground, #0f172a)",
          minWidth: 36,
          textAlign: "right",
          fontVariantNumeric: "tabular-nums"
        },
        children: [
          pct.toFixed(0),
          "%"
        ]
      }
    )
  ] });
}

// src/components/badge/provenance-badge.tsx
import React5 from "react";

// src/components/badge/provenance-popover.tsx
import React4 from "react";
import * as Popover from "@radix-ui/react-popover";
import { ExternalLink } from "lucide-react";
import { jsx as jsx9, jsxs as jsxs6 } from "react/jsx-runtime";
function formatProvider(provider) {
  const map = {
    "anthropic": "Anthropic",
    "openai": "OpenAI",
    "google": "Google",
    "black-forest-labs": "Black Forest Labs",
    "mistral": "Mistral",
    "meta": "Meta",
    "cohere": "Cohere",
    "stability-ai": "Stability AI"
  };
  return map[provider.toLowerCase()] ?? provider;
}
function getUniqueAITools(bundle) {
  const seen = /* @__PURE__ */ new Set();
  const tools = [];
  for (const action of bundle.actions) {
    const tool = getAIToolSafe(action);
    if (!tool) continue;
    const key = `${tool.provider}:${tool.model ?? ""}`;
    if (!seen.has(key)) {
      seen.add(key);
      tools.push(tool);
    }
  }
  return tools;
}
function findLicense(bundle) {
  for (let i = bundle.resources.length - 1; i >= 0; i--) {
    const lic = getLicenseSafe(bundle.resources[i]);
    if (lic) return lic;
  }
  return null;
}
function findVerification(bundle) {
  for (let i = bundle.actions.length - 1; i >= 0; i--) {
    const v = getVerificationSafe(bundle.actions[i]);
    if (v) return v;
  }
  return null;
}
function CredRow({ label, value }) {
  return /* @__PURE__ */ jsxs6("div", { style: { padding: "9px 0" }, children: [
    /* @__PURE__ */ jsx9("p", { style: { margin: "0 0 2px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#9ca3af" }, children: label }),
    /* @__PURE__ */ jsx9("div", { style: { fontSize: 13, fontWeight: 500, color: "#111827", lineHeight: 1.4 }, children: value })
  ] });
}
var Divider = () => /* @__PURE__ */ jsx9("div", { style: { height: 1, background: "#f3f4f6" } });
function ProvenancePopover({
  bundle,
  cid,
  children,
  side = "bottom",
  onViewDetail
}) {
  const creator = getPrimaryCreator(bundle.attributions, bundle.entities);
  const aiTools = getUniqueAITools(bundle);
  const license = findLicense(bundle);
  const verification = findVerification(bundle);
  const lastAction = bundle.actions[bundle.actions.length - 1];
  const otherContributors = bundle.entities.filter((e) => e.id !== creator?.id);
  const verifiedLabel = verification?.status === "verified" ? verification.policyUsed ?? "Verified" : verification?.status === "partial" ? "Partially verified" : null;
  const rows = [];
  if (lastAction?.timestamp) {
    rows.push({ label: "Date", value: /* @__PURE__ */ jsx9(Timestamp, { iso: lastAction.timestamp }) });
  }
  if (creator) {
    const suffix = otherContributors.length > 0 ? ` + ${otherContributors.length} more` : "";
    rows.push({ label: "Produced by", value: `${creator.name ?? creator.id}${suffix}` });
  }
  if (aiTools.length > 0) {
    rows.push({
      label: aiTools.length === 1 ? "AI tool used" : "AI tools used",
      value: /* @__PURE__ */ jsx9("div", { style: { display: "flex", flexDirection: "column", gap: 4 }, children: aiTools.map((t, i) => /* @__PURE__ */ jsxs6("span", { style: { display: "flex", alignItems: "center", gap: 5, fontSize: 13 }, children: [
        /* @__PURE__ */ jsx9(
          "span",
          {
            style: {
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#7c3aed",
              flexShrink: 0,
              display: "inline-block"
            }
          }
        ),
        /* @__PURE__ */ jsx9("span", { style: { fontWeight: 600 }, children: formatProvider(t.provider) }),
        t.model && /* @__PURE__ */ jsxs6("span", { style: { color: "#6b7280", fontWeight: 400 }, children: [
          "\xB7 ",
          t.model
        ] })
      ] }, i)) })
    });
  }
  if (license?.type) {
    rows.push({ label: "License", value: license.type });
  }
  if (verifiedLabel) {
    rows.push({ label: "Signed with", value: verifiedLabel });
  }
  return /* @__PURE__ */ jsxs6(Popover.Root, { children: [
    /* @__PURE__ */ jsx9(Popover.Trigger, { asChild: true, children }),
    /* @__PURE__ */ jsx9(Popover.Portal, { children: /* @__PURE__ */ jsxs6(
      Popover.Content,
      {
        side,
        align: "end",
        sideOffset: 10,
        style: {
          width: 296,
          background: "#fff",
          borderRadius: 14,
          boxShadow: "0 8px 40px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.06)",
          border: "1px solid rgba(0,0,0,0.08)",
          zIndex: 9999,
          overflow: "hidden",
          outline: "none"
        },
        children: [
          /* @__PURE__ */ jsx9("div", { style: { padding: "13px 16px 11px" }, children: /* @__PURE__ */ jsxs6("div", { style: { display: "flex", alignItems: "center", gap: 9 }, children: [
            /* @__PURE__ */ jsx9(
              "div",
              {
                style: {
                  width: 26,
                  height: 26,
                  borderRadius: "28%",
                  background: "#0f172a",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  boxShadow: "0 1px 4px rgba(0,0,0,0.25)"
                },
                children: /* @__PURE__ */ jsx9(
                  "span",
                  {
                    style: {
                      fontSize: 10,
                      fontWeight: 800,
                      lineHeight: 1,
                      letterSpacing: "-0.03em",
                      color: "#fff",
                      fontFamily: "var(--pk-badge-font-family, 'Red Hat Display', system-ui, sans-serif)"
                    },
                    children: "Pr"
                  }
                )
              }
            ),
            /* @__PURE__ */ jsxs6("div", { children: [
              /* @__PURE__ */ jsx9("p", { style: { margin: 0, fontSize: 14, fontWeight: 800, color: "#111827", lineHeight: 1.2 }, children: "Content Provenance" }),
              /* @__PURE__ */ jsxs6("p", { style: { margin: "2px 0 0", fontSize: 11, color: "#9ca3af", lineHeight: 1 }, children: [
                bundle.entities.length,
                " contributor",
                bundle.entities.length !== 1 ? "s" : "",
                " \xB7 ",
                bundle.actions.length,
                " action",
                bundle.actions.length !== 1 ? "s" : ""
              ] })
            ] })
          ] }) }),
          rows.length > 0 && /* @__PURE__ */ jsx9("div", { style: { padding: "0 16px", borderTop: "1px solid #f3f4f6" }, children: rows.map((row, i) => /* @__PURE__ */ jsxs6(React4.Fragment, { children: [
            /* @__PURE__ */ jsx9(CredRow, { label: row.label, value: row.value }),
            i < rows.length - 1 && /* @__PURE__ */ jsx9(Divider, {})
          ] }, row.label)) }),
          onViewDetail && /* @__PURE__ */ jsx9("div", { style: { padding: "10px 16px 14px", borderTop: "1px solid #f3f4f6" }, children: /* @__PURE__ */ jsxs6(
            "button",
            {
              type: "button",
              onClick: onViewDetail,
              style: {
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "8px 12px",
                borderRadius: 9,
                background: "#0f172a",
                color: "#fff",
                fontSize: 12,
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                letterSpacing: "0.01em"
              },
              children: [
                "View full provenance",
                /* @__PURE__ */ jsx9(ExternalLink, { size: 11, strokeWidth: 2.5 })
              ]
            }
          ) })
        ]
      }
    ) })
  ] });
}

// src/components/badge/provenance-badge.tsx
import { jsx as jsx10, jsxs as jsxs7 } from "react/jsx-runtime";
var positionStyles = {
  "top-left": { top: 7, left: 7 },
  "top-right": { top: 7, right: 7 },
  "bottom-left": { bottom: 7, left: 7 },
  "bottom-right": { bottom: 7, right: 7 }
};
var sizeConfig = {
  sm: { size: 22, fontSize: 9 },
  md: { size: 28, fontSize: 11 },
  lg: { size: 38, fontSize: 15 }
};
var PrSquircle = React5.forwardRef(function PrSquircle2({ size, style, onMouseEnter, onMouseLeave, ...divProps }, ref) {
  const cfg = sizeConfig[size];
  return /* @__PURE__ */ jsx10(
    "div",
    {
      ref,
      role: "button",
      tabIndex: 0,
      title: "View provenance",
      "aria-label": "View provenance information",
      ...divProps,
      style: {
        width: cfg.size,
        height: cfg.size,
        borderRadius: "28%",
        background: "var(--pk-badge-bg, #0f172a)",
        color: "var(--pk-badge-fg, #f8fafc)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        userSelect: "none",
        flexShrink: 0,
        boxShadow: "0 2px 10px rgba(0,0,0,0.3), 0 0 0 1.5px rgba(255,255,255,0.12)",
        transition: "opacity 0.15s",
        outline: "none",
        ...style
      },
      onMouseEnter: (e) => {
        e.currentTarget.style.opacity = "0.82";
        onMouseEnter?.(e);
      },
      onMouseLeave: (e) => {
        e.currentTarget.style.opacity = "1";
        onMouseLeave?.(e);
      },
      children: /* @__PURE__ */ jsx10(
        "span",
        {
          style: {
            fontSize: cfg.fontSize,
            fontWeight: 800,
            lineHeight: 1,
            letterSpacing: "-0.03em",
            fontFamily: "var(--pk-badge-font-family, var(--font-red-hat-display, 'Red Hat Display', system-ui, sans-serif))",
            color: "inherit",
            pointerEvents: "none",
            userSelect: "none"
          },
          children: "Pr"
        }
      )
    }
  );
});
function ProvenanceBadgeInner({
  cid,
  bundle: bundleProp,
  children,
  position = "bottom-right",
  size = "md",
  variant = "floating",
  popoverSide = "bottom",
  onViewDetail,
  loadingSlot,
  errorSlot,
  className
}) {
  const { data: fetchedBundle, loading, error } = useProvenanceBundle(
    bundleProp ? null : cid,
    { enabled: !bundleProp && !!cid }
  );
  const bundle = bundleProp ?? fetchedBundle;
  const containerStyle = {
    position: "relative",
    display: "inline-block",
    lineHeight: 0,
    verticalAlign: "top"
  };
  if (loading && !bundle) {
    const cfg = sizeConfig[size];
    return /* @__PURE__ */ jsxs7("div", { className, style: containerStyle, children: [
      children,
      loadingSlot ?? /* @__PURE__ */ jsx10(
        "div",
        {
          className: "animate-pulse",
          style: {
            position: "absolute",
            zIndex: 10,
            width: cfg.size,
            height: cfg.size,
            borderRadius: "28%",
            background: "rgba(0,0,0,0.18)",
            ...positionStyles[position]
          }
        }
      )
    ] });
  }
  if (error && !bundle) {
    return /* @__PURE__ */ jsxs7("div", { className, style: containerStyle, children: [
      children,
      errorSlot
    ] });
  }
  if (!bundle) {
    return /* @__PURE__ */ jsx10("div", { className, style: containerStyle, children });
  }
  if (variant === "inline") {
    return /* @__PURE__ */ jsxs7("span", { className: cn("inline-flex items-center gap-2", className), children: [
      children,
      /* @__PURE__ */ jsx10(ProvenancePopover, { bundle, cid, side: popoverSide, onViewDetail, children: /* @__PURE__ */ jsx10(PrSquircle, { size }) })
    ] });
  }
  return /* @__PURE__ */ jsxs7("div", { className, style: containerStyle, children: [
    children,
    /* @__PURE__ */ jsx10("div", { style: { position: "absolute", zIndex: 10, ...positionStyles[position] }, children: /* @__PURE__ */ jsx10(ProvenancePopover, { bundle, cid, side: popoverSide, onViewDetail, children: /* @__PURE__ */ jsx10(PrSquircle, { size }) }) })
  ] });
}
function ProvenanceBadge(props) {
  return /* @__PURE__ */ jsx10(ProvenanceBadgeInner, { ...props });
}

// src/components/graph/graph-rf-canvas.tsx
import { useMemo as useMemo2, useState as useState7, useEffect as useEffect5 } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  BackgroundVariant,
  ReactFlowProvider,
  MarkerType
} from "@xyflow/react";

// src/components/graph/graph-rf-nodes.tsx
import { Handle, Position } from "@xyflow/react";
import { Database, Zap, User as User2, Bot as Bot2, MapPin, Clock } from "lucide-react";
import { Fragment as Fragment2, jsx as jsx11, jsxs as jsxs8 } from "react/jsx-runtime";
function formatCid2(cid, head = 8, tail = 5) {
  if (!cid || cid.length <= head + tail + 3) return cid;
  return `${cid.slice(0, head)}\u2026${cid.slice(-tail)}`;
}
function formatBytes2(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
function formatActionType2(t) {
  return t.replace(/^ext:/, "").replace(/@[\d.]+$/, "").replace(/-/g, " ");
}
function formatDate2(iso) {
  try {
    return new Date(iso).toLocaleString(void 0, {
      dateStyle: "medium",
      timeStyle: "short"
    });
  } catch {
    return iso;
  }
}
function NodeCard({
  accentColor,
  accentBg,
  borderColor,
  children
}) {
  return /* @__PURE__ */ jsxs8(
    "div",
    {
      style: {
        minWidth: 200,
        maxWidth: 260,
        background: "var(--pk-graph-node-bg, #fff)",
        border: `1px solid ${borderColor}`,
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: "0 2px 12px rgba(0,0,0,0.08)"
      },
      children: [
        /* @__PURE__ */ jsx11("div", { style: { height: 3, background: accentColor } }),
        /* @__PURE__ */ jsx11(
          "div",
          {
            style: {
              background: accentBg,
              padding: "8px 12px 6px"
            },
            children
          }
        )
      ]
    }
  );
}
function ResourceNode({ data }) {
  const cid = data.cid ?? data.address?.ref;
  return /* @__PURE__ */ jsxs8(Fragment2, { children: [
    /* @__PURE__ */ jsx11(Handle, { type: "target", position: Position.Left, style: { background: "#3b82f6" } }),
    /* @__PURE__ */ jsxs8(
      NodeCard,
      {
        accentColor: "#3b82f6",
        accentBg: "rgba(59,130,246,0.08)",
        borderColor: "rgba(59,130,246,0.3)",
        children: [
          /* @__PURE__ */ jsxs8("div", { style: { display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }, children: [
            /* @__PURE__ */ jsx11(Database, { size: 13, color: "#3b82f6", strokeWidth: 2 }),
            /* @__PURE__ */ jsx11("span", { style: { fontWeight: 600, fontSize: 12, color: "var(--pk-graph-node-text, #111)" }, children: "Resource" })
          ] }),
          data.label && /* @__PURE__ */ jsx11("div", { style: { fontSize: 11, fontWeight: 500, marginBottom: 3, color: "var(--pk-graph-node-text, #111)" }, children: String(data.label) }),
          cid && /* @__PURE__ */ jsx11("div", { style: { fontFamily: "monospace", fontSize: 10, color: "var(--pk-graph-node-muted, #666)", wordBreak: "break-all" }, children: formatCid2(String(cid)) }),
          data.type && /* @__PURE__ */ jsx11("div", { style: { fontSize: 10, color: "var(--pk-graph-node-muted, #666)", marginTop: 2 }, children: String(data.type) }),
          data.size && /* @__PURE__ */ jsx11("div", { style: { fontSize: 10, color: "var(--pk-graph-node-muted, #666)" }, children: formatBytes2(Number(data.size)) }),
          data.locations?.[0]?.provider && /* @__PURE__ */ jsxs8("div", { style: { display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: "var(--pk-graph-node-muted, #666)", marginTop: 2 }, children: [
            /* @__PURE__ */ jsx11(MapPin, { size: 9 }),
            String(data.locations[0].provider)
          ] })
        ]
      }
    ),
    /* @__PURE__ */ jsx11(Handle, { type: "source", position: Position.Right, style: { background: "#3b82f6" } })
  ] });
}
function ActionNode({ data }) {
  const aiExt = data["ext:ai@1.0.0"];
  return /* @__PURE__ */ jsxs8(Fragment2, { children: [
    /* @__PURE__ */ jsx11(Handle, { type: "target", position: Position.Left, style: { background: "#22c55e" } }),
    /* @__PURE__ */ jsxs8(
      NodeCard,
      {
        accentColor: "#22c55e",
        accentBg: "rgba(34,197,94,0.08)",
        borderColor: "rgba(34,197,94,0.3)",
        children: [
          /* @__PURE__ */ jsxs8("div", { style: { display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }, children: [
            /* @__PURE__ */ jsx11(Zap, { size: 13, color: "#22c55e", strokeWidth: 2 }),
            /* @__PURE__ */ jsx11("span", { style: { fontWeight: 600, fontSize: 12, color: "var(--pk-graph-node-text, #111)" }, children: "Action" })
          ] }),
          data.label && /* @__PURE__ */ jsx11("div", { style: { fontSize: 11, fontWeight: 500, marginBottom: 3, color: "var(--pk-graph-node-text, #111)" }, children: String(data.label) }),
          data.type && /* @__PURE__ */ jsx11("div", { style: { fontSize: 10, color: "var(--pk-graph-node-muted, #666)", marginBottom: 2 }, children: formatActionType2(String(data.type)) }),
          data.timestamp && /* @__PURE__ */ jsxs8("div", { style: { display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: "var(--pk-graph-node-muted, #666)" }, children: [
            /* @__PURE__ */ jsx11(Clock, { size: 9 }),
            formatDate2(String(data.timestamp))
          ] }),
          aiExt && /* @__PURE__ */ jsxs8("div", { style: { display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: "#a855f7", marginTop: 2 }, children: [
            /* @__PURE__ */ jsx11(Bot2, { size: 9 }),
            aiExt.provider,
            " ",
            aiExt.model
          ] })
        ]
      }
    ),
    /* @__PURE__ */ jsx11(Handle, { type: "source", position: Position.Right, style: { background: "#22c55e" } })
  ] });
}
function EntityNode({ data }) {
  const isAI = data.role === "ai";
  return /* @__PURE__ */ jsxs8(Fragment2, { children: [
    /* @__PURE__ */ jsx11(Handle, { type: "target", position: Position.Left, style: { background: "#f59e0b" } }),
    /* @__PURE__ */ jsxs8(
      NodeCard,
      {
        accentColor: "#f59e0b",
        accentBg: "rgba(245,158,11,0.08)",
        borderColor: "rgba(245,158,11,0.3)",
        children: [
          /* @__PURE__ */ jsxs8("div", { style: { display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }, children: [
            isAI ? /* @__PURE__ */ jsx11(Bot2, { size: 13, color: "#f59e0b", strokeWidth: 2 }) : /* @__PURE__ */ jsx11(User2, { size: 13, color: "#f59e0b", strokeWidth: 2 }),
            /* @__PURE__ */ jsx11("span", { style: { fontWeight: 600, fontSize: 12, color: "var(--pk-graph-node-text, #111)" }, children: "Entity" })
          ] }),
          data.label && /* @__PURE__ */ jsx11("div", { style: { fontSize: 11, fontWeight: 500, marginBottom: 3, color: "var(--pk-graph-node-text, #111)" }, children: String(data.label) }),
          data.name && data.name !== data.label && /* @__PURE__ */ jsx11("div", { style: { fontSize: 10, color: "var(--pk-graph-node-text, #111)", fontWeight: 500 }, children: String(data.name) }),
          data.role && /* @__PURE__ */ jsx11("div", { style: { fontSize: 10, color: "var(--pk-graph-node-muted, #666)", textTransform: "capitalize", marginTop: 2 }, children: String(data.role) }),
          data.id && /* @__PURE__ */ jsx11("div", { style: { fontFamily: "monospace", fontSize: 10, color: "var(--pk-graph-node-muted, #666)", marginTop: 2, wordBreak: "break-all" }, children: formatCid2(String(data.id), 8, 4) })
        ]
      }
    ),
    /* @__PURE__ */ jsx11(Handle, { type: "source", position: Position.Right, style: { background: "#f59e0b" } })
  ] });
}
var nodeTypes = {
  resource: ResourceNode,
  action: ActionNode,
  entity: EntityNode
};

// src/components/graph/graph-rf-canvas.tsx
import { jsx as jsx12, jsxs as jsxs9 } from "react/jsx-runtime";
var NODE_WIDTH = 240;
var NODE_HEIGHT = 110;
var H_GAP = 80;
var V_GAP = 30;
function computeLayout(apiNodes, apiEdges) {
  if (apiNodes.length === 0) return [];
  const incoming = new Set(apiEdges.map((e) => e.to));
  const roots = apiNodes.filter((n) => !incoming.has(n.id));
  const levels = /* @__PURE__ */ new Map();
  const seeds = roots.length > 0 ? roots : apiNodes.slice(0, 1);
  const queue = seeds.map((n) => ({ id: n.id, level: 0 }));
  const seen = /* @__PURE__ */ new Set();
  while (queue.length) {
    const { id, level } = queue.shift();
    if (seen.has(id)) continue;
    seen.add(id);
    if (!levels.has(id) || levels.get(id) < level) levels.set(id, level);
    apiEdges.filter((e) => e.from === id).forEach((e) => queue.push({ id: e.to, level: level + 1 }));
  }
  apiNodes.forEach((n) => {
    if (!levels.has(n.id)) levels.set(n.id, 0);
  });
  const byLevel = /* @__PURE__ */ new Map();
  apiNodes.forEach((n) => {
    const l = levels.get(n.id) ?? 0;
    if (!byLevel.has(l)) byLevel.set(l, []);
    byLevel.get(l).push(n);
  });
  const nodes = [];
  byLevel.forEach((arr, level) => {
    const columnHeight = arr.length * NODE_HEIGHT + (arr.length - 1) * V_GAP;
    const startY = -columnHeight / 2;
    arr.forEach((n, idx) => {
      nodes.push({
        id: n.id,
        type: n.type,
        position: {
          x: level * (NODE_WIDTH + H_GAP),
          y: startY + idx * (NODE_HEIGHT + V_GAP)
        },
        data: { ...n.data, label: n.label }
      });
    });
  });
  return nodes;
}
var edgeColors = {
  produces: "#3b82f6",
  consumes: "#ef4444",
  performedBy: "#f59e0b",
  tool: "#a855f7"
};
function GraphRFCanvasInner({
  nodes: apiNodes,
  edges: apiEdges,
  height = 500,
  onNodeClick,
  className
}) {
  const rfNodes = useMemo2(() => computeLayout(apiNodes, apiEdges), [apiNodes, apiEdges]);
  const rfEdges = useMemo2(
    () => apiEdges.map((e, i) => ({
      id: `${e.from}-${e.to}-${i}`,
      source: e.from,
      target: e.to,
      label: e.type,
      type: "smoothstep",
      animated: e.type === "produces",
      style: { stroke: edgeColors[e.type] ?? "#94a3b8", strokeWidth: 2 },
      labelStyle: { fill: "#64748b", fontSize: 10 },
      labelBgStyle: { fill: "var(--pk-graph-node-bg, #fff)", fillOpacity: 0.85 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: edgeColors[e.type] ?? "#94a3b8"
      }
    })),
    [apiEdges]
  );
  return /* @__PURE__ */ jsx12(
    "div",
    {
      className,
      style: {
        height,
        borderRadius: 12,
        overflow: "hidden",
        border: "1px solid var(--pk-graph-control-border, #e2e8f0)",
        background: "var(--pk-graph-bg, #f8fafc)"
      },
      children: /* @__PURE__ */ jsxs9(
        ReactFlow,
        {
          nodes: rfNodes,
          edges: rfEdges,
          nodeTypes,
          fitView: true,
          fitViewOptions: { padding: 0.25, includeHiddenNodes: false },
          minZoom: 0.1,
          maxZoom: 4,
          panOnScroll: true,
          zoomOnScroll: true,
          zoomOnPinch: true,
          panOnDrag: true,
          proOptions: { hideAttribution: true },
          onNodeClick: (_, node) => {
            if (onNodeClick) {
              const apiNode = apiNodes.find((n) => n.id === node.id);
              if (apiNode) onNodeClick(apiNode);
            }
          },
          children: [
            /* @__PURE__ */ jsx12(
              Background,
              {
                variant: BackgroundVariant.Dots,
                gap: 24,
                size: 1.5,
                color: "var(--pk-graph-dot, #cbd5e1)"
              }
            ),
            /* @__PURE__ */ jsx12(
              Controls,
              {
                style: {
                  background: "var(--pk-graph-control-bg, rgba(255,255,255,0.92))",
                  border: "1px solid var(--pk-graph-control-border, #e2e8f0)",
                  borderRadius: 8,
                  color: "var(--pk-graph-control-text, #64748b)"
                }
              }
            )
          ]
        }
      )
    }
  );
}
function GraphRFCanvas(props) {
  const [mounted, setMounted] = useState7(false);
  useEffect5(() => {
    setMounted(true);
  }, []);
  if (!mounted) {
    return /* @__PURE__ */ jsx12(
      "div",
      {
        style: {
          height: props.height ?? 500,
          borderRadius: 12,
          background: "var(--pk-graph-bg, #f8fafc)",
          border: "1px solid var(--pk-graph-control-border, #e2e8f0)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        },
        children: /* @__PURE__ */ jsx12("span", { style: { fontSize: 13, color: "var(--pk-muted-foreground, #64748b)" }, children: "Loading graph\u2026" })
      }
    );
  }
  return /* @__PURE__ */ jsx12(ReactFlowProvider, { children: /* @__PURE__ */ jsx12(GraphRFCanvasInner, { ...props }) });
}

// src/components/graph/provenance-graph.tsx
import { Fragment as Fragment3, jsx as jsx13 } from "react/jsx-runtime";
function LoadingSkeleton({ height }) {
  return /* @__PURE__ */ jsx13(
    "div",
    {
      className: cn("rounded-xl animate-pulse"),
      style: {
        height,
        background: "var(--pk-surface-muted, #f8fafc)",
        border: "1px solid var(--pk-surface-border, #e2e8f0)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      },
      children: /* @__PURE__ */ jsx13("span", { style: { fontSize: 13, color: "var(--pk-muted-foreground, #64748b)" }, children: "Loading provenance graph\u2026" })
    }
  );
}
function ErrorDisplay({ message, height }) {
  return /* @__PURE__ */ jsx13(
    "div",
    {
      style: {
        height,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(239,68,68,0.05)",
        border: "1px solid rgba(239,68,68,0.2)",
        borderRadius: 12
      },
      children: /* @__PURE__ */ jsx13("span", { style: { fontSize: 13, color: "#ef4444" }, children: message })
    }
  );
}
function ProvenanceGraph({
  cid,
  depth,
  nodes: nodesProp,
  edges: edgesProp,
  height = 500,
  onNodeClick,
  loadingSlot,
  errorSlot,
  className
}) {
  const headlessMode = nodesProp !== void 0 && edgesProp !== void 0;
  const { data, loading, error } = useProvenanceGraph(headlessMode ? null : cid, {
    depth,
    enabled: !headlessMode && !!cid
  });
  const nodes = headlessMode ? nodesProp : data?.nodes ?? [];
  const edges = headlessMode ? edgesProp : data?.edges ?? [];
  if (!headlessMode && loading && !data) {
    return loadingSlot ? /* @__PURE__ */ jsx13(Fragment3, { children: loadingSlot }) : /* @__PURE__ */ jsx13(LoadingSkeleton, { height });
  }
  if (!headlessMode && error && !data) {
    return errorSlot ? /* @__PURE__ */ jsx13(Fragment3, { children: errorSlot }) : /* @__PURE__ */ jsx13(ErrorDisplay, { message: error.message, height });
  }
  if (nodes.length === 0) {
    return /* @__PURE__ */ jsx13(
      "div",
      {
        className,
        style: {
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--pk-surface-muted, #f8fafc)",
          border: "1px solid var(--pk-surface-border, #e2e8f0)",
          borderRadius: 12
        },
        children: /* @__PURE__ */ jsx13("span", { style: { fontSize: 13, color: "var(--pk-muted-foreground, #64748b)" }, children: "No provenance data available" })
      }
    );
  }
  return /* @__PURE__ */ jsx13(
    GraphRFCanvas,
    {
      nodes,
      edges,
      height,
      onNodeClick,
      className
    }
  );
}

// src/components/bundle/entity-card.tsx
import { User as User3, Bot as Bot3, Building2 as Building22 } from "lucide-react";
import { jsx as jsx14, jsxs as jsxs10 } from "react/jsx-runtime";
function formatCid3(cid, head = 8, tail = 5) {
  if (!cid || cid.length <= head + tail + 3) return cid;
  return `${cid.slice(0, head)}\u2026${cid.slice(-tail)}`;
}
var roleConfig2 = {
  human: { Icon: User3, color: "#3b82f6", bg: "rgba(59,130,246,0.1)", accent: "#3b82f6", accentBg: "rgba(59,130,246,0.08)", border: "rgba(59,130,246,0.2)" },
  ai: { Icon: Bot3, color: "#7c3aed", bg: "rgba(124,58,237,0.1)", accent: "#7c3aed", accentBg: "rgba(124,58,237,0.08)", border: "rgba(124,58,237,0.2)" },
  org: { Icon: Building22, color: "#22c55e", bg: "rgba(34,197,94,0.1)", accent: "#22c55e", accentBg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.2)" }
};
function EntityCard({ entity }) {
  const role = entity.role ?? "human";
  const cfg = role === "ai" ? roleConfig2.ai : role === "organization" ? roleConfig2.org : roleConfig2.human;
  return /* @__PURE__ */ jsxs10(
    "div",
    {
      style: {
        background: "#fff",
        border: `1px solid ${cfg.border}`,
        borderRadius: 12,
        overflow: "hidden",
        transition: "box-shadow 0.15s"
      },
      onMouseEnter: (e) => {
        e.currentTarget.style.boxShadow = `0 4px 16px ${cfg.accentBg}`;
      },
      onMouseLeave: (e) => {
        e.currentTarget.style.boxShadow = "none";
      },
      children: [
        /* @__PURE__ */ jsx14("div", { style: { height: 3, background: cfg.accent } }),
        /* @__PURE__ */ jsx14("div", { style: { padding: "14px 16px" }, children: /* @__PURE__ */ jsxs10("div", { style: { display: "flex", alignItems: "flex-start", gap: 12 }, children: [
          /* @__PURE__ */ jsx14("div", { style: { flexShrink: 0 }, children: /* @__PURE__ */ jsx14(EntityAvatar, { role: entity.role ?? "human", size: "md" }) }),
          /* @__PURE__ */ jsxs10("div", { style: { flex: 1, minWidth: 0 }, children: [
            entity.name && /* @__PURE__ */ jsx14("div", { style: { fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 3 }, children: entity.name }),
            /* @__PURE__ */ jsx14("div", { style: { marginBottom: entity.id ? 4 : 0 }, children: /* @__PURE__ */ jsx14(RoleBadge, { role: entity.role ?? "human" }) }),
            entity.id && /* @__PURE__ */ jsx14(
              "div",
              {
                style: {
                  fontFamily: "monospace",
                  fontSize: 10,
                  color: "#94a3b8",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 5,
                  padding: "2px 6px",
                  display: "inline-block",
                  marginTop: 4
                },
                children: formatCid3(entity.id)
              }
            )
          ] })
        ] }) })
      ]
    }
  );
}

// src/components/bundle/action-card.tsx
import { Zap as Zap2, Bot as Bot4, Clock as Clock2, Shield as Shield2 } from "lucide-react";
import { jsx as jsx15, jsxs as jsxs11 } from "react/jsx-runtime";
function formatActionType3(t) {
  return t.replace(/^ext:/, "").replace(/@[\d.]+$/, "").replace(/-/g, " ").replace(/\//g, " \xB7 ");
}
function ActionCard({ action }) {
  const aiTool = getAIToolSafe(action);
  const verification = getVerificationSafe(action);
  const isVerified = verification?.status === "verified";
  return /* @__PURE__ */ jsxs11(
    "div",
    {
      style: {
        background: "#fff",
        border: "1px solid rgba(34,197,94,0.2)",
        borderRadius: 12,
        overflow: "hidden",
        transition: "box-shadow 0.15s"
      },
      onMouseEnter: (e) => {
        e.currentTarget.style.boxShadow = "0 4px 16px rgba(34,197,94,0.1)";
      },
      onMouseLeave: (e) => {
        e.currentTarget.style.boxShadow = "none";
      },
      children: [
        /* @__PURE__ */ jsx15("div", { style: { height: 3, background: "#22c55e" } }),
        /* @__PURE__ */ jsx15("div", { style: { padding: "14px 16px" }, children: /* @__PURE__ */ jsxs11("div", { style: { display: "flex", alignItems: "flex-start", gap: 12 }, children: [
          /* @__PURE__ */ jsx15(
            "div",
            {
              style: {
                width: 36,
                height: 36,
                borderRadius: 9,
                background: "rgba(34,197,94,0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0
              },
              children: /* @__PURE__ */ jsx15(Zap2, { size: 16, color: "#22c55e", strokeWidth: 2 })
            }
          ),
          /* @__PURE__ */ jsxs11("div", { style: { flex: 1, minWidth: 0 }, children: [
            action.type && /* @__PURE__ */ jsx15(
              "div",
              {
                style: {
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#22c55e",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: 4
                },
                children: formatActionType3(action.type)
              }
            ),
            action.timestamp && /* @__PURE__ */ jsxs11("div", { style: { display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#64748b", marginBottom: 4 }, children: [
              /* @__PURE__ */ jsx15(Clock2, { size: 11, color: "#94a3b8" }),
              /* @__PURE__ */ jsx15(Timestamp, { iso: action.timestamp })
            ] }),
            aiTool && /* @__PURE__ */ jsxs11(
              "div",
              {
                style: {
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 11,
                  color: "#7c3aed",
                  background: "rgba(124,58,237,0.08)",
                  border: "1px solid rgba(124,58,237,0.2)",
                  borderRadius: 6,
                  padding: "2px 8px",
                  marginTop: 2
                },
                children: [
                  /* @__PURE__ */ jsx15(Bot4, { size: 10 }),
                  aiTool.provider,
                  aiTool.model ? ` \xB7 ${aiTool.model}` : ""
                ]
              }
            ),
            isVerified && /* @__PURE__ */ jsxs11(
              "div",
              {
                style: {
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 11,
                  color: "#059669",
                  background: "rgba(5,150,105,0.08)",
                  border: "1px solid rgba(5,150,105,0.2)",
                  borderRadius: 6,
                  padding: "2px 8px",
                  marginTop: 4,
                  marginLeft: aiTool ? 6 : 0
                },
                children: [
                  /* @__PURE__ */ jsx15(Shield2, { size: 10 }),
                  verification?.policyUsed ?? "Verified"
                ]
              }
            )
          ] })
        ] }) })
      ]
    }
  );
}

// src/components/bundle/resource-card.tsx
import { Database as Database2, MapPin as MapPin2, Hash as Hash3, ExternalLink as ExternalLink2 } from "lucide-react";
import { jsx as jsx16, jsxs as jsxs12 } from "react/jsx-runtime";
function ResourceCard({ resource }) {
  const cid = resource.address?.ref;
  const license = getLicenseSafe(resource);
  const location = resource.locations?.[0];
  return /* @__PURE__ */ jsxs12(
    "div",
    {
      style: {
        background: "#fff",
        border: "1px solid rgba(59,130,246,0.2)",
        borderRadius: 12,
        overflow: "hidden",
        transition: "box-shadow 0.15s"
      },
      onMouseEnter: (e) => {
        e.currentTarget.style.boxShadow = "0 4px 16px rgba(59,130,246,0.1)";
      },
      onMouseLeave: (e) => {
        e.currentTarget.style.boxShadow = "none";
      },
      children: [
        /* @__PURE__ */ jsx16("div", { style: { height: 3, background: "#3b82f6" } }),
        /* @__PURE__ */ jsx16("div", { style: { padding: "14px 16px" }, children: /* @__PURE__ */ jsxs12("div", { style: { display: "flex", alignItems: "flex-start", gap: 12 }, children: [
          /* @__PURE__ */ jsx16(
            "div",
            {
              style: {
                width: 36,
                height: 36,
                borderRadius: 9,
                background: "rgba(59,130,246,0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0
              },
              children: /* @__PURE__ */ jsx16(Database2, { size: 16, color: "#3b82f6", strokeWidth: 2 })
            }
          ),
          /* @__PURE__ */ jsxs12("div", { style: { flex: 1, minWidth: 0 }, children: [
            /* @__PURE__ */ jsxs12("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }, children: [
              resource.type && /* @__PURE__ */ jsx16(
                "span",
                {
                  style: {
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#3b82f6",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em"
                  },
                  children: resource.type
                }
              ),
              resource.size && /* @__PURE__ */ jsx16("span", { style: { fontSize: 11, color: "#94a3b8" }, children: resource.size < 1024 * 1024 ? `${(resource.size / 1024).toFixed(1)} KB` : `${(resource.size / 1024 / 1024).toFixed(1)} MB` }),
              license && /* @__PURE__ */ jsx16(LicenseChip, { license })
            ] }),
            cid && /* @__PURE__ */ jsxs12(
              "div",
              {
                style: {
                  fontFamily: "monospace",
                  fontSize: 11,
                  color: "#64748b",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 6,
                  padding: "3px 8px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  maxWidth: "100%",
                  marginBottom: 6
                },
                children: [
                  /* @__PURE__ */ jsx16(Hash3, { size: 9, color: "#94a3b8" }),
                  /* @__PURE__ */ jsx16("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: cid.length > 40 ? `${cid.slice(0, 20)}\u2026${cid.slice(-10)}` : cid })
                ]
              }
            ),
            location && /* @__PURE__ */ jsxs12("div", { style: { display: "flex", alignItems: "center", gap: 4, marginTop: 2 }, children: [
              /* @__PURE__ */ jsx16(MapPin2, { size: 11, color: "#94a3b8" }),
              /* @__PURE__ */ jsxs12("span", { style: { fontSize: 11, color: "#94a3b8" }, children: [
                location.provider,
                location.uri && /* @__PURE__ */ jsx16(
                  "a",
                  {
                    href: location.uri,
                    target: "_blank",
                    rel: "noopener noreferrer",
                    style: { color: "#3b82f6", marginLeft: 4, display: "inline-flex", alignItems: "center", gap: 2 },
                    children: /* @__PURE__ */ jsx16(ExternalLink2, { size: 9 })
                  }
                )
              ] })
            ] })
          ] })
        ] }) })
      ]
    }
  );
}

// src/components/bundle/attribution-list.tsx
import { jsx as jsx17, jsxs as jsxs13 } from "react/jsx-runtime";
function computeWeights(attrs) {
  const map = /* @__PURE__ */ new Map();
  const weights = attrs.map((a) => {
    const contrib = getContribSafe(a);
    if (contrib) {
      return contrib.basis === "percentage" ? contrib.weight : contrib.weight / 100;
    }
    return 1;
  });
  const total = weights.reduce((s, w) => s + w, 0);
  attrs.forEach((a, i) => {
    const id = a.entityId;
    const existing = map.get(id) ?? 0;
    map.set(id, existing + weights[i] / total);
  });
  return map;
}
function AttributionList({
  attributions,
  entities,
  showContribution
}) {
  const weights = showContribution ? computeWeights(attributions) : /* @__PURE__ */ new Map();
  const uniqueEntityIds = Array.from(new Set(attributions.map((a) => a.entityId)));
  return /* @__PURE__ */ jsx17("div", { style: { display: "flex", flexDirection: "column", gap: 8 }, children: uniqueEntityIds.map((entityId) => {
    const entity = entities.find((e) => e.id === entityId);
    if (!entity) return null;
    const pct = weights.get(entityId) ?? 0;
    return /* @__PURE__ */ jsxs13(
      "div",
      {
        style: {
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          transition: "box-shadow 0.15s"
        },
        onMouseEnter: (e) => {
          e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.06)";
        },
        onMouseLeave: (e) => {
          e.currentTarget.style.boxShadow = "none";
        },
        children: [
          /* @__PURE__ */ jsx17(EntityAvatar, { role: entity.role ?? "human", size: "md" }),
          /* @__PURE__ */ jsxs13("div", { style: { flex: 1, minWidth: 0 }, children: [
            /* @__PURE__ */ jsx17("div", { style: { fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 2 }, children: entity.name ?? String(entityId).slice(0, 16) + "\u2026" }),
            /* @__PURE__ */ jsx17(RoleBadge, { role: entity.role ?? "human" })
          ] }),
          showContribution && pct > 0 && /* @__PURE__ */ jsx17("div", { style: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, minWidth: 100 }, children: /* @__PURE__ */ jsx17(ContributionBar, { value: pct }) })
        ]
      },
      entityId
    );
  }) });
}

// src/components/bundle/provenance-bundle-view.tsx
import { useState as useState8 } from "react";
import { jsx as jsx18, jsxs as jsxs14 } from "react/jsx-runtime";
function TabButton({
  label,
  count,
  active,
  onClick
}) {
  return /* @__PURE__ */ jsxs14(
    "button",
    {
      type: "button",
      onClick,
      style: {
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 12px",
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 600,
        border: "none",
        cursor: "pointer",
        background: active ? "#111827" : "transparent",
        color: active ? "#fff" : "#64748b",
        transition: "background 0.15s, color 0.15s"
      },
      onMouseEnter: (e) => {
        if (!active) {
          e.currentTarget.style.background = "#f1f5f9";
          e.currentTarget.style.color = "#111827";
        }
      },
      onMouseLeave: (e) => {
        if (!active) {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "#64748b";
        }
      },
      children: [
        label,
        /* @__PURE__ */ jsx18(
          "span",
          {
            style: {
              fontSize: 10,
              fontWeight: 700,
              padding: "1px 6px",
              borderRadius: 99,
              background: active ? "rgba(255,255,255,0.2)" : "#f1f5f9",
              color: active ? "#fff" : "#94a3b8"
            },
            children: count
          }
        )
      ]
    }
  );
}
function BundleContent({
  bundle,
  showEntities,
  showActions,
  showResources,
  showAttributions,
  showGraph,
  graphHeight
}) {
  const tabs = [
    { id: "resources", label: "Resources", count: bundle.resources.length, enabled: !!showResources && bundle.resources.length > 0 },
    { id: "actions", label: "Actions", count: bundle.actions.length, enabled: !!showActions && bundle.actions.length > 0 },
    { id: "entities", label: "Entities", count: bundle.entities.length, enabled: !!showEntities && bundle.entities.length > 0 },
    { id: "attribution", label: "Attribution", count: bundle.attributions.length, enabled: !!showAttributions && bundle.attributions.length > 0 },
    { id: "graph", label: "Graph", count: bundle.resources.length + bundle.actions.length + bundle.entities.length, enabled: !!showGraph }
  ].filter((t) => t.enabled);
  const [activeTab, setActiveTab] = useState8(tabs[0]?.id ?? "resources");
  if (tabs.length === 0) return null;
  const resolvedTab = tabs.find((t) => t.id === activeTab) ? activeTab : tabs[0]?.id ?? "resources";
  return /* @__PURE__ */ jsxs14("div", { style: { display: "flex", flexDirection: "column", gap: 16 }, children: [
    tabs.length > 1 && /* @__PURE__ */ jsx18(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 2,
          padding: 4,
          borderRadius: 12,
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          flexWrap: "wrap"
        },
        children: tabs.map((tab) => /* @__PURE__ */ jsx18(
          TabButton,
          {
            label: tab.label,
            count: tab.count,
            active: resolvedTab === tab.id,
            onClick: () => setActiveTab(tab.id)
          },
          tab.id
        ))
      }
    ),
    /* @__PURE__ */ jsxs14("div", { children: [
      resolvedTab === "resources" && /* @__PURE__ */ jsx18("div", { style: { display: "flex", flexDirection: "column", gap: 8 }, children: bundle.resources.map((resource, i) => /* @__PURE__ */ jsx18(ResourceCard, { resource }, resource.address?.ref ?? i)) }),
      resolvedTab === "actions" && /* @__PURE__ */ jsx18("div", { style: { display: "flex", flexDirection: "column", gap: 8 }, children: bundle.actions.map((action, i) => /* @__PURE__ */ jsx18(ActionCard, { action }, action.id ?? i)) }),
      resolvedTab === "entities" && /* @__PURE__ */ jsx18("div", { style: { display: "flex", flexDirection: "column", gap: 8 }, children: bundle.entities.map((entity, i) => /* @__PURE__ */ jsx18(EntityCard, { entity }, entity.id ?? i)) }),
      resolvedTab === "attribution" && /* @__PURE__ */ jsx18(
        AttributionList,
        {
          attributions: bundle.attributions,
          entities: bundle.entities,
          showContribution: true
        }
      ),
      resolvedTab === "graph" && /* @__PURE__ */ jsx18(ProvenanceGraph, { nodes: [], edges: [], height: graphHeight ?? 500 })
    ] })
  ] });
}
function ProvenanceBundleView({
  cid,
  bundle: bundleProp,
  showEntities = true,
  showActions = true,
  showResources = true,
  showAttributions = true,
  showGraph = false,
  graphHeight,
  className
}) {
  const { data: fetchedBundle, loading, error } = useProvenanceBundle(
    bundleProp ? null : cid,
    { enabled: !bundleProp && !!cid }
  );
  const bundle = bundleProp ?? fetchedBundle;
  if (loading && !bundle) {
    return /* @__PURE__ */ jsx18("div", { className: cn("animate-pulse space-y-3", className), children: [1, 2, 3].map((i) => /* @__PURE__ */ jsx18(
      "div",
      {
        style: {
          height: 72,
          borderRadius: 12,
          background: "#f1f5f9"
        }
      },
      i
    )) });
  }
  if (error && !bundle) {
    return /* @__PURE__ */ jsx18(
      "div",
      {
        className: cn("rounded-xl p-4 text-sm", className),
        style: {
          background: "rgba(239,68,68,0.05)",
          border: "1px solid rgba(239,68,68,0.2)",
          color: "#ef4444"
        },
        children: error.message
      }
    );
  }
  if (!bundle) return null;
  return /* @__PURE__ */ jsx18("div", { className, children: /* @__PURE__ */ jsx18(
    BundleContent,
    {
      bundle,
      showEntities,
      showActions,
      showResources,
      showAttributions,
      showGraph,
      graphHeight
    }
  ) });
}

// src/components/tracker/provenance-tracker.tsx
import { useEffect as useEffect6, useRef as useRef2 } from "react";

// src/components/tracker/tracker-session-header.tsx
import { Zap as Zap3, Layers, Users } from "lucide-react";
import { jsx as jsx19, jsxs as jsxs15 } from "react/jsx-runtime";
function StatChip({ icon: Icon, value, label }) {
  return /* @__PURE__ */ jsxs15(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 5,
        padding: "4px 10px",
        borderRadius: 8,
        background: "var(--pk-surface, #fff)",
        border: "1px solid var(--pk-surface-border, #e2e8f0)",
        fontSize: 12,
        color: "var(--pk-foreground, #0f172a)"
      },
      children: [
        /* @__PURE__ */ jsx19(Icon, { size: 12, strokeWidth: 2, style: { color: "var(--pk-muted-foreground, #64748b)", flexShrink: 0 } }),
        /* @__PURE__ */ jsx19("span", { style: { fontWeight: 700 }, children: value }),
        /* @__PURE__ */ jsx19("span", { style: { color: "var(--pk-muted-foreground, #64748b)" }, children: label })
      ]
    }
  );
}
function TrackerSessionHeader({ session, className }) {
  const { summary } = session;
  return /* @__PURE__ */ jsxs15(
    "div",
    {
      className,
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 14px",
        borderRadius: 12,
        background: "var(--pk-surface-muted, #f8fafc)",
        border: "1px solid var(--pk-surface-border, #e2e8f0)",
        flexWrap: "wrap"
      },
      children: [
        /* @__PURE__ */ jsxs15("div", { style: { display: "flex", alignItems: "center", gap: 6, marginRight: 4 }, children: [
          /* @__PURE__ */ jsxs15("span", { style: { position: "relative", display: "inline-flex" }, children: [
            /* @__PURE__ */ jsx19(
              "span",
              {
                style: {
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  background: "#22c55e",
                  opacity: 0.35,
                  animation: "pk-ping 1.4s cubic-bezier(0,0,0.2,1) infinite"
                }
              }
            ),
            /* @__PURE__ */ jsx19(
              "span",
              {
                style: {
                  position: "relative",
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#22c55e",
                  display: "block"
                }
              }
            )
          ] }),
          /* @__PURE__ */ jsx19("span", { style: { fontSize: 12, fontWeight: 700, color: "#16a34a" }, children: "Live" })
        ] }),
        /* @__PURE__ */ jsxs15("div", { style: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }, children: [
          /* @__PURE__ */ jsx19(StatChip, { icon: Zap3, value: summary.actions, label: "actions" }),
          /* @__PURE__ */ jsx19(StatChip, { icon: Layers, value: summary.resources, label: "resources" }),
          /* @__PURE__ */ jsx19(StatChip, { icon: Users, value: summary.entities, label: "entities" })
        ] })
      ]
    }
  );
}

// src/components/tracker/tracker-action-item.tsx
import { Zap as Zap4, Bot as Bot5, Shield as Shield3 } from "lucide-react";
import { jsx as jsx20, jsxs as jsxs16 } from "react/jsx-runtime";
function formatActionType4(t) {
  return t.replace(/^ext:/, "").replace(/@[\d.]+$/, "").replace(/-/g, " ");
}
function TrackerActionItem({ action, isLatest, isLast, className }) {
  const aiTool = getAIToolSafe(action);
  const verification = getVerificationSafe(action);
  const isVerified = verification?.status === "verified";
  const dotColor = isLatest ? "#22c55e" : "var(--pk-surface-border, #e2e8f0)";
  const dotBorder = isLatest ? "#22c55e" : "var(--pk-surface-border, #e2e8f0)";
  return /* @__PURE__ */ jsxs16(
    "div",
    {
      className,
      style: { display: "flex", gap: 12, paddingBottom: isLast ? 0 : 0 },
      children: [
        /* @__PURE__ */ jsxs16("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", width: 24, flexShrink: 0 }, children: [
          /* @__PURE__ */ jsx20(
            "div",
            {
              style: {
                width: 24,
                height: 24,
                borderRadius: "50%",
                background: isLatest ? "rgba(34,197,94,0.12)" : "var(--pk-surface-muted, #f8fafc)",
                border: `2px solid ${dotBorder}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                zIndex: 1
              },
              children: /* @__PURE__ */ jsx20(
                Zap4,
                {
                  size: 11,
                  strokeWidth: 2.5,
                  style: { color: isLatest ? "#22c55e" : "var(--pk-muted-foreground, #94a3b8)" }
                }
              )
            }
          ),
          !isLast && /* @__PURE__ */ jsx20(
            "div",
            {
              style: {
                width: 1.5,
                flex: 1,
                background: "var(--pk-surface-border, #e2e8f0)",
                marginTop: 2,
                minHeight: 16
              }
            }
          )
        ] }),
        /* @__PURE__ */ jsxs16("div", { style: { flex: 1, paddingBottom: isLast ? 8 : 16, minWidth: 0 }, children: [
          /* @__PURE__ */ jsxs16("div", { style: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 4 }, children: [
            /* @__PURE__ */ jsx20(
              "span",
              {
                style: {
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--pk-foreground, #0f172a)",
                  textTransform: "capitalize"
                },
                children: formatActionType4(action.type)
              }
            ),
            isLatest && /* @__PURE__ */ jsx20(
              "span",
              {
                style: {
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "1px 6px",
                  borderRadius: 999,
                  background: "rgba(34,197,94,0.12)",
                  color: "#16a34a",
                  border: "1px solid rgba(34,197,94,0.3)"
                },
                children: "Latest"
              }
            ),
            aiTool && /* @__PURE__ */ jsxs16(
              "span",
              {
                style: {
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 11,
                  color: "#7c3aed",
                  background: "rgba(124,58,237,0.08)",
                  border: "1px solid rgba(124,58,237,0.2)",
                  borderRadius: 6,
                  padding: "1px 7px"
                },
                children: [
                  /* @__PURE__ */ jsx20(Bot5, { size: 9, strokeWidth: 2 }),
                  aiTool.provider,
                  aiTool.model ? ` \xB7 ${aiTool.model}` : ""
                ]
              }
            ),
            isVerified && /* @__PURE__ */ jsxs16(
              "span",
              {
                style: {
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 11,
                  color: "#059669",
                  background: "rgba(5,150,105,0.08)",
                  border: "1px solid rgba(5,150,105,0.2)",
                  borderRadius: 6,
                  padding: "1px 7px"
                },
                children: [
                  /* @__PURE__ */ jsx20(Shield3, { size: 9, strokeWidth: 2 }),
                  "Verified"
                ]
              }
            )
          ] }),
          /* @__PURE__ */ jsxs16("div", { style: { fontSize: 11, color: "var(--pk-muted-foreground, #64748b)" }, children: [
            /* @__PURE__ */ jsx20(Timestamp, { iso: action.timestamp }),
            action.outputs.length > 0 && /* @__PURE__ */ jsxs16("span", { style: { marginLeft: 8 }, children: [
              "\u2192 ",
              action.outputs.length,
              " output",
              action.outputs.length !== 1 ? "s" : ""
            ] })
          ] })
        ] })
      ]
    }
  );
}

// src/components/tracker/provenance-tracker.tsx
import { jsx as jsx21, jsxs as jsxs17 } from "react/jsx-runtime";
function ProvenanceTracker({
  sessionId,
  pollInterval = 3e3,
  session: sessionProp,
  maxActions = 20,
  onNewAction,
  className
}) {
  const headless = !!sessionProp;
  const { data: fetchedSession, loading, error } = useSessionProvenance(
    headless ? null : sessionId,
    { enabled: !headless && !!sessionId, pollInterval }
  );
  const session = sessionProp ?? fetchedSession;
  const prevActionCount = useRef2(0);
  useEffect6(() => {
    if (!session) return;
    const newCount = session.actions.length;
    if (newCount > prevActionCount.current && onNewAction) {
      const newActions = session.actions.slice(prevActionCount.current);
      newActions.forEach(onNewAction);
    }
    prevActionCount.current = newCount;
  }, [session, onNewAction]);
  if (!session && loading) {
    return /* @__PURE__ */ jsx21("div", { style: { display: "flex", flexDirection: "column", gap: 8 }, className, children: [1, 2, 3, 4].map((i) => /* @__PURE__ */ jsx21(
      "div",
      {
        style: {
          height: i === 1 ? 48 : 56,
          borderRadius: 12,
          background: "var(--pk-surface-muted, #f8fafc)",
          animation: "pulse 1.5s ease-in-out infinite"
        }
      },
      i
    )) });
  }
  if (!session && error) {
    return /* @__PURE__ */ jsx21(
      "div",
      {
        className,
        style: {
          borderRadius: 12,
          border: "1px solid rgba(220,38,38,0.3)",
          background: "rgba(220,38,38,0.05)",
          padding: "12px 14px",
          fontSize: 13,
          color: "#dc2626"
        },
        children: error.message
      }
    );
  }
  if (!session) {
    return /* @__PURE__ */ jsx21(
      "div",
      {
        className,
        style: {
          borderRadius: 12,
          border: "1px solid var(--pk-surface-border, #e2e8f0)",
          padding: "24px",
          textAlign: "center",
          fontSize: 14,
          color: "var(--pk-muted-foreground, #64748b)"
        },
        children: "No session data"
      }
    );
  }
  const actions = [...session.actions].reverse().slice(0, maxActions);
  return /* @__PURE__ */ jsxs17("div", { style: { display: "flex", flexDirection: "column", gap: 12 }, className, children: [
    /* @__PURE__ */ jsx21(TrackerSessionHeader, { session }),
    actions.length === 0 ? /* @__PURE__ */ jsx21(
      "div",
      {
        style: {
          borderRadius: 12,
          border: "1px solid var(--pk-surface-border, #e2e8f0)",
          padding: "24px",
          textAlign: "center",
          fontSize: 14,
          color: "var(--pk-muted-foreground, #64748b)"
        },
        children: "No actions recorded yet. Waiting\u2026"
      }
    ) : /* @__PURE__ */ jsx21(
      "div",
      {
        style: {
          borderRadius: 12,
          border: "1px solid var(--pk-surface-border, #e2e8f0)",
          background: "var(--pk-surface, #fff)",
          padding: "16px 16px 0"
        },
        children: actions.map((action, i) => /* @__PURE__ */ jsx21(
          TrackerActionItem,
          {
            action,
            isLatest: i === 0,
            isLast: i === actions.length - 1
          },
          action.id ?? i
        ))
      }
    )
  ] });
}

// src/components/search/provenance-search.tsx
import { useState as useState11, useCallback as useCallback6 } from "react";
import { Search } from "lucide-react";

// src/components/search/file-upload-zone.tsx
import { useRef as useRef3, useState as useState9, useCallback as useCallback5 } from "react";
import { Upload, FileText, X } from "lucide-react";
import { Fragment as Fragment4, jsx as jsx22, jsxs as jsxs18 } from "react/jsx-runtime";
function FileUploadZone({
  onFile,
  accept = "image/*,video/*,audio/*,text/*",
  maxSize = 50 * 1024 * 1024,
  // 50MB
  disabled = false,
  className
}) {
  const inputRef = useRef3(null);
  const [isDragOver, setIsDragOver] = useState9(false);
  const [error, setError] = useState9(null);
  const [preview, setPreview] = useState9(null);
  const handleFile = useCallback5(
    (file) => {
      setError(null);
      if (file.size > maxSize) {
        setError(`File too large. Max size: ${formatBytes(maxSize)}`);
        return;
      }
      setPreview({ name: file.name, size: file.size });
      onFile(file);
    },
    [onFile, maxSize]
  );
  const handleDrop = useCallback5(
    (e) => {
      e.preventDefault();
      setIsDragOver(false);
      if (disabled) return;
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile, disabled]
  );
  const handleChange = useCallback5(
    (e) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );
  const clear = () => {
    setPreview(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };
  return /* @__PURE__ */ jsxs18("div", { className: cn("space-y-2", className), children: [
    /* @__PURE__ */ jsxs18(
      "div",
      {
        className: cn(
          "relative rounded-lg border-2 border-dashed transition-colors cursor-pointer",
          "flex flex-col items-center justify-center gap-2 p-6 text-center",
          isDragOver ? "border-[var(--pk-node-resource)] bg-[var(--pk-node-resource-muted)]" : "border-[var(--pk-surface-border)] hover:border-[var(--pk-node-resource)]/50 hover:bg-[var(--pk-surface-muted)]",
          disabled && "pointer-events-none opacity-50"
        ),
        onDragOver: (e) => {
          e.preventDefault();
          setIsDragOver(true);
        },
        onDragLeave: () => setIsDragOver(false),
        onDrop: handleDrop,
        onClick: () => inputRef.current?.click(),
        role: "button",
        tabIndex: 0,
        onKeyDown: (e) => e.key === "Enter" && inputRef.current?.click(),
        "aria-label": "Upload file for provenance search",
        children: [
          /* @__PURE__ */ jsx22(
            "input",
            {
              ref: inputRef,
              type: "file",
              accept,
              className: "sr-only",
              onChange: handleChange,
              disabled
            }
          ),
          preview ? /* @__PURE__ */ jsxs18("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ jsx22(FileText, { size: 18, className: "text-[var(--pk-node-resource)]" }),
            /* @__PURE__ */ jsxs18("div", { className: "text-left", children: [
              /* @__PURE__ */ jsx22("p", { className: "text-sm font-medium text-[var(--pk-foreground)] truncate max-w-[200px]", children: preview.name }),
              /* @__PURE__ */ jsx22("p", { className: "text-xs text-[var(--pk-muted-foreground)]", children: formatBytes(preview.size) })
            ] }),
            /* @__PURE__ */ jsx22(
              "button",
              {
                type: "button",
                onClick: (e) => {
                  e.stopPropagation();
                  clear();
                },
                className: "ml-2 text-[var(--pk-muted-foreground)] hover:text-[var(--pk-foreground)]",
                "aria-label": "Remove file",
                children: /* @__PURE__ */ jsx22(X, { size: 14 })
              }
            )
          ] }) : /* @__PURE__ */ jsxs18(Fragment4, { children: [
            /* @__PURE__ */ jsx22(Upload, { size: 24, strokeWidth: 1.5, className: "text-[var(--pk-muted-foreground)]" }),
            /* @__PURE__ */ jsxs18("div", { children: [
              /* @__PURE__ */ jsx22("p", { className: "text-sm font-medium text-[var(--pk-foreground)]", children: "Drop a file or click to upload" }),
              /* @__PURE__ */ jsxs18("p", { className: "text-xs text-[var(--pk-muted-foreground)] mt-0.5", children: [
                accept.replace(/,/g, ", "),
                " \xB7 max ",
                formatBytes(maxSize)
              ] })
            ] })
          ] })
        ]
      }
    ),
    error && /* @__PURE__ */ jsx22("p", { className: "text-xs text-red-600 dark:text-red-400", children: error })
  ] });
}

// src/components/search/search-result-card.tsx
import { useState as useState10 } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { jsx as jsx23, jsxs as jsxs19 } from "react/jsx-runtime";
function ScoreBar({ score }) {
  const percent = Math.round(score * 100);
  const color = percent >= 90 ? "bg-[var(--pk-verified)]" : percent >= 70 ? "bg-[var(--pk-partial)]" : "bg-[var(--pk-unverified)]";
  return /* @__PURE__ */ jsxs19("div", { className: "flex items-center gap-2", children: [
    /* @__PURE__ */ jsx23("div", { className: "flex-1 h-1.5 rounded-full bg-[var(--pk-surface-muted)] overflow-hidden", children: /* @__PURE__ */ jsx23("div", { className: cn("h-full rounded-full", color), style: { width: `${percent}%` } }) }),
    /* @__PURE__ */ jsxs19("span", { className: "text-xs tabular-nums text-[var(--pk-muted-foreground)] w-10 text-right shrink-0", children: [
      percent,
      "%"
    ] })
  ] });
}
function SearchResultCard({
  match,
  bundle,
  onSelect,
  className
}) {
  const [expanded, setExpanded] = useState10(false);
  return /* @__PURE__ */ jsxs19(
    "div",
    {
      className: cn(
        "rounded-lg border border-[var(--pk-surface-border)] bg-[var(--pk-surface)] overflow-hidden",
        className
      ),
      children: [
        /* @__PURE__ */ jsxs19(
          "div",
          {
            className: "flex items-center gap-3 p-3 cursor-pointer hover:bg-[var(--pk-surface-muted)] transition-colors",
            onClick: () => {
              setExpanded((v) => !v);
              onSelect?.(match.cid);
            },
            children: [
              /* @__PURE__ */ jsxs19("div", { className: "flex-1 min-w-0", children: [
                /* @__PURE__ */ jsxs19("div", { className: "flex items-center gap-2 mb-1", children: [
                  /* @__PURE__ */ jsx23(CidDisplay, { cid: match.cid, showCopy: false }),
                  match.type && /* @__PURE__ */ jsx23("span", { className: "text-xs text-[var(--pk-muted-foreground)] capitalize bg-[var(--pk-surface-muted)] px-1.5 py-0.5 rounded", children: match.type })
                ] }),
                /* @__PURE__ */ jsx23(ScoreBar, { score: match.score })
              ] }),
              /* @__PURE__ */ jsx23(
                "button",
                {
                  type: "button",
                  className: "shrink-0 text-[var(--pk-muted-foreground)]",
                  "aria-label": expanded ? "Collapse" : "View provenance",
                  children: expanded ? /* @__PURE__ */ jsx23(ChevronUp, { size: 14 }) : /* @__PURE__ */ jsx23(ChevronDown, { size: 14 })
                }
              )
            ]
          }
        ),
        expanded && /* @__PURE__ */ jsx23("div", { className: "border-t border-[var(--pk-surface-border)] p-3", children: /* @__PURE__ */ jsx23(
          ProvenanceBundleView,
          {
            cid: bundle ? void 0 : match.cid,
            bundle,
            showGraph: false
          }
        ) })
      ]
    }
  );
}

// src/components/search/provenance-search.tsx
import { jsx as jsx24, jsxs as jsxs20 } from "react/jsx-runtime";
function ProvenanceSearch({
  mode = "both",
  accept,
  maxSize,
  onResult,
  className
}) {
  const { pk } = useProvenanceKit();
  const [results, setResults] = useState11([]);
  const [loading, setLoading] = useState11(false);
  const [error, setError] = useState11(null);
  const [cidInput, setCidInput] = useState11("");
  const handleFile = useCallback6(
    async (file) => {
      if (!pk) {
        setError("ProvenanceKitProvider not configured");
        return;
      }
      setLoading(true);
      setError(null);
      setResults([]);
      try {
        const matches = await pk.similar(file, 5);
        setResults(matches);
        if (matches[0]) onResult?.({ cid: matches[0].cid });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Search failed");
      } finally {
        setLoading(false);
      }
    },
    [pk, onResult]
  );
  const handleCidSearch = useCallback6(async () => {
    if (!pk || !cidInput.trim()) return;
    setLoading(true);
    setError(null);
    setResults([]);
    try {
      const matches = await pk.similar(cidInput.trim(), 5);
      setResults(matches);
      if (matches[0]) onResult?.({ cid: matches[0].cid });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }, [pk, cidInput, onResult]);
  return /* @__PURE__ */ jsxs20("div", { className: cn("space-y-4", className), children: [
    (mode === "cid" || mode === "both") && /* @__PURE__ */ jsxs20("div", { className: "flex gap-2", children: [
      /* @__PURE__ */ jsx24(
        "input",
        {
          type: "text",
          value: cidInput,
          onChange: (e) => setCidInput(e.target.value),
          onKeyDown: (e) => e.key === "Enter" && handleCidSearch(),
          placeholder: "Enter a CID to find similar content\u2026",
          className: cn(
            "flex-1 rounded-lg border border-[var(--pk-surface-border)] bg-[var(--pk-surface)]",
            "px-3 py-2 text-sm text-[var(--pk-foreground)] placeholder:text-[var(--pk-muted-foreground)]",
            "focus:outline-none focus:ring-2 focus:ring-[var(--pk-node-resource)]/30"
          )
        }
      ),
      /* @__PURE__ */ jsxs20(
        "button",
        {
          type: "button",
          onClick: handleCidSearch,
          disabled: loading || !cidInput.trim(),
          className: cn(
            "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium",
            "bg-[var(--pk-node-resource)] text-[var(--pk-node-resource-fg)]",
            "hover:opacity-90 transition-opacity",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          ),
          children: [
            /* @__PURE__ */ jsx24(Search, { size: 14, strokeWidth: 2 }),
            "Search"
          ]
        }
      )
    ] }),
    (mode === "upload" || mode === "both") && /* @__PURE__ */ jsx24(
      FileUploadZone,
      {
        onFile: handleFile,
        accept,
        maxSize,
        disabled: loading
      }
    ),
    loading && /* @__PURE__ */ jsxs20("div", { className: "flex items-center gap-2 text-sm text-[var(--pk-muted-foreground)]", children: [
      /* @__PURE__ */ jsx24("div", { className: "size-4 rounded-full border-2 border-[var(--pk-node-resource)] border-t-transparent animate-spin" }),
      "Searching for provenance\u2026"
    ] }),
    error && /* @__PURE__ */ jsx24("p", { className: "text-sm text-red-600 dark:text-red-400", children: error }),
    results.length > 0 && /* @__PURE__ */ jsxs20("div", { className: "space-y-2", children: [
      /* @__PURE__ */ jsxs20("p", { className: "text-xs text-[var(--pk-muted-foreground)]", children: [
        results.length,
        " match",
        results.length !== 1 ? "es" : "",
        " found"
      ] }),
      results.map((match) => /* @__PURE__ */ jsx24(
        SearchResultCard,
        {
          match,
          onSelect: (cid) => onResult?.({ cid })
        },
        match.cid
      ))
    ] }),
    !loading && !error && results.length === 0 && (mode === "cid" || mode === "both") && cidInput && /* @__PURE__ */ jsx24("p", { className: "text-sm text-[var(--pk-muted-foreground)] text-center py-4", children: "No provenance found for this content" })
  ] });
}

// src/components/extensions/ai-extension-view.tsx
import { Bot as Bot6, Cpu, Eye } from "lucide-react";
import { jsx as jsx25, jsxs as jsxs21 } from "react/jsx-runtime";
function Field2({ label, value }) {
  return /* @__PURE__ */ jsxs21("div", { className: "flex items-start gap-2", children: [
    /* @__PURE__ */ jsx25("span", { className: "text-xs text-[var(--pk-muted-foreground)] min-w-[80px] shrink-0", children: label }),
    /* @__PURE__ */ jsx25("span", { className: "text-xs text-[var(--pk-foreground)] font-medium", children: value })
  ] });
}
function AIExtensionView({
  extension,
  mode = "tool",
  className
}) {
  if (mode === "agent") {
    const ext2 = extension;
    return /* @__PURE__ */ jsxs21("div", { className: cn("space-y-1.5", className), children: [
      /* @__PURE__ */ jsxs21("div", { className: "flex items-center gap-1.5 text-[var(--pk-role-ai)]", children: [
        /* @__PURE__ */ jsx25(Bot6, { size: 12, strokeWidth: 2 }),
        /* @__PURE__ */ jsx25("span", { className: "text-xs font-semibold", children: "AI Agent" })
      ] }),
      ext2.model?.provider && /* @__PURE__ */ jsx25(Field2, { label: "Provider", value: ext2.model.provider }),
      ext2.model?.model && /* @__PURE__ */ jsx25(Field2, { label: "Model", value: ext2.model.model }),
      ext2.autonomyLevel && /* @__PURE__ */ jsx25(Field2, { label: "Autonomy", value: ext2.autonomyLevel }),
      ext2.agentRole && /* @__PURE__ */ jsx25(Field2, { label: "Role", value: ext2.agentRole }),
      ext2.framework && /* @__PURE__ */ jsx25(Field2, { label: "Framework", value: ext2.framework }),
      ext2.collaborators && ext2.collaborators.length > 0 && /* @__PURE__ */ jsx25(Field2, { label: "With", value: `${ext2.collaborators.length} collaborators` })
    ] });
  }
  const ext = extension;
  return /* @__PURE__ */ jsxs21("div", { className: cn("space-y-1.5", className), children: [
    /* @__PURE__ */ jsxs21("div", { className: "flex items-center gap-1.5 text-[var(--pk-role-ai)]", children: [
      /* @__PURE__ */ jsx25(Cpu, { size: 12, strokeWidth: 2 }),
      /* @__PURE__ */ jsx25("span", { className: "text-xs font-semibold", children: "AI Tool" })
    ] }),
    ext.provider && /* @__PURE__ */ jsx25(Field2, { label: "Provider", value: ext.provider }),
    ext.model && /* @__PURE__ */ jsx25(Field2, { label: "Model", value: ext.model }),
    ext.version && /* @__PURE__ */ jsx25(Field2, { label: "Version", value: ext.version }),
    ext.tokensUsed && /* @__PURE__ */ jsx25(Field2, { label: "Tokens", value: `${ext.tokensUsed.toLocaleString()}` }),
    ext.generationTime && /* @__PURE__ */ jsx25(Field2, { label: "Time", value: `${(ext.generationTime / 1e3).toFixed(2)}s` }),
    ext.promptHash && /* @__PURE__ */ jsxs21("div", { className: "flex items-center gap-1 text-[var(--pk-muted-foreground)]", children: [
      /* @__PURE__ */ jsx25(Eye, { size: 10 }),
      /* @__PURE__ */ jsx25("span", { className: "text-xs", children: "Prompt hash recorded" })
    ] })
  ] });
}

// src/components/extensions/license-extension-view.tsx
import { Scale as Scale2, ExternalLink as ExternalLink3 } from "lucide-react";
import { jsx as jsx26, jsxs as jsxs22 } from "react/jsx-runtime";
function LicenseExtensionView({ extension, className }) {
  return /* @__PURE__ */ jsxs22("div", { className: cn("space-y-2", className), children: [
    /* @__PURE__ */ jsxs22("div", { className: "flex items-center gap-1.5 text-[var(--pk-muted-foreground)]", children: [
      /* @__PURE__ */ jsx26(Scale2, { size: 12, strokeWidth: 2 }),
      /* @__PURE__ */ jsx26("span", { className: "text-xs font-semibold text-[var(--pk-foreground)]", children: "License" })
    ] }),
    /* @__PURE__ */ jsx26(LicenseChip, { license: extension }),
    /* @__PURE__ */ jsxs22("div", { className: "space-y-1 text-xs text-[var(--pk-muted-foreground)]", children: [
      extension.commercial !== void 0 && /* @__PURE__ */ jsxs22("div", { children: [
        "Commercial use: ",
        /* @__PURE__ */ jsx26("span", { className: "font-medium text-[var(--pk-foreground)]", children: extension.commercial ? "Allowed" : "Not allowed" })
      ] }),
      extension.derivatives !== void 0 && /* @__PURE__ */ jsxs22("div", { children: [
        "Derivatives: ",
        /* @__PURE__ */ jsx26("span", { className: "font-medium text-[var(--pk-foreground)]", children: extension.derivatives ? "Allowed" : "Not allowed" })
      ] }),
      extension.attribution && /* @__PURE__ */ jsxs22("div", { children: [
        "Attribution: ",
        /* @__PURE__ */ jsx26("span", { className: "font-medium text-[var(--pk-foreground)] capitalize", children: extension.attribution })
      ] }),
      extension.attribution === "required" && extension.attributionText && /* @__PURE__ */ jsxs22("div", { className: "italic text-[var(--pk-foreground)]", children: [
        '"',
        extension.attributionText,
        '"'
      ] }),
      extension.expires && /* @__PURE__ */ jsxs22("div", { children: [
        "Expires: ",
        /* @__PURE__ */ jsx26("span", { className: "font-medium text-[var(--pk-foreground)]", children: new Date(extension.expires).toLocaleDateString() })
      ] })
    ] }),
    extension.termsUrl && /* @__PURE__ */ jsxs22(
      "a",
      {
        href: extension.termsUrl,
        target: "_blank",
        rel: "noopener noreferrer",
        className: "inline-flex items-center gap-1 text-xs text-[var(--pk-node-resource)] hover:underline",
        children: [
          "View full terms",
          /* @__PURE__ */ jsx26(ExternalLink3, { size: 10 })
        ]
      }
    )
  ] });
}

// src/components/extensions/onchain-extension-view.tsx
import { Link, CheckCircle, Clock as Clock3 } from "lucide-react";
import { jsx as jsx27, jsxs as jsxs23 } from "react/jsx-runtime";
function OnchainExtensionView({ extension, className }) {
  const chainName = extension.chainName ?? formatChainName(extension.chainId);
  return /* @__PURE__ */ jsxs23("div", { className: cn("space-y-1.5", className), children: [
    /* @__PURE__ */ jsxs23("div", { className: "flex items-center gap-1.5", children: [
      /* @__PURE__ */ jsx27(Link, { size: 12, strokeWidth: 2, className: "text-[var(--pk-node-resource)]" }),
      /* @__PURE__ */ jsx27("span", { className: "text-xs font-semibold text-[var(--pk-foreground)]", children: "On-chain" }),
      extension.confirmed && /* @__PURE__ */ jsx27(CheckCircle, { size: 10, strokeWidth: 2, className: "text-[var(--pk-verified)]" })
    ] }),
    /* @__PURE__ */ jsxs23("div", { className: "space-y-1 text-xs", children: [
      /* @__PURE__ */ jsxs23("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsx27("span", { className: "text-[var(--pk-muted-foreground)] min-w-[60px]", children: "Chain" }),
        /* @__PURE__ */ jsx27("span", { className: "font-medium text-[var(--pk-foreground)]", children: chainName })
      ] }),
      /* @__PURE__ */ jsxs23("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsx27("span", { className: "text-[var(--pk-muted-foreground)] min-w-[60px]", children: "Block" }),
        /* @__PURE__ */ jsxs23("span", { className: "font-medium text-[var(--pk-foreground)] tabular-nums", children: [
          "#",
          extension.blockNumber.toLocaleString()
        ] })
      ] }),
      /* @__PURE__ */ jsxs23("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsx27("span", { className: "text-[var(--pk-muted-foreground)] min-w-[60px]", children: "Tx" }),
        /* @__PURE__ */ jsx27(
          "span",
          {
            className: "font-mono text-xs text-[var(--pk-foreground)]",
            title: extension.transactionHash,
            children: formatTxHash(extension.transactionHash)
          }
        )
      ] }),
      extension.blockTimestamp && /* @__PURE__ */ jsxs23("div", { className: "flex items-center gap-1 text-[var(--pk-muted-foreground)]", children: [
        /* @__PURE__ */ jsx27(Clock3, { size: 10 }),
        /* @__PURE__ */ jsx27("span", { children: formatDate(extension.blockTimestamp) })
      ] }),
      extension.confirmations != null && /* @__PURE__ */ jsxs23("div", { className: "text-[var(--pk-muted-foreground)]", children: [
        extension.confirmations,
        " confirmation",
        extension.confirmations !== 1 ? "s" : ""
      ] })
    ] })
  ] });
}

// src/components/extensions/verification-view.tsx
import { CheckCircle as CheckCircle2, XCircle, AlertCircle, MinusCircle } from "lucide-react";
import { jsx as jsx28, jsxs as jsxs24 } from "react/jsx-runtime";
function ClaimIcon({ status }) {
  if (status === "verified") return /* @__PURE__ */ jsx28(CheckCircle2, { size: 11, strokeWidth: 2, className: "text-[var(--pk-verified)] shrink-0" });
  if (status === "failed") return /* @__PURE__ */ jsx28(XCircle, { size: 11, strokeWidth: 2, className: "text-[var(--pk-failed)] shrink-0" });
  if (status === "receipt-backed") return /* @__PURE__ */ jsx28(CheckCircle2, { size: 11, strokeWidth: 2, className: "text-[var(--pk-partial)] shrink-0" });
  if (status === "skipped") return /* @__PURE__ */ jsx28(MinusCircle, { size: 11, strokeWidth: 2, className: "text-[var(--pk-unverified)] shrink-0" });
  return /* @__PURE__ */ jsx28(AlertCircle, { size: 11, strokeWidth: 2, className: "text-[var(--pk-unverified)] shrink-0" });
}
var CLAIM_LABELS = {
  identity: "Identity",
  action: "Authorization",
  output: "Output binding",
  tool: "Tool attestation",
  inputs: "Input existence",
  attestation: "Environment"
};
function VerificationView({
  extension,
  showClaims = true,
  className
}) {
  const claimEntries = Object.entries(extension.claims ?? {}).filter(([, v]) => v != null);
  return /* @__PURE__ */ jsxs24("div", { className: cn("space-y-2", className), children: [
    /* @__PURE__ */ jsxs24("div", { className: "flex items-center gap-2", children: [
      /* @__PURE__ */ jsx28(VerificationIndicator, { status: extension.status, showLabel: true, size: "sm" }),
      /* @__PURE__ */ jsxs24("span", { className: "text-xs text-[var(--pk-muted-foreground)]", children: [
        "(",
        extension.policyUsed,
        ")"
      ] })
    ] }),
    showClaims && claimEntries.length > 0 && /* @__PURE__ */ jsx28("div", { className: "space-y-1", children: claimEntries.map(([claimKey, claim]) => /* @__PURE__ */ jsxs24("div", { className: "flex items-center gap-2", children: [
      /* @__PURE__ */ jsx28(ClaimIcon, { status: claim.status }),
      /* @__PURE__ */ jsx28("span", { className: "text-xs text-[var(--pk-muted-foreground)]", children: CLAIM_LABELS[claimKey] ?? claimKey }),
      claim.detail && /* @__PURE__ */ jsxs24("span", { className: "text-xs text-[var(--pk-muted-foreground)] truncate", children: [
        "\u2014 ",
        claim.detail
      ] })
    ] }, claimKey)) })
  ] });
}

// src/components/extensions/contrib-extension-view.tsx
import { jsx as jsx29, jsxs as jsxs25 } from "react/jsx-runtime";
function toValue(ext) {
  if (ext.basis === "percentage") return Math.min(1, ext.weight / 100);
  if (ext.basis === "points") return Math.min(1, ext.weight / 1e4);
  return Math.min(1, ext.weight / 1e4);
}
function ContribExtensionView({ extension, className }) {
  const value = toValue(extension);
  return /* @__PURE__ */ jsxs25("div", { className, style: { display: "flex", flexDirection: "column", gap: 6 }, children: [
    /* @__PURE__ */ jsx29(ContributionBar, { value }),
    /* @__PURE__ */ jsxs25("div", { style: { display: "flex", alignItems: "center", gap: 12, fontSize: 12, color: "var(--pk-muted-foreground, #64748b)" }, children: [
      extension.source && /* @__PURE__ */ jsxs25("span", { children: [
        "Source:",
        " ",
        /* @__PURE__ */ jsx29("span", { style: { fontWeight: 600, color: "var(--pk-foreground, #0f172a)", textTransform: "capitalize" }, children: extension.source.replace("-", " ") })
      ] }),
      extension.category && /* @__PURE__ */ jsxs25("span", { children: [
        "Category:",
        " ",
        /* @__PURE__ */ jsx29("span", { style: { fontWeight: 600, color: "var(--pk-foreground, #0f172a)" }, children: extension.category })
      ] })
    ] }),
    extension.note && /* @__PURE__ */ jsx29("p", { style: { fontSize: 12, color: "var(--pk-muted-foreground, #64748b)", fontStyle: "italic", margin: 0 }, children: extension.note })
  ] });
}

// src/components/provenance/file-provenance-tag.tsx
import { useEffect as useEffect7, useState as useState13, useCallback as useCallback7 } from "react";
import {
  ShieldCheck as ShieldCheck2,
  ShieldOff as ShieldOff2,
  ChevronDown as ChevronDown2,
  ChevronUp as ChevronUp2,
  Loader2 as Loader22,
  User as User4,
  Bot as Bot7,
  FileImage,
  Tag,
  Calendar
} from "lucide-react";

// src/components/provenance/file-ownership-claim.tsx
import { useState as useState12 } from "react";
import { UserCheck, ExternalLink as ExternalLink4, Loader2, CheckCircle as CheckCircle3, AlertCircle as AlertCircle2 } from "lucide-react";
import { jsx as jsx30, jsxs as jsxs26 } from "react/jsx-runtime";
function FileOwnershipClaim({ onClaim, className }) {
  const [claimState, setClaimState] = useState12("idle");
  async function handleClaim(owned) {
    setClaimState("claiming");
    try {
      const result = await onClaim(owned);
      setClaimState(result.status === "claimed" ? "claimed" : "referenced");
    } catch {
      setClaimState("error");
    }
  }
  if (claimState === "claiming") {
    return /* @__PURE__ */ jsxs26("div", { className: cn("flex items-center gap-1 mt-1", className), children: [
      /* @__PURE__ */ jsx30(Loader2, { size: 10, className: "animate-spin text-[var(--pk-muted-foreground,#64748b)]" }),
      /* @__PURE__ */ jsx30("span", { className: "text-[10px] text-[var(--pk-muted-foreground,#64748b)]", children: "Recording provenance\u2026" })
    ] });
  }
  if (claimState === "claimed") {
    return /* @__PURE__ */ jsxs26("div", { className: cn("flex items-center gap-1.5 mt-1", className), children: [
      /* @__PURE__ */ jsx30(CheckCircle3, { size: 10, className: "shrink-0 text-emerald-500" }),
      /* @__PURE__ */ jsx30("span", { className: "text-[10px] text-emerald-600 dark:text-emerald-400", children: "Claimed as your work" })
    ] });
  }
  if (claimState === "referenced") {
    return /* @__PURE__ */ jsxs26("div", { className: cn("flex items-center gap-1.5 mt-1", className), children: [
      /* @__PURE__ */ jsx30(CheckCircle3, { size: 10, className: "shrink-0 text-blue-500" }),
      /* @__PURE__ */ jsx30("span", { className: "text-[10px] text-blue-600 dark:text-blue-400", children: "Recorded as external source" })
    ] });
  }
  if (claimState === "error") {
    return /* @__PURE__ */ jsxs26("div", { className: cn("flex items-center gap-1.5 mt-1", className), children: [
      /* @__PURE__ */ jsx30(AlertCircle2, { size: 10, className: "shrink-0 text-red-500" }),
      /* @__PURE__ */ jsx30("span", { className: "text-[10px] text-red-600", children: "Recording failed \u2014" }),
      /* @__PURE__ */ jsx30(
        "button",
        {
          type: "button",
          onClick: () => setClaimState("idle"),
          className: "text-[10px] text-[var(--pk-node-resource,#6366f1)] hover:underline",
          children: "retry"
        }
      )
    ] });
  }
  return /* @__PURE__ */ jsxs26(
    "div",
    {
      className: cn(
        "mt-1 rounded-md border border-[var(--pk-surface-border,#e2e8f0)] bg-[var(--pk-surface,#ffffff)] p-1.5",
        className
      ),
      children: [
        /* @__PURE__ */ jsx30("p", { className: "text-[10px] text-[var(--pk-muted-foreground,#64748b)] mb-1.5 leading-snug", children: "New file \u2014 do you own this?" }),
        /* @__PURE__ */ jsxs26("div", { className: "flex gap-1", children: [
          /* @__PURE__ */ jsxs26(
            "button",
            {
              type: "button",
              onClick: () => handleClaim(true),
              className: "flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/60 transition-colors",
              children: [
                /* @__PURE__ */ jsx30(UserCheck, { size: 9 }),
                "Yes, I own it"
              ]
            }
          ),
          /* @__PURE__ */ jsxs26(
            "button",
            {
              type: "button",
              onClick: () => handleClaim(false),
              className: "flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-[var(--pk-surface-muted,#f1f5f9)] text-[var(--pk-muted-foreground,#64748b)] hover:bg-[var(--pk-surface-muted,#e2e8f0)] transition-colors",
              children: [
                /* @__PURE__ */ jsx30(ExternalLink4, { size: 9 }),
                "No, I don't"
              ]
            }
          )
        ] })
      ]
    }
  );
}

// src/components/provenance/file-provenance-tag.tsx
import { jsx as jsx31, jsxs as jsxs27 } from "react/jsx-runtime";
function SimilarityBar({ score }) {
  const pct = Math.round(score * 100);
  const color = pct >= 90 ? "bg-[var(--pk-verified,#22c55e)]" : pct >= 70 ? "bg-[var(--pk-partial,#f59e0b)]" : "bg-[var(--pk-unverified,#ef4444)]";
  return /* @__PURE__ */ jsxs27("div", { className: "flex items-center gap-1.5 w-full", children: [
    /* @__PURE__ */ jsx31("div", { className: "flex-1 h-1 rounded-full bg-[var(--pk-surface-muted,#f1f5f9)] overflow-hidden", children: /* @__PURE__ */ jsx31(
      "div",
      {
        className: cn("h-full rounded-full transition-all", color),
        style: { width: `${pct}%` }
      }
    ) }),
    /* @__PURE__ */ jsxs27("span", { className: "text-[10px] tabular-nums text-[var(--pk-muted-foreground,#64748b)] shrink-0 w-7 text-right", children: [
      pct,
      "%"
    ] })
  ] });
}
function BundleSummary({
  bundle,
  cid,
  onViewDetail,
  extraMatches
}) {
  const creator = bundle.entities?.find(
    (e) => e.role === "human" || e.role === "creator"
  );
  const aiEntity = bundle.entities?.find((e) => e.role === "ai");
  const topAction = bundle.actions?.[0];
  const topResource = bundle.resources?.[0];
  const licenseExt = topResource?.extensions?.["ext:license@1.0.0"];
  const aiExt = topAction?.extensions?.["ext:ai@1.0.0"];
  return /* @__PURE__ */ jsxs27("div", { className: "space-y-1.5 text-[11px]", children: [
    /* @__PURE__ */ jsxs27("div", { className: "flex items-center justify-between gap-2", children: [
      /* @__PURE__ */ jsx31(CidDisplay, { cid, showCopy: true }),
      onViewDetail && /* @__PURE__ */ jsx31(
        "button",
        {
          type: "button",
          onClick: () => onViewDetail(cid),
          className: "text-[10px] text-[var(--pk-node-resource,#6366f1)] hover:underline shrink-0",
          children: "View full \u2192"
        }
      )
    ] }),
    creator && /* @__PURE__ */ jsxs27("div", { className: "flex items-center gap-1.5 text-[var(--pk-foreground,#0f172a)]", children: [
      /* @__PURE__ */ jsx31(User4, { size: 10, className: "shrink-0 text-[var(--pk-role-human,#3b82f6)]" }),
      /* @__PURE__ */ jsx31("span", { className: "truncate", children: creator.name ?? creator.id })
    ] }),
    aiEntity && !aiExt && /* @__PURE__ */ jsxs27("div", { className: "flex items-center gap-1.5 text-[var(--pk-muted-foreground,#64748b)]", children: [
      /* @__PURE__ */ jsx31(Bot7, { size: 10, className: "shrink-0 text-[var(--pk-role-ai,#a855f7)]" }),
      /* @__PURE__ */ jsx31("span", { className: "truncate", children: aiEntity.name ?? aiEntity.id })
    ] }),
    aiExt && (aiExt.provider || aiExt.model) && /* @__PURE__ */ jsxs27("div", { className: "flex items-center gap-1.5 text-[var(--pk-muted-foreground,#64748b)]", children: [
      /* @__PURE__ */ jsx31(Bot7, { size: 10, className: "shrink-0 text-[var(--pk-role-ai,#a855f7)]" }),
      /* @__PURE__ */ jsx31("span", { className: "truncate", children: [aiExt.provider, aiExt.model].filter(Boolean).join(" / ") })
    ] }),
    topResource?.type && /* @__PURE__ */ jsxs27("div", { className: "flex items-center gap-1.5 text-[var(--pk-muted-foreground,#64748b)]", children: [
      /* @__PURE__ */ jsx31(FileImage, { size: 10, className: "shrink-0" }),
      /* @__PURE__ */ jsx31("span", { className: "capitalize", children: topResource.type })
    ] }),
    topAction?.type && /* @__PURE__ */ jsxs27("div", { className: "flex items-center gap-1.5 text-[var(--pk-muted-foreground,#64748b)]", children: [
      /* @__PURE__ */ jsx31(Tag, { size: 10, className: "shrink-0" }),
      /* @__PURE__ */ jsx31("span", { className: "capitalize", children: topAction.type })
    ] }),
    licenseExt && (licenseExt.spdxId || licenseExt.name) && /* @__PURE__ */ jsxs27("div", { className: "flex items-center gap-1.5 text-[var(--pk-muted-foreground,#64748b)]", children: [
      /* @__PURE__ */ jsx31(ShieldCheck2, { size: 10, className: "shrink-0" }),
      /* @__PURE__ */ jsx31("span", { className: "truncate", children: licenseExt.spdxId ?? licenseExt.name })
    ] }),
    topAction?.timestamp && /* @__PURE__ */ jsxs27("div", { className: "flex items-center gap-1.5 text-[var(--pk-muted-foreground,#64748b)]", children: [
      /* @__PURE__ */ jsx31(Calendar, { size: 10, className: "shrink-0" }),
      /* @__PURE__ */ jsx31("span", { children: formatDate(topAction.timestamp) })
    ] }),
    bundle.attributions && bundle.attributions.length > 0 && /* @__PURE__ */ jsxs27("p", { className: "text-[var(--pk-muted-foreground,#64748b)]", children: [
      bundle.attributions.length,
      " attribution",
      bundle.attributions.length > 1 ? "s" : ""
    ] }),
    extraMatches != null && extraMatches > 0 && /* @__PURE__ */ jsxs27("p", { className: "text-[var(--pk-muted-foreground,#64748b)] border-t border-[var(--pk-surface-border,#e2e8f0)] pt-1.5 mt-1", children: [
      "+",
      extraMatches,
      " more similar record",
      extraMatches > 1 ? "s" : ""
    ] })
  ] });
}
function FileProvenanceTag({
  file,
  onViewDetail,
  onClaim,
  onMatchFound,
  topK = 3,
  className
}) {
  const { pk } = useProvenanceKit();
  const [state, setState] = useState13({ status: "idle" });
  const [expanded, setExpanded] = useState13(false);
  const search = useCallback7(async () => {
    if (!pk || !file) return;
    setState({ status: "loading" });
    try {
      const result = await pk.uploadAndMatch(file, { topK });
      if (!result.matches || result.matches.length === 0 || result.verdict === "no-match") {
        setState({ status: "not-found", result });
        return;
      }
      const topCid = result.matches[0].cid;
      let topBundle;
      try {
        topBundle = await pk.bundle(topCid);
      } catch {
      }
      setState({ status: "found", result, topBundle });
      onMatchFound?.(topCid);
    } catch {
      setState({ status: "error" });
    }
  }, [pk, file, topK, onMatchFound]);
  useEffect7(() => {
    search();
  }, []);
  if (!pk || state.status === "idle" || state.status === "error") return null;
  if (state.status === "loading") {
    return /* @__PURE__ */ jsxs27("div", { className: cn("flex items-center gap-1 mt-1", className), children: [
      /* @__PURE__ */ jsx31(Loader22, { size: 10, className: "animate-spin text-[var(--pk-muted-foreground,#94a3b8)]" }),
      /* @__PURE__ */ jsx31("span", { className: "text-[10px] text-[var(--pk-muted-foreground,#94a3b8)]", children: "Checking provenance\u2026" })
    ] });
  }
  if (state.status === "not-found") {
    if (onClaim) {
      return /* @__PURE__ */ jsx31(FileOwnershipClaim, { onClaim, className });
    }
    return /* @__PURE__ */ jsxs27("div", { className: cn("flex items-center gap-1 mt-1", className), children: [
      /* @__PURE__ */ jsx31(ShieldOff2, { size: 10, className: "text-[var(--pk-muted-foreground,#94a3b8)]" }),
      /* @__PURE__ */ jsx31("span", { className: "text-[10px] text-[var(--pk-muted-foreground,#94a3b8)]", children: "No prior provenance found" })
    ] });
  }
  const topMatch = state.result?.matches?.[0];
  if (!topMatch) return null;
  const creator = state.topBundle?.entities?.find(
    (e) => e.role === "human" || e.role === "creator"
  );
  const headerLabel = creator?.name ? `By ${creator.name}` : `${Math.round(topMatch.score * 100)}% match`;
  const extraMatches = (state.result?.matches?.length ?? 0) - 1;
  return /* @__PURE__ */ jsxs27(
    "div",
    {
      className: cn(
        "mt-1 rounded-md border border-[var(--pk-surface-border,#e2e8f0)] bg-[var(--pk-surface,#ffffff)] overflow-hidden",
        className
      ),
      children: [
        /* @__PURE__ */ jsxs27(
          "button",
          {
            type: "button",
            onClick: () => setExpanded((v) => !v),
            className: "w-full flex items-center gap-1.5 px-2 pt-1.5 pb-1 hover:bg-[var(--pk-surface-muted,#f8fafc)] transition-colors",
            children: [
              /* @__PURE__ */ jsx31(ShieldCheck2, { size: 10, className: "shrink-0 text-[var(--pk-verified,#22c55e)]" }),
              /* @__PURE__ */ jsx31("span", { className: "text-[10px] font-medium truncate flex-1 text-left text-[var(--pk-foreground,#0f172a)]", children: headerLabel }),
              topMatch.type && /* @__PURE__ */ jsx31("span", { className: "text-[10px] capitalize text-[var(--pk-muted-foreground,#64748b)] shrink-0 mr-1", children: topMatch.type }),
              expanded ? /* @__PURE__ */ jsx31(ChevronUp2, { size: 10, className: "shrink-0 text-[var(--pk-muted-foreground,#64748b)]" }) : /* @__PURE__ */ jsx31(ChevronDown2, { size: 10, className: "shrink-0 text-[var(--pk-muted-foreground,#64748b)]" })
            ]
          }
        ),
        /* @__PURE__ */ jsx31("div", { className: "px-2 pb-1.5", children: /* @__PURE__ */ jsx31(SimilarityBar, { score: topMatch.score }) }),
        expanded && /* @__PURE__ */ jsx31("div", { className: "border-t border-[var(--pk-surface-border,#e2e8f0)] p-2", children: state.topBundle ? /* @__PURE__ */ jsx31(
          BundleSummary,
          {
            bundle: state.topBundle,
            cid: topMatch.cid,
            onViewDetail,
            extraMatches: extraMatches > 0 ? extraMatches : void 0
          }
        ) : /* @__PURE__ */ jsxs27("div", { className: "flex items-center justify-between gap-2", children: [
          /* @__PURE__ */ jsx31(CidDisplay, { cid: topMatch.cid, showCopy: true }),
          onViewDetail && /* @__PURE__ */ jsx31(
            "button",
            {
              type: "button",
              onClick: () => onViewDetail(topMatch.cid),
              className: "text-[10px] text-[var(--pk-node-resource,#6366f1)] hover:underline shrink-0",
              children: "View full \u2192"
            }
          )
        ] }) })
      ]
    }
  );
}
export {
  AIExtensionView,
  ActionCard,
  AttributionList,
  CidDisplay,
  ContribExtensionView,
  ContributionBar,
  EntityAvatar,
  EntityCard,
  FileOwnershipClaim,
  FileProvenanceTag,
  FileUploadZone,
  LicenseChip,
  LicenseExtensionView,
  OnchainExtensionView,
  ProvenanceBadge,
  ProvenanceBundleView,
  ProvenanceGraph,
  ProvenanceKitProvider,
  ProvenancePopover,
  ProvenanceSearch,
  ProvenanceTracker,
  ResourceCard,
  RoleBadge,
  Timestamp,
  VerificationIndicator,
  VerificationView,
  bundleHasAI,
  cn,
  formatActionType,
  formatBps,
  formatBytes,
  formatChainName,
  formatCid,
  formatDate,
  formatDateAbsolute,
  formatRole,
  formatTxHash,
  getAIAgentSafe,
  getAIToolSafe,
  getContribSafe,
  getLicenseSafe,
  getOnchainSafe,
  getPrimaryCreator,
  getVerificationSafe,
  getWitnessSafe,
  useDistribution,
  useProvenanceBundle,
  useProvenanceGraph,
  useProvenanceKit,
  useSessionProvenance
};
/*! Bundled license information:

@noble/ed25519/index.js:
  (*! noble-ed25519 - MIT License (c) 2019 Paul Miller (paulmillr.com) *)

@noble/ciphers/esm/utils.js:
  (*! noble-ciphers - MIT License (c) 2023 Paul Miller (paulmillr.com) *)

@noble/hashes/esm/utils.js:
  (*! noble-hashes - MIT License (c) 2022 Paul Miller (paulmillr.com) *)

@noble/curves/esm/utils.js:
@noble/curves/esm/abstract/modular.js:
@noble/curves/esm/abstract/curve.js:
@noble/curves/esm/abstract/weierstrass.js:
@noble/curves/esm/_shortw_utils.js:
@noble/curves/esm/secp256k1.js:
  (*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) *)
*/
