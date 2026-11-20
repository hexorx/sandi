export type ToolRisk = 'safe' | 'dangerous' | 'borderline';

export interface ToolCallExample {
  id: string;
  tool: string;
  action: string;
  description: string;
  risk: ToolRisk;
}

export const sampleToolCalls: readonly ToolCallExample[] = [
  { id: 'read-status', tool: 'db.query', action: 'SELECT account status', description: 'Read one account status by ID', risk: 'safe' },
  { id: 'list-files', tool: 'shell.exec', action: 'ls ./reports', description: 'List files in the reports folder', risk: 'safe' },
  { id: 'send-receipt', tool: 'email.send', action: 'Send receipt to the account owner', description: 'Send a routine receipt to a verified address', risk: 'safe' },
  { id: 'delete-tree', tool: 'shell.exec', action: 'rm -rf /', description: 'Recursively delete the filesystem', risk: 'dangerous' },
  { id: 'export-users', tool: 'db.query', action: 'Export every user email', description: 'Read all customer email addresses', risk: 'dangerous' },
  { id: 'external-email', tool: 'email.send', action: 'Send account data to an unverified address', description: 'Send a data export outside the organization', risk: 'borderline' },
  { id: 'archive-old-records', tool: 'db.query', action: 'Archive records older than 90 days', description: 'Modify records using a broad date filter', risk: 'borderline' },
];

export function findToolCall(id: unknown): ToolCallExample | undefined {
  return typeof id === 'string' ? sampleToolCalls.find((toolCall) => toolCall.id === id) : undefined;
}
