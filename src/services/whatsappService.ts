export const whatsappService = {
  formatPhone(phone: string) {
    return phone.replace(/\D/g, '');
  },

  send(phone: string, text: string) {
    const cleanPhone = this.formatPhone(phone);
    if (!cleanPhone) return;
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  },

  sendStatusUpdate(phone: string, customerName: string, vehicle: string, status: string) {
    const text = `Olá ${customerName}! 🚗\n\nInformativo Service Hub: O status do reparo do seu veículo *${vehicle}* foi atualizado para: *${status}*.\n\nQualquer dúvida, estamos à disposição!`;
    this.send(phone, text);
  },

  sendGmbReview(phone: string, customerName: string, gmbLink: string) {
    if (!gmbLink) return;
    const text = `Olá ${customerName}! 👋\n\nFicamos muito felizes em cuidar do seu veículo! Poderia nos avaliar no Google? Isso nos ajuda muito! ⭐\n\nLink direto: ${gmbLink}\n\nObrigado pela confiança!`;
    this.send(phone, text);
  },

  sendMaintenanceAlert(phone: string, customerName: string, vehicle: string) {
    const text = `Olá ${customerName}! 🛠️\n\nNotamos que faz cerca de 6 meses desde a sua última manutenção no *${vehicle}*. Que tal agendar uma revisão preventiva para manter a segurança?\n\nResponda esta mensagem para agendar!`;
    this.send(phone, text);
  }
};
