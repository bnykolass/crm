import React, { useState } from 'react';
import {
  IconButton,
  Badge,
  Popover,
  List,
  ListItem,
  ListItemText,
  Typography,
  Box,
  Divider,
  Button,
  Chip,
  ListItemIcon,
  Avatar,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Notifications,
  NotificationsNone,
  Check,
  Delete,
  Task,
  Comment,
  Assignment,
  CheckCircle,
  Cancel,
  Schedule,
} from '@mui/icons-material';
import { useNotifications } from '../context/NotificationContext';
import { formatDistanceToNow } from 'date-fns';

const NotificationBell = () => {
  const [anchorEl, setAnchorEl] = useState(null);
  const {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();

  const open = Boolean(anchorEl);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
    fetchNotifications();
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleMarkAsRead = async (notificationId, event) => {
    event.stopPropagation();
    await markAsRead(notificationId);
  };

  const handleDelete = async (notificationId, event) => {
    event.stopPropagation();
    await deleteNotification(notificationId);
  };

  const getNotificationIcon = (type) => {
    const iconMap = {
      task_assigned: Assignment,
      task_confirmed: CheckCircle,
      task_rejected: Cancel,
      task_comment: Comment,
      task_due_soon: Schedule,
      task_completed: Task,
    };
    
    const IconComponent = iconMap[type] || Notifications;
    return <IconComponent fontSize="small" />;
  };

  const getNotificationColor = (type) => {
    const colorMap = {
      task_assigned: 'primary',
      task_confirmed: 'success', 
      task_rejected: 'error',
      task_comment: 'info',
      task_due_soon: 'warning',
      task_completed: 'success',
    };
    
    return colorMap[type] || 'default';
  };

  const formatTimeAgo = (dateString) => {
    try {
      return formatDistanceToNow(new Date(dateString), {
        addSuffix: true,
      });
    } catch (error) {
      console.error('Date formatting error:', error);
      return 'neznámy čas';
    }
  };

  return (
    <>
      <IconButton
        color="inherit"
        onClick={handleClick}
        sx={{
          mr: 1,
          transition: 'all 0.3s ease',
          '&:hover': {
            transform: 'scale(1.1)',
          },
        }}
      >
        <Badge badgeContent={unreadCount} color="error" max={99}>
          {unreadCount > 0 ? (
            <Notifications />
          ) : (
            <NotificationsNone />
          )}
        </Badge>
      </IconButton>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          sx: {
            width: 400,
            maxHeight: 500,
            '& .MuiList-root': {
              padding: 0,
            },
          },
        }}
      >
        <Box sx={{ p: 2, borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">
              Notifikácie
              {unreadCount > 0 && (
                <Chip
                  label={unreadCount}
                  size="small"
                  color="error"
                  sx={{ ml: 1 }}
                />
              )}
            </Typography>
            {unreadCount > 0 && (
              <Button
                size="small"
                onClick={markAllAsRead}
                startIcon={<Check />}
              >
                Označiť všetky
              </Button>
            )}
          </Box>
        </Box>

        {loading ? (
          <Box display="flex" justifyContent="center" p={3}>
            <CircularProgress size={24} />
          </Box>
        ) : notifications.length === 0 ? (
          <Box p={3}>
            <Alert severity="info">
              Žiadne notifikácie
            </Alert>
          </Box>
        ) : (
          <List sx={{ maxHeight: 350, overflow: 'auto' }}>
            {notifications.map((notification, index) => (
              <React.Fragment key={notification.id}>
                <ListItem
                  sx={{
                    backgroundColor: notification.is_read
                      ? 'transparent'
                      : 'rgba(144, 202, 249, 0.08)',
                    borderLeft: notification.is_read
                      ? 'none'
                      : '3px solid #90caf9',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    },
                    cursor: 'pointer',
                  }}
                >
                  <ListItemIcon>
                    <Avatar
                      sx={{
                        width: 32,
                        height: 32,
                        bgcolor: `${getNotificationColor(notification.type)}.main`,
                      }}
                    >
                      {getNotificationIcon(notification.type)}
                    </Avatar>
                  </ListItemIcon>
                  
                  <ListItemText
                    primary={
                      <Typography
                        variant="subtitle2"
                        sx={{
                          fontWeight: notification.is_read ? 'normal' : 'bold',
                          mb: 0.5,
                        }}
                      >
                        {notification.title}
                      </Typography>
                    }
                    secondary={
                      <Box>
                        {notification.message && (
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mb: 0.5 }}
                          >
                            {notification.message}
                          </Typography>
                        )}
                        <Typography
                          variant="caption"
                          color="text.secondary"
                        >
                          {formatTimeAgo(notification.created_at)}
                        </Typography>
                      </Box>
                    }
                  />
                  
                  <Box display="flex" flexDirection="column" gap={0.5}>
                    {!notification.is_read && (
                      <IconButton
                        size="small"
                        onClick={(e) => handleMarkAsRead(notification.id, e)}
                        sx={{ color: 'success.main' }}
                      >
                        <Check fontSize="small" />
                      </IconButton>
                    )}
                    <IconButton
                      size="small"
                      onClick={(e) => handleDelete(notification.id, e)}
                      sx={{ color: 'error.main' }}
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  </Box>
                </ListItem>
                {index < notifications.length - 1 && <Divider variant="inset" />}
              </React.Fragment>
            ))}
          </List>
        )}

        {notifications.length > 0 && (
          <Box sx={{ p: 1, borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <Button
              fullWidth
              size="small"
              onClick={() => {
                fetchNotifications();
                handleClose();
              }}
            >
              Zobraziť všetky notifikácie
            </Button>
          </Box>
        )}
      </Popover>
    </>
  );
};

export default NotificationBell;