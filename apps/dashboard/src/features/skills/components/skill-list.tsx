import { Pencil, Trash2 } from 'lucide-react';
import * as React from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '#/components/ui/alert-dialog';
import { Button } from '#/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card';
import { m } from '#/paraglide/messages.js';
import { cn } from '#/shared/utils';

import { useDeleteSkill, useSkills } from '../hooks';
import { SkillEditorDrawer } from './skill-editor-drawer';

export function SkillList() {
  const skillsQuery = useSkills();
  const remove = useDeleteSkill();
  const [editing, setEditing] = React.useState<string | null>(null);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{m.skills_list_title()}</CardTitle>
          <CardDescription>{m.skills_list_body()}</CardDescription>
        </CardHeader>
        <CardContent>
          {skillsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">{m.common_loading()}</p>
          ) : skillsQuery.error ? (
            <p className="text-sm text-destructive">{(skillsQuery.error as Error).message}</p>
          ) : (skillsQuery.data?.skills ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">{m.skills_list_empty()}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {(skillsQuery.data?.skills ?? []).map((s) => (
                <SkillRow
                  key={s.name}
                  name={s.name}
                  description={s.description}
                  disabled={remove.isPending}
                  onEdit={() => setEditing(s.name)}
                  onDelete={() => remove.mutate(s.name)}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <SkillEditorDrawer
        name={editing}
        open={editing !== null}
        onOpenChange={(next) => {
          if (!next) setEditing(null);
        }}
      />
    </>
  );
}

function SkillRow({
  name,
  description,
  disabled,
  onEdit,
  onDelete,
}: {
  name: string;
  description: string;
  disabled: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  return (
    <li className="flex items-start justify-between gap-3 border-b pb-3 last:border-0">
      <div className="flex min-w-0 flex-col">
        <code className="text-sm font-medium">{name}</code>
        <span className="text-xs text-muted-foreground">{description}</span>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={onEdit}
          disabled={disabled}
          title={m.skill_edit_action()}
          aria-label={m.skill_edit_action()}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <Button
            variant="ghost"
            size="icon"
            disabled={disabled}
            title={m.skill_delete_title()}
            aria-label={m.skill_delete_title()}
            onClick={() => setConfirmOpen(true)}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{m.skill_delete_confirm_title()}</AlertDialogTitle>
              <AlertDialogDescription>
                <span className="mb-2 block truncate font-mono text-xs text-foreground/80">
                  {name}
                </span>
                {m.skill_delete_confirm_body()}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{m.common_cancel()}</AlertDialogCancel>
              <AlertDialogAction
                className={cn('bg-destructive text-destructive-foreground hover:bg-destructive/90')}
                onClick={onDelete}
              >
                {m.common_delete()}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </li>
  );
}
