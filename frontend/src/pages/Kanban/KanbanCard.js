import React, { useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import {
  Avatar,
  Button,
  Tooltip,
  Typography,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
} from '@material-ui/core';
import CloseIcon from '@material-ui/icons/Close';
import { format, parseISO, isSameDay } from 'date-fns';
import { useHistory } from 'react-router-dom';
import { Draggable } from 'react-beautiful-dnd';
import api from '../../services/api';
import toastError from '../../errors/toastError';
import { toast } from 'react-toastify';
import { formatBRL, parseValue } from './value';

const useStyles = makeStyles(theme => ({
  card: {
    padding: theme.spacing(0.8),
    background: '#fff',
    borderRadius: 8,
    boxShadow: '0px 10px 17px -10px rgba(0, 0, 0, 0.59)',
    marginBottom: theme.spacing(1),
    cursor: 'grab',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    marginRight: theme.spacing(0.5),
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: theme.spacing(0.5),
    justifyContent: 'space-between',
  },
  leftHeader: {
    display: 'flex',
    alignItems: 'center',
  },
  avatar: {
    marginRight: theme.spacing(1),
    width: theme.spacing(3),
    height: theme.spacing(3),
  },
  cardTitle: {
    fontSize: '1rem',
    fontWeight: 'bold',
    color: theme.mode === "light" ? theme.palette.text.primary : "#000",
  },
  ticketNumber: {
    fontSize: '0.9rem',
    fontWeight: 'bold',
    color: "#757575",
  },
  divider: {
    background: "#e6e6e6",
  },
  lastMessageTime: {
    fontSize: '0.8rem',
    color: "#757575",
  },
  lastMessageTimeUnread: {
    fontSize: '0.8rem',
    color: theme.palette.success.main,
    fontWeight: 'bold',
  },
  cardDescription: {
    fontSize: '0.9rem',
    color: "#757575",
    flexGrow: 1,
    marginRight: theme.spacing(1),
  },
  valueRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: theme.spacing(1),
  },
  descriptionRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing(1),
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    marginTop: 'auto',
  },
  cardButton: {
    fontSize: '0.5rem',
    padding: '2px 6px',
    color: '#fff',
    backgroundColor: theme.palette.primary.main,
    borderRadius: '10px',
    '&:hover': {
      backgroundColor: theme.palette.primary.dark,
    },
  },
  connectionTag: {
    background: "#000",
    color: '#FFF',
    padding: '2px 6px',
    fontWeight: 'bold',
    borderRadius: '10px',
    fontSize: '0.5rem',
    marginLeft: 'auto',
  },
  opportunityValue: {
    fontSize: '0.9rem',
    color: theme.palette.primary.main,
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  removeValueButton: {
    padding: 0,
    marginLeft: theme.spacing(1),
    color: theme.palette.error.main,
  },
  textField: {
    '& .MuiOutlinedInput-root': {
      borderRadius: '10px',
    },
  },
  dialogPaper: {
    borderRadius: '10px',
  },
  dialogButton: {
    borderRadius: '10px',
  },
}));

