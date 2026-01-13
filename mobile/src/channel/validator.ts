/**
 * Channel Event Validator
 *
 * Validates event payloads before sending to server.
 * Uses runtime schemas generated from server's events.ex.
 *
 * @example
 * import { safePush, validatePayload } from './validator';
 *
 * // Validate before sending
 * safePush(channel, 'navigate', { direction: 'north' });
 *
 * // Manual validation
 * const result = validatePayload('navigate', { direction: 'north' });
 * if (!result.valid) console.error(result.error);
 */

import type { Channel } from 'phoenix';
import {
  CLIENT_EVENT_SCHEMAS,
  type ClientEventName,
  type EventSchema,
  type FieldSchema,
} from '../types/channel.generated';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate a payload against an event schema.
 */
export function validatePayload(
  eventName: ClientEventName,
  payload: unknown
): ValidationResult {
  const schema = CLIENT_EVENT_SCHEMAS[eventName];

  if (!schema) {
    return { valid: false, error: `Unknown event: ${eventName}` };
  }

  return validateAgainstSchema(payload, schema, '');
}

/**
 * Validate a value against a field schema.
 */
function validateAgainstSchema(
  payload: unknown,
  schema: EventSchema,
  path: string
): ValidationResult {
  if (typeof payload !== 'object' || payload === null) {
    return { valid: false, error: `${path || 'payload'}: expected object, got ${typeof payload}` };
  }

  const payloadObj = payload as Record<string, unknown>;

  for (const [fieldName, fieldSchema] of Object.entries(schema)) {
    const fieldPath = path ? `${path}.${fieldName}` : fieldName;
    const value = payloadObj[fieldName];

    const result = validateField(value, fieldSchema, fieldPath);
    if (!result.valid) {
      return result;
    }
  }

  return { valid: true };
}

/**
 * Validate a single field value.
 */
function validateField(
  value: unknown,
  schema: FieldSchema,
  path: string
): ValidationResult {
  // Handle optional fields
  if (!schema.required && (value === undefined || value === null)) {
    return { valid: true };
  }

  // Handle required fields
  if (schema.required && (value === undefined || value === null)) {
    return { valid: false, error: `${path}: required field is missing` };
  }

  // Type validation
  switch (schema.type) {
    case 'string':
      if (typeof value !== 'string') {
        return { valid: false, error: `${path}: expected string, got ${typeof value}` };
      }
      break;

    case 'integer':
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        return { valid: false, error: `${path}: expected integer, got ${typeof value}` };
      }
      break;

    case 'boolean':
      if (typeof value !== 'boolean') {
        return { valid: false, error: `${path}: expected boolean, got ${typeof value}` };
      }
      break;

    case 'map':
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return { valid: false, error: `${path}: expected object, got ${typeof value}` };
      }
      break;

    case 'list':
      if (!Array.isArray(value)) {
        return { valid: false, error: `${path}: expected array, got ${typeof value}` };
      }
      break;

    case 'enum':
      if (typeof value !== 'string' || !schema.enumValues?.includes(value)) {
        return {
          valid: false,
          error: `${path}: expected one of [${schema.enumValues?.join(', ')}], got ${JSON.stringify(value)}`,
        };
      }
      break;

    case 'object':
      if (schema.nested) {
        return validateAgainstSchema(value, schema.nested, path);
      }
      break;
  }

  return { valid: true };
}

/**
 * Push an event to the channel with validation.
 *
 * In development, throws an error if validation fails.
 * In production, logs the error and sends anyway.
 */
export function safePush(
  channel: Channel | null,
  eventName: ClientEventName,
  payload: Record<string, unknown>
): void {
  if (!channel) {
    console.warn('[Channel] Cannot push - channel not connected');
    return;
  }

  const result = validatePayload(eventName, payload);

  if (!result.valid) {
    console.error(`[Channel] Validation failed for ${eventName}:`, result.error, payload);

    // In development, throw to catch issues early
    if (__DEV__) {
      throw new Error(`Channel validation failed: ${result.error}`);
    }

    // In production, log and send anyway (server will validate too)
  }

  channel.push(eventName, payload);
}

/**
 * Check if an event name is valid.
 */
export function isValidClientEvent(eventName: string): eventName is ClientEventName {
  return eventName in CLIENT_EVENT_SCHEMAS;
}
