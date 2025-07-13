import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Grid,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  List,
  ListItem,
  ListItemText,
  Divider,
  FormControlLabel,
  Switch,
  Autocomplete,
} from '@mui/material';
import {
  Add,
  ChevronLeft,
  ChevronRight,
  Event,
  Today,
  Edit,
  Delete,
  AccessTime,
  LocationOn,
  Person,
} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import 'dayjs/locale/sk';
import axios from 'axios';

// Set Slovak locale globally
dayjs.locale('sk');
import { useAuth } from '../context/AuthContext';
import ConfirmDialog from '../components/ConfirmDialog';

const Calendar = () => {
  // Slovak localization
  const slovakDays = ['Pondelok', 'Utorok', 'Streda', 'Štvrtok', 'Piatok', 'Sobota', 'Nedeľa'];
  const slovakDaysShort = ['Po', 'Ut', 'St', 'Št', 'Pi', 'So', 'Ne'];
  const slovakMonths = [
    'Január', 'Február', 'Marec', 'Apríl', 'Máj', 'Jún',
    'Júl', 'August', 'September', 'Október', 'November', 'December'
  ];

  const [currentWeek, setCurrentWeek] = useState(dayjs().startOf('week').add(1, 'day')); // Monday
  const [currentMonth, setCurrentMonth] = useState(dayjs().startOf('month'));
  const [weekEvents, setWeekEvents] = useState([]);
  const [monthEvents, setMonthEvents] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: '',
    message: '',
    onConfirm: null,
  });
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    start_datetime: dayjs(),
    duration_hours: 1,
    duration_minutes: 0,
    all_day: false,
    event_type: 'personal',
    priority: 'medium',
    color: '#1976d2',
    location: '',
    participants: [],
  });
  const { user } = useAuth();

  useEffect(() => {
    fetchWeekEvents();
    fetchEmployees();
  }, [currentWeek]);

  useEffect(() => {
    fetchMonthEvents();
  }, [currentMonth]);

  const fetchWeekEvents = async () => {
    try {
      const weekStart = currentWeek.format('YYYY-MM-DD');
      const response = await axios.get(`/api/calendar/week/${weekStart}`);
      setWeekEvents(response.data.events || []);
    } catch (error) {
      console.error('Failed to fetch week events:', error);
    }
  };

  const fetchMonthEvents = async () => {
    try {
      const monthStart = currentMonth.format('YYYY-MM-DD');
      const monthEnd = currentMonth.endOf('month').format('YYYY-MM-DD');
      const response = await axios.get(`/api/calendar/range/${monthStart}/${monthEnd}`);
      setMonthEvents(response.data.events || []);
    } catch (error) {
      console.error('Failed to fetch month events:', error);
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

  const getWeekDays = () => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = currentWeek.add(i, 'day');
      days.push({
        date: day,
        name: slovakDays[i],
        shortName: slovakDaysShort[i]
      });
    }
    return days;
  };

  const getMonthDays = () => {
    const startOfMonth = currentMonth.startOf('month');
    const endOfMonth = currentMonth.endOf('month');
    const startOfWeek = startOfMonth.startOf('week').add(1, 'day'); // Monday
    const endOfWeek = endOfMonth.endOf('week').add(1, 'day'); // Sunday
    
    const days = [];
    let current = startOfWeek;
    
    while (current.isBefore(endOfWeek) || current.isSame(endOfWeek, 'day')) {
      days.push(current);
      current = current.add(1, 'day');
    }
    
    // Group into weeks
    const weeks = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }
    
    return weeks;
  };

  const getEventsForDay = (day, eventsList) => {
    return eventsList.filter(event => {
      const eventStart = dayjs(event.start_datetime);
      const eventEnd = dayjs(event.end_datetime);
      return (
        eventStart.isSame(day, 'day') || 
        eventEnd.isSame(day, 'day') ||
        (eventStart.isBefore(day, 'day') && eventEnd.isAfter(day, 'day'))
      );
    });
  };

  const handleOpenDialog = (event = null, selectedDate = null) => {
    if (event) {
      setEditingEvent(event);
      const startTime = dayjs(event.start_datetime);
      const endTime = dayjs(event.end_datetime);
      const durationInMinutes = endTime.diff(startTime, 'minute');
      const durationHours = Math.floor(durationInMinutes / 60);
      const durationMinutes = durationInMinutes % 60;
      
      setFormData({
        title: event.title,
        description: event.description || '',
        start_datetime: startTime,
        duration_hours: durationHours,
        duration_minutes: durationMinutes,
        all_day: event.all_day,
        event_type: event.event_type,
        priority: event.priority,
        color: event.color,
        location: event.location || '',
        participants: event.participants?.map(p => p.user_id) || [],
      });
    } else {
      setEditingEvent(null);
      const startTime = selectedDate ? selectedDate.hour(9) : dayjs().hour(9).minute(0);
      setFormData({
        title: '',
        description: '',
        start_datetime: startTime,
        duration_hours: 1,
        duration_minutes: 0,
        all_day: false,
        event_type: 'personal',
        priority: 'medium',
        color: '#1976d2',
        location: '',
        participants: [],
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingEvent(null);
  };

  const handleSubmit = async () => {
    try {
      let startDateTime, endDateTime;
      
      if (formData.all_day) {
        // Pre celý deň nastavíme čas na 00:00 a koniec na 23:59
        startDateTime = formData.start_datetime.startOf('day');
        endDateTime = formData.start_datetime.endOf('day');
      } else {
        startDateTime = formData.start_datetime;
        endDateTime = startDateTime.add(formData.duration_hours, 'hour').add(formData.duration_minutes, 'minute');
      }
      
      const submitData = {
        ...formData,
        start_datetime: startDateTime.toISOString(),
        end_datetime: endDateTime.toISOString(),
      };
      
      // Odstránime duration polia z submitData
      delete submitData.duration_hours;
      delete submitData.duration_minutes;

      if (editingEvent) {
        await axios.put(`/api/calendar/${editingEvent.id}`, submitData);
      } else {
        await axios.post('/api/calendar', submitData);
      }
      
      fetchWeekEvents();
      fetchMonthEvents();
      handleCloseDialog();
      // Trigger update kalendára v menu
      window.dispatchEvent(new CustomEvent('calendarUpdated'));
    } catch (error) {
      console.error('Failed to save event:', error);
      setConfirmDialog({
        open: true,
        title: 'Chyba',
        message: error.response?.data?.error || 'Nepodarilo sa uložiť udalosť',
        onConfirm: () => setConfirmDialog({ ...confirmDialog, open: false })
      });
    }
  };

  const handleDelete = (event) => {
    setConfirmDialog({
      open: true,
      title: 'Vymazať udalosť',
      message: `Naozaj chcete vymazať udalosť "${event.title}"?`,
      onConfirm: async () => {
        try {
          await axios.delete(`/api/calendar/${event.id}`);
          fetchWeekEvents();
          fetchMonthEvents();
          setConfirmDialog({ ...confirmDialog, open: false });
          // Trigger update kalendára v menu
          window.dispatchEvent(new CustomEvent('calendarUpdated'));
        } catch (error) {
          console.error('Failed to delete event:', error);
          setConfirmDialog({
            open: true,
            title: 'Chyba',
            message: 'Nepodarilo sa vymazať udalosť',
            onConfirm: () => setConfirmDialog({ ...confirmDialog, open: false })
          });
        }
      }
    });
  };

  const navigateWeek = (direction) => {
    const newWeek = currentWeek.add(direction, 'week');
    setCurrentWeek(newWeek);
    
    // Update month if week crosses month boundaries
    const newWeekMonth = newWeek.startOf('month');
    if (!currentMonth.isSame(newWeekMonth, 'month')) {
      setCurrentMonth(newWeekMonth);
    }
  };

  const navigateMonth = (direction) => {
    const newMonth = currentMonth.add(direction, 'month');
    setCurrentMonth(newMonth);
    
    // Keep current week within the new month - set to first week of new month
    const firstWeekOfNewMonth = newMonth.startOf('month').startOf('week').add(1, 'day'); // Monday
    setCurrentWeek(firstWeekOfNewMonth);
  };

  const goToToday = () => {
    const today = dayjs();
    setCurrentWeek(today.startOf('week').add(1, 'day'));
    setCurrentMonth(today.startOf('month'));
  };

  const getEventTypeLabel = (type) => {
    const types = {
      personal: 'Osobné',
      meeting: 'Stretnutie',
      deadline: 'Deadline',
      task: 'Úloha'
    };
    return types[type] || type;
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'low': return 'success';
      case 'medium': return 'warning';
      case 'high': return 'error';
      default: return 'default';
    }
  };

  const weekDays = getWeekDays();
  const monthWeeks = getMonthDays();

  const renderEventWithCreator = (event) => {
    const isOwnEvent = event.created_by === user.id;
    const creatorName = event.creator_name;
    
    return (
      <ListItem 
        key={event.id} 
        sx={{ 
          p: 0.5, 
          mb: 0.5,
          borderRadius: 1,
          bgcolor: event.color + '20',
          borderLeft: `3px solid ${event.color}`,
          cursor: 'pointer'
        }}
        onClick={(e) => {
          e.stopPropagation();
          handleOpenDialog(event);
        }}
      >
        <ListItemText
          primary={
            <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
              {event.title}
            </Typography>
          }
          secondary={
            <Box>
              <Typography variant="caption" color="text.secondary">
                {event.all_day ? 'Celý deň' : dayjs(event.start_datetime).format('HH:mm')}
              </Typography>
              {!isOwnEvent && creatorName && (
                <Typography variant="caption" color="text.secondary" display="block">
                  Pridal: {creatorName}
                </Typography>
              )}
            </Box>
          }
        />
      </ListItem>
    );
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box>
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Box display="flex" alignItems="center" gap={2}>
            <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Event fontSize="large" />
              Kalendár
            </Typography>
          </Box>
          
          <Box display="flex" gap={1} alignItems="center">
            <Button
              variant="outlined"
              startIcon={<Today />}
              onClick={goToToday}
            >
              Dnes
            </Button>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => handleOpenDialog()}
              sx={{
                background: 'linear-gradient(45deg, #ef5350 30%, #f44336 90%)',
                boxShadow: '0 3px 5px 2px rgba(244, 67, 54, .3)',
              }}
            >
              Pridať udalosť
            </Button>
          </Box>
        </Box>

        {/* Week View Section */}
        <Box mb={4}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
              Týždenný pohľad
            </Typography>
            <Box display="flex" alignItems="center">
              <IconButton onClick={() => navigateWeek(-1)} size="large">
                <ChevronLeft />
              </IconButton>
              <Typography variant="h6" sx={{ mx: 3, minWidth: 200, textAlign: 'center' }}>
                {`${currentWeek.format('DD.MM')} - ${currentWeek.add(6, 'day').format('DD.MM.YYYY')}`}
              </Typography>
              <IconButton onClick={() => navigateWeek(1)} size="large">
                <ChevronRight />
              </IconButton>
            </Box>
          </Box>
          
          <Grid container spacing={1}>
            {weekDays.map((dayInfo, index) => {
              const day = dayInfo.date;
              const dayEvents = getEventsForDay(day, weekEvents);
              const isToday = day.isSame(dayjs(), 'day');
              
              return (
                <Grid item xs={12} md={1.71} key={index}>
                  <Card 
                    sx={{ 
                      minHeight: 400,
                      border: isToday ? '2px solid #1976d2' : '1px solid rgba(255,255,255,0.1)',
                      cursor: 'pointer'
                    }}
                    onClick={() => handleOpenDialog(null, day)}
                  >
                    <CardContent sx={{ p: 1 }}>
                      <Typography 
                        variant="h6" 
                        align="center" 
                        sx={{ 
                          mb: 1,
                          color: isToday ? 'primary.main' : 'text.primary',
                          fontWeight: isToday ? 'bold' : 'normal'
                        }}
                      >
                        {dayInfo.shortName}
                      </Typography>
                      <Typography 
                        variant="h4" 
                        align="center" 
                        sx={{ 
                          mb: 2,
                          color: isToday ? 'primary.main' : 'text.primary',
                          fontWeight: isToday ? 'bold' : 'normal'
                        }}
                      >
                        {day.format('DD')}
                      </Typography>
                      
                      {/* Events for this day */}
                      <List dense sx={{ p: 0 }}>
                        {dayEvents.slice(0, 3).map((event) => renderEventWithCreator(event))}
                        
                        {dayEvents.length > 3 && (
                          <Typography variant="caption" color="primary" align="center">
                            +{dayEvents.length - 3} ďalších
                          </Typography>
                        )}
                      </List>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </Box>

        {/* Month View Section */}
        <Box>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
              Mesačný pohľad
            </Typography>
            <Box display="flex" alignItems="center">
              <IconButton onClick={() => navigateMonth(-1)} size="large">
                <ChevronLeft />
              </IconButton>
              <Typography variant="h6" sx={{ mx: 3, minWidth: 200, textAlign: 'center' }}>
                {`${slovakMonths[currentMonth.month()]} ${currentMonth.year()}`}
              </Typography>
              <IconButton onClick={() => navigateMonth(1)} size="large">
                <ChevronRight />
              </IconButton>
            </Box>
          </Box>
          
          {/* Month header with day names */}
          <Grid container spacing={1} sx={{ mb: 1 }}>
            {slovakDaysShort.map((dayName, index) => (
              <Grid item xs key={index}>
                <Typography 
                  variant="subtitle2" 
                  align="center" 
                  sx={{ 
                    py: 1, 
                    fontWeight: 'bold',
                    color: 'text.secondary'
                  }}
                >
                  {dayName}
                </Typography>
              </Grid>
            ))}
          </Grid>
          
          {/* Month calendar grid */}
          {monthWeeks.map((week, weekIndex) => (
            <Grid container spacing={1} key={weekIndex} sx={{ mb: 1 }}>
              {week.map((day, dayIndex) => {
                const dayEvents = getEventsForDay(day, monthEvents);
                const isToday = day.isSame(dayjs(), 'day');
                const isCurrentMonth = day.month() === currentMonth.month();
                
                return (
                  <Grid item xs key={dayIndex}>
                    <Card 
                      sx={{ 
                        minHeight: 120,
                        border: isToday ? '2px solid #1976d2' : '1px solid rgba(255,255,255,0.1)',
                        cursor: 'pointer',
                        opacity: isCurrentMonth ? 1 : 0.3
                      }}
                      onClick={() => handleOpenDialog(null, day)}
                    >
                      <CardContent sx={{ p: 0.5 }}>
                        <Typography 
                          variant="body2" 
                          align="center" 
                          sx={{ 
                            mb: 0.5,
                            color: isToday ? 'primary.main' : 'text.primary',
                            fontWeight: isToday ? 'bold' : 'normal'
                          }}
                        >
                          {day.format('D')}
                        </Typography>
                        
                        {/* Events for this day */}
                        <Box sx={{ maxHeight: 80, overflow: 'hidden' }}>
                          {dayEvents.slice(0, 2).map((event) => (
                            <Box
                              key={event.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenDialog(event);
                              }}
                              sx={{
                                p: 0.25,
                                mb: 0.25,
                                borderRadius: 0.5,
                                bgcolor: event.color + '40',
                                borderLeft: `2px solid ${event.color}`,
                                cursor: 'pointer'
                              }}
                            >
                              <Typography 
                                variant="caption" 
                                sx={{ 
                                  fontSize: '0.65rem',
                                  fontWeight: 'bold',
                                  display: 'block',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}
                              >
                                {event.title}
                              </Typography>
                              {event.created_by !== user.id && event.creator_name && (
                                <Typography 
                                  variant="caption" 
                                  color="text.secondary"
                                  sx={{ 
                                    fontSize: '0.6rem',
                                    display: 'block',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                  }}
                                >
                                  Pridal: {event.creator_name}
                                </Typography>
                              )}
                            </Box>
                          ))}
                          
                          {dayEvents.length > 2 && (
                            <Typography 
                              variant="caption" 
                              color="primary" 
                              sx={{ fontSize: '0.6rem' }}
                            >
                              +{dayEvents.length - 2}
                            </Typography>
                          )}
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          ))}
        </Box>

        {/* Event Dialog */}
        <Dialog 
          open={openDialog} 
          onClose={handleCloseDialog} 
          maxWidth="md" 
          fullWidth
        >
          <DialogTitle>
            {editingEvent ? 'Upraviť udalosť' : 'Pridať novú udalosť'}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Názov udalosti"
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

              <FormControlLabel
                control={
                  <Switch
                    checked={formData.all_day}
                    onChange={(e) => setFormData({ ...formData, all_day: e.target.checked })}
                  />
                }
                label="Celý deň"
              />

              {formData.all_day ? (
                <DateTimePicker
                  label="Dátum"
                  value={formData.start_datetime}
                  onChange={(date) => setFormData({ ...formData, start_datetime: date })}
                  views={['year', 'month', 'day']}
                  sx={{ width: '100%' }}
                />
              ) : (
                <Box>
                  <DateTimePicker
                    label="Začiatok"
                    value={formData.start_datetime}
                    onChange={(date) => setFormData({ ...formData, start_datetime: date })}
                    sx={{ width: '100%', mb: 2 }}
                  />
                  
                  <Box display="flex" gap={2}>
                    <TextField
                      label="Trvanie (hodiny)"
                      type="number"
                      value={formData.duration_hours}
                      onChange={(e) => setFormData({ ...formData, duration_hours: parseInt(e.target.value) || 0 })}
                      inputProps={{ min: 0, max: 23 }}
                      sx={{ flex: 1 }}
                    />
                    <TextField
                      label="Trvanie (minúty)"
                      type="number"
                      value={formData.duration_minutes}
                      onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) || 0 })}
                      inputProps={{ min: 0, max: 59 }}
                      sx={{ flex: 1 }}
                    />
                  </Box>
                </Box>
              )}

              <Box display="flex" gap={2}>
                <FormControl sx={{ flex: 1 }}>
                  <InputLabel>Typ udalosti</InputLabel>
                  <Select
                    value={formData.event_type}
                    onChange={(e) => setFormData({ ...formData, event_type: e.target.value })}
                    label="Typ udalosti"
                  >
                    <MenuItem value="personal">Osobné</MenuItem>
                    <MenuItem value="meeting">Stretnutie</MenuItem>
                    <MenuItem value="deadline">Deadline</MenuItem>
                    <MenuItem value="task">Úloha</MenuItem>
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

              <TextField
                label="Miesto"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                fullWidth
              />

              <TextField
                label="Farba"
                type="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                sx={{ width: 100 }}
              />

              <Autocomplete
                multiple
                options={employees}
                getOptionLabel={(option) => `${option.first_name} ${option.last_name}`}
                value={employees.filter(emp => formData.participants.includes(emp.id))}
                onChange={(event, newValue) => {
                  setFormData({ ...formData, participants: newValue.map(emp => emp.id) });
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Účastníci"
                    placeholder="Vyberte účastníkov"
                  />
                )}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            {editingEvent && (
              <Button 
                onClick={() => handleDelete(editingEvent)}
                color="error"
                startIcon={<Delete />}
              >
                Vymazať
              </Button>
            )}
            <Button onClick={handleCloseDialog}>Zrušiť</Button>
            <Button 
              onClick={handleSubmit} 
              variant="contained"
              disabled={!formData.title}
            >
              {editingEvent ? 'Uložiť' : 'Vytvoriť'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Confirm Dialog */}
        <ConfirmDialog
          open={confirmDialog.open}
          onClose={() => setConfirmDialog({ ...confirmDialog, open: false })}
          onConfirm={confirmDialog.onConfirm}
          title={confirmDialog.title}
          message={confirmDialog.message}
        />
      </Box>
    </LocalizationProvider>
  );
};

export default Calendar;