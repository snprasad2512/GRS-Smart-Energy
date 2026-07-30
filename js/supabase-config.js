// GRS Smart Energy Monitoring System - Supabase Configuration
// Configured with active project credentials

// Detect if running on localhost / dev environment
const isLocalhost = window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1' || 
                    window.location.hostname.startsWith('192.168.');

export const SUPABASE_CONFIG = isLocalhost ? {
    // Development / Local Testing Supabase Project
    url: "https://rdgtplphyxfdetkopnho.supabase.co",
    anonKey: "sb_publishable_Jna5576RDGbL8lJZMxi1QA_7VnCLH5l"
} : {
    // Production Supabase Project
    url: "https://biffdmqmyxomosdjlguc.supabase.co",
    anonKey: "sb_publishable_Djj_l8Js-pd5bJYXmp170Q_3SaYQZiy"
};

/**
 * Checks if Supabase credentials have been properly populated
 */
export function isSupabaseConfigured() {
    return Boolean(
        SUPABASE_CONFIG.url &&
        SUPABASE_CONFIG.url.trim() !== "" &&
        !SUPABASE_CONFIG.url.includes("YOUR_SUPABASE_PROJECT_URL") &&
        SUPABASE_CONFIG.anonKey &&
        SUPABASE_CONFIG.anonKey.trim() !== "" &&
        !SUPABASE_CONFIG.anonKey.includes("YOUR_SUPABASE_ANON_KEY")
    );
}
