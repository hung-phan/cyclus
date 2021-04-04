import buildDAG from "./dag";
import { CyclusError, get, isObject, } from "./utils";

type State = "start" | "stop";

export interface ILifecycle {
  start(): Promise<unknown> | void;

  stop(): Promise<unknown> | void;
}

export class Lifecycle implements ILifecycle {
  public __cyclusMetadata: {
    dependencies: { [key: string]: string }
    state: State;
  };

  constructor() {
    this.__cyclusMetadata = {
      dependencies: {},
      state: "stop"
    };
  }

  /**
   * Begins operation of this component. Synchronous, does not return
   * until the component is started. Returns an updated version of this
   * component.
   */
  public start(): Promise<unknown> | void {
    // do nothing
  }

  /**
   * Ceases operation of this component. Synchronous, does not return
   * until the component is stopped. Returns an updated version of this
   * component.
   */
  public stop(): Promise<unknown> | void {
    // do nothing
  }
}

type SystemMapData = { [key: string]: unknown }

/**
 * Returns the map of other components on which this component depends.
 */
function dependencies(component: Lifecycle): { [key: string]: string } {
  return component.__cyclusMetadata.dependencies;
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

  component.__cyclusMetadata.dependencies = systemDependencies;
  return component;
}

const NOT_FOUND = Symbol("NOT_FOUND");

function getComponent(systemMap: SystemMapData, systemKey: string): unknown {
  const component = get(systemMap, systemKey, NOT_FOUND);

  if (component === null || component === undefined) {
    throw new CyclusError(
      `Component ${systemKey} was null or undefined in system`,
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
  systemMap: SystemMapData,
  systemKey: string,
  component: Lifecycle,
  dependencyKey: string
): unknown {
  const dependency = get(systemMap, systemKey, NOT_FOUND);

  if (dependency === null || dependency === undefined) {
    throw new CyclusError(
      `Component ${systemKey} was null or undefined in system`,
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

function dependencyGraph(systemMap: SystemMapData): string[] {
  const dependenciesArray = [];

  for (const [key, component] of Object.entries(systemMap)) {
    if (!(component instanceof Lifecycle)) {
      continue;
    }

    for (const dependency of Object.values(dependencies(component))) {
      dependenciesArray.push([dependency, key]);
    }
  }

  return buildDAG(systemMap, dependenciesArray);
}

function assignDependencies(component: unknown, systemMap: SystemMapData): void {
  if (!(component instanceof Lifecycle)) {
    return;
  }

  const metadataDependencies = dependencies(component);

  for (const [dependencyKey, systemKey] of Object.entries(metadataDependencies)) {
    component[dependencyKey] = getDependency(
      systemMap,
      systemKey,
      component,
      dependencyKey
    );
  }
}

async function tryAction(
  component: unknown,
  systemMap: SystemMapData,
  systemKey: string,
  f: State
): Promise<void> {
  try {
    if (
      !(component instanceof Lifecycle) ||
      component.__cyclusMetadata.state === f
    ) {
      return;
    }

    await component[f]();
    component.__cyclusMetadata.state = f;
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

  public map: SystemMapData;
  private __metadata: {
    cache: object;
  };

  constructor(map: SystemMapData) {
    this.map = map;
    this.__metadata = {
      cache: {}
    };
    this.__assignDependencies();
  }

  public start(): Promise<unknown> {
    return this.__triggerLifecycle("start", this.__getBuiltOrder());
  }

  public stop(): Promise<unknown> {
    return this.__triggerLifecycle("stop", this.__getReversedBuiltOrder());
  }

  public async replace(
    newMap: SystemMapData,
    options: { shouldRestart?: boolean | string[] } = {}
  ): Promise<void> {
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
  ): Promise<void> {
    for (const key of order) {
      await tryAction(getComponent(this.map, key), this.map, key, f);
    }
  }

  private __getCache(key: string): any {
    return this.__metadata.cache[key];
  }

  private __setCache(key: string, value: any): void {
    this.__metadata.cache[key] = value;
  }

  private __unsetCache(key: string): void {
    delete this.__metadata.cache[key];
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
