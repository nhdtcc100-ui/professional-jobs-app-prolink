-- =======================================================================================
-- ProLink Mini-ERP System Database Migration
-- =======================================================================================
-- 1. Create Employees Table
-- =======================================================================================
CREATE TABLE IF NOT EXISTS public.employees (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    
    -- Financial & Organizational Info
    salary TEXT NOT NULL,
    working_hours TEXT NOT NULL,
    department TEXT NOT NULL,
    
    -- Meta Info
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'terminated')),
    hire_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint: A user can only have one active record per job
    UNIQUE(user_id, job_id)
);

-- Indexes for fast querying
CREATE INDEX idx_employees_employer_id ON public.employees(employer_id);
CREATE INDEX idx_employees_user_id ON public.employees(user_id);
CREATE INDEX idx_employees_job_id ON public.employees(job_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- Policies for Employees
CREATE POLICY "Employers can view their own employees" 
    ON public.employees FOR SELECT 
    USING (auth.uid() = employer_id);

CREATE POLICY "Employees can view their own record" 
    ON public.employees FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Employers can insert employees" 
    ON public.employees FOR INSERT 
    WITH CHECK (auth.uid() = employer_id);

CREATE POLICY "Employers can update their employees" 
    ON public.employees FOR UPDATE 
    USING (auth.uid() = employer_id);


-- =======================================================================================
-- 2. Create Attendance Table
-- =======================================================================================
CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    
    -- Attendance specifics
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    check_in_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    check_out_time TIMESTAMP WITH TIME ZONE,
    
    -- Location Tracking
    location_lat DOUBLE PRECISION,
    location_lng DOUBLE PRECISION,
    
    status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'late', 'absent', 'excused')),
    
    -- Ensure only one check-in per employee per day
    UNIQUE(employee_id, date)
);

-- Indexes for fast querying
CREATE INDEX idx_attendance_employee_id ON public.attendance(employee_id);
CREATE INDEX idx_attendance_date ON public.attendance(date);

-- Enable Row Level Security (RLS)
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Policies for Attendance
CREATE POLICY "Employees can insert their own attendance" 
    ON public.attendance FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.employees 
            WHERE employees.id = attendance.employee_id 
            AND employees.user_id = auth.uid()
        )
    );

CREATE POLICY "Employees can view their own attendance" 
    ON public.attendance FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.employees 
            WHERE employees.id = attendance.employee_id 
            AND employees.user_id = auth.uid()
        )
    );

CREATE POLICY "Employers can view attendance of their employees" 
    ON public.attendance FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.employees 
            WHERE employees.id = attendance.employee_id 
            AND employees.employer_id = auth.uid()
        )
    );

-- =======================================================================================
-- Realtime Setup
-- =======================================================================================
-- Add tables to the supabase_realtime publication to enable live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.employees;
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance;

-- =======================================================================================
-- 3. Create Kiosk Devices Table (Employer's registered check-in devices)
-- =======================================================================================
CREATE TABLE IF NOT EXISTS public.kiosk_devices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    -- Device Identity
    device_name TEXT NOT NULL DEFAULT 'جهاز الحضور الرئيسي',
    device_fingerprint TEXT NOT NULL UNIQUE,  -- A unique hash of browser/device characteristics
    
    -- Geofencing
    location_lat DOUBLE PRECISION,
    location_lng DOUBLE PRECISION,
    geofence_radius INT DEFAULT 500, -- Allowed radius in meters
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_kiosk_devices_employer_id ON public.kiosk_devices(employer_id);
CREATE INDEX idx_kiosk_devices_fingerprint ON public.kiosk_devices(device_fingerprint);

ALTER TABLE public.kiosk_devices ENABLE ROW LEVEL SECURITY;

-- Only the employer can manage their kiosk devices
CREATE POLICY "Employers can manage their kiosk devices"
    ON public.kiosk_devices FOR ALL
    USING (auth.uid() = employer_id)
    WITH CHECK (auth.uid() = employer_id);

-- Optional: Allow reading kiosk data during attendance (service role handles this)

ALTER PUBLICATION supabase_realtime ADD TABLE public.kiosk_devices;

-- Optional: Create a function and trigger to automatically set status based on check-in time
-- (You can customize this logic based on company policies)
