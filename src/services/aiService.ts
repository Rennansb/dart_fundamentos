import { db } from "../firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export function checkAiAvailability() {
  return true; // Now handled by server fallback
}

// Helper to log AI usage (Local estimate)
async function logAIUsage(_userId: string, _companyId: string, _type: string) {
  // Logic moved mostly to server, but keeping signature for compatibility
}

async function callServerAI(endpoint: string, data: any) {
    const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Erro na IA: ${response.status}`);
    }

    return await response.json();
}

/**
 * Business Health Analysis
 */
export async function analyzeBusinessHealth(data: any, userId: string, companyId: string) {
    try {
        const result = await callServerAI("/api/ai/analyze-health", { data, userId, companyId });
        return result.analysis;
    } catch (error) {
        console.error("AI Business Health Error:", error);
        return generateLocalBusinessReport(data); // Fallback to local logic if server fails
    }
}

/**
 * Technical Assistant & Repair Tips
 */
export async function getRepairTips(vehicleInfo: string, items: string[], comments: string[], _userId: string, _companyId: string) {
    try {
        const symptoms = `Itens: ${items.join(', ')}. Notas: ${comments.join(' | ')}`;
        const result = await callServerAI("/api/ai/technical-help", { vehicleInfo, symptoms });
        return result.response;
    } catch (error: any) {
        console.error("AI Technical Help Error:", error);
        return generateLocalTechnicalReport(vehicleInfo, items, comments, error.message);
    }
}

/**
 * Local Fallback Technical Report
 */
export function generateLocalTechnicalReport(vehicleInfo: string, items: string[], comments: string[], technicalError?: string) {
    let report = `## 🛠️ Diagnóstico de Contingência (Offline)\n\n`;
    
    if (technicalError) {
        report += `> 🛑 **Erro Técnico da IA:** \`${technicalError}\`\n\n`;
    }

    report += `Identificamos que você está trabalhando em um **${vehicleInfo || 'veículo'}**.\n\n`;
    report += `### 📋 Itens Analisados:\n`;
    items.forEach(item => {
        report += `- ${item}\n`;
    });
    
    report += `\n### 📝 Notas do Técnico:\n`;
    comments.forEach(note => {
        report += `> "${note}"\n`;
    });

    report += `\n---\n⚠️ **Aviso:** Não conseguimos conectar com o Mestre Mecânico em tempo real. As informações acima são um resumo dos dados registrados na OS. Por favor, verifique a conexão do servidor para um diagnóstico avançado com IA.`;
    
    return report;
}

/**
 * AI Diagnosis (Multimodal)
 */
export async function performAiDiagnosis(data: {
    message?: string;
    images?: string[];
    audioTranscript?: string;
    vehicleInfo?: string;
}) {
    const result = await callServerAI("/api/ai/diagnose", data);
    return result;
}

/**
 * Part Cataloging & Category Suggestion
 */
export async function getPartSuggestions(partName: string, _userId: string, _companyId: string) {
    try {
        const result = await callServerAI("/api/ai/assistant", { 
            message: `Qual a categoria ideal para a peça "${partName}"? Responda apenas o nome da categoria.`,
            role: 'GENERAL' 
        });
        return result.response.trim();
    } catch (error) {
        return "Outros";
    }
}

/**
 * AI Image Suggestion for Parts
 */
export async function getPartImageSuggestion(partName: string, category: string, _userId: string, _companyId: string) {
    try {
        const result = await callServerAI("/api/ai/assistant", { 
            message: `Sugira um link de imagem (URL pública) de alta qualidade do Unsplash ou similar para uma peça do tipo "${partName}" da categoria "${category}". Retorne APENAS a URL. Se não conseguir uma URL real, retorne "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?q=80&w=800&auto=format&fit=crop"`,
            role: 'GENERAL' 
        });
        const url = result.response.trim();
        return url.startsWith('http') ? url : "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?q=80&w=800&auto=format&fit=crop";
    } catch (error) {
        return "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?q=80&w=800&auto=format&fit=crop";
    }
}

/**
 * Average Price Search
 */
export async function getAveragePrice(partName: string, cep: string, vehicleInfo: string, _userId: string, _companyId: string) {
    try {
        const result = await callServerAI("/api/ai/assistant", { 
            message: `Preço médio de "${partName}" para "${vehicleInfo}" no CEP ${cep}. Responda apenas o número.`,
            role: 'PRICE_CONSULTANT' 
        });
        return parseFloat(result.response.replace(/[^0-9.]/g, '') || "0");
    } catch (error) {
        return 0;
    }
}

/**
 * AI Labor/Service Suggestions based on parts
 */
export async function getLaborSuggestions(parts: any[], vehicleInfo: string, _availableServices: any[], _userId: string, _companyId: string) {
    try {
        const partNames = parts.map(p => p.name).join(', ');
        const message = `Com base nestas peças: [${partNames}] para o veículo "${vehicleInfo}", sugira os serviços de mão de obra necessários. 
        Retorne um array JSON de objetos: [{"serviceName": "string", "price": number, "foundMatch": boolean}]. 
        Considere preços de mercado no Brasil.`;

        const result = await callServerAI("/api/ai/assistant", { 
            message,
            jsonMode: true,
            role: 'MASTER_MECHANIC' 
        });

        // The server might return the array directly or inside a property
        return Array.isArray(result.response) ? result.response : (result.response.services || []);
    } catch (error) {
        console.error("Labor Suggestion Error:", error);
        return [];
    }
}

/**
 * Revenue and Financial Analysis
 */
export async function analyzeFinancialPerformance(transactions: any[], period: string, userId: string, companyId: string) {
    return analyzeBusinessHealth({ transactions: transactions.slice(0, 50), period }, userId, companyId);
}

/**
 * Vision: Identify Part
 */
export async function identifyPartFromImage(base64Image: string, userId: string, companyId: string) {
    return performAiDiagnosis({ 
        message: "Identifique esta peça e sugira dados para estoque.", 
        images: [base64Image] 
    });
}

/**
 * Vision: Recognize Plate
 */
export async function recognizePlate(base64Image: string, _userId: string, _companyId: string) {
    const result = await callServerAI("/api/ai/diagnose", { 
        message: "Extraia os dados da placa desta imagem em JSON: {plate, brand, model, year, color}", 
        images: [base64Image] 
    });
    return result;
}

/**
 * Local Fallback Report
 */
export function generateLocalBusinessReport(data: any) {
  const marginStr = (data.profitMargin || 0).toFixed(1);
  const revenueStr = (data.totalRevenue || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  
  let diagnosis = `## 📊 Diagnóstico Técnico (Local)\n\n`;
  diagnosis += `### 💰 Visão Financeira\n`;
  diagnosis += `*   **Margem de Lucro:** ${marginStr}%\n`;
  diagnosis += `*   **Receita Total:** ${revenueStr}\n\n`;

  if (data.profitMargin < 15) {
    diagnosis += `⚠️ **Dica:** Margem baixa. Revise seus custos operacionais.\n\n`;
  }
  
  diagnosis += `--- \n*Nota: Este diagnóstico foi gerado via análise de conformidade local. Conecte-se à internet para um relatório de profundidade máxima do Agente.*`;
  
  return diagnosis;
}
