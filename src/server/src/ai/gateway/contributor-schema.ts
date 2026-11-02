import type { AiResponseFormat } from '../contracts';

export const CONTRIBUTOR_RESPONSE_FORMAT = {
  type: 'json_schema',
  json_schema: {
    name: 'contributor_draft', strict: true,
    schema: {
      type: 'object', additionalProperties: false,
      required: ['objective', 'acceptanceCriteria', 'edgeCases', 'ambiguities', 'testIdeas'],
      properties: {
        objective: { type: 'string', minLength: 1, maxLength: 200 },
        acceptanceCriteria: { type: 'array', minItems: 1, maxItems: 5, items: { type: 'string', minLength: 1, maxLength: 160 } },
        edgeCases: { type: 'array', minItems: 0, maxItems: 3, items: { type: 'string', minLength: 1, maxLength: 120 } },
        ambiguities: { type: 'array', minItems: 0, maxItems: 3, items: { type: 'string', minLength: 1, maxLength: 120 } },
        testIdeas: { type: 'array', minItems: 0, maxItems: 3, items: { type: 'string', minLength: 1, maxLength: 120 } },
      },
    },
  },
} as const satisfies AiResponseFormat;
