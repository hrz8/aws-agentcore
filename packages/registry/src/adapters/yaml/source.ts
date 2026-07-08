export type YamlSourceReadResult =
  | { kind: 'ok'; text: string; etag: string | undefined }
  | { kind: 'not-modified' };

/** Transport for a YAML registry file. `S3YamlSource` and `LocalYamlSource` both satisfy this. */
export interface YamlSource {
  /** Sources without etag semantics (e.g. filesystem) ignore `ifNoneMatch`. */
  read(opts?: { ifNoneMatch?: string }): Promise<YamlSourceReadResult>;
  /** Caller has already validated `text`; sources do not re-validate. */
  write(text: string): Promise<{ etag: string | undefined }>;
  /** Log-friendly identifier (e.g. `s3://bucket/key`, `file:/tmp/x.yaml`). */
  describe(): string;
}
