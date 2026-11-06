import React, { useCallback, useEffect, useState } from "react";
import { useHistory, useParams } from "react-router-dom";
import clsx from "clsx";
import {
  Avatar,
  Button,
  Chip,
  Divider,
  Drawer,
  IconButton,
  Paper,
  Tooltip,
  Typography,
  makeStyles,
  useMediaQuery,
  useTheme,
} from "@material-ui/core";
import {
  ArrowBack,
  AssignmentIndOutlined,
  CheckCircleOutline,
  Close,
  EmailOutlined,
  ForumOutlined,
  InfoOutlined,
  LabelOutlined,
  LockOutlined,
  PersonOutline,
  RecordVoiceOverOutlined,
  Schedule,
  TrendingUp,
} from "@material-ui/icons";

import Ticket from "../../components/Ticket";
import TicketsManagerTabs from "../../components/TicketsManagerTabs";
import { QueueSelectedProvider } from "../../context/QueuesSelected/QueuesSelectedContext";

const V2_ROUTE = "/tickets-v2";

const useStyles = makeStyles(theme => ({
  root: {
    height: "calc(100% - 48px)",
    minHeight: 0,
    padding: theme.spacing(1.25),
    background:
      theme.palette.type === "dark"
        ? "#11131f"
        : "linear-gradient(145deg, #f7f7fc 0%, #f1effa 100%)",
    overflow: "hidden",
  },
  shell: {
    height: "100%",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 16,
    background: theme.palette.background.paper,
    boxShadow:
      theme.palette.type === "dark"
        ? "0 18px 44px rgba(0, 0, 0, .28)"
        : "0 18px 44px rgba(38, 31, 71, .10)",
  },
  topbar: {
    minHeight: 58,
    padding: theme.spacing(0, 2),
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(2),
    borderBottom: `1px solid ${theme.palette.divider}`,
    background: theme.palette.background.paper,
  },
  titleGroup: {
    display: "flex",
    alignItems: "center",
    minWidth: 0,
    gap: theme.spacing(1.25),
  },
  mark: {
    width: 34,
    height: 34,
    display: "grid",
    placeItems: "center",
    color: "#fff",
    borderRadius: 11,
    background: "linear-gradient(145deg, #8658f3, #5b2bc8)",
    boxShadow: "0 8px 20px rgba(109, 57, 232, .24)",
  },
  title: {
    fontSize: 15,
    fontWeight: 800,
    lineHeight: 1.1,
  },
  subtitle: {
    marginTop: 3,
    color: theme.palette.text.secondary,
    fontSize: 11,
  },
  beta: {
    height: 22,
    color: "#5e35b1",
    background: "#eee8ff",
    border: "1px solid #d8cafa",
    fontSize: 9,
    fontWeight: 900,
  },
  topActions: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
  },
  preserved: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    color: theme.palette.type === "dark" ? "#70d8b1" : "#14805f",
    fontSize: 11,
    fontWeight: 700,
    [theme.breakpoints.down("md")]: { display: "none" },
  },
  classicButton: {
    borderRadius: 9,
    textTransform: "none",
    fontSize: 11,
    fontWeight: 700,
  },
  workspace: {
    flex: 1,
    minHeight: 0,
    display: "grid",
    gridTemplateColumns: "minmax(300px, 342px) minmax(470px, 1fr) 300px",
    background: theme.palette.background.default,
    [theme.breakpoints.down(1450)]: {
      gridTemplateColumns: "minmax(300px, 342px) minmax(470px, 1fr)",
    },
    [theme.breakpoints.down("sm")]: {
      gridTemplateColumns: "minmax(0, 1fr)",
      overflow: "hidden",
    },
  },
  inbox: {
    minWidth: 0,
    minHeight: 0,
    overflow: "hidden",
    borderRight: `1px solid ${theme.palette.divider}`,
    "& > .MuiPaper-root": {
      border: 0,
      borderRadius: 0,
    },
  },
  conversation: {
    minWidth: 0,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    background: theme.palette.background.paper,
  },
  ticketSurface: {
    minHeight: 0,
    flex: 1,
    overflow: "hidden",
    "& > #drawer-container": { height: "100%" },
    "& .MuiPaper-outlined": { borderColor: theme.palette.divider },
  },
  empty: {
    height: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing(4),
    textAlign: "center",
    background:
      theme.palette.type === "dark"
        ? "radial-gradient(circle at 50% 35%, rgba(109,57,232,.16), transparent 36%)"
        : "radial-gradient(circle at 50% 35%, rgba(109,57,232,.09), transparent 36%)",
  },
  emptyIcon: {
    width: 64,
    height: 64,
    marginBottom: theme.spacing(2),
    display: "grid",
    placeItems: "center",
    color: "#6d39e8",
    borderRadius: 22,
    background: theme.palette.type === "dark" ? "#25213a" : "#eee9ff",
  },
  context: {
    minWidth: 0,
    overflowY: "auto",
    padding: theme.spacing(1.5),
    borderLeft: `1px solid ${theme.palette.divider}`,
    background: theme.palette.background.paper,
    [theme.breakpoints.down(1450)]: { display: "none" },
  },
  compactInboxHidden: {
    [theme.breakpoints.down("sm")]: { display: "none" },
  },
  compactConversationHidden: {
    [theme.breakpoints.down("sm")]: { display: "none" },
  },
  contextToolbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing(1),
  },
  contextClose: {
    display: "none",
  },
  drawerPaper: {
    width: 320,
    maxWidth: "92vw",
    padding: theme.spacing(1.5),
    background: theme.palette.background.paper,
  },
  detailsButton: {
    borderRadius: 9,
    textTransform: "none",
    fontSize: 11,
    fontWeight: 700,
  },
  customerCard: {
    padding: theme.spacing(1.75),
    marginBottom: theme.spacing(1.5),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 14,
    textAlign: "center",
    background: theme.palette.background.paper,
  },
  customerAvatar: {
    width: 58,
    height: 58,
    margin: "0 auto 10px",
    color: "#fff",
    fontWeight: 900,
    background: "linear-gradient(145deg, #ef8fa1, #cf5575)",
    boxShadow: "0 10px 22px rgba(207, 85, 117, .18)",
  },
  customerName: {
    fontSize: 14,
    fontWeight: 900,
  },
  customerMeta: {
    marginTop: 3,
    color: theme.palette.text.secondary,
    fontSize: 10.5,
  },
  tags: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 5,
    marginTop: theme.spacing(1.25),
  },
  contactTag: {
    height: 22,
    fontSize: 9,
    fontWeight: 800,
  },
  detailsCard: {
    marginBottom: theme.spacing(1.5),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 14,
    overflow: "hidden",
    background: theme.palette.background.paper,
  },
  detailRow: {
    display: "grid",
    gridTemplateColumns: "27px minmax(72px, auto) 1fr",
    alignItems: "center",
    gap: 7,
    minHeight: 38,
    padding: theme.spacing(0.5, 1.25),
    color: theme.palette.text.secondary,
    fontSize: 10.5,
    "& svg": { color: theme.palette.primary.main, fontSize: 16 },
    "& strong": {
      color: theme.palette.text.primary,
      fontSize: 10.5,
      fontWeight: 800,
      textAlign: "right",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
  },
  contextEmpty: {
    padding: theme.spacing(2),
    marginBottom: theme.spacing(1.5),
    color: theme.palette.text.secondary,
    border: `1px dashed ${theme.palette.divider}`,
    borderRadius: 14,
    textAlign: "center",
    fontSize: 11,
  },
  keyboardHint: {
    marginLeft: 5,
    padding: "2px 6px",
    color: theme.palette.text.secondary,
    border: `1px solid ${theme.palette.divider}`,
    borderBottomWidth: 2,
    borderRadius: 5,
    background: theme.palette.background.default,
    fontSize: 9,
    fontWeight: 800,
  },
  sectionTitle: {
    margin: theme.spacing(0.5, 0, 1.25),
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: ".06em",
    textTransform: "uppercase",
    color: theme.palette.text.secondary,
  },
  aiCard: {
    position: "relative",
    overflow: "hidden",
    padding: theme.spacing(1.75),
    borderRadius: 14,
    border: "1px solid #dcd0fc",
    background:
      theme.palette.type === "dark"
        ? "linear-gradient(145deg, #29233b, #211d32)"
        : "linear-gradient(145deg, #f2edff, #faf8ff)",
  },
  aiHead: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    color: theme.palette.type === "dark" ? "#c6b4ff" : "#55329e",
    fontSize: 12,
    fontWeight: 900,
  },
  futureChip: {
    height: 19,
    color: "#6742ba",
    background: "#e4d9ff",
    fontSize: 8,
    fontWeight: 900,
  },
  aiCopy: {
    margin: theme.spacing(1.25, 0),
    color: theme.palette.text.secondary,
    fontSize: 10.5,
    lineHeight: 1.5,
  },
  aiFlow: {
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr auto 1fr",
    alignItems: "center",
    gap: 4,
    marginTop: theme.spacing(1.25),
    color: theme.palette.text.secondary,
    fontSize: 9,
    textAlign: "center",
  },
  flowNode: {
    padding: "6px 4px",
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 8,
    background: theme.palette.background.paper,
    fontWeight: 800,
  },
  n2Node: {
    color: "#15775b",
    borderColor: "#bce6d7",
    background: theme.palette.type === "dark" ? "#15352d" : "#f2fff9",
  },
  disabledButton: {
    width: "100%",
    marginTop: theme.spacing(1.5),
    borderRadius: 9,
    textTransform: "none",
    fontSize: 10,
    fontWeight: 800,
  },
  coverageCard: {
    marginTop: theme.spacing(1.5),
    padding: theme.spacing(1.5),
    borderRadius: 14,
    border: `1px solid ${theme.palette.divider}`,
    boxShadow: "none",
  },
  coverageItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    margin: theme.spacing(1, 0),
    color: theme.palette.text.secondary,
    fontSize: 10.5,
    "& svg": { color: "#24a37b", fontSize: 16 },
  },
  metricCard: {
    display: "grid",
    gridTemplateColumns: "36px 1fr",
    gap: 10,
    marginTop: theme.spacing(1.5),
    padding: theme.spacing(1.25),
    borderRadius: 12,
    color: theme.palette.text.secondary,
    background: theme.palette.type === "dark" ? "#20222e" : "#f7f8fb",
    fontSize: 10,
  },
  metricIcon: {
    width: 36,
    height: 36,
    display: "grid",
    placeItems: "center",
    color: "#6d39e8",
    borderRadius: 10,
    background: theme.palette.type === "dark" ? "#302a46" : "#ede8ff",
  },
}));

