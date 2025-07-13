import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Avatar,
  AvatarGroup,
  Autocomplete,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Group,
  Person,
  PersonAdd,
  PersonRemove,
} from '@mui/icons-material';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import ConfirmDialog from '../components/ConfirmDialog';

const Teams = () => {
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [openMembersDialog, setOpenMembersDialog] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: '',
    message: '',
    onConfirm: null,
  });
  const { user, hasPermission } = useAuth();

  useEffect(() => {
    fetchTeams();
    fetchUsers();
  }, []);

  const fetchTeams = async () => {
    try {
      const response = await axios.get('/api/teams');
      setTeams(response.data);
    } catch (error) {
      console.error('Failed to fetch teams:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await axios.get('/api/users');
      setUsers(response.data.filter(u => u.is_active));
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const handleOpenDialog = (team = null) => {
    if (team) {
      setEditingTeam(team);
      setFormData({
        name: team.name,
        description: team.description || '',
      });
    } else {
      setEditingTeam(null);
      setFormData({
        name: '',
        description: '',
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingTeam(null);
  };

  const handleSubmit = async () => {
    try {
      if (editingTeam) {
        await axios.put(`/api/teams/${editingTeam.id}`, formData);
      } else {
        await axios.post('/api/teams', formData);
      }
      fetchTeams();
      handleCloseDialog();
    } catch (error) {
      console.error('Failed to save team:', error);
      setConfirmDialog({
        open: true,
        title: 'Chyba',
        message: error.response?.data?.error || 'Nepodarilo sa uložiť tím',
        onConfirm: () => setConfirmDialog({ ...confirmDialog, open: false })
      });
    }
  };

  const handleDelete = (team) => {
    setConfirmDialog({
      open: true,
      title: 'Vymazať tím',
      message: `Naozaj chcete vymazať tím "${team.name}"? Táto akcia sa nedá vrátiť.`,
      onConfirm: async () => {
        try {
          await axios.delete(`/api/teams/${team.id}`);
          fetchTeams();
        } catch (error) {
          console.error('Failed to delete team:', error);
          setConfirmDialog({
            open: true,
            title: 'Chyba',
            message: error.response?.data?.error || 'Nepodarilo sa vymazať tím',
            onConfirm: () => setConfirmDialog({ ...confirmDialog, open: false })
          });
        }
      }
    });
  };

  const handleOpenMembersDialog = (team) => {
    setSelectedTeam(team);
    setOpenMembersDialog(true);
  };

  const handleCloseMembersDialog = () => {
    setOpenMembersDialog(false);
    setSelectedTeam(null);
  };

  const handleAddMember = async (userId) => {
    try {
      await axios.post(`/api/teams/${selectedTeam.id}/members`, { userId });
      fetchTeams();
    } catch (error) {
      console.error('Failed to add member:', error);
      setConfirmDialog({
        open: true,
        title: 'Chyba',
        message: error.response?.data?.error || 'Nepodarilo sa pridať člena',
        onConfirm: () => setConfirmDialog({ ...confirmDialog, open: false })
      });
    }
  };

  const handleRemoveMember = async (userId) => {
    try {
      await axios.delete(`/api/teams/${selectedTeam.id}/members/${userId}`);
      fetchTeams();
    } catch (error) {
      console.error('Failed to remove member:', error);
      setConfirmDialog({
        open: true,
        title: 'Chyba',
        message: error.response?.data?.error || 'Nepodarilo sa odstrániť člena',
        onConfirm: () => setConfirmDialog({ ...confirmDialog, open: false })
      });
    }
  };

  const getAvailableUsers = () => {
    if (!selectedTeam) return [];
    const teamMemberIds = selectedTeam.members?.map(m => m.user_id) || [];
    return users.filter(user => !teamMemberIds.includes(user.id));
  };

  if (!hasPermission('manage_users')) {
    return (
      <Box p={3}>
        <Typography variant="h5" color="error">
          Nemáte oprávnenie na správu tímov
        </Typography>
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Group fontSize="large" />
          Správa tímov
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpenDialog()}
          sx={{
            background: 'linear-gradient(45deg, #ef5350 30%, #f44336 90%)',
            boxShadow: '0 3px 5px 2px rgba(244, 67, 54, .3)',
          }}
        >
          Vytvoriť tím
        </Button>
      </Box>

      <TableContainer component={Paper} sx={{ boxShadow: 3 }}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: 'primary.main' }}>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Názov tímu</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Popis</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Členovia</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Počet členov</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">Akcie</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {teams.map((team) => (
              <TableRow key={team.id} hover>
                <TableCell>
                  <Typography variant="subtitle1" fontWeight="bold">
                    {team.name}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary">
                    {team.description || 'Bez popisu'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <AvatarGroup max={4}>
                    {team.members?.map((member) => (
                      <Avatar
                        key={member.user_id}
                        sx={{ width: 32, height: 32 }}
                        title={`${member.first_name} ${member.last_name}`}
                      >
                        {member.first_name[0]}{member.last_name[0]}
                      </Avatar>
                    )) || []}
                  </AvatarGroup>
                </TableCell>
                <TableCell>
                  <Chip
                    label={team.members?.length || 0}
                    color="primary"
                    size="small"
                  />
                </TableCell>
                <TableCell align="right">
                  <IconButton
                    onClick={() => handleOpenMembersDialog(team)}
                    sx={{ color: 'info.main' }}
                    title="Spravovať členov"
                  >
                    <PersonAdd />
                  </IconButton>
                  <IconButton
                    onClick={() => handleOpenDialog(team)}
                    sx={{ color: 'warning.main' }}
                    title="Upraviť tím"
                  >
                    <Edit />
                  </IconButton>
                  <IconButton
                    onClick={() => handleDelete(team)}
                    sx={{ color: 'error.main' }}
                    title="Vymazať tím"
                  >
                    <Delete />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {teams.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <Typography variant="body1" color="text.secondary">
                    Zatiaľ neboli vytvorené žiadne tímy
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create/Edit Team Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingTeam ? 'Upraviť tím' : 'Vytvoriť nový tím'}
        </DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <TextField
              label="Názov tímu"
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
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Zrušiť</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingTeam ? 'Uložiť' : 'Vytvoriť'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Members Management Dialog */}
      <Dialog open={openMembersDialog} onClose={handleCloseMembersDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          Správa členov tímu: {selectedTeam?.name}
        </DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={3} mt={1}>
            {/* Add new member */}
            <Box>
              <Typography variant="h6" gutterBottom>
                Pridať nového člena
              </Typography>
              <Autocomplete
                options={getAvailableUsers()}
                getOptionLabel={(option) => `${option.first_name} ${option.last_name} (${option.email})`}
                onChange={(event, newValue) => {
                  if (newValue) {
                    handleAddMember(newValue.id);
                  }
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Vyberte používateľa"
                    placeholder="Zadajte meno alebo email"
                  />
                )}
              />
            </Box>

            <Divider />

            {/* Current members */}
            <Box>
              <Typography variant="h6" gutterBottom>
                Aktuálni členovia ({selectedTeam?.members?.length || 0})
              </Typography>
              <List>
                {selectedTeam?.members?.map((member) => (
                  <ListItem key={member.user_id}>
                    <Avatar sx={{ mr: 2 }}>
                      {member.first_name[0]}{member.last_name[0]}
                    </Avatar>
                    <ListItemText
                      primary={`${member.first_name} ${member.last_name}`}
                      secondary={member.email}
                    />
                    <ListItemSecondaryAction>
                      <IconButton
                        edge="end"
                        onClick={() => handleRemoveMember(member.user_id)}
                        sx={{ color: 'error.main' }}
                        title="Odstrániť z tímu"
                      >
                        <PersonRemove />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                )) || (
                  <ListItem>
                    <ListItemText
                      primary="Tím nemá žiadnych členov"
                      secondary="Pridajte členov pomocou formuláru vyššie"
                    />
                  </ListItem>
                )}
              </List>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseMembersDialog}>Zavrieť</Button>
        </DialogActions>
      </Dialog>

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={() => {
          confirmDialog.onConfirm();
          setConfirmDialog({ ...confirmDialog, open: false });
        }}
        onCancel={() => setConfirmDialog({ ...confirmDialog, open: false })}
      />
    </Box>
  );
};

export default Teams;