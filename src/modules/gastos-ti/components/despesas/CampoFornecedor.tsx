import React, { useId, useMemo, useRef, useState } from 'react';
import { Building2, Plus } from 'lucide-react';
import { formatCpfCnpj } from '../../../../utils/paymentUtils';
import { chaveTexto } from '../../domain/listaDespesas';
import type { FornecedorOpcao, ResultadoCriarFornecedor } from '../../hooks/useFornecedoresTI';
import { campo, classeCampo } from '../ui/campos';

interface CampoFornecedorProps {
  id: string;
  fornecedores: FornecedorOpcao[];
  fornecedorId: string | null;
  fornecedorNome: string;
  onMudar: (valor: { id: string | null; nome: string }) => void;
  onCriarRapido: (nome: string, documento: string) => Promise<ResultadoCriarFornecedor>;
  erro?: string;
}

const MAX_SUGESTOES = 8;

/**
 * Fornecedor da despesa (D4): busca no cadastro geral (`suppliers`); se o nome
 * digitado não existir, a despesa grava só o nome — e dá para cadastrar o
 * fornecedor ali mesmo (nome + CNPJ) para ele já sair vinculado.
 */
const CampoFornecedor: React.FC<CampoFornecedorProps> = ({
  id,
  fornecedores,
  fornecedorId,
  fornecedorNome,
  onMudar,
  onCriarRapido,
  erro,
}) => {
  const listaId = useId();
  const [aberto, setAberto] = useState(false);
  const [destaque, setDestaque] = useState(0);
  const [cadastrando, setCadastrando] = useState(false);
  const [documento, setDocumento] = useState('');
  const [erroCadastro, setErroCadastro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const sugestoes = useMemo(() => {
    const termo = chaveTexto(fornecedorNome);
    const ativos = fornecedores.filter((f) => f.ativo || f.id === fornecedorId);
    return (termo ? ativos.filter((f) => chaveTexto(f.nome).includes(termo)) : ativos).slice(0, MAX_SUGESTOES);
  }, [fornecedores, fornecedorNome, fornecedorId]);

  const selecionar = (f: FornecedorOpcao) => {
    onMudar({ id: f.id, nome: f.nome });
    setAberto(false);
    setCadastrando(false);
  };

  const aoDigitar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nome = e.target.value;
    // Digitou um nome igual a um fornecedor cadastrado: vincula sem precisar clicar na sugestão.
    const exato = fornecedores.find((f) => chaveTexto(f.nome) === chaveTexto(nome));
    onMudar({ id: exato?.id ?? null, nome });
    setAberto(true);
    setDestaque(0);
  };

  const aoTeclar = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!aberto || sugestoes.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setDestaque((i) => Math.min(i + 1, sugestoes.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setDestaque((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      selecionar(sugestoes[destaque]);
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      setAberto(false);
    }
  };

  const cadastrar = async () => {
    setSalvando(true);
    setErroCadastro(null);
    const resultado = await onCriarRapido(fornecedorNome, documento);
    setSalvando(false);
    if (resultado.ok === false) {
      setErroCadastro(resultado.erro);
      return;
    }
    selecionar(resultado.fornecedor);
    setDocumento('');
  };

  const naoCadastrado = fornecedorNome.trim() !== '' && !fornecedorId;

  return (
    <div className="relative">
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-expanded={aberto && sugestoes.length > 0}
        aria-controls={listaId}
        aria-autocomplete="list"
        autoComplete="off"
        value={fornecedorNome}
        onChange={aoDigitar}
        onFocus={() => setAberto(true)}
        // Atraso no blur: deixa o clique na sugestão acontecer antes de fechar a lista.
        onBlur={() => setTimeout(() => setAberto(false), 150)}
        onKeyDown={aoTeclar}
        placeholder="Busque no cadastro ou digite o nome"
        className={campo(erro)}
      />

      {aberto && sugestoes.length > 0 && (
        <ul
          id={listaId}
          role="listbox"
          className="absolute z-20 mt-1 w-full max-h-64 overflow-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl py-1"
        >
          {sugestoes.map((f, i) => (
            <li
              key={f.id}
              role="option"
              aria-selected={f.id === fornecedorId}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selecionar(f)}
              onMouseEnter={() => setDestaque(i)}
              className={`flex items-center justify-between gap-3 px-3 py-2 text-sm cursor-pointer ${
                i === destaque ? 'bg-violet-50 dark:bg-violet-900/30' : ''
              }`}
            >
              <span className="text-slate-800 dark:text-slate-100 truncate">{f.nome}</span>
              {f.cnpj && <span className="text-xs text-slate-400 tabular-nums flex-shrink-0">{formatCpfCnpj(f.cnpj)}</span>}
            </li>
          ))}
        </ul>
      )}

      {erro && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{erro}</p>}

      {fornecedorId && !erro && (
        <p className="mt-1 flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
          <Building2 className="w-3.5 h-3.5" /> Vinculado ao cadastro de fornecedores
        </p>
      )}

      {naoCadastrado && !cadastrando && (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Fornecedor não cadastrado: a despesa guarda só o nome.{' '}
          <button
            type="button"
            onClick={() => setCadastrando(true)}
            className="inline-flex items-center gap-0.5 font-medium text-violet-600 dark:text-violet-400 hover:underline"
          >
            <Plus className="w-3 h-3" /> Cadastrar agora
          </button>
        </p>
      )}

      {naoCadastrado && cadastrando && (
        <div className="mt-2 rounded-xl border border-violet-200/70 dark:border-violet-800/60 bg-violet-50/40 dark:bg-violet-950/20 p-3 space-y-2">
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Cadastrar <strong>{fornecedorNome.trim()}</strong> em Fornecedores. Os demais dados (contato, endereço) podem
            ser completados depois na tela de Fornecedores.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              inputMode="numeric"
              aria-label="CNPJ ou CPF do fornecedor"
              value={formatCpfCnpj(documento)}
              onChange={(e) => setDocumento(e.target.value.replace(/\D/g, '').slice(0, 14))}
              onKeyDown={(e) => {
                // Dentro do formulário da despesa: Enter aqui cadastra o fornecedor, não envia a despesa.
                if (e.key === 'Enter') {
                  e.preventDefault();
                  cadastrar();
                }
              }}
              placeholder="CNPJ ou CPF"
              className={classeCampo}
            />
            <div className="flex gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={cadastrar}
                disabled={salvando}
                className="px-3 py-2 rounded-xl text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-60 transition-colors"
              >
                {salvando ? 'Cadastrando...' : 'Cadastrar'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCadastrando(false);
                  setErroCadastro(null);
                }}
                className="px-3 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
          {erroCadastro && <p className="text-xs text-red-600 dark:text-red-400">{erroCadastro}</p>}
        </div>
      )}
    </div>
  );
};

export default CampoFornecedor;
