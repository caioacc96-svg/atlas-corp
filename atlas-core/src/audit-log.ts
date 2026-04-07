type AuditEvent = {
  type: string;
  actor: string;
  entityType: string;
  entityId?: string;
  payload?: unknown;
  createdAt: string;
};

export class AuditLog {
  private events: AuditEvent[] = [];

  add(event: Omit<AuditEvent, 'createdAt'>) {
    this.events.push({
      ...event,
      createdAt: new Date().toISOString(),
    });
  }

  list() {
    return this.events.slice(-200);
  }
}
