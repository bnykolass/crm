import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Avatar,
  Menu,
  MenuItem,
  Chip,
  Collapse,
  Badge,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard,
  People,
  Business,
  Assignment,
  Task,
  AccessTime,
  Description,
  Assessment,
  Settings,
  Chat,
  Logout,
  Circle,
  Folder,
  ExpandLess,
  ExpandMore,
  Pending,
  AssignmentTurnedIn,
  Event,
  Group,
  AccountCircle,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import NotificationBell from './NotificationBell';
import axios from 'axios';

const drawerWidth = 260;

const Layout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [tasksExpanded, setTasksExpanded] = useState(true);
  const [taskCounts, setTaskCounts] = useState({
    new: 0,
    my: 0,
    completed: 0
  });
  const [calendarCount, setCalendarCount] = useState(0);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [onlineUsersData, setOnlineUsersData] = useState([]);
  const { user, logout, hasPermission } = useAuth();
  const { activeUsers } = useSocket();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    fetchTaskCounts();
    fetchCalendarCount();
    fetchChatUnreadCount();
    fetchOnlineUsers();
  }, [user]);

  useEffect(() => {
    // Automatický update každých 30 sekúnd
    const interval = setInterval(() => {
      if (user) {
        fetchTaskCounts();
        fetchCalendarCount();
        fetchChatUnreadCount();
        fetchOnlineUsers();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    // Update po zmene routy (ak užívateľ prejde na inú stránku)
    if (location.pathname.startsWith('/tasks')) {
      fetchTaskCounts();
    }
  }, [location.pathname]);

  useEffect(() => {
    // Listener na custom events
    const handleTasksUpdated = () => {
      fetchTaskCounts();
    };
    
    const handleCalendarUpdated = () => {
      fetchCalendarCount();
    };
    
    const handleChatMessagesRead = () => {
      fetchChatUnreadCount();
    };

    window.addEventListener('tasksUpdated', handleTasksUpdated);
    window.addEventListener('calendarUpdated', handleCalendarUpdated);
    window.addEventListener('chatMessagesRead', handleChatMessagesRead);
    
    return () => {
      window.removeEventListener('tasksUpdated', handleTasksUpdated);
      window.removeEventListener('calendarUpdated', handleCalendarUpdated);
      window.removeEventListener('chatMessagesRead', handleChatMessagesRead);
    };
  }, []);

  const fetchTaskCounts = async () => {
    try {
      const response = await axios.get('/api/tasks');
      const tasks = response.data;

      const newCount = tasks.filter(task => 
        task.assigned_to === user?.id && 
        task.confirmation_status === 'pending'
      ).length;

      const myCount = tasks.filter(task => 
        task.assigned_to === user?.id && 
        task.confirmation_status === 'accepted' && 
        task.status !== 'completed'
      ).length;

      const completedCount = tasks.filter(task => 
        task.assigned_to === user?.id && 
        task.status === 'completed'
      ).length;

      setTaskCounts({
        new: newCount,
        my: myCount,
        completed: completedCount
      });
    } catch (error) {
      console.error('Failed to fetch task counts:', error);
    }
  };

  const fetchCalendarCount = async () => {
    try {
      const response = await axios.get('/api/calendar/upcoming/count');
      setCalendarCount(response.data.count || 0);
    } catch (error) {
      console.error('Failed to fetch calendar count:', error);
    }
  };

  const fetchChatUnreadCount = async () => {
    try {
      const response = await axios.get('/api/chat/unread/count');
      setChatUnreadCount(response.data.count || 0);
    } catch (error) {
      console.error('Failed to fetch chat unread count:', error);
    }
  };

  const fetchOnlineUsers = async () => {
    try {
      if (activeUsers.length > 0) {
        const response = await axios.get('/api/users/online-info', {
          params: { userIds: activeUsers.join(',') }
        });
        setOnlineUsersData(response.data);
      } else {
        setOnlineUsersData([]);
      }
    } catch (error) {
      console.error('Failed to fetch online users data:', error);
    }
  };

  useEffect(() => {
    fetchOnlineUsers();
  }, [activeUsers]);

  const menuItems = [
    { text: 'Dashboard', icon: <Dashboard />, path: '/dashboard', permission: null },
    { text: 'Používatelia', icon: <People />, path: '/users', permission: 'manage_users' },
    { text: 'Tímy', icon: <Group />, path: '/teams', permission: 'manage_users' },
    { text: 'Firmy', icon: <Business />, path: '/companies', permission: 'manage_companies' },
    { text: 'Projekty', icon: <Assignment />, path: '/projects', permission: 'manage_projects' },
    { text: 'Záznamy času', icon: <AccessTime />, path: '/timesheets', permission: 'add_timesheets' },
    { text: 'Cenové ponuky', icon: <Description />, path: '/quotes', permission: 'manage_quotes' },
    { text: 'Reporty', icon: <Assessment />, path: '/reports', permission: 'view_reports' },
    { text: 'Súbory', icon: <Folder />, path: '/files', permission: 'use_files' },
    { text: 'Chat', icon: <Chat />, path: '/chat', permission: 'use_chat', badgeCount: chatUnreadCount },
    { text: 'Nastavenia', icon: <Settings />, path: '/settings', permission: 'manage_settings' },
  ];

  const taskSubmenu = [
    { text: 'Nové úlohy', icon: <Pending />, path: '/tasks/new', count: taskCounts.new, color: 'warning' },
    { text: 'Moje úlohy', icon: <Task />, path: '/tasks/my', count: taskCounts.my, color: 'primary' },
    { text: 'Dokončené', icon: <AssignmentTurnedIn />, path: '/tasks/completed', count: null, color: 'success' },
    { text: 'Všetky úlohy', icon: <Assignment />, path: '/tasks', count: null, color: 'default' },
  ];

  const filteredMenuItems = menuItems.filter(
    item => !item.permission || hasPermission(item.permission)
  );

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Toolbar 
        sx={{ 
          background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
          minHeight: '80px !important',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <Box sx={{ textAlign: 'center' }}>
          <Typography 
            variant="h5" 
            sx={{ 
              color: '#ffffff',
              fontWeight: 700,
              letterSpacing: 1
            }}
          >
            CRM System
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)' }}>
            Business Management
          </Typography>
        </Box>
      </Toolbar>
      <List sx={{ flexGrow: 1, px: 1, pt: 2 }}>
        {/* Dashboard */}
        <ListItem disablePadding sx={{ mb: 0.5 }}>
          <ListItemButton
            selected={location.pathname === '/dashboard'}
            onClick={() => navigate('/dashboard')}
            sx={{
              borderRadius: 2,
              '&.Mui-selected': {
                background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
                color: '#ffffff',
                '& .MuiListItemIcon-root': {
                  color: '#ffffff',
                },
              },
              transition: 'all 0.3s ease',
            }}
          >
            <ListItemIcon><Dashboard /></ListItemIcon>
            <ListItemText primary="Dashboard" />
          </ListItemButton>
        </ListItem>
        
        {/* Úlohy s rozbaľovacím menu */}
        <ListItem disablePadding sx={{ mb: 0.5 }}>
          <ListItemButton
            onClick={() => setTasksExpanded(!tasksExpanded)}
            sx={{
              borderRadius: 2,
              '&:hover': {
                backgroundColor: 'rgba(25, 118, 210, 0.04)',
              },
            }}
          >
            <ListItemIcon><Task /></ListItemIcon>
            <ListItemText primary="Úlohy" />
            {tasksExpanded ? <ExpandLess /> : <ExpandMore />}
          </ListItemButton>
        </ListItem>
        
        <Collapse in={tasksExpanded} timeout="auto" unmountOnExit>
          <List component="div" disablePadding>
            {taskSubmenu.map((item) => (
              <ListItem key={item.text} disablePadding>
                <ListItemButton
                  sx={{ 
                    pl: 4,
                    borderRadius: 2,
                    mb: 0.5,
                    '&.Mui-selected': {
                      backgroundColor: 'rgba(25, 118, 210, 0.08)',
                      borderLeft: '3px solid #1976d2',
                      '& .MuiListItemIcon-root': {
                        color: '#1976d2',
                      },
                    },
                    transition: 'all 0.2s ease',
                  }}
                  selected={location.pathname === item.path}
                  onClick={() => navigate(item.path)}
                >
                  <ListItemIcon>
                    {item.count > 0 ? (
                      <Badge badgeContent={item.count} color={item.color}>
                        {item.icon}
                      </Badge>
                    ) : (
                      item.icon
                    )}
                  </ListItemIcon>
                  <ListItemText primary={item.text} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Collapse>
        
        {/* Kalendár */}
        <ListItem disablePadding sx={{ mb: 0.5 }}>
          <ListItemButton
            selected={location.pathname === '/calendar'}
            onClick={() => navigate('/calendar')}
            sx={{
              borderRadius: 2,
              '&.Mui-selected': {
                background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
                color: '#ffffff',
                '& .MuiListItemIcon-root': {
                  color: '#ffffff',
                },
              },
              transition: 'all 0.3s ease',
            }}
          >
            <ListItemIcon>
              {calendarCount > 0 ? (
                <Badge badgeContent={calendarCount} color="info">
                  <Event />
                </Badge>
              ) : (
                <Event />
              )}
            </ListItemIcon>
            <ListItemText primary="Kalendár" />
          </ListItemButton>
        </ListItem>
        
        {/* Ostatné menu items */}
        {filteredMenuItems.slice(1).map((item, index) => (
          <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => navigate(item.path)}
              sx={{
                borderRadius: 2,
                '&.Mui-selected': {
                  background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
                  color: '#ffffff',
                  '& .MuiListItemIcon-root': {
                    color: '#ffffff',
                  },
                },
                transition: 'all 0.3s ease',
                animation: 'slideIn 0.3s ease-out',
                animationDelay: `${index * 0.05}s`,
                animationFillMode: 'both',
                '@keyframes slideIn': {
                  from: {
                    opacity: 0,
                    transform: 'translateX(-20px)',
                  },
                  to: {
                    opacity: 1,
                    transform: 'translateX(0)',
                  },
                },
              }}
            >
              <ListItemIcon>
                {item.badgeCount > 0 ? (
                  <Badge badgeContent={item.badgeCount} color="error">
                    {item.icon}
                  </Badge>
                ) : (
                  item.icon
                )}
              </ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Divider sx={{ mx: 2 }} />
      <Box sx={{ p: 2, backgroundColor: 'background.default', borderRadius: 2, m: 2 }}>
        <Typography 
          variant="subtitle2" 
          sx={{ 
            fontWeight: 600,
            color: 'text.secondary',
            mb: 1.5,
            textTransform: 'uppercase',
            fontSize: '0.75rem',
            letterSpacing: 0.5
          }}
        >
          Online používatelia ({activeUsers.length})
        </Typography>
        {onlineUsersData.slice(0, 5).map((userData) => {
          const display = userData.nickname || `${userData.first_name} ${userData.last_name}`;
          const initials = userData.nickname 
            ? userData.nickname.substring(0, 2).toUpperCase()
            : `${userData.first_name?.[0] || ''}${userData.last_name?.[0] || ''}`;
          
          return (
            <Box key={userData.id} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Badge
                overlap="circular"
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                badgeContent={<Circle sx={{ fontSize: 8, color: 'success.main' }} />}
              >
                <Avatar 
                  src={userData.profile_photo ? `http://localhost:5555${userData.profile_photo}` : undefined} 
                  sx={{ width: 24, height: 24, mr: 1 }}
                >
                  {initials}
                </Avatar>
              </Badge>
              <Typography variant="caption">{display}</Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
          backgroundColor: '#fafbfc',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Toolbar sx={{ py: 1 }}>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" noWrap sx={{ fontWeight: 600, color: 'text.primary' }}>
              {filteredMenuItems.find(item => item.path === location.pathname)?.text || 'CRM'}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {new Date().toLocaleDateString('sk-SK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </Typography>
          </Box>
          <NotificationBell />
          <Chip
            label={user?.role === 'admin' ? 'Admin' : 'Zamestnanec'}
            size="small"
            sx={{ 
              mr: 2,
              background: user?.role === 'admin' 
                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                : 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
              color: '#ffffff',
              fontWeight: 600,
            }}
          />
          <IconButton 
            onClick={handleMenuOpen} 
            sx={{ 
              p: 0.5,
              '&:hover': {
                backgroundColor: 'rgba(25, 118, 210, 0.04)',
              }
            }}
          >
            <Avatar 
              src={user?.profile_photo ? `http://localhost:5555${user.profile_photo}` : undefined}
              sx={{ 
                width: 36, 
                height: 36,
                border: '2px solid',
                borderColor: 'primary.main',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'scale(1.05)',
                }
              }}
            >
              {user?.nickname 
                ? user.nickname.substring(0, 2).toUpperCase()
                : `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`
              }
            </Avatar>
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
            PaperProps={{
              elevation: 0,
              sx: {
                overflow: 'visible',
                filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
                mt: 1.5,
                '& .MuiAvatar-root': {
                  width: 32,
                  height: 32,
                  ml: -0.5,
                  mr: 1,
                },
                '&:before': {
                  content: '""',
                  display: 'block',
                  position: 'absolute',
                  top: 0,
                  right: 14,
                  width: 10,
                  height: 10,
                  bgcolor: 'background.paper',
                  transform: 'translateY(-50%) rotate(45deg)',
                  zIndex: 0,
                },
              },
            }}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          >
            <MenuItem disabled>
              {user?.nickname || `${user?.firstName} ${user?.lastName}`}
            </MenuItem>
            <MenuItem disabled>{user?.email}</MenuItem>
            <Divider />
            <MenuItem onClick={() => { handleMenuClose(); navigate('/profile'); }}>
              <ListItemIcon>
                <AccountCircle fontSize="small" />
              </ListItemIcon>
              Môj účet
            </MenuItem>
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <Logout fontSize="small" />
              </ListItemIcon>
              Odhlásiť sa
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          mt: 10,
          backgroundColor: 'background.default',
          minHeight: '100vh',
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
};

export default Layout;