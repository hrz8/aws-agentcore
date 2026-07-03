import { Outlet } from '@tanstack/react-router';

import { DebugDrawer, useDebugToggle } from '#/features/debug';

import { Navbar } from './navbar';

export function AppShell() {
  const debug = useDebugToggle();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar onOpenDebug={debug.openDrawer} />
      <div className="flex flex-1">
        <Outlet />
      </div>
      <DebugDrawer open={debug.open} onOpenChange={debug.setOpen} />
    </div>
  );
}
