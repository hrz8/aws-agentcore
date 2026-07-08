import { Fn, SecretValue, Stack } from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import { Construct } from 'constructs';

import { type Stage } from '../config.js';

export type PublicAssetsBasicAuthFunctionProps = {
  readonly namePrefix: string;
  readonly stage: Stage;
  // Secret shape: `{ "username": "...", "password": "..." }`. Username must not contain `:`.
  // Password must not contain `"`, `\`, or `${` (would break the baked JS string).
  readonly secretName?: string;
  readonly realm?: string;
};

export class PublicAssetsBasicAuthFunction extends Construct {
  readonly function: cloudfront.Function;

  constructor(scope: Construct, id: string, props: PublicAssetsBasicAuthFunctionProps) {
    super(scope, id);

    const stack = Stack.of(this);
    const stageLower = props.stage.toLowerCase();
    const secretName = props.secretName ?? `/nd8/${stageLower}/widget-demo-auth`;
    const realm = props.realm ?? 'nd8 widget demo';

    const username = SecretValue.secretsManager(secretName, { jsonField: 'username' }).unsafeUnwrap();
    const password = SecretValue.secretsManager(secretName, { jsonField: 'password' }).unsafeUnwrap();

    // CFF JS_2_0 runtime: no template literals, no arrow functions, no Buffer/atob/btoa.
    const code = Fn.sub(
      [
        'var B64="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";',
        'function b64enc(s) {',
        '  var out = "", i = 0, len = s.length;',
        '  while (i < len) {',
        '    var a = s.charCodeAt(i++);',
        '    var b = i < len ? s.charCodeAt(i++) : -1;',
        '    var c = i < len ? s.charCodeAt(i++) : -1;',
        '    out += B64.charAt(a >> 2);',
        '    out += B64.charAt(((a & 3) << 4) | (((b === -1 ? 0 : b)) >> 4));',
        '    out += b === -1 ? "=" : B64.charAt(((b & 15) << 2) | (((c === -1 ? 0 : c)) >> 6));',
        '    out += c === -1 ? "=" : B64.charAt(c & 63);',
        '  }',
        '  return out;',
        '}',
        'function handler(event) {',
        '  var req = event.request;',
        '  var auth = req.headers.authorization;',
        '  var expected = "Basic " + b64enc("${USER}:${PASS}");',
        '  if (!auth || auth.value !== expected) {',
        '    return {',
        '      statusCode: 401,',
        '      statusDescription: "Unauthorized",',
        '      headers: {',
        `        "www-authenticate": { value: 'Basic realm="${realm.replace(/"/g, '\\"')}"' },`,
        '        "cache-control": { value: "no-store" }',
        '      }',
        '    };',
        '  }',
        '  return req;',
        '}',
      ].join('\n'),
      { USER: username, PASS: password },
    );

    this.function = new cloudfront.Function(this, 'Function', {
      functionName: `${props.namePrefix}-widget-demo-auth-${stageLower}-${stack.region}`,
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      code: cloudfront.FunctionCode.fromInline(code),
      comment: `Basic-auth gate for /widget-demo.html (${stageLower}). Credential sourced from Secrets Manager: ${secretName}`,
    });
  }
}
