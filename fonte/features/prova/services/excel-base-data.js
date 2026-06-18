let cachePromise = null;

export async function obterDadosBaseExcel() {
  if (!cachePromise) {
    cachePromise = Promise.all([
      import('../../../dados-excel/dados.js'),
      import('../../../dados-excel/mailing.js'),
    ]).then(([dadosModule, mailingModule]) => ({
      Dados: dadosModule.DADOS_EXCEL_BASE,
      Mailing: mailingModule.MAILING_EXCEL_BASE,
    }));
  }

  return cachePromise;
}
