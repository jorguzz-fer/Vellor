import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type TeamInviteInput,
  TeamInviteInputSchema,
  type TeamInviteResult,
  type TeamMember,
} from '@vellor/shared';
import { Copy, RefreshCw, ShieldOff, UserMinus, UserPlus, Users } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Alert,
  Badge,
  EmptyState,
  ErrorState,
  PageLoader,
  useToast,
} from '@/components/ui/feedback';
import { Input } from '@/components/ui/form';
import { ConfirmDialog, Modal } from '@/components/ui/overlay';
import { adminApi, ApiError } from '@/lib/api';
import { useZodForm } from '@/lib/forms';
import { formatShortDate } from '@/lib/format';
import { usePageMeta } from '@/lib/meta';
import { useAuth } from '@/lib/queries';

const QUERY_KEY = ['admin', 'team'] as const;

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message;
  return error instanceof Error && error.message ? error.message : fallback;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Resultado do convite: link para definir a senha, com cópia para envio manual. */
function InviteResult({ result }: { result: TeamInviteResult }) {
  const { toast } = useToast();
  return (
    <div className="space-y-4" data-testid="invite-result">
      <Alert tone="success">
        {result.promoted
          ? `${result.member.name} já tinha conta de cliente e agora é administrador(a).`
          : `Convite criado para ${result.member.name}.`}{' '}
        {result.emailQueued
          ? 'O link também foi enviado por e-mail.'
          : 'O e-mail da loja ainda não está configurado: envie o link abaixo por um canal seguro.'}
      </Alert>
      <div>
        <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
          Link para definir a senha · vale por 7 dias
        </p>
        <div className="flex gap-2">
          <input
            readOnly
            value={result.setupUrl}
            className="input font-mono text-xs"
            onFocus={(event) => event.currentTarget.select()}
            aria-label="Link do convite"
            data-testid="invite-link"
          />
          <Button
            type="button"
            variant="secondary"
            icon={<Copy className="h-4 w-4" />}
            onClick={async () => {
              const ok = await copyText(result.setupUrl);
              toast(
                ok ? 'Link copiado' : 'Não foi possível copiar. Selecione o link e copie.',
                ok ? undefined : 'danger',
              );
            }}
          >
            Copiar
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted">
        No primeiro acesso ao painel a pessoa também ativa a verificação em duas etapas com um
        aplicativo autenticador.
      </p>
    </div>
  );
}

