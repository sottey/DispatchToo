import { describe, it, expect } from "vitest";
import { parsePagination, paginatedResponse } from "@/lib/pagination";

describe("parsePagination", () => {
  function url(qs: string) {
    return new URL(`http://localhost/api/test${qs}`);
  }

  it("returns null when no pagination params", () => {
    expect(parsePagination(url(""))).toBeNull();
  });

  it("returns null when only non-pagination params present", () => {
    expect(parsePagination(url("?status=open"))).toBeNull();
  });

  it("parses page param with default limit", () => {
    const result = parsePagination(url("?page=2"));
    expect(result).toEqual({ page: 2, limit: 20 });
  });

  it("parses both page and limit", () => {
    const result = parsePagination(url("?page=3&limit=10"));
    expect(result).toEqual({ page: 3, limit: 10 });
  });

  it("defaults page to 1 if only limit is provided", () => {
    const result = parsePagination(url("?limit=5"));
    expect(result).toEqual({ page: 1, limit: 5 });
  });

  it("clamps page to minimum 1", () => {
    const result = parsePagination(url("?page=0"));
    expect(result!.page).toBe(1);
  });

  it("clamps page for negative values", () => {
    const result = parsePagination(url("?page=-5"));
    expect(result!.page).toBe(1);
  });

  it("clamps limit=0 to default (0 is falsy, uses default then clamped)", () => {
    const result = parsePagination(url("?limit=0"));
    expect(result!.limit).toBe(20); // parseInt("0") is 0, falsy → uses default 20
  });

  it("clamps limit=-1 to minimum 1", () => {
    const result = parsePagination(url("?limit=-1"));
    expect(result!.limit).toBe(1);
  });

  it("clamps limit to maximum 100", () => {
    const result = parsePagination(url("?limit=500"));
    expect(result!.limit).toBe(100);
  });

  it("uses custom default limit", () => {
    const result = parsePagination(url("?page=1"), 50);
    expect(result!.limit).toBe(50);
  });

  it("handles non-numeric page gracefully", () => {
    const result = parsePagination(url("?page=abc"));
    expect(result!.page).toBe(1);
  });

  it("handles non-numeric limit gracefully", () => {
    const result = parsePagination(url("?limit=abc"));
    expect(result!.limit).toBe(20);
  });
});

describe("paginatedResponse", () => {
  it("calculates totalPages correctly", () => {
    const result = paginatedResponse(["a", "b"], 10, { page: 1, limit: 3 });
    expect(result.pagination.totalPages).toBe(4); // ceil(10/3)
  });

  it("returns correct structure", () => {
    const data = [{ id: "1" }, { id: "2" }];
    const result = paginatedResponse(data, 50, { page: 2, limit: 20 });

    expect(result).toEqual({
      data,
      pagination: {
        page: 2,
        limit: 20,
        total: 50,
        totalPages: 3,
      },
    });
  });

  it("handles zero total", () => {
    const result = paginatedResponse([], 0, { page: 1, limit: 20 });
    expect(result.pagination.totalPages).toBe(0);
  });

  it("handles exact division", () => {
    const result = paginatedResponse(["a"], 20, { page: 1, limit: 10 });
    expect(result.pagination.totalPages).toBe(2);
  });
});
