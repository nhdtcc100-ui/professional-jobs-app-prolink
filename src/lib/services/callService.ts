import { supabase } from '../supabase';

export const callService = {
  // 1. Create a call session
  async initiateCall(callerId: string, receiverId: string, type: 'voice' | 'video' = 'voice') {
    const { data, error } = await supabase
      .from('calls')
      .insert({
        caller_id: callerId,
        receiver_id: receiverId,
        type,
        status: 'ringing',
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    return { data, error };
  },

  // 2. Accept a call
  async acceptCall(callId: string) {
    const { error } = await supabase
      .from('calls')
      .update({ status: 'active', started_at: new Date().toISOString() })
      .eq('id', callId);
    
    return { error };
  },

  // 3. Reject or End a call
  async endCall(callId: string) {
    const { error } = await supabase
      .from('calls')
      .update({ status: 'ended', ended_at: new Date().toISOString() })
      .eq('id', callId);
    
    return { error };
  },
  // 4. Notify missed call
  async notifyMissedCall(callerId: string, receiverId: string, callerName: string, type: 'voice' | 'video' = 'voice') {
    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: receiverId,
        type: 'missed_call',
        from_id: callerId,
        from_name: callerName,
        target_id: callerId, // Link to the caller's profile
        content: `مكالمة ${type === 'video' ? 'فيديو' : 'صوتية'} فائتة من ${callerName}`,
        created_at: new Date().toISOString()
      });
    return { error };
  },

  // 4. Listen for incoming calls (Open Radar for Debugging)
  subscribeToCalls(userId: string, onEvent: (payload: any) => void) {
    console.log("DEBUG: Service Subscribing to ALL Calls for User:", userId);
    return supabase
      .channel(`calls-radar-${userId}`)
      .on('postgres_changes', {
        event: '*', // Listen to INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'calls'
      }, (payload) => {
        console.log("DEBUG: Service Received Realtime Event:", payload);
        onEvent(payload);
      })
      .subscribe((status) => {
        console.log("DEBUG: Call Channel Status:", status);
      });
  }
};
