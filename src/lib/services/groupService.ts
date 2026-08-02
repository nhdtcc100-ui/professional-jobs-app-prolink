import { supabase } from '../supabase';

export const groupService = {
  // Group Management
  async updateGroup(groupId: string, updates: { name?: string; description?: string; avatar_url?: string; is_private?: boolean }) {
    return supabase.from('groups').update(updates).eq('id', groupId);
  },

  // Member Management
  async addMember(groupId: string, userId: string) {
    return supabase.from('group_members').insert([{
      group_id: groupId,
      user_id: userId,
      role: 'member',
      status: 'accepted'
    }]);
  },

  async updateMemberStatus(groupId: string, userId: string, status: 'accepted' | 'suspended' | 'pending') {
    return supabase.from('group_members')
      .update({ status })
      .eq('group_id', groupId)
      .eq('user_id', userId);
  },

  async removeMember(groupId: string, userId: string) {
    return supabase.from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', userId);
  },

  // Message Management
  async editMessage(postId: string, content: string) {
    return supabase.from('group_posts')
      .update({ 
        content, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', postId);
  },

  async deleteMessage(postId: string) {
    return supabase.from('group_posts')
      .delete()
      .eq('id', postId);
  },

  async sendGroupMessage(groupId: string, authorId: string, content: string, imageUrl?: string) {
    const { data, error } = await supabase.from('group_posts').insert([{
      group_id: groupId,
      author_id: authorId,
      content: content,
      image_url: imageUrl
    }]).select();
    
    if (error) {
      console.error("DEBUG: sendGroupMessage error details:", error);
    }
    return { data, error };
  }
};
