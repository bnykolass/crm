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
  Fade,
  Zoom,
  Chip,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Business,
} from '@mui/icons-material';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const Companies = () => {
  const [companies, setCompanies] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    taxId: '',
  });
  const [loading, setLoading] = useState(false);
  const { hasPermission } = useAuth();

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      const response = await axios.get('/api/companies');
      setCompanies(response.data);
    } catch (error) {
      console.error('Failed to fetch companies:', error);
    }
  };

  const handleOpenDialog = (company = null) => {
    if (company) {
      setEditingCompany(company);
      setFormData({
        name: company.name,
        email: company.email || '',
        phone: company.phone || '',
        address: company.address || '',
        taxId: company.tax_id || '',
      });
    } else {
      setEditingCompany(null);
      setFormData({
        name: '',
        email: '',
        phone: '',
        address: '',
        taxId: '',
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingCompany(null);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      if (editingCompany) {
        await axios.put(`/api/companies/${editingCompany.id}`, formData);
      } else {
        await axios.post('/api/companies', formData);
      }
      fetchCompanies();
      handleCloseDialog();
    } catch (error) {
      console.error('Failed to save company:', error);
      alert(error.response?.data?.error || 'Nepodarilo sa uložiť firmu');
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Naozaj chcete vymazať túto firmu?')) {
      try {
        await axios.delete(`/api/companies/${id}`);
        fetchCompanies();
      } catch (error) {
        console.error('Failed to delete company:', error);
        alert(error.response?.data?.error || 'Nepodarilo sa vymazať firmu');
      }
    }
  };

  if (!hasPermission('manage_companies')) {
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
          <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Business fontSize="large" />
            Firmy
          </Typography>
          <Zoom in style={{ transitionDelay: '300ms' }}>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => handleOpenDialog()}
              sx={{
                background: 'linear-gradient(45deg, #66bb6a 30%, #4caf50 90%)',
                boxShadow: '0 3px 5px 2px rgba(76, 175, 80, .3)',
              }}
            >
              Pridať firmu
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
                <TableCell>Email</TableCell>
                <TableCell>Telefón</TableCell>
                <TableCell>IČO</TableCell>
                <TableCell>Vytvoril</TableCell>
                <TableCell align="right">Akcie</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {companies.map((company, index) => (
                <TableRow 
                  key={company.id}
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
                      backgroundColor: 'rgba(102, 187, 106, 0.08)',
                    },
                  }}
                >
                  <TableCell>
                    <Typography variant="subtitle1" fontWeight="bold">
                      {company.name}
                    </Typography>
                    {company.address && (
                      <Typography variant="caption" color="text.secondary">
                        {company.address}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{company.email || '-'}</TableCell>
                  <TableCell>{company.phone || '-'}</TableCell>
                  <TableCell>{company.tax_id || '-'}</TableCell>
                  <TableCell>
                    {company.first_name} {company.last_name}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton 
                      onClick={() => handleOpenDialog(company)}
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
                      onClick={() => handleDelete(company.id)}
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
            {editingCompany ? 'Upraviť firmu' : 'Pridať novú firmu'}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Názov firmy"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                fullWidth
                required
              />
              <TextField
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                fullWidth
              />
              <TextField
                label="Telefón"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                fullWidth
              />
              <TextField
                label="Adresa"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                fullWidth
                multiline
                rows={2}
              />
              <TextField
                label="IČO"
                value={formData.taxId}
                onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                fullWidth
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Zrušiť</Button>
            <Button 
              onClick={handleSubmit} 
              variant="contained" 
              disabled={loading || !formData.name}
              sx={{
                background: 'linear-gradient(45deg, #66bb6a 30%, #4caf50 90%)',
                boxShadow: '0 3px 5px 2px rgba(76, 175, 80, .3)',
              }}
            >
              {editingCompany ? 'Uložiť' : 'Vytvoriť'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Fade>
  );
};

export default Companies;