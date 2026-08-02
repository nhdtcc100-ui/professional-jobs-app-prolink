import { supabase } from '../supabase';
import { Employee, Attendance } from '../../types';

export const erpService = {
  async hireEmployee(data: Partial<Employee>) {
    try {
      const { data: result, error } = await supabase
        .from('employees')
        .insert([{
          employer_id: data.employer_id,
          user_id: data.user_id,
          job_id: data.job_id,
          salary: data.salary,
          working_hours: data.working_hours,
          department: data.department,
          status: 'active'
        }])
        .select()
        .single();
      
      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST205') {
           return { data: { ...data, id: Date.now().toString() }, error: null };
        }
        throw error;
      }
      return { data: result, error: null };
    } catch (e: any) {
      return { error: e, data: null };
    }
  },

  async getEmployeesByEmployer(employerId: string) {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('employer_id', employerId)
        .eq('status', 'active');
      
      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST205') return { data: [], error: null };
        throw error;
      }
      return { data, error: null };
    } catch (e: any) {
      return { error: e, data: null };
    }
  },

  async checkIn(employeeId: string, locationLat?: number, locationLng?: number, photoUrl?: string) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const checkInTime = new Date().toISOString();
      
      const currentHour = new Date().getHours();
      const status = currentHour > 9 ? 'late' : 'present';

      const { data, error } = await supabase
        .from('attendance')
        .insert([{
          employee_id: employeeId,
          date: today,
          check_in_time: checkInTime,
          location_lat: locationLat,
          location_lng: locationLng,
          photo_url: photoUrl,
          status
        }])
        .select()
        .single();
        
      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST205') return { data: { id: Date.now().toString(), status }, error: null };
        throw error;
      }
      return { data, error: null };
    } catch (e: any) {
      return { error: e, data: null };
    }
  },

  async checkOut(attendanceId: string, locationLat?: number, locationLng?: number) {
    try {
      const checkOutTime = new Date().toISOString();
      const { data, error } = await supabase
        .from('attendance')
        .update({
          check_out_time: checkOutTime,
        })
        .eq('id', attendanceId)
        .select()
        .single();
        
      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST205') {
          return { data: { id: attendanceId, check_out_time: checkOutTime }, error: null };
        }
        throw error;
      }
      return { data, error: null };
    } catch (e: any) {
      return { error: e, data: null };
    }
  },

  async getMyAttendance(employeeId: string) {
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('employee_id', employeeId)
        .order('check_in_time', { ascending: false });
        
      if (error) {
         if (error.code === '42P01' || error.code === 'PGRST205') return { data: [], error: null };
         throw error;
      }
      return { data, error: null };
    } catch (e: any) {
      return { error: e, data: null };
    }
  },

  async getEmployerAttendanceReports(employerId: string) {
    try {
      // 🛡️ Security Check: Ensure requester is the employer
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id !== employerId) throw new Error('Unauthorized Access: Identity Mismatch');

      const { data: employees } = await this.getEmployeesByEmployer(employerId);
      if (!employees || employees.length === 0) return { data: [], error: null };
      
      const employeeIds = employees.map(e => e.id);
      
      // Batch fetch attendance for all employees in one call
      const { data: attendance, error } = await supabase
        .from('attendance')
        .select('*')
        .in('employee_id', employeeIds)
        .order('check_in_time', { ascending: false });
        
      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST205') return { data: [], error: null };
        throw error;
      }
      return { data: attendance, error: null };
    } catch (e: any) {
      console.error('Security/Data Error in Attendance Reports:', e.message);
      return { error: e, data: null };
    }
  },

  async processSmartAttendance(employeeId: string, location?: { lat: number; lng: number }, photoUrl?: string) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data: existing } = await supabase
        .from('attendance')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('date', today)
        .order('check_in_time', { ascending: false })
        .limit(1)
        .maybeSingle();

      const now = new Date();
      if (!existing) {
        return await this.checkIn(employeeId, location?.lat, location?.lng, photoUrl);
      }

      const lastCheckIn = new Date(existing.check_in_time);
      const diffMinutes = (now.getTime() - lastCheckIn.getTime()) / (1000 * 60);

      if (diffMinutes < 10) {
        return { data: existing, type: 'duplicate', message: 'لقد سجلت حضورك بالفعل للتو' };
      }

      if (!existing.check_out_time) {
        return await this.checkOut(existing.id, location?.lat, location?.lng);
      }

      return { data: existing, type: 'complete', message: 'لقد أتممت ساعات العمل لهذا اليوم' };
    } catch (e: any) {
      return { error: e };
    }
  }
};
