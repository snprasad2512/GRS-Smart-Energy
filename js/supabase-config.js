// GRS Smart Energy Monitoring System - Supabase Configuration
// Configured with active project credentials

export const SUPABASE_CONFIG = {
    // Supabase Project URL
    url: "https://lvogfmwtecpknjepbrbn.supabase.co",

    // Supabase Anon / Publishable API Key
    anonKey: "sb_publishable_mh1g6Sn2L5_mul3-81lz4A_eDxjj9Xi"
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
