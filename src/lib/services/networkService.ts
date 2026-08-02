import { supabase } from '../supabase';
import { AppUser } from '../../types';

export const networkService = {
  async fetchConnections(userId: string) {
    return supabase.from('connections')
      .select('*')
      .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`);
  },

  async fetchNotifications(userId: string, limit = 15) {
    return supabase.from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
  },

  async sendSyncSignal(requester: AppUser, recipient: AppUser) {
    const connId = `${requester.id}_${recipient.id}`;
    const { error: connError } = await supabase.from('connections').insert([{
      id: connId,
      requester_id: requester.id,
      recipient_id: recipient.id,
      status: 'pending'
    }]);

    if (connError) return { error: connError };

    return supabase.from('notifications').insert([{
      user_id: recipient.id,
      type: 'follow_request',
      from_id: requester.id,
      from_name: requester.name,
      from_avatar: requester.avatar,
      target_id: connId,
      read: false
    }]);
  },

  async acceptSync(notifId: string, targetId: string) {
    await supabase.from('connections').update({ status: 'accepted' }).eq('id', targetId);
    return supabase.from('notifications').update({ read: true }).eq('id', notifId);
  },

  async markNotificationRead(notifId: string) {
    return supabase.from('notifications').update({ read: true }).eq('id', notifId);
  }
};
