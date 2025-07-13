import React, { createContext, useContext, useState, useEffect } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import axios from 'axios';
import { toast } from 'react-toastify';

const NotificationContext = createContext();

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const { socket } = useSocket();
  const { user } = useAuth();

  // Fetch notifications from server
  const fetchNotifications = async (unreadOnly = false) => {
    if (!user) return;
    
    try {
      setLoading(true);
      const response = await axios.get('/api/notifications', {
        params: { unread_only: unreadOnly }
      });
      
      setNotifications(response.data.notifications);
      setUnreadCount(response.data.unread_count);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      toast.error('Nepodarilo sa načítať notifikácie');
    } finally {
      setLoading(false);
    }
  };

  // Fetch unread count only
  const fetchUnreadCount = async () => {
    if (!user) return;
    
    try {
      const response = await axios.get('/api/notifications/unread-count');
      setUnreadCount(response.data.count);
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  };

  // Mark notification as read
  const markAsRead = async (notificationId) => {
    try {
      await axios.put(`/api/notifications/${notificationId}/read`);
      
      // Update local state
      setNotifications(prev => 
        prev.map(notif => 
          notif.id === notificationId ? { ...notif, is_read: true } : notif
        )
      );
      
      // Update unread count
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      toast.error('Nepodarilo sa označiť notifikáciu ako prečítanú');
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    try {
      await axios.put('/api/notifications/mark-all-read');
      
      // Update local state
      setNotifications(prev => 
        prev.map(notif => ({ ...notif, is_read: true }))
      );
      setUnreadCount(0);
      
      toast.success('Všetky notifikácie označené ako prečítané');
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      toast.error('Nepodarilo sa označiť všetky notifikácie ako prečítané');
    }
  };

  // Delete notification
  const deleteNotification = async (notificationId) => {
    try {
      await axios.delete(`/api/notifications/${notificationId}`);
      
      // Update local state
      const deletedNotification = notifications.find(n => n.id === notificationId);
      setNotifications(prev => prev.filter(notif => notif.id !== notificationId));
      
      // Update unread count if it was unread
      if (deletedNotification && !deletedNotification.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
      
      toast.success('Notifikácia vymazaná');
    } catch (error) {
      console.error('Failed to delete notification:', error);
      toast.error('Nepodarilo sa vymazať notifikáciu');
    }
  };

  // Show toast notification
  const showToastNotification = (notification) => {
    const notificationTypes = {
      task_assigned: { icon: '📋', color: 'info' },
      task_confirmed: { icon: '✅', color: 'success' },
      task_rejected: { icon: '❌', color: 'error' },
      task_comment: { icon: '💬', color: 'info' },
      task_due_soon: { icon: '⏰', color: 'warning' },
      task_completed: { icon: '🎉', color: 'success' }
    };

    const config = notificationTypes[notification.type] || { icon: '🔔', color: 'info' };
    
    toast(
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '20px' }}>{config.icon}</span>
        <div>
          <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
            {notification.title}
          </div>
          {notification.message && (
            <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '4px' }}>
              {notification.message}
            </div>
          )}
        </div>
      </div>,
      {
        type: config.color,
        position: 'top-right',
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      }
    );
  };

  // Socket.io event handlers
  useEffect(() => {
    if (!socket || !user) return;

    // Join notifications room for current user
    socket.emit('join-notifications', user.id);

    // Listen for new notifications
    const handleNewNotification = (notification) => {
      console.log('New notification received:', notification);
      
      // Add to local state
      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);
      
      // Show toast
      showToastNotification(notification);
    };

    // Listen for unread count updates
    const handleUnreadCountUpdate = (data) => {
      setUnreadCount(data.count);
    };

    socket.on('new-notification', handleNewNotification);
    socket.on('unread-count-update', handleUnreadCountUpdate);

    // Cleanup on unmount
    return () => {
      socket.off('new-notification', handleNewNotification);
      socket.off('unread-count-update', handleUnreadCountUpdate);
      socket.emit('leave-notifications', user.id);
    };
  }, [socket, user]);

  // Initial fetch when user changes
  useEffect(() => {
    if (user) {
      fetchNotifications();
    } else {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [user]);

  const value = {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    showToastNotification
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};