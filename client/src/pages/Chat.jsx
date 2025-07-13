import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Fade,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  TextField,
  IconButton,
  Divider,
  Badge,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab,
  Autocomplete,
  Tooltip,
} from '@mui/material';
import {
  Chat as ChatIcon,
  Send,
  Add,
  Circle,
  Delete,
  PersonAdd,
  Group,
  Person,
  EmojiEmotions,
  AttachFile,
  Image,
  Description,
  GetApp,
  PictureAsPdf,
  VideoFile,
  AudioFile,
  InsertDriveFile,
} from '@mui/icons-material';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

dayjs.extend(relativeTime);

const Chat = () => {
  const [participants, setParticipants] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null); // {type: 'user'|'group', data: user|group}
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [allUsers, setAllUsers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [openNewChatDialog, setOpenNewChatDialog] = useState(false);
  const [openNewGroupDialog, setOpenNewGroupDialog] = useState(false);
  const [currentTab, setCurrentTab] = useState(0); // 0 = Direct, 1 = Groups, 2 = Online
  const [selectedNewUser, setSelectedNewUser] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState(null);
  const [groupFormData, setGroupFormData] = useState({
    name: '',
    description: '',
    memberIds: [],
  });
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const { user } = useAuth();
  const { socket, activeUsers } = useSocket();

  useEffect(() => {
    fetchParticipants();
    fetchGroups();
    fetchAllUsers();
    updateOnlineUsers();
  }, []);

  useEffect(() => {
    updateOnlineUsers();
  }, [activeUsers, allUsers]);

  useEffect(() => {
    if (socket && selectedChat?.type === 'user') {
      const handleNewMessage = (message) => {
        if (
          (message.sender_id === selectedChat.data.id && message.receiver_id === user.id) ||
          (message.sender_id === user.id && message.receiver_id === selectedChat.data.id)
        ) {
          setMessages((prev) => [...prev, message]);
          markMessagesAsRead(selectedChat.data.id);
        } else {
          // Update unread count for other conversations
          fetchParticipants();
        }
      };

      const handleTyping = (data) => {
        if (data.sender_id === selectedChat.data.id) {
          setTypingUser(data.sender_name);
          setTimeout(() => setTypingUser(null), 3000);
        }
      };

      const handleStopTyping = (data) => {
        if (data.sender_id === selectedChat.data.id) {
          setTypingUser(null);
        }
      };

      socket.on('new-message', handleNewMessage);
      socket.on('user-typing', handleTyping);
      socket.on('user-stop-typing', handleStopTyping);

      return () => {
        socket.off('new-message', handleNewMessage);
        socket.off('user-typing', handleTyping);
        socket.off('user-stop-typing', handleStopTyping);
      };
    }
  }, [socket, selectedChat, user.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const updateOnlineUsers = () => {
    if (allUsers.length > 0 && activeUsers.length > 0) {
      const online = allUsers.filter(u => activeUsers.includes(u.id));
      setOnlineUsers(online);
    }
  };

  const fetchParticipants = async () => {
    try {
      const response = await axios.get('/api/chat/participants');
      setParticipants(response.data);
    } catch (error) {
      console.error('Failed to fetch participants:', error);
    }
  };

  const fetchGroups = async () => {
    try {
      const response = await axios.get('/api/chat/groups');
      setGroups(response.data);
    } catch (error) {
      console.error('Failed to fetch groups:', error);
    }
  };

  const fetchAllUsers = async () => {
    try {
      const response = await axios.get('/api/chat/users');
      setAllUsers(response.data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const fetchMessages = async (chatType, chatData) => {
    try {
      let response;
      if (chatType === 'user') {
        response = await axios.get(`/api/chat/messages?receiverId=${chatData.id}`);
      } else {
        response = await axios.get(`/api/chat/groups/${chatData.id}/messages`);
      }
      setMessages(response.data);
      
      if (chatType === 'user') {
        markMessagesAsRead(chatData.id);
      } else {
        markMessagesAsRead(null, chatData.id);
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };

  const markMessagesAsRead = async (senderId, groupId = null) => {
    try {
      await axios.patch('/api/chat/messages/read', { senderId, groupId });
      fetchParticipants();
      fetchGroups();
      // Update unread count in Layout
      window.dispatchEvent(new CustomEvent('chatMessagesRead'));
    } catch (error) {
      console.error('Failed to mark messages as read:', error);
    }
  };

  const handleSendMessage = async () => {
    if (selectedFile) {
      await handleFileUpload();
      return;
    }

    if (!newMessage.trim() || !selectedChat) return;

    try {
      let response;
      
      if (selectedChat.type === 'user') {
        response = await axios.post('/api/chat/messages', {
          receiverId: selectedChat.data.id,
          message: newMessage,
        });
        
        if (socket) {
          socket.emit('send-message', {
            ...response.data,
            receiver_id: selectedChat.data.id,
            sender_name: `${user.firstName} ${user.lastName}`,
          });
          
          socket.emit('stop-typing', {
            receiver_id: selectedChat.data.id,
            sender_id: user.id,
          });
        }
      } else {
        response = await axios.post(`/api/chat/groups/${selectedChat.data.id}/messages`, {
          message: newMessage,
        });
      }

      // Message will be added to local state via socket listener
      setNewMessage('');
      fetchParticipants();
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleTyping = () => {
    if (!socket || selectedChat?.type !== 'user' || isTyping) return;

    setIsTyping(true);
    socket.emit('typing', {
      receiver_id: selectedChat.data.id,
      sender_id: user.id,
      sender_name: `${user.firstName} ${user.lastName}`,
    });

    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stop-typing', {
        receiver_id: selectedChat.data.id,
        sender_id: user.id,
      });
      setIsTyping(false);
    }, 2000);
  };

  const handleSelectChat = (chatType, chatData) => {
    setSelectedChat({ type: chatType, data: chatData });
    fetchMessages(chatType, chatData);
  };

  const handleStartNewChat = () => {
    if (!selectedNewUser) return;
    
    setOpenNewChatDialog(false);
    handleSelectChat('user', selectedNewUser);
    fetchParticipants();
  };

  const handleCreateGroup = async () => {
    try {
      const response = await axios.post('/api/chat/groups', groupFormData);
      setOpenNewGroupDialog(false);
      setGroupFormData({ name: '', description: '', memberIds: [] });
      fetchGroups();
    } catch (error) {
      console.error('Failed to create group:', error);
    }
  };

  const handleDeleteMessage = async (messageId) => {
    try {
      await axios.delete(`/api/chat/messages/${messageId}`);
      setMessages(messages.filter((m) => m.id !== messageId));
    } catch (error) {
      console.error('Failed to delete message:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const getUserDisplay = (userData) => {
    if (!userData) return { name: '', initials: '' };
    const name = userData.nickname || `${userData.first_name} ${userData.last_name}`;
    const initials = userData.nickname 
      ? userData.nickname.substring(0, 2).toUpperCase()
      : `${userData.first_name?.[0] || ''}${userData.last_name?.[0] || ''}`;
    return { name, initials };
  };

  const handleEmojiSelect = (emoji) => {
    setNewMessage(prevMessage => prevMessage + emoji.native);
    setShowEmojiPicker(false);
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile || !selectedChat) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);
    
    if (selectedChat.type === 'user') {
      formData.append('receiverId', selectedChat.data.id);
    } else {
      formData.append('groupId', selectedChat.data.id);
    }

    try {
      let response;
      if (selectedChat.type === 'user') {
        response = await axios.post('/api/chat/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        
        if (socket) {
          socket.emit('send-message', {
            ...response.data,
            receiver_id: selectedChat.data.id,
            sender_name: `${user.firstName} ${user.lastName}`,
          });
        }
      } else {
        response = await axios.post(`/api/chat/groups/${selectedChat.data.id}/upload`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      setSelectedFile(null);
      fetchParticipants();
    } catch (error) {
      console.error('Failed to upload file:', error);
    } finally {
      setUploading(false);
    }
  };

  const getFileIcon = (filename) => {
    if (!filename) return <InsertDriveFile />;
    
    const extension = filename.split('.').pop()?.toLowerCase();
    
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(extension)) {
      return <Image color="primary" />;
    } else if (['pdf'].includes(extension)) {
      return <PictureAsPdf color="error" />;
    } else if (['doc', 'docx', 'txt', 'rtf'].includes(extension)) {
      return <Description color="info" />;
    } else if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'].includes(extension)) {
      return <VideoFile color="secondary" />;
    } else if (['mp3', 'wav', 'flac', 'aac', 'ogg'].includes(extension)) {
      return <AudioFile color="success" />;
    } else {
      return <InsertDriveFile />;
    }
  };

  const isImageFile = (filename) => {
    if (!filename) return false;
    const extension = filename.split('.').pop()?.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(extension);
  };

  const handleDownloadFile = (attachmentPath, attachmentName) => {
    const url = `http://localhost:5555${attachmentPath}`;
    window.open(url, '_blank');
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleImageClick = (imageUrl, messageId) => {
    // Collect all images from current chat messages
    const allImages = messages
      .filter(msg => msg.attachment_path && isImageFile(msg.attachment_name))
      .map(msg => ({
        src: `http://localhost:5555${msg.attachment_path}`,
        alt: msg.attachment_name,
        messageId: msg.id,
      }));
    
    // Find the index of the clicked image
    const clickedImageIndex = allImages.findIndex(img => img.messageId === messageId);
    
    setLightboxImages(allImages);
    setLightboxIndex(clickedImageIndex >= 0 ? clickedImageIndex : 0);
    setLightboxOpen(true);
  };

  const renderChatList = () => {
    let items = [];
    
    if (currentTab === 0) {
      // Direct messages
      items = participants;
    } else if (currentTab === 1) {
      // Groups
      items = groups;
    } else {
      // Online users
      items = onlineUsers;
    }

    return items.map((item) => {
      const isGroup = currentTab === 1;
      const isSelected = selectedChat && 
        ((isGroup && selectedChat.type === 'group' && selectedChat.data.id === item.id) ||
         (!isGroup && selectedChat.type === 'user' && selectedChat.data.id === item.id));
      
      const display = isGroup 
        ? { name: item.name, initials: 'GR' }
        : getUserDisplay(item);

      return (
        <ListItem
          key={item.id}
          button
          selected={isSelected}
          onClick={() => handleSelectChat(isGroup ? 'group' : 'user', item)}
          sx={{
            borderRadius: 1,
            mb: 0.5,
            '&.Mui-selected': {
              backgroundColor: 'action.selected',
            },
          }}
        >
          <ListItemAvatar>
            <Badge
              overlap="circular"
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              badgeContent={
                !isGroup && activeUsers.includes(item.id) ? (
                  <Circle sx={{ color: 'success.main', fontSize: 12 }} />
                ) : null
              }
            >
              <Avatar src={!isGroup && item.profile_photo ? `http://localhost:5555${item.profile_photo}` : undefined}>
                {display.initials}
              </Avatar>
            </Badge>
          </ListItemAvatar>
          <ListItemText
            primary={display.name}
            secondary={
              !isGroup && item.last_message
                ? item.last_message.substring(0, 30) + '...'
                : isGroup
                ? `${item.member_count || 0} členov`
                : 'Začať konverzáciu'
            }
          />
          {((currentTab === 0 && item.unread_count > 0) || (currentTab === 1 && item.unread_count > 0)) && (
            <Chip
              label={item.unread_count}
              color="primary"
              size="small"
              sx={{ height: 20, fontSize: '0.75rem' }}
            />
          )}
        </ListItem>
      );
    });
  };

  return (
    <Box p={3}>
      <Fade in timeout={1000}>
        <Box>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ChatIcon fontSize="large" />
              Chat
            </Typography>
          </Box>

          <Grid container spacing={3} sx={{ height: 'calc(100vh - 200px)' }}>
            {/* Chat list */}
            <Grid item xs={12} md={4}>
              <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Box p={2}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="h6">Konverzácie</Typography>
                    <Box>
                      <IconButton onClick={() => setOpenNewChatDialog(true)} size="small">
                        <PersonAdd />
                      </IconButton>
                      <IconButton onClick={() => setOpenNewGroupDialog(true)} size="small">
                        <Add />
                      </IconButton>
                    </Box>
                  </Box>
                  
                  <Tabs value={currentTab} onChange={(e, v) => setCurrentTab(v)} variant="fullWidth">
                    <Tab label="Priame" />
                    <Tab label="Skupiny" />
                    <Tab 
                      label={
                        <Badge badgeContent={onlineUsers.length} color="success">
                          Online
                        </Badge>
                      } 
                    />
                  </Tabs>
                </Box>
                
                <Divider />
                
                <List sx={{ flex: 1, overflow: 'auto', p: 1 }}>
                  {renderChatList()}
                </List>
              </Paper>
            </Grid>

            {/* Chat messages */}
            <Grid item xs={12} md={8}>
              <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                {selectedChat ? (
                  <>
                    {/* Chat header */}
                    <Box p={2} borderBottom={1} borderColor="divider">
                      <Box display="flex" alignItems="center">
                        <Avatar 
                          src={selectedChat.type === 'user' && selectedChat.data.profile_photo ? `http://localhost:5555${selectedChat.data.profile_photo}` : undefined}
                          sx={{ mr: 2 }}
                        >
                          {selectedChat.type === 'user' 
                            ? getUserDisplay(selectedChat.data).initials
                            : 'GR'
                          }
                        </Avatar>
                        <Box flex={1}>
                          <Typography variant="h6">
                            {selectedChat.type === 'user'
                              ? getUserDisplay(selectedChat.data).name
                              : selectedChat.data.name
                            }
                          </Typography>
                          {typingUser && (
                            <Typography variant="caption" color="text.secondary">
                              {typingUser} píše...
                            </Typography>
                          )}
                          {selectedChat.type === 'user' && activeUsers.includes(selectedChat.data.id) && (
                            <Chip
                              label="Online"
                              color="success"
                              size="small"
                              sx={{ ml: 1 }}
                            />
                          )}
                        </Box>
                        {selectedChat.type === 'group' && (
                          <Chip
                            icon={<Group />}
                            label={`${selectedChat.data.member_count || 0} členov`}
                            variant="outlined"
                          />
                        )}
                      </Box>
                    </Box>

                    {/* Messages */}
                    <Box flex={1} overflow="auto" p={2}>
                      {messages.map((message) => {
                        const isOwnMessage = message.sender_id === user.id;
                        const senderDisplay = getUserDisplay({
                          first_name: message.sender_first_name || message.first_name,
                          last_name: message.sender_last_name || message.last_name,
                          nickname: message.nickname,
                        });
                        
                        return (
                          <Box
                            key={message.id}
                            display="flex"
                            justifyContent={isOwnMessage ? 'flex-end' : 'flex-start'}
                            mb={2}
                          >
                            <Box maxWidth="70%">
                              {selectedChat.type === 'group' && !isOwnMessage && (
                                <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                                  {senderDisplay.name}
                                </Typography>
                              )}
                              <Paper
                                sx={{
                                  p: 2,
                                  backgroundColor: isOwnMessage ? 'primary.main' : 'grey.800',
                                  position: 'relative',
                                }}
                              >
                                {/* Message text */}
                                {message.message && message.message.trim() && (
                                  <Typography>{message.message}</Typography>
                                )}
                                
                                {/* Attachment display */}
                                {message.attachment_path && message.attachment_name && (
                                  <Box mt={message.message && message.message.trim() ? 1 : 0}>
                                    {isImageFile(message.attachment_name) ? (
                                      /* Image attachment */
                                      <Box>
                                        <Tooltip title="Kliknite pre otvorenie v novom okne">
                                          <img
                                            src={`http://localhost:5555${message.attachment_path}`}
                                            alt={message.attachment_name}
                                            style={{
                                              maxWidth: '300px',
                                              maxHeight: '200px',
                                              width: 'auto',
                                              height: 'auto',
                                              borderRadius: '8px',
                                              cursor: 'pointer',
                                              transition: 'transform 0.2s',
                                            }}
                                            onMouseEnter={(e) => e.target.style.transform = 'scale(1.02)'}
                                            onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                                            onClick={() => handleImageClick(message.attachment_path, message.id)}
                                          />
                                        </Tooltip>
                                        <Typography variant="caption" display="block" sx={{ mt: 0.5, opacity: 0.8 }}>
                                          {message.attachment_name}
                                        </Typography>
                                      </Box>
                                    ) : (
                                      /* File attachment */
                                      <Tooltip title="Kliknite pre stiahnuť súbor">
                                        <Box
                                          display="flex"
                                          alignItems="center"
                                          gap={1}
                                          sx={{
                                            p: 1.5,
                                            backgroundColor: isOwnMessage ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.2)',
                                            borderRadius: 1,
                                            cursor: 'pointer',
                                            '&:hover': {
                                              backgroundColor: isOwnMessage ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.3)',
                                            },
                                          }}
                                          onClick={() => handleDownloadFile(message.attachment_path, message.attachment_name)}
                                        >
                                        {getFileIcon(message.attachment_name)}
                                        <Box flex={1}>
                                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                            {message.attachment_name}
                                          </Typography>
                                          <Typography variant="caption" sx={{ opacity: 0.8 }}>
                                            {message.attachment_type && (
                                              `${message.attachment_type.split('/')[0].toUpperCase()} súbor`
                                            )}
                                          </Typography>
                                        </Box>
                                          <GetApp fontSize="small" sx={{ opacity: 0.7 }} />
                                        </Box>
                                      </Tooltip>
                                    )}
                                  </Box>
                                )}
                                
                                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                                  {dayjs(message.created_at).fromNow()}
                                </Typography>
                                {isOwnMessage && (
                                  <IconButton
                                    size="small"
                                    onClick={() => handleDeleteMessage(message.id)}
                                    sx={{
                                      position: 'absolute',
                                      top: 0,
                                      right: 0,
                                      opacity: 0.5,
                                      '&:hover': { opacity: 1 },
                                    }}
                                  >
                                    <Delete fontSize="small" />
                                  </IconButton>
                                )}
                              </Paper>
                            </Box>
                          </Box>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </Box>

                    {/* Message input */}
                    <Box p={2} borderTop={1} borderColor="divider">
                      {selectedFile && (
                        <Box mb={2} p={2} bgcolor="grey.900" borderRadius={1}>
                          <Box display="flex" alignItems="center" gap={1}>
                            {getFileIcon(selectedFile.name)}
                            <Box flex={1}>
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                {selectedFile.name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {formatFileSize(selectedFile.size)} • {selectedFile.type}
                              </Typography>
                            </Box>
                            <IconButton size="small" onClick={() => setSelectedFile(null)}>
                              <Delete fontSize="small" />
                            </IconButton>
                          </Box>
                          {isImageFile(selectedFile.name) && (
                            <Box mt={1}>
                              <img
                                src={URL.createObjectURL(selectedFile)}
                                alt="Preview"
                                style={{
                                  maxWidth: '200px',
                                  maxHeight: '100px',
                                  borderRadius: '4px',
                                }}
                              />
                            </Box>
                          )}
                        </Box>
                      )}
                      
                      {showEmojiPicker && (
                        <Box mb={2}>
                          <Picker
                            data={data}
                            onEmojiSelect={handleEmojiSelect}
                            theme="dark"
                            locale="sk"
                          />
                        </Box>
                      )}
                      
                      <Box display="flex" gap={1}>
                        <input
                          type="file"
                          id="file-upload"
                          style={{ display: 'none' }}
                          onChange={handleFileSelect}
                        />
                        <IconButton
                          onClick={() => document.getElementById('file-upload').click()}
                          disabled={uploading}
                        >
                          <AttachFile />
                        </IconButton>
                        <IconButton
                          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                          disabled={uploading}
                        >
                          <EmojiEmotions />
                        </IconButton>
                        <TextField
                          fullWidth
                          placeholder="Napíšte správu..."
                          value={newMessage}
                          onChange={(e) => {
                            setNewMessage(e.target.value);
                            handleTyping();
                          }}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSendMessage();
                            }
                          }}
                          multiline
                          maxRows={4}
                          disabled={uploading}
                        />
                        <IconButton
                          color="primary"
                          onClick={handleSendMessage}
                          disabled={(!newMessage.trim() && !selectedFile) || uploading}
                        >
                          <Send />
                        </IconButton>
                      </Box>
                    </Box>
                  </>
                ) : (
                  <Box
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    height="100%"
                  >
                    <Typography variant="h6" color="text.secondary">
                      Vyberte konverzáciu pre začatie chatu
                    </Typography>
                  </Box>
                )}
              </Paper>
            </Grid>
          </Grid>
        </Box>
      </Fade>

      {/* New chat dialog */}
      <Dialog open={openNewChatDialog} onClose={() => setOpenNewChatDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Začať novú konverzáciu</DialogTitle>
        <DialogContent>
          <Autocomplete
            options={allUsers.filter(u => !participants.some(p => p.id === u.id))}
            getOptionLabel={(option) => getUserDisplay(option).name}
            value={selectedNewUser}
            onChange={(event, newValue) => setSelectedNewUser(newValue)}
            renderOption={(props, option) => (
              <Box component="li" {...props}>
                <Avatar 
                  src={option.profile_photo ? `http://localhost:5555${option.profile_photo}` : undefined} 
                  sx={{ mr: 2, width: 32, height: 32 }}
                >
                  {getUserDisplay(option).initials}
                </Avatar>
                {getUserDisplay(option).name}
                {activeUsers.includes(option.id) && (
                  <Chip
                    label="Online"
                    color="success"
                    size="small"
                    sx={{ ml: 'auto' }}
                  />
                )}
              </Box>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Vyberte používateľa"
                fullWidth
                sx={{ mt: 2 }}
              />
            )}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenNewChatDialog(false)}>Zrušiť</Button>
          <Button onClick={handleStartNewChat} variant="contained" disabled={!selectedNewUser}>
            Začať chat
          </Button>
        </DialogActions>
      </Dialog>

      {/* New group dialog */}
      <Dialog open={openNewGroupDialog} onClose={() => setOpenNewGroupDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Vytvoriť novú skupinu</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <TextField
              label="Názov skupiny"
              value={groupFormData.name}
              onChange={(e) => setGroupFormData({ ...groupFormData, name: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Popis"
              value={groupFormData.description}
              onChange={(e) => setGroupFormData({ ...groupFormData, description: e.target.value })}
              fullWidth
              multiline
              rows={3}
            />
            <Autocomplete
              multiple
              options={allUsers}
              getOptionLabel={(option) => getUserDisplay(option).name}
              value={allUsers.filter(u => groupFormData.memberIds.includes(u.id))}
              onChange={(event, newValue) => {
                setGroupFormData({ 
                  ...groupFormData, 
                  memberIds: newValue.map(u => u.id) 
                });
              }}
              renderOption={(props, option) => (
                <Box component="li" {...props}>
                  <Avatar 
                    src={option.profile_photo ? `http://localhost:5555${option.profile_photo}` : undefined} 
                    sx={{ mr: 2, width: 32, height: 32 }}
                  >
                    {getUserDisplay(option).initials}
                  </Avatar>
                  {getUserDisplay(option).name}
                </Box>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Pridať členov"
                  placeholder="Vyberte členov skupiny"
                />
              )}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenNewGroupDialog(false)}>Zrušiť</Button>
          <Button 
            onClick={handleCreateGroup} 
            variant="contained" 
            disabled={!groupFormData.name}
          >
            Vytvoriť skupinu
          </Button>
        </DialogActions>
      </Dialog>

      {/* Lightbox */}
      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        slides={lightboxImages}
        index={lightboxIndex}
        onIndexChange={setLightboxIndex}
      />
    </Box>
  );
};

export default Chat;