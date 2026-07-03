import { Sha256 } from '@aws-crypto/sha256-js';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { SignatureV4 } from '@smithy/signature-v4';

export { SignatureV4 };
export { HttpRequest } from '@smithy/protocol-http';

export function createSigner(service: string, region: string): SignatureV4 {
  return new SignatureV4({
    service,
    region,
    sha256: Sha256,
    credentials: fromNodeProviderChain(),
  });
}
