import buildDAG from "./dag";
import {
  CyclusError,
  CyclusInvalidComponentError,
  CyclusNotImplemented,
  get,
  isObject,
  values
} from "./utils";

export interface ILifecycle {
  start(): Promise<any> | void;
  stop(): Promise<any> | void;
}

export class Lifecycle implements ILifecycle {
  public __metadata: {
    dependencies: { [key: string]: string };
    isInitialised: boolean;
  };

  constructor() {
    this.__metadata = {
      dependencies: {},
      isInitialised: false,
    };
  }

  /**
   * Begins operation of this component. Synchronous, does not return
   * until the component is started. Returns an updated version of this
   * component.
   */
  public start(): Promise<any> | void {
    throw new CyclusNotImplemented();
  }

  /**
   * Ceases operation of this component. Synchronous, does not return
   * until the component is stopped. Returns an updated version of this
   * component.
   */
  public stop(): Promise<any> | void {
    throw new CyclusNotImplemented();
  }
}

/**
 * Returns the map of other components on which this component depends.
 */
function dependencies(component: Lifecycle): { [key: string]: string } {
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
    throw new CyclusError("Invalid dependencies", { component, systemDependencies });
  }

  if (Array.isArray(systemDependencies)) {
    systemDependencies = (systemDependencies as string[]).reduce((result, dependency) => {
      result[dependency] = dependency;
      return result;
    }, {});
  }

  component.__metadata.dependencies = systemDependencies;
  return component;
}

const NOT_FOUND = Symbol("NOT_FOUND");

function getComponent(systemMap: { [key: string]: any }, systemKey: string): Lifecycle {
  const component = get(systemMap, systemKey, NOT_FOUND);

  if (component === null || component === undefined) {
    throw new CyclusInvalidComponentError(systemMap, systemKey);
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
    throw new CyclusInvalidComponentError(systemMap, systemKey);
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

function dependencyGraph(system: object): string[] {
  const dependencyArray = Object.keys(system).reduce((result, key) => {
    const component = system[key];

    values(dependencies(component)).forEach((dependency) =>
      result.push([dependency, key])
    );

    return result;
  }, []);

  return buildDAG(system, dependencyArray);
}

function assocDependencies(component: Lifecycle, system: object) {
  const metadataDependencies = dependencies(component);

  Object.keys(metadataDependencies).forEach((key) => {
    component[key] = getDependency(
      system,
      metadataDependencies[key],
      component,
      key
    );
  });
}

async function tryAction(
  component: Lifecycle,
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
  }

  public start(): Promise<any> {
    return this.__update(this.__getBuiltOrder(), "start");
  }

  public stop(): Promise<any> {
    return this.__update(this.__getReversedBuiltOrder(), "stop");
  }

  public assocDependencies() {
    Object.keys(this.map).forEach((key) => {
      assocDependencies(getComponent(this.map, key), this.map);
    });
  }

  public async replace(
    newMap: object,
    options?: { shouldRestart: boolean }
  ): Promise<any> {
    const shouldRestart =
      typeof options === "object" && "shouldRestart" in options
        ? options.shouldRestart
        : true;

    await this.__update(
      this.__filteredBuiltOrder(
        this.__getReversedBuiltOrder(),
        Object.keys(newMap)
      ),
      "stop"
    );

    Object.assign(this.map, newMap);
    this.__unsetCache(SystemMap.BUILT_ORDER_CACHE_KEY);

    await this.__update(
      this.__filteredBuiltOrder(
        this.__getBuiltOrder(),
        Object.keys(this.map)
      ),
      "start"
    );
  }

  public toString() {
    return `SystemMap { ${Object.keys(this.map).join(", ")} }`;
  }

  private __getCache(key: string) {
    return this.__metadata.__cache[key];
  }

  private __setCache(key: string, value: any) {
    this.__metadata.__cache[key] = value;
  }

  private __unsetCache(key: string) {
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
    order: string[],
    keys: string[]
  ): string[] {
    const set = new Set(keys);
    return order.filter((systemKey) => set.has(systemKey));
  }

  private async __update(order: string[], f: "start" | "stop"): Promise<any> {
    for (const key of order) {
      const component = getComponent(this.map, key);
      assocDependencies(component, this.map);
      await tryAction(component, this.map, key, f);
    }
  }
}
