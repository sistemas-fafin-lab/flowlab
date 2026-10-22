import React, { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import type { CriarTabelaAssociada, TabelaAssociada } from '../../hooks/useCostControl';
import {
  erroNomeTabela,
  fonteDaNovaTabela,
  opcoesDeTabela,
  tabelaEscolhidaDaFonte,
  tabelasDaFonte,
} from './domain/tabelasAssociadas';

// ═══════════════════════════════════════════════════════════════════════════════
// Campo "Tabela Associada" da importação e do modal de linha
// (.scratch/controle-custos-tabela-associada, ticket 02): escolha da lista de
// tabelas ativas da fonte pagadora digitada, com "+ Nova tabela" (nome +
// vencimento opcional) no próprio campo. Sem fonte, fica desabilitado.
// ═══════════════════════════════════════════════════════════════════════════════

const NOVA_TABELA = '__nova__';

interface EscolhaTabelaAssociadaProps {
  fontePagadora: string;
  // Todas as cadastradas — o campo filtra pela fonte.
  tabelas: TabelaAssociada[];
  // Id escolhido. Um id de outra fonte (a fonte mudou depois da escolha) é
  // mostrado como nenhuma escolha.
  value: string | null;
  onChange: (tabela: TabelaAssociada) => void;
  onCriar: CriarTabelaAssociada;
  className: string;
}

const EscolhaTabelaAssociada: React.FC<EscolhaTabelaAssociadaProps> = ({
  fontePagadora,
  tabelas,
  value,
  onChange,
  onCriar,
  className,
}) => {
  const [criandoNova, setCriandoNova] = useState(false);
  const [nome, setNome] = useState('');
  const [vencimento, setVencimento] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const daFonte = useMemo(() => tabelasDaFonte(tabelas, fontePagadora), [tabelas, fontePagadora]);
  const opcoes = useMemo(() => opcoesDeTabela(daFonte, value), [daFonte, value]);
  const semFonte = !fontePagadora.trim();
  const selecionada = tabelaEscolhidaDaFonte(daFonte, fontePagadora, value)?.id ?? '';

  const fecharNova = () => {
    setCriandoNova(false);
    setNome('');
    setVencimento('');
    setErro(null);
  };

  const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (e.target.value === NOVA_TABELA) {
      setCriandoNova(true);
      return;
    }
    const tabela = daFonte.find(t => t.id === e.target.value);
    if (tabela) onChange(tabela);
  };

  const criar = async () => {
    if (salvando) return;
    const problema = erroNomeTabela(nome, daFonte);
    if (problema) {
      setErro(problema);
      return;
    }
    setSalvando(true);
    try {
      const criada = await onCriar(fonteDaNovaTabela(daFonte, fontePagadora), nome, vencimento || null);
      onChange(criada);
      fecharNova();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar a tabela.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-2">
      <select
        value={criandoNova && !semFonte ? NOVA_TABELA : selecionada}
        onChange={handleSelect}
        disabled={semFonte}
        className={`${className} disabled:opacity-60 disabled:cursor-not-allowed`}
      >
        <option value="" disabled>
          {semFonte ? 'Escolha a fonte pagadora primeiro' : 'Selecione a tabela…'}
        </option>
        {opcoes.map(t => (
          <option key={t.id} value={t.id}>
            {t.nome || '(sem nome)'}
            {t.ativa ? '' : ' (inativa)'}
          </option>
        ))}
        <option value={NOVA_TABELA}>+ Nova tabela</option>
      </select>

      {criandoNova && !semFonte && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-900/40 p-3 space-y-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              autoFocus
              value={nome}
              onChange={e => {
                setNome(e.target.value);
                setErro(null);
              }}
              onKeyDown={e => {
                // Dentro do <form> do modal de linha: Enter cria a tabela,
                // não envia a linha.
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void criar();
                }
              }}
              placeholder="Nome da nova tabela"
              aria-label="Nome da nova tabela"
              className={`${className} flex-1 min-w-0`}
            />
            <input
              type="date"
              value={vencimento}
              onChange={e => setVencimento(e.target.value)}
              aria-label="Vencimento do contrato (opcional)"
              title="Vencimento do contrato (opcional)"
              className={`${className} sm:w-44`}
            />
          </div>
          {erro && <p className="text-xs text-red-600 dark:text-red-400">{erro}</p>}
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">Vencimento é opcional.</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={fecharNova}
                disabled={salvando}
                className="px-3 py-1.5 rounded-xl text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={criar}
                disabled={salvando}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 active:scale-[.98] transition-all disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" /> {salvando ? 'Criando…' : 'Criar tabela'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EscolhaTabelaAssociada;
