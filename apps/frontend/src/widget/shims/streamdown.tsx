import type { ReactNode } from 'react';

interface StreamdownProps {
  children?: ReactNode;
  parseIncompleteMarkdown?: boolean;
  className?: string;
}

export function Streamdown({ children }: StreamdownProps): ReactNode {
  return children ?? null;
}

export type ControlledStreamdownProps = StreamdownProps;
export type BundledTheme = string;