const statusLabels = {
  open: "Em atendimento",
  pending: "Aguardando",
  closed: "Resolvido",
  group: "Grupo",
  chatbot: "Chatbot",
};

const CustomerContext = ({ context, drawer = false, onClose }) => {
  const classes = useStyles();
  const contact = context.contact || {};
  const ticket = context.ticket || {};
  const hasTicket = Boolean(ticket.id || contact.id);
  const contactTags = Array.isArray(contact.tags) ? contact.tags.slice(0, 5) : [];
  const initials = (contact.name || "Cliente")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join("");

  const content = (
    <>
      <div className={classes.contextToolbar}>
        <div className={classes.sectionTitle} style={{ margin: 0 }}>
          Contexto do cliente
        </div>
        {drawer && (
          <IconButton aria-label="Fechar detalhes" onClick={onClose} size="small">
            <Close fontSize="small" />
          </IconButton>
        )}
      </div>

      {hasTicket ? (
        <>
          <div className={classes.customerCard}>
            <Avatar
              alt={contact.name || "Cliente"}
              className={classes.customerAvatar}
              src={contact.urlPicture}
            >
              {initials}
            </Avatar>
            <div className={classes.customerName}>{contact.name || "Contato sem nome"}</div>
            <div className={classes.customerMeta}>
              Ticket #{ticket.id || "—"} • {ticket.channel || "Canal não informado"}
            </div>
            {contactTags.length > 0 && (
              <div className={classes.tags}>
                {contactTags.map(tag => (
                  <Chip
                    className={classes.contactTag}
                    key={tag.id || tag.name}
                    label={tag.name}
                    size="small"
                    style={tag.color ? { borderColor: tag.color, color: tag.color } : undefined}
                    variant="outlined"
                  />
                ))}
              </div>
            )}
          </div>

          <div className={classes.detailsCard}>
            <div className={classes.detailRow}>
              <AssignmentIndOutlined /> <span>Status</span>
              <strong>{statusLabels[ticket.status] || ticket.status || "—"}</strong>
            </div>
            <Divider />
            <div className={classes.detailRow}>
              <LabelOutlined /> <span>Fila</span>
              <strong>{ticket.queue?.name || "Sem fila"}</strong>
            </div>
            <Divider />
            <div className={classes.detailRow}>
              <PersonOutline /> <span>Responsável</span>
              <strong>{ticket.user?.name || "Não atribuído"}</strong>
            </div>
            {contact.email && (
              <>
                <Divider />
                <div className={classes.detailRow}>
                  <EmailOutlined /> <span>E-mail</span>
                  <strong title={contact.email}>{contact.email}</strong>
                </div>
              </>
            )}
            {ticket.createdAt && (
              <>
                <Divider />
                <div className={classes.detailRow}>
                  <Schedule /> <span>Iniciado em</span>
                  <strong>{new Date(ticket.createdAt).toLocaleDateString("pt-BR")}</strong>
                </div>
              </>
            )}
          </div>
        </>
      ) : (
        <div className={classes.contextEmpty}>
          Selecione um atendimento para visualizar cliente, fila, responsável e etiquetas.
        </div>
      )}

      <div className={classes.sectionTitle}>Evolução do atendimento</div>
      <div className={classes.aiCard}>
        <div className={classes.aiHead}>
          <RecordVoiceOverOutlined fontSize="small" />
          Assistente N1
          <Chip className={classes.futureChip} label="Futuro" size="small" />
        </div>
        <div className={classes.aiCopy}>
          Estrutura reservada para uma IA responder dúvidas simples usando a
          base da empresa. Quando não houver resposta segura, ela encaminhará
          a conversa e o contexto para uma equipe humana N2.
        </div>
        <div className={classes.aiFlow} aria-label="Cliente para IA N1 e equipe N2">
          <span className={classes.flowNode}>Cliente</span>
          <span>→</span>
          <span className={classes.flowNode}>IA N1</span>
          <span>→</span>
          <span className={`${classes.flowNode} ${classes.n2Node}`}>Humano N2</span>
        </div>
        <Button
          className={classes.disabledButton}
          disabled
          startIcon={<LockOutlined />}
          variant="outlined"
        >
          Integração não ativada
        </Button>
      </div>

      <Paper className={classes.coverageCard} variant="outlined">
        <div className={classes.sectionTitle}>Compatibilidade V2</div>
        {[
          "Mensagens e anexos",
          "Filas, busca e filtros",
          "Transferência e finalização",
          "Respostas rápidas e tags",
          "Atualizações em tempo real",
        ].map(item => (
          <div className={classes.coverageItem} key={item}>
            <CheckCircleOutline /> <span>{item}</span>
          </div>
        ))}
      </Paper>

      <div className={classes.metricCard}>
        <span className={classes.metricIcon}><TrendingUp fontSize="small" /></span>
        <span>
          <strong style={{ display: "block", marginBottom: 3 }}>Próxima evolução</strong>
          SLA configurável e presença colaborativa dos atendentes.
        </span>
      </div>
    </>
  );

  return drawer ? (
    <div>{content}</div>
  ) : (
    <aside className={classes.context} aria-label="Contexto do atendimento">
      {content}
    </aside>
  );
};

