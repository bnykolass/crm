import React, { useState, useEffect } from 'react';
import {
  Grid,
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  Fade,
  Zoom,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Divider,
} from '@mui/material';
import {
  People,
  Business,
  Assignment,
  Task,
  TrendingUp,
  AccessTime,
  Schedule,
  Warning,
} from '@mui/icons-material';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import axios from 'axios';

dayjs.extend(relativeTime);

const Dashboard = () => {
  const [stats, setStats] = useState([]);
  const [activities, setActivities] = useState([]);
  const [deadlines, setDeadlines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hoveredCard, setHoveredCard] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, activitiesRes, deadlinesRes] = await Promise.all([
        axios.get('/api/dashboard/stats'),
        axios.get('/api/dashboard/activities'),
        axios.get('/api/dashboard/deadlines')
      ]);

      const statsData = statsRes.data;
      setStats([
        { title: 'Zamestnanci', value: statsData.users, icon: <People />, color: '#1976d2', gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
        { title: 'Firmy', value: statsData.companies, icon: <Business />, color: '#2196f3', gradient: 'linear-gradient(135deg, #667eea 0%, #1976d2 100%)' },
        { title: 'Projekty', value: statsData.projects, icon: <Assignment />, color: '#42a5f5', gradient: 'linear-gradient(135deg, #2196f3 0%, #42a5f5 100%)' },
        { title: 'Aktívne úlohy', value: statsData.activeTasks, icon: <Task />, color: '#1565c0', gradient: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)' },
        { title: 'Hodiny tento mesiac', value: statsData.monthlyHours, icon: <AccessTime />, color: '#0d47a1', gradient: 'linear-gradient(135deg, #1565c0 0%, #0d47a1 100%)' },
        { title: 'Mesačný obrat', value: `€${statsData.monthlyRevenue.toFixed(2)}`, icon: <TrendingUp />, color: '#004ba0', gradient: 'linear-gradient(135deg, #0d47a1 0%, #004ba0 100%)' },
      ]);

      setActivities(activitiesRes.data);
      setDeadlines(deadlinesRes.data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      setLoading(false);
    }
  };

  const getActivityIcon = (type) => {
    switch (type) {
      case 'task': return <Task />;
      case 'timesheet': return <AccessTime />;
      default: return <Schedule />;
    }
  };

  const getActivityColor = (type) => {
    switch (type) {
      case 'task': return '#1976d2';
      case 'timesheet': return '#42a5f5';
      default: return '#2196f3';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'success';
      default: return 'default';
    }
  };

  const formatTimeAgo = (timestamp) => {
    return dayjs(timestamp).fromNow();
  };

  return (
    <Fade in timeout={800}>
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, color: 'text.primary', mb: 1 }}>
            Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Prehľad vašej organizácie
          </Typography>
        </Box>
        
        <Grid container spacing={3}>
          {stats.map((stat, index) => (
            <Grid item xs={12} sm={6} md={4} key={index}>
              <Zoom in style={{ transitionDelay: `${index * 100}ms` }}>
                <Card 
                  onMouseEnter={() => setHoveredCard(index)}
                  onMouseLeave={() => setHoveredCard(null)}
                  sx={{
                    position: 'relative',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                      transform: 'translateY(-8px)',
                      boxShadow: theme => theme.shadows[12],
                    },
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: stat.gradient,
                      opacity: hoveredCard === index ? 0.08 : 0,
                      transition: 'opacity 0.3s ease',
                      pointerEvents: 'none',
                    },
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Box display="flex" alignItems="center" justifyContent="space-between">
                      <Box flex={1}>
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            color: 'text.secondary',
                            fontWeight: 500,
                            mb: 1,
                            textTransform: 'uppercase',
                            letterSpacing: 0.5,
                            fontSize: '0.75rem'
                          }}
                        >
                          {stat.title}
                        </Typography>
                        <Typography 
                          variant="h4" 
                          sx={{ 
                            fontWeight: 700,
                            color: 'text.primary',
                            lineHeight: 1
                          }}
                        >
                          {stat.value}
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          width: 56,
                          height: 56,
                          background: stat.gradient,
                          borderRadius: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transform: hoveredCard === index ? 'rotate(360deg)' : 'rotate(0deg)',
                          transition: 'transform 0.6s ease',
                        }}
                      >
                        {React.cloneElement(stat.icon, { 
                          sx: { color: '#ffffff', fontSize: 28 } 
                        })}
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Zoom>
            </Grid>
          ))}
        </Grid>

        <Grid container spacing={3} sx={{ mt: 2 }}>
          <Grid item xs={12} md={8}>
            <Fade in timeout={1200}>
              <Paper 
                elevation={0}
                sx={{ 
                  p: 3,
                  height: '100%',
                  border: '1px solid',
                  borderColor: 'divider',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    boxShadow: theme => theme.shadows[4],
                  },
                }}
              >
                <Box sx={{ mb: 2 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                    Najnovšie aktivity
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Posledné zmeny vo vašom systéme
                  </Typography>
                </Box>
                {loading ? (
                  <Typography color="textSecondary">Načítavanie...</Typography>
                ) : activities.length > 0 ? (
                  <List dense>
                    {activities.map((activity, index) => (
                      <React.Fragment key={index}>
                        <ListItem>
                          <ListItemIcon>
                            <Box
                              sx={{
                                backgroundColor: theme => theme.palette.grey[100],
                                borderRadius: '8px',
                                p: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: '1px solid',
                                borderColor: theme => theme.palette.grey[200],
                              }}
                            >
                              {React.cloneElement(getActivityIcon(activity.type), {
                                sx: { color: getActivityColor(activity.type), fontSize: 20 }
                              })}
                            </Box>
                          </ListItemIcon>
                          <ListItemText
                            primary={activity.title}
                            secondary={
                              <Box>
                                <Typography variant="caption" display="block">
                                  {activity.description}
                                </Typography>
                                <Typography variant="caption" color="textSecondary">
                                  {activity.user} • {formatTimeAgo(activity.timestamp)}
                                </Typography>
                              </Box>
                            }
                          />
                        </ListItem>
                        {index < activities.length - 1 && <Divider variant="inset" />}
                      </React.Fragment>
                    ))}
                  </List>
                ) : (
                  <Typography color="textSecondary">
                    Žiadne nedávne aktivity
                  </Typography>
                )}
              </Paper>
            </Fade>
          </Grid>
          <Grid item xs={12} md={4}>
            <Fade in timeout={1400}>
              <Paper 
                elevation={0}
                sx={{ 
                  p: 3,
                  height: '100%',
                  border: '1px solid',
                  borderColor: 'divider',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    boxShadow: theme => theme.shadows[4],
                  },
                }}
              >
                <Box sx={{ mb: 2 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                    Blížiace sa termíny
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Úlohy ktoré sa blížia ku koncu
                  </Typography>
                </Box>
                {loading ? (
                  <Typography color="textSecondary">Načítavanie...</Typography>
                ) : deadlines.length > 0 ? (
                  <List dense>
                    {deadlines.map((deadline, index) => (
                      <React.Fragment key={deadline.id}>
                        <ListItem>
                          <ListItemIcon>
                            <Warning color="warning" />
                          </ListItemIcon>
                          <ListItemText
                            primary={deadline.title}
                            secondary={
                              <Box>
                                <Typography variant="caption" display="block">
                                  {deadline.project_name || 'Bez projektu'}
                                </Typography>
                                <Box display="flex" alignItems="center" gap={1} mt={0.5}>
                                  <Typography variant="caption" color="textSecondary">
                                    Termín: {dayjs(deadline.due_date).format('DD.MM.YYYY')}
                                  </Typography>
                                  <Chip
                                    label={deadline.priority}
                                    color={getPriorityColor(deadline.priority)}
                                    size="small"
                                  />
                                </Box>
                                {deadline.first_name && (
                                  <Typography variant="caption" color="textSecondary">
                                    Priradený: {deadline.first_name} {deadline.last_name}
                                  </Typography>
                                )}
                              </Box>
                            }
                          />
                        </ListItem>
                        {index < deadlines.length - 1 && <Divider variant="inset" />}
                      </React.Fragment>
                    ))}
                  </List>
                ) : (
                  <Typography color="textSecondary">
                    Žiadne blížiace sa termíny
                  </Typography>
                )}
              </Paper>
            </Fade>
          </Grid>
        </Grid>
      </Box>
    </Fade>
  );
};

export default Dashboard;