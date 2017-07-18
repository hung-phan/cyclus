import { PlainObject } from "./types";

export class CyclusError extends Error {
  data: PlainObject;

  constructor(message: string, data: PlainObject) {
    super(message);

    this.data = data;
  }
}

export class CyclusInvalidComponentError extends CyclusError {
  constructor(system: PlainObject, systemKey: string) {
    super(
      `Component ${systemKey} was null or undefined in system; maybe it returned null or undefined from start or stop`,
      {
        system,
        systemKey
      }
    );
  }
}

export class CyclusNotImplemented extends Error {
  constructor() {
    super(`Not implemented`);
  }
}

export function get(obj: Object, key: string, defaultVal: any): any {
  if (key in obj) {
    return obj[key];
  }

  return defaultVal;
}

export function values(obj: Object): Array<any> {
  return Object.keys(obj).map(key => obj[key]);
}

export function isObject(obj: Object): boolean {
  return obj != null && typeof obj === 'object' && Array.isArray(obj) === false;
}
