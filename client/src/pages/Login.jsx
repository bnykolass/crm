import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  InputAdornment,
  IconButton,
} from '@mui/material';
import {
  Email,
  Lock,
  Visibility,
  VisibilityOff,
  Login as LoginIcon,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(email, password);
    
    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error);
    }
    
    setLoading(false);
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #e9ecef 0%, #dee2e6 100%)',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'radial-gradient(circle at 20% 80%, #1976d2 0%, transparent 50%), radial-gradient(circle at 80% 20%, #42a5f5 0%, transparent 50%), radial-gradient(circle at 40% 40%, #2196f3 0%, transparent 50%)',
          opacity: 0.1,
        },
      }}
    >
      <Container component="main" maxWidth="sm">
        <Paper 
          elevation={0} 
          sx={{ 
            p: { xs: 4, md: 6 },
            borderRadius: 4,
            backdropFilter: 'blur(10px)',
            backgroundColor: 'rgba(250, 251, 252, 0.98)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
            transition: 'all 0.3s ease',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: '0 12px 40px 0 rgba(31, 38, 135, 0.2)',
            },
          }}
        >
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Box
              sx={{
                width: 80,
                height: 80,
                borderRadius: '20px',
                background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto',
                mb: 3,
                boxShadow: '0 4px 20px rgba(25, 118, 210, 0.3)',
                transform: 'rotate(45deg)',
                transition: 'transform 0.3s ease',
                '&:hover': {
                  transform: 'rotate(45deg) scale(1.1)',
                },
              }}
            >
              <LoginIcon sx={{ fontSize: 40, color: '#ffffff', transform: 'rotate(-45deg)' }} />
            </Box>
            <Typography 
              component="h1" 
              variant="h4" 
              sx={{ 
                fontWeight: 700,
                color: 'text.primary',
                mb: 1,
                background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              CRM System
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Vitajte späť! Prihláste sa do svojho účtu.
            </Typography>
          </Box>
          
          {error && (
            <Alert 
              severity="error" 
              sx={{ 
                mb: 3,
                borderRadius: 2,
              }}
            >
              {error}
            </Alert>
          )}
          
          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label="Email"
              name="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Email sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: 'rgba(0, 0, 0, 0.02)',
                  '&:hover': {
                    backgroundColor: 'rgba(0, 0, 0, 0.04)',
                  },
                  '&.Mui-focused': {
                    backgroundColor: '#ffffff',
                    boxShadow: '0 0 0 2px rgba(25, 118, 210, 0.1)',
                  },
                },
              }}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="Heslo"
              type={showPassword ? 'text' : 'password'}
              id="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                      sx={{ mr: -1 }}
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: 'rgba(0, 0, 0, 0.02)',
                  '&:hover': {
                    backgroundColor: 'rgba(0, 0, 0, 0.04)',
                  },
                  '&.Mui-focused': {
                    backgroundColor: '#ffffff',
                    boxShadow: '0 0 0 2px rgba(25, 118, 210, 0.1)',
                  },
                },
              }}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={loading}
              startIcon={loading ? null : <LoginIcon />}
              sx={{ 
                mt: 4, 
                mb: 2,
                py: 1.5,
                background: loading 
                  ? 'rgba(0, 0, 0, 0.12)'
                  : 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
                boxShadow: loading ? 'none' : '0 4px 20px rgba(25, 118, 210, 0.3)',
                fontSize: '1rem',
                fontWeight: 600,
                transition: 'all 0.3s ease',
                '&:hover': {
                  background: loading 
                    ? 'rgba(0, 0, 0, 0.12)'
                    : 'linear-gradient(135deg, #1565c0 0%, #1976d2 100%)',
                  transform: loading ? 'none' : 'translateY(-2px)',
                  boxShadow: loading ? 'none' : '0 6px 30px rgba(25, 118, 210, 0.4)',
                },
              }}
            >
              {loading ? 'Prihlasovanie...' : 'Prihlásiť sa'}
            </Button>
          </Box>
          
          <Box sx={{ mt: 3, pt: 3, borderTop: '1px solid', borderColor: 'divider' }}>
            <Typography 
              variant="body2" 
              color="text.secondary" 
              align="center"
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
              }}
            >
              <Box 
                component="span"
                sx={{
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 1,
                  backgroundColor: 'primary.main',
                  color: '#ffffff',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                }}
              >
                DEMO
              </Box>
              admin@crm.sk / admin123
            </Typography>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

export default Login;