const KanbanCard = ({ ticket, index, updateTicket }) => {
  const classes = useStyles();
  const history = useHistory();

  const [open, setOpen] = useState(false);
  const [newValue, setNewValue] = useState('');

  const handleCardClick = () => {
    history.push(`/tickets/${ticket.uuid}`);
  };

  const lastMessageTimeClass =
    Number(ticket.unreadMessages) > 0
      ? classes.lastMessageTimeUnread
      : classes.lastMessageTime;

  const customFields = ticket.contact.extraInfo || [];
  const valueField = customFields.find(field => field.name === 'valor') || null;
  const opportunityValue = valueField ? parseValue(valueField.value) : null;

  const handleOpenModal = () => {
    setNewValue(valueField ? String(valueField.value) : '');
    setOpen(true);
  };

  const handleCloseModal = () => {
    setOpen(false);
  };

  /**
   * O backend troca a lista inteira de campos personalizados do contato,
   * então enviamos os outros campos junto para não apagá-los.
   */
  const saveFields = async fields => {
    await api.put(`/contacts/${ticket.contact.id}`, { extraInfo: fields });
    updateTicket({ ...ticket, contact: { ...ticket.contact, extraInfo: fields } });
  };

  const removeContactValue = async () => {
    try {
      await saveFields(customFields.filter(f => f.name !== 'valor'));
    } catch (error) {
      toastError(error);
    }
  };

  const handleSaveValue = async () => {
    const value = parseValue(newValue);
    if (newValue.trim() && value === null) {
      toast.error('Informe um valor em números, por exemplo 1500,00.');
      return;
    }
    try {
      if (!newValue.trim()) await removeContactValue();
      else {
        const others = customFields.filter(f => f.name !== 'valor');
        await saveFields([...others, { name: 'valor', value: String(value) }]);
      }
      setOpen(false);
    } catch (error) {
      toastError(error);
    }
  };

  return (
    <Draggable draggableId={ticket.id.toString()} index={index}>
      {(provided, snapshot) => (
        <div
          className={classes.card}
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
        >
          <div className={classes.header}>
            <div className={classes.leftHeader}>
              <Avatar src={ticket.contact.urlPicture} className={classes.avatar} />
              <Tooltip title={ticket.contact.name}>
                <Typography className={classes.cardTitle}>
                  {ticket.contact.name?.substring(0, 10) || ' '}
                </Typography>
              </Tooltip>
            </div>
            <Typography className={classes.ticketNumber}>
              Ticket nº {ticket.id}
            </Typography>
          </div>
          <Divider className={classes.divider} />
          <div className={classes.valueRow}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Typography
                className={classes.opportunityValue}
                onClick={handleOpenModal}
              >
                {opportunityValue !== null
                  ? `Valor: ${formatBRL(opportunityValue)}`
                  : 'Atribuir Valor'}
              </Typography>
              {opportunityValue !== null && (
                <Tooltip title={"Remover"}>
                  <IconButton
                    className={classes.removeValueButton}
                    onClick={removeContactValue}
                    size="small"
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </div>
          </div>
          <div className={classes.descriptionRow}>
            <Tooltip title={ticket.lastMessage || ' '}>
              <Typography className={classes.cardDescription}>
                {ticket.lastMessage?.substring(0, 20) || ' '}
              </Typography>
            </Tooltip>
            <Typography className={lastMessageTimeClass}>
              {isSameDay(parseISO(ticket.updatedAt), new Date())
                ? format(parseISO(ticket.updatedAt), 'HH:mm')
                : format(parseISO(ticket.updatedAt), 'dd/MM/yyyy')}
            </Typography>
          </div>
          <div className={classes.footer}>
            <Button
              size="small"
              className={classes.cardButton}
              onClick={handleCardClick}
            >
              Ver Ticket
            </Button>
            {ticket.user && (
              <Typography className={classes.connectionTag}>
                {ticket.user.name.toUpperCase()}
              </Typography>
            )}
          </div>
          <Dialog
            open={open}
            onClose={handleCloseModal}
            classes={{ paper: classes.dialogPaper }}
          >
            <DialogTitle>{valueField ? 'Editar' : 'Atribuir'} Valor da Oportunidade</DialogTitle>
            <DialogContent>
              <TextField
                label="Valor (deixe vazio para remover)"
                type="text"
                fullWidth
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                variant="outlined"
                size="small"
                className={classes.textField}
              />
            </DialogContent>
            <DialogActions>
              <Button
                onClick={handleCloseModal}
                color="secondary"
                variant="outlined"
                className={classes.dialogButton}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSaveValue}
                color="primary"
                variant="outlined"
                className={classes.dialogButton}
              >
                Salvar
              </Button>
            </DialogActions>
          </Dialog>
        </div>
      )}
    </Draggable>
  );
};

export default KanbanCard;
