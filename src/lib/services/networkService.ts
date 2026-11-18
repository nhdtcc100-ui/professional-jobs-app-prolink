import { supabase } from '../supabase';
import { AppUser } from '../../types';

export const networkService = {
  async fetchConnections(userId: string) {
    return supabase.from('connections')
      .select('*')
      .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`);
  },

  async fetchNotifications(userId: string, limit = 30) {
    return supabase.from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
  },

  async sendSyncSignal(requester: AppUser, recipient: AppUser) {
    // 1. Check if a reverse connection request already exists
    const { data: existing } = await supabase
      .from('connections')
      .select('*')
      .or(
        `and(requester_id.eq.${requester.id},recipient_id.eq.${recipient.id}),` +
        `and(requester_id.eq.${recipient.id},recipient_id.eq.${requester.id})`
      )
      .limit(1);

    if (existing && existing.length > 0) {
      const conn = existing[0] as any;
      // If the other user already requested us, accept it immediately (mutual connection)
      if (conn.requester_id === recipient.id && conn.status === 'pending') {
        const { error: accErr } = await supabase
          .from('connections')
          .update({ status: 'accepted' })
          .eq('id', conn.id);
        await supabase.from('notifications').insert([
          {
            user_id: recipient.id,
            type: 'sync_approval',
            from_id: requester.id,
            from_name: requester.name,
            from_avatar: requester.avatar,
            target_id: conn.id,
            read: false,
            message: `وافق ${requester.name || 'صديقك'} على طلب التواصل المهني الخاص بك ✅`,
          },
        ]);
        return { data: conn, error: accErr };
      }
    }

    // 2. Create a new connection (let Supabase generate the UUID)
    const { data: newConn, error: connError } = await supabase
      .from('connections')
      .insert([
        {
          requester_id: requester.id,
          recipient_id: recipient.id,
          status: 'pending',
        },
      ])
      .select()
      .single();

    if (connError) {
      console.error('sendSyncSignal connections error:', connError);
      return { error: connError };
    }

    // 3. Notify the recipient about the follow request
    await supabase.from('notifications').insert([
      {
        user_id: recipient.id,
        type: 'follow_request',
        from_id: requester.id,
        from_name: requester.name,
        from_avatar: requester.avatar,
        target_id: (newConn as any).id,
        read: false,
        message: `أرسل لك ${requester.name || 'مستخدم'} طلب تواصل مهني ومزامنة 🤝`,
      },
    ]);

    return { data: newConn };
  },

  async acceptSync(notifId: string, targetId: string) {
    if (targetId) {
      await supabase.from('connections').update({ status: 'accepted' }).eq('id', targetId);
    }
    if (notifId) {
      return supabase.from('notifications').update({ read: true }).eq('id', notifId);
    }
    return { data: null, error: null };
  },

  async acceptConnection(connId: string, currentUser?: AppUser, targetUserId?: string) {
    const res = await supabase.from('connections').update({ status: 'accepted' }).eq('id', connId);
    await supabase.from('notifications').update({ read: true }).eq('target_id', connId);

    // If target user provided, notify them of acceptance
    if (currentUser && targetUserId) {
      supabase.from('notifications').insert([{
        user_id: targetUserId,
        type: 'sync_approval',
        from_id: currentUser.id,
        from_name: currentUser.name,
        from_avatar: currentUser.avatar,
        target_id: connId,
        read: false
      }]).then(() => {});
    }
    return res;
  },

  async rejectConnection(connId: string) {
    const res = await supabase.from('connections').delete().eq('id', connId);
    await supabase.from('notifications').delete().eq('target_id', connId);
    return res;
  },

  async markNotificationRead(notifId: string) {
    return supabase.from('notifications').update({ read: true }).eq('id', notifId);
  }
};
