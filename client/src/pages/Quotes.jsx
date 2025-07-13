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
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Description,
  Send,
  Comment,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const Quotes = () => {
  const [quotes, setQuotes] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [projects, setProjects] = useState([]);
  const [reviewers, setReviewers] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [openViewDialog, setOpenViewDialog] = useState(false);
  const [editingQuote, setEditingQuote] = useState(null);
  const [viewingQuote, setViewingQuote] = useState(null);
  const [newComment, setNewComment] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    companyId: '',
    projectId: '',
    totalAmount: '',
    validUntil: null,
    status: 'draft',
  });
  const [loading, setLoading] = useState(false);
  const { hasPermission } = useAuth();

  useEffect(() => {
    fetchQuotes();
    fetchCompanies();
    fetchReviewers();
  }, []);

  const fetchQuotes = async () => {
    try {
      const response = await axios.get('/api/quotes');
      setQuotes(response.data);
    } catch (error) {
      console.error('Failed to fetch quotes:', error);
    }
  };

  const fetchCompanies = async () => {
    try {
      const response = await axios.get('/api/quotes/companies/list');
      setCompanies(response.data);
    } catch (error) {
      console.error('Failed to fetch companies:', error);
    }
  };

  const fetchProjects = async (companyId) => {
    try {
      const response = await axios.get(`/api/quotes/projects/list?companyId=${companyId}`);
      setProjects(response.data);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    }
  };

  const fetchReviewers = async () => {
    try {
      const response = await axios.get('/api/quotes/reviewers/list');
      setReviewers(response.data);
    } catch (error) {
      console.error('Failed to fetch reviewers:', error);
    }
  };

  const handleOpenDialog = (quote = null) => {
    if (quote) {
      setEditingQuote(quote);
      setFormData({
        title: quote.title,
        content: quote.content || '',
        companyId: quote.company_id || '',
        projectId: quote.project_id || '',
        totalAmount: quote.total_amount || '',
        validUntil: quote.valid_until ? dayjs(quote.valid_until) : null,
        status: quote.status,
      });
      if (quote.company_id) {
        fetchProjects(quote.company_id);
      }
    } else {
      setEditingQuote(null);
      setFormData({
        title: '',
        content: '',
        companyId: '',
        projectId: '',
        totalAmount: '',
        validUntil: null,
        status: 'draft',
      });
      setProjects([]);
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingQuote(null);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const submitData = {
        ...formData,
        validUntil: formData.validUntil ? formData.validUntil.format('YYYY-MM-DD') : null,
      };

      if (editingQuote) {
        await axios.put(`/api/quotes/${editingQuote.id}`, submitData);
      } else {
        await axios.post('/api/quotes', submitData);
      }
      fetchQuotes();
      handleCloseDialog();
    } catch (error) {
      console.error('Failed to save quote:', error);
      alert(error.response?.data?.error || 'Nepodarilo sa uložiť cenové ponuku');
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Naozaj chcete vymazať túto cenové ponuku?')) {
      try {
        await axios.delete(`/api/quotes/${id}`);
        fetchQuotes();
      } catch (error) {
        console.error('Failed to delete quote:', error);
        alert(error.response?.data?.error || 'Nepodarilo sa vymazať cenové ponuku');
      }
    }
  };

  const handleViewQuote = async (quote) => {
    try {
      const response = await axios.get(`/api/quotes/${quote.id}`);
      setViewingQuote(response.data);
      setOpenViewDialog(true);
    } catch (error) {
      console.error('Failed to fetch quote details:', error);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    
    try {
      await axios.post(`/api/quotes/${viewingQuote.id}/comments`, {
        comment: newComment
      });
      setNewComment('');
      // Refresh quote details
      handleViewQuote(viewingQuote);
    } catch (error) {
      console.error('Failed to add comment:', error);
    }
  };

  const handleCompanyChange = (companyId) => {
    setFormData({ ...formData, companyId, projectId: '' });
    if (companyId) {
      fetchProjects(companyId);
    } else {
      setProjects([]);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'draft': return 'default';
      case 'pending_review': return 'warning';
      case 'approved': return 'success';
      case 'rejected': return 'error';
      case 'sent': return 'info';
      default: return 'default';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'draft': return 'Návrh';
      case 'pending_review': return 'Na kontrole';
      case 'approved': return 'Schválená';
      case 'rejected': return 'Zamietnutá';
      case 'sent': return 'Odoslaná';
      default: return status;
    }
  };

  if (!hasPermission('manage_quotes')) {
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
              <Description fontSize="large" />
              Cenové ponuky
            </Typography>
            <Zoom in style={{ transitionDelay: '300ms' }}>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => handleOpenDialog()}
                sx={{
                  background: 'linear-gradient(45deg, #f48fb1 30%, #e91e63 90%)',
                  boxShadow: '0 3px 5px 2px rgba(233, 30, 99, .3)',
                }}
              >
                Pridať ponuku
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
                  <TableCell>Projekt</TableCell>
                  <TableCell>Suma</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Platnosť</TableCell>
                  <TableCell align="right">Akcie</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {quotes.map((quote, index) => (
                  <TableRow 
                    key={quote.id}
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
                        backgroundColor: 'rgba(244, 143, 177, 0.08)',
                      },
                    }}
                  >
                    <TableCell>
                      <Typography 
                        variant="subtitle1" 
                        fontWeight="bold"
                        sx={{ cursor: 'pointer' }}
                        onClick={() => handleViewQuote(quote)}
                      >
                        {quote.title}
                      </Typography>
                    </TableCell>
                    <TableCell>{quote.company_name || '-'}</TableCell>
                    <TableCell>{quote.project_name || '-'}</TableCell>
                    <TableCell>
                      {quote.total_amount ? `€${quote.total_amount}` : '-'}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={getStatusLabel(quote.status)}
                        color={getStatusColor(quote.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {quote.valid_until 
                        ? dayjs(quote.valid_until).format('DD.MM.YYYY')
                        : '-'
                      }
                    </TableCell>
                    <TableCell align="right">
                      <IconButton 
                        onClick={() => handleViewQuote(quote)}
                        sx={{ 
                          color: 'info.main',
                          '&:hover': {
                            transform: 'scale(1.1)',
                          },
                        }}
                      >
                        <Description />
                      </IconButton>
                      <IconButton 
                        onClick={() => handleOpenDialog(quote)}
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
                        onClick={() => handleDelete(quote.id)}
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

          {/* Edit/Create Dialog */}
          <Dialog 
            open={openDialog} 
            onClose={handleCloseDialog} 
            maxWidth="md" 
            fullWidth
            TransitionComponent={Zoom}
          >
            <DialogTitle>
              {editingQuote ? 'Upraviť cenové ponuku' : 'Pridať novú cenové ponuku'}
            </DialogTitle>
            <DialogContent>
              <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="Názov ponuky"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  fullWidth
                  required
                />
                <TextField
                  label="Obsah ponuky"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  fullWidth
                  multiline
                  rows={6}
                />
                <Box display="flex" gap={2}>
                  <FormControl sx={{ flex: 1 }}>
                    <InputLabel>Firma</InputLabel>
                    <Select
                      value={formData.companyId}
                      onChange={(e) => handleCompanyChange(e.target.value)}
                      label="Firma"
                    >
                      <MenuItem value="">Bez firmy</MenuItem>
                      {companies.map((company) => (
                        <MenuItem key={company.id} value={company.id}>
                          {company.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl sx={{ flex: 1 }}>
                    <InputLabel>Projekt</InputLabel>
                    <Select
                      value={formData.projectId}
                      onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                      label="Projekt"
                      disabled={!formData.companyId}
                    >
                      <MenuItem value="">Bez projektu</MenuItem>
                      {projects.map((project) => (
                        <MenuItem key={project.id} value={project.id}>
                          {project.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
                <Box display="flex" gap={2}>
                  <TextField
                    label="Celková suma (€)"
                    type="number"
                    value={formData.totalAmount}
                    onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })}
                    sx={{ flex: 1 }}
                  />
                  <DatePicker
                    label="Platná do"
                    value={formData.validUntil}
                    onChange={(date) => setFormData({ ...formData, validUntil: date })}
                    sx={{ flex: 1 }}
                  />
                </Box>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    label="Status"
                  >
                    <MenuItem value="draft">Návrh</MenuItem>
                    <MenuItem value="pending_review">Na kontrole</MenuItem>
                    <MenuItem value="approved">Schválená</MenuItem>
                    <MenuItem value="rejected">Zamietnutá</MenuItem>
                    <MenuItem value="sent">Odoslaná</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCloseDialog}>Zrušiť</Button>
              <Button 
                onClick={handleSubmit} 
                variant="contained" 
                disabled={loading || !formData.title}
                sx={{
                  background: 'linear-gradient(45deg, #f48fb1 30%, #e91e63 90%)',
                  boxShadow: '0 3px 5px 2px rgba(233, 30, 99, .3)',
                }}
              >
                {editingQuote ? 'Uložiť' : 'Vytvoriť'}
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
              {viewingQuote?.title}
              <Chip
                label={getStatusLabel(viewingQuote?.status)}
                color={getStatusColor(viewingQuote?.status)}
                size="small"
                sx={{ ml: 2 }}
              />
            </DialogTitle>
            <DialogContent>
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom>Obsah ponuky:</Typography>
                <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                  <Typography style={{ whiteSpace: 'pre-wrap' }}>
                    {viewingQuote?.content || 'Žiadny obsah'}
                  </Typography>
                </Paper>
              </Box>
              
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom>Komentáre:</Typography>
                <List>
                  {viewingQuote?.comments?.map((comment, index) => (
                    <React.Fragment key={comment.id}>
                      <ListItem>
                        <ListItemText
                          primary={comment.comment}
                          secondary={`${comment.first_name} ${comment.last_name} - ${dayjs(comment.created_at).format('DD.MM.YYYY HH:mm')}`}
                        />
                      </ListItem>
                      {index < viewingQuote.comments.length - 1 && <Divider />}
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
        </Box>
      </Fade>
    </LocalizationProvider>
  );
};

export default Quotes;