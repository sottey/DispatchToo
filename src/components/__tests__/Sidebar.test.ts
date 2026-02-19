import { describe, expect, it } from "vitest";
import { parseSidebarSectionsState, SIDEBAR_DEFAULT_SECTIONS_OPEN } from "@/components/Sidebar";

describe("Sidebar section state parsing", () => {
  it("returns defaults when localStorage value is missing", () => {
    expect(parseSidebarSectionsState(null)).toEqual(SIDEBAR_DEFAULT_SECTIONS_OPEN);
  });

  it("merges parsed values on top of defaults", () => {
    const stored = JSON.stringify({ tags: true, projects: false });
    expect(parseSidebarSectionsState(stored)).toEqual({
      ...SIDEBAR_DEFAULT_SECTIONS_OPEN,
      tags: true,
      projects: false,
    });
  });

  it("falls back to defaults on invalid JSON", () => {
    expect(parseSidebarSectionsState("{bad json")).toEqual(SIDEBAR_DEFAULT_SECTIONS_OPEN);
  });
});
