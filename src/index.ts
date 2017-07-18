import {
  CyclusError,
  CyclusInvalidComponentError,
  CyclusNotImplemented,
  get,
  values,
  isObject
} from "./utils";
import { PlainObject } from "./types";
import buildDAG from "./dag";

export class Lifecycle {
  __metadata: {
    isInitialised: boolean;
    dependencies: PlainObject;
  };

  constructor() {
    this.__metadata = {
      isInitialised: false,
      dependencies: {}
    };
  }

  /**
   * Begins operation of this component. Synchronous, does not return
   * until the component is started. Returns an updated version of this
   * component.
   */
  start(): Promise<any> | void {
    throw new CyclusNotImplemented();
  }

  /**
   * Ceases operation of this component. Synchronous, does not return
   * until the component is stopped. Returns an updated version of this
   * component.
   */
  stop(): Promise<any> | void {
    throw new CyclusNotImplemented();
  }
}

/**
 * Returns the map of other components on which this component depends.
 */
function dependencies(component: Lifecycle): PlainObject {
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
  dependencies: Array<string> | PlainObject
): Lifecycle {
  if (!Array.isArray(dependencies) && !isObject(dependencies)) {
    throw new CyclusError("Invalid dependencies", { component, dependencies });
  }

  if (Array.isArray(dependencies)) {
    dependencies = (dependencies as Array<string>).reduce((result, dependency) => {
      result[dependency] = dependency;
      return result;
    }, {});
  }

  component.__metadata.dependencies = dependencies;
  return component;
}

const NOT_FOUND = Symbol("NOT_FOUND");

function getComponent(system: PlainObject, systemKey: string): Lifecycle {
  const component = get(system, systemKey, NOT_FOUND);

  if (component === null || component === undefined) {
    throw new CyclusInvalidComponentError(system, systemKey);
  }

  if (component === NOT_FOUND) {
    throw new CyclusError(`Missing component ${systemKey} from system`, {
      system,
      systemKey
    });
  }

  return component;
}

function getDependency(
  system: PlainObject,
  systemKey: string,
  component: Lifecycle,
  dependencyKey: string
): any {
  const dependency = get(system, systemKey, NOT_FOUND);

  if (dependency === null || dependency === undefined) {
    throw new CyclusInvalidComponentError(system, systemKey);
  }

  if (dependency === NOT_FOUND) {
    throw new CyclusError(
      `Missing dependency ${dependencyKey} of ${component} expected in system at ${systemKey}`,
      {
        system,
        systemKey,
        component,
        dependencyKey
      }
    );
  }

  return dependency;
}

function dependencyGraph(system: PlainObject): Array<string> {
  const dependencyArray = Object.keys(system).reduce((result, key) => {
    const component = system[key];

    values(dependencies(component)).forEach(dependency =>
      result.push([dependency, key])
    );

    return result;
  }, []);

  return buildDAG(system, dependencyArray);
}

function assocDependencies(component: Lifecycle, system: PlainObject) {
  const metadataDependencies = dependencies(component);

  Object.keys(metadataDependencies).forEach(key => {
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
  system: PlainObject,
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
  } catch (e) {
    console.log(e);
    throw new CyclusError(
      `Error in component ${systemKey} in system.map calling ${f}`,
      {
        systemKey,
        component,
        system,
        method: f
      }
    );
  }
}

export class SystemMap {
  static BUILT_ORDER_CACHE_KEY = "@cyclus/SystemMap/BUILT_ORDER";

  map: PlainObject;
  __metadata: {
    __cache: PlainObject;
  };

  constructor(map: PlainObject) {
    this.map = map;
    this.__metadata = {
      __cache: {}
    };
  }

  __getCache(key: string) {
    return this.__metadata.__cache[key];
  }

  __setCache(key: string, value: any) {
    this.__metadata.__cache[key] = value;
  }

  __unsetCache(key: string) {
    delete this.__metadata.__cache[key];
  }

  __getBuiltOrder(): Array<string> {
    const result = this.__getCache(SystemMap.BUILT_ORDER_CACHE_KEY);

    if (result !== null && result !== undefined) {
      return result;
    }

    const newResult = dependencyGraph(this.map);

    this.__setCache(SystemMap.BUILT_ORDER_CACHE_KEY, newResult);

    return newResult;
  }

  __getReversedBuiltOrder(): Array<string> {
    return this.__getBuiltOrder().reverse();
  }

  static __filteredBuiltOrder(order: Array<string>, keys: Array<string>): Array<string> {
    const set = new Set(keys);
    return order.filter(systemKey => set.has(systemKey));
  }

  async __update(order: Array<string>, f: "start" | "stop"): Promise<any> {
    for (const key of order) {
      const component = getComponent(this.map, key);

      assocDependencies(component, this.map);
      await tryAction(component, this.map, key, f);

      this.map[key] = component;
    }
  }

  start(): Promise<any> {
    return this.__update(this.__getBuiltOrder(), "start");
  }

  stop(): Promise<any> {
    return this.__update(this.__getReversedBuiltOrder(), "stop");
  }

  async replace(newMap: PlainObject): Promise<any> {
    await this.__update(
      SystemMap.__filteredBuiltOrder(
        this.__getReversedBuiltOrder(),
        Object.keys(newMap)
      ),
      "stop"
    );

    Object.assign(this.map, newMap);
    this.__unsetCache(SystemMap.BUILT_ORDER_CACHE_KEY);

    await this.__update(
      SystemMap.__filteredBuiltOrder(this.__getBuiltOrder(), Object.keys(this.map)),
      "start"
    );
  }

  toString() {
    return "SystemMap";
  }
}
