import { supabase } from './supabase';

export const broadcastNetworkRefresh = (type: 'refreshData' | 'refreshMessages') => {
  // تحديث محلي فوراً
  window.dispatchEvent(new Event(type));
  // إرسال إشارة عبر الشبكة للجميع (تتخطى مشاكل إعدادات الجداول)
  const tempCh = supabase.channel('realtime-global');
  tempCh.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      tempCh.send({ type: 'broadcast', event: type, payload: {} });
      setTimeout(() => supabase.removeChannel(tempCh), 2000);
    }
  });
};
