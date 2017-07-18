import buildDAG from "../dag";

test("buildDAG should return correct built order", () => {
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
  ).toMatchSnapshot();
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
