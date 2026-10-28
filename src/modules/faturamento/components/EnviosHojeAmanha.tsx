import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, AlertTriangle, ArrowRight, CalendarCheck, CheckCircle2, Loader2 } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { hasPermission } from '../../../utils/permissions';
import { useCalendarioEnvios } from '../hooks/useCalendarioEnvios';
import { ANCORA_ATRASADOS, nomeConvenio, organizarCalendario } from '../utils/painelEnvios';
import DetalheAgendamentoModal from './DetalheAgendamentoModal';
import MarcarEnvioModal from './MarcarEnvioModal';
import { DesmarcarEnvioDialog, PainelDia, type AcaoPainel } from './PainelDiaEnvios';

// Topo da aba Dashboard de Contas a Receber: os painéis Hoje e Amanhã do Calendário de
// envios, compactos, com a quantidade de atrasados e o link para o Calendário. Lê o
// mesmo GET do Calendário, com o próprio loading, sem segurar o resto do dashboard.
// O pai só monta para quem pode ver o Calendário (canViewBilling ou
// canViewCalendarioEnvios); marcar e desmarcar pedem canManageCalendarioEnvios. Mover e
// remover ficam no Calendário: o detalhe leva para lá.

const ROTA_CALENDARIO = '/faturamento/calendario';
const CARD = 'bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700';

const IndicadorAtrasados: React.FC<{ total: number }> = ({ total }) =>
  total === 0 ? (
    <span className="inline-flex items-center gap-1.5 text-sm text-green-700 dark:text-green-400">
      <CheckCircle2 className="h-4 w-4" />
      Nenhum envio atrasado
    </span>
  ) : (
    <Link
      to={`${ROTA_CALENDARIO}#${ANCORA_ATRASADOS}`}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-sm font-medium rounded-full bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
    >
      <AlertTriangle className="h-4 w-4" />
      {total} {total === 1 ? 'envio atrasado' : 'envios atrasados'}
    </Link>
  );

const EnviosHojeAmanha: React.FC = () => {
  const { userProfile } = useAuth();
  const podeGerenciar = hasPermission(userProfile?.permissions || [], 'canManageCalendarioEnvios');
  const navigate = useNavigate();
  const { calendario, loading, error, refetch } = useCalendarioEnvios(null);
  const [acao, setAcao] = useState<AcaoPainel | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  const { porDia, feriados, atrasados } = useMemo(() => organizarCalendario(calendario), [calendario]);

  const concluir = () => {
    setAcao(null);
    setErroAcao(null);
    void refetch();
  };

  return (
    <section aria-label="Calendário de envios" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            Envios de hoje e amanhã
          </h2>
          {calendario && <IndicadorAtrasados total={atrasados.length} />}
          {loading && calendario && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
        </div>
        <Link
          to={ROTA_CALENDARIO}
          className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          Abrir Calendário de envios
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {erroAcao && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {erroAcao}
        </div>
      )}

      {error ? (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Os envios de hoje e amanhã não foram carregados. {error}</span>
        </div>
      ) : !calendario ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0, 1].map((i) => <div key={i} className={`${CARD} h-32 animate-pulse`} />)}
        </div>
      ) : (
        <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          <PainelDia
            titulo="Hoje"
            data={calendario.hoje}
            itens={porDia.get(calendario.hoje) ?? []}
            feriado={feriados.get(calendario.hoje)}
            podeGerenciar={podeGerenciar}
            compacto
            onAcao={setAcao}
          />
          <PainelDia
            titulo="Amanhã"
            data={calendario.amanha}
            itens={porDia.get(calendario.amanha) ?? []}
            feriado={undefined}
            podeGerenciar={podeGerenciar}
            compacto
            onAcao={setAcao}
          />
        </div>
      )}

      {acao?.tipo === 'detalhe' && (
        <DetalheAgendamentoModal
          agendamento={acao.item.agendamento}
          regra={acao.item.regra}
          podeGerenciar={podeGerenciar}
          onFechar={() => setAcao(null)}
          onMarcar={() => setAcao({ tipo: 'marcar', item: acao.item })}
          onDesmarcar={() => setAcao({ tipo: 'desmarcar', item: acao.item })}
          onMover={() => navigate(ROTA_CALENDARIO)}
          onRemover={() => navigate(ROTA_CALENDARIO)}
        />
      )}
      {calendario && acao?.tipo === 'marcar' && (
        <MarcarEnvioModal
          agendamentoId={acao.item.agendamento.id}
          convenio={nomeConvenio(acao.item)}
          dataPrevista={acao.item.agendamento.dataPrevista}
          hoje={calendario.hoje}
          onFechar={() => setAcao(null)}
          onMarcado={concluir}
        />
      )}
      <DesmarcarEnvioDialog
        item={acao?.tipo === 'desmarcar' ? acao.item : null}
        onFechar={() => setAcao(null)}
        onDesmarcado={concluir}
        onErro={setErroAcao}
      />
    </section>
  );
};

export default EnviosHojeAmanha;
