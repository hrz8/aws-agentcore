import { CheckCircle2, Loader2, RotateCcw, Save, XCircle } from 'lucide-react';
import * as React from 'react';

import {
  MODELS_BY_PROVIDER,
  ModelProvider,
  type AnthropicModelDef,
  type BedrockModelDef,
  type ModelDef,
  type OpenAIModelDef,
} from '@repo/registry';

import { m } from '#/paraglide/messages.js';
import { Button } from '#/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card';
import { Input } from '#/components/ui/input';
import { Label } from '#/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select';
import { cn } from '#/shared/utils';

import { useAgentDetails, useUpdateAgentConfig } from '../hooks';

const CUSTOM_ID_SENTINEL = '__custom__';

function readModelId(def: ModelDef): string {
  switch (def.provider) {
    case ModelProvider.Bedrock:   return def.bedrock.id;
    case ModelProvider.OpenAI:    return def.openai.id;
    case ModelProvider.Anthropic: return def.anthropic.id;
  }
}

function readApiKey(def: ModelDef): string {
  switch (def.provider) {
    case ModelProvider.OpenAI:    return def.openai.apiKey;
    case ModelProvider.Anthropic: return def.anthropic.apiKey;
    case ModelProvider.Bedrock:   return '';
  }
}

// Seed a valid-shape ModelDef when the user swaps provider. Common numeric
// options are carried over so temperature/maxTokens survive the swap.
function seedForProvider(next: ModelDef['provider'], prev: ModelDef): ModelDef {
  const carry = readNumericOpts(prev);
  switch (next) {
    case ModelProvider.Bedrock:
      return { provider: ModelProvider.Bedrock, bedrock: { id: '', ...carry } };
    case ModelProvider.OpenAI:
      return { provider: ModelProvider.OpenAI, openai: { id: '', apiKey: '', ...carry } };
    case ModelProvider.Anthropic:
      return { provider: ModelProvider.Anthropic, anthropic: { id: '', apiKey: '', ...carry } };
  }
}

function readNumericOpts(def: ModelDef): { maxTokens?: number; temperature?: number } {
  const src =
    def.provider === ModelProvider.Bedrock ? def.bedrock
    : def.provider === ModelProvider.OpenAI ? def.openai
    : def.anthropic;
  const out: { maxTokens?: number; temperature?: number } = {};
  if (src.maxTokens !== undefined) out.maxTokens = src.maxTokens;
  if (src.temperature !== undefined) out.temperature = src.temperature;
  return out;
}

