import React, { useState, useEffect, useContext } from "react";
import { toast } from "react-toastify";
import { makeStyles } from "@material-ui/core/styles";
import {
  Paper,
  Typography,
  Switch,
  FormControlLabel,
  TextField,
  Button,
  Grid,
  Divider,
  Box,
  Card,
  CardContent,
  CardHeader,
  IconButton,
  Collapse,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from "@material-ui/core";
import Autocomplete from "@material-ui/lab/Autocomplete";
import {
  Cake as CakeIcon,
  Person as PersonIcon,
  Phone as PhoneIcon,
  Schedule as ScheduleIcon,
  Announcement as AnnouncementIcon,
  ExpandMore as ExpandMoreIcon,
  Save as SaveIcon,
  Settings as TestIcon,
  Info as InfoIcon
} from "@material-ui/icons";
import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { WhatsAppsContext } from "../../context/WhatsApp/WhatsAppsContext";

const useStyles = makeStyles((theme) => ({
  root: {
    padding: theme.spacing(3)
  },
  paper: {
    padding: theme.spacing(3),
    marginBottom: theme.spacing(2)
  },
  sectionTitle: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    marginBottom: theme.spacing(2),
    color: theme.palette.primary.main,
    fontWeight: 600
  },
  settingItem: {
    marginBottom: theme.spacing(2)
  },
  messageField: {
    marginTop: theme.spacing(1)
  },
  timeField: {
    maxWidth: 200
  },
  saveButton: {
    background: "linear-gradient(135deg, #1976d2 0%, #1565c0 100%)",
    color: "white",
    fontWeight: 600,
    textTransform: "none",
    borderRadius: 8,
    padding: theme.spacing(1, 3),
    "&:hover": {
      transform: "translateY(-1px)",
      boxShadow: "0 4px 12px rgba(25, 118, 210, 0.3)"
    }
  },
  testButton: {
    background: "linear-gradient(135deg, #ff9800 0%, #f57c00 100%)",
    color: "white",
    fontWeight: 600,
    textTransform: "none",
    borderRadius: 8,
    marginLeft: theme.spacing(1),
    "&:hover": {
      transform: "translateY(-1px)",
      boxShadow: "0 4px 12px rgba(255, 152, 0, 0.3)"
    }
  },
  expandButton: {
    transform: "rotate(0deg)",
    transition: theme.transitions.create("transform", {
      duration: theme.transitions.duration.shortest
    })
  },
  expandButtonOpen: {
    transform: "rotate(180deg)"
  },
  helpText: {
    fontSize: "0.875rem",
    color: theme.palette.text.secondary,
    marginTop: theme.spacing(0.5)
  },
  messagePreview: {
    backgroundColor: theme.palette.grey[100],
    padding: theme.spacing(2),
    borderRadius: 8,
    marginTop: theme.spacing(1),
    border: `1px solid ${theme.palette.grey[300]}`
  },
  variableChip: {
    backgroundColor: theme.palette.primary.main,
    color: "white",
    padding: "2px 8px",
    borderRadius: 4,
    fontSize: "0.75rem",
    fontFamily: "monospace",
    margin: "0 2px"
  },
  infoBox: {
    backgroundColor: "#e3f2fd",
    border: "1px solid #90caf9",
    borderRadius: 8,
    padding: theme.spacing(2),
    marginTop: theme.spacing(2),
    display: "flex",
    alignItems: "flex-start",
    gap: theme.spacing(1)
  },
  infoIcon: {
    color: "#1976d2",
    fontSize: "1.25rem",
    marginTop: 2
  },
  infoContent: {
    flex: 1
  }
}));

