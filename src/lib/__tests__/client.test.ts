import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { api, ApiError } from "@/lib/client";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function jsonOk(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function jsonError(error: string, status: number) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  mockFetch.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---- Tasks ----

describe("api.tasks", () => {
  describe("list", () => {
    it("fetches /api/tasks with no params", async () => {
      mockFetch.mockResolvedValueOnce(jsonOk([]));

      const result = await api.tasks.list();

      expect(mockFetch).toHaveBeenCalledWith("/api/tasks", expect.objectContaining({
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
      }));
      expect(result).toEqual([]);
    });

    it("appends status filter as query param", async () => {
      mockFetch.mockResolvedValueOnce(jsonOk([]));

      await api.tasks.list({ status: "open" });

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("status=open");
    });

    it("appends priority filter as query param", async () => {
      mockFetch.mockResolvedValueOnce(jsonOk([]));

      await api.tasks.list({ priority: "high" });

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("priority=high");
    });

    it("appends both filters", async () => {
      mockFetch.mockResolvedValueOnce(jsonOk([]));

      await api.tasks.list({ status: "done", priority: "low" });

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("status=done");
      expect(url).toContain("priority=low");
    });

    it("omits undefined filters", async () => {
      mockFetch.mockResolvedValueOnce(jsonOk([]));

      await api.tasks.list({ status: undefined });

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toBe("/api/tasks");
    });

    it("appends page and limit params", async () => {
      mockFetch.mockResolvedValueOnce(jsonOk({ data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } }));

      await api.tasks.list({ page: 1, limit: 20 });

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("page=1");
      expect(url).toContain("limit=20");
    });
  });

  describe("get", () => {
    it("fetches /api/tasks/:id", async () => {
      const task = { id: "abc", title: "Test" };
      mockFetch.mockResolvedValueOnce(jsonOk(task));

      const result = await api.tasks.get("abc");

      expect(mockFetch).toHaveBeenCalledWith("/api/tasks/abc", expect.anything());
      expect(result).toEqual(task);
    });
  });

  describe("create", () => {
    it("posts to /api/tasks", async () => {
      const task = { id: "new", title: "Do thing" };
      mockFetch.mockResolvedValueOnce(jsonOk(task));

      const result = await api.tasks.create({ title: "Do thing" });

      expect(mockFetch).toHaveBeenCalledWith("/api/tasks", expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ title: "Do thing" }),
      }));
      expect(result).toEqual(task);
    });

    it("includes optional fields", async () => {
      mockFetch.mockResolvedValueOnce(jsonOk({}));

      await api.tasks.create({
        title: "Task",
        description: "Desc",
        status: "in_progress",
        priority: "high",
        dueDate: "2025-01-01",
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body).toEqual({
        title: "Task",
        description: "Desc",
        status: "in_progress",
        priority: "high",
        dueDate: "2025-01-01",
      });
    });
  });

  describe("update", () => {
    it("puts to /api/tasks/:id", async () => {
      mockFetch.mockResolvedValueOnce(jsonOk({ id: "abc", title: "Updated" }));

      await api.tasks.update("abc", { title: "Updated" });

      expect(mockFetch).toHaveBeenCalledWith("/api/tasks/abc", expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ title: "Updated" }),
      }));
    });

    it("sends dueDate null to clear it", async () => {
      mockFetch.mockResolvedValueOnce(jsonOk({}));

      await api.tasks.update("abc", { dueDate: null });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.dueDate).toBeNull();
    });
  });

  describe("delete", () => {
    it("deletes /api/tasks/:id", async () => {
      mockFetch.mockResolvedValueOnce(jsonOk({ deleted: true }));

      const result = await api.tasks.delete("abc");

      expect(mockFetch).toHaveBeenCalledWith("/api/tasks/abc", expect.objectContaining({
        method: "DELETE",
      }));
      expect(result).toEqual({ deleted: true });
    });
  });
});

// ---- Notes ----

describe("api.notes", () => {
  describe("list", () => {
    it("fetches /api/notes with no params", async () => {
      mockFetch.mockResolvedValueOnce(jsonOk([]));

      const result = await api.notes.list();

      expect(mockFetch).toHaveBeenCalledWith("/api/notes", expect.anything());
      expect(result).toEqual([]);
    });

    it("appends search query param", async () => {
      mockFetch.mockResolvedValueOnce(jsonOk([]));

      await api.notes.list({ search: "hello" });

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("search=hello");
    });

    it("appends page and limit params", async () => {
      mockFetch.mockResolvedValueOnce(jsonOk({ data: [], pagination: { page: 2, limit: 10, total: 0, totalPages: 0 } }));

      await api.notes.list({ page: 2, limit: 10 });

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("page=2");
      expect(url).toContain("limit=10");
    });
  });

  describe("get", () => {
    it("fetches /api/notes/:id", async () => {
      const note = { id: "n1", title: "My Note" };
      mockFetch.mockResolvedValueOnce(jsonOk(note));

      const result = await api.notes.get("n1");

      expect(mockFetch).toHaveBeenCalledWith("/api/notes/n1", expect.anything());
      expect(result).toEqual(note);
    });
  });

  describe("create", () => {
    it("posts to /api/notes", async () => {
      mockFetch.mockResolvedValueOnce(jsonOk({ id: "new", title: "Note" }));

      const result = await api.notes.create({ title: "Note" });

      expect(mockFetch).toHaveBeenCalledWith("/api/notes", expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ title: "Note" }),
      }));
      expect(result).toEqual({ id: "new", title: "Note" });
    });

    it("includes content", async () => {
      mockFetch.mockResolvedValueOnce(jsonOk({}));

      await api.notes.create({ title: "Note", content: "# Hello" });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.content).toBe("# Hello");
    });
  });

  describe("update", () => {
    it("puts to /api/notes/:id", async () => {
      mockFetch.mockResolvedValueOnce(jsonOk({ id: "n1", title: "Updated" }));

      await api.notes.update("n1", { title: "Updated" });

      expect(mockFetch).toHaveBeenCalledWith("/api/notes/n1", expect.objectContaining({
        method: "PUT",
      }));
    });
  });

  describe("delete", () => {
    it("deletes /api/notes/:id", async () => {
      mockFetch.mockResolvedValueOnce(jsonOk({ deleted: true }));

      const result = await api.notes.delete("n1");

      expect(mockFetch).toHaveBeenCalledWith("/api/notes/n1", expect.objectContaining({
        method: "DELETE",
      }));
      expect(result).toEqual({ deleted: true });
    });
  });
});

// ---- Search ----

describe("api.search", () => {
  it("fetches /api/search with query param", async () => {
    mockFetch.mockResolvedValueOnce(jsonOk({ tasks: [], notes: [], dispatches: [] }));

    const result = await api.search("dashboard");

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/search");
    expect(url).toContain("q=dashboard");
    expect(result).toEqual({ tasks: [], notes: [], dispatches: [] });
  });
});

// ---- Error handling ----

describe("error handling", () => {
  it("throws ApiError on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce(jsonError("Not found", 404));

    const err = await api.tasks.get("bad").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toBe("Not found");
    expect(err.status).toBe(404);
  });

  it("throws ApiError with fallback message", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 500 }),
    );

    await expect(api.tasks.list()).rejects.toThrow("Request failed");
  });

  it("throws ApiError on 401 unauthorized", async () => {
    mockFetch.mockResolvedValueOnce(jsonError("Unauthorized", 401));

    await expect(api.notes.list()).rejects.toThrow(ApiError);
  });
});
