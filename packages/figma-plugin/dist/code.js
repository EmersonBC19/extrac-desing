// ⚠️ ARCHIVO GENERADO — no editar. Fuente: packages/figma-plugin/src · Generar: npm run build:plugin
"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // node_modules/zod/v4/core/util.js
  var util_exports = {};
  __export(util_exports, {
    BIGINT_FORMAT_RANGES: () => BIGINT_FORMAT_RANGES,
    CONSTANT_CATCH: () => CONSTANT_CATCH,
    Class: () => Class,
    NUMBER_FORMAT_RANGES: () => NUMBER_FORMAT_RANGES,
    aborted: () => aborted,
    allowsEval: () => allowsEval,
    assert: () => assert,
    assertEqual: () => assertEqual,
    assertIs: () => assertIs,
    assertNever: () => assertNever,
    assertNotEqual: () => assertNotEqual,
    assignProp: () => assignProp,
    attachSchema: () => attachSchema,
    base64ToUint8Array: () => base64ToUint8Array,
    base64urlToUint8Array: () => base64urlToUint8Array,
    cached: () => cached,
    captureStackTrace: () => captureStackTrace,
    cleanEnum: () => cleanEnum,
    cleanRegex: () => cleanRegex,
    clone: () => clone,
    cloneDef: () => cloneDef,
    codePointLength: () => codePointLength,
    constantCatch: () => constantCatch,
    createTransparentProxy: () => createTransparentProxy,
    defineLazy: () => defineLazy,
    defineLazyInternal: () => defineLazyInternal,
    derived: () => derived,
    esc: () => esc,
    escapeRegex: () => escapeRegex,
    explicitlyAborted: () => explicitlyAborted,
    extend: () => extend,
    finalizeIssue: () => finalizeIssue,
    floatSafeRemainder: () => floatSafeRemainder,
    getElementAtPath: () => getElementAtPath,
    getEnumValues: () => getEnumValues,
    getLengthableOrigin: () => getLengthableOrigin,
    getParsedType: () => getParsedType,
    getSizableOrigin: () => getSizableOrigin,
    hexToUint8Array: () => hexToUint8Array,
    hide: () => hide,
    installLazyProp: () => installLazyProp,
    isObject: () => isObject,
    isPlainObject: () => isPlainObject,
    issue: () => issue,
    joinValues: () => joinValues,
    jsonStringifyReplacer: () => jsonStringifyReplacer,
    members: () => members,
    merge: () => merge,
    mergeDefs: () => mergeDefs,
    normalizeParams: () => normalizeParams,
    nullish: () => nullish,
    numKeys: () => numKeys,
    objectClone: () => objectClone,
    omit: () => omit,
    optionalKeys: () => optionalKeys,
    own: () => own,
    parsedType: () => parsedType,
    partial: () => partial,
    pick: () => pick,
    prefixIssues: () => prefixIssues,
    primitiveTypes: () => primitiveTypes,
    promiseAllObject: () => promiseAllObject,
    propertyKeyTypes: () => propertyKeyTypes,
    randomString: () => randomString,
    rawShape: () => rawShape,
    required: () => required,
    safeExtend: () => safeExtend,
    shallowClone: () => shallowClone,
    sizeCaps: () => sizeCaps,
    slugify: () => slugify,
    stringifyPrimitive: () => stringifyPrimitive,
    toZod: () => toZod,
    uint8ArrayToBase64: () => uint8ArrayToBase64,
    uint8ArrayToBase64url: () => uint8ArrayToBase64url,
    uint8ArrayToHex: () => uint8ArrayToHex,
    unwrapMessage: () => unwrapMessage
  });
  function assertEqual(val) {
    return val;
  }
  function assertNotEqual(val) {
    return val;
  }
  function toZod() {
    return (schema) => schema;
  }
  function assertIs(_arg) {
  }
  function assertNever(_x) {
    throw new Error("Unexpected value in exhaustive check");
  }
  function assert(_) {
  }
  function getEnumValues(entries) {
    const numericValues = Object.values(entries).filter((v) => typeof v === "number");
    const values = Object.entries(entries).filter(([k, _]) => numericValues.indexOf(+k) === -1).map(([_, v]) => v);
    return values;
  }
  function joinValues(array2, separator = "|") {
    return array2.map((val) => stringifyPrimitive(val)).join(separator);
  }
  function jsonStringifyReplacer(_, value) {
    if (typeof value === "bigint")
      return value.toString();
    return value;
  }
  var Cached = class {
    constructor(getter) {
      this._getter = getter;
      this._value = void 0;
    }
    get value() {
      const getter = this._getter;
      if (getter !== void 0) {
        this._value = getter();
        this._getter = void 0;
      }
      return this._value;
    }
  };
  function cached(getter) {
    return new Cached(getter);
  }
  function nullish(input) {
    return input === null || input === void 0;
  }
  function cleanRegex(source) {
    const start = source.startsWith("^") ? 1 : 0;
    const end = source.endsWith("$") ? source.length - 1 : source.length;
    return source.slice(start, end);
  }
  function floatSafeRemainder(val, step) {
    const ratio = val / step;
    const roundedRatio = Math.round(ratio);
    const tolerance = 4 * Number.EPSILON * Math.max(Math.abs(ratio), 1);
    if (Math.abs(ratio - roundedRatio) < tolerance)
      return 0;
    return ratio - roundedRatio;
  }
  var EVALUATING = /* @__PURE__ */ Symbol("evaluating");
  function defineLazy(object2, key, getter) {
    let value = void 0;
    Object.defineProperty(object2, key, {
      get() {
        if (value === EVALUATING) {
          return void 0;
        }
        if (value === void 0) {
          value = EVALUATING;
          value = getter();
        }
        return value;
      },
      set(v) {
        Object.defineProperty(object2, key, {
          value: v
          // configurable: true,
        });
      },
      configurable: true
    });
  }
  function objectClone(obj) {
    return Object.create(Object.getPrototypeOf(obj), Object.getOwnPropertyDescriptors(obj));
  }
  function assignProp(target, prop, value) {
    Object.defineProperty(target, prop, {
      value,
      writable: true,
      enumerable: true,
      configurable: true
    });
  }
  function rawShape(def) {
    const desc = Object.getOwnPropertyDescriptor(def, "shape");
    return desc?.get ? desc.get.raw : desc?.value;
  }
  function sourceShape(schema) {
    return rawShape(schema._zod.def) ?? schema._zod.def.shape;
  }
  function deferProp(target, key, getter) {
    Object.defineProperty(target, key, {
      get() {
        const value = getter();
        assignProp(this, key, value);
        return value;
      },
      enumerable: true,
      configurable: true
    });
  }
  function putProp(target, key, value) {
    if (key in target)
      assignProp(target, key, value);
    else
      target[key] = value;
  }
  function mirrorShape(target, source, keys, wrap) {
    const raw = sourceShape(source);
    for (const key of keys) {
      const desc = Object.getOwnPropertyDescriptor(raw, key);
      if (!desc.enumerable)
        continue;
      if (desc.get) {
        deferProp(target, key, () => {
          const value = source._zod.def.shape[key];
          return wrap ? wrap(value, key) : value;
        });
      } else
        putProp(target, key, wrap ? wrap(desc.value, key) : desc.value);
    }
  }
  function mirrorProps(target, source) {
    for (const key of Reflect.ownKeys(source)) {
      const desc = Object.getOwnPropertyDescriptor(source, key);
      if (!desc.enumerable)
        continue;
      if (desc.get)
        deferProp(target, key, () => source[key]);
      else
        putProp(target, key, desc.value);
    }
  }
  function mergeDefs(...defs) {
    const mergedDescriptors = {};
    for (const def of defs) {
      const descriptors = Object.getOwnPropertyDescriptors(def);
      Object.assign(mergedDescriptors, descriptors);
    }
    return Object.defineProperties({}, mergedDescriptors);
  }
  function cloneDef(schema) {
    return mergeDefs(schema._zod.def);
  }
  function getElementAtPath(obj, path) {
    if (!path)
      return obj;
    return path.reduce((acc, key) => acc?.[key], obj);
  }
  function promiseAllObject(promisesObj) {
    const keys = Object.keys(promisesObj);
    const promises = keys.map((key) => promisesObj[key]);
    return Promise.all(promises).then((results) => {
      const resolvedObj = {};
      for (let i = 0; i < keys.length; i++) {
        resolvedObj[keys[i]] = results[i];
      }
      return resolvedObj;
    });
  }
  function randomString(length = 10) {
    const chars = "abcdefghijklmnopqrstuvwxyz";
    let str = "";
    for (let i = 0; i < length; i++) {
      str += chars[Math.floor(Math.random() * chars.length)];
    }
    return str;
  }
  function esc(str) {
    return JSON.stringify(str);
  }
  function slugify(input) {
    return input.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
  }
  var captureStackTrace = "captureStackTrace" in Error ? Error.captureStackTrace : (..._args) => {
  };
  function isObject(data) {
    return typeof data === "object" && data !== null && !Array.isArray(data);
  }
  var allowsEval = /* @__PURE__ */ cached(() => {
    if (globalConfig.jitless) {
      return false;
    }
    if (typeof navigator !== "undefined" && navigator?.userAgent?.includes("Cloudflare")) {
      return false;
    }
    try {
      const F = Function;
      new F("");
      return true;
    } catch (_) {
      return false;
    }
  });
  function isPlainObject(o) {
    if (isObject(o) === false)
      return false;
    const ctor = o.constructor;
    if (ctor === void 0)
      return true;
    if (typeof ctor !== "function")
      return true;
    const prot = ctor.prototype;
    if (isObject(prot) === false)
      return false;
    if (Object.prototype.hasOwnProperty.call(prot, "isPrototypeOf") === false) {
      return false;
    }
    return true;
  }
  function shallowClone(o) {
    if (isPlainObject(o))
      return { ...o };
    if (Array.isArray(o))
      return [...o];
    if (o instanceof Map)
      return new Map(o);
    if (o instanceof Set)
      return new Set(o);
    return o;
  }
  function numKeys(data) {
    let keyCount = 0;
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        keyCount++;
      }
    }
    return keyCount;
  }
  var getParsedType = (data) => {
    const t = typeof data;
    switch (t) {
      case "undefined":
        return "undefined";
      case "string":
        return "string";
      case "number":
        return Number.isNaN(data) ? "nan" : "number";
      case "boolean":
        return "boolean";
      case "function":
        return "function";
      case "bigint":
        return "bigint";
      case "symbol":
        return "symbol";
      case "object":
        if (Array.isArray(data)) {
          return "array";
        }
        if (data === null) {
          return "null";
        }
        if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
          return "promise";
        }
        if (typeof Map !== "undefined" && data instanceof Map) {
          return "map";
        }
        if (typeof Set !== "undefined" && data instanceof Set) {
          return "set";
        }
        if (typeof Date !== "undefined" && data instanceof Date) {
          return "date";
        }
        if (typeof File !== "undefined" && data instanceof File) {
          return "file";
        }
        return "object";
      default:
        throw new Error(`Unknown data type: ${t}`);
    }
  };
  var propertyKeyTypes = /* @__PURE__ */ new Set(["string", "number", "symbol"]);
  var primitiveTypes = /* @__PURE__ */ new Set([
    "string",
    "number",
    "bigint",
    "boolean",
    "symbol",
    "undefined"
  ]);
  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  function clone(inst, def, params) {
    const cl = new inst._zod.constr(def ?? inst._zod.def);
    if (!def || params?.parent)
      cl._zod.parent = inst;
    return cl;
  }
  function normalizeParams(_params) {
    const params = _params;
    if (!params)
      return {};
    if (typeof params === "string")
      return { error: () => params };
    if (params?.message !== void 0) {
      if (params?.error !== void 0)
        throw new Error("Cannot specify both `message` and `error` params");
      params.error = params.message;
    }
    delete params.message;
    if (typeof params.error === "string")
      return { ...params, error: () => params.error };
    return params;
  }
  function createTransparentProxy(getter) {
    let target;
    return new Proxy({}, {
      get(_, prop, receiver) {
        target ?? (target = getter());
        return Reflect.get(target, prop, receiver);
      },
      set(_, prop, value, receiver) {
        target ?? (target = getter());
        return Reflect.set(target, prop, value, receiver);
      },
      has(_, prop) {
        target ?? (target = getter());
        return Reflect.has(target, prop);
      },
      deleteProperty(_, prop) {
        target ?? (target = getter());
        return Reflect.deleteProperty(target, prop);
      },
      ownKeys(_) {
        target ?? (target = getter());
        return Reflect.ownKeys(target);
      },
      getOwnPropertyDescriptor(_, prop) {
        target ?? (target = getter());
        return Reflect.getOwnPropertyDescriptor(target, prop);
      },
      defineProperty(_, prop, descriptor) {
        target ?? (target = getter());
        return Reflect.defineProperty(target, prop, descriptor);
      }
    });
  }
  function stringifyPrimitive(value) {
    if (typeof value === "bigint")
      return value.toString() + "n";
    if (typeof value === "string")
      return `"${value}"`;
    return `${value}`;
  }
  function optionalKeys(shape) {
    return Object.keys(shape).filter((k) => {
      return shape[k]._zod.optin !== void 0 && shape[k]._zod.optout === "optional";
    });
  }
  var NUMBER_FORMAT_RANGES = /* @__PURE__ */ (() => ({
    safeint: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
    int32: [-2147483648, 2147483647],
    uint32: [0, 4294967295],
    float32: [-34028234663852886e22, 34028234663852886e22],
    float64: [-Number.MAX_VALUE, Number.MAX_VALUE]
  }))();
  var BIGINT_FORMAT_RANGES = {
    int64: [/* @__PURE__ */ BigInt("-9223372036854775808"), /* @__PURE__ */ BigInt("9223372036854775807")],
    uint64: [/* @__PURE__ */ BigInt(0), /* @__PURE__ */ BigInt("18446744073709551615")]
  };
  function pick(schema, mask) {
    const currDef = schema._zod.def;
    const checks = currDef.checks;
    const hasChecks = checks && checks.length > 0;
    if (hasChecks) {
      throw new Error(".pick() cannot be used on object schemas containing refinements");
    }
    const newShape = {};
    mirrorShape(newShape, schema, maskedKeys(schema, mask));
    return clone(schema, mergeDefs(currDef, { shape: newShape, checks: [] }));
  }
  function maskedKeys(schema, mask) {
    const raw = sourceShape(schema);
    const keys = [];
    for (const key of Reflect.ownKeys(mask)) {
      if (!Object.getOwnPropertyDescriptor(raw, key)?.enumerable) {
        throw new Error(`Unrecognized key: "${String(key)}"`);
      }
      if (mask[key])
        keys.push(key);
    }
    return keys;
  }
  function omit(schema, mask) {
    const currDef = schema._zod.def;
    const checks = currDef.checks;
    const hasChecks = checks && checks.length > 0;
    if (hasChecks) {
      throw new Error(".omit() cannot be used on object schemas containing refinements");
    }
    const omitted = new Set(maskedKeys(schema, mask));
    const newShape = {};
    mirrorShape(newShape, schema, Reflect.ownKeys(sourceShape(schema)).filter((key) => !omitted.has(key)));
    return clone(schema, mergeDefs(currDef, { shape: newShape, checks: [] }));
  }
  function extend(schema, shape) {
    if (!isPlainObject(shape)) {
      throw new Error("Invalid input to extend: expected a plain object");
    }
    const checks = schema._zod.def.checks;
    const hasChecks = checks && checks.length > 0;
    if (hasChecks) {
      const existingShape = sourceShape(schema);
      for (const key of Reflect.ownKeys(shape)) {
        if (Object.getOwnPropertyDescriptor(existingShape, key) !== void 0) {
          throw new Error("Cannot overwrite keys on object schemas containing refinements. Use `.safeExtend()` instead.");
        }
      }
    }
    return clone(schema, mergeDefs(schema._zod.def, { shape: extended(schema, shape) }));
  }
  function extended(schema, shape) {
    const newShape = {};
    mirrorShape(newShape, schema, Reflect.ownKeys(sourceShape(schema)));
    mirrorProps(newShape, shape);
    return newShape;
  }
  function safeExtend(schema, shape) {
    if (!isPlainObject(shape)) {
      throw new Error("Invalid input to safeExtend: expected a plain object");
    }
    return clone(schema, mergeDefs(schema._zod.def, { shape: extended(schema, shape) }));
  }
  function merge(a, b) {
    if (!b?._zod?.def) {
      throw new Error("Invalid input to merge: expected an object schema. To merge a plain shape, use `.extend()`.");
    }
    if (a._zod.def.checks?.length) {
      throw new Error(".merge() cannot be used on object schemas containing refinements. Use .safeExtend() instead.");
    }
    const newShape = {};
    mirrorShape(newShape, a, Reflect.ownKeys(sourceShape(a)));
    mirrorShape(newShape, b, Reflect.ownKeys(sourceShape(b)));
    const def = mergeDefs(a._zod.def, {
      shape: newShape,
      get catchall() {
        return b._zod.def.catchall;
      },
      checks: b._zod.def.checks ?? []
    });
    return clone(a, def);
  }
  function partial(Class2, schema, mask, name = "partial") {
    const currDef = schema._zod.def;
    const checks = currDef.checks;
    const hasChecks = checks && checks.length > 0;
    if (hasChecks) {
      throw new Error(`.${name}() cannot be used on object schemas containing refinements`);
    }
    const selected = mask ? new Set(maskedKeys(schema, mask)) : void 0;
    const newShape = {};
    mirrorShape(newShape, schema, Reflect.ownKeys(sourceShape(schema)), Class2 && ((value, key) => selected && !selected.has(key) ? value : new Class2({ type: "optional", innerType: value })));
    return clone(schema, mergeDefs(schema._zod.def, { shape: newShape, checks: [] }));
  }
  function required(Class2, schema, mask) {
    const selected = mask ? new Set(maskedKeys(schema, mask)) : void 0;
    const newShape = {};
    mirrorShape(newShape, schema, Reflect.ownKeys(sourceShape(schema)), (value, key) => (
      // overwrite with non-optional
      selected && !selected.has(key) ? value : new Class2({ type: "nonoptional", innerType: value })
    ));
    return clone(schema, mergeDefs(schema._zod.def, { shape: newShape }));
  }
  function aborted(x, startIndex = 0) {
    if (x.aborted === true)
      return true;
    for (let i = startIndex; i < x.issues.length; i++) {
      if (x.issues[i]?.continue !== true) {
        return true;
      }
    }
    return false;
  }
  function explicitlyAborted(x, startIndex = 0) {
    if (x.aborted === true)
      return true;
    for (let i = startIndex; i < x.issues.length; i++) {
      if (x.issues[i]?.continue === false) {
        return true;
      }
    }
    return false;
  }
  function prefixIssues(path, issues) {
    return issues.map((iss) => {
      var _a3;
      (_a3 = iss).path ?? (_a3.path = []);
      iss.path.unshift(path);
      return iss;
    });
  }
  function unwrapMessage(message) {
    return typeof message === "string" ? message : message?.message;
  }
  function sizeCaps(defChecks) {
    const caps = [];
    for (const ch of defChecks ?? []) {
      const d = ch._zod.def;
      if (!/_(length|size)$|_equals$/.test(d.check))
        break;
      const max = d.maximum ?? d.length ?? d.size;
      if (max >= 0)
        caps.push([max, ch]);
    }
    return caps;
  }
  function attachSchema(issues, start, inst) {
    var _a3;
    for (let i = start; i < issues.length; i++) {
      (_a3 = issues[i]).schema ?? (_a3.schema = inst);
    }
  }
  function finalizeIssue(iss, ctx, config2) {
    var _a3;
    const traits = iss.inst?._zod?.traits;
    if (traits?.has("$ZodType")) {
      if (traits.has("$ZodCheck"))
        (_a3 = iss).schema ?? (_a3.schema = iss.inst);
      else
        iss.schema = iss.inst;
    }
    const schemaError = iss.schema !== iss.inst ? iss.schema?._zod.def?.error : void 0;
    const message = iss.message ? iss.message : unwrapMessage(iss.inst?._zod.def?.error?.(iss)) ?? unwrapMessage(schemaError?.(iss)) ?? unwrapMessage(ctx?.error?.(iss)) ?? unwrapMessage(config2.customError?.(iss)) ?? unwrapMessage(config2.localeError?.(iss)) ?? "Invalid input";
    const full = {};
    for (const k of Object.keys(iss)) {
      if (k === "inst" || k === "schema" || k === "continue" || k === "input" || k === "__proto__")
        continue;
      full[k] = iss[k];
    }
    full.path ?? (full.path = []);
    full.message = message;
    if (ctx?.reportInput) {
      full.input = iss.input;
    }
    return full;
  }
  function getSizableOrigin(input) {
    if (input instanceof Set)
      return "set";
    if (input instanceof Map)
      return "map";
    if (input instanceof File)
      return "file";
    return "unknown";
  }
  var highSurrogate = /[\uD800-\uDBFF]/;
  function codePointLength(str) {
    const units = str.length;
    if (!highSurrogate.test(str))
      return units;
    let count = units;
    for (let i = 0; i < units - 1; i++) {
      if ((str.charCodeAt(i) & 64512) === 55296 && (str.charCodeAt(i + 1) & 64512) === 56320) {
        count--;
        i++;
      }
    }
    return count;
  }
  function getLengthableOrigin(input) {
    if (Array.isArray(input))
      return "array";
    if (typeof input === "string")
      return "string";
    return "unknown";
  }
  function parsedType(data) {
    const t = typeof data;
    switch (t) {
      case "number": {
        return Number.isNaN(data) ? "nan" : "number";
      }
      case "object": {
        if (data === null) {
          return "null";
        }
        if (Array.isArray(data)) {
          return "array";
        }
        const obj = data;
        if (obj && Object.getPrototypeOf(obj) !== Object.prototype && "constructor" in obj && obj.constructor) {
          return obj.constructor.name;
        }
      }
    }
    return t;
  }
  function issue(...args) {
    const [iss, input, inst] = args;
    if (typeof iss === "string") {
      return {
        message: iss,
        code: "custom",
        input,
        inst
      };
    }
    return { ...iss };
  }
  function cleanEnum(obj) {
    return Object.entries(obj).filter(([k, _]) => {
      return Number.isNaN(Number.parseInt(k, 10));
    }).map((el) => el[1]);
  }
  function base64ToUint8Array(base642) {
    const binaryString = atob(base642);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }
  function uint8ArrayToBase64(bytes) {
    let binaryString = "";
    for (let i = 0; i < bytes.length; i++) {
      binaryString += String.fromCharCode(bytes[i]);
    }
    return btoa(binaryString);
  }
  function base64urlToUint8Array(base64url2) {
    const base642 = base64url2.replace(/-/g, "+").replace(/_/g, "/");
    const padding = "=".repeat((4 - base642.length % 4) % 4);
    return base64ToUint8Array(base642 + padding);
  }
  function uint8ArrayToBase64url(bytes) {
    return uint8ArrayToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  }
  function hexToUint8Array(hex) {
    const cleanHex = hex.replace(/^0x/, "");
    if (cleanHex.length % 2 !== 0) {
      throw new Error("Invalid hex string length");
    }
    const bytes = new Uint8Array(cleanHex.length / 2);
    for (let i = 0; i < cleanHex.length; i += 2) {
      bytes[i / 2] = Number.parseInt(cleanHex.slice(i, i + 2), 16);
    }
    return bytes;
  }
  function uint8ArrayToHex(bytes) {
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  var Class = class {
    constructor(..._args) {
    }
  };
  function members(proto, table) {
    for (const key in table) {
      const desc = Object.getOwnPropertyDescriptor(table, key);
      if (desc.get)
        Object.defineProperty(proto, key, { ...desc, enumerable: false });
      else
        defineBound(proto, key, desc.value);
    }
  }
  function own(inst, key, value, enumerable = true) {
    Object.defineProperty(inst, key, { configurable: true, writable: true, enumerable, value });
    return value;
  }
  function hide(inst, key, value) {
    return own(inst, key, value, false);
  }
  // @__NO_SIDE_EFFECTS__
  function derived(computes, table) {
    for (const key in computes) {
      const compute = computes[key];
      Object.defineProperty(table, key, {
        configurable: true,
        enumerable: true,
        get() {
          return own(this, key, compute(this));
        },
        set(value) {
          own(this, key, value);
        }
      });
    }
    return table;
  }
  function defineBound(proto, key, fn) {
    Object.defineProperty(proto, key, {
      configurable: true,
      get() {
        return this == null ? fn : own(this, key, fn.bind(this));
      },
      set(value) {
        own(this, key, value);
      }
    });
  }
  function claim(inst, sentinel) {
    const proto = Object.getPrototypeOf(inst);
    return sentinel in proto ? void 0 : proto;
  }
  var installing;
  var broke = false;
  var breaker = {
    configurable: true,
    get() {
      broke = true;
      return void 0;
    }
  };
  function defineLazyInternal(inst, key, compute) {
    const proto = Object.getPrototypeOf(inst._zod);
    if (key in proto && installing !== inst._zod) {
      installing = void 0;
      return;
    }
    installing = inst._zod;
    Object.defineProperty(proto, key, {
      configurable: true,
      get() {
        Object.defineProperty(this, key, breaker);
        const outer = broke;
        broke = false;
        try {
          const value = compute(this);
          if (broke)
            delete this[key];
          else
            Object.defineProperty(this, key, { configurable: true, writable: true, value });
          broke = broke || outer;
          return value;
        } catch (err) {
          delete this[key];
          broke = broke || outer;
          throw err;
        }
      },
      set(value) {
        Object.defineProperty(this, key, { configurable: true, writable: true, value });
      }
    });
  }
  function installLazyProp(inst, key, make, enumerable) {
    const proto = claim(inst, key);
    if (!proto)
      return;
    Object.defineProperty(proto, key, {
      configurable: true,
      get() {
        const desc = { configurable: true, writable: true, enumerable, value: void 0 };
        Object.defineProperty(this, key, desc);
        desc.value = make(this);
        Object.defineProperty(this, key, desc);
        return desc.value;
      },
      set(value) {
        Object.defineProperty(this, key, { configurable: true, writable: true, enumerable, value });
      }
    });
  }
  var CONSTANT_CATCH = "~constantCatch";
  function constantCatch(value) {
    const fn = () => value;
    fn[CONSTANT_CATCH] = true;
    return fn;
  }

  // node_modules/zod/v4/core/core.js
  var _a;
  var _zodDesc = { value: void 0, enumerable: false };
  var _E = "captureStackTrace" in Error ? Error : null;
  function newError(Definition) {
    const E = _E;
    if (E) {
      const saved = E.stackTraceLimit;
      if (typeof saved === "number") {
        try {
          E.stackTraceLimit = 0;
        } catch {
          _E = null;
          return new Definition();
        }
        try {
          return new Definition();
        } finally {
          E.stackTraceLimit = saved;
        }
      }
    }
    return new Definition();
  }
  // @__NO_SIDE_EFFECTS__
  function $constructor(name, initializer3, proto, params) {
    const zodProto = {};
    function Internals(def) {
      this.def = def;
      this.constr = _;
      this.traits = /* @__PURE__ */ new Set();
    }
    Internals.prototype = zodProto;
    const protoMembers = proto;
    const initialized = protoMembers && /* @__PURE__ */ new WeakSet();
    function init(inst, def) {
      if (!inst._zod) {
        _zodDesc.value = new Internals(def);
        try {
          Object.defineProperty(inst, "_zod", _zodDesc);
        } finally {
          _zodDesc.value = void 0;
        }
      } else if (inst._zod.traits.has(name)) {
        return;
      }
      inst._zod.traits.add(name);
      initializer3(inst, def);
      if (initialized) {
        const own2 = Object.getPrototypeOf(inst);
        const ctorProto = inst._zod.constr.prototype;
        let up = own2;
        while (up && up !== ctorProto)
          up = Object.getPrototypeOf(up);
        const target = up ?? own2;
        if (!initialized.has(target)) {
          initialized.add(target);
          members(target, protoMembers);
        }
      }
      const proto2 = _.prototype;
      for (const k in proto2) {
        if (!Object.prototype.hasOwnProperty.call(proto2, k))
          continue;
        if (!(k in inst)) {
          inst[k] = proto2[k].bind(inst);
        }
      }
    }
    const Parent = params?.Parent ?? Object;
    class Definition extends Parent {
    }
    Object.defineProperty(Definition, "name", { value: name });
    function _(def) {
      const inst = params?.Parent ? newError(Definition) : this;
      init(inst, def);
      const deferred = inst._zod.deferred;
      if (deferred) {
        for (const fn of deferred) {
          fn();
        }
        inst._zod.deferred = void 0;
      }
      const pp = globalThis.__zod_globalConfig?.postProcessor;
      if (pp)
        pp(inst);
      return inst;
    }
    Object.defineProperty(_, "init", { value: init });
    Object.defineProperty(_, Symbol.hasInstance, {
      value: (inst) => {
        if (params?.Parent && inst instanceof params.Parent)
          return true;
        return inst?._zod?.traits?.has(name);
      }
    });
    Object.defineProperty(_, "name", { value: name });
    return _;
  }
  var $ZodAsyncError = class extends Error {
    constructor() {
      super(`Encountered Promise during synchronous parse. Use .parseAsync() instead.`);
    }
  };
  var $ZodEncodeError = class extends Error {
    constructor(name) {
      super(`Encountered unidirectional transform during encode: ${name}`);
      this.name = "ZodEncodeError";
    }
  };
  (_a = globalThis).__zod_globalConfig ?? (_a.__zod_globalConfig = {});
  var globalConfig = globalThis.__zod_globalConfig;
  function config(newConfig) {
    if (newConfig)
      Object.assign(globalConfig, newConfig);
    return globalConfig;
  }

  // node_modules/zod/v4/core/errors.js
  function _getMessage() {
    const internals = this._zod;
    internals.message ?? (internals.message = JSON.stringify(internals.def, jsonStringifyReplacer, 2));
    return internals.message;
  }
  function _setMessage(value) {
    this._zod.message = value;
  }
  var _messageDesc = {
    get: _getMessage,
    set: _setMessage,
    enumerable: true,
    configurable: true
  };
  var _issuesDesc = { value: void 0, enumerable: false };
  var _installedToString = /* @__PURE__ */ new WeakSet([Object.prototype, Error.prototype]);
  var initializer = (inst, def) => {
    inst.name = "$ZodError";
    _issuesDesc.value = def;
    Object.defineProperty(inst, "issues", _issuesDesc);
    _issuesDesc.value = void 0;
    Object.defineProperty(inst, "message", _messageDesc);
    const proto = Object.getPrototypeOf(inst);
    if (!_installedToString.has(proto)) {
      _installedToString.add(proto);
      Object.defineProperty(proto, "toString", {
        configurable: true,
        enumerable: false,
        get() {
          const value = () => this.message;
          Object.defineProperty(this, "toString", { value, configurable: true, writable: true });
          return value;
        },
        set(value) {
          Object.defineProperty(this, "toString", { value, configurable: true, writable: true });
        }
      });
    }
  };
  var $ZodError = $constructor("$ZodError", initializer);
  var $ZodRealError = $constructor("$ZodError", initializer, void 0, {
    Parent: Error
  });
  function node(obj, key, make) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) {
      if (key === "__proto__") {
        Object.defineProperty(obj, key, { value: make(), writable: true, enumerable: true, configurable: true });
      } else {
        obj[key] = make();
      }
    }
    return obj[key];
  }
  function flattenError(error2, mapper = (issue2) => issue2.message) {
    const fieldErrors = {};
    const formErrors = [];
    for (const sub of error2.issues) {
      if (sub.path.length > 0) {
        node(fieldErrors, sub.path[0], () => []).push(mapper(sub));
      } else {
        formErrors.push(mapper(sub));
      }
    }
    return { formErrors, fieldErrors };
  }
  function formatError(error2, mapper = (issue2) => issue2.message) {
    const fieldErrors = { _errors: [] };
    const processError = (error3, path = []) => {
      for (const issue2 of error3.issues) {
        if (issue2.code === "invalid_union" && issue2.errors.length) {
          issue2.errors.map((issues) => processError({ issues }, [...path, ...issue2.path]));
        } else if (issue2.code === "invalid_key") {
          processError({ issues: issue2.issues }, [...path, ...issue2.path]);
        } else if (issue2.code === "invalid_element") {
          processError({ issues: issue2.issues }, [...path, ...issue2.path]);
        } else {
          const fullpath = [...path, ...issue2.path];
          if (fullpath.length === 0) {
            fieldErrors._errors.push(mapper(issue2));
          } else {
            let curr = fieldErrors;
            let i = 0;
            while (i < fullpath.length) {
              const el = fullpath[i];
              const terminal = i === fullpath.length - 1;
              if (el === "_errors") {
                if (terminal)
                  curr._errors.push(mapper(issue2));
                i++;
                continue;
              }
              if (!Object.prototype.hasOwnProperty.call(curr, el)) {
                Object.defineProperty(curr, el, {
                  value: { _errors: [] },
                  enumerable: true,
                  writable: true,
                  configurable: true
                });
              }
              const node2 = curr[el];
              if (terminal) {
                node2._errors.push(mapper(issue2));
              }
              curr = node2;
              i++;
            }
          }
        }
      }
    };
    processError(error2);
    return fieldErrors;
  }

  // node_modules/zod/v4/core/parse.js
  function finalizeParams(callee, params) {
    return { callee: params?.callee ?? callee, Err: params?.Err };
  }
  var _parse = (_Err) => {
    const fn = (schema, value, _ctx, _params) => {
      const ctx = _ctx ? { ..._ctx, async: false } : { async: false };
      const result = schema._zod.run({ value, issues: [] }, ctx);
      if (result instanceof Promise) {
        throw new $ZodAsyncError();
      }
      if (result.issues.length) {
        const e = new (_params?.Err ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
        captureStackTrace(e, _params?.callee ?? fn);
        throw e;
      }
      return result.value;
    };
    return fn;
  };
  var _parseAsync = (_Err) => {
    const fn = async (schema, value, _ctx, params) => {
      const ctx = _ctx ? { ..._ctx, async: true } : { async: true };
      let result = schema._zod.run({ value, issues: [] }, ctx);
      if (result instanceof Promise)
        result = await result;
      if (result.issues.length) {
        const e = new (params?.Err ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
        captureStackTrace(e, params?.callee ?? fn);
        throw e;
      }
      return result.value;
    };
    return fn;
  };
  var _safeParse = (_Err) => (schema, value, _ctx) => {
    const ctx = _ctx ? { ..._ctx, async: false } : { async: false };
    const result = schema._zod.run({ value, issues: [] }, ctx);
    if (result instanceof Promise) {
      throw new $ZodAsyncError();
    }
    return result.issues.length ? failure(_Err, result.issues, ctx) : { success: true, data: result.value };
  };
  function failure(Err, issues, ctx) {
    let error2;
    return {
      success: false,
      get error() {
        if (!error2) {
          error2 = new Err(issues.map((iss) => finalizeIssue(iss, ctx, config())));
          issues = void 0;
          ctx = void 0;
        }
        return error2;
      },
      set error(e) {
        error2 = e;
        issues = void 0;
        ctx = void 0;
      }
    };
  }
  var _safeParseAsync = (_Err) => async (schema, value, _ctx) => {
    const ctx = _ctx ? { ..._ctx, async: true } : { async: true };
    let result = schema._zod.run({ value, issues: [] }, ctx);
    if (result instanceof Promise)
      result = await result;
    return result.issues.length ? failure(_Err, result.issues, ctx) : { success: true, data: result.value };
  };
  var COMPILE_INVALID = /* @__PURE__ */ Symbol.for("zod.compile.invalid");
  var COMPILE_FALLBACK = /* @__PURE__ */ Symbol.for("zod.compile.fallback");
  var validate = ((schema, value, _ctx) => {
    const validator = schema._zod.bag.validator;
    if (validator !== void 0) {
      if (validator(value) !== COMPILE_INVALID)
        return true;
      if (validator.definite === true && _ctx === void 0)
        return false;
    }
    return validateFallback(schema, value, _ctx);
  });
  function validateFallback(schema, value, _ctx) {
    const ctx = _ctx ? { ..._ctx, async: false, abortEarly: true } : { async: false, abortEarly: true };
    const fallbackRun = schema._zod.bag.fallbackRun;
    let result;
    if (fallbackRun) {
      ctx[COMPILE_FALLBACK] = true;
      result = fallbackRun({ value, issues: [] }, ctx);
    } else {
      result = schema._zod.run({ value, issues: [] }, ctx);
    }
    if (result instanceof Promise) {
      throw new $ZodAsyncError();
    }
    return result.issues.length === 0;
  }
  var validateAsync = async (schema, value, _ctx) => {
    const ctx = _ctx ? { ..._ctx, async: true, abortEarly: true } : { async: true, abortEarly: true };
    let result = schema._zod.run({ value, issues: [] }, ctx);
    if (result instanceof Promise)
      result = await result;
    return result.issues.length === 0;
  };
  var _encode = (_Err) => {
    const parse2 = _parse(_Err);
    const fn = (schema, value, _ctx, _params) => {
      const ctx = _ctx ? { ..._ctx, direction: "backward" } : { direction: "backward" };
      return parse2(schema, value, ctx, finalizeParams(fn, _params));
    };
    return fn;
  };
  var _decode = (_Err) => {
    const parse2 = _parse(_Err);
    const fn = (schema, value, _ctx, _params) => {
      return parse2(schema, value, _ctx, finalizeParams(fn, _params));
    };
    return fn;
  };
  var _encodeAsync = (_Err) => {
    const parseAsync2 = _parseAsync(_Err);
    const fn = async (schema, value, _ctx, _params) => {
      const ctx = _ctx ? { ..._ctx, direction: "backward" } : { direction: "backward" };
      return await parseAsync2(schema, value, ctx, finalizeParams(fn, _params));
    };
    return fn;
  };
  var _decodeAsync = (_Err) => {
    const parseAsync2 = _parseAsync(_Err);
    const fn = async (schema, value, _ctx, _params) => {
      return await parseAsync2(schema, value, _ctx, finalizeParams(fn, _params));
    };
    return fn;
  };
  var _safeEncode = (_Err) => (schema, value, _ctx) => {
    const ctx = _ctx ? { ..._ctx, direction: "backward" } : { direction: "backward" };
    return _safeParse(_Err)(schema, value, ctx);
  };
  var _safeDecode = (_Err) => (schema, value, _ctx) => {
    return _safeParse(_Err)(schema, value, _ctx);
  };
  var _safeEncodeAsync = (_Err) => async (schema, value, _ctx) => {
    const ctx = _ctx ? { ..._ctx, direction: "backward" } : { direction: "backward" };
    return _safeParseAsync(_Err)(schema, value, ctx);
  };
  var _safeDecodeAsync = (_Err) => async (schema, value, _ctx) => {
    return _safeParseAsync(_Err)(schema, value, _ctx);
  };

  // node_modules/zod/v4/core/regexes.js
  var cuid = /^[cC][0-9a-z]{6,}$/;
  var cuid2 = /^[0-9a-z]+$/;
  var ulid = /^[0-7][0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{25}$/;
  var xid = /^[0-9a-vA-V]{20}$/;
  var ksuid = /^[A-Za-z0-9]{27}$/;
  var nanoid = /^[a-zA-Z0-9_-]{21}$/;
  function nanoidOfLength(length) {
    return new RegExp(`^[a-zA-Z0-9_-]{${length}}$`);
  }
  var duration = /^P(?:(\d+W)|(?!.*W)(?=\d|T\d)(\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+([.,]\d+)?S)?)?)$/;
  var guid = /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;
  var uuid = (version2) => {
    if (!version2)
      return /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/;
    return new RegExp(`^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-${version2}[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$`);
  };
  var email = /^(?:[A-Za-z0-9_'+\-]+\.)*[A-Za-z0-9_'+\-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/;
  var _emoji = `^(?=[\\s\\S]*[\\p{Extended_Pictographic}\\p{Regional_Indicator}\\u20E3])[\\p{Extended_Pictographic}\\p{Emoji_Component}]+$`;
  function emoji() {
    return new RegExp(_emoji, "u");
  }
  var ipv4 = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
  var ipv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/;
  var cidrv4 = /^((25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/([0-9]|[1-2][0-9]|3[0-2])$/;
  var cidrv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
  var base64 = /^$|^(?:[0-9a-zA-Z+/]{4})*(?:(?:[0-9a-zA-Z+/]{2}==)|(?:[0-9a-zA-Z+/]{3}=))?$/;
  var base64url = /^(?:[A-Za-z0-9_-]{4})*(?:[A-Za-z0-9_-]{2,3})?$/;
  var httpProtocol = /^https?$/;
  var e164 = /^\+[1-9]\d{6,14}$/;
  var dateSource = `(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))`;
  function anchor(source) {
    return new RegExp(`^${source}$`);
  }
  var date = /* @__PURE__ */ anchor(dateSource);
  function timeSource(args) {
    const hhmm = `(?:[01]\\d|2[0-3]):[0-5]\\d`;
    const regex = typeof args.precision === "number" ? args.precision === -1 ? `${hhmm}` : args.precision === 0 ? `${hhmm}:[0-5]\\d` : `${hhmm}:[0-5]\\d\\.\\d{${args.precision}}` : args.seconds ? `${hhmm}:[0-5]\\d(?:\\.\\d+)?` : `${hhmm}(?::[0-5]\\d(?:\\.\\d+)?)?`;
    return regex;
  }
  function time(args) {
    return new RegExp(`^${timeSource(args)}$`);
  }
  function datetime(args) {
    const opts = ["Z"];
    if (args.offset)
      opts.push(`([+-](?:[01]\\d|2[0-3]):[0-5]\\d)`);
    const qualified = `${timeSource({ precision: args.precision, seconds: true })}(?:${opts.join("|")})`;
    const timeRegex = args.local ? `${qualified}|${timeSource({ precision: args.precision })}` : qualified;
    return new RegExp(`^${dateSource}T(?:${timeRegex})$`);
  }
  var anyString = /^[\s\S]{0,}$/;
  var integer = /^-?\d+$/;
  var number = /^-?\d+(?:\.\d+)?$/;
  var boolean = /^(?:true|false)$/i;
  var lowercase = /^[^A-Z]*$/;
  var uppercase = /^[^a-z]*$/;

  // node_modules/zod/v4/core/checks.js
  var $ZodCheck = /* @__PURE__ */ $constructor("$ZodCheck", (inst, def) => {
    var _a3;
    inst._zod ?? (inst._zod = {});
    inst._zod.def = def;
    (_a3 = inst._zod).onattach ?? (_a3.onattach = []);
  });
  var _whenHasLength = (payload) => {
    const val = payload.value;
    return !nullish(val) && val.length !== void 0;
  };
  var numericOriginMap = {
    number: "number",
    bigint: "bigint",
    object: "date"
  };
  var $ZodCheckLessThan = /* @__PURE__ */ $constructor("$ZodCheckLessThan", (inst, def) => {
    $ZodCheck.init(inst, def);
    const origin = numericOriginMap[typeof def.value];
    inst._zod.check = (payload) => {
      if (def.inclusive ? payload.value <= def.value : payload.value < def.value) {
        return;
      }
      payload.issues.push({
        origin: numericOriginMap[typeof payload.value] ?? origin,
        code: "too_big",
        maximum: typeof def.value === "object" ? def.value.getTime() : def.value,
        input: payload.value,
        inclusive: def.inclusive,
        inst,
        continue: !def.abort
      });
    };
  });
  var $ZodCheckGreaterThan = /* @__PURE__ */ $constructor("$ZodCheckGreaterThan", (inst, def) => {
    $ZodCheck.init(inst, def);
    const origin = numericOriginMap[typeof def.value];
    inst._zod.check = (payload) => {
      if (def.inclusive ? payload.value >= def.value : payload.value > def.value) {
        return;
      }
      payload.issues.push({
        origin: numericOriginMap[typeof payload.value] ?? origin,
        code: "too_small",
        minimum: typeof def.value === "object" ? def.value.getTime() : def.value,
        input: payload.value,
        inclusive: def.inclusive,
        inst,
        continue: !def.abort
      });
    };
  });
  var $ZodCheckMultipleOf = /* @__PURE__ */ $constructor("$ZodCheckMultipleOf", (inst, def) => {
    $ZodCheck.init(inst, def);
    inst._zod.check = (payload) => {
      if (typeof payload.value !== typeof def.value)
        throw new Error("Cannot mix number and bigint in multiple_of check.");
      const isMultiple = typeof payload.value === "bigint" ? (
        // `value % 0n` throws, and nothing is a multiple of zero — the number branch already fails this way via NaN
        def.value !== BigInt(0) && payload.value % def.value === BigInt(0)
      ) : floatSafeRemainder(payload.value, def.value) === 0;
      if (isMultiple)
        return;
      payload.issues.push({
        origin: typeof payload.value,
        code: "not_multiple_of",
        divisor: def.value,
        input: payload.value,
        inst,
        continue: !def.abort
      });
    };
  });
  var $ZodCheckNumberFormat = /* @__PURE__ */ $constructor("$ZodCheckNumberFormat", (inst, def) => {
    $ZodCheck.init(inst, def);
    def.format = def.format || "float64";
    const isInt = def.format?.includes("int");
    const origin = isInt ? "int" : "number";
    const [minimum, maximum] = NUMBER_FORMAT_RANGES[def.format];
    inst._zod.check = (payload) => {
      const input = payload.value;
      if (isInt) {
        if (!Number.isInteger(input)) {
          payload.issues.push({
            expected: origin,
            format: def.format,
            code: "invalid_type",
            continue: false,
            input,
            inst
          });
          return;
        }
        if (!Number.isSafeInteger(input)) {
          if (input > 0) {
            payload.issues.push({
              input,
              code: "too_big",
              maximum: Number.MAX_SAFE_INTEGER,
              note: "Integers must be within the safe integer range.",
              inst,
              origin,
              inclusive: true,
              continue: !def.abort
            });
          } else {
            payload.issues.push({
              input,
              code: "too_small",
              minimum: Number.MIN_SAFE_INTEGER,
              note: "Integers must be within the safe integer range.",
              inst,
              origin,
              inclusive: true,
              continue: !def.abort
            });
          }
          return;
        }
      }
      if (input < minimum) {
        payload.issues.push({
          origin: "number",
          input,
          code: "too_small",
          minimum,
          inclusive: true,
          inst,
          continue: !def.abort
        });
      }
      if (input > maximum) {
        payload.issues.push({
          origin: "number",
          input,
          code: "too_big",
          maximum,
          inclusive: true,
          inst,
          continue: !def.abort
        });
      }
    };
  });
  var $ZodCheckMaxLength = /* @__PURE__ */ $constructor("$ZodCheckMaxLength", (inst, def) => {
    var _a3;
    $ZodCheck.init(inst, def);
    (_a3 = inst._zod.def).when ?? (_a3.when = _whenHasLength);
    inst._zod.check = (payload) => {
      const input = payload.value;
      const units = input.length;
      const length = typeof input === "string" && units > def.maximum ? codePointLength(input) : units;
      if (length <= def.maximum)
        return;
      const origin = getLengthableOrigin(input);
      payload.issues.push({
        origin,
        code: "too_big",
        maximum: def.maximum,
        inclusive: true,
        input,
        inst,
        continue: !def.abort
      });
    };
  });
  var $ZodCheckMinLength = /* @__PURE__ */ $constructor("$ZodCheckMinLength", (inst, def) => {
    var _a3;
    $ZodCheck.init(inst, def);
    (_a3 = inst._zod.def).when ?? (_a3.when = _whenHasLength);
    inst._zod.check = (payload) => {
      const input = payload.value;
      const units = input.length;
      const length = typeof input === "string" && units >= def.minimum && units < def.minimum * 2 ? codePointLength(input) : units;
      if (length >= def.minimum)
        return;
      const origin = getLengthableOrigin(input);
      payload.issues.push({
        origin,
        code: "too_small",
        minimum: def.minimum,
        inclusive: true,
        input,
        inst,
        continue: !def.abort
      });
    };
  });
  var $ZodCheckLengthEquals = /* @__PURE__ */ $constructor("$ZodCheckLengthEquals", (inst, def) => {
    var _a3;
    $ZodCheck.init(inst, def);
    (_a3 = inst._zod.def).when ?? (_a3.when = _whenHasLength);
    inst._zod.check = (payload) => {
      const input = payload.value;
      const units = input.length;
      const length = typeof input === "string" && units >= def.length && units <= def.length * 2 ? codePointLength(input) : units;
      if (length === def.length)
        return;
      const origin = getLengthableOrigin(input);
      const tooBig = length > def.length;
      payload.issues.push({
        origin,
        ...tooBig ? { code: "too_big", maximum: def.length } : { code: "too_small", minimum: def.length },
        inclusive: true,
        exact: true,
        input: payload.value,
        inst,
        continue: !def.abort
      });
    };
  });
  var $ZodCheckStringFormat = /* @__PURE__ */ $constructor("$ZodCheckStringFormat", (inst, def) => {
    var _a3, _b;
    $ZodCheck.init(inst, def);
    if (def.pattern)
      (_a3 = inst._zod).check ?? (_a3.check = (payload) => {
        def.pattern.lastIndex = 0;
        if (def.pattern.test(payload.value))
          return;
        payload.issues.push({
          origin: "string",
          code: "invalid_format",
          format: def.format,
          input: payload.value,
          ...def.pattern ? { pattern: def.pattern.toString() } : {},
          inst,
          continue: !def.abort
        });
      });
    else
      (_b = inst._zod).check ?? (_b.check = () => {
      });
  });
  var $ZodCheckRegex = /* @__PURE__ */ $constructor("$ZodCheckRegex", (inst, def) => {
    $ZodCheckStringFormat.init(inst, def);
    inst._zod.check = (payload) => {
      def.pattern.lastIndex = 0;
      if (def.pattern.test(payload.value))
        return;
      payload.issues.push({
        origin: "string",
        code: "invalid_format",
        format: "regex",
        input: payload.value,
        pattern: def.pattern.toString(),
        inst,
        continue: !def.abort
      });
    };
  });
  var $ZodCheckLowerCase = /* @__PURE__ */ $constructor("$ZodCheckLowerCase", (inst, def) => {
    def.pattern ?? (def.pattern = lowercase);
    $ZodCheckStringFormat.init(inst, def);
  });
  var $ZodCheckUpperCase = /* @__PURE__ */ $constructor("$ZodCheckUpperCase", (inst, def) => {
    def.pattern ?? (def.pattern = uppercase);
    $ZodCheckStringFormat.init(inst, def);
  });
  var $ZodCheckIncludes = /* @__PURE__ */ $constructor("$ZodCheckIncludes", (inst, def) => {
    $ZodCheck.init(inst, def);
    const escapedRegex = escapeRegex(def.includes);
    const pattern = new RegExp(typeof def.position === "number" ? `^.{${def.position},}${escapedRegex}` : escapedRegex);
    def.pattern = pattern;
    inst._zod.check = (payload) => {
      if (payload.value.includes(def.includes, def.position))
        return;
      payload.issues.push({
        origin: "string",
        code: "invalid_format",
        format: "includes",
        includes: def.includes,
        input: payload.value,
        inst,
        continue: !def.abort
      });
    };
  });
  var $ZodCheckStartsWith = /* @__PURE__ */ $constructor("$ZodCheckStartsWith", (inst, def) => {
    $ZodCheck.init(inst, def);
    const pattern = new RegExp(`^${escapeRegex(def.prefix)}.*`);
    def.pattern ?? (def.pattern = pattern);
    inst._zod.check = (payload) => {
      if (payload.value.startsWith(def.prefix))
        return;
      payload.issues.push({
        origin: "string",
        code: "invalid_format",
        format: "starts_with",
        prefix: def.prefix,
        input: payload.value,
        inst,
        continue: !def.abort
      });
    };
  });
  var $ZodCheckEndsWith = /* @__PURE__ */ $constructor("$ZodCheckEndsWith", (inst, def) => {
    $ZodCheck.init(inst, def);
    const pattern = new RegExp(`.*${escapeRegex(def.suffix)}$`);
    def.pattern ?? (def.pattern = pattern);
    inst._zod.check = (payload) => {
      if (payload.value.endsWith(def.suffix))
        return;
      payload.issues.push({
        origin: "string",
        code: "invalid_format",
        format: "ends_with",
        suffix: def.suffix,
        input: payload.value,
        inst,
        continue: !def.abort
      });
    };
  });
  var $ZodCheckOverwrite = /* @__PURE__ */ $constructor("$ZodCheckOverwrite", (inst, def) => {
    $ZodCheck.init(inst, def);
    inst._zod.check = (payload) => {
      payload.value = def.tx(payload.value);
    };
  });

  // node_modules/zod/v4/core/doc.js
  var Doc = class {
    constructor(args = [], closed = {}) {
      this.content = [];
      this.indent = 0;
      this.args = args;
      this.closed = closed;
    }
    // the compiler catches a child's throw and keeps writing into this doc, so the indent has to unwind with it
    indented(fn) {
      this.indent += 1;
      try {
        fn(this);
      } finally {
        this.indent -= 1;
      }
    }
    write(arg) {
      if (typeof arg === "function") {
        arg(this, { execution: "sync" });
        arg(this, { execution: "async" });
        return;
      }
      const content = arg;
      const lines = content.split("\n").filter((x) => x);
      const minIndent = Math.min(...lines.map((x) => x.length - x.trimStart().length));
      const dedented = lines.map((x) => x.slice(minIndent)).map((x) => " ".repeat(this.indent * 2) + x);
      for (const line of dedented) {
        this.content.push(line);
      }
    }
    compile() {
      const F = Function;
      const content = this?.content ?? [``];
      const factory = new F(...Object.keys(this.closed), `return function (${this.args.join(", ")}) {
${content.join("\n")}
};`);
      return factory(...Object.values(this.closed));
    }
  };

  // node_modules/zod/v4/core/versions.js
  var version = {
    major: 4,
    minor: 6,
    patch: 7
  };

  // node_modules/zod/v4/core/schemas.js
  var $ZodType = /* @__PURE__ */ $constructor("$ZodType", (inst, def) => {
    var _a3;
    inst ?? (inst = {});
    inst._zod.def = def;
    inst._zod.bag = inst._zod.bag || {};
    inst._zod.version = version;
    const defChecks = inst._zod.def.checks;
    const checks = inst._zod.traits.has("$ZodCheck") ? [inst, ...defChecks ?? []] : defChecks?.length ? [...defChecks] : [];
    for (const ch of checks) {
      for (const fn of ch._zod.onattach) {
        fn(inst);
      }
    }
    if (checks.length === 0) {
      (_a3 = inst._zod).deferred ?? (_a3.deferred = []);
      inst._zod.deferred?.push(() => {
        inst._zod.run = inst._zod.parse;
      });
    } else {
      const runChecks = (payload, checks2, ctx) => {
        if (payload.memo)
          return payload;
        let isAborted = aborted(payload);
        let asyncResult;
        for (const ch of checks2) {
          if (ch._zod.def.when) {
            if (explicitlyAborted(payload))
              continue;
            const shouldRun = ch._zod.def.when(payload);
            if (!shouldRun)
              continue;
          } else if (isAborted) {
            continue;
          }
          const currLen = payload.issues.length;
          const _ = ch._zod.check(payload);
          if (_ instanceof Promise && ctx?.async === false) {
            throw new $ZodAsyncError();
          }
          if (asyncResult || _ instanceof Promise) {
            asyncResult = (asyncResult ?? Promise.resolve()).then(async () => {
              await _;
              const nextLen = payload.issues.length;
              if (nextLen === currLen)
                return;
              attachSchema(payload.issues, currLen, inst);
              if (!isAborted)
                isAborted = aborted(payload, currLen);
            });
          } else {
            const nextLen = payload.issues.length;
            if (nextLen === currLen)
              continue;
            attachSchema(payload.issues, currLen, inst);
            if (!isAborted)
              isAborted = aborted(payload, currLen);
          }
        }
        if (asyncResult) {
          return asyncResult.then(() => {
            return payload;
          });
        }
        return payload;
      };
      const handleCanaryResult = (canary, payload, ctx) => {
        if (aborted(canary)) {
          canary.aborted = true;
          return canary;
        }
        const checkResult = runChecks(payload, checks, ctx);
        if (checkResult instanceof Promise) {
          if (ctx.async === false)
            throw new $ZodAsyncError();
          return checkResult.then((checkResult2) => inst._zod.parse(checkResult2, ctx));
        }
        return inst._zod.parse(checkResult, ctx);
      };
      inst._zod.run = (payload, ctx) => {
        if (ctx.skipChecks) {
          return inst._zod.parse(payload, ctx);
        }
        if (ctx.direction === "backward") {
          const canary = inst._zod.parse({ value: payload.value, issues: [] }, { ...ctx, skipChecks: true });
          if (canary instanceof Promise) {
            return canary.then((canary2) => {
              return handleCanaryResult(canary2, payload, ctx);
            });
          }
          return handleCanaryResult(canary, payload, ctx);
        }
        const result = inst._zod.parse(payload, ctx);
        if (result instanceof Promise) {
          if (ctx.async === false)
            throw new $ZodAsyncError();
          return result.then((result2) => runChecks(result2, checks, ctx));
        }
        return runChecks(result, checks, ctx);
      };
    }
  }, {
    // Wrappers extend this by installing a richer factory over it; reading it eagerly would defeat the laziness.
    get "~standard"() {
      return hide(this, "~standard", standardProps(this));
    },
    set "~standard"(value) {
      own(this, "~standard", value);
    }
  });
  var toStandardResult = (r, ctx) => r.issues.length ? { issues: r.issues.map((iss) => finalizeIssue(iss, ctx, config())) } : { value: r.value };
  async function validateAsync2(inst, value) {
    const ctx = { async: true };
    return toStandardResult(await inst._zod.run({ value, issues: [] }, ctx), ctx);
  }
  function standardProps(inst) {
    return {
      validate: (value) => {
        const ctx = { async: false };
        try {
          const r = inst._zod.run({ value, issues: [] }, ctx);
          if (!(r instanceof Promise))
            return toStandardResult(r, ctx);
        } catch (_) {
        }
        return validateAsync2(inst, value);
      },
      vendor: "zod",
      version: 1
    };
  }
  var $ZodString = /* @__PURE__ */ $constructor("$ZodString", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.pattern = def.pattern ?? anyString;
    inst._zod.parse = (payload, _) => {
      if (def.coerce)
        try {
          payload.value = String(payload.value);
        } catch (_2) {
        }
      if (typeof payload.value === "string")
        return payload;
      payload.issues.push({
        expected: "string",
        code: "invalid_type",
        input: payload.value,
        inst
      });
      return payload;
    };
  });
  var $ZodStringFormat = /* @__PURE__ */ $constructor("$ZodStringFormat", (inst, def) => {
    $ZodCheckStringFormat.init(inst, def);
    $ZodString.init(inst, def);
  });
  var $ZodGUID = /* @__PURE__ */ $constructor("$ZodGUID", (inst, def) => {
    def.pattern ?? (def.pattern = guid);
    $ZodStringFormat.init(inst, def);
  });
  var $ZodUUID = /* @__PURE__ */ $constructor("$ZodUUID", (inst, def) => {
    if (def.version) {
      const versionMap = {
        v1: 1,
        v2: 2,
        v3: 3,
        v4: 4,
        v5: 5,
        v6: 6,
        v7: 7,
        v8: 8
      };
      const v = versionMap[def.version];
      if (v === void 0)
        throw new Error(`Invalid UUID version: "${def.version}"`);
      def.pattern ?? (def.pattern = uuid(v));
    } else
      def.pattern ?? (def.pattern = uuid());
    $ZodStringFormat.init(inst, def);
  });
  var $ZodEmail = /* @__PURE__ */ $constructor("$ZodEmail", (inst, def) => {
    def.pattern ?? (def.pattern = email);
    $ZodStringFormat.init(inst, def);
  });
  var URL_BAD_FORMAT = 1;
  var URL_UNPARSEABLE = 2;
  function canParseURL(input) {
    try {
      if (typeof URL !== "undefined" && typeof URL.canParse === "function")
        return URL.canParse(input);
      new URL(input);
      return true;
    } catch {
      return false;
    }
  }
  function validateURL(trimmed, def) {
    if (!("normalize" in def) && !("hostname" in def) && !("protocol" in def)) {
      return canParseURL(trimmed) || URL_UNPARSEABLE;
    }
    return parseURLObject(trimmed, def);
  }
  function parseURLObject(trimmed, def) {
    if (!def.normalize && def.protocol?.source === httpProtocol.source && !/^https?:\/\//i.test(trimmed)) {
      return URL_BAD_FORMAT;
    }
    try {
      if (typeof URL !== "undefined") {
        const URLStatic = URL;
        if (typeof URLStatic.parse === "function")
          return URLStatic.parse(trimmed) ?? URL_UNPARSEABLE;
      }
      return new URL(trimmed);
    } catch {
      return URL_UNPARSEABLE;
    }
  }
  var asciiTabOrNewline = /[\t\n\r]/g;
  function stripTabAndNewline(value) {
    return value.replace(asciiTabOrNewline, "");
  }
  function urlHostnameOk(url, hostname) {
    hostname.lastIndex = 0;
    return hostname.test(url.hostname);
  }
  function urlProtocolOk(url, protocol) {
    protocol.lastIndex = 0;
    return protocol.test(url.protocol.endsWith(":") ? url.protocol.slice(0, -1) : url.protocol);
  }
  var $ZodURL = /* @__PURE__ */ $constructor("$ZodURL", (inst, def) => {
    $ZodStringFormat.init(inst, def);
    inst._zod.check = (payload) => {
      try {
        const trimmed = payload.value.trim();
        const url = validateURL(trimmed, def);
        if (url === URL_BAD_FORMAT) {
          payload.issues.push({
            code: "invalid_format",
            format: "url",
            note: "Invalid URL format",
            input: payload.value,
            inst,
            continue: !def.abort
          });
          return;
        }
        if (url === URL_UNPARSEABLE) {
          payload.issues.push({
            code: "invalid_format",
            format: "url",
            input: payload.value,
            inst,
            continue: !def.abort
          });
          return;
        }
        if (url === true) {
          payload.value = stripTabAndNewline(trimmed);
          return;
        }
        if (def.hostname && !urlHostnameOk(url, def.hostname)) {
          payload.issues.push({
            code: "invalid_format",
            format: "url",
            note: "Invalid hostname",
            pattern: def.hostname.source,
            input: payload.value,
            inst,
            continue: !def.abort
          });
        }
        if (def.protocol && !urlProtocolOk(url, def.protocol)) {
          payload.issues.push({
            code: "invalid_format",
            format: "url",
            note: "Invalid protocol",
            pattern: def.protocol.source,
            input: payload.value,
            inst,
            continue: !def.abort
          });
        }
        payload.value = def.normalize ? url.href : stripTabAndNewline(trimmed);
        return;
      } catch (_) {
        payload.issues.push({
          code: "invalid_format",
          format: "url",
          input: payload.value,
          inst,
          continue: !def.abort
        });
      }
    };
  });
  var $ZodEmoji = /* @__PURE__ */ $constructor("$ZodEmoji", (inst, def) => {
    def.pattern ?? (def.pattern = emoji());
    $ZodStringFormat.init(inst, def);
  });
  var $ZodNanoID = /* @__PURE__ */ $constructor("$ZodNanoID", (inst, def) => {
    if (def.length !== void 0 && (!Number.isInteger(def.length) || def.length < 1))
      throw new Error(`Invalid nanoid length: ${def.length}`);
    def.pattern ?? (def.pattern = def.length === void 0 ? nanoid : nanoidOfLength(def.length));
    $ZodStringFormat.init(inst, def);
  });
  var $ZodCUID = /* @__PURE__ */ $constructor("$ZodCUID", (inst, def) => {
    def.pattern ?? (def.pattern = cuid);
    $ZodStringFormat.init(inst, def);
  });
  var $ZodCUID2 = /* @__PURE__ */ $constructor("$ZodCUID2", (inst, def) => {
    def.pattern ?? (def.pattern = cuid2);
    $ZodStringFormat.init(inst, def);
  });
  var $ZodULID = /* @__PURE__ */ $constructor("$ZodULID", (inst, def) => {
    def.pattern ?? (def.pattern = ulid);
    $ZodStringFormat.init(inst, def);
  });
  var $ZodXID = /* @__PURE__ */ $constructor("$ZodXID", (inst, def) => {
    def.pattern ?? (def.pattern = xid);
    $ZodStringFormat.init(inst, def);
  });
  var $ZodKSUID = /* @__PURE__ */ $constructor("$ZodKSUID", (inst, def) => {
    def.pattern ?? (def.pattern = ksuid);
    $ZodStringFormat.init(inst, def);
  });
  var $ZodISODateTime = /* @__PURE__ */ $constructor("$ZodISODateTime", (inst, def) => {
    def.pattern ?? (def.pattern = datetime(def));
    $ZodStringFormat.init(inst, def);
  });
  var $ZodISODate = /* @__PURE__ */ $constructor("$ZodISODate", (inst, def) => {
    def.pattern ?? (def.pattern = date);
    $ZodStringFormat.init(inst, def);
  });
  var $ZodISOTime = /* @__PURE__ */ $constructor("$ZodISOTime", (inst, def) => {
    def.pattern ?? (def.pattern = time(def));
    $ZodStringFormat.init(inst, def);
  });
  var $ZodISODuration = /* @__PURE__ */ $constructor("$ZodISODuration", (inst, def) => {
    def.pattern ?? (def.pattern = duration);
    $ZodStringFormat.init(inst, def);
  });
  var $ZodIPv4 = /* @__PURE__ */ $constructor("$ZodIPv4", (inst, def) => {
    def.pattern ?? (def.pattern = ipv4);
    $ZodStringFormat.init(inst, def);
  });
  var ipv6Alphabet = /^[0-9a-fA-F:.]+$/;
  function isValidIPv6(value) {
    if (!ipv6Alphabet.test(value))
      return false;
    return canParseURL(`http://[${value}]`);
  }
  var $ZodIPv6 = /* @__PURE__ */ $constructor("$ZodIPv6", (inst, def) => {
    def.pattern ?? (def.pattern = ipv6);
    $ZodStringFormat.init(inst, def);
    inst._zod.check = (payload) => {
      if (!isValidIPv6(payload.value)) {
        payload.issues.push({
          code: "invalid_format",
          format: "ipv6",
          input: payload.value,
          inst,
          continue: !def.abort
        });
      }
    };
  });
  var $ZodCIDRv4 = /* @__PURE__ */ $constructor("$ZodCIDRv4", (inst, def) => {
    def.pattern ?? (def.pattern = cidrv4);
    $ZodStringFormat.init(inst, def);
  });
  function isValidCIDRv6(value) {
    const parts = value.split("/");
    if (parts.length !== 2)
      return false;
    const [address, prefix] = parts;
    if (!prefix)
      return false;
    const prefixNum = Number(prefix);
    if (`${prefixNum}` !== prefix)
      return false;
    if (prefixNum < 0 || prefixNum > 128)
      return false;
    return isValidIPv6(address);
  }
  var $ZodCIDRv6 = /* @__PURE__ */ $constructor("$ZodCIDRv6", (inst, def) => {
    def.pattern ?? (def.pattern = cidrv6);
    $ZodStringFormat.init(inst, def);
    inst._zod.check = (payload) => {
      if (!isValidCIDRv6(payload.value)) {
        payload.issues.push({
          code: "invalid_format",
          format: "cidrv6",
          input: payload.value,
          inst,
          continue: !def.abort
        });
      }
    };
  });
  function isValidBase64(data) {
    if (data === "")
      return true;
    if (/\s/.test(data))
      return false;
    if (data.length % 4 !== 0)
      return false;
    try {
      atob(data);
      return true;
    } catch {
      return false;
    }
  }
  var base64Charset = /^[0-9a-zA-Z+/]*={0,2}$/;
  var $ZodBase64 = /* @__PURE__ */ $constructor("$ZodBase64", (inst, def) => {
    def.pattern ?? (def.pattern = base64Charset);
    $ZodStringFormat.init(inst, def);
    inst._zod.check = (payload) => {
      if (isValidBase64(payload.value))
        return;
      payload.issues.push({
        code: "invalid_format",
        format: "base64",
        input: payload.value,
        inst,
        continue: !def.abort
      });
    };
  });
  var base64urlCharset = /^[A-Za-z0-9_-]*$/;
  function isValidBase64URL(data) {
    if (!base64urlCharset.test(data))
      return false;
    const base642 = data.replace(/[-_]/g, (c) => c === "-" ? "+" : "/");
    const padded = base642.padEnd(Math.ceil(base642.length / 4) * 4, "=");
    return isValidBase64(padded);
  }
  var $ZodBase64URL = /* @__PURE__ */ $constructor("$ZodBase64URL", (inst, def) => {
    def.pattern ?? (def.pattern = base64urlCharset);
    $ZodStringFormat.init(inst, def);
    inst._zod.check = (payload) => {
      if (isValidBase64URL(payload.value))
        return;
      payload.issues.push({
        code: "invalid_format",
        format: "base64url",
        input: payload.value,
        inst,
        continue: !def.abort
      });
    };
  });
  var $ZodE164 = /* @__PURE__ */ $constructor("$ZodE164", (inst, def) => {
    def.pattern ?? (def.pattern = e164);
    $ZodStringFormat.init(inst, def);
  });
  function isValidJWT(token, algorithm = null) {
    try {
      const tokensParts = token.split(".");
      if (tokensParts.length !== 3)
        return false;
      const [header] = tokensParts;
      if (!header)
        return false;
      const parsedHeader = JSON.parse(atob(header));
      if ("typ" in parsedHeader && parsedHeader?.typ !== "JWT")
        return false;
      if (!parsedHeader.alg)
        return false;
      if (algorithm && (!("alg" in parsedHeader) || parsedHeader.alg !== algorithm))
        return false;
      return true;
    } catch {
      return false;
    }
  }
  var $ZodJWT = /* @__PURE__ */ $constructor("$ZodJWT", (inst, def) => {
    $ZodStringFormat.init(inst, def);
    inst._zod.check = (payload) => {
      if (isValidJWT(payload.value, def.alg))
        return;
      payload.issues.push({
        code: "invalid_format",
        format: "jwt",
        input: payload.value,
        inst,
        continue: !def.abort
      });
    };
  });
  var $ZodNumber = /* @__PURE__ */ $constructor("$ZodNumber", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.pattern = number;
    inst._zod.parse = (payload, _ctx) => {
      if (def.coerce)
        try {
          payload.value = Number(payload.value);
        } catch (_) {
        }
      const input = payload.value;
      if (typeof input === "number" && !Number.isNaN(input) && Number.isFinite(input)) {
        return payload;
      }
      const received = typeof input === "number" ? Number.isNaN(input) ? "NaN" : !Number.isFinite(input) ? String(input) : void 0 : void 0;
      payload.issues.push({
        expected: "number",
        code: "invalid_type",
        input,
        inst,
        ...received ? { received } : {}
      });
      return payload;
    };
  });
  var $ZodNumberFormat = /* @__PURE__ */ $constructor("$ZodNumberFormat", (inst, def) => {
    $ZodCheckNumberFormat.init(inst, def);
    $ZodNumber.init(inst, def);
  });
  var $ZodBoolean = /* @__PURE__ */ $constructor("$ZodBoolean", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.pattern = boolean;
    inst._zod.parse = (payload, _ctx) => {
      if (def.coerce)
        try {
          payload.value = Boolean(payload.value);
        } catch (_) {
        }
      const input = payload.value;
      if (typeof input === "boolean")
        return payload;
      payload.issues.push({
        expected: "boolean",
        code: "invalid_type",
        input,
        inst
      });
      return payload;
    };
  });
  var $ZodUnknown = /* @__PURE__ */ $constructor("$ZodUnknown", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.parse = (payload) => payload;
  });
  var $ZodNever = /* @__PURE__ */ $constructor("$ZodNever", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.parse = (payload, _ctx) => {
      payload.issues.push({
        expected: "never",
        code: "invalid_type",
        input: payload.value,
        inst
      });
      return payload;
    };
  });
  function capSize(inst, size) {
    const caps = sizeCaps(inst._zod.def.checks);
    if (!caps.length)
      return;
    const cap = Math.min(...caps.map((c) => c[0]));
    const parse2 = inst._zod.parse;
    inst._zod.parse = (payload, ctx) => {
      const n = size(payload.value);
      if (n > cap && !ctx?.skipChecks && ctx?.direction !== "backward") {
        for (const [max, ch] of sizeCaps(inst._zod.def.checks)) {
          if (n > max && ch._zod.def.when(payload)) {
            const start = payload.issues.length;
            ch._zod.check(payload);
            payload.issues[start].continue = false;
            attachSchema(payload.issues, start, inst);
            return payload;
          }
        }
      }
      return parse2(payload, ctx);
    };
  }
  var arraySize = (input) => Array.isArray(input) ? input.length : -1;
  function handleArrayResult(result, final, index) {
    if (result.issues.length) {
      final.issues.push(...prefixIssues(index, result.issues));
    }
    final.value[index] = result.value;
  }
  var $ZodArray = /* @__PURE__ */ $constructor("$ZodArray", (inst, def) => {
    $ZodType.init(inst, def);
    const memo2 = globalConfig.memoizer;
    memo2?.attach(inst);
    inst._zod.parse = (payload, ctx) => {
      const input = payload.value;
      if (!Array.isArray(input)) {
        payload.issues.push({
          expected: "array",
          code: "invalid_type",
          input,
          inst
        });
        return payload;
      }
      payload.value = memo2 ? memo2.alloc(inst, payload, Array(input.length), ctx) : Array(input.length);
      const proms = [];
      const abortEarly = ctx?.abortEarly;
      for (let i = 0; i < input.length; i++) {
        const item = input[i];
        const result = def.element._zod.run({
          value: item,
          issues: []
        }, ctx);
        if (result instanceof Promise) {
          proms.push(result.then((result2) => handleArrayResult(result2, payload, i)));
        } else {
          handleArrayResult(result, payload, i);
          if (abortEarly && result.issues.length !== 0 && aborted(result))
            break;
        }
      }
      if (proms.length) {
        return Promise.all(proms).then(() => payload);
      }
      return payload;
    };
    capSize(inst, arraySize);
  });
  function handlePropertyResult(result, final, key, input, optin, optout) {
    const isPresent = key in input;
    const isOptionalOut = optout === "optional";
    if (!isPresent && isOptionalOut && optin === "optional") {
      return;
    }
    if (result.issues.length) {
      if (optin !== void 0 && isOptionalOut && !isPresent) {
        return;
      }
      final.issues.push(...prefixIssues(key, result.issues));
    }
    if (!isPresent && optin === void 0) {
      if (!result.issues.length) {
        final.issues.push({
          code: "invalid_type",
          expected: "nonoptional",
          input: void 0,
          path: [key]
        });
      }
      return;
    }
    if (result.value === void 0) {
      if (isPresent || optin === "defaulted" && !isOptionalOut) {
        final.value[key] = void 0;
      }
    } else {
      final.value[key] = result.value;
    }
  }
  var NO_SYMBOL_KEYS = [];
  function normalizeDef(def) {
    const keys = Object.keys(def.shape);
    const ownSymbols = Object.getOwnPropertySymbols(def.shape);
    const symbolKeys = ownSymbols.length ? ownSymbols : NO_SYMBOL_KEYS;
    const allKeys = symbolKeys.length ? [...keys, ...symbolKeys] : keys;
    for (const k of allKeys) {
      if (!def.shape?.[k]?._zod?.traits?.has("$ZodType")) {
        throw new Error(`Invalid element at key "${String(k)}": expected a Zod schema`);
      }
    }
    const okeys = optionalKeys(def.shape);
    return {
      ...def,
      allKeys,
      symbolKeys,
      // string-only: handleCatchall matches it against `for...in`, which never yields a symbol
      keySet: new Set(keys),
      numKeys: keys.length,
      optionalKeys: new Set(okeys)
    };
  }
  function handleCatchall(proms, input, payload, ctx, def, inst, abortEarly) {
    const unrecognized = [];
    const keySet = def.keySet;
    const _catchall = def.catchall._zod;
    const t = _catchall.def.type;
    const optin = _catchall.optin;
    const optout = _catchall.optout;
    let seen = 0;
    for (const key in input) {
      if (abortEarly && payload.issues.length !== seen) {
        if (aborted(payload, seen))
          break;
        seen = payload.issues.length;
      }
      if (keySet.has(key))
        continue;
      if (key === "__proto__") {
        if (t === "never")
          unrecognized.push(key);
        continue;
      }
      if (t === "never") {
        unrecognized.push(key);
        continue;
      }
      const r = _catchall.run({ value: input[key], issues: [] }, ctx);
      if (r instanceof Promise) {
        proms.push(r.then((r2) => handlePropertyResult(r2, payload, key, input, optin, optout)));
      } else {
        handlePropertyResult(r, payload, key, input, optin, optout);
      }
    }
    if (unrecognized.length) {
      payload.issues.push({
        code: "unrecognized_keys",
        keys: unrecognized,
        input,
        inst,
        // Describes the shape of the input, not the validity of the parsed value, so it never aborts. The parse still fails; the schema's own checks just get to run first, and an enclosing intersection can reconcile the key against a sibling operand.
        continue: true
      });
    }
    if (!proms.length)
      return payload;
    return Promise.all(proms).then(() => {
      return payload;
    });
  }
  var $ZodObject = /* @__PURE__ */ $constructor("$ZodObject", (inst, def) => {
    $ZodType.init(inst, def);
    const desc = Object.getOwnPropertyDescriptor(def, "shape");
    const sh = desc?.get ? desc.get.raw : def.shape ?? {};
    if (sh) {
      const get = () => {
        const newSh = { ...sh };
        Object.defineProperty(def, "shape", { value: newSh });
        get.raw = newSh;
        return newSh;
      };
      get.raw = sh;
      Object.defineProperty(def, "shape", { get });
    }
    const _normalized = cached(() => normalizeDef(def));
    defineLazyInternal(inst, "propValues", (zod) => {
      const shape = zod.def.shape;
      const propValues = {};
      for (const key in shape) {
        const field = shape[key]._zod;
        if (field.values) {
          if (!Object.prototype.hasOwnProperty.call(propValues, key)) {
            assignProp(propValues, key, /* @__PURE__ */ new Set());
          }
          for (const v of field.values)
            propValues[key].add(v);
          if (field.optin !== void 0)
            propValues[key].add(void 0);
        }
      }
      return propValues;
    });
    const isObject2 = isObject;
    const catchall = def.catchall;
    let value;
    const memo2 = globalConfig.memoizer;
    memo2?.attach(inst);
    inst._zod.parse = (payload, ctx) => {
      value ?? (value = _normalized.value);
      const input = payload.value;
      if (!isObject2(input)) {
        payload.issues.push({
          expected: "object",
          code: "invalid_type",
          input,
          inst
        });
        return payload;
      }
      payload.value = memo2 ? memo2.alloc(inst, payload, {}, ctx) : {};
      const proms = [];
      const shape = value.shape;
      const abortEarly = ctx?.abortEarly;
      let seen = payload.issues.length;
      for (const key of value.allKeys) {
        if (abortEarly && payload.issues.length !== seen) {
          if (aborted(payload, seen))
            break;
          seen = payload.issues.length;
        }
        if (key === "__proto__")
          continue;
        const el = shape[key];
        const optin = el._zod.optin;
        const optout = el._zod.optout;
        const r = el._zod.run({ value: input[key], issues: [] }, ctx);
        if (r instanceof Promise) {
          proms.push(r.then((r2) => handlePropertyResult(r2, payload, key, input, optin, optout)));
        } else {
          handlePropertyResult(r, payload, key, input, optin, optout);
        }
      }
      if (!catchall) {
        return proms.length ? Promise.all(proms).then(() => payload) : payload;
      }
      return handleCatchall(proms, input, payload, ctx, _normalized.value, inst, abortEarly === true);
    };
  });
  var $ZodObjectJIT = /* @__PURE__ */ $constructor("$ZodObjectJIT", (inst, def) => {
    $ZodObject.init(inst, def);
    const superParse = inst._zod.parse;
    const _normalized = cached(() => normalizeDef(def));
    const memo2 = globalConfig.memoizer;
    const generateFastpass = (shape) => {
      const normalized = _normalized.value;
      const syms = normalized.symbolKeys;
      const doc = new Doc(["payload", "ctx"], { shape, inst, memo: memo2, syms });
      const parseStr = (k) => `shape[${k}]._zod.run({ value: input[${k}], issues: [] }, ctx)`;
      const prefixStr = (id, k) => `
          let ${id}_ab = false;
          for (let i = 0; i < ${id}.issues.length; i++) {
            const iss = ${id}.issues[i];
            iss.path = iss.path ? [${k}, ...iss.path] : [${k}];
            payload.issues.push(iss);
            if (iss.continue !== true) ${id}_ab = true;
          }
          if (${id}_ab && ctx && ctx.abortEarly) {
            payload.value = newResult;
            return payload;
          }`;
      doc.write(`const input = payload.value;`);
      const ids = /* @__PURE__ */ Object.create(null);
      let counter = 0;
      for (const key of normalized.allKeys) {
        ids[key] = `key_${counter++}`;
      }
      doc.write(memo2 ? `const newResult = memo.alloc(inst, payload, {}, ctx);` : `const newResult = {};`);
      for (const key of normalized.allKeys) {
        if (key === "__proto__")
          continue;
        const id = ids[key];
        const k = typeof key === "symbol" ? `syms[${syms.indexOf(key)}]` : esc(key);
        const isPresent = `${k} in input`;
        const schema = shape[key];
        const optin = schema?._zod?.optin;
        const isOptionalIn = optin !== void 0;
        const isOptionalOut = schema?._zod?.optout === "optional";
        doc.write(`const ${id} = ${parseStr(k)};`);
        if (isOptionalIn && isOptionalOut) {
          const assign = optin === "optional" ? `${id}_present` : `${id}.value !== undefined || ${id}_present`;
          doc.write(`
        const ${id}_present = ${isPresent};
        if (!${id}.issues.length || ${id}_present) {
          if (${id}.issues.length) {${prefixStr(id, k)}
          }

          if (${assign}) {
            newResult[${k}] = ${id}.value;
          }
        }

      `);
        } else if (!isOptionalIn) {
          doc.write(`
        const ${id}_present = ${isPresent};
        if (${id}.issues.length) {${prefixStr(id, k)}
        }
        if (!${id}_present && !${id}.issues.length) {
          payload.issues.push({
            code: "invalid_type",
            expected: "nonoptional",
            input: undefined,
            path: [${k}]
          });
          if (ctx && ctx.abortEarly) {
            payload.value = newResult;
            return payload;
          }
        }

        if (${id}_present) {
          newResult[${k}] = ${id}.value;
        }

      `);
        } else {
          doc.write(`
        if (${id}.issues.length) {${prefixStr(id, k)}
        }
      `);
          if (optin === "defaulted") {
            doc.write(`newResult[${k}] = ${id}.value;`);
          } else {
            doc.write(`
        if (${id}.value !== undefined || ${isPresent}) {
          newResult[${k}] = ${id}.value;
        }
      `);
          }
        }
      }
      doc.write(`payload.value = newResult;`);
      doc.write(`return payload;`);
      return doc.compile();
    };
    let fastpass;
    const isObject2 = isObject;
    const jit = !globalConfig.jitless;
    const allowsEval2 = allowsEval;
    const fastEnabled = jit && allowsEval2.value;
    const catchall = def.catchall;
    let value;
    inst._zod.parse = (payload, ctx) => {
      value ?? (value = _normalized.value);
      const input = payload.value;
      if (!isObject2(input)) {
        payload.issues.push({
          expected: "object",
          code: "invalid_type",
          input,
          inst
        });
        return payload;
      }
      if (jit && fastEnabled && ctx?.async === false && ctx.jitless !== true) {
        if (!fastpass)
          fastpass = generateFastpass(def.shape);
        payload = fastpass(payload, ctx);
        if (!catchall)
          return payload;
        return handleCatchall([], input, payload, ctx, value, inst, ctx?.abortEarly === true);
      }
      return superParse(payload, ctx);
    };
  });
  function handleUnionResults(results, final, inst, ctx) {
    for (const result of results) {
      if (result.issues.length === 0) {
        final.value = result.value;
        return final;
      }
    }
    const nonaborted = results.filter((r) => !aborted(r));
    if (nonaborted.length === 1) {
      final.value = nonaborted[0].value;
      return nonaborted[0];
    }
    final.issues.push({
      code: "invalid_union",
      input: final.value,
      inst,
      errors: results.map((result) => result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
    });
    return final;
  }
  var $ZodUnion = /* @__PURE__ */ $constructor("$ZodUnion", (inst, def) => {
    $ZodType.init(inst, def);
    defineLazyInternal(inst, "optin", (zod) => zod.def.options.some((o) => o._zod.optin === "defaulted") ? "defaulted" : zod.def.options.some((o) => o._zod.optin !== void 0) ? "optional" : void 0);
    defineLazyInternal(inst, "optout", (zod) => zod.def.options.some((o) => o._zod.optout === "optional") ? "optional" : void 0);
    defineLazyInternal(inst, "values", (zod) => {
      if (zod.def.options.every((o) => o._zod.values)) {
        return new Set(zod.def.options.flatMap((option) => Array.from(option._zod.values)));
      }
      return void 0;
    });
    defineLazyInternal(inst, "pattern", (zod) => {
      if (zod.def.options.every((o) => o._zod.pattern)) {
        const patterns = zod.def.options.map((o) => o._zod.pattern);
        return new RegExp(`^(${patterns.map((p) => cleanRegex(p.source)).join("|")})$`);
      }
      return void 0;
    });
    const first = def.options.length === 1 ? def.options[0]._zod.run : null;
    inst._zod.parse = (payload, ctx) => {
      if (first) {
        return first(payload, ctx);
      }
      let async = false;
      const results = [];
      for (const option of def.options) {
        const result = option._zod.run({
          value: payload.value,
          issues: []
        }, ctx);
        if (result instanceof Promise) {
          results.push(result);
          async = true;
        } else {
          if (result.issues.length === 0)
            return result;
          results.push(result);
        }
      }
      if (!async)
        return handleUnionResults(results, payload, inst, ctx);
      return Promise.all(results).then((results2) => {
        return handleUnionResults(results2, payload, inst, ctx);
      });
    };
  });
  function discriminatorMap(def) {
    const map = /* @__PURE__ */ new Map();
    for (const option of def.options) {
      const values = option._zod.propValues?.[def.discriminator];
      if (!values || values.size === 0)
        throw new Error(`Invalid discriminated union option at index "${def.options.indexOf(option)}"`);
      for (const value of values) {
        if (map.has(value)) {
          if (value !== void 0)
            throw new Error(`Duplicate discriminator value "${String(value)}"`);
          map.set(value, null);
        } else {
          map.set(value, option);
        }
      }
    }
    return map;
  }
  var $ZodDiscriminatedUnion = /* @__PURE__ */ $constructor("$ZodDiscriminatedUnion", (inst, def) => {
    def.inclusive = false;
    $ZodUnion.init(inst, def);
    const _super = inst._zod.parse;
    defineLazyInternal(inst, "propValues", (zod) => {
      const propValues = {};
      let undefinedCount = 0;
      for (const option of zod.def.options) {
        const pv = option._zod.propValues;
        if (!pv || Object.keys(pv).length === 0)
          throw new Error(`Invalid discriminated union option at index "${zod.def.options.indexOf(option)}"`);
        if (pv[zod.def.discriminator]?.has(void 0))
          undefinedCount++;
        for (const [k, v] of Object.entries(pv)) {
          if (!Object.prototype.hasOwnProperty.call(propValues, k)) {
            assignProp(propValues, k, /* @__PURE__ */ new Set());
          }
          for (const val of v) {
            propValues[k].add(val);
          }
        }
      }
      if (!zod.def.unionFallback && undefinedCount > 1)
        propValues[zod.def.discriminator]?.delete(void 0);
      return propValues;
    });
    def.options.forEach((option, i) => {
      const propShape = rawShape(option._zod.def);
      if (propShape && !Object.prototype.hasOwnProperty.call(propShape, def.discriminator)) {
        throw new Error(`Invalid discriminated union option at index "${i}"`);
      }
    });
    const disc = cached(() => discriminatorMap(def));
    inst._zod.parse = (payload, ctx) => {
      const input = payload.value;
      if (!isObject(input)) {
        payload.issues.push({
          code: "invalid_type",
          expected: "object",
          input,
          inst
        });
        return payload;
      }
      const value = input?.[def.discriminator];
      const opt = disc.value.get(value);
      if (opt && (value !== void 0 || ctx.direction !== "backward")) {
        return opt._zod.run(payload, ctx);
      }
      if (def.unionFallback || ctx.direction === "backward") {
        return _super(payload, ctx);
      }
      payload.issues.push({
        code: "invalid_union",
        errors: [],
        note: "No matching discriminator",
        discriminator: def.discriminator,
        options: Array.from(disc.value.keys()).filter((value2) => disc.value.get(value2) !== null),
        input,
        path: [def.discriminator],
        inst
      });
      return payload;
    };
  });
  var $ZodIntersection = /* @__PURE__ */ $constructor("$ZodIntersection", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.parse = (payload, ctx) => {
      const input = payload.value;
      const left = def.left._zod.run({ value: input, issues: [] }, ctx);
      const right = def.right._zod.run({ value: input, issues: [] }, ctx);
      const async = left instanceof Promise || right instanceof Promise;
      if (async) {
        return Promise.all([left, right]).then(([left2, right2]) => {
          return handleIntersectionResults(payload, left2, right2);
        });
      }
      return handleIntersectionResults(payload, left, right);
    };
  });
  function mergeValues(a, b) {
    if (a === b) {
      return { valid: true, data: a };
    }
    if (a instanceof Date && b instanceof Date && +a === +b) {
      return { valid: true, data: a };
    }
    if (isPlainObject(a) && isPlainObject(b)) {
      const bKeys = Object.keys(b);
      const sharedKeys = Object.keys(a).filter((key) => bKeys.indexOf(key) !== -1);
      const newObj = { ...a, ...b };
      if (Object.prototype.hasOwnProperty.call(newObj, "__proto__"))
        delete newObj.__proto__;
      for (const key of sharedKeys) {
        if (key === "__proto__")
          continue;
        const sharedValue = mergeValues(a[key], b[key]);
        if (!sharedValue.valid) {
          return {
            valid: false,
            mergeErrorPath: [key, ...sharedValue.mergeErrorPath]
          };
        }
        newObj[key] = sharedValue.data;
      }
      return { valid: true, data: newObj };
    }
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) {
        return { valid: false, mergeErrorPath: [] };
      }
      const newArray = [];
      for (let index = 0; index < a.length; index++) {
        const itemA = a[index];
        const itemB = b[index];
        const sharedValue = mergeValues(itemA, itemB);
        if (!sharedValue.valid) {
          return {
            valid: false,
            mergeErrorPath: [index, ...sharedValue.mergeErrorPath]
          };
        }
        newArray.push(sharedValue.data);
      }
      return { valid: true, data: newArray };
    }
    return { valid: false, mergeErrorPath: [] };
  }
  function handleIntersectionResults(result, left, right) {
    const unrecKeys = /* @__PURE__ */ new Map();
    let unrecIssue;
    const keyIssues = /* @__PURE__ */ new Map();
    const collect = (iss, side) => {
      let keys;
      if (iss.code === "unrecognized_keys" && !iss.path?.length) {
        unrecIssue ?? (unrecIssue = iss);
        keys = iss.keys;
      } else if (iss.code === "invalid_key" && iss.origin === "record" && iss.path?.length === 1) {
        const k = String(iss.path[0]);
        if (!keyIssues.has(k))
          keyIssues.set(k, iss);
        keys = [k];
      } else {
        return false;
      }
      for (const k of keys) {
        if (!unrecKeys.has(k))
          unrecKeys.set(k, {});
        unrecKeys.get(k)[side] = true;
      }
      return true;
    };
    for (const iss of left.issues) {
      if (!collect(iss, "l"))
        result.issues.push(iss);
    }
    for (const iss of right.issues) {
      if (!collect(iss, "r"))
        result.issues.push(iss);
    }
    const bothKeys = [...unrecKeys].filter(([, f]) => f.l && f.r).map(([k]) => k);
    if (bothKeys.length) {
      const aggregated = unrecIssue ? bothKeys.filter((k) => unrecIssue.keys.includes(k)) : [];
      if (aggregated.length)
        result.issues.push({ ...unrecIssue, keys: aggregated });
      for (const k of bothKeys) {
        if (!aggregated.includes(k) && keyIssues.has(k))
          result.issues.push(keyIssues.get(k));
      }
    }
    const merged = mergeValues(left.value, right.value);
    if (!merged.valid) {
      if (aborted(result))
        return result;
      throw new Error(`Unmergable intersection. Error path: ${JSON.stringify(merged.mergeErrorPath)}`);
    }
    result.value = merged.data;
    return result;
  }
  var $ZodRecord = /* @__PURE__ */ $constructor("$ZodRecord", (inst, def) => {
    $ZodType.init(inst, def);
    const memo2 = globalConfig.memoizer;
    memo2?.attach(inst);
    inst._zod.parse = (payload, ctx) => {
      const input = payload.value;
      if (!isPlainObject(input)) {
        payload.issues.push({
          expected: "record",
          code: "invalid_type",
          input,
          inst
        });
        return payload;
      }
      const proms = [];
      const values = def.keyType._zod.values;
      if (values && !def.partial) {
        payload.value = memo2 ? memo2.alloc(inst, payload, {}, ctx) : {};
        const recordKeys = /* @__PURE__ */ new Set();
        for (const key of values) {
          if (typeof key === "string" || typeof key === "number" || typeof key === "symbol") {
            recordKeys.add(typeof key === "number" ? key.toString() : key);
            if (key === "__proto__")
              continue;
            const keyResult = def.keyType._zod.run({ value: key, issues: [] }, ctx);
            if (keyResult instanceof Promise) {
              throw new Error("Async schemas not supported in object keys currently");
            }
            if (keyResult.issues.length) {
              payload.issues.push({
                code: "invalid_key",
                origin: "record",
                issues: keyResult.issues.map((iss) => finalizeIssue(iss, ctx, config())),
                input: key,
                path: [key],
                inst
              });
              continue;
            }
            const outKey = keyResult.value;
            if (outKey === "__proto__")
              continue;
            const result = def.valueType._zod.run({ value: input[key], issues: [] }, ctx);
            if (result instanceof Promise) {
              proms.push(result.then((result2) => {
                if (result2.issues.length) {
                  payload.issues.push(...prefixIssues(key, result2.issues));
                }
                payload.value[outKey] = result2.value;
              }));
            } else {
              if (result.issues.length) {
                payload.issues.push(...prefixIssues(key, result.issues));
              }
              payload.value[outKey] = result.value;
            }
          }
        }
        let unrecognized;
        for (const key in input) {
          if (!recordKeys.has(key)) {
            if (def.mode === "loose") {
              if (key === "__proto__")
                continue;
              payload.value[key] = input[key];
            } else {
              unrecognized = unrecognized ?? [];
              unrecognized.push(key);
            }
          }
        }
        if (unrecognized && unrecognized.length > 0) {
          payload.issues.push({
            code: "unrecognized_keys",
            input,
            inst,
            keys: unrecognized,
            continue: true
          });
        }
      } else {
        payload.value = memo2 ? memo2.alloc(inst, payload, {}, ctx) : {};
        let unrecognized;
        for (const key of Reflect.ownKeys(input)) {
          if (key === "__proto__")
            continue;
          if (!Object.prototype.propertyIsEnumerable.call(input, key))
            continue;
          let keyResult = def.keyType._zod.run({ value: key, issues: [] }, ctx);
          if (keyResult instanceof Promise) {
            throw new Error("Async schemas not supported in object keys currently");
          }
          const checkNumericKey = typeof key === "string" && number.test(key) && keyResult.issues.length;
          if (checkNumericKey) {
            const retryResult = def.keyType._zod.run({ value: Number(key), issues: [] }, ctx);
            if (retryResult instanceof Promise) {
              throw new Error("Async schemas not supported in object keys currently");
            }
            if (retryResult.issues.length === 0) {
              keyResult = retryResult;
            }
          }
          if (keyResult.issues.length) {
            if (def.mode === "loose") {
              payload.value[key] = input[key];
            } else if (values) {
              unrecognized = unrecognized ?? [];
              unrecognized.push(key);
            } else {
              payload.issues.push({
                code: "invalid_key",
                origin: "record",
                issues: keyResult.issues.map((iss) => finalizeIssue(iss, ctx, config())),
                input: key,
                path: [key],
                inst
              });
            }
            continue;
          }
          const outKey = keyResult.value;
          if (outKey === "__proto__")
            continue;
          const result = def.valueType._zod.run({ value: input[key], issues: [] }, ctx);
          if (result instanceof Promise) {
            proms.push(result.then((result2) => {
              if (result2.issues.length) {
                payload.issues.push(...prefixIssues(key, result2.issues));
              }
              payload.value[outKey] = result2.value;
            }));
          } else {
            if (result.issues.length) {
              payload.issues.push(...prefixIssues(key, result.issues));
            }
            payload.value[outKey] = result.value;
          }
        }
        if (unrecognized && unrecognized.length > 0) {
          payload.issues.push({
            code: "unrecognized_keys",
            input,
            inst,
            keys: unrecognized,
            continue: true
          });
        }
      }
      if (proms.length) {
        return Promise.all(proms).then(() => payload);
      }
      return payload;
    };
  });
  var $ZodEnum = /* @__PURE__ */ $constructor("$ZodEnum", (inst, def) => {
    $ZodType.init(inst, def);
    const values = getEnumValues(def.entries);
    const valuesSet = new Set(values);
    inst._zod.values = valuesSet;
    defineLazyInternal(inst, "pattern", (zod) => {
      const patternValues = getEnumValues(zod.def.entries).filter((k) => propertyKeyTypes.has(typeof k));
      return new RegExp(patternValues.length ? `^(${patternValues.map((o) => escapeRegex(o.toString())).join("|")})$` : "^[^\\s\\S]$");
    });
    inst._zod.parse = (payload, _ctx) => {
      const input = payload.value;
      if (valuesSet.has(input)) {
        return payload;
      }
      payload.issues.push({
        code: "invalid_value",
        values,
        input,
        inst
      });
      return payload;
    };
  });
  var $ZodLiteral = /* @__PURE__ */ $constructor("$ZodLiteral", (inst, def) => {
    $ZodType.init(inst, def);
    const values = new Set(def.values);
    inst._zod.values = values;
    defineLazyInternal(inst, "pattern", (zod) => {
      const vals = zod.def.values;
      return new RegExp(vals.length ? `^(${vals.map((o) => typeof o === "string" ? escapeRegex(o) : o ? escapeRegex(o.toString()) : String(o)).join("|")})$` : "^[^\\s\\S]$");
    });
    inst._zod.parse = (payload, _ctx) => {
      const input = payload.value;
      if (values.has(input)) {
        return payload;
      }
      payload.issues.push({
        code: "invalid_value",
        values: def.values,
        input,
        inst
      });
      return payload;
    };
  });
  var $ZodTransform = /* @__PURE__ */ $constructor("$ZodTransform", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.optin = "optional";
    globalConfig.memoizer?.guard(inst);
    inst._zod.parse = (payload, ctx) => {
      if (ctx.direction === "backward") {
        throw new $ZodEncodeError(inst.constructor.name);
      }
      const _out = def.transform(payload.value, payload);
      if (ctx.async) {
        const output = _out instanceof Promise ? _out : Promise.resolve(_out);
        return output.then((output2) => {
          payload.value = output2;
          return payload;
        });
      }
      if (_out instanceof Promise) {
        throw new $ZodAsyncError();
      }
      payload.value = _out;
      return payload;
    };
  });
  function handleOptionalResult(payload, result) {
    payload.value = result.issues.length ? void 0 : result.value;
    return payload;
  }
  var $ZodOptional = /* @__PURE__ */ $constructor("$ZodOptional", (inst, def) => {
    $ZodType.init(inst, def);
    defineLazyInternal(inst, "optin", (zod) => zod.def.innerType._zod.optin === "defaulted" ? "defaulted" : "optional");
    inst._zod.optout = "optional";
    defineLazyInternal(inst, "values", (zod) => {
      const values = zod.def.innerType._zod.values;
      return values ? /* @__PURE__ */ new Set([...values, void 0]) : void 0;
    });
    defineLazyInternal(inst, "pattern", (zod) => {
      const pattern = zod.def.innerType._zod.pattern;
      return pattern ? new RegExp(`^(${cleanRegex(pattern.source)})?$`) : void 0;
    });
    inst._zod.parse = (payload, ctx) => {
      if (payload.value === void 0) {
        if (def.innerType._zod.optin !== "defaulted")
          return payload;
        const result = def.innerType._zod.run({ value: payload.value, issues: [] }, ctx);
        if (result instanceof Promise)
          return result.then((result2) => handleOptionalResult(payload, result2));
        return handleOptionalResult(payload, result);
      }
      return def.innerType._zod.run(payload, ctx);
    };
  });
  var $ZodExactOptional = /* @__PURE__ */ $constructor("$ZodExactOptional", (inst, def) => {
    $ZodOptional.init(inst, def);
    defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
    defineLazyInternal(inst, "pattern", (zod) => zod.def.innerType._zod.pattern);
    inst._zod.parse = (payload, ctx) => {
      return def.innerType._zod.run(payload, ctx);
    };
  });
  var $ZodNullable = /* @__PURE__ */ $constructor("$ZodNullable", (inst, def) => {
    $ZodType.init(inst, def);
    defineLazyInternal(inst, "optin", (zod) => zod.def.innerType._zod.optin);
    defineLazyInternal(inst, "optout", (zod) => zod.def.innerType._zod.optout);
    defineLazyInternal(inst, "pattern", (zod) => {
      const pattern = zod.def.innerType._zod.pattern;
      return pattern ? new RegExp(`^(${cleanRegex(pattern.source)}|null)$`) : void 0;
    });
    defineLazyInternal(inst, "values", (zod) => {
      return zod.def.innerType._zod.values ? /* @__PURE__ */ new Set([...zod.def.innerType._zod.values, null]) : void 0;
    });
    inst._zod.parse = (payload, ctx) => {
      if (payload.value === null)
        return payload;
      return def.innerType._zod.run(payload, ctx);
    };
  });
  var $ZodDefault = /* @__PURE__ */ $constructor("$ZodDefault", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.optin = "defaulted";
    defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
    inst._zod.parse = (payload, ctx) => {
      if (ctx.direction === "backward") {
        return def.innerType._zod.run(payload, ctx);
      }
      if (payload.value === void 0) {
        payload.value = def.defaultValue;
        return payload;
      }
      const result = def.innerType._zod.run(payload, ctx);
      if (result instanceof Promise) {
        return result.then((result2) => handleDefaultResult(result2, def));
      }
      return handleDefaultResult(result, def);
    };
  });
  function handleDefaultResult(payload, def) {
    if (payload.value === void 0) {
      payload.value = def.defaultValue;
    }
    return payload;
  }
  var $ZodPrefault = /* @__PURE__ */ $constructor("$ZodPrefault", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.optin = "defaulted";
    defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
    inst._zod.parse = (payload, ctx) => {
      if (ctx.direction === "backward") {
        return def.innerType._zod.run(payload, ctx);
      }
      if (payload.value === void 0) {
        payload.value = def.defaultValue;
      }
      return def.innerType._zod.run(payload, ctx);
    };
  });
  var $ZodNonOptional = /* @__PURE__ */ $constructor("$ZodNonOptional", (inst, def) => {
    $ZodType.init(inst, def);
    defineLazyInternal(inst, "values", (zod) => {
      const v = zod.def.innerType._zod.values;
      return v ? new Set([...v].filter((x) => x !== void 0)) : void 0;
    });
    inst._zod.parse = (payload, ctx) => {
      const result = def.innerType._zod.run(payload, ctx);
      if (result instanceof Promise) {
        return result.then((result2) => handleNonOptionalResult(result2, inst));
      }
      return handleNonOptionalResult(result, inst);
    };
  });
  function handleNonOptionalResult(payload, inst) {
    if (!payload.issues.length && payload.value === void 0) {
      payload.issues.push({
        code: "invalid_type",
        expected: "nonoptional",
        input: payload.value,
        inst
      });
    }
    return payload;
  }
  function handleCatchResult(payload, result, def, ctx) {
    if (!result.issues.length) {
      payload.value = result.value;
      if (result.memo)
        payload.memo = true;
      return payload;
    }
    payload.value = def.catchValue({
      ...result,
      value: payload.value,
      error: {
        issues: result.issues.map((iss) => finalizeIssue(iss, ctx, config()))
      },
      input: payload.value
    });
    return payload;
  }
  var $ZodCatch = /* @__PURE__ */ $constructor("$ZodCatch", (inst, def) => {
    $ZodType.init(inst, def);
    defineLazyInternal(inst, "optin", (zod) => zod.def.innerType._zod.optin === "defaulted" ? "defaulted" : "optional");
    defineLazyInternal(inst, "optout", (zod) => zod.def.innerType._zod.optout);
    defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
    inst._zod.parse = (payload, ctx) => {
      if (ctx.direction === "backward") {
        return def.innerType._zod.run(payload, ctx);
      }
      const result = def.innerType._zod.run({ value: payload.value, issues: [] }, ctx);
      if (result instanceof Promise) {
        return result.then((result2) => handleCatchResult(payload, result2, def, ctx));
      }
      return handleCatchResult(payload, result, def, ctx);
    };
  });
  var $ZodPipe = /* @__PURE__ */ $constructor("$ZodPipe", (inst, def) => {
    $ZodType.init(inst, def);
    defineLazyInternal(inst, "values", (zod) => zod.def.in._zod.values);
    defineLazyInternal(inst, "optin", (zod) => zod.def.in._zod.optin);
    defineLazyInternal(inst, "optout", (zod) => zod.def.out._zod.optout);
    defineLazyInternal(inst, "propValues", (zod) => zod.def.in._zod.propValues);
    inst._zod.parse = (payload, ctx) => {
      if (ctx.direction === "backward") {
        const right = def.out._zod.run(payload, ctx);
        if (right instanceof Promise) {
          return right.then((right2) => handlePipeResult(right2, def.in, ctx));
        }
        return handlePipeResult(right, def.in, ctx);
      }
      const left = def.in._zod.run(payload, ctx);
      if (left instanceof Promise) {
        return left.then((left2) => handlePipeResult(left2, def.out, ctx));
      }
      return handlePipeResult(left, def.out, ctx);
    };
  });
  function handlePipeResult(left, next, ctx) {
    if (left.issues.some((iss) => iss.code !== "unrecognized_keys")) {
      left.aborted = true;
      return left;
    }
    return next._zod.run({ value: left.value, issues: left.issues }, ctx);
  }
  var $ZodReadonly = /* @__PURE__ */ $constructor("$ZodReadonly", (inst, def) => {
    $ZodType.init(inst, def);
    defineLazyInternal(inst, "propValues", (zod) => zod.def.innerType._zod.propValues);
    defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
    defineLazyInternal(inst, "optin", (zod) => zod.def.innerType?._zod?.optin);
    defineLazyInternal(inst, "optout", (zod) => zod.def.innerType?._zod?.optout);
    inst._zod.parse = (payload, ctx) => {
      if (ctx.direction === "backward") {
        return def.innerType._zod.run(payload, ctx);
      }
      const result = def.innerType._zod.run(payload, ctx);
      if (result instanceof Promise) {
        return result.then(handleReadonlyResult);
      }
      return handleReadonlyResult(result);
    };
  });
  function handleReadonlyResult(payload) {
    if (!payload.memo)
      payload.value = Object.freeze(payload.value);
    return payload;
  }
  var $ZodCustom = /* @__PURE__ */ $constructor("$ZodCustom", (inst, def) => {
    $ZodCheck.init(inst, def);
    $ZodType.init(inst, def);
    inst._zod.parse = (payload, _) => {
      return payload;
    };
    inst._zod.check = (payload) => {
      const input = payload.value;
      const r = def.fn(input);
      if (r instanceof Promise) {
        return r.then((r2) => handleRefineResult(r2, payload, input, inst));
      }
      handleRefineResult(r, payload, input, inst);
      return;
    };
  });
  function handleRefineResult(result, payload, input, inst) {
    if (!result) {
      const _iss = {
        code: "custom",
        input,
        inst,
        // incorporates params.error into issue reporting
        path: [...inst._zod.def.path ?? []],
        // incorporates params.error into issue reporting
        continue: !inst._zod.def.abort
        // params: inst._zod.def.params,
      };
      if (inst._zod.def.params)
        _iss.params = inst._zod.def.params;
      payload.issues.push(issue(_iss));
    }
  }

  // node_modules/zod/v4/core/memoizer.js
  var $ZodCyclicError = class extends Error {
    constructor() {
      super(`Cannot parse a reference cycle that closes through a transform`);
      this.name = "ZodCyclicError";
    }
  };
  var STATE = "~memo";
  var NO_ISSUES = [];
  function isRef(value) {
    return value !== null && typeof value === "object";
  }
  function cloneIssues(issues) {
    return issues.map((iss) => iss.path ? { ...iss, path: iss.path.slice() } : { ...iss });
  }
  var recursive = /* @__PURE__ */ new WeakMap();
  var NONE = 0;
  var ASSUMED = 1;
  var PROVEN = 2;
  function isRecursive(inst, stack, resolve) {
    const cached2 = recursive.get(inst);
    if (cached2 !== void 0)
      return cached2 ? PROVEN : NONE;
    if (stack.has(inst))
      return PROVEN;
    stack.add(inst);
    let result = NONE;
    const check = (child) => {
      if (result !== PROVEN && child?._zod) {
        const answer = isRecursive(child, stack, resolve);
        if (answer > result)
          result = answer;
      }
    };
    const shape = (sh, spread) => {
      let answer = NONE;
      for (const key of Reflect.ownKeys(sh)) {
        const desc = Object.getOwnPropertyDescriptor(sh, key);
        if (spread && !desc.enumerable)
          continue;
        const child = desc.get ? ASSUMED : desc.value?._zod ? isRecursive(desc.value, stack, resolve) : NONE;
        if (child > answer)
          answer = child;
      }
      return answer;
    };
    const merge2 = (answer) => {
      if (answer > result)
        result = answer;
    };
    const def = inst._zod.def;
    const kind = def.type;
    switch (kind) {
      case "object": {
        const raw = rawShape(def);
        merge2(raw ? shape(raw, true) : ASSUMED);
        check(def.catchall);
        break;
      }
      case "array":
        check(def.element);
        break;
      case "tuple":
        for (const el of def.items)
          check(el);
        check(def.rest);
        break;
      case "record":
      case "map":
        check(def.keyType);
        check(def.valueType);
        break;
      case "set":
        check(def.valueType);
        break;
      case "union":
        for (const el of def.options)
          check(el);
        break;
      case "intersection":
        check(def.left);
        check(def.right);
        break;
      case "optional":
      case "nullable":
      case "default":
      case "prefault":
      case "catch":
      case "readonly":
      case "nonoptional":
      case "promise":
      case "success":
        check(def.innerType);
        break;
      case "pipe":
        check(def.in);
        check(def.out);
        break;
      case "function":
        check(def.input);
        check(def.output);
        break;
      // `$ZodLazy` caches its inner on the def, so a resolved edge is followed exactly
      case "lazy": {
        const inner = def._cachedInner ?? (resolve ? inst._zod.innerType : void 0);
        merge2(inner ? isRecursive(inner, stack, false) : ASSUMED);
        break;
      }
      // a leaf by choice: `parts` are regex fragments, not data positions
      case "template_literal":
      // leaves
      case "string":
      case "number":
      case "int":
      case "boolean":
      case "bigint":
      case "symbol":
      case "undefined":
      case "null":
      case "void":
      case "never":
      case "any":
      case "unknown":
      case "date":
      case "nan":
      case "enum":
      case "literal":
      case "file":
      case "transform":
      case "custom":
        break;
      default: {
        kind;
        for (const key in def) {
          const desc = Object.getOwnPropertyDescriptor(def, key);
          if (!desc || desc.get)
            continue;
          const value = desc.value;
          if (!value || typeof value !== "object")
            continue;
          if (value._zod)
            check(value);
          else if (Array.isArray(value))
            for (const el of value)
              check(el);
        }
      }
    }
    stack.delete(inst);
    return settle(inst, result);
  }
  function settle(inst, answer) {
    if (answer !== ASSUMED)
      recursive.set(inst, answer === PROVEN);
    return answer;
  }
  function bucketFor(state, inst) {
    let bucket = state.buckets.get(inst);
    if (!bucket) {
      bucket = /* @__PURE__ */ new WeakMap();
      state.buckets.set(inst, bucket);
    }
    return bucket;
  }
  var handoff;
  var open = [];
  var memo = {
    alloc(_inst, payload, empty) {
      const bucket = handoff;
      if (!bucket)
        return empty;
      handoff = void 0;
      const entry = { value: empty, issues: null };
      bucket.set(payload.value, entry);
      open.push(entry);
      return empty;
    },
    guard(inst) {
      var _a3;
      (_a3 = inst._zod).deferred ?? (_a3.deferred = []);
      inst._zod.deferred.push(() => {
        const base = inst._zod.parse;
        const wrapped = (payload, ctx) => {
          if (ctx.direction !== "backward" && isBackEdge(ctx, payload.value))
            throw new $ZodCyclicError();
          return base(payload, ctx);
        };
        inst._zod.parse = wrapped;
        if (inst._zod.run === base)
          inst._zod.run = wrapped;
      });
    },
    attach(inst) {
      var _a3;
      let isRecursiveInst;
      let rechecked = false;
      let lastCtx;
      let lastBucket;
      (_a3 = inst._zod).deferred ?? (_a3.deferred = []);
      inst._zod.deferred.push(() => {
        const base = inst._zod.parse;
        const wrapped = (payload, ctx) => {
          if (isRecursiveInst === void 0) {
            const walked = isRecursive(inst, /* @__PURE__ */ new Set(), false);
            if (walked === NONE) {
              inst._zod.parse = base;
              if (inst._zod.run === wrapped)
                inst._zod.run = base;
              return base(payload, ctx);
            }
            if (walked === PROVEN || rechecked)
              isRecursiveInst = true;
            else
              rechecked = true;
          }
          const input = payload.value;
          if (!isRef(input))
            return base(payload, ctx);
          let state = ctx[STATE];
          if (!state) {
            state = { buckets: /* @__PURE__ */ new WeakMap(), backEdges: void 0 };
            ctx[STATE] = state;
          }
          let bucket;
          if (lastCtx === ctx) {
            bucket = lastBucket;
          } else {
            bucket = bucketFor(state, inst);
            lastCtx = ctx;
            lastBucket = bucket;
          }
          const hit = bucket.get(input);
          if (hit) {
            payload.value = hit.value;
            if (hit.issues) {
              if (hit.issues.length)
                payload.issues.push(...cloneIssues(hit.issues));
            } else {
              payload.memo = true;
              state.backEdges ?? (state.backEdges = /* @__PURE__ */ new WeakSet());
              state.backEdges.add(hit.value);
            }
            return payload;
          }
          handoff = bucket;
          const depth = open.length;
          const result = base(payload, ctx);
          handoff = void 0;
          const entry = open.length > depth ? open.pop() : void 0;
          if (result instanceof Promise) {
            return result.then((r) => {
              if (entry)
                entry.issues = r.issues.length ? cloneIssues(r.issues) : NO_ISSUES;
              return r;
            });
          }
          if (entry)
            entry.issues = result.issues.length ? cloneIssues(result.issues) : NO_ISSUES;
          return result;
        };
        inst._zod.parse = wrapped;
        if (inst._zod.run === base)
          inst._zod.run = wrapped;
      });
    }
  };
  function memoizer() {
    return memo;
  }
  function isBackEdge(ctx, value) {
    const backEdges = ctx[STATE]?.backEdges;
    return backEdges !== void 0 && isRef(value) && backEdges.has(value);
  }

  // node_modules/zod/v4/locales/en.js
  var error = () => {
    const Sizable = {
      string: { unit: "characters", verb: "to have" },
      file: { unit: "bytes", verb: "to have" },
      array: { unit: "items", verb: "to have" },
      set: { unit: "items", verb: "to have" },
      map: { unit: "entries", verb: "to have" }
    };
    function getSizing(origin) {
      return Sizable[origin] ?? null;
    }
    const FormatDictionary = {
      regex: "input",
      email: "email address",
      url: "URL",
      emoji: "emoji",
      uuid: "UUID",
      uuidv4: "UUIDv4",
      uuidv6: "UUIDv6",
      nanoid: "nanoid",
      guid: "GUID",
      cuid: "cuid",
      cuid2: "cuid2",
      ulid: "ULID",
      xid: "XID",
      ksuid: "KSUID",
      datetime: "ISO datetime",
      date: "ISO date",
      time: "ISO time",
      duration: "ISO duration",
      ipv4: "IPv4 address",
      ipv6: "IPv6 address",
      mac: "MAC address",
      cidrv4: "IPv4 range",
      cidrv6: "IPv6 range",
      base64: "base64-encoded string",
      base64url: "base64url-encoded string",
      json_string: "JSON string",
      e164: "E.164 number",
      currency_code: "currency code",
      credit_card: "credit card number",
      iban: "IBAN",
      jwt: "JWT",
      template_literal: "input"
    };
    const TypeDictionary = {
      // Compatibility: "nan" -> "NaN" for display
      nan: "NaN"
      // All other type names omitted - they fall back to raw values via ?? operator
    };
    function getTypeName(type, input) {
      if (type === "number" && typeof input === "number" && !Number.isFinite(input)) {
        return String(input);
      }
      return TypeDictionary[type] ?? type;
    }
    return (issue2) => {
      switch (issue2.code) {
        case "invalid_type": {
          const expected = getTypeName(issue2.expected);
          const receivedType = parsedType(issue2.input);
          const received = getTypeName(receivedType, issue2.input);
          return `Invalid input: expected ${expected}, received ${received}`;
        }
        case "invalid_value":
          if (issue2.values.length === 1)
            return `Invalid input: expected ${stringifyPrimitive(issue2.values[0])}`;
          return `Invalid option: expected one of ${joinValues(issue2.values, "|")}`;
        case "too_big": {
          const adj = issue2.exact ? "exactly " : issue2.inclusive ? "<=" : "<";
          const sizing2 = getSizing(issue2.origin);
          if (sizing2)
            return `Too big: expected ${issue2.origin ?? "value"} to have ${adj}${issue2.maximum.toString()} ${sizing2.unit ?? "elements"}`;
          return `Too big: expected ${issue2.origin ?? "value"} to be ${adj}${issue2.maximum.toString()}`;
        }
        case "too_small": {
          const adj = issue2.exact ? "exactly " : issue2.inclusive ? ">=" : ">";
          const sizing2 = getSizing(issue2.origin);
          if (sizing2) {
            return `Too small: expected ${issue2.origin} to have ${adj}${issue2.minimum.toString()} ${sizing2.unit}`;
          }
          return `Too small: expected ${issue2.origin} to be ${adj}${issue2.minimum.toString()}`;
        }
        case "invalid_format": {
          const _issue = issue2;
          if (_issue.format === "starts_with") {
            return `Invalid string: must start with "${_issue.prefix}"`;
          }
          if (_issue.format === "ends_with")
            return `Invalid string: must end with "${_issue.suffix}"`;
          if (_issue.format === "includes")
            return `Invalid string: must include "${_issue.includes}"`;
          if (_issue.format === "regex")
            return `Invalid string: must match pattern ${_issue.pattern}`;
          return `Invalid ${FormatDictionary[_issue.format] ?? issue2.format}`;
        }
        case "not_multiple_of":
          return `Invalid number: must be a multiple of ${issue2.divisor}`;
        case "unrecognized_keys":
          return `Unrecognized key${issue2.keys.length > 1 ? "s" : ""}: ${joinValues(issue2.keys, ", ")}`;
        case "invalid_key":
          return `Invalid key in ${issue2.origin}`;
        case "invalid_union":
          if (issue2.options && Array.isArray(issue2.options) && issue2.options.length > 0) {
            const opts = issue2.options.map((o) => `'${o}'`).join(" | ");
            return `Invalid discriminator value. Expected ${opts}`;
          }
          if (issue2.inclusive === false) {
            return "Invalid input: more than one option matched";
          }
          return "Invalid input";
        case "invalid_element":
          return `Invalid value in ${issue2.origin}`;
        default:
          return `Invalid input`;
      }
    };
  };
  function en_default() {
    return {
      localeError: error()
    };
  }

  // node_modules/zod/v4/core/registries.js
  var _a2;
  var $ZodRegistry = class {
    constructor() {
      this._map = /* @__PURE__ */ new WeakMap();
      this._idmap = /* @__PURE__ */ new Map();
    }
    add(schema, ..._meta) {
      const meta2 = _meta[0];
      this._map.set(schema, meta2);
      if (meta2 && typeof meta2 === "object" && "id" in meta2) {
        this._idmap.set(meta2.id, schema);
      }
      return this;
    }
    clear() {
      this._map = /* @__PURE__ */ new WeakMap();
      this._idmap = /* @__PURE__ */ new Map();
      return this;
    }
    remove(schema) {
      const meta2 = this._map.get(schema);
      if (meta2 && typeof meta2 === "object" && "id" in meta2) {
        this._idmap.delete(meta2.id);
      }
      this._map.delete(schema);
      return this;
    }
    get(schema) {
      const p = schema._zod.parent;
      if (p) {
        const pm = { ...this.get(p) ?? {} };
        delete pm.id;
        const f = { ...pm, ...this._map.get(schema) };
        return Object.keys(f).length ? f : void 0;
      }
      return this._map.get(schema);
    }
    has(schema) {
      return this._map.has(schema);
    }
  };
  function registry() {
    return new $ZodRegistry();
  }
  (_a2 = globalThis).__zod_globalRegistry ?? (_a2.__zod_globalRegistry = registry());
  var globalRegistry = globalThis.__zod_globalRegistry;

  // node_modules/zod/v4/core/api.js
  function snapshotChecks(def) {
    if (def.checks)
      def.checks = [...def.checks];
    return def;
  }
  // @__NO_SIDE_EFFECTS__
  function _string(Class2, params) {
    return new Class2(snapshotChecks({ type: "string", ...normalizeParams(params) }));
  }
  // @__NO_SIDE_EFFECTS__
  function _email(Class2, params) {
    return new Class2({
      type: "string",
      format: "email",
      check: "string_format",
      abort: false,
      ...normalizeParams(params)
    });
  }
  // @__NO_SIDE_EFFECTS__
  function _guid(Class2, params) {
    return new Class2({
      type: "string",
      format: "guid",
      check: "string_format",
      abort: false,
      ...normalizeParams(params)
    });
  }
  // @__NO_SIDE_EFFECTS__
  function _uuid(Class2, params) {
    return new Class2({
      type: "string",
      format: "uuid",
      check: "string_format",
      abort: false,
      ...normalizeParams(params)
    });
  }
  // @__NO_SIDE_EFFECTS__
  function _uuidv4(Class2, params) {
    return new Class2({
      type: "string",
      format: "uuid",
      check: "string_format",
      abort: false,
      version: "v4",
      ...normalizeParams(params)
    });
  }
  // @__NO_SIDE_EFFECTS__
  function _uuidv6(Class2, params) {
    return new Class2({
      type: "string",
      format: "uuid",
      check: "string_format",
      abort: false,
      version: "v6",
      ...normalizeParams(params)
    });
  }
  // @__NO_SIDE_EFFECTS__
  function _uuidv7(Class2, params) {
    return new Class2({
      type: "string",
      format: "uuid",
      check: "string_format",
      abort: false,
      version: "v7",
      ...normalizeParams(params)
    });
  }
  // @__NO_SIDE_EFFECTS__
  function _url(Class2, params) {
    return new Class2({
      type: "string",
      format: "url",
      check: "string_format",
      abort: false,
      ...normalizeParams(params)
    });
  }
  // @__NO_SIDE_EFFECTS__
  function _emoji2(Class2, params) {
    return new Class2({
      type: "string",
      format: "emoji",
      check: "string_format",
      abort: false,
      ...normalizeParams(params)
    });
  }
  // @__NO_SIDE_EFFECTS__
  function _nanoid(Class2, params) {
    return new Class2({
      type: "string",
      format: "nanoid",
      check: "string_format",
      abort: false,
      ...normalizeParams(params)
    });
  }
  // @__NO_SIDE_EFFECTS__
  function _cuid(Class2, params) {
    return new Class2({
      type: "string",
      format: "cuid",
      check: "string_format",
      abort: false,
      ...normalizeParams(params)
    });
  }
  // @__NO_SIDE_EFFECTS__
  function _cuid2(Class2, params) {
    return new Class2({
      type: "string",
      format: "cuid2",
      check: "string_format",
      abort: false,
      ...normalizeParams(params)
    });
  }
  // @__NO_SIDE_EFFECTS__
  function _ulid(Class2, params) {
    return new Class2({
      type: "string",
      format: "ulid",
      check: "string_format",
      abort: false,
      ...normalizeParams(params)
    });
  }
  // @__NO_SIDE_EFFECTS__
  function _xid(Class2, params) {
    return new Class2({
      type: "string",
      format: "xid",
      check: "string_format",
      abort: false,
      ...normalizeParams(params)
    });
  }
  // @__NO_SIDE_EFFECTS__
  function _ksuid(Class2, params) {
    return new Class2({
      type: "string",
      format: "ksuid",
      check: "string_format",
      abort: false,
      ...normalizeParams(params)
    });
  }
  // @__NO_SIDE_EFFECTS__
  function _ipv4(Class2, params) {
    return new Class2({
      type: "string",
      format: "ipv4",
      check: "string_format",
      abort: false,
      ...normalizeParams(params)
    });
  }
  // @__NO_SIDE_EFFECTS__
  function _ipv6(Class2, params) {
    return new Class2({
      type: "string",
      format: "ipv6",
      check: "string_format",
      abort: false,
      ...normalizeParams(params)
    });
  }
  // @__NO_SIDE_EFFECTS__
  function _cidrv4(Class2, params) {
    return new Class2({
      type: "string",
      format: "cidrv4",
      check: "string_format",
      abort: false,
      ...normalizeParams(params)
    });
  }
  // @__NO_SIDE_EFFECTS__
  function _cidrv6(Class2, params) {
    return new Class2({
      type: "string",
      format: "cidrv6",
      check: "string_format",
      abort: false,
      ...normalizeParams(params)
    });
  }
  // @__NO_SIDE_EFFECTS__
  function _base64(Class2, params) {
    return new Class2({
      type: "string",
      format: "base64",
      check: "string_format",
      abort: false,
      ...normalizeParams(params)
    });
  }
  // @__NO_SIDE_EFFECTS__
  function _base64url(Class2, params) {
    return new Class2({
      type: "string",
      format: "base64url",
      check: "string_format",
      abort: false,
      ...normalizeParams(params)
    });
  }
  // @__NO_SIDE_EFFECTS__
  function _e164(Class2, params) {
    return new Class2({
      type: "string",
      format: "e164",
      check: "string_format",
      abort: false,
      ...normalizeParams(params)
    });
  }
  // @__NO_SIDE_EFFECTS__
  function _jwt(Class2, params) {
    return new Class2({
      type: "string",
      format: "jwt",
      check: "string_format",
      abort: false,
      ...normalizeParams(params)
    });
  }
  // @__NO_SIDE_EFFECTS__
  function _isoDateTime(Class2, params) {
    return new Class2({
      type: "string",
      format: "datetime",
      check: "string_format",
      offset: false,
      local: false,
      precision: null,
      ...normalizeParams(params)
    });
  }
  // @__NO_SIDE_EFFECTS__
  function _isoDate(Class2, params) {
    return new Class2({
      type: "string",
      format: "date",
      check: "string_format",
      ...normalizeParams(params)
    });
  }
  // @__NO_SIDE_EFFECTS__
  function _isoTime(Class2, params) {
    return new Class2({
      type: "string",
      format: "time",
      check: "string_format",
      precision: null,
      ...normalizeParams(params)
    });
  }
  // @__NO_SIDE_EFFECTS__
  function _isoDuration(Class2, params) {
    return new Class2({
      type: "string",
      format: "duration",
      check: "string_format",
      ...normalizeParams(params)
    });
  }
  // @__NO_SIDE_EFFECTS__
  function _number(Class2, params) {
    return new Class2(snapshotChecks({ type: "number", checks: [], ...normalizeParams(params) }));
  }
  // @__NO_SIDE_EFFECTS__
  function _int(Class2, params) {
    return new Class2({
      type: "number",
      check: "number_format",
      abort: false,
      format: "safeint",
      ...normalizeParams(params)
    });
  }
  // @__NO_SIDE_EFFECTS__
  function _boolean(Class2, params) {
    return new Class2({
      type: "boolean",
      ...normalizeParams(params)
    });
  }
  // @__NO_SIDE_EFFECTS__
  function _unknown(Class2) {
    return new Class2({
      type: "unknown"
    });
  }
  // @__NO_SIDE_EFFECTS__
  function _never(Class2, params) {
    return new Class2({
      type: "never",
      ...normalizeParams(params)
    });
  }
  // @__NO_SIDE_EFFECTS__
  function _lt(value, params) {
    return new $ZodCheckLessThan({
      check: "less_than",
      ...normalizeParams(params),
      value,
      inclusive: false
    });
  }
  // @__NO_SIDE_EFFECTS__
  function _lte(value, params) {
    return new $ZodCheckLessThan({
      check: "less_than",
      ...normalizeParams(params),
      value,
      inclusive: true
    });
  }
  // @__NO_SIDE_EFFECTS__
  function _gt(value, params) {
    return new $ZodCheckGreaterThan({
      check: "greater_than",
      ...normalizeParams(params),
      value,
      inclusive: false
    });
  }
  // @__NO_SIDE_EFFECTS__
  function _gte(value, params) {
    return new $ZodCheckGreaterThan({
      check: "greater_than",
      ...normalizeParams(params),
      value,
      inclusive: true
    });
  }
  // @__NO_SIDE_EFFECTS__
  function _multipleOf(value, params) {
    return new $ZodCheckMultipleOf({
      check: "multiple_of",
      ...normalizeParams(params),
      value
    });
  }
  // @__NO_SIDE_EFFECTS__
  function _maxLength(maximum, params) {
    const ch = new $ZodCheckMaxLength({
      check: "max_length",
      ...normalizeParams(params),
      maximum
    });
    return ch;
  }
  // @__NO_SIDE_EFFECTS__
  function _minLength(minimum, params) {
    return new $ZodCheckMinLength({
      check: "min_length",
      ...normalizeParams(params),
      minimum
    });
  }
  // @__NO_SIDE_EFFECTS__
  function _length(length, params) {
    return new $ZodCheckLengthEquals({
      check: "length_equals",
      ...normalizeParams(params),
      length
    });
  }
  // @__NO_SIDE_EFFECTS__
  function _regex(pattern, params) {
    return new $ZodCheckRegex({
      check: "string_format",
      format: "regex",
      ...normalizeParams(params),
      pattern
    });
  }
  // @__NO_SIDE_EFFECTS__
  function _lowercase(params) {
    return new $ZodCheckLowerCase({
      check: "string_format",
      format: "lowercase",
      ...normalizeParams(params)
    });
  }
  // @__NO_SIDE_EFFECTS__
  function _uppercase(params) {
    return new $ZodCheckUpperCase({
      check: "string_format",
      format: "uppercase",
      ...normalizeParams(params)
    });
  }
  // @__NO_SIDE_EFFECTS__
  function _includes(includes, params) {
    return new $ZodCheckIncludes({
      check: "string_format",
      format: "includes",
      ...normalizeParams(params),
      includes
    });
  }
  // @__NO_SIDE_EFFECTS__
  function _startsWith(prefix, params) {
    return new $ZodCheckStartsWith({
      check: "string_format",
      format: "starts_with",
      ...normalizeParams(params),
      prefix
    });
  }
  // @__NO_SIDE_EFFECTS__
  function _endsWith(suffix, params) {
    return new $ZodCheckEndsWith({
      check: "string_format",
      format: "ends_with",
      ...normalizeParams(params),
      suffix
    });
  }
  // @__NO_SIDE_EFFECTS__
  function _overwrite(tx) {
    return new $ZodCheckOverwrite({
      check: "overwrite",
      tx
    });
  }
  // @__NO_SIDE_EFFECTS__
  function _normalize(form) {
    return /* @__PURE__ */ _overwrite((input) => input.normalize(form));
  }
  // @__NO_SIDE_EFFECTS__
  function _trim() {
    return /* @__PURE__ */ _overwrite((input) => input.trim());
  }
  // @__NO_SIDE_EFFECTS__
  function _toLowerCase() {
    return /* @__PURE__ */ _overwrite((input) => input.toLowerCase());
  }
  // @__NO_SIDE_EFFECTS__
  function _toUpperCase() {
    return /* @__PURE__ */ _overwrite((input) => input.toUpperCase());
  }
  // @__NO_SIDE_EFFECTS__
  function _slugify() {
    return /* @__PURE__ */ _overwrite((input) => slugify(input));
  }
  // @__NO_SIDE_EFFECTS__
  function _array(Class2, element, params) {
    return new Class2({
      type: "array",
      element,
      // get element() {
      //   return element;
      // },
      ...normalizeParams(params)
    });
  }
  // @__NO_SIDE_EFFECTS__
  function _refine(Class2, fn, _params) {
    const schema = new Class2({
      type: "custom",
      check: "custom",
      fn,
      ...normalizeParams(_params)
    });
    return schema;
  }
  // @__NO_SIDE_EFFECTS__
  function _superRefine(fn, params) {
    const ch = /* @__PURE__ */ _check((payload) => {
      payload.addIssue = (issue2) => {
        if (typeof issue2 === "string") {
          payload.issues.push(issue(issue2, payload.value, ch._zod.def));
        } else {
          const _issue = issue2;
          if (_issue.fatal)
            _issue.continue = false;
          _issue.code ?? (_issue.code = "custom");
          if (!("input" in _issue))
            _issue.input = payload.value;
          _issue.inst ?? (_issue.inst = ch);
          _issue.continue ?? (_issue.continue = !ch._zod.def.abort);
          payload.issues.push(issue(_issue));
        }
      };
      return fn(payload.value, payload);
    }, params);
    return ch;
  }
  // @__NO_SIDE_EFFECTS__
  function _check(fn, params) {
    const ch = new $ZodCheck({
      check: "custom",
      ...normalizeParams(params)
    });
    ch._zod.check = fn;
    return ch;
  }

  // node_modules/zod/v4/core/to-json-schema.js
  function assignProps(target, ...sources) {
    for (const source of sources) {
      for (const key of Reflect.ownKeys(source)) {
        if (Object.prototype.propertyIsEnumerable.call(source, key)) {
          assignProp(target, key, source[key]);
        }
      }
    }
    return target;
  }
  function initializeContext(params) {
    let target = params?.target ?? "draft-2020-12";
    if (target === "draft-4")
      target = "draft-04";
    if (target === "draft-7")
      target = "draft-07";
    return {
      processors: params.processors ?? {},
      metadataRegistry: params?.metadata ?? globalRegistry,
      target,
      unrepresentable: params?.unrepresentable ?? "throw",
      override: params?.override ?? (() => {
      }),
      io: params?.io ?? "output",
      counter: 0,
      seen: /* @__PURE__ */ new Map(),
      sharedDefsExtractedFor: void 0,
      sharedEmitDoneFor: void 0,
      cycles: params?.cycles ?? "ref",
      reused: params?.reused ?? "inline",
      intersections: [],
      deferred: [],
      external: params?.external ?? void 0
    };
  }
  function handleUnrepresentable(schema, ctx, json, params, message) {
    const result = typeof ctx.unrepresentable === "function" ? ctx.unrepresentable({ zodSchema: schema, path: params.path, message }) : ctx.unrepresentable;
    if (result === "any")
      return false;
    if (result === void 0 || result === "throw")
      throw new Error(message);
    Object.assign(json, result);
    return true;
  }
  function processSchema(schema, ctx, _params = { path: [], schemaPath: [] }) {
    var _a3;
    const def = schema._zod.def;
    const seen = ctx.seen.get(schema);
    if (seen) {
      seen.count++;
      const isCycle = _params.schemaPath.includes(schema);
      if (isCycle) {
        seen.cycle = _params.path;
      }
      return seen.schema;
    }
    const result = { schema: {}, count: 1, cycle: void 0, path: _params.path };
    ctx.seen.set(schema, result);
    ctx.sharedDefsExtractedFor = void 0;
    ctx.sharedEmitDoneFor = void 0;
    const overrideSchema = schema._zod.toJSONSchema?.();
    if (overrideSchema) {
      result.schema = overrideSchema;
    } else {
      const params = {
        ..._params,
        schemaPath: [..._params.schemaPath, schema],
        path: _params.path
      };
      if (schema._zod.processJSONSchema) {
        schema._zod.processJSONSchema(ctx, result.schema, params);
      } else {
        const _json = result.schema;
        const processor = ctx.processors[def.type];
        if (!processor) {
          throw new Error(`[toJSONSchema]: Non-representable type encountered: ${def.type}`);
        }
        processor(schema, ctx, _json, params);
      }
      const parent = schema._zod.parent;
      if (parent) {
        if (!result.ref)
          result.ref = parent;
        processSchema(parent, ctx, params);
        ctx.seen.get(parent).isParent = true;
      }
    }
    const meta2 = ctx.metadataRegistry.get(schema);
    if (meta2)
      assignProps(result.schema, meta2);
    if (ctx.io === "input" && isTransforming(schema)) {
      delete result.schema.examples;
      delete result.schema.default;
    }
    if (ctx.io === "input" && "_prefault" in result.schema)
      (_a3 = result.schema).default ?? (_a3.default = result.schema._prefault);
    delete result.schema._prefault;
    const _result = ctx.seen.get(schema);
    return _result.schema;
  }
  function encodeJSONPointerSegment(segment) {
    return segment.replace(/~/g, "~0").replace(/\//g, "~1");
  }
  function extractDefs(ctx, schema) {
    const root = ctx.seen.get(schema);
    if (!root)
      throw new Error("Unprocessed schema. This is a bug in Zod.");
    if (ctx.external && ctx.sharedDefsExtractedFor === ctx.external)
      return;
    const idToSchema = /* @__PURE__ */ new Map();
    for (const entry of ctx.seen.entries()) {
      const id = ctx.metadataRegistry.get(entry[0])?.id;
      if (id) {
        const existing = idToSchema.get(id);
        if (existing && existing !== entry[0]) {
          throw new Error(`Duplicate schema id "${id}" detected during JSON Schema conversion. Two different schemas cannot share the same id when converted together.`);
        }
        idToSchema.set(id, entry[0]);
      }
    }
    const makeURI = (entry) => {
      const defsSegment = ctx.target === "draft-2020-12" ? "$defs" : "definitions";
      if (ctx.external) {
        const externalId = ctx.external.registry.get(entry[0])?.id;
        const uriGenerator = ctx.external.uri ?? ((id2) => id2);
        if (externalId) {
          return { ref: uriGenerator(externalId) };
        }
        const id = entry[1].defId ?? entry[1].schema.id ?? `schema${ctx.counter++}`;
        entry[1].defId = id;
        return { defId: id, ref: `${uriGenerator("__shared")}#/${defsSegment}/${encodeJSONPointerSegment(id)}` };
      }
      const uriPrefix = `#`;
      const defUriPrefix = `${uriPrefix}/${defsSegment}/`;
      if (entry[1] === root && !entry[1].schema.id) {
        return { ref: uriPrefix };
      }
      const defId = entry[1].schema.id ?? `__schema${ctx.counter++}`;
      return { defId, ref: defUriPrefix + encodeJSONPointerSegment(defId) };
    };
    const extractToDef = (entry) => {
      if (entry[1].schema.$ref) {
        return;
      }
      const seen = entry[1];
      const { ref, defId } = makeURI(entry);
      seen.def = { ...seen.schema };
      if (defId)
        seen.defId = defId;
      const schema2 = seen.schema;
      for (const key in schema2) {
        delete schema2[key];
      }
      schema2.$ref = ref;
    };
    if (ctx.cycles === "throw") {
      for (const entry of ctx.seen.entries()) {
        const seen = entry[1];
        if (seen.cycle) {
          throw new Error(`Cycle detected: #/${seen.cycle?.join("/")}/<root>

Set the \`cycles\` parameter to \`"ref"\` to resolve cyclical schemas with defs.`);
        }
      }
    }
    for (const entry of ctx.seen.entries()) {
      const seen = entry[1];
      if (schema === entry[0]) {
        extractToDef(entry);
        continue;
      }
      if (ctx.external) {
        const ext = ctx.external.registry.get(entry[0])?.id;
        if (schema !== entry[0] && ext) {
          extractToDef(entry);
          continue;
        }
      }
      const id = ctx.metadataRegistry.get(entry[0])?.id;
      if (id) {
        extractToDef(entry);
        continue;
      }
      if (seen.cycle) {
        extractToDef(entry);
        continue;
      }
      if (seen.count > 1) {
        if (ctx.reused === "ref") {
          extractToDef(entry);
        }
      }
    }
    if (ctx.external)
      ctx.sharedDefsExtractedFor = ctx.external;
  }
  function compactTypeUnion(schema) {
    const options = schema.anyOf;
    if (!Array.isArray(options) || options.length === 0 || schema.type !== void 0)
      return;
    const types = [];
    for (const option of options) {
      if (!option || typeof option !== "object")
        return;
      compactTypeUnion(option);
      const keys = Object.keys(option);
      if (keys.length !== 1 || keys[0] !== "type")
        return;
      const type = option.type;
      for (const member of Array.isArray(type) ? type : [type]) {
        if (typeof member !== "string")
          return;
        if (!types.includes(member))
          types.push(member);
      }
    }
    delete schema.anyOf;
    schema.type = types.length === 1 ? types[0] : types;
  }
  var FOLDABLE_KEYS = /* @__PURE__ */ new Set(["type", "properties", "required", "additionalProperties"]);
  var UNION_KEYS = ["oneOf", "anyOf"];
  function undeclaredConstraint(member) {
    const extra = member.additionalProperties;
    if (extra === void 0 || extra === false || typeof extra !== "object" || extra === null)
      return null;
    return Object.keys(extra).length ? extra : null;
  }
  function foldObjects(members2) {
    const objects = [];
    for (const member of members2) {
      if (typeof member !== "object" || member.type !== "object")
        return null;
      for (const key in member) {
        if (!FOLDABLE_KEYS.has(key))
          return null;
      }
      objects.push(member);
    }
    const properties = {};
    const required2 = /* @__PURE__ */ new Set();
    for (const object2 of objects) {
      for (const key in object2.properties) {
        if (Object.prototype.hasOwnProperty.call(properties, key))
          continue;
        const parts = [];
        for (const other of objects) {
          const part = other.properties?.[key] ?? undeclaredConstraint(other);
          if (part === null || part === void 0)
            continue;
          if (!parts.some((seen) => JSON.stringify(seen) === JSON.stringify(part)))
            parts.push(part);
        }
        const merged = parts.length === 1 ? parts[0] : foldObjects(parts) ?? { allOf: parts };
        assignProp(properties, key, merged);
      }
      for (const key of object2.required ?? [])
        required2.add(key);
    }
    const folded = { type: "object", properties };
    if (required2.size)
      folded.required = [...required2];
    if (objects.every((object2) => object2.additionalProperties === false)) {
      folded.additionalProperties = false;
    } else {
      const constraints = [];
      for (const object2 of objects) {
        const constraint = undeclaredConstraint(object2);
        if (constraint && !constraints.some((seen) => JSON.stringify(seen) === JSON.stringify(constraint)))
          constraints.push(constraint);
      }
      if (constraints.length === 1)
        folded.additionalProperties = constraints[0];
      else if (constraints.length > 1)
        folded.additionalProperties = { allOf: constraints };
    }
    return folded;
  }
  function foldIntersection(json) {
    const allOf = json.allOf;
    if (!Array.isArray(allOf) || allOf.length < 2)
      return;
    for (const key of FOLDABLE_KEYS)
      if (key in json)
        return;
    const unions = allOf.filter((m) => UNION_KEYS.some((k) => Array.isArray(m[k])));
    let folded = null;
    if (!unions.length) {
      folded = foldObjects(allOf);
    } else {
      const union2 = unions[0];
      const keyword = UNION_KEYS.find((k) => Array.isArray(union2[k]));
      if (Object.keys(union2).length !== 1)
        return;
      const rest = allOf.filter((m) => m !== union2);
      const branches = union2[keyword].map((branch) => foldObjects([...rest, branch]));
      if (branches.some((b) => !b))
        return;
      folded = { [keyword]: branches };
    }
    if (!folded)
      return;
    delete json.allOf;
    assignProps(json, folded);
  }
  function finalize(ctx, schema) {
    const root = ctx.seen.get(schema);
    if (!root)
      throw new Error("Unprocessed schema. This is a bug in Zod.");
    const flattenRef = (zodSchema) => {
      const seen = ctx.seen.get(zodSchema);
      if (seen.ref === null)
        return;
      const schema2 = seen.def ?? seen.schema;
      const _cached = { ...schema2 };
      const ref = seen.ref;
      seen.ref = null;
      if (ref) {
        flattenRef(ref);
        const refSeen = ctx.seen.get(ref);
        const refSchema = refSeen.schema;
        if (refSchema.$ref && (ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0")) {
          schema2.allOf = schema2.allOf ?? [];
          schema2.allOf.push(refSchema);
        } else {
          assignProps(schema2, refSchema);
        }
        assignProps(schema2, _cached);
        const isParentRef = zodSchema._zod.parent === ref;
        if (isParentRef) {
          for (const key in schema2) {
            if (key === "$ref" || key === "allOf")
              continue;
            if (!(key in _cached)) {
              delete schema2[key];
            }
          }
        }
        if (refSchema.$ref && refSeen.def) {
          for (const key in schema2) {
            if (key === "$ref" || key === "allOf")
              continue;
            if (key in refSeen.def && JSON.stringify(schema2[key]) === JSON.stringify(refSeen.def[key])) {
              delete schema2[key];
            }
          }
        }
      }
      const parent = zodSchema._zod.parent;
      if (parent && parent !== ref) {
        flattenRef(parent);
        const parentSeen = ctx.seen.get(parent);
        if (parentSeen?.schema.$ref) {
          schema2.$ref = parentSeen.schema.$ref;
          if (parentSeen.def) {
            for (const key in schema2) {
              if (key === "$ref" || key === "allOf")
                continue;
              if (key in parentSeen.def && JSON.stringify(schema2[key]) === JSON.stringify(parentSeen.def[key])) {
                delete schema2[key];
              }
            }
          }
        }
      }
      ctx.override({
        zodSchema,
        jsonSchema: schema2,
        path: seen.path ?? []
      });
    };
    if (!ctx.external || ctx.sharedEmitDoneFor !== ctx.external) {
      for (const entry of [...ctx.seen.entries()].reverse()) {
        flattenRef(entry[0]);
      }
      if (ctx.target !== "openapi-3.0") {
        for (const entry of ctx.seen.entries()) {
          compactTypeUnion(entry[1].def ?? entry[1].schema);
        }
      }
      for (const rewrite of ctx.deferred)
        rewrite();
      if (ctx.intersections.length) {
        const carriers = /* @__PURE__ */ new Map();
        for (const seen of ctx.seen.values()) {
          for (const json of [seen.schema, seen.def]) {
            const allOf = json?.allOf;
            if (!Array.isArray(allOf))
              continue;
            const existing = carriers.get(allOf);
            if (existing)
              existing.push(json);
            else
              carriers.set(allOf, [json]);
          }
        }
        for (const allOf of ctx.intersections) {
          for (const json of carriers.get(allOf) ?? [])
            foldIntersection(json);
        }
      }
    }
    const result = {};
    if (ctx.target === "draft-2020-12") {
      result.$schema = "https://json-schema.org/draft/2020-12/schema";
    } else if (ctx.target === "draft-07") {
      result.$schema = "http://json-schema.org/draft-07/schema#";
    } else if (ctx.target === "draft-04") {
      result.$schema = "http://json-schema.org/draft-04/schema#";
    } else if (ctx.target === "openapi-3.0") {
    } else {
    }
    if (ctx.external?.uri) {
      const id = ctx.external.registry.get(schema)?.id;
      if (!id)
        throw new Error("Schema is missing an `id` property");
      result.$id = ctx.external.uri(id);
    }
    assignProps(result, root.defId ? root.schema : root.def ?? root.schema);
    const rootMetaId = ctx.metadataRegistry.get(schema)?.id;
    if (rootMetaId !== void 0 && result.id === rootMetaId)
      delete result.id;
    const defs = ctx.external?.defs ?? {};
    if (!ctx.external || ctx.sharedEmitDoneFor !== ctx.external) {
      for (const entry of ctx.seen.entries()) {
        const seen = entry[1];
        if (seen.def && seen.defId) {
          if (seen.def.id === seen.defId)
            delete seen.def.id;
          assignProp(defs, seen.defId, seen.def);
        }
      }
    }
    if (ctx.external)
      ctx.sharedEmitDoneFor = ctx.external;
    if (ctx.external) {
    } else {
      if (Object.keys(defs).length > 0) {
        if (ctx.target === "draft-2020-12") {
          result.$defs = defs;
        } else {
          result.definitions = defs;
        }
      }
    }
    try {
      const finalized = JSON.parse(JSON.stringify(result));
      Object.defineProperty(finalized, "~standard", {
        value: {
          ...schema["~standard"],
          jsonSchema: {
            input: createStandardJSONSchemaMethod(schema, "input", ctx.processors),
            output: createStandardJSONSchemaMethod(schema, "output", ctx.processors)
          }
        },
        enumerable: false,
        writable: false
      });
      return finalized;
    } catch (_err) {
      throw new Error("Error converting schema to JSON.");
    }
  }
  function isTransforming(_schema, _ctx) {
    const ctx = _ctx ?? { seen: /* @__PURE__ */ new Set() };
    if (ctx.seen.has(_schema))
      return false;
    ctx.seen.add(_schema);
    const def = _schema._zod.def;
    if (def.type === "transform")
      return true;
    if (def.type === "array")
      return isTransforming(def.element, ctx);
    if (def.type === "set")
      return isTransforming(def.valueType, ctx);
    if (def.type === "lazy")
      return isTransforming(def.getter(), ctx);
    if (def.type === "promise" || def.type === "optional" || def.type === "nonoptional" || def.type === "nullable" || def.type === "readonly" || def.type === "default" || def.type === "prefault" || def.type === "catch") {
      return isTransforming(def.innerType, ctx);
    }
    if (def.type === "intersection") {
      return isTransforming(def.left, ctx) || isTransforming(def.right, ctx);
    }
    if (def.type === "record" || def.type === "map") {
      return isTransforming(def.keyType, ctx) || isTransforming(def.valueType, ctx);
    }
    if (def.type === "pipe") {
      if (_schema._zod.traits.has("$ZodCodec"))
        return true;
      return isTransforming(def.in, ctx) || isTransforming(def.out, ctx);
    }
    if (def.type === "object") {
      for (const key in def.shape) {
        if (isTransforming(def.shape[key], ctx))
          return true;
      }
      return false;
    }
    if (def.type === "union") {
      for (const option of def.options) {
        if (isTransforming(option, ctx))
          return true;
      }
      return false;
    }
    if (def.type === "tuple") {
      for (const item of def.items) {
        if (isTransforming(item, ctx))
          return true;
      }
      if (def.rest && isTransforming(def.rest, ctx))
        return true;
      return false;
    }
    return false;
  }
  var createToJSONSchemaMethod = (schema, processors = {}) => (params) => {
    const ctx = initializeContext({ ...params, processors });
    processSchema(schema, ctx);
    extractDefs(ctx, schema);
    return finalize(ctx, schema);
  };
  var createStandardJSONSchemaMethod = (schema, io, processors = {}) => (params) => {
    const { libraryOptions, target } = params ?? {};
    const ctx = initializeContext({ ...libraryOptions ?? {}, target, io, processors });
    processSchema(schema, ctx);
    extractDefs(ctx, schema);
    return finalize(ctx, schema);
  };

  // node_modules/zod/v4/core/json-schema-processors.js
  var narrowMin = (agg, key, value) => {
    if (agg[key] === void 0 || value > agg[key])
      agg[key] = value;
  };
  var narrowMax = (agg, key, value) => {
    if (agg[key] === void 0 || value < agg[key])
      agg[key] = value;
  };
  var narrowBoth = (agg, value) => {
    narrowMin(agg, "minimum", value);
    narrowMax(agg, "maximum", value);
  };
  var addDivisor = (agg, value) => {
    agg.multipleOf ?? (agg.multipleOf = []);
    if (!agg.multipleOf.includes(value))
      agg.multipleOf.push(value);
  };
  var addPattern = (agg, pattern) => {
    agg.patterns ?? (agg.patterns = /* @__PURE__ */ new Set());
    agg.patterns.add(pattern);
  };
  var intersectMime = (agg, mime) => {
    agg.mime = agg.mime ? agg.mime.filter((m) => mime.includes(m)) : [...mime];
  };
  var setFormat = (agg, format) => {
    agg.format = format;
    if (format.includes("int"))
      agg.isInt = true;
  };
  var minContributor = (agg, def) => narrowMin(agg, "minimum", def.minimum);
  var maxContributor = (agg, def) => narrowMax(agg, "maximum", def.maximum);
  var formatContributor = (ranges) => (agg, def) => {
    setFormat(agg, def.format);
    const [minimum, maximum] = ranges[def.format];
    narrowMin(agg, "minimum", minimum);
    narrowMax(agg, "maximum", maximum);
  };
  var contributors = {
    greater_than: (agg, def) => narrowMin(agg, def.inclusive ? "minimum" : "exclusiveMinimum", def.value),
    less_than: (agg, def) => narrowMax(agg, def.inclusive ? "maximum" : "exclusiveMaximum", def.value),
    multiple_of: (agg, def) => addDivisor(agg, def.value),
    number_format: formatContributor(NUMBER_FORMAT_RANGES),
    bigint_format: formatContributor(BIGINT_FORMAT_RANGES),
    min_length: minContributor,
    max_length: maxContributor,
    length_equals: (agg, def) => narrowBoth(agg, def.length),
    min_size: minContributor,
    max_size: maxContributor,
    size_equals: (agg, def) => narrowBoth(agg, def.size),
    string_format: (agg, def) => {
      setFormat(agg, def.format);
      if (def.pattern)
        addPattern(agg, def.pattern);
      if (def.format === "base64" || def.format === "base64url")
        agg.contentEncoding = def.format;
      if (def.local || def.precision === -1)
        agg.laxFormat = true;
    },
    mime_type: (agg, def) => intersectMime(agg, def.mime)
  };
  function aggregateChecks(schema) {
    const agg = {};
    const def = schema._zod.def;
    const list = schema._zod.traits.has("$ZodCheck") ? [schema, ...def.checks ?? []] : def.checks ?? [];
    for (const ch of list)
      contributors[ch._zod.def.check]?.(agg, ch._zod.def);
    const bag = schema._zod.bag;
    if (bag.minimum !== void 0)
      narrowMin(agg, "minimum", bag.minimum);
    if (bag.exclusiveMinimum !== void 0)
      narrowMin(agg, "exclusiveMinimum", bag.exclusiveMinimum);
    if (bag.maximum !== void 0)
      narrowMax(agg, "maximum", bag.maximum);
    if (bag.exclusiveMaximum !== void 0)
      narrowMax(agg, "exclusiveMaximum", bag.exclusiveMaximum);
    if (bag.multipleOf !== void 0)
      addDivisor(agg, bag.multipleOf);
    if (bag.format !== void 0) {
      agg.format ?? (agg.format = bag.format);
      if (bag.format.includes("int"))
        agg.isInt = true;
    }
    if (bag.mime)
      intersectMime(agg, bag.mime);
    for (const pattern of bag.patterns ?? [])
      addPattern(agg, pattern);
    return agg;
  }
  var formatMap = {
    guid: "uuid",
    url: "uri",
    datetime: "date-time",
    json_string: "json-string",
    regex: ""
    // do not set
  };
  var exactPatterns = /* @__PURE__ */ new Map([
    [base64Charset, base64],
    [base64urlCharset, base64url]
  ]);
  var exactPattern = (p) => exactPatterns.get(p) ?? p;
  var stringProcessor = (schema, ctx, _json, _params) => {
    const json = _json;
    json.type = "string";
    const { minimum, maximum, format, patterns, contentEncoding, laxFormat } = aggregateChecks(schema);
    if (typeof minimum === "number")
      json.minLength = minimum;
    if (typeof maximum === "number")
      json.maxLength = maximum;
    if (format) {
      json.format = formatMap[format] ?? format;
      if (json.format === "")
        delete json.format;
      if (format === "time" || laxFormat) {
        delete json.format;
      }
    }
    if (contentEncoding)
      json.contentEncoding = contentEncoding;
    if (patterns && patterns.size > 0) {
      const patternList = [...patterns].map(exactPattern);
      if (patternList.length === 1)
        json.pattern = patternList[0].source;
      else if (patternList.length > 1) {
        json.allOf = [
          ...patternList.map((regex) => ({
            ...ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0" ? { type: "string" } : {},
            pattern: regex.source
          }))
        ];
      }
    }
  };
  var numberProcessor = (schema, ctx, _json, params) => {
    const json = _json;
    const { minimum, maximum, multipleOf, exclusiveMaximum, exclusiveMinimum, isInt } = aggregateChecks(schema);
    json.type = isInt ? "integer" : "number";
    const exMin = typeof exclusiveMinimum === "number" && exclusiveMinimum >= (minimum ?? Number.NEGATIVE_INFINITY);
    const exMax = typeof exclusiveMaximum === "number" && exclusiveMaximum <= (maximum ?? Number.POSITIVE_INFINITY);
    const legacy = ctx.target === "draft-04" || ctx.target === "openapi-3.0";
    if (exMin) {
      if (legacy) {
        json.minimum = exclusiveMinimum;
        json.exclusiveMinimum = true;
      } else {
        json.exclusiveMinimum = exclusiveMinimum;
      }
    } else if (typeof minimum === "number") {
      json.minimum = minimum;
    }
    if (exMax) {
      if (legacy) {
        json.maximum = exclusiveMaximum;
        json.exclusiveMaximum = true;
      } else {
        json.exclusiveMaximum = exclusiveMaximum;
      }
    } else if (typeof maximum === "number") {
      json.maximum = maximum;
    }
    if (multipleOf) {
      const divisors = /* @__PURE__ */ new Set();
      for (const divisor of multipleOf) {
        if (Number.isFinite(divisor) && divisor !== 0)
          divisors.add(Math.abs(divisor));
        else
          handleUnrepresentable(schema, ctx, json, params, `A multipleOf divisor of ${divisor} cannot be represented in JSON Schema`);
      }
      const [first, ...rest] = divisors;
      if (first !== void 0)
        json.multipleOf = first;
      if (rest.length)
        json.allOf = [...json.allOf ?? [], ...rest.map((m) => ({ multipleOf: m }))];
    }
  };
  var booleanProcessor = (_schema, _ctx, json, _params) => {
    json.type = "boolean";
  };
  var neverProcessor = (_schema, _ctx, json, _params) => {
    json.not = {};
  };
  var unknownProcessor = (_schema, _ctx, _json, _params) => {
  };
  var enumProcessor = (schema, _ctx, json, _params) => {
    const def = schema._zod.def;
    const values = getEnumValues(def.entries);
    if (values.length === 0) {
      json.not = {};
      return;
    }
    if (values.every((v) => typeof v === "number"))
      json.type = "number";
    if (values.every((v) => typeof v === "string"))
      json.type = "string";
    json.enum = values;
  };
  var literalProcessor = (schema, ctx, json, params) => {
    const def = schema._zod.def;
    if (def.values.length === 0) {
      json.not = {};
      return;
    }
    const vals = [];
    for (const val of def.values) {
      if (val === void 0) {
        if (handleUnrepresentable(schema, ctx, json, params, "Literal `undefined` cannot be represented in JSON Schema"))
          return;
      } else if (typeof val === "bigint") {
        if (handleUnrepresentable(schema, ctx, json, params, "BigInt literals cannot be represented in JSON Schema"))
          return;
        vals.push(Number(val));
      } else {
        vals.push(val);
      }
    }
    if (vals.length === 0) {
    } else if (vals.length === 1) {
      const val = vals[0];
      json.type = val === null ? "null" : typeof val;
      if (ctx.target === "draft-04" || ctx.target === "openapi-3.0") {
        json.enum = [val];
      } else {
        json.const = val;
      }
    } else {
      if (vals.every((v) => typeof v === "number"))
        json.type = "number";
      if (vals.every((v) => typeof v === "string"))
        json.type = "string";
      if (vals.every((v) => typeof v === "boolean"))
        json.type = "boolean";
      if (vals.every((v) => v === null))
        json.type = "null";
      json.enum = vals;
    }
  };
  var customProcessor = (schema, ctx, json, params) => {
    handleUnrepresentable(schema, ctx, json, params, "Custom types cannot be represented in JSON Schema");
  };
  var transformProcessor = (schema, ctx, json, params) => {
    handleUnrepresentable(schema, ctx, json, params, "Transforms cannot be represented in JSON Schema");
  };
  var arrayProcessor = (schema, ctx, _json, params) => {
    const json = _json;
    const def = schema._zod.def;
    const { minimum, maximum } = aggregateChecks(schema);
    if (typeof minimum === "number")
      json.minItems = minimum;
    if (typeof maximum === "number")
      json.maxItems = maximum;
    json.type = "array";
    json.items = processSchema(def.element, ctx, {
      ...params,
      path: [...params.path, "items"]
    });
  };
  function inputOptin(schema) {
    const def = schema._zod.def;
    if (def.type === "pipe" && def.in._zod.traits.has("$ZodTransform")) {
      return inputOptin(def.out);
    }
    if (def.type === "catch") {
      return inputOptin(def.innerType);
    }
    return schema._zod.optin;
  }
  var objectProcessor = (schema, ctx, _json, params) => {
    const json = _json;
    const def = schema._zod.def;
    const shape = def.shape;
    const symbolKeys = Object.getOwnPropertySymbols(shape);
    if (symbolKeys.length && handleUnrepresentable(schema, ctx, json, params, "Symbol keys cannot be represented in JSON Schema")) {
      return;
    }
    json.type = "object";
    json.properties = {};
    for (const key in shape) {
      assignProp(json.properties, key, processSchema(shape[key], ctx, {
        ...params,
        path: [...params.path, "properties", key]
      }));
    }
    const requiredKeys = [];
    for (const key of Object.keys(shape)) {
      const field = def.shape[key];
      if (ctx.io === "input" ? inputOptin(field) === void 0 : field._zod.optout === void 0) {
        requiredKeys.push(key);
      }
    }
    if (requiredKeys.length > 0) {
      json.required = requiredKeys;
    }
    if (def.catchall?._zod.def.type === "never") {
      json.additionalProperties = false;
    } else if (!def.catchall) {
      if (ctx.io === "output")
        json.additionalProperties = false;
    } else if (def.catchall) {
      json.additionalProperties = processSchema(def.catchall, ctx, {
        ...params,
        path: [...params.path, "additionalProperties"]
      });
    }
  };
  var unionProcessor = (schema, ctx, json, params) => {
    const def = schema._zod.def;
    const isExclusive = def.inclusive === false;
    const options = def.options.map((x, i) => processSchema(x, ctx, {
      ...params,
      path: [...params.path, isExclusive ? "oneOf" : "anyOf", i]
    }));
    if (isExclusive) {
      json.oneOf = options;
    } else {
      json.anyOf = options;
    }
  };
  var intersectionProcessor = (schema, ctx, json, params) => {
    const def = schema._zod.def;
    const a = processSchema(def.left, ctx, {
      ...params,
      path: [...params.path, "allOf", 0]
    });
    const b = processSchema(def.right, ctx, {
      ...params,
      path: [...params.path, "allOf", 1]
    });
    const isSimpleIntersection = (val) => "allOf" in val && Object.keys(val).length === 1;
    const allOf = [
      ...isSimpleIntersection(a) ? a.allOf : [a],
      ...isSimpleIntersection(b) ? b.allOf : [b]
    ];
    json.allOf = allOf;
    ctx.intersections.push(allOf);
  };
  function stringifyKeyNames(bySchema, json, visited) {
    if (json.$ref) {
      if (visited.has(json))
        return json;
      visited.add(json);
      const def = bySchema.get(json)?.def;
      if (!def)
        return json;
      const inlined = stringifyKeyNames(bySchema, def, visited);
      return inlined === def ? json : inlined;
    }
    for (const keyword of ["anyOf", "oneOf"]) {
      const branches = json[keyword];
      if (!Array.isArray(branches))
        continue;
      const mapped = branches.map((branch) => stringifyKeyNames(bySchema, branch, visited));
      if (mapped.some((branch, i) => branch !== branches[i]))
        json = { ...json, [keyword]: mapped };
    }
    const types = Array.isArray(json.type) ? json.type : [json.type];
    const numericType = !types.includes("string") && types.some((t) => t === "number" || t === "integer");
    const values = json.enum ?? (json.const !== void 0 ? [json.const] : void 0);
    if (!numericType && !values?.some((v) => typeof v === "number"))
      return json;
    const { minimum, maximum, exclusiveMinimum, exclusiveMaximum, multipleOf, format, id, ...rest } = json;
    if (rest.enum)
      rest.enum = rest.enum.map((v) => typeof v === "number" ? String(v) : v);
    else if (typeof rest.const === "number")
      rest.const = String(rest.const);
    if (!numericType)
      return rest;
    rest.type = "string";
    if (!values)
      rest.pattern = (types.includes("number") ? number : integer).source;
    return rest;
  }
  var pendingRecords = /* @__PURE__ */ new WeakMap();
  function rewriteKeyNames(ctx) {
    const bySchema = /* @__PURE__ */ new Map();
    for (const entry of ctx.seen.values()) {
      if (entry.def && !bySchema.has(entry.schema))
        bySchema.set(entry.schema, entry);
    }
    const rewrites = /* @__PURE__ */ new Map();
    for (const record2 of pendingRecords.get(ctx) ?? []) {
      const seen = ctx.seen.get(record2);
      const names = (seen?.def ?? seen?.schema)?.propertyNames;
      if (!names || names === true || rewrites.has(names))
        continue;
      const rewritten = stringifyKeyNames(bySchema, names, /* @__PURE__ */ new Set());
      if (rewritten !== names)
        rewrites.set(names, rewritten);
    }
    if (!rewrites.size)
      return;
    for (const entry of ctx.seen.values()) {
      for (const carrier of [entry.schema, entry.def]) {
        const rewritten = carrier && rewrites.get(carrier.propertyNames);
        if (rewritten)
          carrier.propertyNames = rewritten;
      }
    }
  }
  var recordProcessor = (schema, ctx, _json, params) => {
    const json = _json;
    const def = schema._zod.def;
    json.type = "object";
    const keyType = def.keyType;
    const patterns = aggregateChecks(keyType).patterns;
    if (def.mode === "loose" && patterns && patterns.size > 0) {
      const valueSchema = processSchema(def.valueType, ctx, {
        ...params,
        path: [...params.path, "patternProperties", "*"]
      });
      json.patternProperties = {};
      for (const pattern of patterns) {
        assignProp(json.patternProperties, exactPattern(pattern).source, valueSchema);
      }
    } else {
      if (ctx.target === "draft-07" || ctx.target === "draft-2020-12") {
        json.propertyNames = processSchema(def.keyType, ctx, {
          ...params,
          path: [...params.path, "propertyNames"]
        });
        let pending = pendingRecords.get(ctx);
        if (!pending) {
          pending = [];
          pendingRecords.set(ctx, pending);
          ctx.deferred.push(() => rewriteKeyNames(ctx));
        }
        pending.push(schema);
      }
      json.additionalProperties = processSchema(def.valueType, ctx, {
        ...params,
        path: [...params.path, "additionalProperties"]
      });
    }
    const keyValues = keyType._zod.values;
    const omittableOnInput = ctx.io === "input" && inputOptin(def.valueType) !== void 0;
    if (keyValues && !def.partial && !omittableOnInput) {
      const validKeyValues = [...keyValues].filter((v) => typeof v === "string" || typeof v === "number");
      if (validKeyValues.length > 0) {
        json.required = validKeyValues.map(String);
      }
    }
  };
  var nullableProcessor = (schema, ctx, json, params) => {
    const def = schema._zod.def;
    const inner = processSchema(def.innerType, ctx, params);
    const seen = ctx.seen.get(schema);
    if (ctx.target === "openapi-3.0") {
      seen.ref = def.innerType;
      json.nullable = true;
    } else {
      json.anyOf = [inner, { type: "null" }];
    }
  };
  var nonoptionalProcessor = (schema, ctx, _json, params) => {
    const def = schema._zod.def;
    processSchema(def.innerType, ctx, params);
    const seen = ctx.seen.get(schema);
    seen.ref = def.innerType;
  };
  var UNREPRESENTABLE_DEFAULT = /* @__PURE__ */ Symbol();
  function serializeDefaultValue(value, schema, ctx, json, params) {
    let unrepresentable = false;
    const serialized = JSON.stringify(value, (_, val) => {
      if (typeof val !== "bigint")
        return val;
      unrepresentable = true;
      return null;
    });
    if (!unrepresentable)
      return JSON.parse(serialized);
    handleUnrepresentable(schema, ctx, json, params, "BigInt defaults cannot be represented in JSON Schema");
    return UNREPRESENTABLE_DEFAULT;
  }
  var defaultProcessor = (schema, ctx, json, params) => {
    const def = schema._zod.def;
    processSchema(def.innerType, ctx, params);
    const seen = ctx.seen.get(schema);
    seen.ref = def.innerType;
    const value = serializeDefaultValue(def.defaultValue, schema, ctx, json, params);
    if (value !== UNREPRESENTABLE_DEFAULT)
      json.default = value;
  };
  var prefaultProcessor = (schema, ctx, json, params) => {
    const def = schema._zod.def;
    processSchema(def.innerType, ctx, params);
    const seen = ctx.seen.get(schema);
    seen.ref = def.innerType;
    if (ctx.io !== "input")
      return;
    const value = serializeDefaultValue(def.defaultValue, schema, ctx, json, params);
    if (value !== UNREPRESENTABLE_DEFAULT)
      json._prefault = value;
  };
  var catchProcessor = (schema, ctx, json, params) => {
    const def = schema._zod.def;
    processSchema(def.innerType, ctx, params);
    const seen = ctx.seen.get(schema);
    seen.ref = def.innerType;
    let catchValue;
    try {
      catchValue = def.catchValue(void 0);
    } catch {
      handleUnrepresentable(schema, ctx, json, params, "Dynamic catch values are not supported in JSON Schema");
      return;
    }
    json.default = catchValue;
  };
  var pipeProcessor = (schema, ctx, _json, params) => {
    const def = schema._zod.def;
    const inIsTransform = def.in._zod.traits.has("$ZodTransform");
    const innerType = ctx.io === "input" ? inIsTransform ? def.out : def.in : def.out;
    processSchema(innerType, ctx, params);
    const seen = ctx.seen.get(schema);
    seen.ref = innerType;
  };
  var readonlyProcessor = (schema, ctx, json, params) => {
    const def = schema._zod.def;
    processSchema(def.innerType, ctx, params);
    const seen = ctx.seen.get(schema);
    seen.ref = def.innerType;
    json.readOnly = true;
  };
  var optionalProcessor = (schema, ctx, _json, params) => {
    const def = schema._zod.def;
    processSchema(def.innerType, ctx, params);
    const seen = ctx.seen.get(schema);
    seen.ref = def.innerType;
  };

  // node_modules/zod/v4/classic/errors.js
  var _installedErrorProtos = /* @__PURE__ */ new WeakSet([Object.prototype, Error.prototype]);
  function _lazyMethod(proto, key, make) {
    Object.defineProperty(proto, key, {
      configurable: true,
      enumerable: false,
      get() {
        const value = make(this);
        Object.defineProperty(this, key, { value, configurable: true, writable: true });
        return value;
      },
      set(value) {
        Object.defineProperty(this, key, { value, configurable: true, writable: true });
      }
    });
  }
  var initializer2 = (inst, issues) => {
    $ZodError.init(inst, issues);
    inst.name = "ZodError";
    const proto = Object.getPrototypeOf(inst);
    if (_installedErrorProtos.has(proto))
      return;
    _installedErrorProtos.add(proto);
    _lazyMethod(proto, "format", (self) => (mapper) => formatError(self, mapper));
    _lazyMethod(proto, "flatten", (self) => (mapper) => flattenError(self, mapper));
    _lazyMethod(proto, "addIssue", (self) => (issue2) => {
      self.issues.push(issue2);
      self.message = JSON.stringify(self.issues, jsonStringifyReplacer, 2);
    });
    _lazyMethod(proto, "addIssues", (self) => (issues2) => {
      self.issues.push(...issues2);
      self.message = JSON.stringify(self.issues, jsonStringifyReplacer, 2);
    });
    Object.defineProperty(proto, "isEmpty", {
      configurable: true,
      enumerable: false,
      get() {
        return this.issues.length === 0;
      }
    });
  };
  var ZodRealError = /* @__PURE__ */ $constructor("ZodError", initializer2, void 0, {
    Parent: Error
  });

  // node_modules/zod/v4/classic/parse.js
  var parse = /* @__PURE__ */ _parse(ZodRealError);
  var parseAsync = /* @__PURE__ */ _parseAsync(ZodRealError);
  var safeParse = /* @__PURE__ */ _safeParse(ZodRealError);
  var safeParseAsync = /* @__PURE__ */ _safeParseAsync(ZodRealError);
  var encode = /* @__PURE__ */ _encode(ZodRealError);
  var decode = /* @__PURE__ */ _decode(ZodRealError);
  var encodeAsync = /* @__PURE__ */ _encodeAsync(ZodRealError);
  var decodeAsync = /* @__PURE__ */ _decodeAsync(ZodRealError);
  var safeEncode = /* @__PURE__ */ _safeEncode(ZodRealError);
  var safeDecode = /* @__PURE__ */ _safeDecode(ZodRealError);
  var safeEncodeAsync = /* @__PURE__ */ _safeEncodeAsync(ZodRealError);
  var safeDecodeAsync = /* @__PURE__ */ _safeDecodeAsync(ZodRealError);

  // node_modules/zod/v4/classic/schemas.js
  function _ensureDefaultLocale() {
    if (!globalConfig.localeError)
      config(en_default());
  }
  function _ensureDefaultMemoizer() {
    if (!globalConfig.memoizer)
      config({ memoizer: memoizer() });
  }
  var ZodType = /* @__PURE__ */ $constructor("ZodType", (inst, def) => {
    _ensureDefaultLocale();
    $ZodType.init(inst, def);
    inst.def = def;
    inst.type = def.type;
    return inst;
  }, {
    check(...chks) {
      const def = this.def;
      return this.clone(util_exports.mergeDefs(def, {
        checks: [
          ...def.checks ?? [],
          ...chks.map((ch) => typeof ch === "function" ? { _zod: { check: ch, def: { check: "custom" }, onattach: [] } } : ch)
        ]
      }), { parent: true });
    },
    with(...chks) {
      return this.check(...chks);
    },
    clone(def, params) {
      return clone(this, def, params);
    },
    brand() {
      return this;
    },
    register(reg, meta2) {
      reg.add(this, meta2);
      return this;
    },
    refine(check, params) {
      return this.check(refine(check, params));
    },
    superRefine(refinement, params) {
      return this.check(superRefine(refinement, params));
    },
    overwrite(fn) {
      return this.check(_overwrite(fn));
    },
    optional() {
      return optional(this);
    },
    exactOptional() {
      return exactOptional(this);
    },
    nullable() {
      return nullable(this);
    },
    nullish() {
      return optional(nullable(this));
    },
    nonoptional(params) {
      return nonoptional(this, params);
    },
    array() {
      return array(this);
    },
    or(arg) {
      return union([this, arg]);
    },
    and(arg) {
      return intersection(this, arg);
    },
    transform(tx) {
      return pipe(this, transform(tx));
    },
    default(d) {
      return _default(this, d);
    },
    prefault(d) {
      return prefault(this, d);
    },
    catch(params) {
      return _catch(this, params);
    },
    pipe(target) {
      return pipe(this, target);
    },
    readonly() {
      return readonly(this);
    },
    describe(description) {
      const cl = this.clone();
      globalRegistry.add(cl, { description });
      return cl;
    },
    meta(...args) {
      if (args.length === 0)
        return globalRegistry.get(this);
      const cl = this.clone();
      globalRegistry.add(cl, args[0]);
      return cl;
    },
    isOptional() {
      return this.safeParse(void 0).success;
    },
    isNullable() {
      return this.safeParse(null).success;
    },
    apply(fn, ...args) {
      return args.length === 0 ? fn(this) : fn(this, ...args);
    },
    // Overrides core's `~standard` to add `jsonSchema`. Must stay a prototype entry: redefining it per instance demotes instances to dictionary mode.
    get "~standard"() {
      return util_exports.hide(this, "~standard", {
        ...standardProps(this),
        jsonSchema: {
          input: createStandardJSONSchemaMethod(this, "input"),
          output: createStandardJSONSchemaMethod(this, "output")
        }
      });
    },
    set "~standard"(value) {
      util_exports.own(this, "~standard", value);
    },
    parse: function _parse2(data, params) {
      return parse(this, data, params, { callee: _parse2 });
    },
    parseAsync: async function _parseAsync2(data, params) {
      return await parseAsync(this, data, params, { callee: _parseAsync2 });
    },
    safeParse(data, params) {
      return safeParse(this, data, params);
    },
    async safeParseAsync(data, params) {
      return safeParseAsync(this, data, params);
    },
    // `spa` is an alias: same function object as `safeParseAsync`, as before.
    get spa() {
      return this?.safeParseAsync;
    },
    set spa(value) {
      util_exports.own(this, "spa", value);
    },
    validate(data, params) {
      return validate(this, data, params);
    },
    validateAsync(data, params) {
      return validateAsync(this, data, params);
    },
    encode: function _encode2(data, params) {
      return encode(this, data, params, { callee: _encode2 });
    },
    decode: function _decode2(data, params) {
      return decode(this, data, params, { callee: _decode2 });
    },
    encodeAsync: async function _encodeAsync2(data, params) {
      return await encodeAsync(this, data, params, { callee: _encodeAsync2 });
    },
    decodeAsync: async function _decodeAsync2(data, params) {
      return await decodeAsync(this, data, params, { callee: _decodeAsync2 });
    },
    safeEncode(data, params) {
      return safeEncode(this, data, params);
    },
    safeDecode(data, params) {
      return safeDecode(this, data, params);
    },
    async safeEncodeAsync(data, params) {
      return safeEncodeAsync(this, data, params);
    },
    async safeDecodeAsync(data, params) {
      return safeDecodeAsync(this, data, params);
    },
    toJSONSchema(params) {
      return createToJSONSchemaMethod(this, {})(params);
    },
    // Reads through to the registry on every access, so it must not cache.
    get description() {
      return globalRegistry.get(this)?.description;
    },
    // No setter: `schema._def = x` throws, as it did when `_def` was a non-writable own property.
    get _def() {
      return this._zod.def;
    }
  });
  var _ZodString = /* @__PURE__ */ $constructor(
    "_ZodString",
    (inst, def) => {
      $ZodString.init(inst, def);
      ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json, params) => stringProcessor(inst, ctx, json, params);
    },
    /* @__PURE__ */ util_exports.derived({
      format: (inst) => aggregateChecks(inst).format ?? null,
      minLength: (inst) => aggregateChecks(inst).minimum ?? null,
      maxLength: (inst) => aggregateChecks(inst).maximum ?? null
    }, {
      regex(...args) {
        return this.check(_regex(...args));
      },
      includes(...args) {
        return this.check(_includes(...args));
      },
      startsWith(...args) {
        return this.check(_startsWith(...args));
      },
      endsWith(...args) {
        return this.check(_endsWith(...args));
      },
      min(...args) {
        return this.check(_minLength(...args));
      },
      max(...args) {
        return this.check(_maxLength(...args));
      },
      length(...args) {
        return this.check(_length(...args));
      },
      nonempty(...args) {
        return this.check(_minLength(1, ...args));
      },
      lowercase(params) {
        return this.check(_lowercase(params));
      },
      uppercase(params) {
        return this.check(_uppercase(params));
      },
      trim() {
        return this.check(_trim());
      },
      normalize(...args) {
        return this.check(_normalize(...args));
      },
      toLowerCase() {
        return this.check(_toLowerCase());
      },
      toUpperCase() {
        return this.check(_toUpperCase());
      },
      slugify() {
        return this.check(_slugify());
      }
    })
  );
  var ZodString = /* @__PURE__ */ $constructor("ZodString", (inst, def) => {
    $ZodString.init(inst, def);
    _ZodString.init(inst, def);
  }, {
    email(params) {
      return this.check(_email(ZodEmail, params));
    },
    url(params) {
      return this.check(_url(ZodURL, params));
    },
    jwt(params) {
      return this.check(_jwt(ZodJWT, params));
    },
    emoji(params) {
      return this.check(_emoji2(ZodEmoji, params));
    },
    guid(params) {
      return this.check(_guid(ZodGUID, params));
    },
    uuid(params) {
      return this.check(_uuid(ZodUUID, params));
    },
    uuidv4(params) {
      return this.check(_uuidv4(ZodUUID, params));
    },
    uuidv6(params) {
      return this.check(_uuidv6(ZodUUID, params));
    },
    uuidv7(params) {
      return this.check(_uuidv7(ZodUUID, params));
    },
    nanoid(params) {
      return this.check(_nanoid(ZodNanoID, params));
    },
    cuid(params) {
      return this.check(_cuid(ZodCUID, params));
    },
    cuid2(params) {
      return this.check(_cuid2(ZodCUID2, params));
    },
    ulid(params) {
      return this.check(_ulid(ZodULID, params));
    },
    base64(params) {
      return this.check(_base64(ZodBase64, params));
    },
    base64url(params) {
      return this.check(_base64url(ZodBase64URL, params));
    },
    xid(params) {
      return this.check(_xid(ZodXID, params));
    },
    ksuid(params) {
      return this.check(_ksuid(ZodKSUID, params));
    },
    ipv4(params) {
      return this.check(_ipv4(ZodIPv4, params));
    },
    ipv6(params) {
      return this.check(_ipv6(ZodIPv6, params));
    },
    cidrv4(params) {
      return this.check(_cidrv4(ZodCIDRv4, params));
    },
    cidrv6(params) {
      return this.check(_cidrv6(ZodCIDRv6, params));
    },
    e164(params) {
      return this.check(_e164(ZodE164, params));
    },
    datetime(params) {
      return this.check(_isoDateTime(ZodISODateTime, params));
    },
    date(params) {
      return this.check(_isoDate(ZodISODate, params));
    },
    time(params) {
      return this.check(_isoTime(ZodISOTime, params));
    },
    duration(params) {
      return this.check(_isoDuration(ZodISODuration, params));
    }
  });
  function string2(params) {
    return _string(ZodString, params);
  }
  var ZodStringFormat = /* @__PURE__ */ $constructor("ZodStringFormat", (inst, def) => {
    $ZodStringFormat.init(inst, def);
    _ZodString.init(inst, def);
  });
  var ZodISODateTime = /* @__PURE__ */ $constructor("ZodISODateTime", (inst, def) => {
    $ZodISODateTime.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  var ZodISODate = /* @__PURE__ */ $constructor("ZodISODate", (inst, def) => {
    $ZodISODate.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  var ZodISOTime = /* @__PURE__ */ $constructor("ZodISOTime", (inst, def) => {
    $ZodISOTime.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  var ZodISODuration = /* @__PURE__ */ $constructor("ZodISODuration", (inst, def) => {
    $ZodISODuration.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  var ZodEmail = /* @__PURE__ */ $constructor("ZodEmail", (inst, def) => {
    $ZodEmail.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  var ZodGUID = /* @__PURE__ */ $constructor("ZodGUID", (inst, def) => {
    $ZodGUID.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  var ZodUUID = /* @__PURE__ */ $constructor("ZodUUID", (inst, def) => {
    $ZodUUID.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  var ZodURL = /* @__PURE__ */ $constructor("ZodURL", (inst, def) => {
    $ZodURL.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  var ZodEmoji = /* @__PURE__ */ $constructor("ZodEmoji", (inst, def) => {
    $ZodEmoji.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  var ZodNanoID = /* @__PURE__ */ $constructor("ZodNanoID", (inst, def) => {
    $ZodNanoID.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  var ZodCUID = /* @__PURE__ */ $constructor("ZodCUID", (inst, def) => {
    $ZodCUID.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  var ZodCUID2 = /* @__PURE__ */ $constructor("ZodCUID2", (inst, def) => {
    $ZodCUID2.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  var ZodULID = /* @__PURE__ */ $constructor("ZodULID", (inst, def) => {
    $ZodULID.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  var ZodXID = /* @__PURE__ */ $constructor("ZodXID", (inst, def) => {
    $ZodXID.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  var ZodKSUID = /* @__PURE__ */ $constructor("ZodKSUID", (inst, def) => {
    $ZodKSUID.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  var ZodIPv4 = /* @__PURE__ */ $constructor("ZodIPv4", (inst, def) => {
    $ZodIPv4.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  var ZodIPv6 = /* @__PURE__ */ $constructor("ZodIPv6", (inst, def) => {
    $ZodIPv6.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  var ZodCIDRv4 = /* @__PURE__ */ $constructor("ZodCIDRv4", (inst, def) => {
    $ZodCIDRv4.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  var ZodCIDRv6 = /* @__PURE__ */ $constructor("ZodCIDRv6", (inst, def) => {
    $ZodCIDRv6.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  var ZodBase64 = /* @__PURE__ */ $constructor("ZodBase64", (inst, def) => {
    $ZodBase64.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  var ZodBase64URL = /* @__PURE__ */ $constructor("ZodBase64URL", (inst, def) => {
    $ZodBase64URL.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  var ZodE164 = /* @__PURE__ */ $constructor("ZodE164", (inst, def) => {
    $ZodE164.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  var ZodJWT = /* @__PURE__ */ $constructor("ZodJWT", (inst, def) => {
    $ZodJWT.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  var ZodNumber = /* @__PURE__ */ $constructor(
    "ZodNumber",
    (inst, def) => {
      $ZodNumber.init(inst, def);
      ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json, params) => numberProcessor(inst, ctx, json, params);
      inst.isFinite = true;
    },
    /* @__PURE__ */ util_exports.derived({
      minValue: (inst) => {
        const { minimum, exclusiveMinimum } = aggregateChecks(inst);
        return Math.max(minimum ?? Number.NEGATIVE_INFINITY, exclusiveMinimum ?? Number.NEGATIVE_INFINITY);
      },
      maxValue: (inst) => {
        const { maximum, exclusiveMaximum } = aggregateChecks(inst);
        return Math.min(maximum ?? Number.POSITIVE_INFINITY, exclusiveMaximum ?? Number.POSITIVE_INFINITY);
      },
      isInt: (inst) => {
        const { isInt, multipleOf } = aggregateChecks(inst);
        return !!isInt || !!multipleOf?.some(Number.isSafeInteger);
      },
      format: (inst) => aggregateChecks(inst).format ?? null
    }, {
      gt(value, params) {
        return this.check(_gt(value, params));
      },
      gte(value, params) {
        return this.check(_gte(value, params));
      },
      min(value, params) {
        return this.check(_gte(value, params));
      },
      lt(value, params) {
        return this.check(_lt(value, params));
      },
      lte(value, params) {
        return this.check(_lte(value, params));
      },
      max(value, params) {
        return this.check(_lte(value, params));
      },
      int(params) {
        return this.check(int(params));
      },
      safe(params) {
        return this.check(int(params));
      },
      positive(params) {
        return this.check(_gt(0, params));
      },
      nonnegative(params) {
        return this.check(_gte(0, params));
      },
      negative(params) {
        return this.check(_lt(0, params));
      },
      nonpositive(params) {
        return this.check(_lte(0, params));
      },
      multipleOf(value, params) {
        return this.check(_multipleOf(value, params));
      },
      step(value, params) {
        return this.check(_multipleOf(value, params));
      },
      finite() {
        return this;
      }
    })
  );
  function number2(params) {
    return _number(ZodNumber, params);
  }
  var ZodNumberFormat = /* @__PURE__ */ $constructor("ZodNumberFormat", (inst, def) => {
    $ZodNumberFormat.init(inst, def);
    ZodNumber.init(inst, def);
  });
  function int(params) {
    return _int(ZodNumberFormat, params);
  }
  var ZodBoolean = /* @__PURE__ */ $constructor("ZodBoolean", (inst, def) => {
    $ZodBoolean.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => booleanProcessor(inst, ctx, json, params);
  });
  function boolean2(params) {
    return _boolean(ZodBoolean, params);
  }
  var ZodUnknown = /* @__PURE__ */ $constructor("ZodUnknown", (inst, def) => {
    $ZodUnknown.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => unknownProcessor(inst, ctx, json, params);
  });
  function unknown() {
    return _unknown(ZodUnknown);
  }
  var ZodNever = /* @__PURE__ */ $constructor("ZodNever", (inst, def) => {
    $ZodNever.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => neverProcessor(inst, ctx, json, params);
  });
  function never(params) {
    return _never(ZodNever, params);
  }
  var ZodArray = /* @__PURE__ */ $constructor("ZodArray", (inst, def) => {
    _ensureDefaultMemoizer();
    $ZodArray.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => arrayProcessor(inst, ctx, json, params);
    inst.element = def.element;
  }, {
    min(n, params) {
      return this.check(_minLength(n, params));
    },
    nonempty(params) {
      return this.check(_minLength(1, params));
    },
    max(n, params) {
      return this.check(_maxLength(n, params));
    },
    length(n, params) {
      return this.check(_length(n, params));
    },
    unwrap() {
      return this.element;
    }
  });
  function array(element, params) {
    return _array(ZodArray, element, params);
  }
  var ZodObject = /* @__PURE__ */ $constructor("ZodObject", (inst, def) => {
    _ensureDefaultMemoizer();
    $ZodObjectJIT.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => objectProcessor(inst, ctx, json, params);
    util_exports.installLazyProp(inst, "shape", (self) => self._zod.def.shape, false);
  }, {
    keyof() {
      return _enum(Object.keys(this._zod.def.shape));
    },
    catchall(catchall) {
      return this.clone(util_exports.mergeDefs(this._zod.def, { catchall }));
    },
    passthrough() {
      return this.clone(util_exports.mergeDefs(this._zod.def, { catchall: unknown() }));
    },
    loose() {
      return this.clone(util_exports.mergeDefs(this._zod.def, { catchall: unknown() }));
    },
    strict() {
      return this.clone(util_exports.mergeDefs(this._zod.def, { catchall: never() }));
    },
    strip() {
      return this.clone(util_exports.mergeDefs(this._zod.def, { catchall: void 0 }));
    },
    extend(incoming) {
      return util_exports.extend(this, incoming);
    },
    safeExtend(incoming) {
      return util_exports.safeExtend(this, incoming);
    },
    merge(other) {
      return util_exports.merge(this, other);
    },
    pick(mask) {
      return util_exports.pick(this, mask);
    },
    omit(mask) {
      return util_exports.omit(this, mask);
    },
    partial(...args) {
      return util_exports.partial(ZodOptional, this, args[0]);
    },
    exactPartial(...args) {
      return util_exports.partial(ZodExactOptional, this, args[0], "exactPartial");
    },
    required(...args) {
      return util_exports.required(ZodNonOptional, this, args[0]);
    }
  });
  function object(shape, params) {
    const def = {
      type: "object",
      shape: shape ?? {},
      ...util_exports.normalizeParams(params)
    };
    return new ZodObject(def);
  }
  var ZodUnion = /* @__PURE__ */ $constructor("ZodUnion", (inst, def) => {
    $ZodUnion.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => unionProcessor(inst, ctx, json, params);
    inst.options = def.options;
  });
  function union(options, params) {
    return new ZodUnion({
      type: "union",
      options,
      ...util_exports.normalizeParams(params)
    });
  }
  var ZodDiscriminatedUnion = /* @__PURE__ */ $constructor("ZodDiscriminatedUnion", (inst, def) => {
    ZodUnion.init(inst, def);
    $ZodDiscriminatedUnion.init(inst, def);
  });
  function discriminatedUnion(discriminator, options, params) {
    return new ZodDiscriminatedUnion({
      type: "union",
      options,
      discriminator,
      ...util_exports.normalizeParams(params)
    });
  }
  var ZodIntersection = /* @__PURE__ */ $constructor("ZodIntersection", (inst, def) => {
    $ZodIntersection.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => intersectionProcessor(inst, ctx, json, params);
  });
  function intersection(left, right) {
    return new ZodIntersection({
      type: "intersection",
      left,
      right
    });
  }
  var ZodRecord = /* @__PURE__ */ $constructor("ZodRecord", (inst, def) => {
    _ensureDefaultMemoizer();
    $ZodRecord.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => recordProcessor(inst, ctx, json, params);
    inst.keyType = def.keyType;
    inst.valueType = def.valueType;
  });
  function record(keyType, valueType, params) {
    if (!valueType || !valueType._zod) {
      return new ZodRecord({
        type: "record",
        keyType: string2(),
        valueType: keyType,
        ...util_exports.normalizeParams(valueType)
      });
    }
    return new ZodRecord({
      type: "record",
      keyType,
      valueType,
      ...util_exports.normalizeParams(params)
    });
  }
  var ZodEnum = /* @__PURE__ */ $constructor("ZodEnum", (inst, def) => {
    $ZodEnum.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => enumProcessor(inst, ctx, json, params);
    inst.enum = def.entries;
    inst.options = [...inst._zod.values];
    const keys = new Set(Object.keys(def.entries));
    inst.extract = (values, params) => {
      const newEntries = {};
      for (const value of values) {
        if (keys.has(value)) {
          newEntries[value] = def.entries[value];
        } else
          throw new Error(`Key ${value} not found in enum`);
      }
      return new ZodEnum({
        ...def,
        checks: [],
        ...util_exports.normalizeParams(params),
        entries: newEntries
      });
    };
    inst.exclude = (values, params) => {
      const newEntries = { ...def.entries };
      for (const value of values) {
        if (keys.has(value)) {
          delete newEntries[value];
        } else
          throw new Error(`Key ${value} not found in enum`);
      }
      return new ZodEnum({
        ...def,
        checks: [],
        ...util_exports.normalizeParams(params),
        entries: newEntries
      });
    };
  });
  function _enum(values, params) {
    const entries = Array.isArray(values) ? Object.fromEntries(values.map((v) => [v, v])) : values;
    return new ZodEnum({
      type: "enum",
      entries,
      ...util_exports.normalizeParams(params)
    });
  }
  var ZodLiteral = /* @__PURE__ */ $constructor("ZodLiteral", (inst, def) => {
    $ZodLiteral.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => literalProcessor(inst, ctx, json, params);
    inst.values = new Set(def.values);
    Object.defineProperty(inst, "value", {
      get() {
        if (def.values.length > 1) {
          throw new Error("This schema contains multiple valid literal values. Use `.values` instead.");
        }
        return def.values[0];
      }
    });
  });
  function literal(value, params) {
    return new ZodLiteral({
      type: "literal",
      values: Array.isArray(value) ? value : [value],
      ...util_exports.normalizeParams(params)
    });
  }
  var ZodTransform = /* @__PURE__ */ $constructor("ZodTransform", (inst, def) => {
    _ensureDefaultMemoizer();
    $ZodTransform.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => transformProcessor(inst, ctx, json, params);
    inst._zod.parse = (payload, _ctx) => {
      if (_ctx.direction === "backward") {
        throw new $ZodEncodeError(inst.constructor.name);
      }
      payload.addIssue = (issue2) => {
        if (typeof issue2 === "string") {
          payload.issues.push(util_exports.issue(issue2, payload.value, def));
        } else {
          const _issue = issue2;
          if (_issue.fatal)
            _issue.continue = false;
          _issue.code ?? (_issue.code = "custom");
          if (!("input" in _issue))
            _issue.input = payload.value;
          _issue.inst ?? (_issue.inst = inst);
          payload.issues.push(util_exports.issue(_issue));
        }
      };
      const output = def.transform(payload.value, payload);
      if (output instanceof Promise) {
        return output.then((output2) => {
          payload.value = output2;
          return payload;
        });
      }
      payload.value = output;
      return payload;
    };
  });
  function transform(fn) {
    return new ZodTransform({
      type: "transform",
      transform: fn
    });
  }
  var ZodOptional = /* @__PURE__ */ $constructor("ZodOptional", (inst, def) => {
    $ZodOptional.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => optionalProcessor(inst, ctx, json, params);
    inst.unwrap = () => inst._zod.def.innerType;
  });
  function optional(innerType) {
    return new ZodOptional({
      type: "optional",
      innerType
    });
  }
  var ZodExactOptional = /* @__PURE__ */ $constructor("ZodExactOptional", (inst, def) => {
    $ZodExactOptional.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => optionalProcessor(inst, ctx, json, params);
    inst.unwrap = () => inst._zod.def.innerType;
  });
  function exactOptional(innerType) {
    return new ZodExactOptional({
      type: "optional",
      innerType
    });
  }
  var ZodNullable = /* @__PURE__ */ $constructor("ZodNullable", (inst, def) => {
    $ZodNullable.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => nullableProcessor(inst, ctx, json, params);
    inst.unwrap = () => inst._zod.def.innerType;
  });
  function nullable(innerType) {
    return new ZodNullable({
      type: "nullable",
      innerType
    });
  }
  var ZodDefault = /* @__PURE__ */ $constructor("ZodDefault", (inst, def) => {
    $ZodDefault.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => defaultProcessor(inst, ctx, json, params);
    inst.unwrap = () => inst._zod.def.innerType;
    inst.removeDefault = inst.unwrap;
  });
  function _default(innerType, defaultValue) {
    return new ZodDefault({
      type: "default",
      innerType,
      get defaultValue() {
        return typeof defaultValue === "function" ? defaultValue() : util_exports.shallowClone(defaultValue);
      }
    });
  }
  var ZodPrefault = /* @__PURE__ */ $constructor("ZodPrefault", (inst, def) => {
    $ZodPrefault.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => prefaultProcessor(inst, ctx, json, params);
    inst.unwrap = () => inst._zod.def.innerType;
  });
  function prefault(innerType, defaultValue) {
    return new ZodPrefault({
      type: "prefault",
      innerType,
      get defaultValue() {
        return typeof defaultValue === "function" ? defaultValue() : util_exports.shallowClone(defaultValue);
      }
    });
  }
  var ZodNonOptional = /* @__PURE__ */ $constructor("ZodNonOptional", (inst, def) => {
    $ZodNonOptional.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => nonoptionalProcessor(inst, ctx, json, params);
    inst.unwrap = () => inst._zod.def.innerType;
  });
  function nonoptional(innerType, params) {
    return new ZodNonOptional({
      type: "nonoptional",
      innerType,
      ...util_exports.normalizeParams(params)
    });
  }
  var ZodCatch = /* @__PURE__ */ $constructor("ZodCatch", (inst, def) => {
    $ZodCatch.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => catchProcessor(inst, ctx, json, params);
    inst.unwrap = () => inst._zod.def.innerType;
    inst.removeCatch = inst.unwrap;
  });
  function _catch(innerType, catchValue) {
    return new ZodCatch({
      type: "catch",
      innerType,
      catchValue: typeof catchValue === "function" ? catchValue : util_exports.constantCatch(catchValue)
    });
  }
  var ZodPipe = /* @__PURE__ */ $constructor("ZodPipe", (inst, def) => {
    $ZodPipe.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => pipeProcessor(inst, ctx, json, params);
    inst.in = def.in;
    inst.out = def.out;
  });
  function pipe(in_, out) {
    return new ZodPipe({
      type: "pipe",
      in: in_,
      out
      // ...util.normalizeParams(params),
    });
  }
  var ZodReadonly = /* @__PURE__ */ $constructor("ZodReadonly", (inst, def) => {
    $ZodReadonly.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => readonlyProcessor(inst, ctx, json, params);
    inst.unwrap = () => inst._zod.def.innerType;
  });
  function readonly(innerType) {
    return new ZodReadonly({
      type: "readonly",
      innerType
    });
  }
  var ZodCustom = /* @__PURE__ */ $constructor("ZodCustom", (inst, def) => {
    $ZodCustom.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => customProcessor(inst, ctx, json, params);
  });
  function refine(fn, _params = {}) {
    return _refine(ZodCustom, fn, _params);
  }
  function superRefine(fn, params) {
    return _superRefine(fn, params);
  }

  // packages/contracts/src/schemas.ts
  var PAYLOAD_LIMITS = {
    /** Profundidad máxima del árbol (evita desbordar la pila del plugin) */
    maxDepth: 400,
    /** Nodos totales (una landing grande ronda 5–15 mil) */
    maxNodes: 15e4,
    /** Caracteres de una imagen base64 (~30 MB) */
    maxImageChars: 40 * 1024 * 1024,
    maxSvgChars: 2 * 1024 * 1024,
    maxTextChars: 2e5,
    maxNameChars: 1e3
  };
  var finite = number2().finite();
  var sizing = union([finite, literal("FILL"), literal("HUG")]);
  var spacing = object({ top: finite, right: finite, bottom: finite, left: finite }).partial().passthrough();
  var UILayoutSchema = object({
    mode: _enum(["NONE", "HORIZONTAL", "VERTICAL"]).optional(),
    width: sizing.optional(),
    height: sizing.optional(),
    measuredWidth: finite.optional(),
    measuredHeight: finite.optional(),
    x: finite.optional(),
    y: finite.optional(),
    itemSpacing: finite.optional(),
    padding: spacing.optional(),
    positioning: _enum(["AUTO", "ABSOLUTE"]).optional()
  }).passthrough();
  var UITextSegmentSchema = object({
    start: number2().int().nonnegative(),
    end: number2().int().nonnegative()
  }).passthrough();
  var UITextDataSchema = object({
    characters: string2().max(PAYLOAD_LIMITS.maxTextChars),
    fontSize: finite.optional(),
    fontFamily: string2().max(200).optional(),
    segments: array(UITextSegmentSchema).max(1e4).optional()
  }).passthrough();
  var svgContent = string2().max(PAYLOAD_LIMITS.maxSvgChars).refine((s) => !/<script[\s>]/i.test(s), "SVG con <script>").refine((s) => !/javascript:/i.test(s), "SVG con URL javascript:");
  var imageData = string2().max(PAYLOAD_LIMITS.maxImageChars).regex(/^data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=\s]*$/i, "imageData debe ser data:image/...;base64");
  var UINodeShallowSchema = object({
    id: string2().max(200).optional(),
    type: _enum(["FRAME", "TEXT", "SVG", "COMPONENT", "INSTANCE"]),
    name: string2().max(PAYLOAD_LIMITS.maxNameChars).optional(),
    layout: UILayoutSchema.optional(),
    styles: object({}).passthrough().optional(),
    textData: UITextDataSchema.optional(),
    svgContent: svgContent.optional(),
    imageData: imageData.optional(),
    children: array(unknown()).optional()
  }).passthrough();
  function shortPath(path) {
    return path.length > 160 ? "rootNode…" + path.slice(-140) : path;
  }
  function validateUINodeTree(root) {
    const stack = [{ node: root, depth: 0, path: "rootNode" }];
    let count = 0;
    let maxDepth = 0;
    while (stack.length) {
      const { node: node2, depth, path } = stack.pop();
      if (depth > PAYLOAD_LIMITS.maxDepth)
        return {
          ok: false,
          error: `Árbol demasiado profundo (> ${PAYLOAD_LIMITS.maxDepth} niveles) en ${shortPath(path)}`
        };
      if (++count > PAYLOAD_LIMITS.maxNodes)
        return { ok: false, error: `Demasiados nodos (> ${PAYLOAD_LIMITS.maxNodes})` };
      maxDepth = Math.max(maxDepth, depth);
      const parsed = UINodeShallowSchema.safeParse(node2);
      if (!parsed.success) {
        const issue2 = parsed.error.issues[0];
        return {
          ok: false,
          error: `${shortPath(path)}${issue2.path.length ? "." + issue2.path.join(".") : ""}: ${issue2.message}`
        };
      }
      const children = parsed.data.children || [];
      for (let i = children.length - 1; i >= 0; i--) {
        stack.push({ node: children[i], depth: depth + 1, path: `${path}.children[${i}]` });
      }
    }
    return { ok: true, nodeCount: count, maxDepth };
  }
  var WSRenderPayloadSchema = object({
    rootNode: unknown(),
    tokens: object({}).passthrough().optional(),
    createAsComponent: boolean2().optional(),
    board: boolean2().optional(),
    /** Estados extra del mismo componente (fase 6.1): Hover, Focus… → variantes State=… */
    states: array(object({ name: string2().min(1).max(40), rootNode: unknown() }).passthrough()).max(4).optional(),
    /** Equivalencias de fuentes de los ajustes del plugin (fase 5.3) */
    fontMap: record(string2().max(200), string2().max(200)).optional(),
    clearPage: boolean2().optional(),
    pageName: string2().max(200).optional(),
    sectionTitle: string2().max(500).optional(),
    source: object({
      url: string2().max(4096).optional(),
      title: string2().max(1e3).optional()
    }).passthrough().optional()
  }).passthrough();
  function validateRenderPayload(payload) {
    const env = WSRenderPayloadSchema.safeParse(payload);
    if (!env.success) {
      const issue2 = env.error.issues[0];
      return { ok: false, error: `payload${issue2.path.length ? "." + issue2.path.join(".") : ""}: ${issue2.message}` };
    }
    const main = validateUINodeTree(env.data.rootNode);
    if (!main.ok) return main;
    let nodeCount = main.nodeCount;
    let maxDepth = main.maxDepth;
    for (const [i, st] of (env.data.states || []).entries()) {
      const r = validateUINodeTree(st.rootNode);
      if (!r.ok) return { ok: false, error: `states[${i}]: ${r.error}` };
      nodeCount += r.nodeCount;
      maxDepth = Math.max(maxDepth, r.maxDepth);
      if (nodeCount > PAYLOAD_LIMITS.maxNodes)
        return { ok: false, error: `Demasiados nodos (> ${PAYLOAD_LIMITS.maxNodes})` };
    }
    return { ok: true, nodeCount, maxDepth };
  }
  var WSMessageEnvelopeSchema = object({
    type: string2().min(1).max(64)
  }).passthrough();

  // packages/contracts/src/messages.ts
  var MAX_CHUNKS = 256;
  var MAX_CHUNK_CHARS = 1024 * 1024;
  var RegisterSchema = object({
    type: _enum(["REGISTER_CLIENT", "REGISTER"]),
    clientType: string2().max(64).optional(),
    role: string2().max(64).optional(),
    client: string2().max(200).optional(),
    pairingCode: string2().max(32).optional()
  }).passthrough();
  var RenderTimingsSchema = object({
    fontsMs: number2().finite(),
    buildMs: number2().finite(),
    placeMs: number2().finite(),
    totalMs: number2().finite()
  }).partial();
  var FontSubstitutionsSchema = array(object({ requested: string2().max(200), used: string2().max(200), texts: number2().int().min(0) })).max(50);
  var HubInboundSchema = discriminatedUnion("type", [
    RegisterSchema,
    object({ type: literal("GET_STATUS") }).passthrough(),
    object({ type: literal("PING") }).passthrough(),
    object({ type: literal("GET_VIEWS_CATALOG") }).passthrough(),
    object({ type: literal("REQUEST_VIEW_RENDER"), payload: object({}).passthrough().optional() }).passthrough(),
    object({ type: literal("RENDER_NODES"), payload: unknown() }).passthrough(),
    object({
      type: literal("RENDER_CHUNK"),
      transferId: string2().min(1).max(64),
      index: number2().int().min(0),
      total: number2().int().min(1).max(MAX_CHUNKS),
      data: string2().max(MAX_CHUNK_CHARS)
    }),
    object({
      type: literal("RENDER_SUCCESS"),
      nodeId: string2().max(200).optional(),
      name: string2().max(1e3).optional(),
      durationMs: number2().finite().optional(),
      timings: RenderTimingsSchema.optional(),
      fontSubstitutions: FontSubstitutionsSchema.optional()
    }).passthrough(),
    object({ type: literal("RENDER_ERROR"), error: string2().max(5e3).optional() }).passthrough()
  ]);

  // packages/contracts/src/logger.ts
  var ORDER = { debug: 10, info: 20, warn: 30, error: 40 };
  function createLogger(scope, options) {
    const min = ORDER[options.level || "info"];
    const emit = (level, message, data) => {
      if (ORDER[level] < min) return;
      const record2 = { time: (/* @__PURE__ */ new Date()).toISOString(), level, scope, message, ...data ? { data } : {} };
      for (const sink of options.sinks) {
        try {
          sink(record2);
        } catch (_e) {
        }
      }
    };
    return {
      debug: (m, d) => emit("debug", m, d),
      info: (m, d) => emit("info", m, d),
      warn: (m, d) => emit("warn", m, d),
      error: (m, d) => emit("error", m, d),
      child: (sub) => createLogger(`${scope}:${sub}`, options)
    };
  }
  function formatLogRecord(r) {
    const data = r.data && Object.keys(r.data).length ? " " + JSON.stringify(r.data) : "";
    return `[${r.scope}] ${r.message}${data}`;
  }

  // packages/contracts/src/payload-stats.ts
  var HEAVY_PAYLOAD = {
    /** Más de esto: aviso antes de enviar */
    bytes: 15 * 1024 * 1024,
    nodes: 25e3,
    depth: 200
  };
  var CHUNK_THRESHOLD_BYTES = 1024 * 1024;
  var CHUNK_SIZE_CHARS = 512 * 1024;

  // packages/figma-plugin/src/log.ts
  var figmaConsoleSink = (r) => {
    const line = formatLogRecord(r);
    if (r.level === "error") console.error(line);
    else if (r.level === "warn") console.warn(line);
    else console.log(line);
  };
  var log = createLogger("plugin", { sinks: [figmaConsoleSink] });
  var errText = (e) => String(e?.message || e);

  // packages/figma-plugin/src/fonts.ts
  var availableFontsCache = null;
  var fontLookupMap = /* @__PURE__ */ new Map();
  function refreshFontCache() {
    availableFontsCache = null;
    fontLookupMap.clear();
    fontResolutionCache.clear();
  }
  async function initFontCache() {
    if (availableFontsCache && fontLookupMap.size > 0) return;
    try {
      if (typeof figma.listAvailableFontsAsync === "function") {
        availableFontsCache = await figma.listAvailableFontsAsync();
        fontLookupMap.clear();
        for (const f of availableFontsCache) {
          const famLower = f.fontName.family.toLowerCase();
          if (!fontLookupMap.has(famLower)) {
            fontLookupMap.set(famLower, []);
          }
          fontLookupMap.get(famLower).push(f.fontName);
        }
      }
    } catch (err) {
      log.warn("No se pudo obtener la lista de fuentes disponibles", { error: errText(err) });
    }
  }
  function resolveFontWeight(weight) {
    const num = typeof weight === "string" ? parseInt(weight, 10) : weight;
    if (isNaN(num)) {
      const lower = String(weight).toLowerCase();
      if (lower.includes("black") || lower.includes("900")) return "Black";
      if (lower.includes("extra") && lower.includes("bold") || lower.includes("800")) return "Extra Bold";
      if (lower.includes("bold") || lower.includes("700")) return "Bold";
      if (lower.includes("semibold") || lower.includes("semi-bold") || lower.includes("600")) return "Semi Bold";
      if (lower.includes("medium") || lower.includes("500")) return "Medium";
      if (lower.includes("light") || lower.includes("300")) return "Light";
      if (lower.includes("thin") || lower.includes("100")) return "Thin";
      return "Regular";
    }
    if (num >= 900) return "Black";
    if (num >= 800) return "Extra Bold";
    if (num >= 700) return "Bold";
    if (num >= 600) return "Semi Bold";
    if (num >= 500) return "Medium";
    if (num >= 400) return "Regular";
    if (num >= 300) return "Light";
    return "Regular";
  }
  var GENERIC_FAMILIES = {
    "system-ui": ["SF Pro Text", "SF Pro Display", "SF Pro", "Segoe UI", "Roboto", "Inter"],
    "-apple-system": ["SF Pro Text", "SF Pro Display", "SF Pro", "Segoe UI", "Inter"],
    blinkmacsystemfont: ["SF Pro Text", "SF Pro Display", "SF Pro", "Segoe UI", "Inter"],
    "ui-sans-serif": ["SF Pro Text", "Segoe UI", "Roboto", "Inter"],
    "sans-serif": ["Inter", "Helvetica Neue", "Arial", "Roboto"],
    serif: ["Georgia", "Times New Roman", "Noto Serif", "Source Serif Pro"],
    "ui-serif": ["New York", "Georgia", "Times New Roman"],
    monospace: ["SF Mono", "Menlo", "Consolas", "Roboto Mono", "JetBrains Mono", "Courier New"],
    "ui-monospace": ["SF Mono", "Menlo", "Consolas", "Roboto Mono", "Courier New"]
  };
  var DEFAULT_FONT_EQUIVALENTS = {
    "sf pro": ["SF Pro Display", "SF Pro Text", "Inter"],
    "sf pro display": ["SF Pro", "Inter"],
    "sf pro text": ["SF Pro", "Inter"],
    helvetica: ["Helvetica Neue", "Arial"],
    "helvetica neue": ["Helvetica", "Arial"],
    circular: ["Inter"],
    "circular std": ["Inter"],
    "proxima nova": ["Montserrat", "Inter"],
    gotham: ["Montserrat", "Inter"],
    avenir: ["Avenir Next", "Nunito Sans", "Inter"],
    "avenir next": ["Avenir", "Nunito Sans", "Inter"],
    "segoe ui": ["Inter", "Roboto"]
  };
  var cleanFamily = (f) => f.replace(/['"]/g, "").trim();
  var isGenericFamily = (f) => Object.prototype.hasOwnProperty.call(GENERIC_FAMILIES, f.toLowerCase());
  var userFontMap = {};
  function setUserFontMap(map) {
    userFontMap = {};
    if (map && typeof map === "object") {
      for (const [from, to] of Object.entries(map)) {
        if (typeof to === "string" && to.trim()) userFontMap[cleanFamily(from).toLowerCase()] = cleanFamily(to);
      }
    }
    fontResolutionCache.clear();
  }
  function fontCandidates(fontFamily, userMap = userFontMap) {
    const stack = String(fontFamily || "Inter").split(",").map(cleanFamily).filter(Boolean);
    const out = [];
    const add = (f) => {
      if (f && !out.some((x) => x.toLowerCase() === f.toLowerCase())) out.push(f);
    };
    for (const fam of stack) {
      const key = fam.toLowerCase();
      if (userMap[key]) add(userMap[key]);
      if (isGenericFamily(fam)) GENERIC_FAMILIES[key].forEach(add);
      else add(fam);
      (DEFAULT_FONT_EQUIVALENTS[key] || []).forEach(add);
    }
    ["Inter", "Roboto", "Arial"].forEach(add);
    return out;
  }
  var substitutions = /* @__PURE__ */ new Map();
  function resetFontReport() {
    substitutions.clear();
  }
  function getFontReport() {
    return Array.from(substitutions.values()).sort((a, b) => b.texts - a.texts);
  }
  function recordUse(fontFamily, used) {
    const stack = String(fontFamily || "").split(",").map(cleanFamily).filter(Boolean);
    const requested = stack.find((f) => !isGenericFamily(f)) || stack[0];
    if (!requested || requested.toLowerCase() === used.family.toLowerCase()) return;
    const key = requested.toLowerCase() + "→" + used.family.toLowerCase();
    const entry = substitutions.get(key) || { requested, used: used.family, texts: 0 };
    entry.texts++;
    substitutions.set(key, entry);
  }
  var fontResolutionCache = /* @__PURE__ */ new Map();
  async function loadFontSafely(fontFamily, fontWeight, options = {}) {
    const cacheKey = fontFamily + "|" + fontWeight;
    let font = fontResolutionCache.get(cacheKey);
    if (!font) {
      font = await resolveFont(fontFamily, fontWeight);
      fontResolutionCache.set(cacheKey, font);
    }
    if (options.track) recordUse(fontFamily, font);
    return font;
  }
  async function resolveFont(fontFamily, fontWeight) {
    try {
      await figma.loadFontAsync({ family: "Inter", style: "Regular" });
    } catch (_e) {
    }
    await initFontCache();
    const targetStyle = resolveFontWeight(fontWeight);
    const candidates = fontCandidates(fontFamily);
    const styleVariants = [targetStyle];
    if (targetStyle === "Semi Bold") styleVariants.push("Semibold", "Semi-Bold", "Demibold");
    else if (targetStyle === "Extra Bold") styleVariants.push("Extrabold", "Extra-Bold");
    if (!styleVariants.includes("Regular")) styleVariants.push("Regular");
    if (fontLookupMap.size > 0) {
      for (const cand of candidates) {
        const availableStyles = fontLookupMap.get(cand.toLowerCase());
        if (availableStyles && availableStyles.length > 0) {
          for (const wantStyle of styleVariants) {
            const match = availableStyles.find((s) => s.style.toLowerCase() === wantStyle.toLowerCase());
            if (match) {
              try {
                await figma.loadFontAsync(match);
                return match;
              } catch (_e) {
              }
            }
          }
          const regularMatch = availableStyles.find((s) => s.style.toLowerCase() === "regular") || availableStyles[0];
          try {
            await figma.loadFontAsync(regularMatch);
            return regularMatch;
          } catch (_e) {
          }
        }
      }
    }
    for (const st of [targetStyle, "Regular"]) {
      try {
        const f = { family: "Inter", style: st };
        await figma.loadFontAsync(f);
        return f;
      } catch (_e) {
      }
    }
    return { family: "Inter", style: "Regular" };
  }
  async function prewarmFonts(node2) {
    try {
      await figma.loadFontAsync({ family: "Inter", style: "Regular" });
    } catch (_e) {
    }
    await initFontCache();
    const fontsToLoad = /* @__PURE__ */ new Set();
    function traverse(n) {
      if (n.type === "TEXT" && n.textData) {
        const fam = n.textData.fontStack || n.textData.fontFamily || "Inter";
        const weight = n.textData.fontWeight || 400;
        fontsToLoad.add(`${fam}:::${weight}`);
      }
      if (n.children) {
        for (const child of n.children) traverse(child);
      }
    }
    traverse(node2);
    await Promise.all(
      Array.from(fontsToLoad).map(async (key) => {
        const [family, weight] = key.split(":::");
        await loadFontSafely(family, weight);
      })
    );
  }

  // packages/figma-plugin/src/gradient-geometry.ts
  var resolveLen = (l, total, fallback) => !l || !isFinite(l.v) ? fallback : l.u === "%" ? l.v / 100 * total : l.v;
  function invert(m) {
    const [[a, b, c], [d, e, f]] = m;
    const det = a * e - b * d;
    if (Math.abs(det) < 1e-12)
      return [
        [1, 0, 0],
        [0, 1, 0]
      ];
    return [
      [e / det, -b / det, (b * f - c * e) / det],
      [-d / det, a / det, (c * d - a * f) / det]
    ];
  }
  function transformFromHandles(kind, S, E, W) {
    let c0, c1, t;
    if (kind === "linear") {
      c0 = [E[0] - S[0], E[1] - S[1]];
      c1 = [2 * (W[0] - S[0]), 2 * (W[1] - S[1])];
      t = [S[0] - 0.5 * c1[0], S[1] - 0.5 * c1[1]];
    } else {
      c0 = [2 * (E[0] - S[0]), 2 * (E[1] - S[1])];
      c1 = [2 * (W[0] - S[0]), 2 * (W[1] - S[1])];
      t = [S[0] - 0.5 * c0[0] - 0.5 * c1[0], S[1] - 0.5 * c0[1] - 0.5 * c1[1]];
    }
    const M = [
      [c0[0], c1[0], t[0]],
      [c0[1], c1[1], t[1]]
    ];
    return invert(M);
  }
  var norm = ([x, y], w, h) => [x / w, y / h];
  function cornerAngle(toCorner, w, h) {
    const sx = /right/.test(toCorner) ? 1 : -1;
    const sy = /bottom/.test(toCorner) ? 1 : -1;
    return Math.atan2(sx * h, -sy * w) * 180 / Math.PI;
  }
  function linearGeometry(desc, w, h) {
    const angle = desc.toCorner ? cornerAngle(desc.toCorner, w, h) : typeof desc.angle === "number" ? desc.angle : 180;
    const rad = angle * Math.PI / 180;
    const dir = [Math.sin(rad), -Math.cos(rad)];
    const L = Math.abs(w * dir[0]) + Math.abs(h * dir[1]) || 1;
    const C = [w / 2, h / 2];
    const S = [C[0] - dir[0] * L / 2, C[1] - dir[1] * L / 2];
    const E = [C[0] + dir[0] * L / 2, C[1] + dir[1] * L / 2];
    const W = [S[0] - dir[1] * L / 2, S[1] + dir[0] * L / 2];
    return { T: transformFromHandles("linear", norm(S, w, h), norm(E, w, h), norm(W, w, h)), rayPx: L };
  }
  function radialGeometry(desc, w, h) {
    const cx = resolveLen(desc.at?.x, w, w / 2);
    const cy = resolveLen(desc.at?.y, h, h / 2);
    const sideX = { closest: Math.min(cx, w - cx), farthest: Math.max(cx, w - cx) };
    const sideY = { closest: Math.min(cy, h - cy), farthest: Math.max(cy, h - cy) };
    const corners = [
      [0, 0],
      [w, 0],
      [0, h],
      [w, h]
    ].map(([x, y]) => Math.hypot(x - cx, y - cy));
    const explicit = Array.isArray(desc.size) ? desc.size : null;
    const shape = desc.shape || (explicit && explicit.length === 1 ? "circle" : "ellipse");
    const size = explicit ? null : desc.size || "farthest-corner";
    let rx, ry;
    if (explicit) {
      rx = resolveLen(explicit[0], w, w / 2);
      ry = shape === "circle" ? rx : resolveLen(explicit[1] || explicit[0], h, h / 2);
    } else if (shape === "circle") {
      const r = size === "closest-side" ? Math.min(sideX.closest, sideY.closest) : size === "farthest-side" ? Math.max(sideX.farthest, sideY.farthest) : size === "closest-corner" ? Math.min(...corners) : Math.max(...corners);
      rx = ry = r;
    } else {
      const k = size === "closest-corner" || size === "farthest-corner" ? Math.SQRT2 : 1;
      const which = size === "closest-side" || size === "closest-corner" ? "closest" : "farthest";
      rx = sideX[which] * k;
      ry = sideY[which] * k;
    }
    rx = Math.max(0.5, rx);
    ry = Math.max(0.5, ry);
    const C = [cx, cy];
    return {
      T: transformFromHandles("radial", norm(C, w, h), norm([cx + rx, cy], w, h), norm([cx, cy + ry], w, h)),
      rayPx: rx
    };
  }
  function conicGeometry(desc, w, h) {
    const cx = resolveLen(desc.at?.x, w, w / 2);
    const cy = resolveLen(desc.at?.y, h, h / 2);
    const rad = (desc.from || 0) * Math.PI / 180;
    const r = Math.max(w, h) / 2 || 1;
    const dir = [Math.sin(rad), -Math.cos(rad)];
    const E = [cx + dir[0] * r, cy + dir[1] * r];
    const W = [cx - dir[1] * r, cy + dir[0] * r];
    return { T: transformFromHandles("radial", norm([cx, cy], w, h), norm(E, w, h), norm(W, w, h)), rayPx: 360 };
  }
  function resolveStops(stops, rayPx) {
    const n = stops.length;
    const pos = stops.map(
      (s) => typeof s.position === "number" ? s.position : typeof s.px === "number" ? s.px / (rayPx || 1) : void 0
    );
    if (n === 0) return [];
    if (pos[0] === void 0) pos[0] = 0;
    if (pos[n - 1] === void 0) pos[n - 1] = 1;
    for (let i2 = 1; i2 < n; i2++) if (pos[i2] !== void 0 && pos[i2] < pos[i2 - 1]) pos[i2] = pos[i2 - 1];
    let i = 0;
    while (i < n) {
      if (pos[i] !== void 0) {
        i++;
        continue;
      }
      const start = i - 1;
      let end = i;
      while (pos[end] === void 0) end++;
      const a = pos[start], b = pos[end];
      for (let k = start + 1; k < end; k++) pos[k] = a + (b - a) * (k - start) / (end - start);
      i = end;
    }
    return pos.map((p) => Math.max(0, Math.min(1, p)));
  }

  // packages/figma-plugin/src/paint.ts
  function base64ToBytes(dataUrl) {
    const clean = dataUrl.replace(/^data:[^;]+;base64,/, "").replace(/\s/g, "");
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    const lookup = new Uint8Array(256);
    for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;
    let len = Math.floor(clean.length * 0.75);
    if (clean.endsWith("==")) len -= 2;
    else if (clean.endsWith("=")) len -= 1;
    const bytes = new Uint8Array(len);
    let p = 0;
    for (let i = 0; i < clean.length; i += 4) {
      const e1 = lookup[clean.charCodeAt(i)], e2 = lookup[clean.charCodeAt(i + 1)];
      const e3 = lookup[clean.charCodeAt(i + 2)], e4 = lookup[clean.charCodeAt(i + 3)];
      bytes[p++] = e1 << 2 | e2 >> 4;
      if (clean[i + 2] !== "=") bytes[p++] = (e2 & 15) << 4 | e3 >> 2;
      if (clean[i + 3] !== "=") bytes[p++] = (e3 & 3) << 6 | e4 & 63;
    }
    return bytes;
  }
  function cssFillToPaint(f, w = 100, h = 100) {
    const width = w > 0 ? w : 100;
    const height = h > 0 ? h : 100;
    if (f.type === "GRADIENT_LINEAR" || f.type === "GRADIENT_RADIAL" || f.type === "GRADIENT_ANGULAR") {
      const geo = f.type === "GRADIENT_LINEAR" ? linearGeometry(f, width, height) : f.type === "GRADIENT_RADIAL" ? radialGeometry(f, width, height) : conicGeometry(f, width, height);
      const stops = f.stops || [];
      const positions = resolveStops(stops, geo.rayPx);
      return {
        type: f.type,
        gradientTransform: geo.T,
        gradientStops: stops.map((s, i) => ({
          position: positions[i],
          color: { r: s.color.r, g: s.color.g, b: s.color.b, a: s.color.a !== void 0 ? s.color.a : 1 }
        }))
      };
    }
    return {
      type: "SOLID",
      color: { r: f.r, g: f.g, b: f.b },
      opacity: f.a !== void 0 ? f.a : 1
    };
  }

  // packages/figma-plugin/src/effects.ts
  var BLEND_MODES = /* @__PURE__ */ new Set([
    "MULTIPLY",
    "SCREEN",
    "OVERLAY",
    "DARKEN",
    "LIGHTEN",
    "COLOR_DODGE",
    "COLOR_BURN",
    "HARD_LIGHT",
    "SOFT_LIGHT",
    "DIFFERENCE",
    "EXCLUSION",
    "HUE",
    "SATURATION",
    "COLOR",
    "LUMINOSITY",
    "LINEAR_DODGE",
    "LINEAR_BURN"
  ]);
  var dropShadow = (s, withSpread) => ({
    type: "DROP_SHADOW",
    color: { r: s.color.r, g: s.color.g, b: s.color.b, a: s.color.a !== void 0 ? s.color.a : 1 },
    offset: { x: s.offset.x, y: s.offset.y },
    radius: Math.max(0, s.radius),
    spread: withSpread ? s.spread || 0 : 0,
    visible: true,
    blendMode: "NORMAL"
  });
  function effectsFromStyles(styles, kind) {
    const effects = [];
    if (!styles) return effects;
    if (kind === "FRAME") {
      for (const s of styles.boxShadow || []) effects.push(dropShadow(s, true));
      for (const s of styles.dropShadows || []) effects.push(dropShadow(s, false));
      if (typeof styles.backdropBlur === "number" && styles.backdropBlur > 0) {
        effects.push({ type: "BACKGROUND_BLUR", radius: Math.max(1, styles.backdropBlur), visible: true });
      }
    } else {
      for (const s of styles.textShadow || []) effects.push(dropShadow(s, false));
    }
    if (typeof styles.layerBlur === "number" && styles.layerBlur > 0) {
      effects.push({ type: "LAYER_BLUR", radius: styles.layerBlur, visible: true });
    }
    return effects;
  }
  function blendModeFromStyles(styles) {
    const m = styles && typeof styles.blendMode === "string" ? styles.blendMode : "";
    return BLEND_MODES.has(m) ? m : null;
  }

  // packages/figma-plugin/src/board/context.ts
  var current = null;
  function getBoardCtx() {
    return current;
  }
  function setBoardCtx(ctx) {
    current = ctx;
  }

  // packages/figma-plugin/src/board/pure.ts
  function boardHash(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = (h << 5) + h + str.charCodeAt(i) | 0;
    return (h >>> 0).toString(36);
  }
  function boardColorKey(f) {
    if (!f) return "-";
    if (f.type && f.type !== "SOLID") {
      return f.type + "(" + (f.stops || []).map((s) => boardColorKey(s.color)).join(",") + ")";
    }
    const c = (v) => Math.round((v || 0) * 255).toString(16).padStart(2, "0");
    return "#" + c(f.r) + c(f.g) + c(f.b) + (f.a !== void 0 && f.a < 0.995 ? "/" + Math.round(f.a * 100) : "");
  }
  function boardSignature(n, memo2) {
    if (memo2.has(n)) return memo2.get(n);
    let sig;
    const L = n.layout || {};
    const S = n.styles || {};
    if (n.type === "TEXT") {
      const t = n.textData || {};
      sig = ["T", t.fontFamily, t.fontSize, t.fontWeight, t.textAlign, (S.fills || []).map(boardColorKey).join(",")].join(
        "|"
      );
    } else if (n.type === "SVG") {
      sig = "S|" + boardHash(n.svgContent || "") + "|" + L.width + "x" + L.height;
    } else {
      const pad = L.padding || {};
      const style = [
        L.mode,
        L.primaryAxisAlignItems,
        L.counterAxisAlignItems,
        L.itemSpacing,
        [pad.top, pad.right, pad.bottom, pad.left].join(","),
        (S.fills || []).map(boardColorKey).join(","),
        (S.strokes || []).map((s) => boardColorKey(s) + "@" + s.width).join(","),
        JSON.stringify(S.cornerRadius ?? 0),
        S.opacity ?? 1,
        (S.boxShadow || []).length,
        n.imageData ? "IMG:" + (S.imageScaleMode || "FILL") : ""
      ].join("|");
      const h = Math.round(L.measuredHeight ?? (typeof L.height === "number" ? L.height : 0));
      sig = "F|" + style + "|h" + h + "[" + (n.children || []).map((c) => boardSignature(c, memo2)).join(";") + "]";
    }
    memo2.set(n, sig);
    return sig;
  }
  function boardCountNodes(n) {
    let c = 1;
    for (const ch of n.children || []) c += boardCountNodes(ch);
    return c;
  }
  function boardCleanName(raw) {
    let s = String(raw || "").split("(")[0].trim();
    if (s.includes("/")) return s.replace(/\s+/g, " ");
    if (!/[-_]/.test(s)) return s.replace(/\s+/g, " ") || "Componente";
    s = s.split(/\s+/)[0] || s;
    const isHash = (p) => /^[A-Za-z0-9]{4,8}$/.test(p) && (/\d/.test(p) || /[A-Z].*[A-Z]/.test(p.slice(1)) || /^[a-z][A-Z]/.test(p));
    const parts = s.split(/__|--/).map((p) => p.replace(/^_+|_+$/g, "")).filter((p) => p && !isHash(p)).filter((p) => !/-module$/i.test(p));
    let core = parts.length ? parts[parts.length - 1] : s;
    if (parts.length >= 2 && core.length <= 6) core = parts[parts.length - 2] + " " + core;
    core = core.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
    return core ? core.replace(/\b\w/g, (c) => c.toUpperCase()) : "Componente";
  }
  function boardDetectComponents(root) {
    const memo2 = /* @__PURE__ */ new Map();
    boardSignature(root, memo2);
    const rootArea = Math.max(1, (root.layout?.measuredWidth || 1) * (root.layout?.measuredHeight || 1));
    const eligible = (n) => {
      if (n === root || n.type === "TEXT" || n.type === "SVG") return false;
      if (!n.children || n.children.length === 0) return false;
      const styled = (n.styles?.fills || []).length > 0 || (n.styles?.strokes || []).length > 0;
      if (boardCountNodes(n) < 3 && !styled) return false;
      const area = (n.layout?.measuredWidth || 0) * (n.layout?.measuredHeight || 0);
      return area > 0 && area / rootArea < 0.35;
    };
    const counts = /* @__PURE__ */ new Map();
    (function count(n) {
      if (eligible(n)) counts.set(memo2.get(n), (counts.get(memo2.get(n)) || 0) + 1);
      (n.children || []).forEach(count);
    })(root);
    let allowed = new Set([...counts.entries()].filter(([, c]) => c >= 2).map(([s]) => s));
    let assigned = /* @__PURE__ */ new Map();
    for (let iter = 0; iter < 4; iter++) {
      assigned = /* @__PURE__ */ new Map();
      (function pick2(n) {
        const s = memo2.get(n);
        if (eligible(n) && allowed.has(s)) {
          if (!assigned.has(s)) assigned.set(s, []);
          assigned.get(s).push(n);
          return;
        }
        (n.children || []).forEach(pick2);
      })(root);
      const next = new Set([...assigned.entries()].filter(([, occ]) => occ.length >= 2).map(([s]) => s));
      if (next.size === allowed.size) break;
      allowed = next;
    }
    const groups = [];
    const usedNames = /* @__PURE__ */ new Map();
    for (const [, occ] of assigned) {
      if (occ.length < 2) continue;
      const base = boardCleanName(occ[0].name);
      const k = (usedNames.get(base) || 0) + 1;
      usedNames.set(base, k);
      const id = "cg_" + groups.length;
      groups.push({ id, name: k > 1 ? `${base} ${k}` : base, occurrences: occ });
      for (const o of occ) o.__cg = id;
    }
    return groups;
  }
  function boardCollect(n, pred, out = []) {
    if (pred(n)) out.push(n);
    for (const c of n.children || []) boardCollect(c, pred, out);
    return out;
  }
  function boardShapeSignature(n) {
    if (!n) return "";
    if (n.type === "TEXT") return "T";
    if (n.type === "SVG") return "S";
    const kids = (n.children || []).map(boardShapeSignature).join(",");
    return `F:${n.layout?.mode || "NONE"}${n.imageData ? ":img" : ""}[${kids}]`;
  }
  function boardStyleKey(n) {
    const S = n.styles || {};
    const own2 = [
      (S.fills || []).map(boardColorKey).join(","),
      (S.strokes || []).map((s) => boardColorKey(s) + "@" + s.width).join(","),
      JSON.stringify(S.cornerRadius ?? 0),
      (S.boxShadow || []).length,
      n.type === "TEXT" ? [n.textData?.fontWeight, (S.fills || []).map(boardColorKey).join(",")].join("|") : ""
    ].join("|");
    return own2 + "[" + (n.children || []).map(boardStyleKey).join(";") + "]";
  }
  var areaOf = (n) => (n.layout?.measuredWidth || 0) * (n.layout?.measuredHeight || 0);
  var SIZE_NAMES = {
    2: ["L", "S"],
    3: ["L", "M", "S"],
    4: ["XL", "L", "M", "S"],
    5: ["XL", "L", "M", "S", "XS"]
  };
  function boardVariantFamilies(groups) {
    const byKey = /* @__PURE__ */ new Map();
    for (const g of groups) {
      const base = g.name.replace(/\s+\d+$/, "");
      const key = base + "§" + boardShapeSignature(g.occurrences[0]);
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(g);
    }
    const families = [];
    for (const [key, members2] of byKey) {
      if (members2.length < 2) continue;
      const name = key.split("§")[0];
      const reps = members2.map((g) => g.occurrences[0]);
      const sameStyle = new Set(reps.map(boardStyleKey)).size === 1;
      const areas = reps.map(areaOf);
      const sameSize = Math.max(...areas) - Math.min(...areas) <= Math.max(...areas) * 0.05;
      let property;
      let values;
      if (sameStyle && !sameSize) {
        property = "Size";
        const order = members2.map((_, i) => i).sort((a, b) => areas[b] - areas[a]);
        const names = SIZE_NAMES[members2.length] || members2.map((_, i) => String(i + 1));
        values = new Array(members2.length);
        order.forEach((idx, rank) => values[idx] = names[rank]);
      } else if (sameSize && !sameStyle) {
        property = "Style";
        const colors = reps.map((r) => boardColorKey((r.styles?.fills || [])[0]));
        const distinct = new Set(colors).size === colors.length && !colors.includes("-");
        values = distinct ? colors : members2.map((_, i) => String(i + 1));
      } else {
        property = "Variant";
        values = members2.map((_, i) => String(i + 1));
      }
      families.push({ name, property, members: members2.map((g, i) => ({ groupId: g.id, value: values[i] })) });
    }
    return families;
  }
  function rgbToLab(r, g, b) {
    const lin = (c) => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    const R = lin(r), G = lin(g), B = lin(b);
    const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
    const y = R * 0.2126 + G * 0.7152 + B * 0.0722;
    const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
    const f = (t) => t > 8856e-6 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
    const fx = f(x), fy = f(y), fz = f(z);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  }
  function deltaE(a, b) {
    const [l1, a1, b1] = rgbToLab(a.r, a.g, a.b);
    const [l2, a2, b2] = rgbToLab(b.r, b.g, b.b);
    return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
  }
  function boardMergeSimilarColors(entries, threshold = 2.3) {
    const sorted = [...entries].sort((a, b) => b.items.length - a.items.length);
    const merged = [];
    for (const e of sorted) {
      const home = merged.find((m) => Math.abs(m.alpha - e.alpha) <= 0.02 && deltaE(m.color, e.color) <= threshold);
      if (home) home.items.push(...e.items);
      else merged.push({ color: e.color, alpha: e.alpha, items: [...e.items] });
    }
    return merged.sort((a, b) => b.items.length - a.items.length);
  }

  // packages/figma-plugin/src/board/variables.ts
  function variablesAvailable() {
    const v = figma.variables;
    return !!v && typeof v.createVariableCollection === "function" && typeof v.createVariable === "function";
  }
  function safeVarName(name) {
    return name.replace(/\./g, ",").replace(/[${}]/g, "").trim() || "Variable";
  }
  function newCollection(base) {
    let existing = [];
    try {
      existing = (figma.variables.getLocalVariableCollections?.() || []).map((c) => c.name);
    } catch (_e) {
    }
    let name = base;
    for (let i = 2; existing.includes(name); i++) name = `${base} ${i}`;
    const collection = figma.variables.createVariableCollection(name);
    return { collection, modeId: collection.modes[0].modeId };
  }
  function colorVariable(collection, modeId, name, rgb) {
    const v = figma.variables.createVariable(safeVarName(name), collection, "COLOR");
    v.setValueForMode(modeId, { r: rgb.r, g: rgb.g, b: rgb.b, a: 1 });
    try {
      v.scopes = ["ALL_FILLS", "STROKE_COLOR", "EFFECT_COLOR"];
    } catch (_e) {
    }
    return v;
  }
  function numberVariable(collection, modeId, name, value, scopes) {
    const v = figma.variables.createVariable(safeVarName(name), collection, "FLOAT");
    v.setValueForMode(modeId, value);
    try {
      v.scopes = scopes;
    } catch (_e) {
    }
    return v;
  }
  function boundSolidPaint(paint, variable) {
    return figma.variables.setBoundVariableForPaint(paint, "color", variable);
  }
  var SPACING_FIELDS = ["itemSpacing", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft"];
  var RADIUS_FIELDS = ["topLeftRadius", "topRightRadius", "bottomLeftRadius", "bottomRightRadius"];
  function collectNumericTokens(nodes, minUses = 2) {
    const spacing2 = /* @__PURE__ */ new Map();
    const radius = /* @__PURE__ */ new Map();
    const add = (map, value, use) => {
      const v = Math.round(value * 10) / 10;
      if (!(v > 0)) return;
      if (!map.has(v)) map.set(v, []);
      map.get(v).push(use);
    };
    for (const n of nodes) {
      const f = n;
      if (f.layoutMode && f.layoutMode !== "NONE") {
        for (const field of SPACING_FIELDS) {
          if (field === "itemSpacing" && f.primaryAxisAlignItems === "SPACE_BETWEEN") continue;
          if (typeof f[field] === "number") add(spacing2, f[field], { node: n, field });
        }
      }
      if ("topLeftRadius" in f) {
        for (const field of RADIUS_FIELDS) if (typeof f[field] === "number") add(radius, f[field], { node: n, field });
      }
    }
    const keep = (map) => [...map.entries()].filter(([, uses]) => uses.length >= minUses).sort((a, b) => a[0] - b[0]);
    return { spacing: keep(spacing2), radius: keep(radius) };
  }
  function cssTokensToVariables(colors) {
    const V = figma.variables;
    const collection = (V.getLocalVariableCollections?.() || []).find((c) => c.name === "Tokens CSS") || V.createVariableCollection("Tokens CSS");
    const modeId = collection.modes[0].modeId;
    const existing = (V.getLocalVariables?.("COLOR") || []).filter((v) => v.variableCollectionId === collection.id);
    let count = 0;
    for (const [token, c] of Object.entries(colors)) {
      try {
        const name = safeVarName(token.replace(/^--/, ""));
        const v = existing.find((x) => x.name === name) || V.createVariable(name, collection, "COLOR");
        v.setValueForMode(modeId, { r: c.r, g: c.g, b: c.b, a: c.a !== void 0 ? c.a : 1 });
        count++;
      } catch (_e) {
      }
    }
    return count;
  }

  // packages/figma-plugin/src/board/board.ts
  async function buildBoardInstance(nodeData, master) {
    const inst = master.createInstance();
    inst.name = nodeData.name || master.name;
    const dataTexts = boardCollect(nodeData, (x) => x.type === "TEXT");
    const figTexts = inst.findAll((n) => n.type === "TEXT");
    if (dataTexts.length === figTexts.length) {
      for (let i = 0; i < figTexts.length; i++) {
        const want = dataTexts[i].textData?.characters ?? "";
        const tn = figTexts[i];
        if (tn.characters === want) continue;
        try {
          const fonts = tn.characters.length ? tn.getRangeAllFontNames(0, tn.characters.length) : [tn.fontName];
          for (const f of fonts) await figma.loadFontAsync(f);
          tn.characters = want || " ";
        } catch (_e) {
        }
      }
    }
    const dataImgs = boardCollect(nodeData, (x) => !!x.imageData);
    const figImgs = inst.findAll(
      (n) => "fills" in n && Array.isArray(n.fills) && n.fills.some((p) => p.type === "IMAGE")
    );
    if (dataImgs.length === figImgs.length) {
      for (let i = 0; i < figImgs.length; i++) {
        try {
          const image = figma.createImage(base64ToBytes(dataImgs[i].imageData));
          figImgs[i].fills = figImgs[i].fills.map(
            (p) => p.type === "IMAGE" ? { ...p, imageHash: image.hash } : p
          );
        } catch (_e) {
        }
      }
    }
    const w = nodeData.layout?.measuredWidth ?? (typeof nodeData.layout?.width === "number" ? nodeData.layout.width : inst.width);
    const h = nodeData.layout?.measuredHeight ?? (typeof nodeData.layout?.height === "number" ? nodeData.layout.height : inst.height);
    try {
      if (w > 0 && h > 0) inst.resize(w, h);
    } catch (_e) {
    }
    return inst;
  }
  function boardPickSections(root) {
    const bigKids = (n) => {
      if (!("children" in n)) return [];
      return n.children.filter((c) => c.visible !== false && c.type !== "TEXT" && c.height >= 60 && c.width >= n.width * 0.4).sort((a, b) => a.y - b.y);
    };
    const SECTION_MAX_H = 1400;
    function expand(n, depth) {
      const kids = bigKids(n);
      if (depth < 4 && n.height > SECTION_MAX_H && kids.length >= 2) {
        return kids.flatMap((k) => expand(k, depth + 1));
      }
      if (depth < 4 && kids.length === 1 && kids[0].height >= n.height * 0.9 && n.height > SECTION_MAX_H) {
        return expand(kids[0], depth + 1);
      }
      return [n];
    }
    let top = bigKids(root);
    for (let depth = 0; top.length === 1 && depth < 5; depth++) top = bigKids(top[0]);
    return top.flatMap((k) => expand(k, 0));
  }
  function boardHeadingOf(n) {
    if (!("findAll" in n)) return "";
    const texts = n.findAll((c) => c.type === "TEXT").slice(0, 12);
    let best = null;
    for (const t of texts) {
      const fs = typeof t.fontSize === "number" ? t.fontSize : 0;
      const bestFs = best && typeof best.fontSize === "number" ? best.fontSize : -1;
      if (t.characters.trim().length > 2 && fs > bestFs) best = t;
    }
    const s = best ? best.characters.replace(/\s+/g, " ").trim() : "";
    return s.length > 48 ? s.slice(0, 47) + "…" : s;
  }
  async function boardLabel(text, size, weight, color, opacity = 1) {
    const font = await loadFontSafely("Inter", weight);
    const t = figma.createText();
    t.fontName = font;
    t.characters = text;
    t.fontSize = size;
    t.fills = [{ type: "SOLID", color, opacity }];
    return t;
  }
  function boardNewSection(name) {
    if (typeof figma.createSection === "function") {
      const s = figma.createSection();
      s.name = name;
      return s;
    }
    const f = figma.createFrame();
    f.name = name;
    f.fills = [{ type: "SOLID", color: { r: 0.97, g: 0.97, b: 0.98 } }];
    return f;
  }
  function boardFitSection(sec, pad = 100) {
    const kids = sec.children;
    if (!kids.length) {
      try {
        sec.resizeWithoutConstraints(400, 200);
      } catch (_e) {
      }
      return;
    }
    const maxR = Math.max(...kids.map((k) => k.x + k.width));
    const maxB = Math.max(...kids.map((k) => k.y + k.height));
    try {
      sec.resizeWithoutConstraints(Math.max(400, maxR + pad), Math.max(200, maxB + pad));
    } catch (_e) {
      try {
        sec.resize(Math.max(400, maxR + pad), Math.max(200, maxB + pad));
      } catch (_e2) {
      }
    }
  }
  function insideInstance(n) {
    for (let p = n.parent; p; p = p.parent) if (p.type === "INSTANCE") return true;
    return false;
  }
  async function boardBuildStyles(scope, stylesSec, prefix) {
    const PAD = 100;
    const textNodes = [];
    const fillNodes = [];
    for (const s of scope) {
      const nodes = [s, ..."findAll" in s ? s.findAll(() => true) : []];
      for (const n of nodes) {
        if (n.type === "INSTANCE" || insideInstance(n)) continue;
        if (n.type === "COMPONENT_SET") continue;
        if (n.type === "TEXT") textNodes.push(n);
        else if ("fills" in n && n.fills !== figma.mixed) fillNodes.push(n);
      }
    }
    const tGroups = /* @__PURE__ */ new Map();
    for (const tn of textNodes) {
      if (tn.fontName === figma.mixed || tn.fontSize === figma.mixed || tn.lineHeight === figma.mixed) continue;
      const f = tn.fontName;
      const lh = tn.lineHeight;
      const lhKey = lh.unit === "AUTO" ? "auto" : Math.round(lh.value);
      const key = `${f.family}|${f.style}|${tn.fontSize}|${lhKey}`;
      if (!tGroups.has(key)) tGroups.set(key, { font: f, size: tn.fontSize, lh, nodes: [] });
      tGroups.get(key).nodes.push(tn);
    }
    const typeScale = [...tGroups.values()].sort((a, b) => b.size - a.size || b.nodes.length - a.nodes.length).slice(0, 24);
    let y = PAD;
    const title = await boardLabel("Tipografía", 32, 700, { r: 0.1, g: 0.1, b: 0.12 });
    stylesSec.appendChild(title);
    title.x = PAD;
    title.y = y;
    y += 70;
    for (const g of typeScale) {
      try {
        const st = figma.createTextStyle();
        st.name = `${prefix}/Texto/${Math.round(g.size)} ${g.font.style}`;
        st.fontName = g.font;
        st.fontSize = g.size;
        st.lineHeight = g.lh;
        for (const tn of g.nodes) {
          try {
            tn.textStyleId = st.id;
          } catch (_e) {
          }
        }
        const sample = figma.createText();
        sample.fontName = g.font;
        sample.characters = `${Math.round(g.size)} · ${g.font.family} ${g.font.style} — Aa Bb 123`;
        sample.fontSize = Math.min(g.size, 72);
        try {
          sample.textStyleId = st.id;
        } catch (_e) {
        }
        sample.fontSize = Math.min(g.size, 72);
        stylesSec.appendChild(sample);
        sample.x = PAD;
        sample.y = y;
        const meta2 = await boardLabel(`${st.name.split("/").slice(-1)[0]} · ${g.nodes.length} usos`, 12, 400, {
          r: 0.45,
          g: 0.45,
          b: 0.5
        });
        stylesSec.appendChild(meta2);
        meta2.x = PAD;
        meta2.y = y + sample.height + 6;
        y += sample.height + 48;
      } catch (_e) {
      }
    }
    const exact = /* @__PURE__ */ new Map();
    for (const n of [...fillNodes, ...textNodes]) {
      const fills = n.fills;
      if (!Array.isArray(fills) || fills.length !== 1 || fills[0].type !== "SOLID" || fills[0].visible === false)
        continue;
      const p = fills[0];
      const alpha = p.opacity ?? 1;
      const key = boardColorKey({ ...p.color, a: alpha });
      if (!exact.has(key)) exact.set(key, { color: p.color, alpha, items: [] });
      exact.get(key).items.push(n);
    }
    const palette = boardMergeSimilarColors([...exact.values()]).slice(0, 48);
    const useVariables = variablesAvailable();
    let vars = null;
    if (useVariables) {
      try {
        vars = newCollection(prefix);
      } catch (varErr) {
        figma.ui.postMessage({
          type: "LOG",
          level: "warn",
          message: `Variables no disponibles en este archivo (${varErr?.message || varErr}): se usan estilos de color.`
        });
      }
    }
    const cx = 1100;
    let cy = PAD;
    const ctitle = await boardLabel(vars ? "Colores · Variables" : "Colores", 32, 700, { r: 0.1, g: 0.1, b: 0.12 });
    stylesSec.appendChild(ctitle);
    ctitle.x = cx;
    ctitle.y = cy;
    cy += 70;
    let col = 0;
    for (const g of palette) {
      try {
        const hex = boardColorKey({ ...g.color, a: g.alpha });
        const base = { type: "SOLID", color: g.color, opacity: g.alpha };
        let paint = base;
        let bindNode;
        if (vars) {
          const variable = colorVariable(vars.collection, vars.modeId, `Color/${hex.replace("#", "")}`, g.color);
          paint = boundSolidPaint(base, variable);
          bindNode = (n) => {
            n.fills = [paint];
          };
        } else {
          const st = figma.createPaintStyle();
          st.name = `${prefix}/Color/${hex}`;
          st.paints = [base];
          bindNode = (n) => {
            n.fillStyleId = st.id;
          };
        }
        for (const n of g.items) {
          try {
            bindNode(n);
          } catch (_e) {
          }
        }
        const sw = figma.createRectangle();
        sw.resize(120, 120);
        sw.cornerRadius = 12;
        sw.fills = [paint];
        sw.strokes = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 }, opacity: 0.08 }];
        const x = cx + col * 150, yy = cy;
        stylesSec.appendChild(sw);
        sw.x = x;
        sw.y = yy;
        const lbl = await boardLabel(`${hex}
${g.items.length} usos`, 11, 500, { r: 0.3, g: 0.3, b: 0.35 });
        stylesSec.appendChild(lbl);
        lbl.x = x;
        lbl.y = yy + 128;
        col++;
        if (col === 6) {
          col = 0;
          cy += 190;
        }
      } catch (_e) {
      }
    }
    if (col > 0) cy += 190;
    if (vars) {
      const frames = [];
      for (const s of scope) {
        if (s.layoutMode !== void 0 && !insideInstance(s)) frames.push(s);
        if ("findAll" in s) {
          for (const n of s.findAll((x) => x.type === "FRAME" || x.type === "COMPONENT"))
            if (!insideInstance(n)) frames.push(n);
        }
      }
      const { spacing: spacing2, radius } = collectNumericTokens(frames);
      const groups = [
        ["Espaciado", spacing2.slice(0, 16), ["GAP"]],
        ["Radio", radius.slice(0, 12), ["CORNER_RADIUS"]]
      ];
      for (const [label, entries, scopes] of groups) {
        if (!entries.length) continue;
        cy += 40;
        const t = await boardLabel(`${label} · Variables`, 24, 700, { r: 0.1, g: 0.1, b: 0.12 });
        stylesSec.appendChild(t);
        t.x = cx;
        t.y = cy;
        cy += 50;
        for (const [value, uses] of entries) {
          try {
            const v = numberVariable(vars.collection, vars.modeId, `${label}/${value}`, value, scopes);
            for (const u of uses) {
              try {
                u.node.setBoundVariable(u.field, v);
              } catch (_e) {
              }
            }
            const row = await boardLabel(`${label}/${value}  ·  ${value} px  ·  ${uses.length} usos`, 13, 500, {
              r: 0.3,
              g: 0.3,
              b: 0.35
            });
            stylesSec.appendChild(row);
            row.x = cx;
            row.y = cy;
            cy += 26;
          } catch (_e) {
          }
        }
      }
    }
  }
  function inheritedBackground(n) {
    for (let p = n.parent; p && p.type !== "PAGE" && p.type !== "SECTION"; p = p.parent) {
      const fills = p.fills;
      if (Array.isArray(fills) && fills.some((f) => f.visible !== false && (f.type !== "SOLID" || (f.opacity ?? 1) > 0.05)))
        return fills.filter((f) => f.visible !== false);
    }
    return null;
  }
  function sectionToComponent(original, copy, title) {
    if (typeof figma.createComponentFromNode !== "function") return null;
    if (original.type !== "FRAME" || copy.type !== "FRAME" || insideInstance(original)) return null;
    const parent = original.parent;
    if (!parent || !("children" in parent)) return null;
    try {
      const own2 = copy.fills;
      if (Array.isArray(own2) && !own2.some((f) => f.visible !== false)) {
        const bg = inheritedBackground(original);
        if (bg) copy.fills = bg;
      }
      const comp = figma.createComponentFromNode(copy);
      comp.name = `Sección / ${title}`.slice(0, 120);
      const inst = comp.createInstance();
      parent.insertChild(parent.children.indexOf(original), inst);
      const o = original;
      inst.x = o.x;
      inst.y = o.y;
      try {
        inst.resize(o.width, o.height);
      } catch (_e) {
      }
      try {
        if ("layoutPositioning" in o) inst.layoutPositioning = o.layoutPositioning;
        const auto = parent.layoutMode && parent.layoutMode !== "NONE";
        if (auto && o.layoutPositioning !== "ABSOLUTE") {
          inst.layoutSizingHorizontal = o.layoutSizingHorizontal === "HUG" ? "FIXED" : o.layoutSizingHorizontal;
          inst.layoutSizingVertical = o.layoutSizingVertical === "HUG" ? "FIXED" : o.layoutSizingVertical;
        }
      } catch (_e) {
      }
      original.remove();
      return comp;
    } catch (_e) {
      return null;
    }
  }
  async function buildDesignBoard(payload) {
    const root = payload.rootNode;
    root.type = "FRAME";
    let host = "Landing";
    try {
      host = new URL(payload.source?.url || "").hostname.replace(/^www\./, "") || host;
    } catch (_e) {
    }
    const prefix = host;
    const page = figma.currentPage;
    const others = page.children;
    const originX = others.length ? Math.round(Math.max(...others.map((c) => c.x + c.width)) + 400) : 0;
    const originY = others.length ? Math.round(Math.min(...others.map((c) => c.y))) : 0;
    const progress = (message) => figma.ui.postMessage({ type: "LOG", level: "info", message: `Tablero · ${message}` });
    const groups = boardDetectComponents(root);
    const compSec = boardNewSection("03 · Componentes");
    page.appendChild(compSec);
    const ctx = { masters: /* @__PURE__ */ new Map() };
    setBoardCtx(ctx);
    const usesOf = /* @__PURE__ */ new Map();
    for (const g of groups) {
      let built = null;
      try {
        const data = JSON.parse(JSON.stringify(g.occurrences[0]));
        (function strip(n) {
          delete n.__cg;
          (n.children || []).forEach(strip);
        })(data);
        data.type = "COMPONENT";
        data.name = g.name;
        data.layout = { ...data.layout, positioning: "AUTO", x: 0, y: 0 };
        built = await buildFigmaNode(data);
        if (!built || built.type !== "COMPONENT") throw new Error("no se generó como componente");
        const master = built;
        compSec.appendChild(master);
        master.description = `${g.occurrences.length} usos en ${host}`;
        usesOf.set(g.id, g.occurrences.length);
        ctx.masters.set(g.id, master);
      } catch (compErr) {
        if (built && !built.removed) {
          try {
            built.remove();
          } catch (_e) {
          }
        }
        figma.ui.postMessage({
          type: "LOG",
          level: "warn",
          message: `Componente "${g.name}" omitido: ${compErr?.message || compErr}`
        });
      }
    }
    const items = [];
    const inSet = /* @__PURE__ */ new Set();
    let variantSets = 0;
    for (const fam of boardVariantFamilies(groups)) {
      const members2 = fam.members.filter((m) => ctx.masters.has(m.groupId));
      if (members2.length < 2 || typeof figma.combineAsVariants !== "function") continue;
      try {
        const masters = members2.map((m) => {
          const master = ctx.masters.get(m.groupId);
          master.name = `${fam.property}=${m.value}`;
          return master;
        });
        const set = figma.combineAsVariants(masters, compSec);
        set.name = fam.name;
        set.layoutMode = "HORIZONTAL";
        set.primaryAxisSizingMode = "AUTO";
        set.counterAxisSizingMode = "AUTO";
        set.counterAxisAlignItems = "CENTER";
        set.itemSpacing = 40;
        set.paddingTop = set.paddingBottom = set.paddingLeft = set.paddingRight = 32;
        const uses = members2.reduce((a, m) => a + (usesOf.get(m.groupId) || 0), 0);
        items.push({ node: set, label: `${fam.name} · ${members2.length} variantes (${fam.property}) · ${uses} usos` });
        members2.forEach((m) => inSet.add(m.groupId));
        variantSets++;
      } catch (setErr) {
        figma.ui.postMessage({
          type: "LOG",
          level: "warn",
          message: `Variantes de "${fam.name}" no agrupadas: ${setErr?.message || setErr}`
        });
      }
    }
    for (const g of groups) {
      const master = ctx.masters.get(g.id);
      if (master && !inSet.has(g.id)) items.push({ node: master, label: `${g.name} · ${usesOf.get(g.id) || 0} usos` });
    }
    let gx = 100, gy = 100, rowH = 0;
    const MAX_ROW = 2600;
    for (const item of items) {
      const n = item.node;
      if (gx > 100 && gx + n.width > MAX_ROW) {
        gx = 100;
        gy += rowH + 140;
        rowH = 0;
      }
      n.x = gx;
      n.y = gy + 40;
      const lbl = await boardLabel(item.label, 16, 600, { r: 0.33, g: 0.2, b: 0.8 });
      compSec.appendChild(lbl);
      lbl.x = gx;
      lbl.y = gy;
      gx += n.width + 120;
      rowH = Math.max(rowH, n.height + 40);
    }
    progress(
      `${ctx.masters.size} componentes creados` + (variantSets ? `, ${variantSets} agrupados como variantes` : "")
    );
    const fullSec = boardNewSection("01 · Página completa");
    page.appendChild(fullSec);
    const full = await buildFigmaNode(root);
    const componentCount = ctx.masters.size;
    setBoardCtx(null);
    if (!full) throw new Error("No se pudo generar la vista completa");
    fullSec.appendChild(full);
    full.x = 100;
    full.y = 100;
    progress(`vista completa lista (${Math.round(full.width)}×${Math.round(full.height)})`);
    const subSec = boardNewSection("02 · Secciones");
    page.appendChild(subSec);
    let sy = 100;
    const isMulti = String(root.id || "").startsWith("multi_selection_bundle") && "children" in full;
    const picked = isMulti ? [...full.children] : boardPickSections(full);
    let subOk = 0;
    const sectionComponents = [];
    for (let i = 0; i < picked.length; i++) {
      let clone2 = null;
      try {
        const heading = boardHeadingOf(picked[i]);
        const title = `${String(i + 1).padStart(2, "0")} · ${picked[i].name}` + (heading ? ` — ${heading}` : "");
        const lbl = await boardLabel(title, 20, 600, { r: 0.1, g: 0.1, b: 0.12 });
        subSec.appendChild(lbl);
        lbl.x = 100;
        lbl.y = sy;
        clone2 = picked[i].clone();
        subSec.appendChild(clone2);
        clone2.x = 100;
        clone2.y = sy + 44;
        const asComponent = sectionToComponent(picked[i], clone2, heading || picked[i].name);
        if (asComponent) {
          clone2 = asComponent;
          sectionComponents.push(asComponent);
        }
        sy += 44 + clone2.height + 140;
        subOk++;
      } catch (subErr) {
        if (clone2 && clone2.parent !== subSec) {
          try {
            clone2.remove();
          } catch (_e) {
          }
        }
        figma.ui.postMessage({
          type: "LOG",
          level: "warn",
          message: `Sub-vista "${picked[i].name}" omitida: ${subErr?.message || subErr}`
        });
      }
    }
    progress(`${subOk}/${picked.length} sub-vistas`);
    const stylesSec = boardNewSection("04 · Estilos");
    page.appendChild(stylesSec);
    await boardBuildStyles(
      [
        full,
        // Las secciones convertidas en componente: su contenido vive en el maestro, no en la instancia
        ...sectionComponents,
        ...compSec.children.filter((c) => c.type === "COMPONENT" || c.type === "COMPONENT_SET")
      ],
      stylesSec,
      prefix
    );
    const order = [fullSec, subSec, compSec, stylesSec];
    for (const s of order) boardFitSection(s);
    let x = originX;
    for (const s of order) {
      if (s.children.length === 0) {
        s.remove();
        continue;
      }
      s.x = x;
      s.y = originY;
      x += s.width + 240;
    }
    figma.viewport.scrollAndZoomIntoView(order.filter((s) => !s.removed));
    return { main: full, nodeCount: countNodes(root), components: componentCount, page };
  }

  // packages/figma-plugin/src/text-sizing.ts
  async function applyTextSegments(tn, segments) {
    const len = tn.characters.length;
    for (const seg of segments) {
      const start = Math.max(0, Math.min(len, seg.start));
      const end = Math.max(start, Math.min(len, seg.end));
      if (end <= start) continue;
      try {
        if (seg.fontFamily || seg.fontWeight) {
          const f = await loadFontSafely(seg.fontStack || seg.fontFamily || "Inter", seg.fontWeight || 400);
          tn.setRangeFontName(start, end, f);
        }
        if (seg.fontSize && seg.fontSize > 0) tn.setRangeFontSize(start, end, seg.fontSize);
        if (seg.color) {
          tn.setRangeFills(start, end, [
            {
              type: "SOLID",
              color: { r: seg.color.r, g: seg.color.g, b: seg.color.b },
              opacity: seg.color.a !== void 0 ? seg.color.a : 1
            }
          ]);
        }
        if (seg.underline) tn.setRangeTextDecoration(start, end, "UNDERLINE");
        else if (seg.strike) tn.setRangeTextDecoration(start, end, "STRIKETHROUGH");
      } catch (err) {
        log.warn("No se pudo aplicar tramo de texto", { error: errText(err) });
      }
    }
  }
  function applyNoWrapSizing(tn, data, parentIsAutoLayout) {
    const td = data.textData;
    const measuredW = data.layout?.measuredWidth || (typeof data.layout?.width === "number" ? data.layout.width : 0);
    tn.textAutoResize = "WIDTH_AND_HEIGHT";
    const naturalW = tn.width;
    const fitsMeasured = measuredW > 0 && naturalW <= measuredW + 0.5;
    if (parentIsAutoLayout) {
      if (data.layout?.width === "FILL" && fitsMeasured) {
        try {
          tn.layoutSizingHorizontal = "FILL";
          tn.textAutoResize = "HEIGHT";
        } catch (_e) {
        }
      } else if (typeof data.layout?.width === "number" && fitsMeasured) {
        try {
          tn.resize(Math.max(1, data.layout.width), tn.height);
          tn.textAutoResize = "HEIGHT";
        } catch (_e) {
        }
      }
      return;
    }
    if (measuredW > 0 && fitsMeasured) {
      try {
        tn.resize(measuredW, tn.height);
        tn.textAutoResize = "HEIGHT";
      } catch (_e) {
      }
    } else if (measuredW > 0) {
      const extra = naturalW - measuredW;
      if (td.textAlign === "CENTER") tn.x = tn.x - extra / 2;
      else if (td.textAlign === "RIGHT") tn.x = tn.x - extra;
    }
  }

  // packages/figma-plugin/src/render.ts
  function countNodes(node2) {
    let count = 1;
    if (node2.children) {
      for (const child of node2.children) count += countNodes(child);
    }
    return count;
  }
  async function buildFigmaNode(nodeData) {
    let createdNode = null;
    const cg = nodeData.__cg;
    const boardCtx = getBoardCtx();
    if (boardCtx && cg && boardCtx.masters.has(cg)) {
      try {
        return await buildBoardInstance(nodeData, boardCtx.masters.get(cg));
      } catch (instErr) {
        figma.ui.postMessage({
          type: "LOG",
          level: "warn",
          message: `Instancia "${nodeData.name}" no creada, se dibuja como copia: ${instErr?.message || instErr}`
        });
      }
    }
    try {
      if (nodeData.type === "TEXT" && nodeData.textData) {
        try {
          await figma.loadFontAsync({ family: "Inter", style: "Regular" });
        } catch (_e) {
        }
        const font = await loadFontSafely(
          nodeData.textData.fontStack || nodeData.textData.fontFamily,
          nodeData.textData.fontWeight,
          { track: true }
        );
        const textNode = figma.createText();
        try {
          textNode.fontName = font;
        } catch (_fErr) {
          try {
            textNode.fontName = { family: "Inter", style: "Regular" };
          } catch (_fErr2) {
          }
        }
        textNode.characters = nodeData.textData.characters || " ";
        try {
          textNode.fontSize = Math.max(1, nodeData.textData.fontSize || 14);
        } catch (_e) {
        }
        if (nodeData.textData.lineHeight && nodeData.textData.lineHeight > 0) {
          try {
            textNode.lineHeight = { value: nodeData.textData.lineHeight, unit: "PIXELS" };
          } catch (_e) {
          }
        }
        if (nodeData.textData.letterSpacing !== void 0 && nodeData.textData.letterSpacing !== 0) {
          try {
            textNode.letterSpacing = { value: nodeData.textData.letterSpacing, unit: "PIXELS" };
          } catch (_e) {
          }
        }
        if (nodeData.textData.textAlign) {
          try {
            const alignMap = {
              LEFT: "LEFT",
              CENTER: "CENTER",
              RIGHT: "RIGHT",
              JUSTIFIED: "JUSTIFIED"
            };
            textNode.textAlignHorizontal = alignMap[nodeData.textData.textAlign] || "LEFT";
          } catch (_e) {
          }
        }
        if (nodeData.styles?.fills && nodeData.styles.fills.length > 0) {
          try {
            textNode.fills = nodeData.styles.fills.map((f) => ({
              type: "SOLID",
              color: { r: f.r, g: f.g, b: f.b },
              opacity: f.a !== void 0 ? f.a : 1
            }));
          } catch (_e) {
          }
        }
        try {
          const textFx = effectsFromStyles(nodeData.styles, "TEXT");
          if (textFx.length) textNode.effects = textFx;
          const textBlend = blendModeFromStyles(nodeData.styles);
          if (textBlend) textNode.blendMode = textBlend;
        } catch (_e) {
        }
        if (Array.isArray(nodeData.textData.segments) && nodeData.textData.segments.length > 0) {
          await applyTextSegments(textNode, nodeData.textData.segments);
        }
        if (nodeData.textData.noWrap) {
          try {
            textNode.textAutoResize = "WIDTH_AND_HEIGHT";
          } catch (_e) {
          }
        }
        createdNode = textNode;
      } else if (nodeData.type === "SVG" && nodeData.svgContent) {
        try {
          const svgNode = figma.createNodeFromSvg(nodeData.svgContent);
          const targetW = typeof nodeData.layout?.width === "number" ? nodeData.layout.width : 24;
          const targetH = typeof nodeData.layout?.height === "number" ? nodeData.layout.height : 24;
          if (targetW > 0 && targetH > 0) {
            svgNode.resize(targetW, targetH);
          }
          createdNode = svgNode;
        } catch (err) {
          log.warn("No se pudo crear SVG, se usa un frame de reemplazo", { error: errText(err) });
          const fallback = figma.createFrame();
          fallback.resize(24, 24);
          createdNode = fallback;
        }
      } else {
        const frame = nodeData.type === "COMPONENT" ? figma.createComponent() : figma.createFrame();
        createdNode = frame;
        frame.name = nodeData.name || "Frame";
        const num = (v) => typeof v === "number" && v > 0 ? v : 0;
        const boxW = num(nodeData.layout?.measuredWidth) || num(nodeData.layout?.width) || 100;
        const boxH = num(nodeData.layout?.measuredHeight) || num(nodeData.layout?.height) || 100;
        const toPaint = (f) => cssFillToPaint(f, boxW, boxH);
        const mode = nodeData.layout?.mode || "NONE";
        if (mode === "HORIZONTAL") {
          frame.layoutMode = "HORIZONTAL";
        } else if (mode === "VERTICAL") {
          frame.layoutMode = "VERTICAL";
        } else {
          frame.layoutMode = "NONE";
        }
        if (frame.layoutMode !== "NONE") {
          frame.itemSpacing = Math.max(0, nodeData.layout?.itemSpacing || 0);
          const pad = nodeData.layout?.padding || { top: 0, right: 0, bottom: 0, left: 0 };
          frame.paddingTop = Math.max(0, pad.top || 0);
          frame.paddingRight = Math.max(0, pad.right || 0);
          frame.paddingBottom = Math.max(0, pad.bottom || 0);
          frame.paddingLeft = Math.max(0, pad.left || 0);
          if (nodeData.layout?.primaryAxisAlignItems) {
            const mapPrimary = {
              MIN: "MIN",
              CENTER: "CENTER",
              MAX: "MAX",
              SPACE_BETWEEN: "SPACE_BETWEEN"
            };
            frame.primaryAxisAlignItems = mapPrimary[nodeData.layout.primaryAxisAlignItems] || "MIN";
          }
          if (nodeData.layout?.counterAxisAlignItems) {
            const mapCounter = {
              MIN: "MIN",
              CENTER: "CENTER",
              MAX: "MAX",
              BASELINE: "BASELINE"
            };
            frame.counterAxisAlignItems = mapCounter[nodeData.layout.counterAxisAlignItems] || "MIN";
          }
          if (nodeData.layout?.layoutWrap === "WRAP") {
            frame.layoutWrap = "WRAP";
            const cas = nodeData.layout.counterAxisSpacing;
            if (typeof cas === "number" && cas >= 0) {
              try {
                frame.counterAxisSpacing = cas;
              } catch (_e) {
              }
            }
          }
        }
        if (nodeData.imageData) {
          try {
            const image = figma.createImage(base64ToBytes(nodeData.imageData));
            const baseFills = (nodeData.styles?.fills || []).filter((f) => !f.type || f.type === "SOLID");
            const overlayFills = (nodeData.styles?.fills || []).filter((f) => f.type && f.type !== "SOLID");
            const imagePaint = {
              type: "IMAGE",
              scaleMode: nodeData.styles?.imageScaleMode || "FILL",
              imageHash: image.hash
            };
            frame.fills = [...baseFills.map(toPaint), imagePaint, ...overlayFills.map(toPaint)];
          } catch (_imgErr) {
            log.warn("Error decodificando imagen base64", { error: errText(_imgErr) });
            figma.ui.postMessage({
              type: "LOG",
              level: "error",
              message: `Imagen no aplicada en "${nodeData.name}": ${_imgErr?.message || _imgErr}`
            });
            frame.fills = [{ type: "SOLID", color: { r: 0.9, g: 0.9, b: 0.92 } }];
          }
        } else if (nodeData.styles?.fills) {
          frame.fills = nodeData.styles.fills.map(toPaint);
        }
        if (nodeData.styles?.strokes && nodeData.styles.strokes.length > 0) {
          const stroke = nodeData.styles.strokes[0];
          frame.strokes = [
            {
              type: "SOLID",
              color: { r: stroke.r, g: stroke.g, b: stroke.b },
              opacity: stroke.a !== void 0 ? stroke.a : 1
            }
          ];
          frame.strokeAlign = "INSIDE";
          if (nodeData.styles?.borderSides) {
            const bs = nodeData.styles.borderSides;
            try {
              frame.strokeTopWeight = Math.max(0, bs.top ?? 0);
              frame.strokeRightWeight = Math.max(0, bs.right ?? 0);
              frame.strokeBottomWeight = Math.max(0, bs.bottom ?? 0);
              frame.strokeLeftWeight = Math.max(0, bs.left ?? 0);
            } catch (_e) {
              frame.strokeWeight = Math.max(1, stroke.width || 1);
            }
          } else {
            frame.strokeWeight = Math.max(1, stroke.width || 1);
          }
        }
        if (nodeData.styles?.cornerRadius !== void 0) {
          if (typeof nodeData.styles.cornerRadius === "number") {
            frame.cornerRadius = Math.max(0, nodeData.styles.cornerRadius);
          } else if (Array.isArray(nodeData.styles.cornerRadius) && nodeData.styles.cornerRadius.length === 4) {
            const [tl, tr, br, bl] = nodeData.styles.cornerRadius;
            frame.topLeftRadius = Math.max(0, tl);
            frame.topRightRadius = Math.max(0, tr);
            frame.bottomRightRadius = Math.max(0, br);
            frame.bottomLeftRadius = Math.max(0, bl);
          }
        }
        if (typeof nodeData.styles?.opacity === "number") {
          frame.opacity = Math.max(0, Math.min(1, nodeData.styles.opacity));
        }
        const effects = effectsFromStyles(nodeData.styles, "FRAME");
        if (effects.length > 0) frame.effects = effects;
        const frameBlend = blendModeFromStyles(nodeData.styles);
        if (frameBlend) frame.blendMode = frameBlend;
        const initW = typeof nodeData.layout?.width === "number" ? nodeData.layout.width : typeof nodeData.layout?.measuredWidth === "number" ? nodeData.layout.measuredWidth : 100;
        const initH = typeof nodeData.layout?.height === "number" ? nodeData.layout.height : typeof nodeData.layout?.measuredHeight === "number" ? nodeData.layout.measuredHeight : 40;
        frame.resize(Math.max(1, initW), Math.max(1, initH));
        if (frame.layoutMode !== "NONE") {
          try {
            frame.layoutSizingHorizontal = "FIXED";
            frame.layoutSizingVertical = "FIXED";
          } catch (_e) {
          }
        }
        const hasRoundCorners = typeof frame.cornerRadius === "number" ? frame.cornerRadius > 0 : false;
        const hasFills = Array.isArray(frame.fills) && frame.fills.length > 0;
        frame.clipsContent = !!(nodeData.clipsContent || hasRoundCorners && hasFills);
        if (nodeData.children && nodeData.children.length > 0) {
          for (const childData of nodeData.children) {
            const childNode = await buildFigmaNode(childData);
            if (childNode)
              try {
                frame.appendChild(childNode);
                if (frame.layoutMode !== "NONE") {
                  const layoutChild = childNode;
                  if (childData.layout?.positioning === "ABSOLUTE") {
                    try {
                      const targetW = typeof childData.layout.width === "number" && childData.layout.width > 0 ? childData.layout.width : childData.layout.measuredWidth || layoutChild.width || 100;
                      const targetH = typeof childData.layout.height === "number" && childData.layout.height > 0 ? childData.layout.height : childData.layout.measuredHeight || layoutChild.height || 100;
                      if (targetW > 0 && targetH > 0 && typeof layoutChild.resize === "function") {
                        try {
                          layoutChild.resize(targetW, targetH);
                        } catch (_resErr) {
                        }
                      }
                      if ("layoutPositioning" in layoutChild) {
                        layoutChild.layoutPositioning = "ABSOLUTE";
                      }
                      if (typeof childData.layout.x === "number") childNode.x = childData.layout.x;
                      if (typeof childData.layout.y === "number") childNode.y = childData.layout.y;
                    } catch (absErr) {
                      log.warn("Error configurando layoutPositioning ABSOLUTE", { error: errText(absErr) });
                    }
                  } else {
                    if (childNode.type === "TEXT" && childData.textData?.noWrap) {
                      applyNoWrapSizing(childNode, childData, true);
                    } else if (childNode.type === "TEXT") {
                      const tn = childNode;
                      const isMulti = childData.textData?.isMultiline || childData.textData?.characters && childData.textData.characters.includes("\n");
                      if (childData.layout?.width === "FILL") {
                        tn.textAutoResize = "HEIGHT";
                        try {
                          tn.layoutSizingHorizontal = "FILL";
                        } catch (_e) {
                          const fallbackW = childData.layout?.measuredWidth || frame.width;
                          if (fallbackW > 0) {
                            try {
                              tn.resize(fallbackW, tn.height);
                            } catch (_r) {
                            }
                          }
                        }
                      } else if (childData.layout?.width === "HUG") {
                        if (isMulti && frame.layoutMode === "VERTICAL") {
                          tn.textAutoResize = "HEIGHT";
                          try {
                            tn.layoutSizingHorizontal = "FILL";
                          } catch (_e) {
                            const fallbackW = childData.layout?.measuredWidth || frame.width;
                            if (fallbackW > 0) {
                              try {
                                tn.resize(fallbackW, tn.height);
                              } catch (_r) {
                              }
                            }
                          }
                        } else {
                          tn.textAutoResize = "WIDTH_AND_HEIGHT";
                        }
                      } else if (typeof childData.layout?.width === "number") {
                        try {
                          tn.resize(Math.max(1, childData.layout.width), tn.height);
                        } catch (_e) {
                        }
                        tn.textAutoResize = "HEIGHT";
                      }
                    } else {
                      const hasFixedW = typeof childData.layout?.width === "number";
                      const hasFixedH = typeof childData.layout?.height === "number";
                      if (hasFixedW || hasFixedH) {
                        const targetW = hasFixedW ? Math.max(1, childData.layout.width) : layoutChild.width;
                        const targetH = hasFixedH ? Math.max(1, childData.layout.height) : layoutChild.height;
                        try {
                          layoutChild.resize(targetW, targetH);
                        } catch (_e) {
                        }
                      }
                      try {
                        if (childData.layout?.width === "FILL" && "layoutSizingHorizontal" in layoutChild) {
                          layoutChild.layoutSizingHorizontal = "FILL";
                        } else if (childData.layout?.width === "HUG" && "layoutSizingHorizontal" in layoutChild) {
                          layoutChild.layoutSizingHorizontal = "HUG";
                        } else if (hasFixedW && "layoutSizingHorizontal" in layoutChild) {
                          layoutChild.layoutSizingHorizontal = "FIXED";
                        }
                      } catch (_e) {
                      }
                      try {
                        if (childData.layout?.height === "FILL" && "layoutSizingVertical" in layoutChild) {
                          layoutChild.layoutSizingVertical = "FILL";
                        } else if (childData.layout?.height === "HUG" && "layoutSizingVertical" in layoutChild) {
                          layoutChild.layoutSizingVertical = "HUG";
                        } else if (hasFixedH && "layoutSizingVertical" in layoutChild) {
                          layoutChild.layoutSizingVertical = "FIXED";
                        }
                      } catch (_e) {
                      }
                    }
                  }
                } else {
                  if (typeof childData.layout?.x === "number") childNode.x = childData.layout.x;
                  if (typeof childData.layout?.y === "number") childNode.y = childData.layout.y;
                  if (childNode.type === "FRAME" || childNode.type === "COMPONENT") {
                    const targetW = (typeof childData.layout?.width === "number" ? childData.layout.width : childData.layout?.measuredWidth) || childNode.width;
                    const targetH = (typeof childData.layout?.height === "number" ? childData.layout.height : childData.layout?.measuredHeight) || childNode.height;
                    if (targetW > 0 && targetH > 0 && (targetW !== childNode.width || targetH !== childNode.height)) {
                      childNode.resize(targetW, targetH);
                    }
                  } else if (childNode.type === "TEXT" && childData.textData?.noWrap) {
                    applyNoWrapSizing(childNode, childData, false);
                  } else if (childNode.type === "TEXT") {
                    const tn = childNode;
                    const isMulti = childData.textData?.isMultiline || childData.textData?.characters && childData.textData.characters.includes("\n");
                    const targetW = typeof childData.layout?.width === "number" && childData.layout.width > 0 ? childData.layout.width : childData.layout?.measuredWidth || 0;
                    if (targetW > 0 && (isMulti || childData.layout?.width !== "HUG")) {
                      tn.resize(targetW, tn.height);
                      tn.textAutoResize = "HEIGHT";
                    } else {
                      tn.textAutoResize = "WIDTH_AND_HEIGHT";
                    }
                  }
                }
              } catch (childErr) {
                figma.ui.postMessage({
                  type: "LOG",
                  level: "warn",
                  message: `Ajuste de capa "${childData.name}" incompleto: ${childErr?.message || childErr}`
                });
              }
          }
        }
        const hasSelfFixedW = typeof nodeData.layout?.width === "number" && nodeData.layout.width > 0;
        const hasSelfFixedH = typeof nodeData.layout?.height === "number" && nodeData.layout.height > 0;
        const targetFrameW = hasSelfFixedW ? nodeData.layout.width : nodeData.layout?.measuredWidth || frame.width;
        const targetFrameH = hasSelfFixedH ? nodeData.layout.height : nodeData.layout?.measuredHeight || frame.height;
        if (targetFrameW > 0 && targetFrameH > 0 && (targetFrameW !== frame.width || targetFrameH !== frame.height)) {
          try {
            frame.resize(targetFrameW, targetFrameH);
          } catch (_e) {
          }
        }
        if (frame.layoutMode !== "NONE") {
          try {
            if (nodeData.layout?.width === "HUG") {
              frame.layoutSizingHorizontal = "HUG";
            } else if (nodeData.layout?.width === "FILL") {
              frame.layoutSizingHorizontal = "FILL";
            } else if (hasSelfFixedW) {
              frame.layoutSizingHorizontal = "FIXED";
            }
          } catch (_e) {
          }
          try {
            if (nodeData.layout?.height === "HUG") {
              frame.layoutSizingVertical = "HUG";
            } else if (nodeData.layout?.height === "FILL") {
              frame.layoutSizingVertical = "FILL";
            } else if (hasSelfFixedH) {
              frame.layoutSizingVertical = "FIXED";
            }
          } catch (_e) {
          }
        }
        createdNode = frame;
      }
      if (createdNode) {
        createdNode.name = nodeData.name || createdNode.name;
      }
    } catch (error2) {
      log.error("Error creando nodo Figma", { error: errText(error2) });
      try {
        figma.ui.postMessage({
          type: "LOG",
          level: "error",
          message: `Error en capa "${nodeData.name}": ${error2?.message || error2}`
        });
      } catch (_logErr) {
      }
      if (nodeData.type === "TEXT" && nodeData.textData && !createdNode) {
        try {
          await figma.loadFontAsync({ family: "Inter", style: "Regular" });
          const fb = figma.createText();
          fb.name = nodeData.name || "Text";
          fb.characters = nodeData.textData.characters || " ";
          fb.fontSize = nodeData.textData.fontSize || 14;
          if (nodeData.styles?.fills && nodeData.styles.fills.length > 0) {
            fb.fills = nodeData.styles.fills.map((f) => ({
              type: "SOLID",
              color: { r: f.r, g: f.g, b: f.b },
              opacity: f.a !== void 0 ? f.a : 1
            }));
          } else {
            fb.fills = [{ type: "SOLID", color: { r: 0.95, g: 0.95, b: 0.95 }, opacity: 1 }];
          }
          createdNode = fb;
        } catch (_fbErr) {
          log.error("El texto de reemplazo también falló", { error: errText(_fbErr) });
        }
      }
    }
    return createdNode;
  }

  // packages/figma-plugin/src/validation.ts
  function guardRenderPayload(payload) {
    const result = validateRenderPayload(payload);
    return result.ok ? null : result.error;
  }

  // packages/figma-plugin/src/render-command.ts
  async function renderNodesCommand(rawPayload, post2, log2) {
    const payload = rawPayload;
    const t0 = Date.now();
    refreshFontCache();
    setUserFontMap(payload?.fontMap);
    resetFontReport();
    const reportFonts = () => {
      const subs = getFontReport();
      if (!subs.length) return void 0;
      const top = subs.slice(0, 6).map((x) => `${x.requested} → ${x.used} (${x.texts})`);
      const more = subs.length > 6 ? ` y ${subs.length - 6} más` : "";
      post2({
        type: "LOG",
        level: "warn",
        message: `Fuentes no disponibles en Figma, sustituidas: ${top.join(", ")}${more}. Si instalas la original y vuelves a enviar, se usará; también puedes definir una equivalencia en Ajustes.`
      });
      return subs.slice(0, 20);
    };
    const rootNode = payload?.rootNode || (Array.isArray(payload?.nodes) ? payload.nodes[0] : null);
    if (!payload || !rootNode) {
      throw new Error("Payload vacío o inválido (se esperaba rootNode o nodes[0])");
    }
    payload.rootNode = rootNode;
    const invalid = guardRenderPayload(payload);
    if (invalid) throw new Error(`Payload inválido: ${invalid}`);
    let targetPage = figma.currentPage;
    if (payload.pageName) {
      const found = figma.root.children.find((p) => p.name === payload.pageName);
      if (found) {
        targetPage = found;
      } else {
        const newPage = figma.createPage();
        newPage.name = payload.pageName;
        targetPage = newPage;
      }
      figma.currentPage = targetPage;
    }
    if (payload.createAsComponent) {
      payload.rootNode.type = "COMPONENT";
    }
    let createdTokensCount = 0;
    if (payload.tokens?.colors && variablesAvailable()) {
      try {
        createdTokensCount = cssTokensToVariables(payload.tokens.colors);
      } catch (_varErr) {
      }
    }
    if (payload.tokens?.colors && !createdTokensCount && typeof figma.createPaintStyle === "function") {
      for (const [tokenName, rgba] of Object.entries(payload.tokens.colors)) {
        try {
          const cleanName = "Token / " + tokenName.replace(/^--/, "");
          const existing = figma.getLocalPaintStyles().find((s) => s.name === cleanName);
          const style = existing || figma.createPaintStyle();
          style.name = cleanName;
          style.paints = [
            {
              type: "SOLID",
              color: { r: rgba.r, g: rgba.g, b: rgba.b },
              opacity: rgba.a !== void 0 ? rgba.a : 1
            }
          ];
          createdTokensCount++;
        } catch (_tokErr) {
        }
      }
    }
    try {
      await figma.loadFontAsync({ family: "Inter", style: "Regular" });
    } catch (_e) {
    }
    await prewarmFonts(payload.rootNode);
    const fontsMs = Date.now() - t0;
    if (payload.board) {
      const boardStart = Date.now();
      const pageBefore = figma.currentPage;
      const nodesBefore = new Set(pageBefore.children.map((c) => c.id));
      const pagesBefore = new Set(figma.root.children.map((p) => p.id));
      let board = null;
      try {
        board = await buildDesignBoard(payload);
      } catch (boardErr) {
        setBoardCtx(null);
        try {
          figma.currentPage = pageBefore;
        } catch (_e) {
          try {
            await figma.setCurrentPageAsync(pageBefore);
          } catch (_e2) {
          }
        }
        for (const p of [...figma.root.children]) {
          if (!pagesBefore.has(p.id)) {
            try {
              p.remove();
            } catch (_e) {
            }
          }
        }
        for (const c of [...pageBefore.children]) {
          if (!nodesBefore.has(c.id)) {
            try {
              c.remove();
            } catch (_e) {
            }
          }
        }
        log2.error("Tablero falló", { error: String(boardErr?.message || boardErr) });
        post2({
          type: "LOG",
          level: "error",
          message: `No se pudo organizar como tablero (${boardErr?.message || boardErr}). Se dibuja en modo normal.`
        });
      }
      if (board) {
        figma.currentPage.selection = [board.main];
        post2({
          type: "LOG",
          level: "success",
          message: `Tablero creado en "${board.page.name}": ${board.components} componentes enlazados, secciones y estilos organizados`
        });
        post2({
          type: "RENDER_SUCCESS",
          nodeId: board.main.id,
          name: board.main.name,
          nodeCount: board.nodeCount,
          pageName: board.page.name,
          width: Math.round(board.main.width),
          height: Math.round(board.main.height),
          nodeType: board.main.type,
          tokensCount: createdTokensCount,
          rawPayload: payload.rootNode,
          fontSubstitutions: reportFonts(),
          durationMs: Date.now() - t0,
          timings: { fontsMs, buildMs: Date.now() - boardStart, totalMs: Date.now() - t0 }
        });
        return;
      }
    }
    const totalNodeCount = countNodes(payload.rootNode);
    const renderStartTime = Date.now();
    const rootFigmaNode = await buildStateVariants(payload, log2) || await buildFigmaNode(payload.rootNode);
    const buildMs = Date.now() - renderStartTime;
    if (rootFigmaNode) {
      targetPage.appendChild(rootFigmaNode);
      if (payload.targetCanvasPosition) {
        rootFigmaNode.x = payload.targetCanvasPosition.x;
        rootFigmaNode.y = payload.targetCanvasPosition.y;
        if (payload.sectionTitle) {
          try {
            const headerFont = await loadFontSafely("Inter", 700);
            const headerText = figma.createText();
            headerText.fontName = headerFont;
            headerText.characters = payload.sectionTitle;
            headerText.fontSize = 18;
            headerText.fills = [{ type: "SOLID", color: { r: 0.2, g: 0.3, b: 0.5 }, opacity: 0.9 }];
            headerText.x = payload.targetCanvasPosition.x;
            headerText.y = payload.targetCanvasPosition.y - 65;
            targetPage.appendChild(headerText);
          } catch (_hdrErr) {
          }
        }
      } else {
        const GAP = Number(payload.placementGap) || 120;
        const placementMode = (payload.placementMode || "SIDE").toUpperCase();
        const otherChildren = targetPage.children.filter((child) => child.id !== rootFigmaNode.id);
        if (otherChildren.length === 0 || placementMode === "CENTER") {
          const center = figma.viewport.center;
          rootFigmaNode.x = Math.round(center.x - rootFigmaNode.width / 2);
          rootFigmaNode.y = Math.round(center.y - rootFigmaNode.height / 2);
        } else if (placementMode === "BELOW") {
          const selected = targetPage.selection.find((s) => s.id !== rootFigmaNode.id);
          if (selected) {
            rootFigmaNode.x = Math.round(selected.x);
            rootFigmaNode.y = Math.round(selected.y + selected.height + GAP);
          } else {
            let maxBottom = -Infinity;
            let alignX = otherChildren[0].x;
            for (const child of otherChildren) {
              const bottom = child.y + child.height;
              if (bottom > maxBottom) {
                maxBottom = bottom;
                alignX = child.x;
              }
            }
            rootFigmaNode.x = Math.round(alignX);
            rootFigmaNode.y = Math.round(maxBottom + GAP);
          }
        } else {
          const selected = targetPage.selection.find((s) => s.id !== rootFigmaNode.id);
          if (selected) {
            rootFigmaNode.x = Math.round(selected.x + selected.width + GAP);
            rootFigmaNode.y = Math.round(selected.y);
          } else {
            let maxRight = -Infinity;
            let alignY = otherChildren[0].y;
            for (const child of otherChildren) {
              const right = child.x + child.width;
              if (right > maxRight) {
                maxRight = right;
                alignY = child.y;
              }
            }
            rootFigmaNode.x = Math.round(maxRight + GAP);
            rootFigmaNode.y = Math.round(alignY);
          }
        }
      }
      figma.viewport.scrollAndZoomIntoView([rootFigmaNode]);
      targetPage.selection = [rootFigmaNode];
      post2({
        type: "RENDER_SUCCESS",
        nodeId: rootFigmaNode.id,
        name: rootFigmaNode.name,
        nodeCount: totalNodeCount,
        pageName: targetPage.name,
        width: Math.round(rootFigmaNode.width),
        height: Math.round(rootFigmaNode.height),
        nodeType: rootFigmaNode.type,
        tokensCount: createdTokensCount,
        rawPayload: payload.rootNode,
        fontSubstitutions: reportFonts(),
        durationMs: Date.now() - t0,
        timings: { fontsMs, buildMs, placeMs: Date.now() - renderStartTime - buildMs, totalMs: Date.now() - t0 }
      });
    } else {
      throw new Error("No se pudo generar el nodo raíz");
    }
  }
  async function buildStateVariants(payload, log2) {
    const states = Array.isArray(payload.states) ? payload.states : [];
    if (!states.length || typeof figma.combineAsVariants !== "function") return null;
    const asComponent = (root, state) => {
      const data = JSON.parse(JSON.stringify(root));
      data.type = "COMPONENT";
      data.name = `State=${String(state).replace(/[=,]/g, " ").trim() || "Estado"}`;
      data.layout = { ...data.layout, positioning: "AUTO", x: 0, y: 0 };
      return data;
    };
    const built = [];
    try {
      for (const [root, state] of [[payload.rootNode, "Default"], ...states.map((s) => [s.rootNode, s.name])]) {
        const node2 = await buildFigmaNode(asComponent(root, state));
        if (!node2 || node2.type !== "COMPONENT") throw new Error("estado sin componente");
        built.push(node2);
      }
      const set = figma.combineAsVariants(built, figma.currentPage);
      set.name = payload.rootNode?.name || "Componente";
      set.layoutMode = "HORIZONTAL";
      set.primaryAxisSizingMode = "AUTO";
      set.counterAxisSizingMode = "AUTO";
      set.counterAxisAlignItems = "CENTER";
      set.itemSpacing = 40;
      set.paddingTop = set.paddingBottom = set.paddingLeft = set.paddingRight = 32;
      return set;
    } catch (err) {
      log2.warn("No se pudieron unir los estados como variantes", { error: String(err?.message || err) });
      for (const n of built) {
        try {
          n.remove();
        } catch (_e) {
        }
      }
      return null;
    }
  }

  // packages/figma-plugin/src/code.ts
  var post = (m) => figma.ui.postMessage(m);
  figma.showUI(__html__, {
    width: 470,
    height: 630,
    title: "⚡ Code to Figma AI — Studio & Receiver"
  });
  figma.on("currentpagechange", () => {
    try {
      post({ type: "PAGE_INFO", pageName: figma.currentPage.name });
    } catch (_e) {
    }
  });
  var handlers = {
    // Código de vinculación con el hub: se pide una vez y se guarda en el almacenamiento local de Figma
    GET_PAIRING_CODE: async () => {
      let code = "";
      try {
        code = await figma.clientStorage.getAsync("hubPairingCode") || "";
      } catch (_e) {
      }
      post({ type: "PAIRING_CODE", code });
    },
    SET_PAIRING_CODE: async (msg) => {
      try {
        await figma.clientStorage.setAsync("hubPairingCode", String(msg.code || ""));
      } catch (_e) {
      }
    },
    // Ajustes del plugin: la UI es un iframe sin origen (sin localStorage fiable) → clientStorage
    GET_SETTINGS: async () => {
      let settings = {};
      try {
        const saved = await figma.clientStorage.getAsync("pluginSettings");
        if (saved && typeof saved === "object") settings = saved;
      } catch (_e) {
      }
      post({ type: "SETTINGS", settings });
    },
    SET_SETTINGS: async (msg) => {
      const settings = msg.settings && typeof msg.settings === "object" ? msg.settings : {};
      if (JSON.stringify(settings).length > 2e4) {
        log.warn("Ajustes demasiado grandes: no se guardan");
        return;
      }
      try {
        await figma.clientStorage.setAsync("pluginSettings", settings);
      } catch (_e) {
      }
    },
    CLEAR_PAGE: () => {
      for (const child of figma.currentPage.children) child.remove();
    },
    DELETE_NODE: (msg) => {
      if (!msg.nodeId) return;
      try {
        const node2 = figma.getNodeById(msg.nodeId);
        if (node2 && !node2.removed) {
          const name = node2.name;
          node2.remove();
          post({ type: "LOG", message: `"${name}" eliminado del lienzo de Figma`, level: "info" });
        }
      } catch (delErr) {
        log.warn("Error al borrar nodo", { error: String(delErr?.message || delErr) });
      }
    },
    DELETE_MULTIPLE_NODES: (msg) => {
      if (!Array.isArray(msg.nodeIds)) return;
      try {
        let count = 0;
        for (const id of msg.nodeIds) {
          const node2 = figma.getNodeById(id);
          if (node2 && !node2.removed) {
            node2.remove();
            count++;
          }
        }
        post({ type: "LOG", message: `${count} componentes eliminados del lienzo de Figma`, level: "info" });
      } catch (batchDelErr) {
        log.warn("Error al borrar nodos múltiples", { error: String(batchDelErr?.message || batchDelErr) });
      }
    },
    ZOOM_ALL: () => {
      if (figma.currentPage.children.length > 0) {
        figma.viewport.scrollAndZoomIntoView(figma.currentPage.children);
      }
    },
    GET_PAGE_INFO: () => {
      post({ type: "PAGE_INFO", pageName: figma.currentPage.name });
    },
    FOCUS_NODE: (msg) => {
      if (!msg.nodeId) return;
      try {
        const node2 = figma.getNodeById(msg.nodeId);
        if (node2) {
          figma.currentPage.selection = [node2];
          figma.viewport.scrollAndZoomIntoView([node2]);
        }
      } catch (_e) {
      }
    },
    CONVERT_TO_COMPONENT: (msg) => {
      if (!msg.nodeId) return;
      try {
        const node2 = figma.getNodeById(msg.nodeId);
        if (node2 && node2.type === "FRAME") {
          const comp = figma.createComponent();
          comp.name = node2.name;
          comp.x = node2.x;
          comp.y = node2.y;
          comp.resize(node2.width, node2.height);
          comp.layoutMode = node2.layoutMode;
          comp.primaryAxisAlignItems = node2.primaryAxisAlignItems;
          comp.counterAxisAlignItems = node2.counterAxisAlignItems;
          comp.itemSpacing = node2.itemSpacing;
          comp.paddingTop = node2.paddingTop;
          comp.paddingRight = node2.paddingRight;
          comp.paddingBottom = node2.paddingBottom;
          comp.paddingLeft = node2.paddingLeft;
          comp.fills = node2.fills;
          comp.strokes = node2.strokes;
          comp.strokeWeight = node2.strokeWeight;
          comp.cornerRadius = node2.cornerRadius;
          comp.effects = node2.effects;
          while (node2.children.length > 0) {
            comp.appendChild(node2.children[0]);
          }
          node2.parent?.appendChild(comp);
          node2.remove();
          figma.currentPage.selection = [comp];
          figma.viewport.scrollAndZoomIntoView([comp]);
          post({
            type: "LOG",
            message: `Frame "${comp.name}" convertido a Componente nativo de Figma`,
            level: "success"
          });
        }
      } catch (convErr) {
        post({ type: "LOG", message: `Error al convertir a componente: ${convErr.message}`, level: "error" });
      }
    },
    RENDER_NODES: async (msg) => {
      try {
        await renderNodesCommand(msg.payload, post, log);
      } catch (err) {
        log.error("Fallo en RENDER_NODES", { error: err?.message || String(err) });
        post({ type: "RENDER_ERROR", error: err?.message || String(err) });
      }
    }
  };
  figma.ui.onmessage = async (msg) => {
    const handler = msg && typeof msg.type === "string" && Object.prototype.hasOwnProperty.call(handlers, msg.type) ? handlers[msg.type] : null;
    if (!handler) {
      log.warn("Mensaje de la UI desconocido", { type: String(msg?.type) });
      return;
    }
    await handler(msg);
  };
})();
