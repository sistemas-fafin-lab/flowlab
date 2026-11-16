import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, X } from 'lucide-react';
import { chamarApi } from '../hooks/useContasReceber';
import { textoSincronizacaoTitulos, type ResumoSincronizacaoTitulos } from '../utils/sincronizacaoTitulos';
import TitulosNovosAplis from './TitulosNovosAplis';
import BaixasAplis from './BaixasAplis';

// "Atualizar do apLIS": o único botão do Contas a Receber que traz dado do apLIS.
// Ao abrir, sincroniza sozinho o que é espelho do apLIS — os títulos (status,
// envio, protocolo, NF-e, RPS e responsável dos lotes, número da nota e
// refechamento: titulos-sincronizar-aplis) e as operadoras (operadoras-sync) — e
// mostra o resumo no topo. O que lança dado novo continua com prévia, em abas:
// "Títulos novos" (TitulosNovosAplis) e "Baixas" (BaixasAplis).
//
// Os painéis só existem com o modal aberto: fechar desmonta e zera tudo, e a
// execução em curso para de iniciar itens novos (o que está no ar termina no
// servidor; reabrir mostra o que falta).

type Aba = 'titulos' | 'baixas';

const ABAS: { id: Aba; rotulo: string }[] = [
  { id: 'titulos', rotulo: 'Títulos novos' },
  { id: 'baixas', rotulo: 'Baixas' },
];

interface Props {
  aberto: boolean;
  onFechar: () => void;
  /** Algum título mudou (sincronização, criação ou baixa): relê a lista e a conferência. */
  onAlterados: () => void;
  /** As operadoras foram sincronizadas: relê o seletor de operadoras. */
  onOperadorasAtualizadas: () => void;
}

interface LinhaSincronizacao {
  estado: 'rodando' | 'ok' | 'erro';
  texto: string;
}

function LinhaResumo({ linha }: { linha: LinhaSincronizacao }) {
  if (linha.estado === 'rodando') {
    return (
      <li className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
        <Loader2 className="w-4 h-4 animate-spin shrink-0" /> {linha.texto}
      </li>
    );
  }
  if (linha.estado === 'ok') {
    return (
      <li className="flex items-start gap-2 text-gray-700 dark:text-gray-200">
        <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" /> {linha.texto}
      </li>
    );
  }
  return (
    <li className="flex items-start gap-2 text-red-600 dark:text-red-400">
      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {linha.texto}
    </li>
  );
}

