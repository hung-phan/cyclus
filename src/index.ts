import buildDAG from "./dag";
import {
  CyclusError,
  get,
  isObject,
} from "./utils";

export interface ILifecycle {
  start(): Promise<any> | void;
  stop(): Promise<any> | void;
}

export class Lifecycle implements ILifecycle {
  public __metadata: {
    dependencies: { [key: string]: string }
    isInitialised: boolean;
  };

  constructor() {
    this.__metadata = {
      dependencies: {},
      isInitialised: false
    };
  }

  /**
   * Begins operation of this component. Synchronous, does not return
   * until the component is started. Returns an updated version of this
   * component.
   */
  public start(): Promise<any> | void {
    // do nothing
  }

  /**
   * Ceases operation of this component. Synchronous, does not return
   * until the component is stopped. Returns an updated version of this
   * component.
   */
  public stop(): Promise<any> | void {
    // do nothing
  }
}

/**
 * Returns the map of other components on which this component depends.
 */
function dependencies(component: any): { [key: string]: string } {
  if (!(component instanceof Lifecycle)) {
    return {};
  }

  return component.__metadata.dependencies;
}

/**
 * Associates metadata with component describing the other components
 * on which it depends. Component dependencies are specified as a map.
 * Keys in the map correspond to keys in this component which must be
 * provided by its containing system. Values in the map are the keys in
 * the system at which those components may be found. Alternatively, if
 * the keys are the same in both the component and its enclosing
 * system, they may be specified as a vector of keys.
 */
export function using(
  component: Lifecycle,
  systemDependencies: string[] | { [key: string]: string }
): Lifecycle {
  if (!Array.isArray(systemDependencies) && !isObject(systemDependencies)) {
    throw new CyclusError("Invalid dependencies", {
      component,
      systemDependencies
    });
  }

  if (Array.isArray(systemDependencies)) {
    systemDependencies = (systemDependencies as string[]).reduce(
      (result, dependency) => {
        result[dependency] = dependency;
        return result;
      },
      {}
    );
  }

  component.__metadata.dependencies = systemDependencies;
  return component;
}

const NOT_FOUND = Symbol("NOT_FOUND");

function getComponent(systemMap: object, systemKey: string): any {
  const component = get(systemMap, systemKey, NOT_FOUND);

  if (component === null || component === undefined) {
    throw new CyclusError(
      `Component ${systemKey} was null or undefined in system; maybe it returned null or undefined from start or stop`,
      {
        systemKey,
        systemMap
      }
    );
  }

  if (component === NOT_FOUND) {
    throw new CyclusError(`Missing component ${systemKey} from system`, {
      systemKey,
      systemMap
    });
  }

  return component;
}

function getDependency(
  systemMap: object,
  systemKey: string,
  component: Lifecycle,
  dependencyKey: string
): any {
  const dependency = get(systemMap, systemKey, NOT_FOUND);

  if (dependency === null || dependency === undefined) {
    throw new CyclusError(
      `Component ${systemKey} was null or undefined in system; maybe it returned null or undefined from start or stop`,
      {
        systemKey,
        systemMap
      }
    );
  }

  if (dependency === NOT_FOUND) {
    throw new CyclusError(
      `Missing dependency ${dependencyKey} of ${component} expected in system at ${systemKey}`,
      {
        component,
        dependencyKey,
        systemKey,
        systemMap
      }
    );
  }

  return dependency;
}

function dependencyGraph(systemMap: object): string[] {
  const dependencyArray = Object.keys(systemMap).reduce((result, key) => {
    const component = systemMap[key];

    Object.values(dependencies(component)).forEach(dependency =>
      result.push([dependency, key])
    );

    return result;
  }, []);

  return buildDAG(systemMap, dependencyArray);
}

function assignDependencies(component: any, systemMap: object): void {
  const metadataDependencies = dependencies(component);

  for (const key of Object.keys(metadataDependencies)) {
    component[key] = getDependency(
      systemMap,
      metadataDependencies[key],
      component,
      key
    );
  }
}

async function tryAction(
  component: any,
  systemMap: object,
  systemKey: string,
  f: "start" | "stop"
): Promise<any> {
  try {
    if (
      !(component instanceof Lifecycle) ||
      (component.__metadata.isInitialised && f === "start") ||
      (!component.__metadata.isInitialised && f === "stop")
    ) {
      return;
    }

    await component[f]();
    component.__metadata.isInitialised = f === "start";
  } catch (error) {
    throw new CyclusError(
      `Error in component ${systemKey} in system calling ${f}`,
      {
        component,
        error,
        method: f,
        systemKey,
        systemMap
      }
    );
  }
}

export class SystemMap implements ILifecycle {
  private static BUILT_ORDER_CACHE_KEY = "@cyclus/SystemMap/BUILT_ORDER";

  public map: object;
  private __metadata: {
    __cache: object;
  };

  constructor(map: object) {
    this.map = map;
    this.__metadata = {
      __cache: {}
    };
    this.__assignDependencies();
  }

  public start(): Promise<any> {
    return this.__triggerLifecycle("start", this.__getBuiltOrder());
  }

  public stop(): Promise<any> {
    return this.__triggerLifecycle("stop", this.__getReversedBuiltOrder());
  }

  public async replace(
    newMap: object,
    options: { shouldRestart?: boolean | string[] } = {}
  ): Promise<any> {
    const shouldRestart = options.shouldRestart;

    if (shouldRestart) {
      await this.__triggerLifecycle(
        "stop",
        this.__filteredBuiltOrder(
          [
            ...Object.keys(newMap),
            ...(Array.isArray(shouldRestart) ? shouldRestart : [])
          ],
          this.__getReversedBuiltOrder()
        )
      );
    }

    Object.assign(this.map, newMap);
    this.__unsetCache(SystemMap.BUILT_ORDER_CACHE_KEY);
    this.__assignDependencies();

    if (shouldRestart) {
      await this.__triggerLifecycle(
        "start",
        this.__filteredBuiltOrder(Object.keys(this.map), this.__getBuiltOrder())
      );
    }
  }

  public toString(): string {
    return `SystemMap { ${Object.keys(this.map).join(", ")} }`;
  }

  private __assignDependencies(): void {
    for (const key of Object.keys(this.map)) {
      assignDependencies(getComponent(this.map, key), this.map);
    }
  }

  private async __triggerLifecycle(
    f: "start" | "stop",
    order: string[]
  ): Promise<any> {
    for (const key of order) {
      await tryAction(getComponent(this.map, key), this.map, key, f);
    }
  }

  private __getCache(key: string): any {
    return this.__metadata.__cache[key];
  }

  private __setCache(key: string, value: any): void {
    this.__metadata.__cache[key] = value;
  }

  private __unsetCache(key: string): void {
    delete this.__metadata.__cache[key];
  }

  private __getBuiltOrder(): string[] {
    const result = this.__getCache(SystemMap.BUILT_ORDER_CACHE_KEY);

    if (result !== null && result !== undefined) {
      return result;
    }

    const newResult = dependencyGraph(this.map);

    this.__setCache(SystemMap.BUILT_ORDER_CACHE_KEY, newResult);

    return newResult;
  }

  private __getReversedBuiltOrder(): string[] {
    return this.__getBuiltOrder().reverse();
  }

  private __filteredBuiltOrder(
    systemKeys: string[],
    order: string[]
  ): string[] {
    const set = new Set(systemKeys);
    return order.filter(systemKey => set.has(systemKey));
  }
}
