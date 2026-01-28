// TabTab Supabase Client - Anonymous Auth
// Handles authentication and preference sync

const SupabaseClient = {
  SESSION_KEY: 'tabtab_supabase_session',
  
  // Get session from local storage
  async getSession() {
    return new Promise((resolve) => {
      chrome.storage.local.get([this.SESSION_KEY], (result) => {
        const session = result[this.SESSION_KEY];
        if (session && session.access_token) {
          // Check if expired
          if (session.expires_at && Date.now() / 1000 > session.expires_at) {
            resolve(null);
          } else {
            resolve(session);
          }
        } else {
          resolve(null);
        }
      });
    });
  },
  
  // Save session to local storage
  async saveSession(session) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [this.SESSION_KEY]: session }, resolve);
    });
  },
  
  // Clear session
  async clearSession() {
    return new Promise((resolve) => {
      chrome.storage.local.remove([this.SESSION_KEY], resolve);
    });
  },
  
  // Get current user
  async getUser() {
    const session = await this.getSession();
    return session?.user || null;
  },
  
  // Sign in anonymously
  async signInAnonymously() {
    try {
      // Check if already signed in
      const existingSession = await this.getSession();
      if (existingSession?.user) {
        console.log('[TabTab Supabase] Already signed in:', existingSession.user.id);
        return { user: existingSession.user, error: null };
      }
      
      console.log('[TabTab Supabase] Signing in anonymously...');
      
      const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY
        },
        body: JSON.stringify({})
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Auth failed: ${response.status} - ${error}`);
      }
      
      const data = await response.json();
      
      if (!data.access_token) {
        throw new Error('No access token received');
      }
      
      const session = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: data.expires_at,
        user: {
          id: data.user.id,
          is_anonymous: data.user.is_anonymous
        }
      };
      
      await this.saveSession(session);
      console.log('[TabTab Supabase] Signed in anonymously:', session.user.id);
      
      return { user: session.user, error: null };
      
    } catch (error) {
      console.error('[TabTab Supabase] Sign in error:', error);
      return { user: null, error: error.message };
    }
  },
  
  // Ensure user is signed in (auto sign-in if not)
  async ensureSignedIn() {
    const user = await this.getUser();
    if (user) {
      return { user, error: null };
    }
    return await this.signInAnonymously();
  },
  
  // Make authenticated request
  async request(endpoint, options = {}) {
    const session = await this.getSession();
    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }
    
    const response = await fetch(`${SUPABASE_URL}/rest/v1${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
        ...options.headers
      }
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Request failed: ${response.status} - ${error}`);
    }
    
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  },
  
  // Get preferences from Supabase
  async getPreferences() {
    try {
      const { user, error: authError } = await this.ensureSignedIn();
      if (authError || !user) {
        return { preferences: null, error: authError || 'Not authenticated' };
      }
      
      const data = await this.request(`/user_preferences?user_id=eq.${user.id}&select=*`);
      
      if (data && data.length > 0) {
        return { preferences: data[0], error: null };
      }
      
      // No preferences yet
      return { preferences: null, error: null };
      
    } catch (error) {
      console.error('[TabTab Supabase] Get preferences error:', error);
      return { preferences: null, error: error.message };
    }
  },
  
  // Save preferences to Supabase (upsert)
  async savePreferences(preferences) {
    try {
      const { user, error: authError } = await this.ensureSignedIn();
      if (authError || !user) {
        return { error: authError || 'Not authenticated' };
      }
      
      // First check if preferences exist
      const existing = await this.request(`/user_preferences?user_id=eq.${user.id}&select=id`);
      
      if (existing && existing.length > 0) {
        // Update existing
        await this.request(`/user_preferences?user_id=eq.${user.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            enabled: preferences.enabled,
            custom_tones: preferences.custom_tones || {},
            suggestion_length: preferences.suggestion_length || 'short',
            updated_at: new Date().toISOString()
          })
        });
      } else {
        // Insert new
        await this.request('/user_preferences', {
          method: 'POST',
          body: JSON.stringify({
            user_id: user.id,
            enabled: preferences.enabled,
            custom_tones: preferences.custom_tones || {},
            suggestion_length: preferences.suggestion_length || 'short',
            updated_at: new Date().toISOString()
          })
        });
      }
      
      console.log('[TabTab Supabase] Preferences saved');
      return { error: null };
      
    } catch (error) {
      console.error('[TabTab Supabase] Save preferences error:', error);
      return { error: error.message };
    }
  }
};