const BirthdaySettings = () => {
  const classes = useStyles();
  const { whatsApps } = useContext(WhatsAppsContext);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [testType, setTestType] = useState("contact");
  const [testContact, setTestContact] = useState(null);
  const [testOptions, setTestOptions] = useState([]);
  const [testLoading, setTestLoading] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    user: true,
    contact: true,
    general: true
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data } = await api.get("/birthdays/settings");
      setSettings(data.data);
    } catch (error) {
      toast.error("Erro ao carregar configurações de aniversário");
    } finally {
      setLoading(false);
    }
  };

  const handleSettingChange = (field, value) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put("/birthdays/settings", settings);
      toast.success("Configurações de aniversário salvas com sucesso! 🎉");
    } catch (error) {
      toast.error("Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  // Teste: escolher o contato pelo nome, não por um número que ninguém sabe de cor.
  const handleTestMessage = (messageType) => {
    setTestType(messageType);
    setTestContact(null);
    setTestOpen(true);
  };

  const searchContacts = async (term) => {
    setTestLoading(true);
    try {
      const { data } = await api.get("/contacts", {
        params: { searchParam: term, pageNumber: 1 }
      });
      setTestOptions(data.contacts || []);
    } catch (error) {
      setTestOptions([]);
    }
    setTestLoading(false);
  };

  const sendTestMessage = async () => {
    if (!testContact) return;
    setTestSending(true);
    try {
      await api.post("/birthdays/test-message", {
        contactId: testContact.id,
        messageType: testType
      });
      toast.success(`Mensagem de teste enviada para ${testContact.name}.`);
      setTestOpen(false);
    } catch (error) {
      toastError(error);
    }
    setTestSending(false);
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const renderMessagePreview = (message, type) => {
    if (!message) return null;

    let previewMessage = message;
    previewMessage = previewMessage.replace(
      /{nome}/g, 
      `<span class="${classes.variableChip}">João Silva</span>`
    );
    previewMessage = previewMessage.replace(
      /{idade}/g, 
      `<span class="${classes.variableChip}">30</span>`
    );

    return (
      <Box className={classes.messagePreview}>
        <Typography variant="caption" color="textSecondary">
          Pré-visualização:
        </Typography>
        <Typography 
          variant="body2" 
          dangerouslySetInnerHTML={{ __html: previewMessage }}
        />
      </Box>
    );
  };

  if (loading) {
    return (
      <Box className={classes.root}>
        <Typography>Carregando configurações...</Typography>
      </Box>
    );
  }

  return (
    <Box className={classes.root}>
      <Dialog open={testOpen} onClose={() => setTestOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Enviar mensagem de teste</DialogTitle>
        <DialogContent>
          <Autocomplete
            options={testOptions}
            loading={testLoading}
            value={testContact}
            onChange={(e, v) => setTestContact(v)}
            onInputChange={(e, v) => v && v.length >= 2 && searchContacts(v)}
            getOptionLabel={(o) => `${o.name} (${o.number})`}
            getOptionSelected={(o, v) => o.id === v.id}
            noOptionsText="Digite ao menos duas letras do nome"
            renderInput={(params) => (
              <TextField
                {...params}
                autoFocus
                label="Contato que vai receber o teste"
                variant="outlined"
                margin="dense"
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {testLoading ? <CircularProgress color="inherit" size={18} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  )
                }}
              />
            )}
          />
          <Typography variant="body2" color="textSecondary" style={{ marginTop: 8 }}>
            A mensagem vai com a marca [TESTE] na frente.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTestOpen(false)}>Cancelar</Button>
          <Button color="primary" variant="contained" disabled={!testContact || testSending} onClick={sendTestMessage}>
            Enviar
          </Button>
        </DialogActions>
      </Dialog>
      <Typography variant="h4" gutterBottom>
        🎂 Configurações de Aniversário
      </Typography>

      {/* Configurações de Usuários */}
      <Paper className={classes.paper}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6" className={classes.sectionTitle}>
            <PersonIcon />
            Aniversários de Usuários
          </Typography>
          <IconButton
            className={`${classes.expandButton} ${
              expandedSections.user ? classes.expandButtonOpen : ""
            }`}
            onClick={() => toggleSection("user")}
          >
            <ExpandMoreIcon />
          </IconButton>
        </Box>

        <Collapse in={expandedSections.user}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings?.userBirthdayEnabled || false}
                    onChange={(e) => handleSettingChange("userBirthdayEnabled", e.target.checked)}
                    color="primary"
                  />
                }
                label="Habilitar notificações de aniversário de usuários"
              />
              <Typography className={classes.helpText}>
                Quando habilitado, será exibido modal de parabéns e criado informativo automático
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings?.createAnnouncementForUsers || false}
                    onChange={(e) => handleSettingChange("createAnnouncementForUsers", e.target.checked)}
                    color="primary"
                    disabled={!settings?.userBirthdayEnabled}
                  />
                }
                label="Criar informativo automático para aniversários de usuários"
              />
              <Typography className={classes.helpText}>
                Cria um informativo automático que é exibido para todos os usuários da empresa
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Mensagem de aniversário para usuários"
                value={settings?.userBirthdayMessage || ""}
                onChange={(e) => handleSettingChange("userBirthdayMessage", e.target.value)}
                disabled={!settings?.userBirthdayEnabled}
                className={classes.messageField}
                helperText="Use {nome} para incluir o nome do usuário"
              />
              {renderMessagePreview(settings?.userBirthdayMessage, "user")}
            </Grid>
          </Grid>
        </Collapse>
      </Paper>

      {/* Configurações de Contatos */}
      <Paper className={classes.paper}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6" className={classes.sectionTitle}>
            <PhoneIcon />
            Aniversários de Contatos
          </Typography>
          <IconButton
            className={`${classes.expandButton} ${
              expandedSections.contact ? classes.expandButtonOpen : ""
            }`}
            onClick={() => toggleSection("contact")}
          >
            <ExpandMoreIcon />
          </IconButton>
        </Box>

        <Collapse in={expandedSections.contact}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings?.contactBirthdayEnabled || false}
                    onChange={(e) => handleSettingChange("contactBirthdayEnabled", e.target.checked)}
                    color="primary"
                  />
                }
                label="Habilitar envio automático de mensagens de aniversário para contatos"
              />
              <Typography className={classes.helpText}>
                Envia automaticamente mensagem de parabéns via WhatsApp para contatos aniversariantes
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Mensagem de aniversário para contatos"
                value={settings?.contactBirthdayMessage || ""}
                onChange={(e) => handleSettingChange("contactBirthdayMessage", e.target.value)}
                disabled={!settings?.contactBirthdayEnabled}
                className={classes.messageField}
                helperText="Use {nome} para incluir o nome do contato e {idade} para a idade"
              />
              {renderMessagePreview(settings?.contactBirthdayMessage, "contact")}
              
              {settings?.contactBirthdayEnabled && (
                <Button
                  variant="contained"
                  className={classes.testButton}
                  startIcon={<TestIcon />}
                  onClick={() => handleTestMessage("contact")}
                  size="small"
                  style={{ marginTop: 8 }}
                >
                  Testar Mensagem
                </Button>
              )}
            </Grid>
          </Grid>
        </Collapse>
      </Paper>

      {/* Configurações Gerais */}
      <Paper className={classes.paper}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6" className={classes.sectionTitle}>
            <ScheduleIcon />
            Configurações Gerais
          </Typography>
          <IconButton
            className={`${classes.expandButton} ${
              expandedSections.general ? classes.expandButtonOpen : ""
            }`}
            onClick={() => toggleSection("general")}
          >
            <ExpandMoreIcon />
          </IconButton>
        </Box>

        <Collapse in={expandedSections.general}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                type="time"
                label="Horário de envio das mensagens"
                value={settings?.sendBirthdayTime || "09:00:00"}
                onChange={(e) => {
                  // Converter HH:MM para HH:MM:SS para compatibilidade com backend
                  const timeValue = e.target.value;
                  const formattedTime = timeValue ? `${timeValue}:00` : "09:00:00";
                  handleSettingChange("sendBirthdayTime", formattedTime);
                }}
                className={classes.timeField}
                InputLabelProps={{ shrink: true }}
                helperText="Horário em que as mensagens automáticas serão enviadas"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Conexão WhatsApp para Envio</InputLabel>
             <Select
               value={settings?.whatsappId || ""}
               onChange={(e) => handleSettingChange("whatsappId", e.target.value || null)}
               label="Conexão WhatsApp para Envio"
               disabled={!settings?.contactBirthdayEnabled}
             >
                  <MenuItem value="">
                    <em>Selecione uma conexão</em>
                  </MenuItem>
                  {whatsApps?.length > 0 &&
                    whatsApps.map((whatsapp) => (
                      <MenuItem key={whatsapp.id} value={whatsapp.id}>
                        <Box display="flex" alignItems="center">
                          <Box
                            width={8}
                            height={8}
                            borderRadius="50%"
                            bgcolor={whatsapp.status === "CONNECTED" ? "success.main" : "error.main"}
                            mr={1}
                          />
                          {whatsapp.name} ({whatsapp.status})
                        </Box>
                      </MenuItem>
                    ))}
                </Select>
                <Typography className={classes.helpText}>
                  Conexão WhatsApp que será usada para enviar mensagens de aniversário
                </Typography>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings?.createAnnouncementForUsers || false}
                    onChange={(e) => handleSettingChange("createAnnouncementForUsers", e.target.checked)}
                    color="primary"
                  />
                }
                label="Criar informativo interno para aniversários de usuários"
              />
              <Typography className={classes.helpText}>
                Cria um informativo interno quando um usuário faz aniversário
              </Typography>
            </Grid>
          </Grid>

          <Box className={classes.infoBox}>
            <InfoIcon className={classes.infoIcon} />
            <Box className={classes.infoContent}>
              <Typography variant="body2" style={{ fontWeight: 600, marginBottom: 8 }}>
                Variáveis disponíveis nas mensagens:
              </Typography>
              <Typography variant="body2" component="div">
                • <code>{"{nome}"}</code> - Nome da pessoa<br/>
                • <code>{"{idade}"}</code> - Idade da pessoa (apenas para contatos)
              </Typography>
            </Box>
          </Box>
        </Collapse>
      </Paper>

      {/* Botão Salvar */}
      <Box textAlign="center" mt={3}>
        <Button
          variant="contained"
          className={classes.saveButton}
          startIcon={<SaveIcon />}
          onClick={handleSave}
          disabled={saving}
          size="large"
        >
          {saving ? "Salvando..." : "Salvar Configurações"}
        </Button>
      </Box>
    </Box>
  );
};

export default BirthdaySettings;