import { Trash2 } from 'lucide-react';

import { m } from '#/paraglide/messages.js';
import { Button } from '#/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card';

import { useDeleteSkill, useSkills } from '../hooks';

export function SkillList() {
  const skillsQuery = useSkills();
  const remove = useDeleteSkill();

  return (
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
              <li
                key={s.name}
                className="flex items-start justify-between gap-3 border-b pb-3 last:border-0"
              >
                <div className="flex flex-col">
                  <code className="text-sm font-medium">{s.name}</code>
                  <span className="text-xs text-muted-foreground">{s.description}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (window.confirm(m.skills_upload_delete_confirm({ name: s.name }))) {
                      remove.mutate(s.name);
                    }
                  }}
                  disabled={remove.isPending}
                  title={m.skill_delete_title()}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
