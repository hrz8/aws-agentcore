export const PORT = Number.parseInt(process.env.PORT ?? '8080', 10);

// ---- Agent catalog ----
export type CatalogSource = 'yaml' | 'db';

function parseCatalogSource(value: string | undefined): CatalogSource {
  if (value === undefined || value === 'yaml') return 'yaml';
  if (value === 'db') return 'db';
  throw new Error(`invalid CATALOG_SOURCE: "${value}" — expected "yaml" or "db"`);
}

export const CATALOG_SOURCE: CatalogSource = parseCatalogSource(process.env.CATALOG_SOURCE);

// Cwd-relative or absolute. Default works in dev (cwd=agent/) and Docker (WORKDIR /app).
export const CATALOG_YAML_PATH = process.env.CATALOG_YAML_PATH ?? 'agentcore/agents.yaml';

// ---- Bedrock ----
// Fallback when an agent's model.bedrock.region is unset.
export const AWS_REGION = process.env.AWS_REGION ?? 'us-east-1';
