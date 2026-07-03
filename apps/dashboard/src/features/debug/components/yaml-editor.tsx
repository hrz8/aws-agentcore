import { yaml } from '@codemirror/lang-yaml';
import CodeMirror from '@uiw/react-codemirror';
import * as React from 'react';

interface YamlEditorProps {
  value: string;
  onChange: (next: string) => void;
  readOnly?: boolean;
  height?: string;
}

export function YamlEditor({ value, onChange, readOnly = false, height = '60vh' }: YamlEditorProps) {
  const handleChange = React.useCallback(
    (next: string) => onChange(next),
    [onChange],
  );

  return (
    <CodeMirror
      value={value}
      height={height}
      extensions={[yaml()]}
      onChange={handleChange}
      editable={!readOnly}
      basicSetup={{
        lineNumbers: true,
        highlightActiveLine: true,
        autocompletion: false,
        foldGutter: true,
      }}
      theme="dark"
    />
  );
}
