import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

interface BusinessInfo {
  name: string;
  tradeName?: string;
  doc?: string;
  address?: string;
  contact?: string;
  logo?: string;
}

export const generateProfessionalReport = (
  title: string,
  business: BusinessInfo,
  sections: { title: string; headers: string[]; body: any[][] }[],
  isPreliminary: boolean = false
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // 1. Executive Header
  doc.setFillColor(31, 41, 55); // Gray-800
  doc.rect(0, 0, pageWidth, 50, 'F');
  
  // Logo placeholder or actual logo
  if (business.logo) {
    try {
      doc.addImage(business.logo, 'PNG', 14, 10, 30, 30);
    } catch (e) {
      console.error("Error adding logo to PDF:", e);
    }
  } else {
    // Fallback: Professional initials block
    doc.setFillColor(79, 70, 229); // Indigo-600
    doc.roundedRect(14, 10, 30, 30, 5, 5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(business.tradeName?.[0] || business.name[0], 29, 30, { align: 'center' });
  }

  // Title & Metadata
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18); // Reduced from 22 to avoid overlap
  doc.setFont('helvetica', 'bold');
  const titleX = 50;
  const maxTitleWidth = pageWidth - 110; // Margin to avoid overlap with right-aligned info
  
  const displayTitle = isPreliminary ? `[PRÉ-DIAGNÓSTICO] ${title}` : title;
  const splitTitle = doc.splitTextToSize(displayTitle, maxTitleWidth);
  doc.text(splitTitle, titleX, 22);
  
  if (isPreliminary) {
    doc.setFillColor(234, 179, 8); // Yellow-500
    doc.roundedRect(titleX, 24, 60, 6, 1, 1, 'F');
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(8);
    doc.text("ORÇAMENTO PRELIMINAR - IA", titleX + 30, 28, { align: 'center' });
  }
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(156, 163, 175); // Gray-400
  doc.text(`RELATÓRIO DE INTELIGÊNCIA EMPRESARIAL`, titleX, 32);
  doc.text(`EMITIDO EM: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, titleX, 38);

  // Business Details (Right Aligned)
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(business.name.toUpperCase(), pageWidth - 14, 22, { align: 'right' });
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(209, 213, 219); // Gray-300
  if (business.tradeName && business.tradeName !== business.name) {
    doc.text(business.tradeName, pageWidth - 14, 28, { align: 'right' });
  }
  if (business.doc) doc.text(business.doc, pageWidth - 14, 33, { align: 'right' });
  
  doc.setFontSize(8);
  if (business.address) doc.text(business.address, pageWidth - 14, 39, { align: 'right' });
  if (business.contact) doc.text(business.contact, pageWidth - 14, 44, { align: 'right' });

  // 2. Sections
  let currentY = 55;

  sections.forEach((section, index) => {
    const isCustomerSection = section.title === 'Informações do Cliente e Veículo';
    
    if (isCustomerSection) {
      // Specialized compact rendering for Customer Info
      doc.setTextColor(31, 41, 55);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(section.title.toUpperCase(), 14, currentY);
      
      autoTable(doc, {
        startY: currentY + 2,
        body: section.body,
        theme: 'plain',
        margin: { left: 14, right: 14 },
        styles: { fontSize: 7, cellPadding: 1, fontStyle: 'normal' },
        columnStyles: { 
          0: { cellWidth: 30, fontStyle: 'bold', textColor: [100, 100, 100] },
          1: { cellWidth: 'auto' }
        }
      });
      
      currentY = (doc as any).lastAutoTable.finalY + 10;
    } else {
      // Standard Section Rendering
      doc.setTextColor(31, 41, 55);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`${section.title}`, 14, currentY);
      
      autoTable(doc, {
        startY: currentY + 4,
        head: [section.headers],
        body: section.body,
        theme: 'striped',
        headStyles: { 
          fillColor: [79, 70, 229], 
          textColor: [255, 255, 255], 
          fontStyle: 'bold',
          halign: 'left'
        },
        alternateRowStyles: { fillColor: [249, 250, 251] },
        margin: { left: 14, right: 14 },
        styles: { fontSize: 9, cellPadding: 4 }
      });
      
      currentY = (doc as any).lastAutoTable.finalY + 15;
    }
  });

  // 3. Preliminary Disclaimer & Nudge
  if (isPreliminary) {
    if (currentY > 240) {
      doc.addPage();
      currentY = 20;
    }
    
    doc.setFillColor(254, 243, 199); // Amber-100
    doc.setDrawColor(251, 191, 36); // Amber-400
    doc.roundedRect(14, currentY, pageWidth - 28, 30, 3, 3, 'FD');
    
    doc.setTextColor(146, 64, 14); // Amber-900
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text("ATENÇÃO: ESTE É UM ORÇAMENTO INICIAL GERADO POR IA", pageWidth / 2, currentY + 10, { align: 'center' });
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const msg = "Os valores e peças acima são baseados em análise técnica preliminar. É INDISPENSÁVEL a avaliação física de um mecânico certificado para validar o diagnóstico e os valores finais. Sugerimos agendar uma visita para garantir a segurança e eficiência do reparo.";
    const splitMsg = doc.splitTextToSize(msg, pageWidth - 40);
    doc.text(splitMsg, 20, currentY + 18);
    
    currentY += 40;
    
    // Scheduling Nudge
    doc.setFillColor(79, 70, 229); // Indigo-600
    doc.roundedRect(pageWidth / 2 - 40, currentY, 80, 10, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text("AGENDAR VISITA AGORA", pageWidth / 2, currentY + 7, { align: 'center' });
  }

  // Footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text(
      'SERVICE HUB PRO - TECNOLOGIA PARA GESTÃO AUTOMOTIVA | DOCUMENTO CONFIDENCIAL',
      pageWidth / 2,
      285,
      { align: 'center' }
    );
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - 14, 285, { align: 'right' });
  }
  
  const filename = `${title.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`;
  doc.save(filename);
};
