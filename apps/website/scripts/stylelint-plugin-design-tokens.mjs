import stylelint from 'stylelint';

const { createPlugin, utils } = stylelint;

/*
 * Bans raw `#rrggbb` / `#rrggbbaa` / `#rgb` outside the `@theme` declaration block.
 * Color tokens must come from named CSS variables (`var(--color-accent)`).
 * See ADR-0002 §7.
 */
const NO_RAW_HEX = 'design-tokens/no-raw-hex';
const HEX_RE = /#[0-9a-fA-F]{3,8}\b/;

const noRawHex = createPlugin(NO_RAW_HEX, (primary) => {
  return (root, result) => {
    if (!primary) {return;}
    const validOptions = utils.validateOptions(result, NO_RAW_HEX, { actual: primary, possible: [true] });
    if (!validOptions) {return;}

    root.walkDecls((decl) => {
      if (!HEX_RE.test(decl.value)) {return;}
      // Allow hex inside @theme — that block IS the source of truth for token values.
      let parent = decl.parent;
      while (parent) {
        if (parent.type === 'atrule' && parent.name === 'theme') {return;}
        parent = parent.parent;
      }
      utils.report({
        ruleName: NO_RAW_HEX,
        result,
        node: decl,
        message: `Unexpected raw hex literal "${decl.value.match(HEX_RE)[0]}" — reference a --color-* token from @theme instead (see ADR-0002).`,
      });
    });
  };
});

/*
 * Bans raw `px` values in spacing/sizing-sensitive properties.
 * Exception: `1px` solid/dashed/dotted borders are allowed (hairline borders are a
 * legitimate 1-CSS-pixel concept that doesn't belong on the spacing scale).
 * See ADR-0002 §3.
 */
const NO_RAW_PX = 'design-tokens/no-raw-px';
const PX_RE = /(\d+(?:\.\d+)?)px/g;
const PX_TEST_RE = /\d+(?:\.\d+)?px/;
const PX_FORBIDDEN_PROPS = new Set([
  'font-size',
  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'margin-block', 'margin-block-start', 'margin-block-end',
  'margin-inline', 'margin-inline-start', 'margin-inline-end',
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'padding-block', 'padding-block-start', 'padding-block-end',
  'padding-inline', 'padding-inline-start', 'padding-inline-end',
  'border-radius',
  'border-top-left-radius', 'border-top-right-radius',
  'border-bottom-left-radius', 'border-bottom-right-radius',
  'gap', 'row-gap', 'column-gap',
]);

const noRawPx = createPlugin(NO_RAW_PX, (primary) => {
  return (root, result) => {
    if (!primary) {return;}
    const validOptions = utils.validateOptions(result, NO_RAW_PX, { actual: primary, possible: [true] });
    if (!validOptions) {return;}

    root.walkDecls((decl) => {
      const prop = decl.prop.toLowerCase();

      // border shorthand (`border: 1px solid var(--border)`) — allow 1px hairlines only.
      if (prop === 'border' || /^border-(top|right|bottom|left|block|inline)(-start|-end)?$/.test(prop)) {
        const allHairline = [...decl.value.matchAll(PX_RE)].every((m) => m[1] === '1');
        if (!allHairline) {
          utils.report({
            ruleName: NO_RAW_PX,
            result,
            node: decl,
            message: `Only 1px hairline borders are allowed; got "${decl.value}". Use a --radius-* / --spacing-* token (see ADR-0002).`,
          });
        }
        return;
      }

      // Inside @theme, raw px IS the source of truth — allow.
      let parent = decl.parent;
      while (parent) {
        if (parent.type === 'atrule' && parent.name === 'theme') {return;}
        parent = parent.parent;
      }

      if (!PX_FORBIDDEN_PROPS.has(prop)) { return; }
      if (!PX_TEST_RE.test(decl.value)) { return; }
      utils.report({
        ruleName: NO_RAW_PX,
        result,
        node: decl,
        message: `Raw px value in "${decl.prop}: ${decl.value}" — reference a --spacing-* / --text-* / --radius-* token instead (see ADR-0002).`,
      });
    });
  };
});

noRawHex.ruleName = NO_RAW_HEX;
noRawPx.ruleName = NO_RAW_PX;
export const ruleName = { NO_RAW_HEX, NO_RAW_PX };
export default [noRawHex, noRawPx];
