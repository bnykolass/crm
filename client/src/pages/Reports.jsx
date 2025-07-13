import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Fade,
  Tabs,
  Tab,
  Grid,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Zoom,
  Chip,
  LinearProgress,
  Alert,
} from '@mui/material';
import {
  Assessment,
  AccessTime,
  TrendingUp,
  Person,
  Business,
  Download,
  Work,
  ExpandMore,
  ExpandLess,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const Reports = () => {
  const [currentTab, setCurrentTab] = useState(0);
  const [data, setData] = useState({});
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState({});
  
  // Filters
  const [filters, setFilters] = useState({
    startDate: dayjs().startOf('month'),
    endDate: dayjs().endOf('month'),
    userId: '',
    projectId: '',
    companyId: '',
  });

  const { hasPermission } = useAuth();

  useEffect(() => {
    if (hasPermission('view_reports')) {
      fetchUsers();
      fetchProjects();
      fetchCompanies();
    }
  }, []);

  useEffect(() => {
    if (hasPermission('view_reports')) {
      fetchReportData();
    }
  }, [currentTab, filters]);

  const fetchUsers = async () => {
    try {
      const response = await axios.get('/api/reports/users/list');
      setUsers(response.data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await axios.get('/api/reports/projects/list');
      setProjects(response.data);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    }
  };

  const fetchCompanies = async () => {
    try {
      const response = await axios.get('/api/reports/companies/list');
      setCompanies(response.data);
    } catch (error) {
      console.error('Failed to fetch companies:', error);
    }
  };

  const fetchReportData = async () => {
    if (!hasPermission('view_reports')) return;
    
    setLoading(true);
    try {
      let response;
      const params = {
        startDate: filters.startDate.format('YYYY-MM-DD'),
        endDate: filters.endDate.format('YYYY-MM-DD'),
      };

      switch (currentTab) {
        case 0: // Time Tracking Overview
          response = await axios.get('/api/reports/time-tracking', { 
            params: { ...params, userId: filters.userId, projectId: filters.projectId }
          });
          break;
        case 1: // User Details
          if (filters.userId) {
            response = await axios.get(`/api/reports/user/${filters.userId}`, { params });
          }
          break;
        case 2: // Project Details
          if (filters.projectId) {
            response = await axios.get(`/api/reports/project/${filters.projectId}`, { params });
          }
          break;
        case 3: // Company Details
          if (filters.companyId) {
            response = await axios.get(`/api/reports/company/${filters.companyId}`, { params });
          }
          break;
        case 4: // User Productivity
          response = await axios.get('/api/reports/user-productivity', { params });
          break;
      }
      
      setData(response?.data || {});
    } catch (error) {
      console.error('Failed to fetch report data:', error);
      setData({});
    }
    setLoading(false);
  };

  const formatTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatDate = (dateString) => {
    return dayjs(dateString).format('DD.MM.YYYY');
  };

  const formatDateTime = (dateString) => {
    return dayjs(dateString).format('DD.MM.YYYY HH:mm');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'success';
      case 'in_progress': return 'primary';
      case 'pending': return 'warning';
      default: return 'default';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'completed': return 'Dokončené';
      case 'in_progress': return 'Prebieha';
      case 'pending': return 'Čaká';
      default: return status;
    }
  };

  if (!hasPermission('view_reports')) {
    return (
      <Box>
        <Typography variant="h5">Nemáte oprávnenie na zobrazenie tejto stránky</Typography>
      </Box>
    );
  }

  const handleTaskExpand = (taskId) => {
    setExpandedTasks(prev => ({
      ...prev,
      [taskId]: !prev[taskId]
    }));
  };

  const renderTimeTrackingOverview = () => (
    <Box>
      {data.summary && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={3}>
            <Card sx={{ background: 'linear-gradient(145deg, #1e1e1e 0%, #2d2d2d 100%)' }}>
              <CardContent>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AccessTime color="primary" />
                  Celkové hodiny
                </Typography>
                <Typography variant="h4">{data.summary.totalHours}h</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card sx={{ background: 'linear-gradient(145deg, #1e1e1e 0%, #2d2d2d 100%)' }}>
              <CardContent>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TrendingUp color="success" />
                  Celkové náklady
                </Typography>
                <Typography variant="h4">€{data.summary.totalCost}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card sx={{ background: 'linear-gradient(145deg, #1e1e1e 0%, #2d2d2d 100%)' }}>
              <CardContent>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Work color="info" />
                  Úlohy
                </Typography>
                <Typography variant="h4">{data.summary.totalTasks}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card sx={{ background: 'linear-gradient(145deg, #1e1e1e 0%, #2d2d2d 100%)' }}>
              <CardContent>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Assessment color="warning" />
                  Záznamy
                </Typography>
                <Typography variant="h4">{data.summary.totalEntries}</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {data.aggregatedTasks && (
        <TableContainer component={Paper} sx={{ background: 'linear-gradient(145deg, #1e1e1e 0%, #2d2d2d 100%)' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Úloha</TableCell>
                <TableCell>Používateľ</TableCell>
                <TableCell>Projekt</TableCell>
                <TableCell>Záznamy</TableCell>
                <TableCell>Celkový čas</TableCell>
                <TableCell>Náklady</TableCell>
                <TableCell>Posledný záznam</TableCell>
                <TableCell width="50px"></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.aggregatedTasks.map((task) => (
                <React.Fragment key={task.task_id}>
                  <TableRow 
                    onClick={() => handleTaskExpand(task.task_id)}
                    sx={{ 
                      cursor: 'pointer',
                      '&:hover': { backgroundColor: 'rgba(144, 202, 249, 0.08)' }
                    }}
                  >
                    <TableCell sx={{ fontWeight: 'bold' }}>{task.task_title}</TableCell>
                    <TableCell>{task.first_name} {task.last_name}</TableCell>
                    <TableCell>{task.project_name}</TableCell>
                    <TableCell>
                      <Chip label={`${task.entry_count} záznamov`} size="small" color="primary" />
                    </TableCell>
                    <TableCell>{formatTime(task.total_duration)}</TableCell>
                    <TableCell>€{task.total_cost?.toFixed(2)}</TableCell>
                    <TableCell>{formatDate(task.last_entry)}</TableCell>
                    <TableCell>
                      {expandedTasks[task.task_id] ? <ExpandLess /> : <ExpandMore />}
                    </TableCell>
                  </TableRow>
                  
                  {expandedTasks[task.task_id] && (
                    <TableRow>
                      <TableCell colSpan={8} sx={{ p: 0 }}>
                        <Box sx={{ p: 2, backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                          <Typography variant="h6" sx={{ mb: 2 }}>Detailné záznamy</Typography>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>Dátum a čas</TableCell>
                                <TableCell>Trvanie</TableCell>
                                <TableCell>Popis</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {task.timesheet_details.map((detail) => (
                                <TableRow key={detail.id}>
                                  <TableCell>{formatDateTime(detail.start_time)}</TableCell>
                                  <TableCell>{formatTime(detail.duration)}</TableCell>
                                  <TableCell>{detail.description || '-'}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </Box>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );

  const renderUserDetails = () => {
    if (!filters.userId) {
      return (
        <Alert severity="info">
          Vyberte používateľa z filtrov pre zobrazenie detailného reportu.
        </Alert>
      );
    }

    if (!data.user) {
      return <Alert severity="warning">Načítavanie údajov používateľa...</Alert>;
    }

    return (
      <Box>
        {/* User Info Card */}
        <Card sx={{ mb: 3, background: 'linear-gradient(145deg, #1e1e1e 0%, #2d2d2d 100%)' }}>
          <CardContent>
            <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Person color="primary" />
              {data.user.first_name} {data.user.last_name}
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6} md={3}>
                <Typography variant="body2" color="text.secondary">Email</Typography>
                <Typography variant="body1">{data.user.email}</Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="body2" color="text.secondary">Hodinová sadzba</Typography>
                <Typography variant="body1">€{data.user.hourly_rate}/h</Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="body2" color="text.secondary">Celkové hodiny</Typography>
                <Typography variant="body1">{data.summary?.totalHours}h</Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="body2" color="text.secondary">Celkové náklady</Typography>
                <Typography variant="body1">€{data.summary?.totalCost}</Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={6} md={3}>
            <Card sx={{ background: 'linear-gradient(145deg, #1e1e1e 0%, #2d2d2d 100%)' }}>
              <CardContent>
                <Typography variant="h6">Úlohy</Typography>
                <Typography variant="h4">{data.summary?.totalTasks}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} md={3}>
            <Card sx={{ background: 'linear-gradient(145deg, #1e1e1e 0%, #2d2d2d 100%)' }}>
              <CardContent>
                <Typography variant="h6">Dokončené</Typography>
                <Typography variant="h4">{data.summary?.completedTasks}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} md={3}>
            <Card sx={{ background: 'linear-gradient(145deg, #1e1e1e 0%, #2d2d2d 100%)' }}>
              <CardContent>
                <Typography variant="h6">Úspešnosť</Typography>
                <Typography variant="h4">{data.summary?.completionRate}%</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} md={3}>
            <Card sx={{ background: 'linear-gradient(145deg, #1e1e1e 0%, #2d2d2d 100%)' }}>
              <CardContent>
                <Typography variant="h6">Timesheety</Typography>
                <Typography variant="h4">{data.summary?.totalTimesheets}</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Tasks Table */}
        {data.tasks && (
          <TableContainer component={Paper} sx={{ mb: 3, background: 'linear-gradient(145deg, #1e1e1e 0%, #2d2d2d 100%)' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell colSpan={6}>
                    <Typography variant="h6">Priradené úlohy</Typography>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Názov</TableCell>
                  <TableCell>Projekt</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Priorita</TableCell>
                  <TableCell>Hodiny</TableCell>
                  <TableCell>Termín</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.tasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell>{task.title}</TableCell>
                    <TableCell>{task.project_name}</TableCell>
                    <TableCell>
                      <Chip 
                        label={getStatusLabel(task.status)} 
                        color={getStatusColor(task.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{task.priority}</TableCell>
                    <TableCell>{formatTime(task.total_minutes)}</TableCell>
                    <TableCell>{task.due_date ? formatDate(task.due_date) : '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Aggregated Timesheets Table */}
        {data.aggregatedTimesheets && (
          <TableContainer component={Paper} sx={{ background: 'linear-gradient(145deg, #1e1e1e 0%, #2d2d2d 100%)' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell colSpan={8}>
                    <Typography variant="h6">Časové záznamy</Typography>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Úloha</TableCell>
                  <TableCell>Projekt</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Záznamy</TableCell>
                  <TableCell>Celkový čas</TableCell>
                  <TableCell>Náklady</TableCell>
                  <TableCell>Posledný záznam</TableCell>
                  <TableCell width="50px"></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.aggregatedTimesheets.map((taskTimesheet) => (
                  <React.Fragment key={taskTimesheet.task_id}>
                    <TableRow 
                      onClick={() => handleTaskExpand(taskTimesheet.task_id)}
                      sx={{ 
                        cursor: 'pointer',
                        '&:hover': { backgroundColor: 'rgba(144, 202, 249, 0.08)' }
                      }}
                    >
                      <TableCell sx={{ fontWeight: 'bold' }}>{taskTimesheet.task_title}</TableCell>
                      <TableCell>{taskTimesheet.project_name}</TableCell>
                      <TableCell>
                        <Chip 
                          label={getStatusLabel(taskTimesheet.task_status)} 
                          color={getStatusColor(taskTimesheet.task_status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip label={`${taskTimesheet.entry_count} záznamov`} size="small" color="primary" />
                      </TableCell>
                      <TableCell>{formatTime(taskTimesheet.total_duration)}</TableCell>
                      <TableCell>€{taskTimesheet.total_cost?.toFixed(2)}</TableCell>
                      <TableCell>{formatDate(taskTimesheet.last_entry)}</TableCell>
                      <TableCell>
                        {expandedTasks[taskTimesheet.task_id] ? <ExpandLess /> : <ExpandMore />}
                      </TableCell>
                    </TableRow>
                    
                    {expandedTasks[taskTimesheet.task_id] && (
                      <TableRow>
                        <TableCell colSpan={8} sx={{ p: 0 }}>
                          <Box sx={{ p: 2, backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                            <Typography variant="h6" sx={{ mb: 2 }}>Detailné záznamy</Typography>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell>Dátum a čas</TableCell>
                                  <TableCell>Trvanie</TableCell>
                                  <TableCell>Náklady</TableCell>
                                  <TableCell>Popis</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {taskTimesheet.timesheet_details.map((detail) => (
                                  <TableRow key={detail.id}>
                                    <TableCell>{formatDateTime(detail.start_time)}</TableCell>
                                    <TableCell>{formatTime(detail.duration)}</TableCell>
                                    <TableCell>€{detail.cost?.toFixed(2)}</TableCell>
                                    <TableCell>{detail.description || '-'}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </Box>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    );
  };

  const renderProjectDetails = () => {
    if (!filters.projectId) {
      return (
        <Alert severity="info">
          Vyberte projekt z filtrov pre zobrazenie detailného reportu.
        </Alert>
      );
    }

    if (!data.project) {
      return <Alert severity="warning">Načítavanie údajov projektu...</Alert>;
    }

    return (
      <Box>
        {/* Project Info Card */}
        <Card sx={{ mb: 3, background: 'linear-gradient(145deg, #1e1e1e 0%, #2d2d2d 100%)' }}>
          <CardContent>
            <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Work color="primary" />
              {data.project.name}
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6} md={3}>
                <Typography variant="body2" color="text.secondary">Firma</Typography>
                <Typography variant="body1">{data.project.company_name}</Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="body2" color="text.secondary">Status</Typography>
                <Typography variant="body1">{data.project.status}</Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="body2" color="text.secondary">Pokrok</Typography>
                <Typography variant="body1">{data.summary?.progress}%</Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="body2" color="text.secondary">Celkové náklady</Typography>
                <Typography variant="body1">€{data.summary?.totalCost}</Typography>
              </Grid>
            </Grid>
            {data.project.description && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary">Popis</Typography>
                <Typography variant="body1">{data.project.description}</Typography>
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={6} md={3}>
            <Card sx={{ background: 'linear-gradient(145deg, #1e1e1e 0%, #2d2d2d 100%)' }}>
              <CardContent>
                <Typography variant="h6">Úlohy</Typography>
                <Typography variant="h4">{data.summary?.totalTasks}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} md={3}>
            <Card sx={{ background: 'linear-gradient(145deg, #1e1e1e 0%, #2d2d2d 100%)' }}>
              <CardContent>
                <Typography variant="h6">Dokončené</Typography>
                <Typography variant="h4">{data.summary?.completedTasks}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} md={3}>
            <Card sx={{ background: 'linear-gradient(145deg, #1e1e1e 0%, #2d2d2d 100%)' }}>
              <CardContent>
                <Typography variant="h6">Prebieha</Typography>
                <Typography variant="h4">{data.summary?.inProgressTasks}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} md={3}>
            <Card sx={{ background: 'linear-gradient(145deg, #1e1e1e 0%, #2d2d2d 100%)' }}>
              <CardContent>
                <Typography variant="h6">Hodiny</Typography>
                <Typography variant="h4">{data.summary?.totalHours}h</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Progress Bar */}
        <Card sx={{ mb: 3, background: 'linear-gradient(145deg, #1e1e1e 0%, #2d2d2d 100%)' }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>Pokrok projektu</Typography>
            <LinearProgress 
              variant="determinate" 
              value={data.summary?.progress || 0}
              sx={{ height: 10, borderRadius: 5 }}
            />
            <Typography variant="body2" sx={{ mt: 1 }}>
              {data.summary?.progress}% dokončené ({data.summary?.completedTasks} z {data.summary?.totalTasks} úloh)
            </Typography>
          </CardContent>
        </Card>

        {/* Team Members */}
        {data.teamMembers && (
          <TableContainer component={Paper} sx={{ mb: 3, background: 'linear-gradient(145deg, #1e1e1e 0%, #2d2d2d 100%)' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell colSpan={5}>
                    <Typography variant="h6">Tím projektu</Typography>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Meno</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Hodinová sadzba</TableCell>
                  <TableCell>Hodiny</TableCell>
                  <TableCell>Náklady</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.teamMembers.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>{member.first_name} {member.last_name}</TableCell>
                    <TableCell>{member.email}</TableCell>
                    <TableCell>€{member.hourly_rate}/h</TableCell>
                    <TableCell>{formatTime(member.total_minutes)}</TableCell>
                    <TableCell>€{member.total_cost?.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Tasks Table */}
        {data.tasks && (
          <TableContainer component={Paper} sx={{ background: 'linear-gradient(145deg, #1e1e1e 0%, #2d2d2d 100%)' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell colSpan={7}>
                    <Typography variant="h6">Úlohy projektu</Typography>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Názov</TableCell>
                  <TableCell>Priradený</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Priorita</TableCell>
                  <TableCell>Hodiny</TableCell>
                  <TableCell>Náklady</TableCell>
                  <TableCell>Termín</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.tasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell>{task.title}</TableCell>
                    <TableCell>
                      {task.first_name && task.last_name 
                        ? `${task.first_name} ${task.last_name}`
                        : 'Nepriradené'
                      }
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={getStatusLabel(task.status)} 
                        color={getStatusColor(task.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{task.priority}</TableCell>
                    <TableCell>{formatTime(task.total_minutes)}</TableCell>
                    <TableCell>€{task.total_cost?.toFixed(2)}</TableCell>
                    <TableCell>{task.due_date ? formatDate(task.due_date) : '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    );
  };

  const renderCompanyDetails = () => {
    if (!filters.companyId) {
      return (
        <Alert severity="info">
          Vyberte firmu z filtrov pre zobrazenie detailného reportu.
        </Alert>
      );
    }

    if (!data.company) {
      return <Alert severity="warning">Načítavanie údajov firmy...</Alert>;
    }

    return (
      <Box>
        {/* Company Info Card */}
        <Card sx={{ mb: 3, background: 'linear-gradient(145deg, #1e1e1e 0%, #2d2d2d 100%)' }}>
          <CardContent>
            <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Business color="primary" />
              {data.company.name}
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6} md={3}>
                <Typography variant="body2" color="text.secondary">Email</Typography>
                <Typography variant="body1">{data.company.email || '-'}</Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="body2" color="text.secondary">Telefón</Typography>
                <Typography variant="body1">{data.company.phone || '-'}</Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="body2" color="text.secondary">Celkové náklady</Typography>
                <Typography variant="body1">€{data.summary?.totalCost}</Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="body2" color="text.secondary">Pokrok</Typography>
                <Typography variant="body1">{data.summary?.overallProgress}%</Typography>
              </Grid>
            </Grid>
            {data.company.address && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary">Adresa</Typography>
                <Typography variant="body1">{data.company.address}</Typography>
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={6} md={3}>
            <Card sx={{ background: 'linear-gradient(145deg, #1e1e1e 0%, #2d2d2d 100%)' }}>
              <CardContent>
                <Typography variant="h6">Projekty</Typography>
                <Typography variant="h4">{data.summary?.totalProjects}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} md={3}>
            <Card sx={{ background: 'linear-gradient(145deg, #1e1e1e 0%, #2d2d2d 100%)' }}>
              <CardContent>
                <Typography variant="h6">Aktívne</Typography>
                <Typography variant="h4">{data.summary?.activeProjects}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} md={3}>
            <Card sx={{ background: 'linear-gradient(145deg, #1e1e1e 0%, #2d2d2d 100%)' }}>
              <CardContent>
                <Typography variant="h6">Úlohy</Typography>
                <Typography variant="h4">{data.summary?.totalTasks}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} md={3}>
            <Card sx={{ background: 'linear-gradient(145deg, #1e1e1e 0%, #2d2d2d 100%)' }}>
              <CardContent>
                <Typography variant="h6">Hodiny</Typography>
                <Typography variant="h4">{data.summary?.totalHours}h</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Projects Table */}
        {data.projects && (
          <TableContainer component={Paper} sx={{ background: 'linear-gradient(145deg, #1e1e1e 0%, #2d2d2d 100%)' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell colSpan={7}>
                    <Typography variant="h6">Projekty firmy</Typography>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Názov</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Úlohy</TableCell>
                  <TableCell>Dokončené</TableCell>
                  <TableCell>Hodiny</TableCell>
                  <TableCell>Náklady</TableCell>
                  <TableCell>Začiatok</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.projects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell>{project.name}</TableCell>
                    <TableCell>
                      <Chip 
                        label={project.status} 
                        color={project.status === 'active' ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{project.total_tasks}</TableCell>
                    <TableCell>{project.completed_tasks}</TableCell>
                    <TableCell>{formatTime(project.total_minutes)}</TableCell>
                    <TableCell>€{project.total_cost?.toFixed(2)}</TableCell>
                    <TableCell>{project.start_date ? formatDate(project.start_date) : '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    );
  };

  const renderUserProductivity = () => {
    if (!data || !Array.isArray(data)) {
      return <Alert severity="warning">Načítavanie údajov produktivity...</Alert>;
    }

    return (
      <TableContainer component={Paper} sx={{ background: 'linear-gradient(145deg, #1e1e1e 0%, #2d2d2d 100%)' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Používateľ</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Úlohy</TableCell>
              <TableCell>Dokončené</TableCell>
              <TableCell>Úspešnosť</TableCell>
              <TableCell>Hodiny</TableCell>
              <TableCell>Príjem</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.first_name} {user.last_name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>{user.assigned_tasks}</TableCell>
                <TableCell>{user.completed_tasks}</TableCell>
                <TableCell>{user.completion_rate}%</TableCell>
                <TableCell>{user.total_hours}h</TableCell>
                <TableCell>€{user.total_revenue?.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  return (
    <Fade in timeout={800}>
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Assessment fontSize="large" />
            Reporty
          </Typography>
        </Box>

        {/* Filters */}
        <Paper sx={{ p: 3, mb: 3, background: 'linear-gradient(145deg, #1e1e1e 0%, #2d2d2d 100%)' }}>
          <Typography variant="h6" sx={{ mb: 2 }}>Filtre</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DatePicker
                  label="Od dátumu"
                  value={filters.startDate}
                  onChange={(date) => setFilters({ ...filters, startDate: date })}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </LocalizationProvider>
            </Grid>
            <Grid item xs={12} md={3}>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DatePicker
                  label="Do dátumu"
                  value={filters.endDate}
                  onChange={(date) => setFilters({ ...filters, endDate: date })}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </LocalizationProvider>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Používateľ</InputLabel>
                <Select
                  value={filters.userId}
                  onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
                  label="Používateľ"
                >
                  <MenuItem value="">Všetci</MenuItem>
                  {users.map((user) => (
                    <MenuItem key={user.id} value={user.id}>
                      {user.first_name} {user.last_name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Projekt</InputLabel>
                <Select
                  value={filters.projectId}
                  onChange={(e) => setFilters({ ...filters, projectId: e.target.value })}
                  label="Projekt"
                >
                  <MenuItem value="">Všetky</MenuItem>
                  {projects.map((project) => (
                    <MenuItem key={project.id} value={project.id}>
                      {project.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Firma</InputLabel>
                <Select
                  value={filters.companyId}
                  onChange={(e) => setFilters({ ...filters, companyId: e.target.value })}
                  label="Firma"
                >
                  <MenuItem value="">Všetky</MenuItem>
                  {companies.map((company) => (
                    <MenuItem key={company.id} value={company.id}>
                      {company.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Paper>

        {/* Tabs */}
        <Paper sx={{ background: 'linear-gradient(145deg, #1e1e1e 0%, #2d2d2d 100%)' }}>
          <Tabs 
            value={currentTab} 
            onChange={(e, newValue) => setCurrentTab(newValue)}
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label="Prehľad času" />
            <Tab label="Detail používateľa" />
            <Tab label="Detail projektu" />
            <Tab label="Detail firmy" />
            <Tab label="Produktivita" />
          </Tabs>

          <Box sx={{ p: 3 }}>
            {loading && <LinearProgress sx={{ mb: 2 }} />}
            
            {currentTab === 0 && renderTimeTrackingOverview()}
            {currentTab === 1 && renderUserDetails()}
            {currentTab === 2 && renderProjectDetails()}
            {currentTab === 3 && renderCompanyDetails()}
            {currentTab === 4 && renderUserProductivity()}
          </Box>
        </Paper>
      </Box>
    </Fade>
  );
};

export default Reports;