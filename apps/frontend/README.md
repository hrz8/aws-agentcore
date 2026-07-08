# nd8 chat widget

Drop-in chat widget. One `<script>` tag, one config object, done.

## Embed

```html
<script>
  window.nd8Config = {
    tenantId:     '00000000-0000-0000-0000-000000000000',
    agentId:      '00000000-0000-0000-0000-000000000000',
    agentVersion: 'live',
    agentUrl:     'https://your-runtime.example.com/copilotkit',
  };
</script>
<script src="https://files.nd8.ai/libs/chat-widget/latest/widget.min.js"></script>
```

That's it. A launcher bubble appears in the bottom-right of the page.

## Optional config

```js
window.nd8Config = {
  // required
  tenantId:     '...',
  agentId:      '...',
  agentVersion: 'v1',                   // exact tag, or 'live' to follow whichever version is enabled
  agentUrl:     'https://.../copilotkit',

  // optional
  title:         'Assistant',           // header text
  position:      'bottom-right',        // or 'bottom-left'
  initiallyOpen: false,
  theme:         { primary: '#111' },   // launcher + header colour
  actorId:       'user-abc',            // stable identity for memory
  targetElement: '#somewhere-else',     // CSS selector or HTMLElement, defaults to <body>
};
```

## Imperative API

Post-load, call from anywhere on the page:

```js
window.nd8.open();
window.nd8.close();
window.nd8.toggle();
window.nd8.newThread();
window.nd8.setConfig({ title: 'Support' });
window.nd8.destroy();
window.nd8.init(newConfigObject);   // programmatic mount, alternative to window.nd8Config
```

## Play with it

Interactive playground with a live agent picker:
<https://files.nd8.ai/widget-demo.html> (basic-auth).

## Local dev

```bash
nvm use && pnpm install
pnpm build:widget     # → dist-widget/widget.min.js + widget.js
pnpm preview:widget   # serve dist-widget/ on localhost:4174
```
