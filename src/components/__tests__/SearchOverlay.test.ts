import { describe, expect, it } from "vitest";
import { filterSearchActionItems } from "@/components/SearchOverlay";

describe("SearchOverlay action filtering", () => {
  it("returns all actions for empty query", () => {
    const result = filterSearchActionItems("");
    expect(result.map((item) => item.id)).toEqual([
      "create-task",
      "create-note",
      "create-project",
      "open-dashboard",
      "open-dispatch",
      "open-inbox",
    ]);
  });

  it("matches by title and subtitle case-insensitively", () => {
    expect(filterSearchActionItems("dashboard").map((item) => item.id)).toEqual(["open-dashboard"]);
    expect(filterSearchActionItems("daily dispatch").map((item) => item.id)).toEqual(["open-dispatch"]);
  });

  it("matches by keyword", () => {
    expect(filterSearchActionItems("add").map((item) => item.id)).toEqual([
      "create-task",
      "create-note",
      "create-project",
    ]);
    expect(filterSearchActionItems("priority").map((item) => item.id)).toEqual(["open-inbox"]);
  });
});
