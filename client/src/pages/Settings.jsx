import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Fade,
  Tabs,
  Tab,
  TextField,
  Button,
  Grid,
  Switch,
  FormControlLabel,
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Email,
  Business,
  AttachMoney,
  Send,
  Check,
  Warning,
  Info,
} from '@mui/icons-material';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const Settings = () => {
  const [currentTab, setCurrentTab] = useState(0);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [testEmailDialog, setTestEmailDialog] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  
  const { hasPermission } = useAuth();

  useEffect(() => {
    if (hasPermission('manage_settings')) {
      fetchSettings();
    }
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/settings');
      setSettings(response.data);
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      showSnackbar('Nepodarilo sa načítať nastavenia', 'error');
    }
    setLoading(false);
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await axios.put('/api/settings', settings);
      showSnackbar('Nastavenia boli úspešne uložené', 'success');
    } catch (error) {
      console.error('Failed to save settings:', error);
      showSnackbar('Nepodarilo sa uložiť nastavenia', 'error');
    }
    setSaving(false);
  };

  const testEmailConfig = async () => {
    if (!testEmail.trim()) {
      showSnackbar('Zadajte emailovú adresu pre test', 'warning');
      return;
    }

    setTestingEmail(true);
    try {
      await axios.post('/api/settings/test-email', { testEmail });
      showSnackbar('Testovací email bol úspešne odoslaný', 'success');
      setTestEmailDialog(false);
      setTestEmail('');
    } catch (error) {
      console.error('Failed to send test email:', error);
      const errorMessage = error.response?.data?.error || 'Nepodarilo sa odoslať testovací email';
      showSnackbar(errorMessage, 'error');
    }
    setTestingEmail(false);
  };

  const handleSettingChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const showSnackbar = (message, severity) => {
    setSnackbar({ open: true, message, severity });
  };

  const closeSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  if (!hasPermission('manage_settings')) {
    return (
      <Box>
        <Typography variant="h5">Nemáte oprávnenie na zobrazenie tejto stránky</Typography>
      </Box>
    );
  }

  const renderEmailSettings = () => (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Email />
        Email Nastavenia
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <FormControlLabel
            control={
              <Switch
                checked={settings.email_notifications_enabled === 'true'}
                onChange={(e) => handleSettingChange('email_notifications_enabled', e.target.checked ? 'true' : 'false')}
              />
            }
            label="Povoliť email notifikácie"
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="SendGrid API Key"
            type="password"
            value={settings.sendgrid_api_key || ''}
            onChange={(e) => handleSettingChange('sendgrid_api_key', e.target.value)}
            helperText="Získajte API kľúč zo SendGrid dashboardu"
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Email odosielateľa"
            value={settings.sendgrid_from_email || ''}
            onChange={(e) => handleSettingChange('sendgrid_from_email', e.target.value)}
            helperText="Email adresa ktorá sa zobrazí ako odosielateľ"
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Meno odosielateľa"
            value={settings.sendgrid_from_name || ''}
            onChange={(e) => handleSettingChange('sendgrid_from_name', e.target.value)}
            helperText="Meno ktoré sa zobrazí ako odosielateľ"
          />
        </Grid>

        <Grid item xs={12}>
          <Divider sx={{ my: 2 }} />
          <Typography variant="h6" gutterBottom>Typy notifikácií</Typography>
        </Grid>

        <Grid item xs={12} md={4}>
          <FormControlLabel
            control={
              <Switch
                checked={settings.task_assignment_notifications === 'true'}
                onChange={(e) => handleSettingChange('task_assignment_notifications', e.target.checked ? 'true' : 'false')}
              />
            }
            label="Priradenie úloh"
          />
        </Grid>

        <Grid item xs={12} md={4}>
          <FormControlLabel
            control={
              <Switch
                checked={settings.task_comment_notifications === 'true'}
                onChange={(e) => handleSettingChange('task_comment_notifications', e.target.checked ? 'true' : 'false')}
              />
            }
            label="Komentáre k úlohám"
          />
        </Grid>

        <Grid item xs={12} md={4}>
          <FormControlLabel
            control={
              <Switch
                checked={settings.task_reminder_notifications === 'true'}
                onChange={(e) => handleSettingChange('task_reminder_notifications', e.target.checked ? 'true' : 'false')}
              />
            }
            label="Pripomienky úloh"
          />
        </Grid>

        <Grid item xs={12}>
          <Divider sx={{ my: 3 }} />
          <Typography variant="h6" gutterBottom>
            Overovanie emailu (pripravované)
          </Typography>
        </Grid>

        <Grid item xs={12}>
          <Alert severity="info" sx={{ mb: 2 }}>
            Overovanie emailu zatiaľ nie je aktívne. Táto funkcia bude dostupná v ďalšej verzii.
          </Alert>
        </Grid>

        <Grid item xs={12} md={4}>
          <FormControlLabel
            control={
              <Switch
                checked={settings.email_verification_enabled === 'true'}
                onChange={(e) => handleSettingChange('email_verification_enabled', e.target.checked ? 'true' : 'false')}
                disabled
              />
            }
            label="Vyžadovať overenie emailu"
          />
        </Grid>

        <Grid item xs={12} md={4}>
          <FormControlLabel
            control={
              <Switch
                checked={settings.allow_unverified_login === 'true'}
                onChange={(e) => handleSettingChange('allow_unverified_login', e.target.checked ? 'true' : 'false')}
                disabled
              />
            }
            label="Povoliť prihlásenie bez overenia"
          />
        </Grid>

        <Grid item xs={12} md={4}>
          <TextField
            fullWidth
            label="Expirácia overovacieho linku (hodín)"
            type="number"
            value={settings.verification_link_expiry_hours || '24'}
            onChange={(e) => handleSettingChange('verification_link_expiry_hours', e.target.value)}
            disabled
          />
        </Grid>

        <Grid item xs={12}>
          <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              onClick={saveSettings}
              disabled={saving}
              sx={{
                background: 'linear-gradient(45deg, #2196f3 30%, #21cbf3 90%)',
                boxShadow: '0 3px 5px 2px rgba(33, 203, 243, .3)',
              }}
            >
              {saving ? 'Ukladanie...' : 'Uložiť nastavenia'}
            </Button>
            
            <Button
              variant="outlined"
              startIcon={<Send />}
              onClick={() => setTestEmailDialog(true)}
              disabled={!settings.sendgrid_api_key || settings.email_notifications_enabled !== 'true'}
            >
              Testovať email
            </Button>
          </Box>
        </Grid>
      </Grid>

      {/* SendGrid Setup Guide */}
      <Box sx={{ mt: 4 }}>
        <Typography variant="h6" gutterBottom>
          Nastavenie SendGrid
        </Typography>
        <List dense>
          <ListItem>
            <ListItemIcon><Check color="primary" /></ListItemIcon>
            <ListItemText 
              primary="1. Vytvorte SendGrid účet na sendgrid.com"
              secondary="Bezplatný účet umožňuje posielať až 100 emailov denne"
            />
          </ListItem>
          <ListItem>
            <ListItemIcon><Check color="primary" /></ListItemIcon>
            <ListItemText 
              primary="2. Vytvorte API kľúč v SendGrid dashboarde"
              secondary="Settings > API Keys > Create API Key (Full Access)"
            />
          </ListItem>
          <ListItem>
            <ListItemIcon><Check color="primary" /></ListItemIcon>
            <ListItemText 
              primary="3. Overte vašu emailovú doménu"
              secondary="Settings > Sender Authentication > Domain Authentication"
            />
          </ListItem>
          <ListItem>
            <ListItemIcon><Warning color="warning" /></ListItemIcon>
            <ListItemText 
              primary="4. Zadajte API kľúč a overte nastavenia"
              secondary="Používajte 'Testovať email' na overenie konfigurácie"
            />
          </ListItem>
        </List>
      </Box>
    </Box>
  );

  const renderCompanySettings = () => (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Business />
        Informácie o spoločnosti
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Názov spoločnosti"
            value={settings.company_name || ''}
            onChange={(e) => handleSettingChange('company_name', e.target.value)}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Email spoločnosti"
            value={settings.company_email || ''}
            onChange={(e) => handleSettingChange('company_email', e.target.value)}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Telefón"
            value={settings.company_phone || ''}
            onChange={(e) => handleSettingChange('company_phone', e.target.value)}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Predvolená hodinová sadzba (€)"
            type="number"
            value={settings.default_hourly_rate || ''}
            onChange={(e) => handleSettingChange('default_hourly_rate', e.target.value)}
          />
        </Grid>

        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Adresa spoločnosti"
            multiline
            rows={3}
            value={settings.company_address || ''}
            onChange={(e) => handleSettingChange('company_address', e.target.value)}
          />
        </Grid>

        <Grid item xs={12}>
          <Button
            variant="contained"
            onClick={saveSettings}
            disabled={saving}
            sx={{
              background: 'linear-gradient(45deg, #2196f3 30%, #21cbf3 90%)',
              boxShadow: '0 3px 5px 2px rgba(33, 203, 243, .3)',
            }}
          >
            {saving ? 'Ukladanie...' : 'Uložiť nastavenia'}
          </Button>
        </Grid>
      </Grid>
    </Box>
  );

  const renderSystemSettings = () => (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <SettingsIcon />
        Systémové nastavenia
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            select
            label="Mena"
            value={settings.currency || 'EUR'}
            onChange={(e) => handleSettingChange('currency', e.target.value)}
            SelectProps={{ native: true }}
          >
            <option value="EUR">EUR (€)</option>
            <option value="USD">USD ($)</option>
            <option value="CZK">CZK (Kč)</option>
          </TextField>
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            select
            label="Formát dátumu"
            value={settings.date_format || 'DD.MM.YYYY'}
            onChange={(e) => handleSettingChange('date_format', e.target.value)}
            SelectProps={{ native: true }}
          >
            <option value="DD.MM.YYYY">DD.MM.YYYY</option>
            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
          </TextField>
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            select
            label="Časové pásmo"
            value={settings.timezone || 'Europe/Bratislava'}
            onChange={(e) => handleSettingChange('timezone', e.target.value)}
            SelectProps={{ native: true }}
          >
            <option value="Europe/Bratislava">Europe/Bratislava</option>
            <option value="Europe/Prague">Europe/Prague</option>
            <option value="Europe/Vienna">Europe/Vienna</option>
            <option value="UTC">UTC</option>
          </TextField>
        </Grid>

        <Grid item xs={12}>
          <FormControlLabel
            control={
              <Switch
                checked={settings.auto_task_reminders === 'true'}
                onChange={(e) => handleSettingChange('auto_task_reminders', e.target.checked ? 'true' : 'false')}
              />
            }
            label="Automatické pripomienky úloh"
          />
        </Grid>

        {settings.auto_task_reminders === 'true' && (
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Pripomenúť hodín pred termínom"
              type="number"
              value={settings.reminder_hours_before || '24'}
              onChange={(e) => handleSettingChange('reminder_hours_before', e.target.value)}
              inputProps={{ min: 1, max: 168 }}
              helperText="1-168 hodín (max 7 dní)"
            />
          </Grid>
        )}

        <Grid item xs={12}>
          <Button
            variant="contained"
            onClick={saveSettings}
            disabled={saving}
            sx={{
              background: 'linear-gradient(45deg, #2196f3 30%, #21cbf3 90%)',
              boxShadow: '0 3px 5px 2px rgba(33, 203, 243, .3)',
            }}
          >
            {saving ? 'Ukladanie...' : 'Uložiť nastavenia'}
          </Button>
        </Grid>
      </Grid>
    </Box>
  );

  return (
    <Fade in timeout={800}>
      <Box>
        <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SettingsIcon fontSize="large" />
          Nastavenia
        </Typography>

        <Paper sx={{ background: 'linear-gradient(145deg, #1e1e1e 0%, #2d2d2d 100%)' }}>
          <Tabs 
            value={currentTab} 
            onChange={(e, newValue) => setCurrentTab(newValue)}
            variant="fullWidth"
          >
            <Tab 
              label="Email" 
              icon={<Email />} 
              iconPosition="start"
            />
            <Tab 
              label="Spoločnosť" 
              icon={<Business />} 
              iconPosition="start"
            />
            <Tab 
              label="Systém" 
              icon={<SettingsIcon />} 
              iconPosition="start"
            />
          </Tabs>

          {loading ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography>Načítavanie nastavení...</Typography>
            </Box>
          ) : (
            <>
              {currentTab === 0 && renderEmailSettings()}
              {currentTab === 1 && renderCompanySettings()}
              {currentTab === 2 && renderSystemSettings()}
            </>
          )}
        </Paper>

        {/* Test Email Dialog */}
        <Dialog open={testEmailDialog} onClose={() => setTestEmailDialog(false)}>
          <DialogTitle>Testovať email konfiguráciu</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="Testovacia emailová adresa"
              type="email"
              fullWidth
              variant="outlined"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              helperText="Zadajte emailovú adresu na ktorú sa odošle testovací email"
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setTestEmailDialog(false)}>Zrušiť</Button>
            <Button 
              onClick={testEmailConfig}
              variant="contained"
              disabled={testingEmail || !testEmail.trim()}
            >
              {testingEmail ? 'Odosiela sa...' : 'Odoslať test'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar for notifications */}
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

export default Settings;