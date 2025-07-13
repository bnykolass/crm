import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
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
  Grid,
  Card,
  CardContent,
  LinearProgress,
  Fade,
  Zoom,
  Alert,
  Snackbar,
} from '@mui/material';
import {
  CloudUpload,
  Download,
  Delete,
  Share,
  Visibility,
  Description,
  Image,
  VideoFile,
  PictureAsPdf,
  InsertDriveFile,
  Person,
  Group,
  Public,
  Business,
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const Files = () => {
  const [files, setFiles] = useState([]);
  const [uploadDialog, setUploadDialog] = useState(false);
  const [shareDialog, setShareDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [shareOptions, setShareOptions] = useState({ users: [], projects: [] });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  
  const [shareData, setShareData] = useState({
    shareType: 'user',
    shareWith: [],
    description: ''
  });

  const { hasPermission } = useAuth();

  useEffect(() => {
    fetchFiles();
    fetchShareOptions();
  }, []);

  const fetchFiles = async () => {
    try {
      const response = await axios.get('/api/files');
      setFiles(response.data);
    } catch (error) {
      console.error('Failed to fetch files:', error);
      showSnackbar('Nepodarilo sa načítať súbory', 'error');
    }
  };

  const fetchShareOptions = async () => {
    try {
      const response = await axios.get('/api/files/share/options');
      setShareOptions(response.data);
    } catch (error) {
      console.error('Failed to fetch share options:', error);
    }
  };

  const showSnackbar = (message, severity) => {
    setSnackbar({ open: true, message, severity });
  };

  const closeSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const getFileIcon = (mimeType) => {
    if (mimeType?.startsWith('image/')) return <Image color="primary" />;
    if (mimeType?.startsWith('video/')) return <VideoFile color="secondary" />;
    if (mimeType?.includes('pdf')) return <PictureAsPdf color="error" />;
    return <InsertDriveFile />;
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const onDrop = async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('description', shareData.description);
    
    if (shareData.shareType !== 'private') {
      formData.append('shareType', shareData.shareType);
      formData.append('shareWith', JSON.stringify(shareData.shareWith));
    }

    try {
      await axios.post('/api/files/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(progress);
        },
      });

      showSnackbar('Súbor bol úspešne nahraný', 'success');
      fetchFiles();
      setUploadDialog(false);
      setShareData({ shareType: 'user', shareWith: [], description: '' });
    } catch (error) {
      console.error('Upload failed:', error);
      showSnackbar(error.response?.data?.error || 'Nepodarilo sa nahrať súbor', 'error');
    }
    setUploading(false);
    setUploadProgress(0);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    disabled: uploading,
  });

  const handleDownload = async (fileId, fileName) => {
    try {
      const response = await axios.get(`/api/files/${fileId}/download`, {
        responseType: 'blob',
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      showSnackbar('Nepodarilo sa stiahnuť súbor', 'error');
    }
  };

  const handleDelete = async (fileId) => {
    if (!window.confirm('Naozaj chcete vymazať tento súbor?')) return;

    try {
      await axios.delete(`/api/files/${fileId}`);
      showSnackbar('Súbor bol úspešne vymazaný', 'success');
      fetchFiles();
    } catch (error) {
      console.error('Delete failed:', error);
      showSnackbar(error.response?.data?.error || 'Nepodarilo sa vymazať súbor', 'error');
    }
  };

  const handleShare = (file) => {
    setSelectedFile(file);
    setShareDialog(true);
  };

  const updateFilePermissions = async () => {
    try {
      await axios.put(`/api/files/${selectedFile.id}/permissions`, {
        shareType: shareData.shareType,
        shareWith: shareData.shareWith,
      });
      
      showSnackbar('Oprávnenia boli úspešne aktualizované', 'success');
      setShareDialog(false);
      fetchFiles();
    } catch (error) {
      console.error('Update permissions failed:', error);
      showSnackbar('Nepodarilo sa aktualizovať oprávnenia', 'error');
    }
  };

  const getShareTypeLabel = (type) => {
    switch (type) {
      case 'user': return 'Používateľ';
      case 'project': return 'Projekt';
      case 'team': return 'Tím';
      case 'public': return 'Verejné';
      default: return 'Súkromné';
    }
  };

  const getShareTypeIcon = (type) => {
    switch (type) {
      case 'user': return <Person fontSize="small" />;
      case 'project': return <Business fontSize="small" />;
      case 'team': return <Group fontSize="small" />;
      case 'public': return <Public fontSize="small" />;
      default: return null;
    }
  };

  if (!hasPermission('use_files')) {
    return (
      <Box>
        <Typography variant="h5">Nemáte oprávnenie na prístup k súborom</Typography>
      </Box>
    );
  }

  return (
    <Fade in timeout={800}>
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Description fontSize="large" />
            Súbory
          </Typography>
          <Zoom in style={{ transitionDelay: '300ms' }}>
            <Button
              variant="contained"
              startIcon={<CloudUpload />}
              onClick={() => setUploadDialog(true)}
              sx={{
                background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
                boxShadow: '0 3px 5px 2px rgba(33, 203, 243, .3)',
              }}
            >
              Nahrať súbor
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
                <TableCell>Súbor</TableCell>
                <TableCell>Veľkosť</TableCell>
                <TableCell>Nahrané</TableCell>
                <TableCell>Zdieľané</TableCell>
                <TableCell>Stiahnuť</TableCell>
                <TableCell align="right">Akcie</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {files.map((file, index) => (
                <TableRow 
                  key={file.id}
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
                      backgroundColor: 'rgba(144, 202, 249, 0.08)',
                    },
                  }}
                >
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      {getFileIcon(file.mime_type)}
                      <Box>
                        <Typography variant="body2" fontWeight="bold">
                          {file.original_name}
                        </Typography>
                        {file.description && (
                          <Typography variant="caption" color="text.secondary">
                            {file.description}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>{formatFileSize(file.size)}</TableCell>
                  <TableCell>
                    <Box>
                      <Typography variant="body2">
                        {file.first_name} {file.last_name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(file.created_at).toLocaleDateString('sk-SK')}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    {file.permissions && file.permissions.split(',').map((perm, i) => (
                      <Chip
                        key={i}
                        icon={getShareTypeIcon(perm)}
                        label={getShareTypeLabel(perm)}
                        size="small"
                        variant="outlined"
                        sx={{ mr: 0.5, mb: 0.5 }}
                      />
                    ))}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {file.download_count || 0}x
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton 
                      onClick={() => handleDownload(file.id, file.original_name)}
                      sx={{ color: 'primary.main' }}
                    >
                      <Download />
                    </IconButton>
                    <IconButton 
                      onClick={() => handleShare(file)}
                      sx={{ color: 'secondary.main' }}
                    >
                      <Share />
                    </IconButton>
                    {file.uploaded_by === files.currentUserId && (
                      <IconButton 
                        onClick={() => handleDelete(file.id)}
                        sx={{ color: 'error.main' }}
                      >
                        <Delete />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Upload Dialog */}
        <Dialog open={uploadDialog} onClose={() => setUploadDialog(false)} maxWidth="md" fullWidth>
          <DialogTitle>Nahrať nový súbor</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2 }}>
              <Card
                {...getRootProps()}
                sx={{
                  p: 4,
                  textAlign: 'center',
                  border: '2px dashed',
                  borderColor: isDragActive ? 'primary.main' : 'grey.500',
                  backgroundColor: isDragActive ? 'action.hover' : 'background.paper',
                  cursor: uploading ? 'not-allowed' : 'pointer',
                  mb: 3,
                }}
              >
                <input {...getInputProps()} />
                <CloudUpload sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  {isDragActive ? 'Pustite súbor sem' : 'Kliknite alebo presuňte súbor sem'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Podporované formáty: obrázky, dokumenty, videá (max. 50MB)
                </Typography>
              </Card>

              {uploading && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="body2" gutterBottom>
                    Nahrávanie... {uploadProgress}%
                  </Typography>
                  <LinearProgress variant="determinate" value={uploadProgress} />
                </Box>
              )}

              <TextField
                label="Popis súboru (voliteľné)"
                value={shareData.description}
                onChange={(e) => setShareData({ ...shareData, description: e.target.value })}
                fullWidth
                multiline
                rows={2}
                sx={{ mb: 3 }}
              />

              <Typography variant="subtitle1" gutterBottom>
                Zdieľanie súboru
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Typ zdieľania</InputLabel>
                    <Select
                      value={shareData.shareType}
                      onChange={(e) => setShareData({ ...shareData, shareType: e.target.value, shareWith: [] })}
                      label="Typ zdieľania"
                    >
                      <MenuItem value="private">Súkromné (iba ja)</MenuItem>
                      <MenuItem value="user">Konkrétni používatelia</MenuItem>
                      <MenuItem value="project">Projekt</MenuItem>
                      <MenuItem value="team">Celý tím</MenuItem>
                      <MenuItem value="public">Verejné</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                {shareData.shareType === 'user' && (
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>Používatelia</InputLabel>
                      <Select
                        multiple
                        value={shareData.shareWith}
                        onChange={(e) => setShareData({ ...shareData, shareWith: e.target.value })}
                        label="Používatelia"
                        renderValue={(selected) => (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {selected.map((value) => {
                              const user = shareOptions.users.find(u => u.id === value);
                              return (
                                <Chip key={value} label={`${user?.first_name} ${user?.last_name}`} size="small" />
                              );
                            })}
                          </Box>
                        )}
                      >
                        {shareOptions.users.map((user) => (
                          <MenuItem key={user.id} value={user.id}>
                            {user.first_name} {user.last_name} ({user.email})
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                )}

                {shareData.shareType === 'project' && (
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>Projekty</InputLabel>
                      <Select
                        multiple
                        value={shareData.shareWith}
                        onChange={(e) => setShareData({ ...shareData, shareWith: e.target.value })}
                        label="Projekty"
                        renderValue={(selected) => (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {selected.map((value) => {
                              const project = shareOptions.projects.find(p => p.id === value);
                              return (
                                <Chip key={value} label={project?.name} size="small" />
                              );
                            })}
                          </Box>
                        )}
                      >
                        {shareOptions.projects.map((project) => (
                          <MenuItem key={project.id} value={project.id}>
                            {project.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                )}
              </Grid>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setUploadDialog(false)} disabled={uploading}>
              Zrušiť
            </Button>
          </DialogActions>
        </Dialog>

        {/* Share Dialog */}
        <Dialog open={shareDialog} onClose={() => setShareDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Zdieľanie súboru: {selectedFile?.original_name}</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Typ zdieľania</InputLabel>
                    <Select
                      value={shareData.shareType}
                      onChange={(e) => setShareData({ ...shareData, shareType: e.target.value, shareWith: [] })}
                      label="Typ zdieľania"
                    >
                      <MenuItem value="private">Súkromné (iba ja)</MenuItem>
                      <MenuItem value="user">Konkrétni používatelia</MenuItem>
                      <MenuItem value="project">Projekt</MenuItem>
                      <MenuItem value="team">Celý tím</MenuItem>
                      <MenuItem value="public">Verejné</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                {shareData.shareType === 'user' && (
                  <Grid item xs={12}>
                    <FormControl fullWidth>
                      <InputLabel>Používatelia</InputLabel>
                      <Select
                        multiple
                        value={shareData.shareWith}
                        onChange={(e) => setShareData({ ...shareData, shareWith: e.target.value })}
                        label="Používatelia"
                        renderValue={(selected) => (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {selected.map((value) => {
                              const user = shareOptions.users.find(u => u.id === value);
                              return (
                                <Chip key={value} label={`${user?.first_name} ${user?.last_name}`} size="small" />
                              );
                            })}
                          </Box>
                        )}
                      >
                        {shareOptions.users.map((user) => (
                          <MenuItem key={user.id} value={user.id}>
                            {user.first_name} {user.last_name} ({user.email})
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                )}

                {shareData.shareType === 'project' && (
                  <Grid item xs={12}>
                    <FormControl fullWidth>
                      <InputLabel>Projekty</InputLabel>
                      <Select
                        multiple
                        value={shareData.shareWith}
                        onChange={(e) => setShareData({ ...shareData, shareWith: e.target.value })}
                        label="Projekty"
                        renderValue={(selected) => (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {selected.map((value) => {
                              const project = shareOptions.projects.find(p => p.id === value);
                              return (
                                <Chip key={value} label={project?.name} size="small" />
                              );
                            })}
                          </Box>
                        )}
                      >
                        {shareOptions.projects.map((project) => (
                          <MenuItem key={project.id} value={project.id}>
                            {project.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                )}
              </Grid>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShareDialog(false)}>Zrušiť</Button>
            <Button 
              onClick={updateFilePermissions}
              variant="contained"
              sx={{
                background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
                boxShadow: '0 3px 5px 2px rgba(33, 203, 243, .3)',
              }}
            >
              Uložiť oprávnenia
            </Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={closeSnackbar}
        >
          <Alert
            onClose={closeSnackbar}
            severity={snackbar.severity}
            sx={{ width: '100%' }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </Fade>
  );
};

export default Files;