const TicketsV2 = () => {
  const classes = useStyles();
  const history = useHistory();
  const { ticketId } = useParams();
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down("sm"));
  const contextInline = useMediaQuery("(min-width:1451px)");
  const [contextDrawerOpen, setContextDrawerOpen] = useState(false);
  const [ticketContext, setTicketContext] = useState({
    contact: {},
    ticket: {},
    loading: false,
  });

  const handleTicketContextChange = useCallback(nextContext => {
    setTicketContext(nextContext);
  }, []);

  useEffect(() => {
    if (!ticketId) {
      setTicketContext({ contact: {}, ticket: {}, loading: false });
      setContextDrawerOpen(false);
    }
  }, [ticketId]);

  useEffect(() => {
    const handleKeyboardNavigation = event => {
      const element = event.target;
      const isTyping = ["INPUT", "TEXTAREA", "SELECT"].includes(element?.tagName);

      if (event.key === "Escape" && ticketId && !isTyping) {
        history.push(V2_ROUTE);
      }

      if (event.altKey && event.key.toLowerCase() === "i" && !contextInline) {
        event.preventDefault();
        setContextDrawerOpen(current => !current);
      }
    };

    window.addEventListener("keydown", handleKeyboardNavigation);
    return () => window.removeEventListener("keydown", handleKeyboardNavigation);
  }, [contextInline, history, ticketId]);

  return (
    <QueueSelectedProvider>
      <div className={classes.root}>
        <div className={classes.shell}>
          <header className={classes.topbar}>
            <div className={classes.titleGroup}>
              <span className={classes.mark}><ForumOutlined fontSize="small" /></span>
              <div>
                <div className={classes.title}>Central de atendimento</div>
                <div className={classes.subtitle}>Nova experiência, mesmas funcionalidades</div>
              </div>
              <Chip className={classes.beta} label="V2 BETA" size="small" />
            </div>
            <div className={classes.topActions}>
              <span className={classes.preserved}>
                <CheckCircleOutline fontSize="small" /> Funcionalidades preservadas
              </span>
              {!contextInline && ticketId && (
                <Tooltip title="Abrir contexto do cliente (Alt + I)">
                  <Button
                    className={classes.detailsButton}
                    onClick={() => setContextDrawerOpen(true)}
                    size="small"
                    startIcon={<InfoOutlined />}
                    variant="outlined"
                  >
                    Detalhes <span className={classes.keyboardHint}>Alt I</span>
                  </Button>
                </Tooltip>
              )}
              {isSmall && ticketId && (
                <Tooltip title="Voltar para a lista de atendimentos">
                  <Button
                    className={classes.classicButton}
                    onClick={() => history.push(V2_ROUTE)}
                    size="small"
                    startIcon={<ArrowBack />}
                    variant="outlined"
                  >
                    Conversas
                  </Button>
                </Tooltip>
              )}
              <Tooltip title="Retornar para a interface atual">
                <Button
                  className={classes.classicButton}
                  onClick={() => history.push("/tickets")}
                  size={isSmall ? "small" : "medium"}
                  startIcon={<ArrowBack />}
                  variant="outlined"
                >
                  Interface atual
                </Button>
              </Tooltip>
            </div>
          </header>

          <div className={classes.workspace}>
            <section
              className={clsx(classes.inbox, {
                [classes.compactInboxHidden]: isSmall && ticketId,
              })}
              aria-label="Lista de atendimentos"
            >
              <TicketsManagerTabs routeBase={V2_ROUTE} />
            </section>

            <section
              className={clsx(classes.conversation, {
                [classes.compactConversationHidden]: isSmall && !ticketId,
              })}
              aria-label="Conversa selecionada"
            >
              {ticketId ? (
                <div className={classes.ticketSurface}>
                  <Ticket
                    onTicketContextChange={handleTicketContextChange}
                    routeBase={V2_ROUTE}
                  />
                </div>
              ) : (
                <div className={classes.empty}>
                  <span className={classes.emptyIcon}><ForumOutlined fontSize="large" /></span>
                  <Typography variant="h6">Selecione um atendimento</Typography>
                  <Typography color="textSecondary" variant="body2">
                    A conversa será aberta aqui sem perder sua posição na fila.
                  </Typography>
                </div>
              )}
            </section>

            <CustomerContext context={ticketContext} />
          </div>
        </div>
      </div>

      <Drawer
        anchor="right"
        classes={{ paper: classes.drawerPaper }}
        onClose={() => setContextDrawerOpen(false)}
        open={contextDrawerOpen && !contextInline}
      >
        <CustomerContext
          context={ticketContext}
          drawer
          onClose={() => setContextDrawerOpen(false)}
        />
      </Drawer>
    </QueueSelectedProvider>
  );
};

export default TicketsV2;
