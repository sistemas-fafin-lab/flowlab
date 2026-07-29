import React, { useMemo, useState } from 'react';
import { List } from 'lucide-react';
import Select from './Select';

/**
 * Seletor de unidade de medida.
 *
 * `products.unit` é texto livre, então a mesma coisa acabava cadastrada de
 * várias formas ("caixa", "Caixa", "cx"). Aqui a pessoa escolhe de uma lista
 * que junta as unidades padrão com as que já existem no catálogo — e só cai no
 * texto livre ("Outra…") quando realmente não tem opção equivalente.
 *
 * Usado no cadastro de produto (AddProduct) e na entrada direta do estoque
 * departamental (EntradaDiretaModal).
 */

// Unidades comuns na operação do laboratório. A lista real exibida é esta
// somada às unidades já usadas em products.unit (ver `units`).
const UNIDADES_PADRAO = [
  'ampola',
  'caixa',
  'frasco',
  'galão',
  'grama',
  'kit',
  'litro',
  'metro',
  'mililitro',
  'pacote',
  'par',
  'quilograma',
  'rolo',
  'tubo',
  'unidade',
];

const OUTRA = '__outra__';

interface UnitSelectProps {
  value: string;
  onChange: (unit: string) => void;
  /** unidades já usadas no catálogo (products.unit) */
  units: string[];
  /** classes do select/input, para casar com o formulário de cada tela */
  controlClass: string;
  id?: string;
  required?: boolean;
}

const UnitSelect: React.FC<UnitSelectProps> = ({ value, onChange, units, controlClass, id, required }) => {
  // Marcado quando a pessoa escolhe "Outra…" — mantém o campo livre aberto
  // enquanto ela digita, antes de o valor casar (ou não) com a lista.
  const [escreverLivre, setEscreverLivre] = useState(false);

  // Padrão + catálogo, sem repetir só por causa de maiúscula/minúscula.
  // Preserva a grafia da primeira ocorrência.
  const opcoes = useMemo(() => {
    const porChave = new Map<string, string>();
    [...UNIDADES_PADRAO, ...units].forEach(u => {
      const rotulo = (u ?? '').trim();
      if (!rotulo) return;
      const chave = rotulo.toLowerCase();
      if (!porChave.has(chave)) porChave.set(chave, rotulo);
    });
    return [...porChave.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [units]);

  const naLista = opcoes.some(o => o.toLowerCase() === value.trim().toLowerCase());
  // Valor que veio de fora e não está na lista (ex.: produto antigo) também
  // abre no modo livre, para não sumir da tela.
  const modoLivre = escreverLivre || (!!value.trim() && !naLista);

  if (modoLivre) {
    return (
      <div className="flex gap-2">
        <input
          type="text"
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          autoFocus={escreverLivre}
          placeholder="Ex.: bisnaga, fardo"
          className={controlClass}
        />
        <button
          type="button"
          onClick={() => { setEscreverLivre(false); onChange(''); }}
          className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 rounded-lg border border-gray-200 dark:border-gray-600 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors whitespace-nowrap"
          title="Voltar para a lista de unidades"
        >
          <List className="w-3.5 h-3.5" />
          Lista
        </button>
      </div>
    );
  }

  return (
    <Select
      id={id}
      value={value}
      ariaLabel="Unidade de medida"
      options={[
        ...opcoes.map(u => ({ value: u, label: u })),
        { value: OUTRA, label: 'Outra…', separatorBefore: true },
      ]}
      onChange={(unidade) => {
        if (unidade === OUTRA) {
          setEscreverLivre(true);
          onChange('');
          return;
        }
        onChange(unidade);
      }}
      controlClass={controlClass}
    />
  );
};

export default UnitSelect;
