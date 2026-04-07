export class KillSwitch {
  private enabled = false;

  isEnabled() {
    return this.enabled;
  }

  enable() {
    this.enabled = true;
  }

  disable() {
    this.enabled = false;
  }
}

export class ApprovalGate {
  private required = true;

  isRequired() {
    return this.required;
  }

  setRequired(value: boolean) {
    this.required = value;
  }
}

export class Allowlist {
  isActionAllowed(action: string) {
    return [
      'chat.run',
      'task.run',
      'memory.compact',
      'heartbeat',
      'boot.init',
      'rag.ingest',
      'rag.search',
      'rag.reset',
    ].includes(action);
  }
}