function InviteModal({ onClose, onInvited }: { onClose: () => void; onInvited: () => void }) {
  const [result, setResult] = useState<TeamInviteResult | null>(null);
  const form = useZodForm(TeamInviteInputSchema, { name: '', email: '' });
  const values = form.values as TeamInviteInput;

  const submit = form.handleSubmit(async (data) => {
    const created = await adminApi.inviteTeamMember(data);
    setResult(created);
    onInvited();
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={result ? 'Convite pronto' : 'Convidar administrador'}
      footer={
        result ? (
          <Button type="button" onClick={onClose} data-testid="invite-done">
            Concluir
          </Button>
        ) : (
          <>
            <Button type="button" variant="secondary" onClick={onClose} disabled={form.submitting}>
              Cancelar
            </Button>
            <Button
              type="submit"
              form="invite-form"
              loading={form.submitting}
              icon={<UserPlus className="h-4 w-4" />}
              data-testid="invite-submit"
            >
              Gerar convite
            </Button>
          </>
        )
      }
    >
      {result ? (
        <InviteResult result={result} />
      ) : (
        <form id="invite-form" onSubmit={submit} noValidate className="space-y-4">
          {form.formError && <Alert tone="danger">{form.formError}</Alert>}
          <p className="text-sm text-muted">
            A pessoa recebe um link para criar a própria senha. Ninguém precisa compartilhar senha
            temporária. Se o e-mail já for de um cliente da loja, a conta é promovida.
          </p>
          <Input
            label="Nome"
            name="name"
            required
            value={values.name}
            onChange={(event) => form.setField('name', event.target.value)}
            error={form.errors.name}
            placeholder="Nome de quem vai administrar"
            autoComplete="off"
            data-testid="invite-name"
          />
          <Input
            label="E-mail"
            name="email"
            type="email"
            required
            value={values.email}
            onChange={(event) => form.setField('email', event.target.value)}
            error={form.errors.email}
            placeholder="pessoa@empresa.com.br"
            autoComplete="off"
            data-testid="invite-email"
          />
        </form>
      )}
    </Modal>
  );
}

export default function TeamPage() {
  usePageMeta('Equipe');
  const auth = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const teamQuery = useQuery({ queryKey: QUERY_KEY, queryFn: adminApi.team });
  const [inviteOpen, setInviteOpen] = useState(false);
  const [resent, setResent] = useState<TeamInviteResult | null>(null);
  const [toRevoke, setToRevoke] = useState<TeamMember | null>(null);
  const [toResetMfa, setToResetMfa] = useState<TeamMember | null>(null);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });

  const resend = useMutation({
    mutationFn: (member: TeamMember) =>
      adminApi.inviteTeamMember({ name: member.name, email: member.email }),
    onSuccess: (result) => {
      setResent(result);
      invalidate();
    },
    onError: (error) => toast(errorMessage(error, 'Não foi possível renovar o convite'), 'danger'),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => adminApi.revokeTeamMember(id),
    onSuccess: () => {
      invalidate();
      toast('Acesso administrativo removido');
      setToRevoke(null);
    },
    onError: (error) => toast(errorMessage(error, 'Não foi possível remover o acesso'), 'danger'),
  });
  const resetMfa = useMutation({
    mutationFn: (id: string) => adminApi.resetTeamMfa(id),
    onSuccess: () => {
      invalidate();
      toast('Segundo fator redefinido. A pessoa configura de novo no próximo acesso.');
      setToResetMfa(null);
    },
    onError: (error) =>
      toast(errorMessage(error, 'Não foi possível redefinir o segundo fator'), 'danger'),
  });

  const members = teamQuery.data ?? [];
  const selfId = auth.user?.id;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow mb-1">Acesso ao painel</p>
          <h1 className="heading text-2xl">Equipe</h1>
        </div>
        <Button
          type="button"
          icon={<UserPlus className="h-4 w-4" />}
          onClick={() => setInviteOpen(true)}
          data-testid="admin-invite"
        >
          Convidar administrador
        </Button>
      </div>

      {teamQuery.isLoading ? (
        <PageLoader />
      ) : teamQuery.isError ? (
        <ErrorState
          message={errorMessage(teamQuery.error, 'Não foi possível carregar a equipe')}
          onRetry={() => teamQuery.refetch()}
        />
      ) : members.length === 0 ? (
        <div className="card">
          <EmptyState icon={<Users className="h-8 w-8" />} title="Nenhum administrador" />
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table min-w-[760px]">
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Situação</th>
                <th>Segundo fator</th>
                <th>Último acesso</th>
                <th>
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const isSelf = member.id === selfId;
                return (
                  <tr key={member.id} data-testid="admin-team-row">
                    <td className="font-medium text-cream">
                      {member.name}
                      {isSelf && <span className="ml-2 text-[11px] text-gold">você</span>}
                    </td>
                    <td className="text-muted">{member.email}</td>
                    <td>
                      {member.invitePending ? (
                        <Badge tone="info">Convite pendente</Badge>
                      ) : (
                        <Badge tone="success">Ativo</Badge>
                      )}
                    </td>
                    <td>
                      {member.mfaEnabled ? (
                        <Badge tone="success">Ativo</Badge>
                      ) : (
                        <Badge tone="warning">Pendente</Badge>
                      )}
                    </td>
                    <td className="whitespace-nowrap text-xs text-muted">
                      {member.lastLoginAt ? formatShortDate(member.lastLoginAt) : '—'}
                    </td>
                    <td>
                      <div className="flex justify-end gap-1">
                        {member.invitePending && (
                          <button
                            type="button"
                            className="rounded p-1.5 text-ivory/70 hover:text-gold"
                            onClick={() => resend.mutate(member)}
                            disabled={resend.isPending}
                            aria-label={`Renovar convite de ${member.name}`}
                            title="Renovar convite"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </button>
                        )}
                        {!isSelf && member.mfaEnabled && (
                          <button
                            type="button"
                            className="rounded p-1.5 text-ivory/70 hover:text-gold"
                            onClick={() => setToResetMfa(member)}
                            aria-label={`Redefinir segundo fator de ${member.name}`}
                            title="Redefinir segundo fator"
                          >
                            <ShieldOff className="h-4 w-4" />
                          </button>
                        )}
                        {!isSelf && (
                          <button
                            type="button"
                            className="rounded p-1.5 text-ivory/70 hover:text-danger"
                            onClick={() => setToRevoke(member)}
                            aria-label={`Remover acesso de ${member.name}`}
                            title="Remover acesso"
                          >
                            <UserMinus className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {inviteOpen && <InviteModal onClose={() => setInviteOpen(false)} onInvited={invalidate} />}

      {resent && (
        <Modal
          open
          onClose={() => setResent(null)}
          title="Convite renovado"
          footer={
            <Button type="button" onClick={() => setResent(null)}>
              Concluir
            </Button>
          }
        >
          <InviteResult result={resent} />
        </Modal>
      )}

      <ConfirmDialog
        open={Boolean(toRevoke)}
        onClose={() => setToRevoke(null)}
        onConfirm={() => toRevoke && revoke.mutate(toRevoke.id)}
        title="Remover acesso administrativo"
        text={
          <p>
            <strong className="text-cream">{toRevoke?.name}</strong> deixa de acessar o painel na
            hora: as sessões abertas caem e a conta volta a ser de cliente. Você pode convidar de
            novo depois.
          </p>
        }
        confirmLabel="Remover acesso"
        danger
        loading={revoke.isPending}
      />

      <ConfirmDialog
        open={Boolean(toResetMfa)}
        onClose={() => setToResetMfa(null)}
        onConfirm={() => toResetMfa && resetMfa.mutate(toResetMfa.id)}
        title="Redefinir segundo fator"
        text={
          <p>
            Use quando <strong className="text-cream">{toResetMfa?.name}</strong> perdeu o celular
            ou trocou de aplicativo autenticador. As sessões abertas caem e a pessoa configura o
            segundo fator de novo no próximo acesso.
          </p>
        }
        confirmLabel="Redefinir"
        loading={resetMfa.isPending}
      />
    </div>
  );
}
