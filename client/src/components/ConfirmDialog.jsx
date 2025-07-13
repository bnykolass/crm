import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Box,
  Typography,
  Zoom,
} from '@mui/material';
import { Warning, CheckCircle, Error, Info } from '@mui/icons-material';

const ConfirmDialog = ({
  open,
  onClose,
  onConfirm,
  title,
  message,
  type = 'warning',
  confirmText = 'Potvrdiť',
  cancelText = 'Zrušiť',
  confirmColor = 'primary',
}) => {
  const getIcon = () => {
    switch (type) {
      case 'warning':
        return <Warning sx={{ fontSize: 48, color: 'warning.main' }} />;
      case 'error':
        return <Error sx={{ fontSize: 48, color: 'error.main' }} />;
      case 'success':
        return <CheckCircle sx={{ fontSize: 48, color: 'success.main' }} />;
      case 'info':
      default:
        return <Info sx={{ fontSize: 48, color: 'info.main' }} />;
    }
  };

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      TransitionComponent={Zoom}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          bgcolor: 'background.paper',
        },
      }}
    >
      <DialogTitle sx={{ textAlign: 'center', pb: 1 }}>
        <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
          {getIcon()}
          <Typography variant="h6" fontWeight="bold">
            {title}
          </Typography>
        </Box>
      </DialogTitle>
      
      <DialogContent sx={{ textAlign: 'center', pt: 0 }}>
        <DialogContentText sx={{ fontSize: '1.1rem', color: 'text.primary' }}>
          {message}
        </DialogContentText>
      </DialogContent>
      
      <DialogActions sx={{ justifyContent: 'center', gap: 2, pb: 3 }}>
        <Button
          onClick={onClose}
          variant="outlined"
          size="large"
          sx={{
            minWidth: 120,
            borderRadius: 2,
          }}
        >
          {cancelText}
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          color={confirmColor}
          size="large"
          sx={{
            minWidth: 120,
            borderRadius: 2,
            background: confirmColor === 'error' 
              ? 'linear-gradient(45deg, #f44336 30%, #d32f2f 90%)'
              : confirmColor === 'warning'
              ? 'linear-gradient(45deg, #ff9800 30%, #f57c00 90%)'
              : 'linear-gradient(45deg, #2196f3 30%, #1976d2 90%)',
            boxShadow: '0 3px 5px 2px rgba(33, 150, 243, .3)',
          }}
        >
          {confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmDialog;