import { Fn, Stack } from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import { Construct } from 'constructs';

import { type Stage } from '../config.js';

export type WebsiteLocaleRedirectFunctionProps = {
  readonly namePrefix: string;
  readonly stage: Stage;
  readonly localeCookieName?: string;
  readonly secondaryLocaleTag?: string;
  readonly secondaryLocalePrefix?: string;
};

export class WebsiteLocaleRedirectFunction extends Construct {
  readonly function: cloudfront.Function;

  constructor(scope: Construct, id: string, props: WebsiteLocaleRedirectFunctionProps) {
    super(scope, id);

    const stack = Stack.of(this);
    const stageLower = props.stage.toLowerCase();
    const cookie = props.localeCookieName ?? 'nd8_locale';
    const tag = props.secondaryLocaleTag ?? 'ms';
    const prefix = props.secondaryLocalePrefix ?? '/ms/';

    const code = Fn.sub(
      `function handler(event) {
  var request = event.request;
  var uri = request.uri;

  // Step 1: accept-language redirect on root when no locale cookie yet.
  if (uri === "/" && (!request.cookies || !request.cookies["\${COOKIE}"])) {
    var al = request.headers["accept-language"];
    if (al && al.value) {
      var top = al.value.split(",")[0].toLowerCase().split(/[-;]/)[0];
      if (top === "\${TAG}") {
        var qs = "";
        var query = request.querystring;
        if (query) {
          var parts = [];
          for (var k in query) {
            if (Object.prototype.hasOwnProperty.call(query, k)) {
              parts.push(encodeURIComponent(k) + "=" + encodeURIComponent(query[k].value));
            }
          }
          if (parts.length) qs = "?" + parts.join("&");
        }
        return {
          statusCode: 302,
          statusDescription: "Found",
          headers: {
            "location":      { value: "\${PREFIX}" + qs },
            "vary":          { value: "Accept-Language" },
            "cache-control": { value: "no-store" }
          }
        };
      }
    }
  }

  // Step 2: directory-index rewrite for Astro's <path>/index.html output.
  //   /ms       -> /ms/index.html
  //   /ms/      -> /ms/index.html
  //   /style.css, /_astro/foo.js -> unchanged (extension after last "/")
  if (uri.endsWith("/")) {
    request.uri = uri + "index.html";
  } else if (uri.lastIndexOf(".") < uri.lastIndexOf("/")) {
    request.uri = uri + "/index.html";
  }

  return request;
}`,
      { COOKIE: cookie, PREFIX: prefix, TAG: tag },
    );

    this.function = new cloudfront.Function(this, 'Function', {
      functionName: `${props.namePrefix}-website-locale-${stageLower}-${stack.region}`,
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      code: cloudfront.FunctionCode.fromInline(code),
      comment: `nd8 website locale redirect + directory-index rewrite (${props.stage})`,
    });
  }
}
