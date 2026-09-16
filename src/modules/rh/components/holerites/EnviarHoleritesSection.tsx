import React, { useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileUp, Loader2, RefreshCcw, Upload } from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { chamarRhApi, ErroApiRh } from '../../rhApi';
import { formatCPF } from '../../../../utils/cpf';
import { formatCompetenciaExtenso } from '../../utils/holeritesFormato';
import { BUCKET_HOLERITES } from '../../holeritesStorage';
import type { HoleriteConfirmarResultado, HoleritePreview } from '../../types';

type Etapa =
  | { tipo: 'form' }
  | { tipo: 'enviando' }
  | { tipo: 'conferencia'; tempPath: string; preview: HoleritePreview }
  | { tipo: 'confirmando'; tempPath: string }
  | { tipo: 'resultado'; resultado: HoleriteConfirmarResultado };

interface EnviarHoleritesSectionProps {
  onConcluido: () => void;
}

const EnviarHoleritesSection: React.FC<EnviarHoleritesSectionProps> = ({ onConcluido }) => {
  const [competenciaSelecionada, setCompetenciaSelecionada] = useState('');
  const [etapa, setEtapa] = useState<Etapa>({ tipo: 'form' });
  const [erro, setErro] = useState<string | null>(null);
  const inputArquivoRef = useRef<HTMLInputElement>(null);

  const resetar = () => {
    setEtapa({ tipo: 'form' });
    setErro(null);
    setCompetenciaSelecionada('');
    if (inputArquivoRef.current) inputArquivoRef.current.value = '';
  };

  // O PDF consolidado carrega PII de todo mundo do lote — não deixa órfão no
  // storage quando o RH desiste da conferência. Best-effort: falha de limpeza
  // não deve travar o cancelamento.
  const handleCancelar = async (tempPath: string) => {
    resetar();
    const { error } = await supabase.storage.from(BUCKET_HOLERITES).remove([tempPath]);
    if (error) console.error('Falha ao remover PDF temporário cancelado:', error);
  };

  const handleArquivoSelecionado = async (arquivo: File) => {
    setErro(null);
    setEtapa({ tipo: 'enviando' });
    try {
      const tempPath = `_tmp/${crypto.randomUUID()}.pdf`;
      const { error: erroUpload } = await supabase.storage
        .from(BUCKET_HOLERITES)
        .upload(tempPath, arquivo, { contentType: 'application/pdf' });
      if (erroUpload) throw new Error(erroUpload.message);

      const preview = await chamarRhApi<HoleritePreview>(
        'holerites-preview',
        { tempPath },
        'Falha ao processar o PDF consolidado.',
      );
      setEtapa({ tipo: 'conferencia', tempPath, preview });
    } catch (err) {
      setErro(err instanceof ErroApiRh ? err.message : err instanceof Error ? err.message : 'Falha ao enviar o PDF.');
      setEtapa({ tipo: 'form' });
    }
  };

  const handleConfirmar = async (tempPath: string, preview: HoleritePreview) => {
    setErro(null);
    setEtapa({ tipo: 'confirmando', tempPath });
    try {
      const resultado = await chamarRhApi<HoleriteConfirmarResultado>(
        'holerites-confirmar',
        { tempPath },
        'Falha ao confirmar o lote de holerites.',
      );
      setEtapa({ tipo: 'resultado', resultado });
      onConcluido();
    } catch (err) {
      setErro(err instanceof ErroApiRh ? err.message : err instanceof Error ? err.message : 'Falha ao confirmar o lote.');
      setEtapa({ tipo: 'conferencia', tempPath, preview });
    }
  };

  if (etapa.tipo === 'conferencia') {
    return (
      <TelaConferencia
        competenciaSelecionada={competenciaSelecionada}
        preview={etapa.preview}
        erro={erro}
        onConfirmar={() => handleConfirmar(etapa.tempPath, etapa.preview)}
        onCancelar={() => handleCancelar(etapa.tempPath)}
      />
    );
  }

  if (etapa.tipo === 'confirmando') {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 flex flex-col items-center gap-3 text-center">
        <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
        <p className="text-sm text-gray-600 dark:text-gray-300">Distribuindo holerites e notificando colaboradores...</p>
      </div>
    );
  }

  if (etapa.tipo === 'resultado') {
    return <TelaResultado resultado={etapa.resultado} onNovoEnvio={resetar} />;
  }

  const enviando = etapa.tipo === 'enviando';

  return (
    <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Enviar holerites do mês</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Suba o PDF consolidado da folha (todos os colaboradores, um bloco de páginas atrás do outro). O sistema
          identifica cada colaborador pelo CPF impresso e separa os arquivos automaticamente.
        </p>
      </div>

      <label className="block text-xs text-gray-500 dark:text-gray-400 max-w-xs">
        Competência de referência
        <input
          type="month"
          value={competenciaSelecionada}
          onChange={(e) => setCompetenciaSelecionada(e.target.value)}
          className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
        />
        <span className="mt-1 block text-[11px] text-gray-400">
          Usada só pra conferência — a competência gravada é sempre a impressa em cada página ("Ref.:")
        </span>
      </label>

      {erro && <p className="text-sm text-red-600 dark:text-red-300">{erro}</p>}

      <div>
        <input
          ref={inputArquivoRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          disabled={enviando}
          onChange={(e) => {
            const arquivo = e.target.files?.[0];
            if (arquivo) handleArquivoSelecionado(arquivo);
          }}
        />
        <button
          type="button"
          onClick={() => inputArquivoRef.current?.click()}
          disabled={enviando}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {enviando ? 'Processando PDF...' : 'Selecionar PDF consolidado'}
        </button>
      </div>
    </section>
  );
};

