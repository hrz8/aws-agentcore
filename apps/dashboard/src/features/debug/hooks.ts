import * as React from 'react';

import { KONAMI_QW_SEQUENCE, useKonami } from '#/shared/konami';

export function useDebugToggle() {
  const [open, setOpen] = React.useState(false);
  useKonami(KONAMI_QW_SEQUENCE, () => setOpen((v) => !v));
  return {
    open,
    setOpen,
    openDrawer: () => setOpen(true),
    closeDrawer: () => setOpen(false),
  };
}
