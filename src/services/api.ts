/**
 * PostgreSQL Backend API Service for Meu Controle Financeiro
 */

export interface DbSyncPayload {
  userId: string;
  salaries?: any[];
  incomes?: any[];
  massoterapia?: any[];
  expenses?: any[];
  creditCards?: any[];
  paymentMethods?: any[];
  installmentPurchases?: any[];
  categories?: any[];
  budgets?: any[];
  abatimentos?: any[];
  settings?: any;
}

export const CLOUD_RUN_URL = typeof window !== 'undefined' && !window.location.hostname.includes('netlify.app')
  ? window.location.origin
  : '';

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

export async function deleteEntityFromPostgres(table: string, id: string, userId: string, idToken?: string) {
  try {
    const headers: Record<string, string> = {};
    if (idToken) {
      headers['Authorization'] = `Bearer ${idToken}`;
    }

    const res = await resilientFetch(`/api/entity/${encodeURIComponent(table)}/${encodeURIComponent(id)}?userId=${encodeURIComponent(userId)}`, {
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

export async function fetchMassoterapiaFromPostgres(userId: string, mes?: string, idToken?: string) {
  try {
    const headers: Record<string, string> = {};
    if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
    const params = new URLSearchParams({ userId });
    if (mes) params.set('mes', mes);
    const res = await resilientFetch(`/api/renda-massoterapia?${params.toString()}`, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return json.data || [];
  } catch (error) {
    console.warn('Aviso ao buscar massoterapia no PostgreSQL:', error);
    return [];
  }
}

export async function saveMassoterapiaToPostgres(item: any, userId: string, idToken?: string) {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
    const res = await resilientFetch('/api/renda-massoterapia', {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...item, userId }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (error) {
    console.warn('Aviso ao salvar massoterapia no PostgreSQL:', error);
    return null;
  }
}

export async function deleteMassoterapiaFromPostgres(id: string, userId: string, idToken?: string) {
  try {
    const headers: Record<string, string> = {};
    if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
    const res = await resilientFetch(`/api/renda-massoterapia/${encodeURIComponent(id)}?userId=${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      headers,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (error) {
    console.warn('Aviso ao excluir massoterapia no PostgreSQL:', error);
    return null;
  }
}

export async function deleteMultipleMassoterapiaFromPostgres(ids: string[], userId: string, idToken?: string) {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
    const res = await resilientFetch('/api/renda-massoterapia/bulk-delete', {
      method: 'POST',
      headers,
      body: JSON.stringify({ userId, ids }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (error) {
    console.warn('Aviso ao excluir múltiplos atendimentos no PostgreSQL:', error);
    return null;
  }
}

// Buscar dados de lançamentos no banco de dados (salvo pelo Sistema de Gestão de Pessoas de Massoterapia - Sessões Avulsas)
export async function fetchDatabaseSessions(userId: string, mesReferencia?: string, idToken?: string) {
  try {
    const headers: Record<string, string> = {};
    if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
    const params = new URLSearchParams({ userId });
    if (mesReferencia) params.set('mesReferencia', mesReferencia);

    const res = await resilientFetch(`/api/renda-massoterapia/database-sessions?${params.toString()}`, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (error) {
    console.warn('Aviso ao buscar lançamentos no banco de dados:', error);
    return { success: false, sessions: [], totalCount: 0, error: String(error) };
  }
}

// Importar sessões selecionadas do banco de dados para o sistema financeiro
export async function importDatabaseSessions(sessions: any[], userId: string, idToken?: string) {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
    const res = await resilientFetch('/api/renda-massoterapia/import-database-sessions', {
      method: 'POST',
      headers,
      body: JSON.stringify({ userId, sessions }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (error) {
    console.warn('Aviso ao importar sessões no PostgreSQL:', error);
    return { success: false, count: 0, error: String(error) };
  }
}

// Criar lançamento de Sessão Avulsa diretamente no banco (Simulação / Teste do formulário da tela Print 02)
export async function createGestaoSessionInDatabase(sessionData: any, userId: string, idToken?: string) {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
    const res = await resilientFetch('/api/renda-massoterapia/create-gestao-session', {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...sessionData, userId }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (error) {
    console.warn('Aviso ao registrar sessão avulsa:', error);
    return { success: false, error: String(error) };
  }
}

// Importar automaticamente os lançamentos de sessões avulsas existentes no banco de Gestão de Pessoas para o fluxo de receitas financeiras
export async function autoImportDatabaseSessions(userId: string, idToken?: string) {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
    const res = await resilientFetch('/api/renda-massoterapia/auto-import', {
      method: 'POST',
      headers,
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (error) {
    console.warn('Aviso ao executar importação automática do banco de gestão:', error);
    return { success: false, count: 0, totalAmount: 0, error: String(error) };
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


