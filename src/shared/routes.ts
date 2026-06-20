export const api = {
  projects: {
    list: { method: "GET" as const, path: "/api/projects" as const },
    get: { method: "GET" as const, path: "/api/projects/:id" as const },
    create: { method: "POST" as const, path: "/api/projects" as const },
    update: { method: "PUT" as const, path: "/api/projects/:id" as const },
    delete: { method: "DELETE" as const, path: "/api/projects/:id" as const },
  },
  tasks: {
    list: { method: "GET" as const, path: "/api/projects/:projectId/tasks" as const },
    create: { method: "POST" as const, path: "/api/projects/:projectId/tasks" as const },
    update: { method: "PUT" as const, path: "/api/tasks/:id" as const },
  },
  milestones: {
    list: { method: "GET" as const, path: "/api/projects/:projectId/milestones" as const },
    create: { method: "POST" as const, path: "/api/projects/:projectId/milestones" as const },
  },
  photos: {
    list: { method: "GET" as const, path: "/api/projects/:projectId/photos" as const },
    create: { method: "POST" as const, path: "/api/projects/:projectId/photos" as const },
  },
  documents: {
    list: { method: "GET" as const, path: "/api/projects/:projectId/documents" as const },
    create: { method: "POST" as const, path: "/api/projects/:projectId/documents" as const },
  },
  messages: {
    list: { method: "GET" as const, path: "/api/projects/:projectId/messages" as const },
    create: { method: "POST" as const, path: "/api/projects/:projectId/messages" as const },
  },
  decisions: {
    list: { method: "GET" as const, path: "/api/projects/:projectId/decisions" as const },
    create: { method: "POST" as const, path: "/api/projects/:projectId/decisions" as const },
    update: { method: "PATCH" as const, path: "/api/decisions/:id" as const },
  },
  selections: {
    list: { method: "GET" as const, path: "/api/projects/:projectId/selections" as const },
    create: { method: "POST" as const, path: "/api/projects/:projectId/selections" as const },
    update: { method: "PATCH" as const, path: "/api/selections/:id" as const },
  },
  changeOrders: {
    list: { method: "GET" as const, path: "/api/projects/:projectId/change-orders" as const },
    create: { method: "POST" as const, path: "/api/projects/:projectId/change-orders" as const },
    update: { method: "PATCH" as const, path: "/api/change-orders/:id" as const },
  },
  siteVisits: {
    list: { method: "GET" as const, path: "/api/projects/:projectId/site-visits" as const },
    create: { method: "POST" as const, path: "/api/projects/:projectId/site-visits" as const },
    update: { method: "PATCH" as const, path: "/api/site-visits/:id" as const },
  },
  timeEntries: {
    list: { method: "GET" as const, path: "/api/projects/:projectId/time-entries" as const },
    create: { method: "POST" as const, path: "/api/projects/:projectId/time-entries" as const },
  },
  checklist: {
    list: { method: "GET" as const, path: "/api/projects/:projectId/checklist" as const },
    create: { method: "POST" as const, path: "/api/projects/:projectId/checklist" as const },
    update: { method: "PUT" as const, path: "/api/checklist/:id" as const },
    delete: { method: "DELETE" as const, path: "/api/checklist/:id" as const },
  },
  board: {
    list: { method: "GET" as const, path: "/api/projects/:projectId/board" as const },
    create: { method: "POST" as const, path: "/api/projects/:projectId/board" as const },
    update: { method: "PUT" as const, path: "/api/board/:id" as const },
    delete: { method: "DELETE" as const, path: "/api/board/:id" as const },
  },
  boardTemplates: {
    list: { method: "GET" as const, path: "/api/board-templates" as const },
    get: { method: "GET" as const, path: "/api/board-templates/:templateId" as const },
  },
  planningBoards: {
    list: { method: "GET" as const, path: "/api/projects/:projectId/planning-boards" as const },
    get: { method: "GET" as const, path: "/api/planning-boards/:id" as const },
    create: { method: "POST" as const, path: "/api/projects/:projectId/planning-boards" as const },
    update: { method: "PATCH" as const, path: "/api/planning-boards/:id" as const },
    delete: { method: "DELETE" as const, path: "/api/planning-boards/:id" as const },
    saveCanvas: { method: "PUT" as const, path: "/api/planning-boards/:id/canvas" as const },
  },
  canvasElements: {
    list: { method: "GET" as const, path: "/api/planning-boards/:boardId/elements" as const },
    create: { method: "POST" as const, path: "/api/planning-boards/:boardId/elements" as const },
    createBatch: { method: "POST" as const, path: "/api/planning-boards/:boardId/elements/batch" as const },
    update: { method: "PATCH" as const, path: "/api/canvas-elements/:id" as const },
    updatePositions: { method: "PATCH" as const, path: "/api/planning-boards/:boardId/elements/positions" as const },
    delete: { method: "DELETE" as const, path: "/api/canvas-elements/:id" as const },
  },
  calendar: {
    list: { method: "GET" as const, path: "/api/projects/:projectId/calendar" as const },
    create: { method: "POST" as const, path: "/api/projects/:projectId/calendar" as const },
    update: { method: "PUT" as const, path: "/api/calendar/:id" as const },
    delete: { method: "DELETE" as const, path: "/api/calendar/:id" as const },
  },
  reports: {
    generate: { method: "POST" as const, path: "/api/projects/:projectId/reports" as const },
  },
  weather: {
    get: { method: "GET" as const, path: "/api/projects/:projectId/weather" as const },
  },
  boardSnapshots: {
    list: { method: "GET" as const, path: "/api/planning-boards/:boardId/snapshots" as const },
    create: { method: "POST" as const, path: "/api/planning-boards/:boardId/snapshots" as const },
    restore: { method: "POST" as const, path: "/api/board-snapshots/:id/restore" as const },
    rename: { method: "PATCH" as const, path: "/api/board-snapshots/:id" as const },
    delete: { method: "DELETE" as const, path: "/api/board-snapshots/:id" as const },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
