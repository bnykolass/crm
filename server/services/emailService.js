const sgMail = require('@sendgrid/mail');
const db = require('../database/db');

class EmailService {
  constructor() {
    this.settings = {};
    this.baseUrl = process.env.CRM_BASE_URL || 'http://localhost:3000';
    
    // Initialize settings from database
    this.loadSettings();
  }

  async loadSettings() {
    try {
      const settings = await db.allAsync('SELECT key, value FROM settings');
      this.settings = {};
      settings.forEach(setting => {
        this.settings[setting.key] = setting.value;
      });
      
      // Update SendGrid configuration
      await this.updateConfiguration();
    } catch (error) {
      console.error('Failed to load settings from database:', error);
      // Fallback to environment variables
      this.settings = {
        sendgrid_api_key: process.env.SENDGRID_API_KEY || '',
        sendgrid_from_email: process.env.SENDGRID_FROM_EMAIL || 'noreply@crm.sk',
        sendgrid_from_name: process.env.SENDGRID_FROM_NAME || 'CRM System',
        email_notifications_enabled: 'false'
      };
    }
  }

  async updateConfiguration() {
    // Reload settings from database
    try {
      const settings = await db.allAsync('SELECT key, value FROM settings');
      this.settings = {};
      settings.forEach(setting => {
        this.settings[setting.key] = setting.value;
      });
    } catch (error) {
      console.error('Failed to reload settings:', error);
      return;
    }

    const apiKey = this.settings.sendgrid_api_key;
    
    if (apiKey && apiKey.trim()) {
      try {
        sgMail.setApiKey(apiKey);
        console.log('SendGrid email service configuration updated');
      } catch (error) {
        console.error('Failed to set SendGrid API key:', error);
      }
    } else {
      console.warn('SendGrid API key not configured. Email notifications will be disabled.');
    }
  }

  isEnabled() {
    return !!(this.settings.sendgrid_api_key && 
              this.settings.sendgrid_api_key.trim() && 
              this.settings.email_notifications_enabled === 'true');
  }

  async sendTaskAssignmentEmail(task, assignee, assignedBy) {
    if (!this.isEnabled()) {
      console.log('Email service disabled - would send task assignment email to:', assignee.email);
      return { success: true, disabled: true };
    }

    const priorityColors = {
      low: '#4caf50',
      medium: '#ff9800', 
      high: '#f44336'
    };

    const priorityLabels = {
      low: 'Nízka',
      medium: 'Stredná',
      high: 'Vysoká'
    };

    const emailContent = this.generateTaskAssignmentHTML({
      assigneeName: `${assignee.first_name} ${assignee.last_name}`,
      assignedByName: `${assignedBy.first_name} ${assignedBy.last_name}`,
      taskTitle: task.title,
      taskDescription: task.description || 'Bez popisu',
      dueDate: task.due_date ? new Date(task.due_date).toLocaleDateString('sk-SK') : 'Nezadané',
      priority: priorityLabels[task.priority] || task.priority,
      priorityColor: priorityColors[task.priority] || '#757575',
      taskUrl: `${this.baseUrl}/tasks`,
      projectName: task.project_name || 'Bez projektu'
    });

    const msg = {
      to: assignee.email,
      from: {
        email: this.settings.sendgrid_from_email || 'noreply@crm.sk',
        name: this.settings.sendgrid_from_name || 'CRM System'
      },
      subject: `Nová úloha: ${task.title}`,
      html: emailContent,
      categories: ['CRM', 'Task Assignment'],
      customArgs: {
        taskId: task.id.toString(),
        assigneeId: assignee.id.toString(),
        eventType: 'task_assignment'
      },
      mailSettings: {
        sandboxMode: {
          enable: process.env.NODE_ENV === 'test'
        }
      },
      trackingSettings: {
        clickTracking: { enable: true },
        openTracking: { enable: true }
      }
    };

    return this.sendWithRetry(msg);
  }

