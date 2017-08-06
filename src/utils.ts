export class CyclusError extends Error {
  public data: object;

  constructor(message: string, data: object) {
    super(message);

    this.data = data;
  }
}

export function get(obj: object, key: string, defaultVal: any): any {
  if (key in obj) {
    return obj[key];
  }

  return defaultVal;
}

export function values(obj: object): any[] {
  return Object.keys(obj).map(key => obj[key]);
}

export function isObject(obj: object): boolean {
  return obj !== null && typeof obj === "object" && Array.isArray(obj) === false;
}
