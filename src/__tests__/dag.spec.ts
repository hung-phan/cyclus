import buildDAG from "../dag";
import { CyclusError } from "../utils";

test("buildDAG should return ['e', 'f', 'a', 'b', 'd', 'c']", () => {
  expect(
    buildDAG(
      {
        a: "A",
        b: "B",
        c: "C",
        d: "D",
        e: "E",
        f: "F"
      },
      [["a", "d"], ["f", "b"], ["b", "d"], ["f", "a"], ["d", "c"]]
    )
  ).toEqual(["e", "f", "a", "b", "d", "c"]);
});

test("build DAG should detect cycle", () => {
  expect(() =>
    buildDAG(
      {
        a: "A",
        b: "B",
        c: "C",
        d: "D",
        e: "E",
        f: "F"
      },
      [["a", "d"], ["f", "b"], ["b", "d"], ["f", "a"], ["d", "c"], ["c", "f"]]
    )
  ).toThrow("Cycle detected");
});
