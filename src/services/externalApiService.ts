export const externalApi = {
  async getCep(cep: string) {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) throw new Error('CEP inválido');
    
    const response = await fetch(`https://brasilapi.com.br/api/cep/v1/${cleanCep}`);
    if (!response.ok) throw new Error('CEP não encontrado na base de dados.');
    return response.json();
  },

  async getCnpj(cnpj: string) {
    const cleanCnpj = cnpj.replace(/\D/g, '');
    if (cleanCnpj.length !== 14) throw new Error('CNPJ inválido');
    
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
    if (!response.ok) throw new Error('CNPJ não encontrado na Receita Federal.');
    return response.json();
  },

  async getVehicleByPlate(plate: string) {
    const cleanPlate = plate.replace(/[^a-zA-Z0-9]/g, '');
    if (cleanPlate.length !== 7) throw new Error('Placa inválida');

    // A maioria das APIs de placa gratuitas são instáveis ou foram desativadas por segurança (LGPD).
    // O sistema tenta uma fetch genérica simulada; se falhar (o que ocorrerá no modo free sem chave), 
    // forçamos o fallback para preenchimento manual no Catch da UI, conforme regra de negócios.
    try {
      const response = await fetch(`https://wdapi2.com.br/consulta/${cleanPlate}`, {
        headers: { 'Accept': 'application/json' }
      });
      if (!response.ok) throw new Error('Não encontrado');
      return await response.json();
    } catch (e) {
      throw new Error('Consulta de placa offline ou bloqueada. Preencha manualmente.');
    }
  }
};
