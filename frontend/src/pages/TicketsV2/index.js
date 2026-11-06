import React from "react";
import { useHistory, useParams } from "react-router-dom";
import {
  Button,
  Chip,
  Paper,
  Tooltip,
  Typography,
  makeStyles,
  useMediaQuery,
  useTheme,
} from "@material-ui/core";
import {
  ArrowBack,
  CheckCircleOutline,
  ForumOutlined,
  LockOutlined,
  RecordVoiceOverOutlined,
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
      gridTemplateColumns: "minmax(280px, 38%) minmax(420px, 1fr)",
      overflowX: "auto",
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

const AiN1Placeholder = () => {
  const classes = useStyles();

  return (
    <aside className={classes.context} aria-label="Recursos futuros do atendimento">
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
          o atendimento completo para uma equipe humana N2.
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
          <strong style={{ display: "block", marginBottom: 3 }}>Próxima etapa</strong>
          Contexto unificado do cliente, SLA e presença de atendentes.
        </span>
      </div>
    </aside>
  );
};

const TicketsV2 = () => {
  const classes = useStyles();
  const history = useHistory();
  const { ticketId } = useParams();
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down("sm"));

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
            <section className={classes.inbox} aria-label="Lista de atendimentos">
              <TicketsManagerTabs routeBase={V2_ROUTE} />
            </section>

            <section className={classes.conversation} aria-label="Conversa selecionada">
              {ticketId ? (
                <div className={classes.ticketSurface}>
                  <Ticket routeBase={V2_ROUTE} />
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

            <AiN1Placeholder />
          </div>
        </div>
      </div>
    </QueueSelectedProvider>
  );
};

export default TicketsV2;
