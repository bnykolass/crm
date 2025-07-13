import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Avatar,
  Grid,
  IconButton,
  Divider,
  Alert,
  Snackbar,
} from '@mui/material';
import {
  AccountCircle,
  PhotoCamera,
  Save,
  Edit,
} from '@mui/icons-material';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const Profile = () => {
  const { user, refreshAuth } = useAuth();
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    nickname: '',
    email: '',
    profilePhoto: '',
  });
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [alert, setAlert] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await axios.get('/api/users/profile');
      setProfileData({
        firstName: response.data.first_name,
        lastName: response.data.last_name,
        nickname: response.data.nickname || '',
        email: response.data.email,
        profilePhoto: response.data.profile_photo || '',
      });
      setPreview(response.data.profile_photo ? `http://localhost:5555${response.data.profile_photo}` : null);
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      setAlert({
        open: true,
        message: 'Nepodarilo sa načítať profil',
        severity: 'error',
      });
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setAlert({
          open: true,
          message: 'Súbor je príliš veľký. Maximum je 5MB.',
          severity: 'error',
        });
        return;
      }
      
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('firstName', profileData.firstName);
      formData.append('lastName', profileData.lastName);
      formData.append('nickname', profileData.nickname);
      
      if (selectedFile) {
        formData.append('profilePhoto', selectedFile);
      }

      const response = await axios.put('/api/users/profile', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setAlert({
        open: true,
        message: 'Profil bol úspešne aktualizovaný',
        severity: 'success',
      });
      
      setEditMode(false);
      setSelectedFile(null);
      await refreshAuth(); // Refresh auth context to update user data
      fetchProfile(); // Refresh profile data
    } catch (error) {
      console.error('Failed to update profile:', error);
      setAlert({
        open: true,
        message: error.response?.data?.error || 'Nepodarilo sa aktualizovať profil',
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setEditMode(false);
    setSelectedFile(null);
    fetchProfile(); // Reset to original data
  };

  const getInitials = () => {
    const name = profileData.nickname || `${profileData.firstName} ${profileData.lastName}`;
    return profileData.nickname 
      ? profileData.nickname.substring(0, 2).toUpperCase()
      : `${profileData.firstName?.[0] || ''}${profileData.lastName?.[0] || ''}`;
  };

  return (
    <Box p={3}>
      <Typography variant="h4" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
        <AccountCircle fontSize="large" />
        Môj profil
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card sx={{ boxShadow: 3 }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <Box position="relative" display="inline-block">
                <Avatar
                  src={preview}
                  sx={{
                    width: 150,
                    height: 150,
                    fontSize: '3rem',
                    mb: 2,
                  }}
                >
                  {getInitials()}
                </Avatar>
                {editMode && (
                  <IconButton
                    color="primary"
                    aria-label="upload picture"
                    component="label"
                    sx={{
                      position: 'absolute',
                      bottom: 16,
                      right: -8,
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
                )}
              </Box>
              
              <Typography variant="h5" gutterBottom>
                {profileData.nickname || `${profileData.firstName} ${profileData.lastName}`}
              </Typography>
              
              <Typography variant="body2" color="text.secondary">
                {profileData.email}
              </Typography>
              
              {profileData.nickname && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {profileData.firstName} {profileData.lastName}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={8}>
          <Card sx={{ boxShadow: 3 }}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h6">Osobné údaje</Typography>
                {!editMode ? (
                  <Button
                    startIcon={<Edit />}
                    onClick={() => setEditMode(true)}
                    variant="outlined"
                  >
                    Upraviť
                  </Button>
                ) : (
                  <Box display="flex" gap={1}>
                    <Button
                      onClick={handleCancel}
                      variant="outlined"
                    >
                      Zrušiť
                    </Button>
                    <Button
                      startIcon={<Save />}
                      onClick={handleSubmit}
                      variant="contained"
                      disabled={loading}
                    >
                      Uložiť
                    </Button>
                  </Box>
                )}
              </Box>

              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Meno"
                    value={profileData.firstName}
                    onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
                    fullWidth
                    disabled={!editMode}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Priezvisko"
                    value={profileData.lastName}
                    onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })}
                    fullWidth
                    disabled={!editMode}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Prezývka"
                    value={profileData.nickname}
                    onChange={(e) => setProfileData({ ...profileData, nickname: e.target.value })}
                    fullWidth
                    disabled={!editMode}
                    helperText="Prezývka sa bude zobrazovať v chate a notifikáciách"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Email"
                    value={profileData.email}
                    fullWidth
                    disabled
                    helperText="Email nie je možné zmeniť"
                  />
                </Grid>
              </Grid>

              <Divider sx={{ my: 3 }} />

              <Typography variant="h6" gutterBottom>
                Informácie o účte
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    Rola
                  </Typography>
                  <Typography variant="body1">
                    {user?.role === 'admin' ? 'Administrátor' : 'Zamestnanec'}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    ID používateľa
                  </Typography>
                  <Typography variant="body1">
                    {user?.id}
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Snackbar
        open={alert.open}
        autoHideDuration={6000}
        onClose={() => setAlert({ ...alert, open: false })}
      >
        <Alert
          onClose={() => setAlert({ ...alert, open: false })}
          severity={alert.severity}
          sx={{ width: '100%' }}
        >
          {alert.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Profile;