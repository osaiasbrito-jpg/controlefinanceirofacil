/**
 * PostgreSQL Backend API Service for Meu Controle Financeiro
 */

export interface DbSyncPayload {
  userId: string;
  salaries?: any[];
  incomes?: any[];
  expenses?: any[];
  creditCards?: any[];
  paymentMethods?: any[];
  installmentPurchases?: any[];
  categories?: any[];
  budgets?: any[];
  abatimentos?: any[];
  settings?: any;
}

export const CLOUD_RUN_URL = typeof window !== 'undefined'
  ? (window.location.hostname.includes('netlify.app')
      ? 'https://ais-pre-ca2j6yzl6qm4otgueyocuu-440149738355.us-east1.run.app'
      : window.location.origin)
  : 'https://ais-pre-ca2j6yzl6qm4otgueyocuu-440149738355.us-east1.run.app';

/**
 * Executa fetch resiliente:
 * Se o host atual for Netlify ou se a resposta for HTML (fallback SPA estático do Netlify),
 * tenta caminhos relativos e URLs de serviço disponíveis de forma segura.
 */
async function resilientFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const targetUrls: string[] = [];

  if (path.startsWith('http')) {
    targetUrls.push(path);
  } else {
    targetUrls.push(path);
    if (currentOrigin) {
      targetUrls.push(`${currentOrigin}${path}`);
    }
    if (CLOUD_RUN_URL && CLOUD_RUN_URL !== currentOrigin) {
      targetUrls.push(`${CLOUD_RUN_URL}${path}`);
    }
  }

  let lastError: any = null;
  for (const url of targetUrls) {
    try {
      const res = await fetch(url, options);
      const contentType = res.headers.get('content-type') || '';
      // Se retornou HTML mas a requisição espera API/JSON (ex: fallback SPA no Netlify), ignora
      if (contentType.includes('text/html') && (url.startsWith('/') || url.includes('netlify.app'))) {
        continue;
      }
      if (res.ok || res.status < 500) {
        return res;
      }
      lastError = new Error(`HTTP ${res.status}: ${res.statusText}`);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error(`Falha ao conectar com o serviço em ${path}`);
}

export async function syncUserWithPostgres(user: { uid: string; email?: string | null; displayName?: string | null; photoURL?: string | null }, idToken?: string) {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (idToken) {
      headers['Authorization'] = `Bearer ${idToken}`;
    }

    const res = await resilientFetch('/api/auth/sync-user', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        uid: user.uid,
        email: user.email || 'usuario@meucontrole.app',
        name: user.displayName || '',
        photoUrl: user.photoURL || '',
      }),
    });

    if (!res.ok) {
      console.warn('Sync user status:', res.status);
    }
    return await res.json();
  } catch (error) {
    console.warn('Aviso ao sincronizar usuário com PostgreSQL:', error);
    return null;
  }
}

export async function loadUserDataFromPostgres(userId: string, idToken?: string, email?: string) {
  try {
    const headers: Record<string, string> = {};
    if (idToken) {
      headers['Authorization'] = `Bearer ${idToken}`;
    }

    const params = new URLSearchParams();
    if (userId) params.set('userId', userId);
    if (email) params.set('email', email);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const res = await resilientFetch(`/api/data?${params.toString()}`, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const json = await res.json();
    return json.data;
  } catch (error) {
    console.warn('Aviso ao carregar dados do PostgreSQL:', error);
    return null;
  }
}

export async function syncDataToPostgres(payload: DbSyncPayload, idToken?: string) {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (idToken) {
      headers['Authorization'] = `Bearer ${idToken}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    const res = await resilientFetch('/api/sync', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    return await res.json();
  } catch (error) {
    // Sincronização em segundo plano: falhas de rede transitórias ou durante recargas não devem poluir o console
    return null;
  }
}

export async function deleteEntityFromPostgres(
  table: string,
  id: string,
  userId: string,
  idToken?: string,
  options?: { deleteFuture?: boolean; deleteAll?: boolean; email?: string }
) {
  try {
    const headers: Record<string, string> = {};
    if (idToken) {
      headers['Authorization'] = `Bearer ${idToken}`;
    }

    const params = new URLSearchParams();
    params.set('userId', userId);
    if (userId.includes('@')) {
      params.set('email', userId);
    }
    if (options?.email) {
      params.set('email', options.email);
    }
    if (options?.deleteFuture) params.set('deleteFuture', 'true');
    if (options?.deleteAll) params.set('deleteAll', 'true');

    const res = await resilientFetch(`/api/entity/${encodeURIComponent(table)}/${encodeURIComponent(id)}?${params.toString()}`, {
      method: 'DELETE',
      headers,
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    return await res.json();
  } catch (error) {
    console.warn(`Aviso ao deletar ${table} #${id} do PostgreSQL:`, error);
    return null;
  }
}

export async function updateExpenseInPostgres(id: string, data: Record<string, any>, idToken?: string) {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (idToken) {
      headers['Authorization'] = `Bearer ${idToken}`;
    }

    const res = await resilientFetch(`/api/expenses/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    return await res.json();
  } catch (error) {
    console.warn(`Aviso ao atualizar despesa #${id} no PostgreSQL:`, error);
    return null;
  }
}

export async function updateMultipleExpensesStatusInPostgres(ids: string[], status: 'PAGA' | 'PENDENTE', idToken?: string) {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (idToken) {
      headers['Authorization'] = `Bearer ${idToken}`;
    }

    const res = await resilientFetch('/api/expenses/bulk-status', {
      method: 'POST',
      headers,
      body: JSON.stringify({ ids, status }),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    return await res.json();
  } catch (error) {
    console.warn('Aviso ao atualizar status em lote no PostgreSQL:', error);
    return null;
  }
}

export async function superuserLogin(password: string) {
  try {
    const res = await resilientFetch('/api/auth/superuser-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'osaiasbrito@gmail.com',
        password,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Falha no login');
    }
    return await res.json();
  } catch (error: any) {
    console.error('Erro no login de super usuário:', error);
    throw error;
  }
}

export async function checkPostgresHealth() {
  try {
    const res = await resilientFetch('/api/health/db');
    return await res.json();
  } catch (error: any) {
    return { status: 'error', error: error.message };
  }
}

// Salvar / atualizar Abatimento de Pagamento no PostgreSQL
export async function saveAbatimentoToPostgres(data: any, userId: string, idToken?: string) {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
    const res = await resilientFetch('/api/abatimentos', {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...data, userId }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (error) {
    console.warn('Aviso ao salvar abatimento no PostgreSQL:', error);
    return null;
  }
}

// Excluir Abatimento de Pagamento no PostgreSQL
export async function deleteAbatimentoFromPostgres(id: string, userId: string, idToken?: string) {
  try {
    const headers: Record<string, string> = {};
    if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
    const res = await resilientFetch(`/api/abatimentos/${id}?userId=${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      headers,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (error) {
    console.warn('Aviso ao excluir abatimento no PostgreSQL:', error);
    return null;
  }
}

import { AiQuickQueryParams } from '../types';

// Consultar Assistente Financeiro com Inteligência Artificial Gemini
export async function queryFinancialAssistant(payload: AiQuickQueryParams) {
  try {
    const res = await resilientFetch('/api/gemini/quick-query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Erro HTTP ${res.status}`);
    }
    const data = await res.json();
    return data;
  } catch (error: any) {
    console.error('Erro ao consultar I.A Financeira:', error);
    throw error;
  }
}



