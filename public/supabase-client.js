// Supabase Client - Shared across all pages
const SUPABASE_URL = 'https://osepakcivrpkqxmarbxu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9zZXBha2NpdnJwa3F4bWFyYnh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4NzAxODcsImV4cCI6MjA4MTQ0NjE4N30.j7Kql1BkXVVdG5lP_Uk5DUTRcwppuE_gePFKklZOLKk';

// Wait for Supabase library to load, then initialize
if (typeof supabase === 'undefined') {
    console.error('Supabase library not loaded! Make sure to include the CDN script before this file.');
}

// Initialize Supabase client using the global supabase object from CDN
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helper function to get current user
async function getCurrentUser() {
  const { data: { user }, error } = await supabaseClient.auth.getUser();
  if (error) {
    console.error('Error getting user:', error);
    return null;
  }
  return user;
}

// Helper function to sign out
async function signOut() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    console.error('Error signing out:', error);
    return false;
  }
  return true;
}