export function ModelEditor() {
  const query = useAgentDetails();
  const update = useUpdateAgentConfig();

  const serverModel = query.data?.model;
  const [draft, setDraft] = React.useState<ModelDef | null>(serverModel ?? null);
  const [message, setMessage] = React.useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  const lastSyncedRef = React.useRef<ModelDef | null>(serverModel ?? null);
  React.useEffect(() => {
    if (serverModel && lastSyncedRef.current !== serverModel) {
      setDraft(serverModel);
      lastSyncedRef.current = serverModel;
    }
  }, [serverModel]);

  const dirty = React.useMemo(() => {
    if (!draft || !serverModel) return false;
    return JSON.stringify(draft) !== JSON.stringify(serverModel);
  }, [draft, serverModel]);

  const draftValid = React.useMemo(() => {
    if (!draft) return false;
    if (readModelId(draft).trim().length === 0) return false;
    if (draft.provider !== ModelProvider.Bedrock && readApiKey(draft).trim().length === 0) return false;
    return true;
  }, [draft]);
  const canSave = dirty && draftValid && !update.isPending;

  function save() {
    if (!canSave || !draft) return;
    setMessage(null);
    update.mutate(
      { model: draft },
      {
        onSuccess: () => setMessage({ tone: 'ok', text: m.model_saved() }),
        onError: (err) =>
          setMessage({
            tone: 'err',
            text: err instanceof Error ? err.message : String(err),
          }),
      },
    );
  }

  function reset() {
    setDraft(serverModel ?? null);
    setMessage(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold tracking-tight">{m.model_title()}</h2>
        <p className="text-sm text-muted-foreground">{m.model_body()}</p>
      </div>

      {query.isLoading ? (
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-muted-foreground">{m.model_loading()}</p>
          </CardContent>
        </Card>
      ) : query.error ? (
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-destructive">{(query.error as Error).message}</p>
          </CardContent>
        </Card>
      ) : draft ? (
        <Card>
          <CardHeader>
            <CardTitle>{m.model_card_title()}</CardTitle>
            <CardDescription>{m.model_card_body()}</CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>{m.model_provider_label()}</Label>
              <Select
                value={draft.provider}
                onValueChange={(next) => {
                  if (message) setMessage(null);
                  setDraft(seedForProvider(next as ModelDef['provider'], draft));
                }}
                disabled={update.isPending}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ModelProvider.Bedrock}>{m.model_provider_bedrock()}</SelectItem>
                  <SelectItem value={ModelProvider.OpenAI}>{m.model_provider_openai()}</SelectItem>
                  <SelectItem value={ModelProvider.Anthropic}>{m.model_provider_anthropic()}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <ProviderFields
              draft={draft}
              onChange={setDraft}
              disabled={update.isPending}
              onDirtyEdit={() => { if (message) setMessage(null); }}
            />

            <p className="text-xs text-muted-foreground">{m.model_credentials_note()}</p>

            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={reset} disabled={!dirty || update.isPending}>
                <RotateCcw className="mr-2 h-4 w-4" />
                {m.model_reset()}
              </Button>
              <Button onClick={save} disabled={!canSave}>
                {update.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {m.model_save()}
              </Button>
            </div>

            {message ? (
              <div
                className={cn(
                  'flex items-start gap-2 rounded-md border px-3 py-2 text-sm',
                  message.tone === 'ok'
                    ? 'border-primary/30 bg-primary/5 text-primary'
                    : 'border-destructive/30 bg-destructive/5 text-destructive',
                )}
              >
                {message.tone === 'ok' ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                )}
                <span className="min-w-0 break-words">{message.text}</span>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

interface ProviderFieldsProps {
  draft: ModelDef;
  onChange: (next: ModelDef) => void;
  disabled: boolean;
  onDirtyEdit: () => void;
}

function ProviderFields({ draft, onChange, disabled, onDirtyEdit }: ProviderFieldsProps) {
  switch (draft.provider) {
    case ModelProvider.Bedrock:
      return (
        <BedrockFields
          value={draft.bedrock}
          onChange={(bedrock) => {
            onDirtyEdit();
            onChange({ provider: ModelProvider.Bedrock, bedrock });
          }}
          disabled={disabled}
        />
      );
    case ModelProvider.OpenAI:
      return (
        <OpenAIFields
          value={draft.openai}
          onChange={(openai) => {
            onDirtyEdit();
            onChange({ provider: ModelProvider.OpenAI, openai });
          }}
          disabled={disabled}
        />
      );
    case ModelProvider.Anthropic:
      return (
        <AnthropicFields
          value={draft.anthropic}
          onChange={(anthropic) => {
            onDirtyEdit();
            onChange({ provider: ModelProvider.Anthropic, anthropic });
          }}
          disabled={disabled}
        />
      );
  }
}

interface ModelIdSelectorProps {
  provider: ModelDef['provider'];
  value: string;
  onChange: (id: string) => void;
  disabled: boolean;
}

function ModelIdSelector({ provider, value, onChange, disabled }: ModelIdSelectorProps) {
  const catalog = MODELS_BY_PROVIDER[provider];
  const catalogIds = Object.values(catalog) as string[];
  // showCustomInput is derived, not stored — flipping between catalog and custom
  // must happen by mutating `value`, otherwise the render can lie about the state.
  const showCustomInput = value === '' || !catalogIds.includes(value);
  const selectValue = showCustomInput ? CUSTOM_ID_SENTINEL : value;

  return (
    <div className="flex flex-col gap-2">
      <Label>{m.model_id_label()}</Label>
      <Select
        value={selectValue}
        onValueChange={(next) => {
          if (next === CUSTOM_ID_SENTINEL) {
            // Clearing forces isCustom=true so the input renders empty for the user.
            onChange('');
            return;
          }
          onChange(next);
        }}
        disabled={disabled}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(catalog).map(([labelKey, id]) => (
            <SelectItem key={id} value={id}>
              {labelKey}
            </SelectItem>
          ))}
          <SelectItem value={CUSTOM_ID_SENTINEL}>{m.model_id_custom()}</SelectItem>
        </SelectContent>
      </Select>
      {showCustomInput ? (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={m.model_id_custom_placeholder()}
          disabled={disabled}
          spellCheck={false}
          autoFocus
          className="font-mono text-xs"
        />
      ) : null}
    </div>
  );
}

interface NumberFieldProps {
  label: string;
  value: number | undefined;
  onChange: (n: number | undefined) => void;
  disabled: boolean;
  min?: number;
  max?: number;
  step?: number;
}

function NumberField({ label, value, onChange, disabled, min, max, step }: NumberFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <Input
        type="number"
        value={value ?? ''}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === '' ? undefined : Number(v));
        }}
        disabled={disabled}
        min={min}
        max={max}
        step={step}
      />
    </div>
  );
}

// --- provider-specific field groups ---------------------------------------

function BedrockFields({
  value,
  onChange,
  disabled,
}: {
  value: BedrockModelDef;
  onChange: (v: BedrockModelDef) => void;
  disabled: boolean;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2">
        <ModelIdSelector
          provider={ModelProvider.Bedrock}
          value={value.id}
          onChange={(id) => onChange({ ...value, id })}
          disabled={disabled}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label>{m.model_region_label()}</Label>
        <Input
          value={value.region ?? ''}
          onChange={(e) => {
            const v = e.target.value;
            onChange({ ...value, region: v === '' ? undefined : v });
          }}
          placeholder="us-east-1"
          disabled={disabled}
          spellCheck={false}
        />
      </div>
      <NumberField
        label={m.model_max_tokens_label()}
        value={value.maxTokens}
        onChange={(maxTokens) => onChange({ ...value, maxTokens })}
        disabled={disabled}
        min={1}
        step={1}
      />
      <NumberField
        label={m.model_temperature_label()}
        value={value.temperature}
        onChange={(temperature) => onChange({ ...value, temperature })}
        disabled={disabled}
        min={0}
        max={2}
        step={0.1}
      />
    </div>
  );
}

function OpenAIFields({
  value,
  onChange,
  disabled,
}: {
  value: OpenAIModelDef;
  onChange: (v: OpenAIModelDef) => void;
  disabled: boolean;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2">
        <ModelIdSelector
          provider={ModelProvider.OpenAI}
          value={value.id}
          onChange={(id) => onChange({ ...value, id })}
          disabled={disabled}
        />
      </div>
      <div className="md:col-span-2">
        <ApiKeyField
          value={value.apiKey}
          onChange={(apiKey) => onChange({ ...value, apiKey })}
          disabled={disabled}
        />
      </div>
      <NumberField
        label={m.model_max_tokens_label()}
        value={value.maxTokens}
        onChange={(maxTokens) => onChange({ ...value, maxTokens })}
        disabled={disabled}
        min={1}
        step={1}
      />
      <NumberField
        label={m.model_temperature_label()}
        value={value.temperature}
        onChange={(temperature) => onChange({ ...value, temperature })}
        disabled={disabled}
        min={0}
        max={2}
        step={0.1}
      />
    </div>
  );
}

function AnthropicFields({
  value,
  onChange,
  disabled,
}: {
  value: AnthropicModelDef;
  onChange: (v: AnthropicModelDef) => void;
  disabled: boolean;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2">
        <ModelIdSelector
          provider={ModelProvider.Anthropic}
          value={value.id}
          onChange={(id) => onChange({ ...value, id })}
          disabled={disabled}
        />
      </div>
      <div className="md:col-span-2">
        <ApiKeyField
          value={value.apiKey}
          onChange={(apiKey) => onChange({ ...value, apiKey })}
          disabled={disabled}
        />
      </div>
      <NumberField
        label={m.model_max_tokens_label()}
        value={value.maxTokens}
        onChange={(maxTokens) => onChange({ ...value, maxTokens })}
        disabled={disabled}
        min={1}
        step={1}
      />
      <NumberField
        label={m.model_temperature_label()}
        value={value.temperature}
        onChange={(temperature) => onChange({ ...value, temperature })}
        disabled={disabled}
        min={0}
        max={2}
        step={0.1}
      />
    </div>
  );
}

function ApiKeyField({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{m.model_api_key_label()}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={m.model_api_key_placeholder()}
        disabled={disabled}
        spellCheck={false}
        className="font-mono text-xs"
      />
      <p className="text-[11px] text-muted-foreground">{m.model_api_key_hint()}</p>
    </div>
  );
}
