import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Fade,
  Zoom,
  Chip,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  AccessTime,
  PlayArrow,
  Stop,
  ExpandMore,
  ExpandLess,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const Timesheets = () => {
  const [timesheets, setTimesheets] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingTimesheet, setEditingTimesheet] = useState(null);
  const [activeTimesheet, setActiveTimesheet] = useState(null);
  const [currentDuration, setCurrentDuration] = useState(0);
  const [expandedTasks, setExpandedTasks] = useState({});
  const [formData, setFormData] = useState({
    taskId: '',
    duration: '',
    description: '',
    workDate: dayjs(),
  });
  const [loading, setLoading] = useState(false);
  const { user, hasPermission } = useAuth();

  useEffect(() => {
    fetchTimesheets();
    fetchTasks();
    fetchActiveTimesheet();
  }, []);

  useEffect(() => {
    let interval;
    if (activeTimesheet) {
      interval = setInterval(() => {
        const startTime = new Date(activeTimesheet.start_time);
        const currentTime = new Date();
        const duration = Math.round((currentTime - startTime) / (1000 * 60));
        setCurrentDuration(duration);
      }, 60000);
    }
    return () => clearInterval(interval);
  }, [activeTimesheet]);

  const fetchTimesheets = async () => {
    try {
      const response = await axios.get('/api/timesheets');
      setTimesheets(response.data);
    } catch (error) {
      console.error('Failed to fetch timesheets:', error);
    }
  };

  const fetchTasks = async () => {
    try {
      const response = await axios.get('/api/timesheets/tasks/list');
      setTasks(response.data);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    }
  };

  const fetchActiveTimesheet = async () => {
    try {
      const response = await axios.get('/api/timesheets/active/current');
      setActiveTimesheet(response.data);
      if (response.data) {
        setCurrentDuration(response.data.current_duration || 0);
      }
    } catch (error) {
      console.error('Failed to fetch active timesheet:', error);
    }
  };

  const handleOpenDialog = (timesheet = null) => {
    if (timesheet) {
      setEditingTimesheet(timesheet);
      setFormData({
        taskId: timesheet.task_id,
        duration: timesheet.duration,
        description: timesheet.description || '',
        workDate: timesheet.start_time ? dayjs(timesheet.start_time) : dayjs(),
      });
    } else {
      setEditingTimesheet(null);
      setFormData({
        taskId: '',
        duration: '',
        description: '',
        workDate: dayjs(),
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingTimesheet(null);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const submitData = {
        taskId: formData.taskId,
        duration: parseInt(formData.duration),
        description: formData.description,
        workDate: formData.workDate.format('YYYY-MM-DD'),
      };

      if (editingTimesheet) {
        await axios.put(`/api/timesheets/${editingTimesheet.id}`, {
          duration: submitData.duration,
          description: submitData.description,
        });
      } else {
        await axios.post('/api/timesheets', submitData);
      }
      fetchTimesheets();
      handleCloseDialog();
    } catch (error) {
      console.error('Failed to save timesheet:', error);
      alert(error.response?.data?.error || 'Nepodarilo sa uložiť záznam času');
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Naozaj chcete vymazať tento záznam času?')) {
      try {
        await axios.delete(`/api/timesheets/${id}`);
        fetchTimesheets();
      } catch (error) {
        console.error('Failed to delete timesheet:', error);
        alert(error.response?.data?.error || 'Nepodarilo sa vymazať záznam času');
      }
    }
  };

  const handleStartTracking = async (taskId) => {
    try {
      await axios.post('/api/timesheets/start', { taskId });
      fetchActiveTimesheet();
      fetchTimesheets();
    } catch (error) {
      console.error('Failed to start time tracking:', error);
      alert(error.response?.data?.error || 'Nepodarilo sa spustiť sledovanie času');
    }
  };

  const handleStopTracking = async () => {
    if (!activeTimesheet) return;
    
    const description = prompt('Pridajte popis práce (voliteľné):');
    
    try {
      await axios.post('/api/timesheets/stop', { description });
      setActiveTimesheet(null);
      setCurrentDuration(0);
      fetchTimesheets();
    } catch (error) {
      console.error('Failed to stop time tracking:', error);
      alert(error.response?.data?.error || 'Nepodarilo sa zastaviť sledovanie času');
    }
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

  const handleTaskExpand = (taskId) => {
    setExpandedTasks(prev => ({
      ...prev,
      [taskId]: !prev[taskId]
    }));
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

  if (!hasPermission('add_timesheets')) {
    return (
      <Box>
        <Typography variant="h5">Nemáte oprávnenie na zobrazenie tejto stránky</Typography>
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Fade in timeout={800}>
        <Box>
          {/* Active time tracking banner */}
          {activeTimesheet && (
            <Zoom in style={{ transitionDelay: '100ms' }}>
              <Paper 
                sx={{ 
                  p: 2, 
                  mb: 3, 
                  background: 'linear-gradient(45deg, #4caf50 30%, #66bb6a 90%)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <Box display="flex" alignItems="center" gap={2}>
                  <PlayArrow />
                  <Typography variant="h6">
                    Sleduje sa čas pre: {activeTimesheet.task_title}
                  </Typography>
                  <Chip 
                    label={formatTime(currentDuration)} 
                    color="default" 
                    size="small"
                  />
                </Box>
                <Button 
                  variant="contained" 
                  color="error"
                  startIcon={<Stop />}
                  onClick={handleStopTracking}
                >
                  Zastaviť
                </Button>
              </Paper>
            </Zoom>
          )}

          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AccessTime fontSize="large" />
              Záznamy času
            </Typography>
            <Zoom in style={{ transitionDelay: '300ms' }}>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => handleOpenDialog()}
                sx={{
                  background: 'linear-gradient(45deg, #2196f3 30%, #21cbf3 90%)',
                  boxShadow: '0 3px 5px 2px rgba(33, 203, 243, .3)',
                }}
              >
                Pridať záznam
              </Button>
            </Zoom>
          </Box>

          <TableContainer 
            component={Paper} 
            elevation={3}
            sx={{
              background: 'linear-gradient(145deg, #1e1e1e 0%, #2d2d2d 100%)',
              '& .MuiTableCell-root': {
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              },
            }}
          >
            <Table>
              <TableHead>
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
                {timesheets.map((taskTimesheet, index) => (
                  <React.Fragment key={taskTimesheet.task_id}>
                    <TableRow 
                      onClick={() => handleTaskExpand(taskTimesheet.task_id)}
                      sx={{
                        cursor: 'pointer',
                        animation: `fadeInUp 0.5s ease-out ${index * 0.1}s`,
                        animationFillMode: 'both',
                        '@keyframes fadeInUp': {
                          from: {
                            opacity: 0,
                            transform: 'translateY(20px)',
                          },
                          to: {
                            opacity: 1,
                            transform: 'translateY(0)',
                          },
                        },
                        '&:hover': {
                          backgroundColor: 'rgba(33, 150, 243, 0.08)',
                        },
                      }}
                    >
                      <TableCell>
                        <Typography variant="subtitle2" fontWeight="bold">
                          {taskTimesheet.task_title}
                        </Typography>
                      </TableCell>
                      <TableCell>{taskTimesheet.project_name || '-'}</TableCell>
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
                      <TableCell>
                        {formatTime(taskTimesheet.total_duration)}
                      </TableCell>
                      <TableCell>
                        €{taskTimesheet.total_cost?.toFixed(2)}
                      </TableCell>
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
                                  <TableCell align="right">Akcie</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {taskTimesheet.timesheet_details.map((detail) => (
                                  <TableRow key={detail.id}>
                                    <TableCell>{formatDateTime(detail.start_time)}</TableCell>
                                    <TableCell>{formatTime(detail.duration)}</TableCell>
                                    <TableCell>€{detail.cost?.toFixed(2)}</TableCell>
                                    <TableCell>{detail.description || '-'}</TableCell>
                                    <TableCell align="right">
                                      {detail.end_time && (
                                        <>
                                          <IconButton 
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleOpenDialog(detail);
                                            }}
                                            sx={{ 
                                              color: 'primary.main',
                                              '&:hover': { transform: 'scale(1.1)' },
                                            }}
                                            size="small"
                                          >
                                            <Edit />
                                          </IconButton>
                                          {(hasPermission('manage_tasks') || detail.user_id === user?.id) && (
                                            <IconButton 
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleDelete(detail.id);
                                              }}
                                              sx={{ 
                                                color: 'error.main',
                                                '&:hover': { transform: 'scale(1.1)' },
                                              }}
                                              size="small"
                                            >
                                              <Delete />
                                            </IconButton>
                                          )}
                                        </>
                                      )}
                                    </TableCell>
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

          {/* Add/Edit Dialog */}
          <Dialog 
            open={openDialog} 
            onClose={handleCloseDialog} 
            maxWidth="sm" 
            fullWidth
            TransitionComponent={Zoom}
          >
            <DialogTitle>
              {editingTimesheet ? 'Upraviť záznam času' : 'Pridať nový záznam času'}
            </DialogTitle>
            <DialogContent>
              <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <FormControl fullWidth required>
                  <InputLabel>Úloha</InputLabel>
                  <Select
                    value={formData.taskId}
                    onChange={(e) => setFormData({ ...formData, taskId: e.target.value })}
                    label="Úloha"
                    disabled={editingTimesheet} // Can't change task for existing timesheet
                  >
                    {tasks.map((task) => (
                      <MenuItem key={task.id} value={task.id}>
                        {task.title} {task.project_name && `(${task.project_name})`}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                
                <TextField
                  label="Trvanie (minúty)"
                  type="number"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                  fullWidth
                  required
                  inputProps={{ min: 1 }}
                />
                
                <TextField
                  label="Popis práce"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  fullWidth
                  multiline
                  rows={3}
                />
                
                {!editingTimesheet && (
                  <DatePicker
                    label="Dátum práce"
                    value={formData.workDate}
                    onChange={(date) => setFormData({ ...formData, workDate: date })}
                  />
                )}
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCloseDialog}>Zrušiť</Button>
              <Button 
                onClick={handleSubmit} 
                variant="contained" 
                disabled={loading || !formData.taskId || !formData.duration}
                sx={{
                  background: 'linear-gradient(45deg, #2196f3 30%, #21cbf3 90%)',
                  boxShadow: '0 3px 5px 2px rgba(33, 203, 243, .3)',
                }}
              >
                {editingTimesheet ? 'Uložiť' : 'Vytvoriť'}
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      </Fade>
    </LocalizationProvider>
  );
};

export default Timesheets;