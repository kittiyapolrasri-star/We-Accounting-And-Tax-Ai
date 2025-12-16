/**
 * Agent Handlers Index
 * Export all agent handlers for easy importing
 */

export { documentAgentHandler, batchDocumentHandler, reanalyzeDocumentHandler } from './documentAgentHandler';
export { closingAgentHandler, validateClosingReadiness } from './closingAgentHandler';
export { reconciliationAgentHandler } from './reconciliationAgentHandler';
export { taxAgentHandler } from './taxAgentHandler';
export { taskAssignmentAgentHandler } from './taskAssignmentAgentHandler';
export { notificationAgentHandler } from './notificationAgentHandler';

// Types
export type { DocumentAgentInput, DocumentAgentOutput } from './documentAgentHandler';
export type { ClosingAgentInput, ClosingAgentOutput } from './closingAgentHandler';

// Default exports for compatibility
export { documentAgentHandler as default } from './documentAgentHandler';
