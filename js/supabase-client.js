// GRS Smart Energy Monitoring System - Supabase Client Integration
import { SUPABASE_CONFIG, isSupabaseConfigured } from './supabase-config.js';

let supabaseClient = null;

if (isSupabaseConfigured() && window.supabase) {
    supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
    console.log("⚡ Supabase Client Initialized Successfully!");
} else {
    console.log("ℹ️ Supabase not configured or CDN script missing. Running in LocalStorage Fallback Mode.");
}

export { supabaseClient, isSupabaseConfigured };

export const supabaseApi = {
    // ------------------------------------------------------------------------
    // AUTH & PROFILES API
    // ------------------------------------------------------------------------
    async signIn(email, password) {
        if (!supabaseClient) throw new Error("Supabase client is not configured.");
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        
        // Fetch matching profile
        let { data: profile, error: profileErr } = await supabaseClient
            .from('profiles')
            .select('*, user_location_assignments(location_id), user_meter_assignments(meter_id)')
            .eq('id', data.user.id)
            .maybeSingle();
            
        if (profileErr) throw profileErr;
        
        // Self-heal: Create profile record if it is missing
        if (!profile) {
            const roleGuess = email.toLowerCase().includes('admin') ? 'ADMIN' : 
                              email.toLowerCase().includes('manager') ? 'MANAGER' : 
                              email.toLowerCase().includes('supervisor') ? 'SUPERVISOR' : 'TECHNICIAN';
            
            const newProfile = {
                id: data.user.id,
                email: email,
                full_name: email.split('@')[0],
                role: roleGuess,
                active: true
            };
            
            const { data: inserted, error: insertErr } = await supabaseClient
                .from('profiles')
                .insert(newProfile)
                .select()
                .single();
                
            if (insertErr) throw insertErr;
            profile = inserted;
            profile.user_location_assignments = [];
            profile.user_meter_assignments = [];
        }
        
        // Map assignments to flat array
        profile.assignedLocations = (profile.user_location_assignments || []).map(a => a.location_id);
        profile.assignedMeters = (profile.user_meter_assignments || []).map(a => a.meter_id);
        
        return { user: data.user, profile };
    },

    async signUpUser(email, password, fullName, role = 'TECHNICIAN') {
        if (!supabaseClient) throw new Error("Supabase client is not configured.");
        
        // Create a temporary client that does not persist session so it doesn't alter the logged-in Admin's session
        const tempClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false
            }
        });
        
        const { data, error } = await tempClient.auth.signUp({
            email,
            password,
            options: {
                data: { full_name: fullName, role: role }
            }
        });
        if (error) throw error;
        return data;
    },

    async signOut() {
        if (!supabaseClient) return;
        await supabaseClient.auth.signOut();
    },

    async getProfiles() {
        if (!supabaseClient) return [];
        const { data, error } = await supabaseClient
            .from('profiles')
            .select('*, user_location_assignments(location_id), user_meter_assignments(meter_id)')
            .eq('active', true)
            .order('created_at', { ascending: false });
        if (error) throw error;
        
        // Map assignments flat array
        return (data || []).map(p => ({
            ...p,
            assignedLocations: (p.user_location_assignments || []).map(a => a.location_id),
            assignedMeters: (p.user_meter_assignments || []).map(a => a.meter_id)
        }));
    },

    async deleteProfile(userId) {
        if (!supabaseClient) return false;
        const { error } = await supabaseClient
            .from('profiles')
            .update({ active: false })
            .eq('id', userId);
        if (error) throw error;
        return true;
    },

    // ------------------------------------------------------------------------
    // LOCATIONS API
    // ------------------------------------------------------------------------
    async getLocations() {
        if (!supabaseClient) return [];
        const { data, error } = await supabaseClient
            .from('locations')
            .select('*')
            .eq('active', true)
            .order('name', { ascending: true });
        if (error) throw error;
        return data || [];
    },

    async saveLocation(location) {
        if (!supabaseClient) return null;
        const { data, error } = await supabaseClient
            .from('locations')
            .upsert(location)
            .select();
        if (error) throw error;
        return data[0];
    },

    // ------------------------------------------------------------------------
    // ENERGY METERS API
    // ------------------------------------------------------------------------
    async getEnergyMeters() {
        if (!supabaseClient) return [];
        const { data, error } = await supabaseClient
            .from('energy_meters')
            .select('*, locations(name)')
            .eq('active', true)
            .order('meter_name', { ascending: true });
        if (error) throw error;
        return data || [];
    },

    async saveEnergyMeter(meter) {
        if (!supabaseClient) return null;
        const payload = {
            location_id: meter.locationId || meter.location_id,
            meter_name: meter.name || meter.meter_name,
            meter_number: meter.meter_number || meter.number || 'MTR-' + Date.now().toString().slice(-4),
            active: true
        };
        if (meter.id) {
            payload.id = meter.id;
        }
        
        const { data, error } = await supabaseClient
            .from('energy_meters')
            .upsert(payload)
            .select();
        if (error) throw error;
        return data[0];
    },

    async updateProfile(userId, updateData) {
        if (!supabaseClient) return null;
        const { data, error } = await supabaseClient
            .from('profiles')
            .update(updateData)
            .eq('id', userId)
            .select();
        if (error) throw error;
        return data[0];
    },

    async saveUserAssignments(userId, locationIds, meterIds) {
        if (!supabaseClient) return false;
        
        // Delete location assignments
        const { error: deleteLocErr } = await supabaseClient
            .from('user_location_assignments')
            .delete()
            .eq('user_id', userId);
            
        if (deleteLocErr) throw deleteLocErr;
        
        // Delete meter assignments
        const { error: deleteMtrErr } = await supabaseClient
            .from('user_meter_assignments')
            .delete()
            .eq('user_id', userId);
            
        if (deleteMtrErr) throw deleteMtrErr;
        
        // Insert new location assignments
        if (locationIds && locationIds.length > 0) {
            const inserts = locationIds.map(locId => ({
                user_id: userId,
                location_id: locId
            }));
            const { error: insertErr } = await supabaseClient
                .from('user_location_assignments')
                .insert(inserts);
                
            if (insertErr) throw insertErr;
        }
        
        // Insert new meter assignments
        if (meterIds && meterIds.length > 0) {
            const inserts = meterIds.map(mtrId => ({
                user_id: userId,
                meter_id: mtrId
            }));
            const { error: insertErr } = await supabaseClient
                .from('user_meter_assignments')
                .insert(inserts);
                
            if (insertErr) throw insertErr;
        }
        return true;
    },

    async deleteEnergyMeter(meterId) {
        if (!supabaseClient) return false;
        const { error } = await supabaseClient
            .from('energy_meters')
            .update({ active: false })
            .eq('id', meterId);
        if (error) throw error;
        return true;
    },

    // ------------------------------------------------------------------------
    // METER READINGS API
    // ------------------------------------------------------------------------
    async getMeterReadings() {
        if (!supabaseClient) return [];
        const { data, error } = await supabaseClient
            .from('meter_readings')
            .select(`
                *,
                profiles:technician_id(full_name),
                locations:location_id(name),
                energy_meters:meter_id(meter_name)
            `)
            .order('submitted_at', { ascending: false });
        if (error) throw error;
        
        // Map to client format
        return (data || []).map(r => ({
            id: r.id,
            technicianName: r.profiles?.full_name || 'Technician',
            location: r.locations?.name || 'Location',
            energyMeter: r.energy_meters?.meter_name || 'Meter',
            meterReading: parseFloat(r.reading_value),
            photo: r.photo_url,
            date: r.submitted_at ? r.submitted_at.split('T')[0] : new Date().toISOString().split('T')[0],
            time: r.submitted_at ? r.submitted_at.split('T')[1].split('.')[0] : '00:00:00',
            status: r.status === 'PENDING' ? 'Pending Supervisor Approval' : (r.status === 'APPROVED' ? 'Approved' : 'Rejected'),
            remarks: r.supervisor_remarks || ''
        }));
    },

    async saveMeterReading(reading) {
        if (!supabaseClient) return null;
        
        // Upload photo if base64 Data URL
        let photoUrl = reading.photo;
        if (reading.photo && reading.photo.startsWith('data:image')) {
            photoUrl = await this.uploadMeterPhoto(reading.photo);
        }
        
        const payload = {
            technician_id: reading.technicianId,
            location_id: reading.locationId,
            meter_id: reading.meterId,
            reading_value: reading.meterReading,
            photo_url: photoUrl,
            status: 'PENDING',
            submitted_at: new Date().toISOString()
        };
        
        const { data, error } = await supabaseClient
            .from('meter_readings')
            .insert(payload)
            .select();
        if (error) throw error;
        return data[0];
    },

    async updateMeterReading(id, fields) {
        if (!supabaseClient) return null;
        const payload = {};
        if (fields.meterReading) payload.reading_value = fields.meterReading;
        if (fields.remarks !== undefined) payload.supervisor_remarks = fields.remarks;
        if (fields.status) {
            payload.status = fields.status === 'Approved' ? 'APPROVED' : (fields.status === 'Rejected' ? 'REJECTED' : 'PENDING');
            if (payload.status !== 'PENDING') {
                payload.approved_at = new Date().toISOString();
            }
        }
        
        const { data, error } = await supabaseClient
            .from('meter_readings')
            .update(payload)
            .eq('id', id)
            .select();
        if (error) throw error;
        return data[0];
    },

    // ------------------------------------------------------------------------
    // STORAGE API FOR METER PHOTOS
    // ------------------------------------------------------------------------
    async uploadMeterPhoto(base64DataUrl) {
        if (!supabaseClient) return base64DataUrl;
        
        // Convert base64 to Blob
        const response = await fetch(base64DataUrl);
        const blob = await response.blob();
        const filename = `meter_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
        
        const { data, error } = await supabaseClient
            .storage
            .from('meter-photos')
            .upload(filename, blob, { contentType: 'image/jpeg' });
            
        if (error) throw error;
        
        // Get Public URL
        const { data: publicUrlData } = supabaseClient
            .storage
            .from('meter-photos')
            .getPublicUrl(filename);
            
        return publicUrlData.publicUrl;
    },

    // ------------------------------------------------------------------------
    // REAL-TIME SUBSCRIPTION API
    // ------------------------------------------------------------------------
    subscribeToReadings(callback) {
        if (!supabaseClient) return null;
        return supabaseClient
            .channel('realtime_meter_readings')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'meter_readings' }, payload => {
                console.log('⚡ Realtime Meter Reading Update:', payload);
                if (typeof callback === 'function') callback(payload);
            })
            .subscribe();
    }
};