  async sendTaskCommentEmail(task, comment, commenter, recipient) {
    if (!this.isEnabled()) {
      console.log('Email service disabled - would send comment notification to:', recipient.email);
      return { success: true, disabled: true };
    }

    const emailContent = this.generateTaskCommentHTML({
      recipientName: `${recipient.first_name} ${recipient.last_name}`,
      commenterName: `${commenter.first_name} ${commenter.last_name}`,
      taskTitle: task.title,
      comment: comment.comment,
      taskUrl: `${this.baseUrl}/tasks`,
      commentDate: new Date(comment.created_at).toLocaleDateString('sk-SK')
    });

    const msg = {
      to: recipient.email,
      from: {
        email: this.settings.sendgrid_from_email || 'noreply@crm.sk',
        name: this.settings.sendgrid_from_name || 'CRM System'
      },
      subject: `Nový komentár k úlohe: ${task.title}`,
      html: emailContent,
      categories: ['CRM', 'Task Comment'],
      customArgs: {
        taskId: task.id.toString(),
        commentId: comment.id.toString(),
        eventType: 'task_comment'
      }
    };

    return this.sendWithRetry(msg);
  }

  async sendTaskConfirmationEmail(task, assignee, action, message = null) {
    if (!this.isEnabled()) {
      console.log('Email service disabled - would send confirmation email to:', task.created_by_email);
      return { success: true, disabled: true };
    }

    const actionText = action === 'accept' ? 'potvrdil' : 'odmietol';
    const actionColor = action === 'accept' ? '#4caf50' : '#f44336';

    const emailContent = this.generateTaskConfirmationHTML({
      creatorName: `${task.created_by_first_name} ${task.created_by_last_name}`,
      assigneeName: `${assignee.first_name} ${assignee.last_name}`,
      taskTitle: task.title,
      action: actionText,
      actionColor: actionColor,
      message: message,
      taskUrl: `${this.baseUrl}/tasks`,
      confirmationDate: new Date().toLocaleDateString('sk-SK')
    });

    const msg = {
      to: task.created_by_email,
      from: {
        email: this.settings.sendgrid_from_email || 'noreply@crm.sk',
        name: this.settings.sendgrid_from_name || 'CRM System'
      },
      subject: `Úloha ${actionText}: ${task.title}`,
      html: emailContent,
      categories: ['CRM', 'Task Confirmation'],
      customArgs: {
        taskId: task.id.toString(),
        assigneeId: assignee.id.toString(),
        eventType: `task_${action}`
      }
    };

    return this.sendWithRetry(msg);
  }

  async sendTaskReminderEmail(task, recipient) {
    if (!this.isEnabled()) {
      console.log('Email service disabled - would send reminder to:', recipient.email);
      return { success: true, disabled: true };
    }

    const dueDate = new Date(task.due_date);
    const now = new Date();
    const hoursUntilDue = Math.floor((dueDate - now) / (1000 * 60 * 60));
    
    let urgencyLevel = 'normal';
    let urgencyMessage = '';
    
    if (hoursUntilDue <= 24) {
      urgencyLevel = 'urgent';
      urgencyMessage = 'POZOR: Termín je do 24 hodín!';
    } else if (hoursUntilDue <= 72) {
      urgencyLevel = 'warning';
      urgencyMessage = 'Termín sa blíži!';
    }

    const emailContent = this.generateTaskReminderHTML({
      recipientName: `${recipient.first_name} ${recipient.last_name}`,
      taskTitle: task.title,
      taskDescription: task.description || 'Bez popisu',
      dueDate: dueDate.toLocaleDateString('sk-SK'),
      hoursUntilDue: hoursUntilDue > 0 ? hoursUntilDue : 0,
      urgencyLevel: urgencyLevel,
      urgencyMessage: urgencyMessage,
      taskUrl: `${this.baseUrl}/tasks`
    });

    const msg = {
      to: recipient.email,
      from: {
        email: this.settings.sendgrid_from_email || 'noreply@crm.sk',
        name: this.settings.sendgrid_from_name || 'CRM System'
      },
      subject: `Pripomienka: ${task.title} - termín ${dueDate.toLocaleDateString('sk-SK')}`,
      html: emailContent,
      categories: ['CRM', 'Task Reminder'],
      customArgs: {
        taskId: task.id.toString(),
        recipientId: recipient.id.toString(),
        eventType: 'task_reminder'
      }
    };

    return this.sendWithRetry(msg);
  }

  async sendWithRetry(msg, maxRetries = 3) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const [response] = await sgMail.send(msg);
        
