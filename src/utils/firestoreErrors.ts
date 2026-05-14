import { auth } from '../firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null, details?: string) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path
  };
  
  console.error('Firestore Error:', errInfo);
  
  const userMsg = `Usuário: ${errInfo.authInfo.userId || 'N/A'}`;
  const filterMsg = `\nFiltro: ${details || 'Nenhum'}`;
  const contextMsg = `\nLocal: ${operationType} em ${path}`;
  
  // ALERTA MÁSTIER PARA DIAGNÓSTICO
  alert(`⚠️ ERRO DE BANCO DE DADOS\n${errInfo.error}\n\n${userMsg}${filterMsg}${contextMsg}`);
}
