// Logo dos PDFs do Orçamento: o PNG branco de public/, para a faixa azul do cabeçalho.
// Já é PNG, então vai direto para data URL, sem rasterizar SVG (sem canvg).

const LOGO_PDF_URL = '/LOGO%20BRANCA.png';

/** Data URL do logo, ou null se não carregou: o PDF sai sem logo, o que não é crítico. */
export async function carregarLogoPdf(): Promise<string | null> {
  try {
    const resposta = await fetch(LOGO_PDF_URL);
    if (!resposta.ok) return null;
    const blob = await resposta.blob();
    return await new Promise<string | null>((resolve) => {
      const leitor = new FileReader();
      leitor.onload = () => resolve(typeof leitor.result === 'string' ? leitor.result : null);
      leitor.onerror = () => resolve(null);
      leitor.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Falha ao carregar o logo do PDF:', error);
    return null;
  }
}
