import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { Notification, NotificationType } from '../types';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  addNotification: (title: string, message: string, type?: NotificationType) => Promise<void>;
  refreshNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchNotifications = async () => {
    if (!user) {
      setNotifications([]);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30);

      if (!error && data) {
        setNotifications(data);
      }
    } catch (e) {
      console.error('Error fetching notifications:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }

    fetchNotifications();

    // 1. Supabase Realtime Subscription for Instant Notifications
    const channel = supabase
      .channel(`user-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT' && payload.new) {
            const newNotif = payload.new as Notification;
            setNotifications(prev => {
              if (prev.some(n => n.id === newNotif.id)) return prev;
              return [newNotif, ...prev];
            });
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            const updated = payload.new as Notification;
            setNotifications(prev => prev.map(n => n.id === updated.id ? updated : n));
          } else if (payload.eventType === 'DELETE' && payload.old) {
            const deletedId = (payload.old as any).id;
            setNotifications(prev => prev.filter(n => n.id !== deletedId));
          } else {
            fetchNotifications();
          }
        }
      )
      .subscribe();

    // 2. Tab focus & visibility change listeners
    const handleFocusOrVisible = () => {
      if (document.visibilityState === 'visible') {
        fetchNotifications();
      }
    };

    window.addEventListener('visibilitychange', handleFocusOrVisible);
    window.addEventListener('focus', handleFocusOrVisible);

    // 3. Periodic Polling fallback every 30 seconds
    const interval = setInterval(() => {
      fetchNotifications();
    }, 30000);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('visibilitychange', handleFocusOrVisible);
      window.removeEventListener('focus', handleFocusOrVisible);
      clearInterval(interval);
    };
  }, [user]);

  const markAsRead = async (id: string) => {
    if (!user) return;
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id)
        .eq('user_id', user.id);

      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch (e) {
      console.error('Error marking notification read:', e);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (e) {
      console.error('Error marking all notifications read:', e);
    }
  };

  const addNotification = async (title: string, message: string, type: NotificationType = 'system') => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('notifications')
        .insert({
          user_id: user.id,
          title,
          message,
          type,
          is_read: false
        })
        .select()
        .single();

      if (data) {
        setNotifications(prev => [data, ...prev]);
      }
    } catch (e) {
      console.error('Error inserting notification:', e);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        markAsRead,
        markAllAsRead,
        addNotification,
        refreshNotifications: fetchNotifications
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within a NotificationProvider');
  return context;
};
