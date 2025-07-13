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
  List,
  ListItem,
  ListItemText,
  Divider,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Task as TaskIcon,
  Comment,
  PlayArrow,
  Stop,
  AccessTime,
  AttachFile,
  CloudUpload,
  Download,
  Description,
  Image,
  CheckCircle,
  Cancel,
  Pending,
} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import ConfirmDialog from '../components/ConfirmDialog';

const Tasks = ({ filter = 'all' }) => {
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [teams, setTeams] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [openViewDialog, setOpenViewDialog] = useState(false);
  const [openTimesheetDialog, setOpenTimesheetDialog] = useState(false);
  const [selectedTaskForTimesheet, setSelectedTaskForTimesheet] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [viewingTask, setViewingTask] = useState(null);
  const [newComment, setNewComment] = useState('');
  const [currentTab, setCurrentTab] = useState(0);
  const [activeTimesheet, setActiveTimesheet] = useState(null);
  const [currentDuration, setCurrentDuration] = useState(0);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    projectId: '',
    assignedTo: '',
    teamId: '',
    assignmentType: 'user', // 'user' alebo 'team'
    status: 'pending',
    priority: 'medium',
    dueDate: null,
  });
  const [timesheetFormData, setTimesheetFormData] = useState({
    hours: '',
    minutes: '',
    description: '',
    workDate: dayjs(),
  });
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: '',
    message: '',
    onConfirm: null,
    type: 'warning',
    confirmColor: 'primary'
  });
  const [loading, setLoading] = useState(false);
  const { user, hasPermission } = useAuth();

  useEffect(() => {
    fetchTasks();
    fetchProjects();
    fetchEmployees();
    fetchTeams();
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
      }, 60000); // Update every minute
    }
    return () => clearInterval(interval);
  }, [activeTimesheet]);

  const fetchTasks = async () => {
    try {
      const response = await axios.get('/api/tasks');
      setTasks(response.data);
      // Trigger update v rodičovskom komponente (Layout)
      window.dispatchEvent(new CustomEvent('tasksUpdated'));
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await axios.get('/api/tasks/projects/list');
      setProjects(response.data);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await axios.get('/api/tasks/employees/list');
      setEmployees(response.data);
    } catch (error) {
      console.error('Failed to fetch employees:', error);
    }
  };

  const fetchTeams = async () => {
    try {
      const response = await axios.get('/api/teams/list/simple');
      setTeams(response.data);
    } catch (error) {
      console.error('Failed to fetch teams:', error);
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

  const handleOpenDialog = (task = null) => {
    if (task) {
      setEditingTask(task);
      setFormData({
        title: task.title,
        description: task.description || '',
        projectId: task.project_id || '',
        assignedTo: task.assigned_to || '',
        teamId: task.team_id || '',
        assignmentType: task.team_id ? 'team' : 'user',
        status: task.status,
        priority: task.priority,
        dueDate: task.due_date ? dayjs(task.due_date) : null,
      });
    } else {
      setEditingTask(null);
      setFormData({
        title: '',
        description: '',
        projectId: '',
        assignedTo: '',
        teamId: '',
        assignmentType: 'user',
        status: 'pending',
        priority: 'medium',
        dueDate: null,
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingTask(null);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const submitData = {
        title: formData.title,
        description: formData.description,
        projectId: formData.projectId || null,
        assignedTo: formData.assignmentType === 'user' ? formData.assignedTo || null : null,
        teamId: formData.assignmentType === 'team' ? formData.teamId || null : null,
        status: formData.status,
        priority: formData.priority,
        dueDate: formData.dueDate ? formData.dueDate.toISOString() : null,
      };

      if (editingTask) {
        await axios.put(`/api/tasks/${editingTask.id}`, submitData);
      } else {
        await axios.post('/api/tasks', submitData);
      }
      fetchTasks();
      handleCloseDialog();
    } catch (error) {
      console.error('Failed to save task:', error);
      alert(error.response?.data?.error || 'Nepodarilo sa uložiť úlohu');
    }
    setLoading(false);
  };

  const handleConfirmTask = async (task, action) => {
    try {
      await axios.patch(`/api/tasks/${task.id}/confirm`, {
        action,
        message: null
      });
      
      fetchTasks();
      // Uspěšné potvrdení - bez dialgogu, len update údajov
    } catch (error) {
      console.error('Failed to confirm task:', error);
      setConfirmDialog({
        open: true,
        title: 'Chyba',
        message: error.response?.data?.error || 'Nepodarilo sa potvrdiť úlohu',
        type: 'error',
        confirmColor: 'error',
        confirmText: 'OK',
        onConfirm: () => {}
      });
    }
  };

  const handleDelete = async (id) => {
    setConfirmDialog({
      open: true,
      title: 'Vymazať úlohu',
      message: 'Naozaj chcete vymazať túto úlohu? Táto akcia sa nedá vrátiť.',
      type: 'error',
      confirmColor: 'error',
      confirmText: 'Vymazať',
      onConfirm: async () => {
        try {
          await axios.delete(`/api/tasks/${id}`);
          fetchTasks();
        } catch (error) {
          console.error('Failed to delete task:', error);
          setConfirmDialog({
            open: true,
            title: 'Chyba',
            message: error.response?.data?.error || 'Nepodarilo sa vymazať úlohu',
            type: 'error',
            confirmColor: 'error',
            confirmText: 'OK',
            onConfirm: () => {}
          });
        }
      }
    });
  };

  const handleViewTask = async (task) => {
    try {
      const response = await axios.get(`/api/tasks/${task.id}`);
      setViewingTask(response.data);
      setOpenViewDialog(true);
    } catch (error) {
      console.error('Failed to fetch task details:', error);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    
    try {
      await axios.post(`/api/tasks/${viewingTask.id}/comments`, {
        comment: newComment
      });
      setNewComment('');
      // Refresh task details
      handleViewTask(viewingTask);
    } catch (error) {
      console.error('Failed to add comment:', error);
    }
  };

  const handleStatusChange = async (taskId, status) => {
    try {
      // Ak sa pokúša nastaviť na 'completed', overč čas a potvrdenie
      if (status === 'completed') {
        const task = tasks.find(t => t.id === taskId);
        
        // Kontrola času
        if (!task.total_time || task.total_time === 0) {
          setConfirmDialog({
            open: true,
            title: 'Nemôžete ukončiť úlohu',
            message: 'Nemôžete ukončiť úlohu bez záznamu o čase! Prosím pridajte čas k úlohe pred jej ukončením.',
            type: 'error',
            confirmColor: 'error',
            confirmText: 'Rozumiem',
            onConfirm: () => {}
          });
          return;
        }
        
        // Potvrdzovacie okno
        setConfirmDialog({
          open: true,
          title: 'Ukončiť úlohu',
          message: 'Naozaj si prajete označiť túto úlohu ako dokončenú?',
          type: 'warning',
          confirmColor: 'warning',
          confirmText: 'Ukončiť',
          onConfirm: async () => {
            try {
              await axios.patch(`/api/tasks/${taskId}/status`, { status });
              fetchTasks();
            } catch (error) {
              console.error('Failed to update task status:', error);
              setConfirmDialog({
                open: true,
                title: 'Chyba',
                message: 'Nepodarilo sa zmeniť status úlohy. Skúste to znovu.',
                type: 'error',
                confirmColor: 'error',
                confirmText: 'OK',
                onConfirm: () => {}
              });
            }
          }
        });
        return;
      }
      
      await axios.patch(`/api/tasks/${taskId}/status`, { status });
      fetchTasks();
    } catch (error) {
      console.error('Failed to update task status:', error);
      setConfirmDialog({
        open: true,
        title: 'Chyba',
        message: 'Nepodarilo sa zmeniť status úlohy. Skúste to znovu.',
        type: 'error',
        confirmColor: 'error',
        confirmText: 'OK',
        onConfirm: () => {}
      });
    }
  };

  const handleStartTracking = async (taskId) => {
    try {
      await axios.post('/api/timesheets/start', { taskId });
      fetchActiveTimesheet();
      fetchTasks(); // Refresh to update time display
      // Úspěšné spustenie - bez dialgogu
    } catch (error) {
      console.error('Failed to start time tracking:', error);
      setConfirmDialog({
        open: true,
        title: 'Chyba',
        message: error.response?.data?.error || 'Nepodarilo sa spustiť sledovanie času',
        type: 'error',
        confirmColor: 'error',
        confirmText: 'OK',
        onConfirm: () => {}
      });
    }
  };

  const handleStopTracking = async () => {
    if (!activeTimesheet) return;
    
    const description = prompt('Pridajte popis práce (voliteľné):');
    
    try {
      await axios.post('/api/timesheets/stop', { description });
      setActiveTimesheet(null);
      setCurrentDuration(0);
      fetchTasks(); // Refresh to update time display
      // Úspěšné zastavenie - bez dialgogu
    } catch (error) {
      console.error('Failed to stop time tracking:', error);
      setConfirmDialog({
        open: true,
        title: 'Chyba',
        message: error.response?.data?.error || 'Nepodarilo sa zastaviť sledovanie času',
        type: 'error',
        confirmColor: 'error',
        confirmText: 'OK',
        onConfirm: () => {}
      });
    }
  };

  const handleOpenTimesheetDialog = (task) => {
    setSelectedTaskForTimesheet(task);
    setTimesheetFormData({
      hours: '',
      minutes: '',
      description: '',
      workDate: dayjs(),
    });
    setOpenTimesheetDialog(true);
  };

  const handleCloseTimesheetDialog = () => {
    setOpenTimesheetDialog(false);
    setSelectedTaskForTimesheet(null);
  };

  const handleSubmitTimesheet = async () => {
    const totalMinutes = parseInt(timesheetFormData.hours || 0) * 60 + parseInt(timesheetFormData.minutes || 0);
    
    if (totalMinutes <= 0) {
      setConfirmDialog({
        open: true,
        title: 'Neplatný čas',
        message: 'Prosím zadajte platný čas (hodiny a/alebo minúty).',
        type: 'warning',
        confirmColor: 'warning',
        confirmText: 'OK',
        onConfirm: () => {}
      });
      return;
    }

    try {
      await axios.post('/api/timesheets', {
        taskId: selectedTaskForTimesheet.id,
        duration: totalMinutes,
        description: timesheetFormData.description,
        workDate: timesheetFormData.workDate.toISOString(),
      });
      
      handleCloseTimesheetDialog();
      fetchTasks(); // Refresh to update time display
      // Úspěšné pridaní - bez dialgogu, len update údajov
    } catch (error) {
      console.error('Failed to add timesheet:', error);
      setConfirmDialog({
        open: true,
        title: 'Chyba',
        message: error.response?.data?.error || 'Nepodarilo sa pridať časomieru',
        type: 'error',
        confirmColor: 'error',
        confirmText: 'OK',
        onConfirm: () => {}
      });
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'default';
      case 'in_progress': return 'info';
      case 'completed': return 'success';
      case 'cancelled': return 'error';
      default: return 'default';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'pending': return 'Čaká';
      case 'in_progress': return 'V procese';
      case 'completed': return 'Dokončená';
      case 'cancelled': return 'Zrušená';
      default: return status;
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'low': return 'success';
      case 'medium': return 'warning';
      case 'high': return 'error';
      default: return 'default';
    }
  };

  const getPriorityLabel = (priority) => {
    switch (priority) {
      case 'low': return 'Nízka';
      case 'medium': return 'Stredná';
      case 'high': return 'Vysoká';
      default: return priority;
    }
  };

  const formatTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    setSelectedFiles(files);
  };

  const handleFileUpload = async (taskId) => {
    if (selectedFiles.length === 0) return;

    setUploadingFiles(true);
    try {
      const formData = new FormData();
      selectedFiles.forEach(file => {
        formData.append('files', file);
      });

      await axios.post(`/api/tasks/${taskId}/attachments`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setSelectedFiles([]);
      // Refresh task details to show new attachments
      handleViewTask(viewingTask);
    } catch (error) {
      console.error('Failed to upload files:', error);
      alert(error.response?.data?.error || 'Nepodarilo sa nahrať súbory');
    }
    setUploadingFiles(false);
  };

  const handleDownloadAttachment = async (attachmentId, originalName) => {
    try {
      const response = await axios.get(`/api/tasks/attachments/${attachmentId}/download`, {
        responseType: 'blob',
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', originalName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download attachment:', error);
      alert('Nepodarilo sa stiahnuť súbor');
    }
  };

  const handleDeleteAttachment = async (attachmentId) => {
    if (window.confirm('Naozaj chcete vymazať tento súbor?')) {
      try {
        await axios.delete(`/api/tasks/attachments/${attachmentId}`);
        // Refresh task details
        handleViewTask(viewingTask);
      } catch (error) {
        console.error('Failed to delete attachment:', error);
        alert(error.response?.data?.error || 'Nepodarilo sa vymazať súbor');
      }
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType) => {
    if (mimeType.startsWith('image/')) return <Image />;
    if (mimeType === 'application/pdf') return <Description />;
    return <AttachFile />;
  };

  const getConfirmationStatusChip = (task) => {
    if (task.assigned_to !== user?.id) return null;
    
    switch (task.confirmation_status) {
      case 'pending':
        return (
          <Chip 
            icon={<Pending />} 
            label="Čaká na potvrdenie" 
            color="warning" 
            size="small" 
            sx={{ mr: 1 }}
          />
        );
      case 'rejected':
        return (
          <Chip 
            icon={<Cancel />} 
            label="Odmietnuté" 
            color="error" 
            size="small" 
            sx={{ mr: 1 }}
          />
        );
      default:
        return null; // Nezobraziť 'Potvrdené' ani pre completed úlohy
    }
  };

  const filteredTasks = tasks.filter(task => {
    // Ak je nastavený filter cez props (z routy), použiť ten
    if (filter === 'new') {
      return task.assigned_to === user?.id && task.confirmation_status === 'pending';
    }
    if (filter === 'my') {
      return task.assigned_to === user?.id && task.confirmation_status === 'accepted' && task.status !== 'completed';
    }
    if (filter === 'completed') {
      return task.assigned_to === user?.id && task.status === 'completed';
    }
    
    // Inak použiť tab filter
    if (currentTab === 0) return true; // All tasks
    if (currentTab === 1) return task.assigned_to === user?.id; // My tasks
    if (currentTab === 2) return task.status === 'in_progress'; // In progress
    if (currentTab === 3) return task.status === 'completed'; // Completed
    return true;
  });

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
              <TaskIcon fontSize="large" />
              {filter === 'new' ? 'Nové úlohy' :
               filter === 'my' ? 'Moje úlohy' :
               filter === 'completed' ? 'Dokončené úlohy' : 'Úlohy'}
            </Typography>
            {hasPermission('manage_tasks') && (
              <Zoom in style={{ transitionDelay: '300ms' }}>
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={() => handleOpenDialog()}
                  sx={{
                    background: 'linear-gradient(45deg, #ef5350 30%, #f44336 90%)',
                    boxShadow: '0 3px 5px 2px rgba(244, 67, 54, .3)',
                  }}
                >
                  Pridať úlohu
                </Button>
              </Zoom>
            )}
          </Box>

          {filter === 'all' && (
            <Paper sx={{ mb: 3 }}>
              <Tabs 
                value={currentTab} 
                onChange={(e, newValue) => setCurrentTab(newValue)}
                variant="fullWidth"
              >
                <Tab label="Všetky úlohy" />
                <Tab label="Moje úlohy" />
                <Tab label="V procese" />
                <Tab label="Dokončené" />
              </Tabs>
            </Paper>
          )}

          <TableContainer 
            component={Paper} 
            elevation={0}
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              overflow: 'hidden',
              '& .MuiTableCell-root': {
                borderBottom: '1px solid',
                borderColor: 'divider',
              },
            }}
          >
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Názov</TableCell>
                  <TableCell>Projekt</TableCell>
                  <TableCell>Priradený</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Priorita</TableCell>
                  {filter !== 'new' && <TableCell>Čas</TableCell>}
                  <TableCell>Termín dokončenia</TableCell>
                  <TableCell align="right">Akcie</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredTasks.map((task, index) => (
                  <TableRow 
                    key={task.id}
                    sx={{
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
                        backgroundColor: 'rgba(239, 83, 80, 0.08)',
                      },
                    }}
                  >
                    <TableCell>
                      <Typography 
                        variant="subtitle1" 
                        fontWeight="bold"
                        sx={{ cursor: 'pointer' }}
                        onClick={() => handleViewTask(task)}
                      >
                        {task.title}
                      </Typography>
                      {task.description && (
                        <Typography variant="caption" color="text.secondary">
                          {task.description.substring(0, 50)}...
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{task.project_name || '-'}</TableCell>
                    <TableCell>
                      {task.assigned_first_name && task.assigned_last_name
                        ? `${task.assigned_first_name} ${task.assigned_last_name}`
                        : '-'
                      }
                    </TableCell>
                    <TableCell>
                      <Box display="flex" flexDirection="column" gap={0.5}>
                        {filter === 'new' ? (
                          <Chip
                            label="Čaká na potvrdenie"
                            color="warning"
                            size="small"
                          />
                        ) : (
                          <>
                            <Chip
                              label={getStatusLabel(task.status)}
                              color={getStatusColor(task.status)}
                              size="small"
                              onClick={() => {
                                if (task.assigned_to === user?.id || hasPermission('manage_tasks')) {
                                  const statuses = ['pending', 'in_progress', 'completed'];
                                  const currentIndex = statuses.indexOf(task.status);
                                  const nextStatus = statuses[(currentIndex + 1) % statuses.length];
                                  handleStatusChange(task.id, nextStatus);
                                }
                              }}
                              sx={{ cursor: 'pointer' }}
                            />
                            {getConfirmationStatusChip(task)}
                          </>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={getPriorityLabel(task.priority)}
                        color={getPriorityColor(task.priority)}
                        size="small"
                      />
                    </TableCell>
                    {filter !== 'new' && (
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <AccessTime fontSize="small" />
                          {task.total_time ? formatTime(task.total_time) : '0h 0m'}
                          {activeTimesheet?.task_id === task.id && (
                            <Chip 
                              label={`+${formatTime(currentDuration)}`} 
                              color="success" 
                              size="small"
                              sx={{ ml: 1 }}
                            />
                          )}
                        </Box>
                      </TableCell>
                    )}
                    <TableCell>
                      {task.due_date 
                        ? dayjs(task.due_date).format('DD.MM.YYYY HH:mm')
                        : '-'
                      }
                    </TableCell>
                    <TableCell align="right">
                      {/* Nové úlohy - len prijatie a otvorenie */}
                      {filter === 'new' ? (
                        <>
                          {/* Confirmation button for assigned user */}
                          {task.assigned_to === user?.id && task.confirmation_status === 'pending' && (
                            <IconButton 
                              onClick={() => handleConfirmTask(task, 'accept')}
                              sx={{ 
                                color: 'success.main',
                                '&:hover': {
                                  transform: 'scale(1.1)',
                                },
                              }}
                              title="Potvrdiť úlohu"
                            >
                              <CheckCircle />
                            </IconButton>
                          )}
                          
                          <IconButton 
                            onClick={() => handleViewTask(task)}
                            sx={{ 
                              color: 'info.main',
                              '&:hover': {
                                transform: 'scale(1.1)',
                              },
                            }}
                          >
                            <TaskIcon />
                          </IconButton>
                        </>
                      ) : (
                        <>
                          {/* Time tracking buttons */}
                          {(task.assigned_to === user?.id || hasPermission('manage_tasks')) && (
                            <>
                              {activeTimesheet?.task_id === task.id ? (
                                <IconButton 
                                  onClick={handleStopTracking}
                                  sx={{ 
                                    color: 'error.main',
                                    '&:hover': {
                                      transform: 'scale(1.1)',
                                    },
                                  }}
                                >
                                  <Stop />
                                </IconButton>
                              ) : (
                                <>
                                  <IconButton 
                                    onClick={() => handleStartTracking(task.id)}
                                    disabled={!!activeTimesheet}
                                    sx={{ 
                                      color: 'success.main',
                                      '&:hover': {
                                        transform: 'scale(1.1)',
                                      },
                                    }}
                                    title="Spustiť časomieru"
                                  >
                                    <PlayArrow />
                                  </IconButton>
                                  <IconButton 
                                    onClick={() => handleOpenTimesheetDialog(task)}
                                    sx={{ 
                                      color: 'info.main',
                                      '&:hover': {
                                        transform: 'scale(1.1)',
                                      },
                                    }}
                                    title="Pridať čas manuálne"
                                  >
                                    <AccessTime />
                                  </IconButton>
                                </>
                              )}
                            </>
                          )}
                          
                          {/* Confirmation button for assigned user */}
                          {task.assigned_to === user?.id && task.confirmation_status === 'pending' && (
                            <IconButton 
                              onClick={() => handleConfirmTask(task, 'accept')}
                              sx={{ 
                                color: 'success.main',
                                '&:hover': {
                                  transform: 'scale(1.1)',
                                },
                              }}
                              title="Potvrdiť úlohu"
                            >
                              <CheckCircle />
                            </IconButton>
                          )}
                          
                          <IconButton 
                            onClick={() => handleViewTask(task)}
                            sx={{ 
                              color: 'info.main',
                              '&:hover': {
                                transform: 'scale(1.1)',
                              },
                            }}
                          >
                            <TaskIcon />
                          </IconButton>
                          {(hasPermission('manage_tasks') || 
                            (hasPermission('edit_own_tasks') && task.assigned_to === user?.id)) && (
                            <IconButton 
                              onClick={() => handleOpenDialog(task)}
                              sx={{ 
                                color: 'primary.main',
                                '&:hover': {
                                  transform: 'scale(1.1)',
                                },
                              }}
                            >
                              <Edit />
                            </IconButton>
                          )}
                          {hasPermission('manage_tasks') && (
                            <IconButton 
                              onClick={() => handleDelete(task.id)}
                              sx={{ 
                                color: 'error.main',
                                '&:hover': {
                                  transform: 'scale(1.1)',
                                },
                              }}
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
          </TableContainer>

          {/* Edit/Create Dialog */}
          <Dialog 
            open={openDialog} 
            onClose={handleCloseDialog} 
            maxWidth="md" 
            fullWidth
            TransitionComponent={Zoom}
          >
            <DialogTitle>
              {editingTask ? 'Upraviť úlohu' : 'Pridať novú úlohu'}
            </DialogTitle>
            <DialogContent>
              <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="Názov úlohy"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  fullWidth
                  required
                />
                <TextField
                  label="Popis"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  fullWidth
                  multiline
                  rows={3}
                />
                <Box display="flex" gap={2}>
                  <FormControl sx={{ flex: 1 }}>
                    <InputLabel>Projekt</InputLabel>
                    <Select
                      value={formData.projectId}
                      onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                      label="Projekt"
                    >
                      <MenuItem value="">Bez projektu</MenuItem>
                      {projects.map((project) => (
                        <MenuItem key={project.id} value={project.id}>
                          {project.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl sx={{ flex: 1 }}>
                    <InputLabel>Typ priradenía</InputLabel>
                    <Select
                      value={formData.assignmentType}
                      onChange={(e) => {
                        setFormData({ 
                          ...formData, 
                          assignmentType: e.target.value,
                          assignedTo: '',
                          teamId: ''
                        });
                      }}
                      label="Typ priradenía"
                    >
                      <MenuItem value="user">Používateľ</MenuItem>
                      <MenuItem value="team">Tím</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
                <Box display="flex" gap={2}>
                  {formData.assignmentType === 'user' ? (
                    <FormControl sx={{ flex: 1 }}>
                      <InputLabel>Priradený používateľ</InputLabel>
                      <Select
                        value={formData.assignedTo}
                        onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                        label="Priradený používateľ"
                      >
                        <MenuItem value="">Nikomu</MenuItem>
                        {employees.map((employee) => (
                          <MenuItem key={employee.id} value={employee.id}>
                            {employee.first_name} {employee.last_name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  ) : (
                    <FormControl sx={{ flex: 1 }}>
                      <InputLabel>Priradený tím</InputLabel>
                      <Select
                        value={formData.teamId}
                        onChange={(e) => setFormData({ ...formData, teamId: e.target.value })}
                        label="Priradený tím"
                      >
                        <MenuItem value="">Žiadny tím</MenuItem>
                        {teams.map((team) => (
                          <MenuItem key={team.id} value={team.id}>
                            {team.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                  <Box sx={{ flex: 1 }}></Box>
                </Box>
                <Box display="flex" gap={2}>
                  <FormControl sx={{ flex: 1 }}>
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      label="Status"
                    >
                      <MenuItem value="pending">Čaká</MenuItem>
                      <MenuItem value="in_progress">V procese</MenuItem>
                      <MenuItem value="completed">Dokončená</MenuItem>
                      <MenuItem value="cancelled">Zrušená</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControl sx={{ flex: 1 }}>
                    <InputLabel>Priorita</InputLabel>
                    <Select
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                      label="Priorita"
                    >
                      <MenuItem value="low">Nízka</MenuItem>
                      <MenuItem value="medium">Stredná</MenuItem>
                      <MenuItem value="high">Vysoká</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
                <DateTimePicker
                  label="Termín"
                  value={formData.dueDate}
                  onChange={(date) => setFormData({ ...formData, dueDate: date })}
                />
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCloseDialog}>Zrušiť</Button>
              <Button 
                onClick={handleSubmit} 
                variant="contained" 
                disabled={loading || !formData.title}
                sx={{
                  background: 'linear-gradient(45deg, #ef5350 30%, #f44336 90%)',
                  boxShadow: '0 3px 5px 2px rgba(244, 67, 54, .3)',
                }}
              >
                {editingTask ? 'Uložiť' : 'Vytvoriť'}
              </Button>
            </DialogActions>
          </Dialog>

          {/* View Dialog */}
          <Dialog 
            open={openViewDialog} 
            onClose={() => setOpenViewDialog(false)} 
            maxWidth="lg" 
            fullWidth
            TransitionComponent={Zoom}
          >
            <DialogTitle>
              {viewingTask?.title}
              <Chip
                label={getStatusLabel(viewingTask?.status)}
                color={getStatusColor(viewingTask?.status)}
                size="small"
                sx={{ ml: 2 }}
              />
              <Chip
                label={getPriorityLabel(viewingTask?.priority)}
                color={getPriorityColor(viewingTask?.priority)}
                size="small"
                sx={{ ml: 1 }}
              />
            </DialogTitle>
            <DialogContent>
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom>Informácie o úlohe:</Typography>
                <Paper sx={{ p: 2, bgcolor: 'background.default', mb: 2 }}>
                  <Box display="flex" flexDirection="column" gap={1}>
                    <Typography variant="body2">
                      <strong>Vytvoril:</strong> {viewingTask?.created_by_first_name} {viewingTask?.created_by_last_name}
                    </Typography>
                    {viewingTask?.project_name && (
                      <Typography variant="body2">
                        <strong>Projekt:</strong> {viewingTask?.project_name}
                      </Typography>
                    )}
                    {viewingTask?.assigned_first_name && (
                      <Typography variant="body2">
                        <strong>Priradený:</strong> {viewingTask?.assigned_first_name} {viewingTask?.assigned_last_name}
                      </Typography>
                    )}
                    {viewingTask?.due_date && (
                      <Typography variant="body2">
                        <strong>Termín dokončenia:</strong> {dayjs(viewingTask.due_date).format('DD.MM.YYYY HH:mm')}
                      </Typography>
                    )}
                  </Box>
                </Paper>
              </Box>
              
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom>Popis úlohy:</Typography>
                <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                  <Typography style={{ whiteSpace: 'pre-wrap' }}>
                    {viewingTask?.description || 'Žiadny popis'}
                  </Typography>
                </Paper>
              </Box>
              
              {/* Attachments Section */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom>Prílohy:</Typography>
                {viewingTask?.attachments?.length > 0 ? (
                  <List dense>
                    {viewingTask.attachments.map((attachment) => (
                      <ListItem key={attachment.id}>
                        <ListItemIcon>
                          {getFileIcon(attachment.mime_type)}
                        </ListItemIcon>
                        <ListItemText
                          primary={attachment.original_name}
                          secondary={`${formatFileSize(attachment.size)} • Nahrané ${attachment.first_name} ${attachment.last_name} • ${dayjs(attachment.created_at).format('DD.MM.YYYY HH:mm')}`}
                        />
                        <IconButton
                          onClick={() => handleDownloadAttachment(attachment.id, attachment.original_name)}
                          size="small"
                        >
                          <Download />
                        </IconButton>
                        {(attachment.uploaded_by === user?.id || hasPermission('manage_tasks')) && (
                          <IconButton
                            onClick={() => handleDeleteAttachment(attachment.id)}
                            size="small"
                            color="error"
                          >
                            <Delete />
                          </IconButton>
                        )}
                      </ListItem>
                    ))}
                  </List>
                ) : (
                  <Typography color="textSecondary">Žiadne prílohy</Typography>
                )}
                
                {/* File Upload */}
                <Box sx={{ mt: 2 }}>
                  <input
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                    id="file-upload"
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip"
                  />
                  <label htmlFor="file-upload">
                    <Button
                      component="span"
                      variant="outlined"
                      startIcon={<CloudUpload />}
                      sx={{ mr: 1 }}
                    >
                      Vybrať súbory
                    </Button>
                  </label>
                  {selectedFiles.length > 0 && (
                    <>
                      <Button
                        variant="contained"
                        onClick={() => handleFileUpload(viewingTask.id)}
                        disabled={uploadingFiles}
                        startIcon={<AttachFile />}
                      >
                        {uploadingFiles ? 'Nahrávanie...' : `Nahrať (${selectedFiles.length})`}
                      </Button>
                      <Box sx={{ mt: 1 }}>
                        {selectedFiles.map((file, index) => (
                          <Chip
                            key={index}
                            label={`${file.name} (${formatFileSize(file.size)})`}
                            size="small"
                            sx={{ mr: 1, mb: 1 }}
                            onDelete={() => setSelectedFiles(prev => prev.filter((_, i) => i !== index))}
                          />
                        ))}
                      </Box>
                    </>
                  )}
                </Box>
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom>Komentáre:</Typography>
                <List>
                  {viewingTask?.comments?.map((comment, index) => (
                    <React.Fragment key={comment.id}>
                      <ListItem>
                        <ListItemText
                          primary={comment.comment}
                          secondary={`${comment.first_name} ${comment.last_name} - ${dayjs(comment.created_at).format('DD.MM.YYYY HH:mm')}`}
                        />
                      </ListItem>
                      {index < viewingTask.comments.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
                
                <Box display="flex" gap={1} mt={2}>
                  <TextField
                    placeholder="Pridať komentár..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    fullWidth
                    multiline
                    rows={2}
                  />
                  <Button
                    variant="contained"
                    onClick={handleAddComment}
                    disabled={!newComment.trim()}
                    startIcon={<Comment />}
                  >
                    Pridať
                  </Button>
                </Box>
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOpenViewDialog(false)}>Zavrieť</Button>
            </DialogActions>
          </Dialog>

          {/* Manual Timesheet Dialog */}
          <Dialog 
            open={openTimesheetDialog} 
            onClose={handleCloseTimesheetDialog} 
            maxWidth="sm" 
            fullWidth
            TransitionComponent={Zoom}
          >
            <DialogTitle>
              Pridať čas pre: {selectedTaskForTimesheet?.title}
            </DialogTitle>
            <DialogContent>
              <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box display="flex" gap={2}>
                  <TextField
                    label="Hodiny"
                    type="number"
                    value={timesheetFormData.hours}
                    onChange={(e) => setTimesheetFormData({ ...timesheetFormData, hours: e.target.value })}
                    inputProps={{ min: 0, max: 24 }}
                    sx={{ flex: 1 }}
                  />
                  <TextField
                    label="Minúty"
                    type="number"
                    value={timesheetFormData.minutes}
                    onChange={(e) => setTimesheetFormData({ ...timesheetFormData, minutes: e.target.value })}
                    inputProps={{ min: 0, max: 59 }}
                    sx={{ flex: 1 }}
                  />
                </Box>
                <DateTimePicker
                  label="Dátum práce"
                  value={timesheetFormData.workDate}
                  onChange={(date) => setTimesheetFormData({ ...timesheetFormData, workDate: date })}
                />
                <TextField
                  label="Popis práce"
                  value={timesheetFormData.description}
                  onChange={(e) => setTimesheetFormData({ ...timesheetFormData, description: e.target.value })}
                  fullWidth
                  multiline
                  rows={3}
                  placeholder="Opíšte čo ste robili..."
                />
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCloseTimesheetDialog}>Zrušiť</Button>
              <Button 
                onClick={handleSubmitTimesheet} 
                variant="contained" 
                disabled={!timesheetFormData.hours && !timesheetFormData.minutes}
                sx={{
                  background: 'linear-gradient(45deg, #4caf50 30%, #66bb6a 90%)',
                  boxShadow: '0 3px 5px 2px rgba(76, 175, 80, .3)',
                }}
              >
                Pridať čas
              </Button>
            </DialogActions>
          </Dialog>

          {/* Potvrdzovací dialóg */}
          <ConfirmDialog
            open={confirmDialog.open}
            onClose={() => setConfirmDialog({ ...confirmDialog, open: false })}
            onConfirm={confirmDialog.onConfirm}
            title={confirmDialog.title}
            message={confirmDialog.message}
            type={confirmDialog.type}
            confirmColor={confirmDialog.confirmColor}
            confirmText={confirmDialog.confirmText || 'Potvrdiť'}
          />

        </Box>
      </Fade>
    </LocalizationProvider>
  );
};

export default Tasks;