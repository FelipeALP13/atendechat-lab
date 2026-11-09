import React, { useCallback, useContext, useEffect, useState } from "react";
import {
  Button,
  Chip,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  LinearProgress,
  MenuItem,
  Paper,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { Delete, FileCopy } from "@material-ui/icons";
import { toast } from "react-toastify";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";
import toastError from "../../errors/toastError";
import api from "../../services/api";
import { AuthContext } from "../../context/Auth/AuthContext";

const useStyles = makeStyles(theme => ({
  paper: { flex: 1, padding: theme.spacing(2), overflowY: "auto", ...theme.scrollbarStyles },
  block: { marginBottom: theme.spacing(3) },
  hint: { color: theme.palette.text.secondary, fontSize: 13, margin: "4px 0 0" },
  group: { marginTop: theme.spacing(2), fontWeight: 600 },
  snippet: {
    background: theme.palette.type === "dark" ? "#20222e" : "#f4f5fa",
    border: "1px solid rgba(0,0,0,.12)",
    borderRadius: 8,
    padding: 12,
    fontFamily: "monospace",
    fontSize: 13,
    wordBreak: "break-all"
  },
  bar: { height: 8, borderRadius: 4, marginTop: 4 }
}));

const DAYS = [
  [1, "seg"],
  [2, "ter"],
  [3, "qua"],
  [4, "qui"],
  [5, "sex"],
  [6, "sáb"],
  [0, "dom"]
];
const when = t => (t ? new Date(Number(t)).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");

const Site = () => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const isAdmin = user.profile === "admin";

  const [tab, setTab] = useState(0);
  const [state, setState] = useState(null);
  const [site, setSite] = useState(null);
  const [texts, setTexts] = useState([]);
  const [busy, setBusy] = useState(false);
  const [origins, setOrigins] = useState("");

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/site/config");
      setState(data);
      setSite(data.site);
      setTexts(data.texts || []);
      setOrigins((data.site.chat.origins || []).join("\n"));
    } catch (e) {
      toastError(e);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  if (!site) return <LinearProgress />;

  const part = (group, patch) => setSite({ ...site, [group]: { ...site[group], ...patch } });
  const schedule = patch => part("chat", { schedule: { ...site.chat.schedule, ...patch } });

  const payload = () => ({
    ...site,
    chat: {
      ...site.chat,
      origins: origins
        .split(/[\n,;\s]+/)
        .map(o => o.trim())
        .filter(Boolean)
    }
  });

  const save = async (andPublish = false) => {
    setBusy(true);
    try {
      const { data } = await api.put("/site/config", payload());
      setState({ ...state, ...data });
      setSite(data.site);
      setOrigins((data.site.chat.origins || []).join("\n"));
      (data.notes || []).forEach(n => toast.info(n));
      if (andPublish) {
        const pub = await api.post("/site/publish");
        setState({ ...state, ...pub.data });
        toast.success("Site publicado: os visitantes já veem a versão nova.");
      } else {
        toast.success("Rascunho salvo. Clique em Publicar para o visitante ver.");
      }
    } catch (e) {
      toastError(e);
    }
    setBusy(false);
  };

  const discard = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/site/discard");
      setState({ ...state, ...data });
      setSite(data.site);
      setOrigins((data.site.chat.origins || []).join("\n"));
      toast.success("Rascunho descartado.");
    } catch (e) {
      toastError(e);
    }
    setBusy(false);
  };

  return (
    <MainContainer>
      <MainHeader>
        <Title>Site e chat</Title>
        <MainHeaderButtonsWrapper>
          <Chip
            size="small"
            label={state.published ? `Publicado em ${when(state.publishedAt)}` : "Alterações não publicadas"}
            color={state.published ? "default" : "secondary"}
            style={{ marginRight: 8 }}
          />
          {isAdmin && (
            <>
              <Button size="small" disabled={busy} onClick={discard}>
                Descartar
              </Button>
              <Button size="small" disabled={busy} onClick={() => save(false)}>
                Salvar rascunho
              </Button>
              <Button size="small" variant="contained" color="primary" disabled={busy} onClick={() => save(true)}>
                Salvar e publicar
              </Button>
            </>
          )}
        </MainHeaderButtonsWrapper>
      </MainHeader>
      <Paper className={classes.paper} variant="outlined">
        <Tabs
          value={tab}
          onChange={(e, v) => setTab(v)}
          indicatorColor="primary"
          textColor="primary"
          variant="scrollable"
          scrollButtons="auto"
          style={{ marginBottom: 16 }}
        >
          <Tab label="Aparência" />
          <Tab label="Contato" />
          <Tab label="Chat" />
          <Tab label="Textos" />
          <Tab label="Funil" />
          <Tab label="Contatos recebidos" />
          <Tab label="Instalação" />
        </Tabs>

        {tab === 0 && (
          <div className={classes.block}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  size="small"
                  variant="outlined"
                  label="Nome da empresa"
                  value={site.brand.name}
                  onChange={e => part("brand", { name: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  size="small"
                  variant="outlined"
                  label="Nome do assistente no chat"
                  value={site.brand.agentName}
                  onChange={e => part("brand", { agentName: e.target.value })}
                />
              </Grid>
              <Grid item xs={6} sm={3}>
                <TextField
                  fullWidth
                  size="small"
                  variant="outlined"
                  type="color"
                  label="Cor da marca"
                  value={site.brand.color}
                  onChange={e => part("brand", { color: e.target.value })}
                />
              </Grid>
              <Grid item xs={6} sm={3}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  variant="outlined"
                  label="Lado do botão"
                  value={site.brand.position}
                  onChange={e => part("brand", { position: e.target.value })}
                >
                  <MenuItem value="right">Direita</MenuItem>
                  <MenuItem value="left">Esquerda</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  size="small"
                  variant="outlined"
                  label="Endereço do logotipo (https)"
                  value={site.brand.logoUrl}
                  onChange={e => part("brand", { logoUrl: e.target.value })}
                />
              </Grid>
            </Grid>
            <p className={classes.hint}>
              Se a cor escolhida deixar o texto branco ilegível, ela é escurecida ao salvar, mantendo o mesmo tom.
            </p>
            <Divider style={{ margin: "16px 0" }} />
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  size="small"
                  variant="outlined"
                  label="Título da página (busca)"
                  value={site.seo.title}
                  onChange={e => part("seo", { title: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  size="small"
                  variant="outlined"
                  label="Descrição da página (busca)"
                  value={site.seo.description}
                  onChange={e => part("seo", { description: e.target.value })}
                />
              </Grid>
            </Grid>
          </div>
        )}

        {tab === 1 && (
          <div className={classes.block}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  size="small"
                  variant="outlined"
                  label="WhatsApp (com DDD)"
                  value={site.contact.whatsapp}
                  onChange={e => part("contact", { whatsapp: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  size="small"
                  variant="outlined"
                  label="E-mail"
                  value={site.contact.email}
                  onChange={e => part("contact", { email: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  size="small"
                  variant="outlined"
                  label="Telefone"
                  value={site.contact.phone}
                  onChange={e => part("contact", { phone: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  size="small"
                  variant="outlined"
                  label="Termos de uso (https)"
                  value={site.contact.termsUrl}
                  onChange={e => part("contact", { termsUrl: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  size="small"
                  variant="outlined"
                  label="Política de privacidade (https)"
                  value={site.contact.privacyUrl}
                  onChange={e => part("contact", { privacyUrl: e.target.value })}
                />
              </Grid>
            </Grid>
            <p className={classes.hint}>O WhatsApp aparece no chat quando o visitante precisa falar com uma pessoa.</p>
          </div>
        )}

        {tab === 2 && (
          <div className={classes.block}>
            <FormControlLabel
              control={<Switch color="primary" checked={site.chat.enabled} onChange={e => part("chat", { enabled: e.target.checked })} />}
              label="Chat ligado no site"
            />
            <Grid container spacing={2} style={{ marginTop: 8 }}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  multiline
                  minRows={3}
                  size="small"
                  variant="outlined"
                  label="Sites permitidos (um por linha)"
                  placeholder="https://salustech.com.br"
                  value={origins}
                  onChange={e => setOrigins(e.target.value)}
                />
                <p className={classes.hint}>
                  Só esses endereços podem abrir o chat. Deixando vazio, qualquer site com a tag funciona.
                </p>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  size="small"
                  variant="outlined"
                  type="number"
                  label="Limite de perguntas por dia"
                  value={site.chat.dailyLimit === null ? "" : site.chat.dailyLimit}
                  onChange={e => part("chat", { dailyLimit: e.target.value === "" ? null : e.target.value })}
                />
                <p className={classes.hint}>Vazio = sem limite. Serve para o gasto do agente não fugir do controle.</p>
              </Grid>
            </Grid>
            <Divider style={{ margin: "16px 0" }} />
            <Typography variant="subtitle2">Horário da equipe</Typography>
            <p className={classes.hint}>
              Fora do horário o chat continua respondendo; ele apenas avisa quando a equipe volta e pede o contato.
            </p>
            <TextField
              select
              size="small"
              variant="outlined"
              style={{ width: 220, marginTop: 8 }}
              label="Equipe disponível"
              value={site.chat.schedule.mode}
              onChange={e => schedule({ mode: e.target.value })}
            >
              <MenuItem value="always">A qualquer hora</MenuItem>
              <MenuItem value="hours">Em dias e horários</MenuItem>
            </TextField>
            {site.chat.schedule.mode === "hours" && (
              <Grid container spacing={2} style={{ marginTop: 8 }}>
                <Grid item xs={6} sm={3}>
                  <TextField
                    fullWidth
                    size="small"
                    variant="outlined"
                    type="time"
                    label="Abre"
                    value={site.chat.schedule.start}
                    onChange={e => schedule({ start: e.target.value })}
                  />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <TextField
                    fullWidth
                    size="small"
                    variant="outlined"
                    type="time"
                    label="Fecha"
                    value={site.chat.schedule.end}
                    onChange={e => schedule({ end: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  {DAYS.map(([n, label]) => (
                    <Chip
                      key={n}
                      size="small"
                      label={label}
                      style={{ marginRight: 6, marginTop: 6 }}
                      color={site.chat.schedule.days.indexOf(n) >= 0 ? "primary" : "default"}
                      onClick={() =>
                        schedule({
                          days:
                            site.chat.schedule.days.indexOf(n) >= 0
                              ? site.chat.schedule.days.filter(d => d !== n)
                              : [...site.chat.schedule.days, n]
                        })
                      }
                    />
                  ))}
                </Grid>
              </Grid>
            )}
          </div>
        )}

        {tab === 3 && (
          <div className={classes.block}>
            <p className={classes.hint}>
              Todo texto já vem escrito. Mude só o que quiser; deixando vazio, volta ao padrão. <code>{"{nome}"}</code> é o nome do
              assistente e <code>{"{horario}"}</code> é o horário da equipe.
            </p>
            {Object.entries(
              texts.reduce((acc, t) => {
                acc[t.group] = acc[t.group] || [];
                acc[t.group].push(t);
                return acc;
              }, {})
            ).map(([group, list]) => (
              <div key={group}>
                <Typography className={classes.group}>{group}</Typography>
                {list.map(t => (
                  <TextField
                    key={t.key}
                    fullWidth
                    size="small"
                    variant="outlined"
                    margin="dense"
                    label={t.label}
                    placeholder={t.def}
                    inputProps={{ maxLength: t.max || 200 }}
                    value={site.texts[t.key] || ""}
                    onChange={e => setSite({ ...site, texts: { ...site.texts, [t.key]: e.target.value } })}
                  />
                ))}
              </div>
            ))}
          </div>
        )}

        {tab === 4 && <Funnel classes={classes} />}
        {tab === 5 && <Leads classes={classes} />}
        {tab === 6 && <Install classes={classes} state={state} isAdmin={isAdmin} onToken={t => setState({ ...state, token: t })} />}
      </Paper>
    </MainContainer>
  );
};

const Funnel = ({ classes }) => {
  const [days, setDays] = useState(30);
  const [f, setF] = useState(null);
  useEffect(() => {
    api
      .get(`/site/funnel?days=${days}`)
      .then(r => setF(r.data))
      .catch(toastError);
  }, [days]);
  if (!f) return <LinearProgress />;
  const top = Math.max(1, ...f.steps.map(s => s.n));
  return (
    <div>
      <TextField select size="small" variant="outlined" label="Período" value={days} onChange={e => setDays(e.target.value)} style={{ width: 180 }}>
        <MenuItem value={7}>7 dias</MenuItem>
        <MenuItem value={30}>30 dias</MenuItem>
        <MenuItem value={90}>90 dias</MenuItem>
      </TextField>
      <p className={classes.hint}>Cada etapa conta visitantes diferentes, não mensagens.</p>
      {f.steps.map(s => (
        <div key={s.id} style={{ marginTop: 12 }}>
          <Typography variant="body2">
            <b>{s.n}</b> · {s.label}
          </Typography>
          <LinearProgress variant="determinate" value={(s.n / top) * 100} className={classes.bar} />
        </div>
      ))}
      <Typography className={classes.group}>O que mais levou a chamar uma pessoa</Typography>
      {f.handoffQuestions.length === 0 && <Typography variant="body2">Nada registrado no período.</Typography>}
      <Table size="small">
        <TableBody>
          {f.handoffQuestions.map(h => (
            <TableRow key={h.q}>
              <TableCell>{h.q}</TableCell>
              <TableCell style={{ width: 80 }}>{h.n}×</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

const Leads = ({ classes }) => {
  const [rows, setRows] = useState(null);
  const load = useCallback(() => {
    api
      .get("/site/leads")
      .then(r => setRows(r.data))
      .catch(toastError);
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  if (!rows) return <LinearProgress />;
  const mark = async (id, status) => {
    try {
      await api.post(`/site/leads/${id}/status`, { status });
      load();
    } catch (e) {
      toastError(e);
    }
  };
  return (
    <div>
      <p className={classes.hint}>Quem pediu retorno no chat do site. Marque como atendido depois de falar com a pessoa.</p>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Quando</TableCell>
            <TableCell>Nome</TableCell>
            <TableCell>Contato</TableCell>
            <TableCell>Dúvida</TableCell>
            <TableCell>Situação</TableCell>
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map(r => (
            <TableRow key={r.id}>
              <TableCell>{when(r.at)}</TableCell>
              <TableCell>{r.name}</TableCell>
              <TableCell>{r.contact}</TableCell>
              <TableCell style={{ maxWidth: 320 }}>{r.question}</TableCell>
              <TableCell>
                <Chip size="small" label={{ new: "Novo", done: "Atendido", discarded: "Descartado" }[r.status] || r.status} />
              </TableCell>
              <TableCell>
                {r.status !== "done" && (
                  <Button size="small" onClick={() => mark(r.id, "done")}>
                    Atendido
                  </Button>
                )}
                {r.status === "new" && (
                  <Tooltip title="Descartar">
                    <IconButton size="small" onClick={() => mark(r.id, "discarded")}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {rows.length === 0 && <Typography style={{ marginTop: 12 }}>Nenhum contato recebido ainda.</Typography>}
    </div>
  );
};

const Install = ({ classes, state, isAdmin, onToken }) => {
  const base = state.base || window.location.origin.replace("app.", "api.");
  const tag = `<script src="${base}/site/${state.token}/widget.js" async></script>`;
  const copy = () => {
    try {
      navigator.clipboard.writeText(tag);
      toast.success("Tag copiada.");
    } catch (e) {
      toast.info("Copie a tag manualmente.");
    }
  };
  const rotate = async () => {
    try {
      const { data } = await api.post("/site/token");
      onToken(data.token);
      toast.success("Token novo gerado: troque a tag no site.");
    } catch (e) {
      toastError(e);
    }
  };
  return (
    <div>
      <Typography variant="subtitle2">Cole esta tag antes do &lt;/body&gt; do seu site</Typography>
      <div className={classes.snippet} style={{ marginTop: 8 }}>
        {tag}
      </div>
      <div style={{ marginTop: 8 }}>
        <Button size="small" startIcon={<FileCopy />} onClick={copy}>
          Copiar
        </Button>
        {isAdmin && (
          <Button size="small" onClick={rotate}>
            Gerar token novo
          </Button>
        )}
      </div>
      <p className={classes.hint}>
        O chat é carregado em área isolada, então não briga com o CSS do site. Gerar um token novo derruba a tag antiga na hora.
      </p>
      {!state.base && (
        <p className={classes.hint}>
          Defina <code>BACKEND_URL</code> no servidor para a tag sair com o endereço certo.
        </p>
      )}
    </div>
  );
};

export default Site;