const TelaConferencia: React.FC<{
  competenciaSelecionada: string;
  preview: HoleritePreview;
  erro: string | null;
  onConfirmar: () => void;
  onCancelar: () => void;
}> = ({ competenciaSelecionada, preview, erro, onConfirmar, onCancelar }) => {
  const temProblemas = preview.blocosSemCompetencia.length > 0 || preview.cpfsNaoCasados.length > 0 || preview.paginasSemCpf.length > 0;

  return (
    <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Conferência antes de distribuir</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {preview.totalPaginas} página(s) no PDF · {preview.blocosIdentificados.length} colaborador(es) identificado(s)
          </p>
        </div>
      </div>

      {preview.blocosIdentificados.length === 0 ? (
        <p className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> Nenhum colaborador foi identificado neste PDF. Confira o arquivo enviado.
        </p>
      ) : (
        <div className="rounded-xl border border-gray-200 dark:border-gray-600 divide-y divide-gray-100 dark:divide-gray-700 max-h-72 overflow-y-auto">
          {preview.blocosIdentificados.map((bloco) => {
            const divergente = competenciaSelecionada && bloco.competencia.slice(0, 7) !== competenciaSelecionada;
            return (
              <div key={`${bloco.colaboradorId}-${bloco.competencia}`} className="px-3 py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{bloco.colaboradorNome}</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500">
                    {formatCompetenciaExtenso(bloco.competencia)} · páginas {bloco.paginaInicio}–{bloco.paginaFim}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {bloco.jaExiste && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                      Substitui existente
                    </span>
                  )}
                  {divergente && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                      Divergente da competência selecionada
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {temProblemas && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3 space-y-2 text-xs text-amber-800 dark:text-amber-300">
          {preview.cpfsNaoCasados.length > 0 && (
            <p>
              <strong>{preview.cpfsNaoCasados.length}</strong> CPF(s) no PDF sem colaborador cadastrado correspondente
              (páginas: {preview.cpfsNaoCasados.map((c) => `${c.paginaInicio}–${c.paginaFim} (${formatCPF(c.cpf)})`).join(', ')}).
            </p>
          )}
          {preview.blocosSemCompetencia.length > 0 && (
            <p>
              <strong>{preview.blocosSemCompetencia.length}</strong> colaborador(es) identificado(s) mas sem "Ref."
              legível — não serão gravados: {preview.blocosSemCompetencia.map((b) => b.colaboradorNome).join(', ')}.
            </p>
          )}
          {preview.paginasSemCpf.length > 0 && (
            <p>
              <strong>{preview.paginasSemCpf.length}</strong> página(s) sem CPF legível:{' '}
              {preview.paginasSemCpf.map((p) => p.numero).join(', ')}.
            </p>
          )}
          <p>Esses casos não bloqueiam o restante do lote — trate manualmente depois.</p>
        </div>
      )}

      {erro && <p className="text-sm text-red-600 dark:text-red-300">{erro}</p>}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onConfirmar}
          disabled={preview.blocosIdentificados.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <FileUp className="w-4 h-4" />
          Confirmar e distribuir ({preview.blocosIdentificados.length})
        </button>
        <button
          type="button"
          onClick={onCancelar}
          className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </section>
  );
};

const TelaResultado: React.FC<{ resultado: HoleriteConfirmarResultado; onNovoEnvio: () => void }> = ({ resultado, onNovoEnvio }) => (
  <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 space-y-4">
    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
      <CheckCircle2 className="w-5 h-5" />
      <h3 className="text-sm font-semibold">Lote distribuído</h3>
    </div>
    <p className="text-sm text-gray-600 dark:text-gray-300">
      {resultado.processados} holerite(s) gravado(s) · {resultado.notificados} colaborador(es) notificado(s) por e-mail.
    </p>

    {resultado.falhas.length > 0 && (
      <p className="text-sm text-red-600 dark:text-red-300">
        Falha ao gravar {resultado.falhas.length}: {resultado.falhas.map((f) => f.colaboradorNome).join(', ')}. Tente reenviar o PDF.
      </p>
    )}
    {(resultado.cpfsNaoCasados.length > 0 || resultado.blocosSemCompetencia.length > 0 || resultado.paginasSemCpf.length > 0) && (
      <p className="text-sm text-amber-600 dark:text-amber-400">
        {resultado.cpfsNaoCasados.length} CPF(s) não casado(s), {resultado.blocosSemCompetencia.length} sem competência legível,{' '}
        {resultado.paginasSemCpf.length} página(s) sem CPF — tratamento manual.
      </p>
    )}

    <button
      type="button"
      onClick={onNovoEnvio}
      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
    >
      <RefreshCcw className="w-4 h-4" />
      Novo envio
    </button>
  </section>
);

export default EnviarHoleritesSection;
