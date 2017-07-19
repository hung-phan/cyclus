export class CyclusError extends Error {
  public data: object;

  constructor(message: string, data: object) {
    super(message);

    this.data = data;
  }
}

export class CyclusInvalidComponentError extends CyclusError {
  constructor(systemMap: object, systemKey: string) {
    super(
      `Component ${systemKey} was null or undefined in system; maybe it returned null or undefined from start or stop`,
      {
        systemMap,
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

export function get(obj: object, key: string, defaultVal: any): any {
  if (key in obj) {
    return obj[key];
  }

  return defaultVal;
}

export function values(obj: object): any[] {
  return Object.keys(obj).map((key) => obj[key]);
}

export function isObject(obj: object): boolean {
  return obj != null && typeof obj === "object" && Array.isArray(obj) === false;
}
