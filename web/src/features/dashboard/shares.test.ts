import { describe, expect, it } from "vitest";
import { positiveShares } from "./shares";

describe("positiveShares", () => {
  it("computes one-decimal shares of the positive rows and skips the negative one", () => {
    expect(positiveShares(["600.00", "300.00", "100.00", "-50.00"])).toEqual([
      "60,0%",
      "30,0%",
      "10,0%",
      null,
    ]);
  });

  it("rounds to one decimal on integer cents", () => {
    expect(positiveShares(["1.00", "2.00"])).toEqual(["33,3%", "66,7%"]);
    expect(positiveShares(["0.01", "99999999999999.99"])[1]).toBe("100,0%");
  });

  it("returns null for every row when there is no positive base", () => {
    expect(positiveShares(["-10.00"])).toEqual([null]);
    expect(positiveShares(["0.00"])).toEqual([null]);
    expect(positiveShares([])).toEqual([]);
  });
});
