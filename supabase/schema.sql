-- ============================================================================
-- GRS SMART ENERGY MONITORING SYSTEM - SUPABASE DATABASE SCHEMA MIGRATION
-- ============================================================================

-- Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. PROFILES TABLE (Linked to Supabase Auth)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('ADMIN', 'MANAGER', 'SUPERVISOR', 'TECHNICIAN')) DEFAULT 'TECHNICIAN',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    zone_area TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ----------------------------------------------------------------------------
-- 2. LOCATIONS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ----------------------------------------------------------------------------
-- 3. ENERGY METERS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.energy_meters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
    meter_name TEXT NOT NULL,
    meter_number TEXT NOT NULL DEFAULT '',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ----------------------------------------------------------------------------
-- 4. METER READINGS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.meter_readings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    technician_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
    meter_id UUID NOT NULL REFERENCES public.energy_meters(id) ON DELETE CASCADE,
    reading_value NUMERIC(12, 2) NOT NULL,
    photo_url TEXT DEFAULT '',
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')) DEFAULT 'PENDING',
    supervisor_remarks TEXT DEFAULT '',
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE
);

-- ----------------------------------------------------------------------------
-- 5. USER LOCATION ASSIGNMENTS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_location_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
    CONSTRAINT unique_user_location UNIQUE (user_id, location_id)
);

-- ----------------------------------------------------------------------------
-- 5B. USER METER ASSIGNMENTS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_meter_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    meter_id UUID NOT NULL REFERENCES public.energy_meters(id) ON DELETE CASCADE,
    CONSTRAINT unique_user_meter UNIQUE (user_id, meter_id)
);

-- ----------------------------------------------------------------------------
-- AUTOMATIC PROFILE CREATION TRIGGER ON USER SIGNUP
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, email, role, active)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'role', 'TECHNICIAN'),
        TRUE
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if already exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ----------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES & HELPER FUNCTIONS
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.energy_meters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meter_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_location_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_meter_assignments ENABLE ROW LEVEL SECURITY;

-- Helper to fetch logged-in user role
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Profiles Policies
CREATE POLICY "Allow authenticated users to read profiles"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (TRUE);

CREATE POLICY "Allow users to update own profile or admins/managers to update all"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id OR public.get_my_role() IN ('ADMIN', 'MANAGER'));

-- Locations & Energy Meters Policies (All authenticated users can read, Admins/Managers write)
CREATE POLICY "Allow read locations"
    ON public.locations FOR SELECT
    TO authenticated
    USING (TRUE);

CREATE POLICY "Allow admin/manager write locations"
    ON public.locations FOR ALL
    TO authenticated
    USING (public.get_my_role() IN ('ADMIN', 'MANAGER'));

CREATE POLICY "Allow read energy meters"
    ON public.energy_meters FOR SELECT
    TO authenticated
    USING (TRUE);

CREATE POLICY "Allow admin/manager write energy meters"
    ON public.energy_meters FOR ALL
    TO authenticated
    USING (public.get_my_role() IN ('ADMIN', 'MANAGER'));

-- User Location Assignments Policies
CREATE POLICY "Allow read user location assignments"
    ON public.user_location_assignments FOR SELECT
    TO authenticated
    USING (TRUE);

CREATE POLICY "Allow admin/manager manage user location assignments"
    ON public.user_location_assignments FOR ALL
    TO authenticated
    USING (public.get_my_role() IN ('ADMIN', 'MANAGER'));

-- User Meter Assignments Policies
CREATE POLICY "Allow read user meter assignments"
    ON public.user_meter_assignments FOR SELECT
    TO authenticated
    USING (TRUE);

CREATE POLICY "Allow admin/manager manage user meter assignments"
    ON public.user_meter_assignments FOR ALL
    TO authenticated
    USING (public.get_my_role() IN ('ADMIN', 'MANAGER'));

-- Meter Readings Policies
CREATE POLICY "Allow technicians to insert readings"
    ON public.meter_readings FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = technician_id OR public.get_my_role() IN ('ADMIN', 'MANAGER', 'SUPERVISOR'));

CREATE POLICY "Allow authenticated users to view readings"
    ON public.meter_readings FOR SELECT
    TO authenticated
    USING (TRUE);

CREATE POLICY "Allow supervisors, managers, admins to update readings"
    ON public.meter_readings FOR UPDATE
    TO authenticated
    USING (public.get_my_role() IN ('ADMIN', 'MANAGER', 'SUPERVISOR'));

-- ----------------------------------------------------------------------------
-- 6. STORAGE BUCKET FOR ENERGY METER PHOTOS
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('meter-photos', 'meter-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies
CREATE POLICY "Public Read Access for Meter Photos"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'meter-photos');

CREATE POLICY "Authenticated Upload Access for Meter Photos"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'meter-photos');

-- ----------------------------------------------------------------------------
-- INITIAL SEED DATA FOR LOCATIONS & ENERGY METERS
-- ----------------------------------------------------------------------------
INSERT INTO public.locations (id, name) VALUES
    ('11111111-1111-1111-1111-111111111111', 'Admin Block'),
    ('22222222-2222-2222-2222-222222222222', 'Assembly Line 1'),
    ('33333333-3333-3333-3333-333333333333', 'Warehouse A'),
    ('44444444-4444-4444-4444-444444444444', 'Utility Hub')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.energy_meters (id, location_id, meter_name, meter_number) VALUES
    ('a1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Admin Main Incomer', 'MTR-101'),
    ('a2222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Solar Plant Output', 'MTR-102'),
    ('b1111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'Line 1 Power Panel', 'MTR-201'),
    ('b2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'Heavy Machinery Submeter', 'MTR-202'),
    ('c1111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'Warehouse HVAC Panel', 'MTR-301'),
    ('c2222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', 'Loading Bay Meter', 'MTR-302'),
    ('d1111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444', 'HVAC Plant Incomer', 'MTR-401'),
    ('d2222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444444', 'Air Compressor Submeter', 'MTR-402')
ON CONFLICT (id) DO NOTHING;
