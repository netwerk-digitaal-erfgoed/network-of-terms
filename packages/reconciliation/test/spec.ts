import { Ajv, type SchemaObject } from 'ajv';
import traverse from 'json-schema-traverse';
import manifest from '../json-schema/0.2/manifest.json' with { type: 'json' };
import reconciliationResultBatch from '../json-schema/0.2/reconciliation-result-batch.json' with { type: 'json' };
import dataExtensionResponse from '../json-schema/0.2/data-extension-response.json' with { type: 'json' };
import dataExtensionPropertyProposal from '../json-schema/0.2/data-extension-property-proposal.json' with { type: 'json' };
import suggestPropertiesResponse from '../json-schema/0.2/suggest-properties-response.json' with { type: 'json' };
import typeSchema from '../json-schema/0.2/type.json' with { type: 'json' };

export type SpecSchema = keyof typeof responseSchemas;

/**
 * How a response deviates from its Reconciliation API 0.2 schema. Stricter than the spec: a field
 * the spec does not define is a violation too, because clients such as OpenRefine silently ignore
 * it.
 */
export function specViolations(schema: SpecSchema, body: unknown) {
  ajv.validate(schema, body);

  return (ajv.errors ?? []).map((error) =>
    error.keyword === 'additionalProperties'
      ? `${error.instancePath} ${error.message}: '${error.params.additionalProperty}'`
      : `${error.instancePath} ${error.message}`,
  );
}

// Copied unchanged from https://github.com/reconciliation-api/specs/tree/main/0.2/schemas.
const responseSchemas = {
  manifest,
  'reconciliation-result-batch': reconciliationResultBatch,
  'data-extension-response': dataExtensionResponse,
  'data-extension-property-proposal': dataExtensionPropertyProposal,
  'suggest-properties-response': suggestPropertiesResponse,
};

// The only format, uri, is on a field the service does not return, and a pattern checks it too.
const ajv = new Ajv({
  allErrors: true,
  validateSchema: false,
  validateFormats: false,
});
// The manifest refers to Swagger’s schema for authentication, which the service does not offer.
ajv.addSchema({
  $id: 'http://swagger.io/v2/schema.json',
  definitions: { securityDefinitions: { additionalProperties: false } },
});
// The manifest refers to the type schema by its $id.
ajv.addSchema(closed(typeSchema));
for (const [name, schema] of Object.entries(responseSchemas)) {
  ajv.addSchema(closed(schema), name);
}

function closed(schema: SchemaObject) {
  const copy = structuredClone(schema);
  traverse(copy, (subschema) => {
    if (subschema.properties !== undefined) {
      subschema.additionalProperties ??= false;
    }
  });

  return copy;
}
