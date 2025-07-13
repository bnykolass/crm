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
  FormGroup,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Assignment,
  Group,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const Projects = () => {
  const [projects, setProjects] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    companyId: '',
    startDate: null,
    endDate: null,
    budget: '',
    status: 'active',
    employeeIds: [],
  });
  const [loading, setLoading] = useState(false);
  const { hasPermission } = useAuth();

  useEffect(() => {
    fetchProjects();
    fetchCompanies();
    fetchEmployees();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await axios.get('/api/projects');
      setProjects(response.data);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    }
  };

  const fetchCompanies = async () => {
    try {
      const response = await axios.get('/api/projects/companies/list');
      setCompanies(response.data);
    } catch (error) {
      console.error('Failed to fetch companies:', error);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await axios.get('/api/projects/employees/list');
      setEmployees(response.data);
    } catch (error) {
      console.error('Failed to fetch employees:', error);
    }
  };

  const handleOpenDialog = (project = null) => {
    if (project) {
      setEditingProject(project);
      setFormData({
        name: project.name,
        description: project.description || '',
        companyId: project.company_id,
        startDate: project.start_date ? dayjs(project.start_date) : null,
        endDate: project.end_date ? dayjs(project.end_date) : null,
        budget: project.budget || '',
        status: project.status,
        employeeIds: project.employees?.map(emp => emp.id) || [],
      });
    } else {
      setEditingProject(null);
      setFormData({
        name: '',
        description: '',
        companyId: '',
        startDate: null,
        endDate: null,
        budget: '',
        status: 'active',
        employeeIds: [],
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingProject(null);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const submitData = {
        ...formData,
        startDate: formData.startDate ? formData.startDate.format('YYYY-MM-DD') : null,
        endDate: formData.endDate ? formData.endDate.format('YYYY-MM-DD') : null,
      };

      if (editingProject) {
        await axios.put(`/api/projects/${editingProject.id}`, submitData);
      } else {
        await axios.post('/api/projects', submitData);
      }
      fetchProjects();
      handleCloseDialog();
    } catch (error) {
      console.error('Failed to save project:', error);
      alert(error.response?.data?.error || 'Nepodarilo sa uložiť projekt');
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Naozaj chcete vymazať tento projekt?')) {
      try {
        await axios.delete(`/api/projects/${id}`);
        fetchProjects();
      } catch (error) {
        console.error('Failed to delete project:', error);
        alert(error.response?.data?.error || 'Nepodarilo sa vymazať projekt');
      }
    }
  };

  const handleEmployeeChange = (employeeId) => {
    setFormData(prev => ({
      ...prev,
      employeeIds: prev.employeeIds.includes(employeeId)
        ? prev.employeeIds.filter(id => id !== employeeId)
        : [...prev.employeeIds, employeeId]
    }));
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'success';
      case 'completed': return 'primary';
      case 'on_hold': return 'warning';
      case 'cancelled': return 'error';
      default: return 'default';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'active': return 'Aktívny';
      case 'completed': return 'Dokončený';
      case 'on_hold': return 'Pozastavený';
      case 'cancelled': return 'Zrušený';
      default: return status;
    }
  };

  if (!hasPermission('manage_projects')) {
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
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Assignment fontSize="large" />
              Projekty
            </Typography>
            <Zoom in style={{ transitionDelay: '300ms' }}>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => handleOpenDialog()}
                sx={{
                  background: 'linear-gradient(45deg, #ffa726 30%, #ff9800 90%)',
                  boxShadow: '0 3px 5px 2px rgba(255, 152, 0, .3)',
                }}
              >
                Pridať projekt
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
                  <TableCell>Názov</TableCell>
                  <TableCell>Firma</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Tím</TableCell>
                  <TableCell>Rozpočet</TableCell>
                  <TableCell>Termín</TableCell>
                  <TableCell align="right">Akcie</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {projects.map((project, index) => (
                  <TableRow 
                    key={project.id}
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
                        backgroundColor: 'rgba(255, 167, 38, 0.08)',
                      },
                    }}
                  >
                    <TableCell>
                      <Typography variant="subtitle1" fontWeight="bold">
                        {project.name}
                      </Typography>
                      {project.description && (
                        <Typography variant="caption" color="text.secondary">
                          {project.description}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{project.company_name}</TableCell>
                    <TableCell>
                      <Chip
                        label={getStatusLabel(project.status)}
                        color={getStatusColor(project.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Group fontSize="small" />
                        {project.employee_count}
                      </Box>
                    </TableCell>
                    <TableCell>
                      {project.budget ? `€${project.budget}` : '-'}
                    </TableCell>
                    <TableCell>
                      {project.end_date 
                        ? dayjs(project.end_date).format('DD.MM.YYYY')
                        : '-'
                      }
                    </TableCell>
                    <TableCell align="right">
                      <IconButton 
                        onClick={() => handleOpenDialog(project)}
                        sx={{ 
                          color: 'primary.main',
                          '&:hover': {
                            transform: 'scale(1.1)',
                          },
                        }}
                      >
                        <Edit />
                      </IconButton>
                      <IconButton 
                        onClick={() => handleDelete(project.id)}
                        sx={{ 
                          color: 'error.main',
                          '&:hover': {
                            transform: 'scale(1.1)',
                          },
                        }}
                      >
                        <Delete />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Dialog 
            open={openDialog} 
            onClose={handleCloseDialog} 
            maxWidth="md" 
            fullWidth
            TransitionComponent={Zoom}
          >
            <DialogTitle>
              {editingProject ? 'Upraviť projekt' : 'Pridať nový projekt'}
            </DialogTitle>
            <DialogContent>
              <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="Názov projektu"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
                <FormControl fullWidth required>
                  <InputLabel>Firma</InputLabel>
                  <Select
                    value={formData.companyId}
                    onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
                    label="Firma"
                  >
                    {companies.map((company) => (
                      <MenuItem key={company.id} value={company.id}>
                        {company.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Box display="flex" gap={2}>
                  <DatePicker
                    label="Začiatok"
                    value={formData.startDate}
                    onChange={(date) => setFormData({ ...formData, startDate: date })}
                    sx={{ flex: 1 }}
                  />
                  <DatePicker
                    label="Koniec"
                    value={formData.endDate}
                    onChange={(date) => setFormData({ ...formData, endDate: date })}
                    sx={{ flex: 1 }}
                  />
                </Box>
                <Box display="flex" gap={2}>
                  <TextField
                    label="Rozpočet (€)"
                    type="number"
                    value={formData.budget}
                    onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                    sx={{ flex: 1 }}
                  />
                  <FormControl sx={{ flex: 1 }}>
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      label="Status"
                    >
                      <MenuItem value="active">Aktívny</MenuItem>
                      <MenuItem value="completed">Dokončený</MenuItem>
                      <MenuItem value="on_hold">Pozastavený</MenuItem>
                      <MenuItem value="cancelled">Zrušený</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
                
                <Typography variant="subtitle1" sx={{ mt: 2 }}>
                  Pridelení zamestnanci
                </Typography>
                <FormGroup>
                  {employees.map((employee) => (
                    <FormControlLabel
                      key={employee.id}
                      control={
                        <Checkbox
                          checked={formData.employeeIds.includes(employee.id)}
                          onChange={() => handleEmployeeChange(employee.id)}
                        />
                      }
                      label={`${employee.first_name} ${employee.last_name} (${employee.email})`}
                    />
                  ))}
                </FormGroup>
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCloseDialog}>Zrušiť</Button>
              <Button 
                onClick={handleSubmit} 
                variant="contained" 
                disabled={loading || !formData.name || !formData.companyId}
                sx={{
                  background: 'linear-gradient(45deg, #ffa726 30%, #ff9800 90%)',
                  boxShadow: '0 3px 5px 2px rgba(255, 152, 0, .3)',
                }}
              >
                {editingProject ? 'Uložiť' : 'Vytvoriť'}
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      </Fade>
    </LocalizationProvider>
  );
};

export default Projects;