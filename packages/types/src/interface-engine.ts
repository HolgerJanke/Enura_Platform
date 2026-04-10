// =============================================================================
// Interface Execution Engine — Types
// =============================================================================

export type InterfaceExecutionJobData = {
  interfaceId: string;
  holdingId: string;
  companyId: string;
  projectId?: string;
  trigger: string;
  variables?: Record<string, string>;
};

export type InterfaceExecutionResult = {
  status: 'success' | 'error' | 'timeout' | 'skipped';
  httpStatus?: number;
  durationMs: number;
  retryCount: number;
  mappedFields?: Record<string, unknown>;
  error?: string;
};

export type FieldMapping = {
  source_field: string;
  target_table: string;
  target_field: string;
  transformation?: string;
  filter?: Record<string, string>;
};
