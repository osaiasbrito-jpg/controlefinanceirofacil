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
  settings?: any;
}

export async function syncUserWithPostgres(user: { uid: string; email?: string | null; displayName?: string | null; photoURL?: string | null }, idToken?: string) {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (idToken) {
      headers['Authorization'] = `Bearer ${idToken}`;
    }

    const res = await fetch('/api/auth/sync-user', {
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
    console.error('Error syncing user with PostgreSQL:', error);
    return null;
  }
}

export async function loadUserDataFromPostgres(userId: string, idToken?: string) {
  try {
    const headers: Record<string, string> = {};
    if (idToken) {
      headers['Authorization'] = `Bearer ${idToken}`;
    }

    const res = await fetch(`/api/data?userId=${encodeURIComponent(userId)}`, {
      method: 'GET',
      headers,
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const json = await res.json();
    return json.data;
  } catch (error) {
    console.error('Error loading data from PostgreSQL:', error);
    return null;
  }
}

export async function syncDataToPostgres(payload: DbSyncPayload, idToken?: string) {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (idToken) {
      headers['Authorization'] = `Bearer ${idToken}`;
    }

    const res = await fetch('/api/sync', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    return await res.json();
  } catch (error) {
    console.error('Error syncing data to PostgreSQL:', error);
    return null;
  }
}

export async function deleteEntityFromPostgres(table: string, id: string, userId: string, idToken?: string) {
  try {
    const headers: Record<string, string> = {};
    if (idToken) {
      headers['Authorization'] = `Bearer ${idToken}`;
    }

    const res = await fetch(`/api/entity/${encodeURIComponent(table)}/${encodeURIComponent(id)}?userId=${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      headers,
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    return await res.json();
  } catch (error) {
    console.error(`Error deleting ${table} #${id} from PostgreSQL:`, error);
    return null;
  }
}

export async function superuserLogin(password: string) {
  try {
    const res = await fetch('/api/auth/superuser-login', {
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
    const res = await fetch('/api/health/db');
    return await res.json();
  } catch (error: any) {
    return { status: 'error', error: error.message };
  }
}
