/**
 * Agent Handlers Index
 * Export all agent handlers for easy importing
 */

export { default as documentAgentHandler, batchDocumentHandler, reanalyzeDocumentHandler } from './documentAgentHandler';
export { default as closingAgentHandler, validateClosingReadiness } from './closingAgentHandler';
export { default as reconciliationAgentHandler } from './reconciliationAgentHandler';
export { default as taxAgentHandler } from './taxAgentHandler';
export { default as taskAssignmentAgentHandler } from './taskAssignmentAgentHandler';
export { default as notificationAgentHandler } from './notificationAgentHandler';

// Types
export type { DocumentAgentInput, DocumentAgentOutput } from './documentAgentHandler';
export type { ClosingAgentInput, ClosingAgentOutput } from './closingAgentHandler';
