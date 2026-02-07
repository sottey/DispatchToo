// ---- Domain types (mirrors DB schema) ----

export type TaskStatus = "open" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high";

export interface Task {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Note {
  id: string;
  userId: string;
  title: string;
  content: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Dispatch {
  id: string;
  userId: string;
  date: string;
  summary: string | null;
  finalized: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CompleteResult {
  dispatch: Dispatch;
  rolledOver: number;
  nextDispatchId: string | null;
}

export interface SearchResults {
  tasks: Task[];
  notes: Note[];
  dispatches: Dispatch[];
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ---- API error ----

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ---- Fetch wrapper ----

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new ApiError(data.error || "Request failed", res.status);
  }
  return data as T;
}

function qs(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(
    (e): e is [string, string] => e[1] !== undefined,
  );
  if (entries.length === 0) return "";
  return "?" + new URLSearchParams(entries).toString();
}

// ---- Resource clients ----

export const api = {
  tasks: {
    list: (filters?: { status?: TaskStatus; priority?: TaskPriority; page?: number; limit?: number }) =>
      request<Task[] | PaginatedResponse<Task>>(`/tasks${qs({
        status: filters?.status,
        priority: filters?.priority,
        page: filters?.page?.toString(),
        limit: filters?.limit?.toString(),
      })}`),

    get: (id: string) => request<Task>(`/tasks/${id}`),

    create: (data: {
      title: string;
      description?: string;
      status?: TaskStatus;
      priority?: TaskPriority;
      dueDate?: string;
    }) => request<Task>("/tasks", { method: "POST", body: JSON.stringify(data) }),

    update: (
      id: string,
      data: {
        title?: string;
        description?: string;
        status?: TaskStatus;
        priority?: TaskPriority;
        dueDate?: string | null;
      },
    ) => request<Task>(`/tasks/${id}`, { method: "PUT", body: JSON.stringify(data) }),

    delete: (id: string) =>
      request<{ deleted: true }>(`/tasks/${id}`, { method: "DELETE" }),
  },

  notes: {
    list: (params?: { search?: string; page?: number; limit?: number }) =>
      request<Note[] | PaginatedResponse<Note>>(`/notes${qs({
        search: params?.search,
        page: params?.page?.toString(),
        limit: params?.limit?.toString(),
      })}`),

    get: (id: string) => request<Note>(`/notes/${id}`),

    create: (data: { title: string; content?: string }) =>
      request<Note>("/notes", { method: "POST", body: JSON.stringify(data) }),

    update: (id: string, data: { title?: string; content?: string }) =>
      request<Note>(`/notes/${id}`, { method: "PUT", body: JSON.stringify(data) }),

    delete: (id: string) =>
      request<{ deleted: true }>(`/notes/${id}`, { method: "DELETE" }),
  },

  dispatches: {
    list: (params?: string | { date?: string; page?: number; limit?: number }) => {
      if (typeof params === "string") {
        return request<Dispatch[]>(`/dispatches${qs({ date: params })}`);
      }
      return request<Dispatch[] | PaginatedResponse<Dispatch>>(`/dispatches${qs({
        date: params?.date,
        page: params?.page?.toString(),
        limit: params?.limit?.toString(),
      })}`);
    },

    get: (id: string) => request<Dispatch>(`/dispatches/${id}`),

    create: (data: { date: string; summary?: string }) =>
      request<Dispatch>("/dispatches", { method: "POST", body: JSON.stringify(data) }),

    update: (id: string, data: { summary?: string }) =>
      request<Dispatch>(`/dispatches/${id}`, { method: "PUT", body: JSON.stringify(data) }),

    delete: (id: string) =>
      request<{ deleted: true }>(`/dispatches/${id}`, { method: "DELETE" }),

    getTasks: (id: string) =>
      request<Task[]>(`/dispatches/${id}/tasks`),

    linkTask: (id: string, taskId: string) =>
      request<{ linked: true }>(`/dispatches/${id}/tasks`, {
        method: "POST",
        body: JSON.stringify({ taskId }),
      }),

    unlinkTask: (id: string, taskId: string) =>
      request<{ unlinked: true }>(`/dispatches/${id}/tasks`, {
        method: "DELETE",
        body: JSON.stringify({ taskId }),
      }),

    complete: (id: string) =>
      request<CompleteResult>(`/dispatches/${id}/complete`, { method: "POST", body: JSON.stringify({}) }),
  },

  search: (q: string) =>
    request<SearchResults>(`/search${qs({ q })}`),
};