        console.log(`Email sent successfully to ${msg.to}:`, {
          messageId: response.headers['x-message-id'],
          timestamp: new Date().toISOString()
        });

        return { 
          success: true, 
          messageId: response.headers['x-message-id']
        };
      } catch (error) {
        lastError = error;

        console.error(`Email send attempt ${attempt} failed:`, {
          error: error.message,
          code: error.code,
          to: msg.to,
          timestamp: new Date().toISOString()
        });

        // Don't retry for certain errors (client errors)
        if ([400, 401, 403, 413].includes(error.code)) {
          return { 
            success: false, 
            error: error.message,
            code: error.code,
            retryable: false
          };
        }

        // Handle rate limiting
        if (error.code === 429) {
          const retryAfter = parseInt(error.response?.headers?.['retry-after']) || 60;
          console.log(`Rate limited. Waiting ${retryAfter} seconds before retry...`);
          await this.sleep(retryAfter * 1000);
          continue;
        }

        // Exponential backoff for other errors
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          await this.sleep(delay);
        }
      }
    }

    return { 
      success: false, 
      error: lastError?.message || 'Unknown error',
      code: lastError?.code,
      retryable: true
    };
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  generateTaskAssignmentHTML(data) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Nová úloha - ${data.taskTitle}</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            margin: 0; 
            padding: 0; 
            background-color: #f5f5f5; 
        }
        .container { 
            max-width: 600px; 
            margin: 20px auto; 
            background: white; 
            border-radius: 8px; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
            overflow: hidden; 
        }
        .header { 
            background: linear-gradient(135deg, #1976d2 0%, #42a5f5 100%); 
            color: white; 
            padding: 30px 20px; 
            text-align: center; 
        }
        .header h1 { 
            margin: 0; 
            font-size: 24px; 
            font-weight: 600; 
        }
        .content { 
            padding: 30px 20px; 
        }
        .task-info { 
            background: #f8f9fa; 
            border-radius: 6px; 
            padding: 20px; 
            margin: 20px 0; 
            border-left: 4px solid ${data.priorityColor}; 
        }
        .task-title { 
            font-size: 20px; 
            font-weight: 600; 
            color: #1976d2; 
            margin-bottom: 10px; 
        }
        .task-meta { 
            display: flex; 
            flex-wrap: wrap; 
            gap: 15px; 
            margin: 15px 0; 
        }
        .meta-item { 
            background: white; 
            padding: 8px 12px; 
            border-radius: 4px; 
            border: 1px solid #e0e0e0; 
            font-size: 14px; 
        }
        .meta-label { 
            font-weight: 600; 
            color: #666; 
        }
        .priority { 
            background: ${data.priorityColor}; 
            color: white; 
            border: none; 
        }
        .description { 
            background: white; 
            padding: 15px; 
            border-radius: 4px; 
            border: 1px solid #e0e0e0; 
            margin: 15px 0; 
        }
        .button { 
            display: inline-block; 
            background: linear-gradient(135deg, #1976d2 0%, #42a5f5 100%); 
            color: white; 
            padding: 12px 30px; 
            text-decoration: none; 
            border-radius: 6px; 
            font-weight: 600; 
            margin: 20px 0; 
            text-align: center; 
        }
        .footer { 
            background: #f8f9fa; 
            padding: 20px; 
            text-align: center; 
            font-size: 14px; 
            color: #666; 
        }
        @media (max-width: 600px) {
            .container { margin: 10px; }
            .task-meta { flex-direction: column; }
            .meta-item { margin-bottom: 5px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📋 Nová úloha priradená</h1>
        </div>
        
        <div class="content">
            <p>Ahoj <strong>${data.assigneeName}</strong>,</p>
            <p>Bola ti priradená nová úloha používateľom <strong>${data.assignedByName}</strong>.</p>
            
            <div class="task-info">
                <div class="task-title">${data.taskTitle}</div>
                
                <div class="task-meta">
                    <div class="meta-item">
                        <span class="meta-label">Projekt:</span> ${data.projectName}
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">Termín:</span> ${data.dueDate}
                    </div>
                    <div class="meta-item priority">
                        <span class="meta-label">Priorita:</span> ${data.priority}
                    </div>
                </div>
                
                <div class="description">
                    <strong>Popis úlohy:</strong><br>
                    ${data.taskDescription}
                </div>
            </div>
            
            <p>Pre zobrazenie detailov úlohy a začatie práce klikni na tlačidlo nižšie:</p>
            <a href="${data.taskUrl}" class="button">Zobraziť úlohu v CRM</a>
            
            <p>Ďakujeme,<br><strong>CRM Team</strong></p>
        </div>
        
        <div class="footer">
            <p>Táto správa bola automaticky vygenerovaná CRM systémom.</p>
        </div>
    </div>
</body>
</html>`;
  }

  generateTaskCommentHTML(data) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Nový komentár - ${data.taskTitle}</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            margin: 0; 
            padding: 0; 
            background-color: #f5f5f5; 
        }
        .container { 
            max-width: 600px; 
            margin: 20px auto; 
            background: white; 
            border-radius: 8px; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
            overflow: hidden; 
        }
        .header { 
            background: linear-gradient(135deg, #4caf50 0%, #66bb6a 100%); 
            color: white; 
            padding: 30px 20px; 
            text-align: center; 
        }
        .header h1 { 
            margin: 0; 
            font-size: 24px; 
            font-weight: 600; 
        }
        .content { 
            padding: 30px 20px; 
        }
        .comment-box { 
            background: #f8f9fa; 
            border-radius: 6px; 
            padding: 20px; 
            margin: 20px 0; 
            border-left: 4px solid #4caf50; 
        }
        .comment-meta { 
            font-size: 14px; 
            color: #666; 
            margin-bottom: 10px; 
        }
        .comment-text { 
            background: white; 
            padding: 15px; 
            border-radius: 4px; 
            border: 1px solid #e0e0e0; 
            white-space: pre-wrap; 
        }
        .task-title { 
            font-size: 18px; 
            font-weight: 600; 
            color: #4caf50; 
            margin-bottom: 10px; 
        }
        .button { 
            display: inline-block; 
            background: linear-gradient(135deg, #4caf50 0%, #66bb6a 100%); 
            color: white; 
            padding: 12px 30px; 
            text-decoration: none; 
            border-radius: 6px; 
            font-weight: 600; 
            margin: 20px 0; 
        }
        .footer { 
            background: #f8f9fa; 
            padding: 20px; 
            text-align: center; 
            font-size: 14px; 
            color: #666; 
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>💬 Nový komentár</h1>
        </div>
        
        <div class="content">
            <p>Ahoj <strong>${data.recipientName}</strong>,</p>
            <p>K úlohe <strong>"${data.taskTitle}"</strong> bol pridaný nový komentár.</p>
            
            <div class="comment-box">
                <div class="comment-meta">
                    📝 <strong>${data.commenterName}</strong> - ${data.commentDate}
                </div>
                <div class="comment-text">${data.comment}</div>
            </div>
            
            <p>Pre zobrazenie všetkých komentárov a odpoveď klikni na tlačidlo nižšie:</p>
            <a href="${data.taskUrl}" class="button">Zobraziť úlohu v CRM</a>
            
            <p>Ďakujeme,<br><strong>CRM Team</strong></p>
        </div>
        
        <div class="footer">
            <p>Táto správa bola automaticky vygenerovaná CRM systémom.</p>
        </div>
    </div>
</body>
</html>`;
  }

  generateTaskConfirmationHTML(data) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Úloha ${data.action} - ${data.taskTitle}</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            margin: 0; 
            padding: 0; 
            background-color: #f5f5f5; 
        }
        .container { 
            max-width: 600px; 
            margin: 20px auto; 
            background: white; 
            border-radius: 8px; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
            overflow: hidden; 
        }
        .header { 
            background: linear-gradient(135deg, ${data.actionColor} 0%, ${data.actionColor}cc 100%); 
            color: white; 
            padding: 30px 20px; 
            text-align: center; 
        }
        .header h1 { 
            margin: 0; 
            font-size: 24px; 
            font-weight: 600; 
        }
        .content { 
            padding: 30px 20px; 
        }
        .confirmation-box { 
            background: #f8f9fa; 
            border-radius: 6px; 
            padding: 20px; 
            margin: 20px 0; 
            border-left: 4px solid ${data.actionColor}; 
        }
        .task-title { 
            font-size: 18px; 
            font-weight: 600; 
            color: ${data.actionColor}; 
            margin-bottom: 10px; 
        }
        .confirmation-meta { 
            font-size: 14px; 
            color: #666; 
            margin-bottom: 15px; 
        }
        .message-box { 
            background: white; 
            padding: 15px; 
            border-radius: 4px; 
            border: 1px solid #e0e0e0; 
            margin: 15px 0; 
            white-space: pre-wrap; 
        }
        .button { 
            display: inline-block; 
            background: linear-gradient(135deg, ${data.actionColor} 0%, ${data.actionColor}cc 100%); 
            color: white; 
            padding: 12px 30px; 
            text-decoration: none; 
            border-radius: 6px; 
            font-weight: 600; 
            margin: 20px 0; 
        }
        .footer { 
            background: #f8f9fa; 
            padding: 20px; 
            text-align: center; 
            font-size: 14px; 
            color: #666; 
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${data.action === 'potvrdil' ? '✅' : '❌'} Úloha ${data.action}</h1>
        </div>
        
        <div class="content">
            <p>Ahoj <strong>${data.creatorName}</strong>,</p>
            <p>Používateľ <strong>${data.assigneeName}</strong> ${data.action} úlohu, ktorú ste mu pridelili.</p>
            
            <div class="confirmation-box">
                <div class="task-title">${data.taskTitle}</div>
                <div class="confirmation-meta">
                    👤 <strong>${data.assigneeName}</strong> - ${data.confirmationDate}
                </div>
                
                ${data.message ? `
                <div class="message-box">
                    <strong>Správa od používateľa:</strong><br>
                    ${data.message}
                </div>
                ` : ''}
            </div>
            
            <p>Pre zobrazenie detailov úlohy klikni na tlačidlo nižšie:</p>
            <a href="${data.taskUrl}" class="button">Zobraziť úlohu v CRM</a>
            
            <p>Ďakujeme,<br><strong>CRM Team</strong></p>
        </div>
        
        <div class="footer">
            <p>Táto správa bola automaticky vygenerovaná CRM systémom.</p>
        </div>
    </div>
</body>
</html>`;
  }

  generateTaskReminderHTML(data) {
    const urgencyColors = {
      normal: '#2196f3',
      warning: '#ff9800',
      urgent: '#f44336'
    };

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pripomienka úlohy - ${data.taskTitle}</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            margin: 0; 
            padding: 0; 
            background-color: #f5f5f5; 
        }
        .container { 
            max-width: 600px; 
            margin: 20px auto; 
            background: white; 
            border-radius: 8px; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
            overflow: hidden; 
        }
        .header { 
            background: linear-gradient(135deg, ${urgencyColors[data.urgencyLevel]} 0%, ${urgencyColors[data.urgencyLevel]}cc 100%); 
            color: white; 
            padding: 30px 20px; 
            text-align: center; 
        }
        .header h1 { 
            margin: 0; 
            font-size: 24px; 
            font-weight: 600; 
        }
        .urgency-banner { 
            background: ${urgencyColors[data.urgencyLevel]}; 
            color: white; 
            padding: 10px; 
            text-align: center; 
            font-weight: 600; 
            font-size: 16px; 
        }
        .content { 
            padding: 30px 20px; 
        }
        .task-info { 
            background: #f8f9fa; 
            border-radius: 6px; 
            padding: 20px; 
            margin: 20px 0; 
            border-left: 4px solid ${urgencyColors[data.urgencyLevel]}; 
        }
        .task-title { 
            font-size: 20px; 
            font-weight: 600; 
            color: ${urgencyColors[data.urgencyLevel]}; 
            margin-bottom: 10px; 
        }
        .due-info { 
            background: white; 
            padding: 15px; 
            border-radius: 4px; 
            border: 1px solid #e0e0e0; 
            margin: 15px 0; 
            text-align: center; 
        }
        .due-date { 
            font-size: 18px; 
            font-weight: 600; 
            color: ${urgencyColors[data.urgencyLevel]}; 
        }
        .countdown { 
            font-size: 14px; 
            color: #666; 
        }
        .button { 
            display: inline-block; 
            background: linear-gradient(135deg, ${urgencyColors[data.urgencyLevel]} 0%, ${urgencyColors[data.urgencyLevel]}cc 100%); 
            color: white; 
            padding: 12px 30px; 
            text-decoration: none; 
            border-radius: 6px; 
            font-weight: 600; 
            margin: 20px 0; 
        }
        .footer { 
            background: #f8f9fa; 
            padding: 20px; 
            text-align: center; 
            font-size: 14px; 
            color: #666; 
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⏰ Pripomienka úlohy</h1>
        </div>
        
        ${data.urgencyMessage ? `<div class="urgency-banner">${data.urgencyMessage}</div>` : ''}
        
        <div class="content">
            <p>Ahoj <strong>${data.recipientName}</strong>,</p>
            <p>Pripomíname ti blížiaci sa termín úlohy:</p>
            
            <div class="task-info">
                <div class="task-title">${data.taskTitle}</div>
                
                <div class="due-info">
                    <div class="due-date">📅 Termín: ${data.dueDate}</div>
                    <div class="countdown">
                        ${data.hoursUntilDue > 0 ? `Zostáva ${data.hoursUntilDue} hodín` : 'Termín už prešiel!'}
                    </div>
                </div>
                
                <p><strong>Popis úlohy:</strong><br>${data.taskDescription}</p>
            </div>
            
            <p>Pre dokončenie úlohy klikni na tlačidlo nižšie:</p>
            <a href="${data.taskUrl}" class="button">Zobraziť úlohu v CRM</a>
            
            <p>Ďakujeme,<br><strong>CRM Team</strong></p>
        </div>
        
        <div class="footer">
            <p>Táto správa bola automaticky vygenerovaná CRM systémom.</p>
        </div>
    </div>
</body>
</html>`;
  }

  async sendTestEmail(testEmail) {
    if (!this.settings.sendgrid_api_key || !this.settings.sendgrid_api_key.trim()) {
      return { success: false, error: 'SendGrid API key not configured' };
    }

    const testContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Test Email</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 20px auto; padding: 20px; background: #f9f9f9; border-radius: 8px; }
        .header { background: #1976d2; color: white; padding: 20px; text-align: center; border-radius: 4px; }
        .content { padding: 20px; background: white; border-radius: 4px; margin-top: 10px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✅ Test Email</h1>
        </div>
        <div class="content">
            <p>Gratulujeme! SendGrid konfigurácia je správna.</p>
            <p>Tento testovací email bol úspešne odoslaný z CRM systému.</p>
            <hr>
            <p><strong>Nastavenia:</strong></p>
            <ul>
                <li>Od: ${this.settings.sendgrid_from_name} &lt;${this.settings.sendgrid_from_email}&gt;</li>
                <li>Dátum: ${new Date().toLocaleString('sk-SK')}</li>
            </ul>
        </div>
    </div>
</body>
</html>`;

    const msg = {
      to: testEmail,
      from: {
        email: this.settings.sendgrid_from_email || 'noreply@crm.sk',
        name: this.settings.sendgrid_from_name || 'CRM System'
      },
      subject: 'Test Email z CRM Systému',
      html: testContent,
      categories: ['CRM', 'Test Email'],
      customArgs: {
        eventType: 'test_email'
      }
    };

    return this.sendWithRetry(msg);
  }

  // Validation method to check if SendGrid is properly configured
  async validateConfiguration() {
    if (!this.settings.sendgrid_api_key || !this.settings.sendgrid_api_key.trim()) {
      return { valid: false, message: 'SendGrid API key not configured' };
    }

    try {
      // Test with a dummy email to validate API key
      const testMsg = {
        to: 'test@example.com',
        from: {
          email: this.settings.sendgrid_from_email || 'noreply@crm.sk',
          name: this.settings.sendgrid_from_name || 'CRM System'
        },
        subject: 'Test',
        html: '<p>Test</p>',
        mailSettings: {
          sandboxMode: { enable: true } // Enable sandbox mode for testing
        }
      };

      await sgMail.send(testMsg);
      return { valid: true, message: 'SendGrid configuration is valid' };
    } catch (error) {
      return { 
        valid: false, 
        message: `SendGrid configuration error: ${error.message}` 
      };
    }
  }
}

module.exports = new EmailService();