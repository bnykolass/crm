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
  Avatar,
  Typography,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Fade,
  Zoom,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Person,
  AdminPanelSettings,
  VpnKey,
  Refresh,
  Block,
  CheckCircle,
  Group,
  PersonAdd,
  PersonRemove,
  PhotoCamera,
  AccountCircle,
} from '@mui/icons-material';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const Users = () => {
  const [currentTab, setCurrentTab] = useState(0);
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [openTeamDialog, setOpenTeamDialog] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editingTeam, setEditingTeam] = useState(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    nickname: '',
    hourlyRate: '',
    role: 'employee',
    permissions: [],
    isActive: true,
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [teamFormData, setTeamFormData] = useState({
    name: '',
    description: '',
    memberIds: [],
  });
  const [showPassword, setShowPassword] = useState(false);
  const [changePassword, setChangePassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { hasPermission } = useAuth();

  useEffect(() => {
    fetchUsers();
    fetchPermissions();
    fetchTeams();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await axios.get('/api/users');
      setUsers(response.data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const fetchPermissions = async () => {
    try {
      const response = await axios.get('/api/users/permissions/list');
      setPermissions(response.data);
    } catch (error) {
      console.error('Failed to fetch permissions:', error);
    }
  };

  const fetchTeams = async () => {
    try {
      const response = await axios.get('/api/teams');
      setTeams(response.data);
    } catch (error) {
      console.error('Failed to fetch teams:', error);
    }
  };

  const handleOpenDialog = (user = null) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        email: user.email,
        password: '',
        firstName: user.first_name,
        lastName: user.last_name,
        nickname: user.nickname || '',
        hourlyRate: user.hourly_rate || '',
        role: user.role,
        permissions: user.permissions || [],
        isActive: user.is_active !== false,
      });
      setPreview(user.profile_photo ? `http://localhost:5555${user.profile_photo}` : null);
    } else {
      setEditingUser(null);
      setFormData({
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        nickname: '',
        hourlyRate: '',
        role: 'employee',
        permissions: [],
        isActive: true,
      });
      setPreview(null);
    }
    setChangePassword(false);
    setShowPassword(false);
    setSelectedFile(null);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingUser(null);
    setChangePassword(false);
    setShowPassword(false);
    setSelectedFile(null);
    setPreview(null);
  };

  const getInitials = () => {
    if (formData.nickname) {
      return formData.nickname.substring(0, 2).toUpperCase();
    }
    const firstName = formData.firstName || '';
    const lastName = formData.lastName || '';
    return `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase();
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Súbor je príliš veľký. Maximálna veľkosť je 5MB.');
        return;
      }
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    // Validácia povinných polí
    if (!formData.email || !formData.firstName || !formData.lastName) {
      alert('Vyplňte všetky povinné polia');
      return;
    }
    
    if (!editingUser && !formData.password) {
      alert('Heslo je povinné pre nového používateľa');
      return;
    }
    
    if (editingUser && changePassword && !formData.password) {
      alert('Zadajte nové heslo');
      return;
    }

    setLoading(true);
    try {
      const submitFormData = new FormData();
      Object.keys(formData).forEach(key => {
        if (key === 'permissions') {
          submitFormData.append(key, JSON.stringify(formData[key]));
        } else {
          submitFormData.append(key, formData[key]);
        }
      });
      
      if (selectedFile) {
        submitFormData.append('profilePhoto', selectedFile);
      }
      
      if (editingUser) {
        await axios.put(`/api/users/${editingUser.id}`, submitFormData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else {
        await axios.post('/api/users', submitFormData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }
      await fetchUsers();
      handleCloseDialog();
    } catch (error) {
      console.error('Failed to save user:', error);
      alert(error.response?.data?.error || 'Nepodarilo sa uložiť používateľa');
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Naozaj chcete vymazať tohto používateľa? (Používateľ s dátami bude len deaktivovaný)')) {
      try {
        const response = await axios.delete(`/api/users/${id}`);
        if (response.data.deactivated) {
          alert(response.data.message);
        }
        await fetchUsers();
      } catch (error) {
        console.error('Failed to delete user:', error);
        alert(error.response?.data?.error || 'Nepodarilo sa vymazať používateľa');
      }
    }
  };

  const handleToggleActive = async (user) => {
    const action = user.is_active ? 'deaktivovať' : 'aktivovať';
    if (window.confirm(`Naozaj chcete ${action} používateľa ${user.first_name} ${user.last_name}?`)) {
      try {
        await axios.put(`/api/users/${user.id}`, {
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          hourlyRate: user.hourly_rate,
          role: user.role,
          permissions: user.permissions,
          isActive: !user.is_active
        });
        await fetchUsers();
      } catch (error) {
        console.error('Failed to toggle user status:', error);
        alert(error.response?.data?.error || `Nepodarilo sa ${action} používateľa`);
      }
    }
  };

  const handlePermissionChange = (permissionName) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permissionName)
        ? prev.permissions.filter(p => p !== permissionName)
        : [...prev.permissions, permissionName]
    }));
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData({ ...formData, password });
    setShowPassword(true);
  };

  if (!hasPermission('manage_users')) {
    return (
      <Box>
        <Typography variant="h5">Nemáte oprávnenie na zobrazenie tejto stránky</Typography>
      </Box>
    );
  }

  return (
    <Fade in timeout={800}>
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'text.primary', mb: 1 }}>
              Používatelia
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Správa používateľov a tímov
            </Typography>
          </Box>
          <Zoom in style={{ transitionDelay: '300ms' }}>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => handleOpenDialog()}
              size="large"
            >
              Pridať používateľa
            </Button>
          </Zoom>
        </Box>

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
                <TableCell>Používateľ</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Rola</TableCell>
                <TableCell>Hodinová sadzba</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Akcie</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {/* Aktívni používatelia */}
              {users.filter(u => u.is_active).map((user, index) => (
                <TableRow 
                  key={user.id}
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
                      backgroundColor: 'action.hover',
                    },
                  }}
                >
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Avatar 
                        src={user.profile_photo ? `http://localhost:5555${user.profile_photo}` : undefined}
                        sx={{ width: 40, height: 40 }}
                      >
                        {user.nickname 
                          ? user.nickname.substring(0, 2).toUpperCase()
                          : `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`
                        }
                      </Avatar>
                      <Box>
                        <Typography variant="body2">
                          {user.nickname || `${user.first_name} ${user.last_name}`}
                        </Typography>
                        {user.nickname && (
                          <Typography variant="caption" color="text.secondary">
                            {user.first_name} {user.last_name}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Chip
                      icon={user.role === 'admin' ? <AdminPanelSettings /> : <Person />}
                      label={user.role === 'admin' ? 'Admin' : 'Zamestnanec'}
                      sx={{
                        background: user.role === 'admin' 
                          ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                          : 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
                        color: '#ffffff',
                        fontWeight: 600,
                      }}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {user.hourly_rate ? `€${user.hourly_rate}/h` : '-'}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={user.is_active ? 'Aktívny' : 'Neaktívny'}
                      color={user.is_active ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton 
                      onClick={() => handleOpenDialog(user)}
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
                      onClick={() => handleToggleActive(user)}
                      sx={{ 
                        color: user.is_active ? 'warning.main' : 'success.main',
                        '&:hover': {
                          transform: 'scale(1.1)',
                        },
                      }}
                      title={user.is_active ? 'Deaktivovať' : 'Aktivovať'}
                    >
                      {user.is_active ? <Block /> : <CheckCircle />}
                    </IconButton>
                    <IconButton 
                      onClick={() => handleDelete(user.id)}
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
              
              {/* Oddeľovač ak existujú neaktívni používatelia */}
              {users.filter(u => !u.is_active).length > 0 && (
                <TableRow>
                  <TableCell colSpan={6} sx={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.05)', 
                    textAlign: 'center',
                    fontWeight: 'bold',
                    py: 2
                  }}>
                    Neaktívni používatelia
                  </TableCell>
                </TableRow>
              )}
              
              {/* Neaktívni používatelia */}
              {users.filter(u => !u.is_active).map((user, index) => (
                <TableRow 
                  key={user.id}
                  sx={{
                    animation: `fadeInUp 0.5s ease-out ${(users.filter(u => u.is_active).length + index) * 0.1}s`,
                    animationFillMode: 'both',
                    opacity: 0.6,
                    '@keyframes fadeInUp': {
                      from: {
                        opacity: 0,
                        transform: 'translateY(20px)',
                      },
                      to: {
                        opacity: 0.6,
                        transform: 'translateY(0)',
                      },
                    },
                    '&:hover': {
                      backgroundColor: 'rgba(144, 202, 249, 0.08)',
                      opacity: 0.8,
                    },
                  }}
                >
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Avatar 
                        src={user.profile_photo ? `http://localhost:5555${user.profile_photo}` : undefined}
                        sx={{ width: 40, height: 40 }}
                      >
                        {user.nickname 
                          ? user.nickname.substring(0, 2).toUpperCase()
                          : `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`
                        }
                      </Avatar>
                      <Box>
                        <Typography variant="body2">
                          {user.nickname || `${user.first_name} ${user.last_name}`}
                        </Typography>
                        {user.nickname && (
                          <Typography variant="caption" color="text.secondary">
                            {user.first_name} {user.last_name}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Chip
                      icon={user.role === 'admin' ? <AdminPanelSettings /> : <Person />}
                      label={user.role === 'admin' ? 'Admin' : 'Zamestnanec'}
                      sx={{
                        background: user.role === 'admin' 
                          ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                          : 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
                        color: '#ffffff',
                        fontWeight: 600,
                      }}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {user.hourly_rate ? `€${user.hourly_rate}/h` : '-'}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label="Neaktívny"
                      color="default"
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton 
                      onClick={() => handleOpenDialog(user)}
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
                      onClick={() => handleToggleActive(user)}
                      sx={{ 
                        color: user.is_active ? 'warning.main' : 'success.main',
                        '&:hover': {
                          transform: 'scale(1.1)',
                        },
                      }}
                      title={user.is_active ? 'Deaktivovať' : 'Aktivovať'}
                    >
                      {user.is_active ? <Block /> : <CheckCircle />}
                    </IconButton>
                    <IconButton 
                      onClick={() => handleDelete(user.id)}
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
          maxWidth="sm" 
          fullWidth
          TransitionComponent={Zoom}
        >
          <DialogTitle>
            {editingUser ? 'Upraviť používateľa' : 'Pridať nového používateľa'}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                fullWidth
                required
              />
              {(!editingUser || changePassword) && (
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
                  <TextField
                    label={editingUser ? "Nové heslo" : "Heslo"}
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    fullWidth
                    required
                    InputProps={{
                      endAdornment: (
                        <IconButton
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                          size="small"
                        >
                          <VpnKey />
                        </IconButton>
                      ),
                    }}
                  />
                  <IconButton
                    onClick={generatePassword}
                    color="primary"
                    title="Generovať heslo"
                  >
                    <Refresh />
                  </IconButton>
                </Box>
              )}
              {editingUser && !changePassword && (
                <Button
                  startIcon={<VpnKey />}
                  onClick={() => setChangePassword(true)}
                  variant="outlined"
                  size="small"
                >
                  Zmeniť heslo
                </Button>
              )}
              <TextField
                label="Meno"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                fullWidth
                required
              />
              <TextField
                label="Priezvisko"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                fullWidth
                required
              />
              <TextField
                label="Prezývka"
                value={formData.nickname}
                onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                fullWidth
                helperText="Nepovinné - zobrazuje sa v chate a notifikáciách"
              />
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box position="relative" display="inline-block">
                  <Avatar
                    src={preview}
                    sx={{ width: 80, height: 80, fontSize: '2rem' }}
                  >
                    {getInitials()}
                  </Avatar>
                  <IconButton
                    color="primary"
                    aria-label="upload picture"
                    component="label"
                    sx={{
                      position: 'absolute',
                      bottom: -4,
                      right: -4,
                      backgroundColor: 'background.paper',
                      '&:hover': {
                        backgroundColor: 'background.paper',
                      },
                    }}
                  >
                    <input
                      hidden
                      accept="image/*"
                      type="file"
                      onChange={handleFileSelect}
                    />
                    <PhotoCamera />
                  </IconButton>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Profilová fotka
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Maximálne 5MB
                  </Typography>
                </Box>
              </Box>
              <TextField
                label="Hodinová sadzba (€)"
                type="number"
                value={formData.hourlyRate}
                onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value })}
                fullWidth
              />
              <FormControl fullWidth>
                <InputLabel>Rola</InputLabel>
                <Select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  label="Rola"
                >
                  <MenuItem value="employee">Zamestnanec</MenuItem>
                  <MenuItem value="admin">Admin</MenuItem>
                </Select>
              </FormControl>
              
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    color="primary"
                  />
                }
                label="Aktívny používateľ"
                sx={{ mt: 1 }}
              />
              
              <Typography variant="subtitle1" sx={{ mt: 2 }}>
                Oprávnenia
              </Typography>
              <FormGroup>
                {permissions.map((permission) => (
                  <FormControlLabel
                    key={permission.id}
                    control={
                      <Checkbox
                        checked={formData.permissions.includes(permission.name)}
                        onChange={() => handlePermissionChange(permission.name)}
                        disabled={formData.role === 'admin'}
                      />
                    }
                    label={permission.description || permission.name}
                  />
                ))}
              </FormGroup>
              {formData.role === 'admin' && (
                <Typography variant="caption" color="text.secondary">
                  Admin má automaticky všetky oprávnenia
                </Typography>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Zrušiť</Button>
            <Button 
              onClick={handleSubmit} 
              variant="contained" 
              disabled={loading}
            >
              {editingUser ? 'Uložiť' : 'Vytvoriť'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Fade>
  );
};

export default Users;