const AtualizarAplisModal: React.FC<Props> = ({ aberto, onFechar, onAlterados, onOperadorasAtualizadas }) => {
  const [aba, setAba] = useState<Aba>('titulos');
  const [titulos, setTitulos] = useState<LinhaSincronizacao | null>(null);
  const [operadoras, setOperadoras] = useState<LinhaSincronizacao | null>(null);
  // Painéis com execução em curso: fechar pede confirmação.
  const [executando, setExecutando] = useState<Record<Aba, boolean>>({ titulos: false, baixas: false });
  // Cada abertura é uma sincronização: a resposta de uma abertura anterior é descartada.
  const aberturaRef = useRef(0);
  // Em ref: a sincronização roda só ao abrir, mesmo que a página passe funções novas a cada render.
  const avisosRef = useRef({ onAlterados, onOperadorasAtualizadas });
  avisosRef.current = { onAlterados, onOperadorasAtualizadas };

  const sincronizar = useCallback(async () => {
    const abertura = ++aberturaRef.current;
    const vigente = () => aberturaRef.current === abertura;
    setTitulos({ estado: 'rodando', texto: 'Atualizando os títulos com o apLIS…' });
    setOperadoras({ estado: 'rodando', texto: 'Sincronizando as operadoras…' });

    const titulosFeito = chamarApi<ResumoSincronizacaoTitulos>(
      '/api/faturamento/titulos-sincronizar-aplis',
      'Não foi possível atualizar os títulos com o apLIS.',
      { method: 'POST' },
    ).then(
      (resumo) => {
        avisosRef.current.onAlterados();
        if (vigente()) setTitulos({ estado: 'ok', texto: textoSincronizacaoTitulos(resumo) });
      },
      (err: unknown) => {
        if (vigente()) {
          setTitulos({
            estado: 'erro',
            texto: err instanceof Error ? err.message : 'Não foi possível atualizar os títulos com o apLIS.',
          });
        }
      },
    );

    const operadorasFeito = chamarApi<{ sincronizadas?: number }>(
      '/api/faturamento/operadoras-sync',
      'Falha ao sincronizar operadoras.',
      { method: 'POST', body: {} },
    ).then(
      (body) => {
        avisosRef.current.onOperadorasAtualizadas();
        const n = body.sincronizadas ?? 0;
        if (vigente()) {
          setOperadoras({
            estado: 'ok',
            texto: `${n} ${n === 1 ? 'operadora sincronizada' : 'operadoras sincronizadas'} do apLIS.`,
          });
        }
      },
      (err: unknown) => {
        if (vigente()) {
          setOperadoras({
            estado: 'erro',
            texto: err instanceof Error ? err.message : 'Falha ao sincronizar operadoras.',
          });
        }
      },
    );

    await Promise.all([titulosFeito, operadorasFeito]);
  }, []);

  useEffect(() => {
    if (aberto) void sincronizar();
  }, [aberto, sincronizar]);

  const marcarExecutandoTitulos = useCallback((valor: boolean) => {
    setExecutando((atual) => (atual.titulos === valor ? atual : { ...atual, titulos: valor }));
  }, []);
  const marcarExecutandoBaixas = useCallback((valor: boolean) => {
    setExecutando((atual) => (atual.baixas === valor ? atual : { ...atual, baixas: valor }));
  }, []);

  const fechar = useCallback(() => {
    if (
      (executando.titulos || executando.baixas) &&
      !window.confirm(
        'A atualização ainda está em andamento. Se fechar agora, o que ainda não começou fica para a próxima vez (o que já foi feito não é desfeito). Fechar mesmo assim?',
      )
    ) {
      return;
    }
    aberturaRef.current += 1;
    setAba('titulos');
    setTitulos(null);
    setOperadoras(null);
    setExecutando({ titulos: false, baixas: false });
    onFechar();
  }, [executando, onFechar]);

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Atualizar do apLIS</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Títulos e operadoras sincronizados ao abrir · títulos novos e baixas com prévia · dados do apLIS até ontem
            </p>
          </div>
          <button
            type="button"
            onClick={fechar}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <ul className="px-6 py-3 space-y-1 text-sm border-b border-gray-100 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/30">
          {titulos && <LinhaResumo linha={titulos} />}
          {operadoras && <LinhaResumo linha={operadoras} />}
        </ul>

        <div className="flex gap-1 px-6 pt-3 border-b border-gray-100 dark:border-gray-700">
          {ABAS.map(({ id, rotulo }) => (
            <button
              key={id}
              type="button"
              onClick={() => setAba(id)}
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
                aba === id
                  ? 'border-blue-600 text-blue-700 dark:text-blue-300'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {rotulo}
              {executando[id] && <Loader2 className="inline w-3.5 h-3.5 ml-1.5 animate-spin" />}
            </button>
          ))}
        </div>

        {/* As duas abas ficam montadas: trocar de aba não perde a prévia nem a execução. */}
        <div className={aba === 'titulos' ? 'flex-1 min-h-0 flex flex-col' : 'hidden'}>
          <TitulosNovosAplis onFechar={fechar} onAlterados={onAlterados} onExecutando={marcarExecutandoTitulos} />
        </div>
        <div className={aba === 'baixas' ? 'flex-1 min-h-0 flex flex-col' : 'hidden'}>
          <BaixasAplis
            ativo={aba === 'baixas'}
            onFechar={fechar}
            onAlterados={onAlterados}
            onExecutando={marcarExecutandoBaixas}
          />
        </div>
      </div>
    </div>
  );
};

export default AtualizarAplisModal;
