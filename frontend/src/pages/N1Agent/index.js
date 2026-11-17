import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Switch,
  TextField,
  Typography
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { toast } from "react-toastify";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";
import ForbiddenPage from "../../components/ForbiddenPage";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";

/**
 * Agente N1 (Claude): responde o começo da conversa usando a Base de conhecimento do Portal da Equipe
 * e passa para a fila do N2 com um resumo quando não resolve.
 */

const MODEL_LABELS = {
  "claude-opus-5-5": "Claude Opus 5.5 (mais capaz)",
  "claude-sonnet-5-5": "Claude Sonnet 5.5 (mais rápido)",
  "claude-haiku-5-5": "Claude Haiku 5.5 (mais econômico)"
};
const EFFORT_LABELS = { low: "Baixo (respostas mais rápidas)", medium: "Médio (recomendado)", high: "Alto (pensa mais antes de responder)" };

const EMPTY = {
  enabled: false,
  name: "Assistente",
  whatsappIds: [],
  handoffQueueId: "",
  instructions: "",
  apiKey: "",
  model: "claude-opus-5-5",
  effort: "medium",
  maxTurns: 8,
  portalUrl: "",
  portalKey: ""
};

const useStyles = makeStyles(theme => ({
  page: { flex: 1, overflowY: "auto", padding: theme.spacing(1), ...theme.scrollbarStyles },
  section: { padding: theme.spacing(2.5), marginBottom: theme.spacing(2) },
  sectionTitle: { fontWeight: 700, fontSize: 15, marginBottom: theme.spacing(0.5) },
  help: { color: theme.palette.text.secondary, fontSize: 13, marginBottom: theme.spacing(2), lineHeight: 1.5 },
  status: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: theme.spacing(2), flexWrap: "wrap" },
  connections: { display: "flex", flexWrap: "wrap", gap: theme.spacing(0.5, 2) },
  flow: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 12, color: theme.palette.text.secondary, marginTop: theme.spacing(1) },
  chat: { display: "flex", flexDirection: "column", gap: theme.spacing(1), minHeight: 220, maxHeight: 420, overflowY: "auto", padding: theme.spacing(1.5), borderRadius: 8, background: theme.palette.type === "dark" ? "#1f2229" : "#f6f7fb", marginBottom: theme.spacing(1.5) },
  bubble: { maxWidth: "80%", padding: "8px 12px", borderRadius: 12, fontSize: 13, lineHeight: 1.45, whiteSpace: "pre-wrap" },
  customer: { alignSelf: "flex-start", background: theme.palette.type === "dark" ? "#2c313b" : "#ffffff", border: `1px solid ${theme.palette.divider}` },
  agent: { alignSelf: "flex-end", background: theme.palette.primary.main, color: "#fff" },
  log: { alignSelf: "stretch", padding: "8px 12px", borderRadius: 8, fontSize: 12, whiteSpace: "pre-wrap", background: theme.palette.type === "dark" ? "#3a3420" : "#fff7dc", color: theme.palette.type === "dark" ? "#f5e3a3" : "#5f4b10", border: "1px dashed #e8cc69" },
  composer: { display: "flex", gap: theme.spacing(1) }
}));

export default function N1Agent() {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const [form, setForm] = useState(EMPTY);
  const [options, setOptions] = useState({ whatsapps: [], queues: [], models: Object.keys(MODEL_LABELS), efforts: Object.keys(EFFORT_LABELS) });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checkingPortal, setCheckingPortal] = useState(false);
  const [chat, setChat] = useState([]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const chatEnd = useRef(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/n1-agent");
      setOptions(current => ({ ...current, ...data.options }));
      if (data.agent) {
        setForm({
          ...EMPTY,
          ...data.agent,
          handoffQueueId: data.agent.handoffQueueId || "",
          portalUrl: data.agent.portalUrl || "",
          whatsappIds: Array.isArray(data.agent.whatsappIds) ? data.agent.whatsappIds : []
        });
      }
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user.profile === "admin") load();
  }, [load, user.profile]);

  useEffect(() => {
    if (chatEnd.current) chatEnd.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [chat, thinking]);

  if (user.profile !== "admin") return <MainContainer><ForbiddenPage /></MainContainer>;

  const set = (field, value) => setForm(current => ({ ...current, [field]: value }));
  const toggleConnection = id => set("whatsappIds", form.whatsappIds.includes(id) ? form.whatsappIds.filter(value => value !== id) : [...form.whatsappIds, id]);

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.put("/n1-agent", { ...form, handoffQueueId: form.handoffQueueId || null });
      setForm(current => ({ ...current, ...data.agent, handoffQueueId: data.agent.handoffQueueId || "", portalUrl: data.agent.portalUrl || "" }));
      toast.success(data.agent.enabled ? "Agente N1 salvo e ligado." : "Agente N1 salvo (desligado).");
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  const testPortal = async () => {
    setCheckingPortal(true);
    try {
      const { data } = await api.post("/n1-agent/test-portal", { query: "acesso" });
      toast.success(`Portal conectado. A busca de teste achou ${data.articles.length} ${data.articles.length === 1 ? "artigo" : "artigos"}.`);
    } catch (err) {
      toastError(err);
    } finally {
      setCheckingPortal(false);
    }
  };

  const sendTest = async event => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || thinking) return;
    const lines = [...chat.filter(line => line.kind !== "log"), { kind: "customer", text }];
    setChat(current => [...current, { kind: "customer", text }]);
    setDraft("");
    setThinking(true);
    try {
      const { data } = await api.post("/n1-agent/simulate", {
        messages: lines.map(line => ({ fromCustomer: line.kind === "customer", text: line.text }))
      });
      const next = [];
      if (data.reply) next.push({ kind: "agent", text: data.reply });
      const log = [...(data.log || [])];
      if (data.handoff) log.push(`Passaria para a equipe: ${data.handoff.reason}${data.handoff.summary ? `\nResumo: ${data.handoff.summary}` : ""}`);
      if (data.usage) log.push(`Modelo: ${data.servedBy} · tokens ${data.usage.input}+${data.usage.output}`);
      if (log.length) next.push({ kind: "log", text: log.join("\n") });
      setChat(current => [...current, ...next]);
    } catch (err) {
      toastError(err);
    } finally {
      setThinking(false);
    }
  };

  const queueName = options.queues.find(queue => queue.id === Number(form.handoffQueueId))?.name;

  return (
    <MainContainer>
      <MainHeader>
        <Title>Agente N1</Title>
        <MainHeaderButtonsWrapper>
          <Button variant="contained" color="primary" onClick={save} disabled={saving || loading}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </MainHeaderButtonsWrapper>
      </MainHeader>

      {loading ? <CircularProgress /> : (
        <div className={classes.page}>
          <Paper className={classes.section} variant="outlined">
            <div className={classes.status}>
              <div>
                <Typography className={classes.sectionTitle}>Primeiro atendimento automático</Typography>
                <Typography className={classes.help} component="div" style={{ marginBottom: 0 }}>
                  O N1 responde dúvidas com base nos artigos do Portal da Equipe. Quando não sabe, ou o cliente pede uma pessoa, ele passa a conversa para a equipe com um resumo. Tudo o que ele faz aparece como nota privada na conversa.
                  <div className={classes.flow}><Chip size="small" label="Cliente" /> → <Chip size="small" color="primary" label={form.name || "N1"} /> → <Chip size="small" label={queueName ? `Fila ${queueName}` : "Equipe (N2)"} /></div>
                </Typography>
              </div>
              <FormControlLabel control={<Switch checked={form.enabled} onChange={event => set("enabled", event.target.checked)} color="primary" />} label={form.enabled ? "Ligado" : "Desligado"} />
            </div>
          </Paper>

          <Grid container spacing={2}>
            <Grid item xs={12} md={7}>
              <Paper className={classes.section} variant="outlined">
                <Typography className={classes.sectionTitle}>Onde e para quem</Typography>
                <Typography className={classes.help}>Conexões em que o N1 atende e fila que recebe a conversa quando ele transfere.</Typography>
                <div className={classes.connections}>
                  {options.whatsapps.length === 0 && <Typography className={classes.help}>Nenhuma conexão cadastrada.</Typography>}
                  {options.whatsapps.map(whatsapp => (
                    <FormControlLabel key={whatsapp.id}
                      control={<Checkbox checked={form.whatsappIds.includes(whatsapp.id)} onChange={() => toggleConnection(whatsapp.id)} color="primary" />}
                      label={`${whatsapp.name}${whatsapp.channel === "whatsapp_oficial" ? " (oficial)" : ""}`} />
                  ))}
                </div>
                <FormControl variant="outlined" margin="dense" fullWidth style={{ marginTop: 12 }}>
                  <InputLabel>Fila do N2 (para onde transfere)</InputLabel>
                  <Select value={form.handoffQueueId} onChange={event => set("handoffQueueId", event.target.value)} label="Fila do N2 (para onde transfere)">
                    <MenuItem value="">Sem fila (fica aguardando)</MenuItem>
                    {options.queues.map(queue => <MenuItem key={queue.id} value={queue.id}>{queue.name}</MenuItem>)}
                  </Select>
                </FormControl>
                <TextField label="Responder no máximo (mensagens do cliente)" type="number" variant="outlined" margin="dense" fullWidth
                  value={form.maxTurns} onChange={event => set("maxTurns", event.target.value)} inputProps={{ min: 1, max: 30 }}
                  helperText="Depois disso o N1 passa para a equipe, mesmo que a conversa continue." />
              </Paper>

              <Paper className={classes.section} variant="outlined">
                <Typography className={classes.sectionTitle}>Como ele fala</Typography>
                <TextField label="Nome do assistente" variant="outlined" margin="dense" fullWidth value={form.name} onChange={event => set("name", event.target.value)} inputProps={{ maxLength: 40 }} />
                <TextField label="Sobre a empresa e como atender" variant="outlined" margin="dense" fullWidth multiline minRows={6}
                  value={form.instructions} onChange={event => set("instructions", event.target.value)} inputProps={{ maxLength: 8000 }}
                  placeholder={"Ex.: Somos a Loja Aurora, vendemos materiais de escritório.\nHorário da equipe: seg a sex, 8h às 18h.\nNunca prometa prazo de entrega sem consultar a equipe."}
                  helperText="Vai junto das regras fixas (responder só com o que está na base, não pedir senha, transferir quando não souber)." />
              </Paper>
            </Grid>

            <Grid item xs={12} md={5}>
              <Paper className={classes.section} variant="outlined">
                <Typography className={classes.sectionTitle}>Claude (Anthropic)</Typography>
                <TextField label="Chave da API da Anthropic" variant="outlined" margin="dense" fullWidth type="password" autoComplete="off"
                  value={form.apiKey || ""} onChange={event => set("apiKey", event.target.value)}
                  helperText="Fica criptografada. Depois de salva, aparece só o final." />
                <FormControl variant="outlined" margin="dense" fullWidth>
                  <InputLabel>Modelo</InputLabel>
                  <Select value={form.model} onChange={event => set("model", event.target.value)} label="Modelo">
                    {options.models.map(model => <MenuItem key={model} value={model}>{MODEL_LABELS[model] || model}</MenuItem>)}
                  </Select>
                </FormControl>
                <FormControl variant="outlined" margin="dense" fullWidth>
                  <InputLabel>Esforço</InputLabel>
                  <Select value={form.effort} onChange={event => set("effort", event.target.value)} label="Esforço">
                    {options.efforts.map(effort => <MenuItem key={effort} value={effort}>{EFFORT_LABELS[effort] || effort}</MenuItem>)}
                  </Select>
                </FormControl>
              </Paper>

              <Paper className={classes.section} variant="outlined">
                <Typography className={classes.sectionTitle}>Portal da Equipe</Typography>
                <Typography className={classes.help}>Crie a chave no Portal em Administração → Agente N1 do AtendeChat. O N1 só lê os artigos com a etiqueta escolhida lá.</Typography>
                <TextField label="Endereço do Portal" variant="outlined" margin="dense" fullWidth value={form.portalUrl} onChange={event => set("portalUrl", event.target.value)} placeholder="https://portal.suaempresa.com" />
                <TextField label="Chave do Portal" variant="outlined" margin="dense" fullWidth type="password" autoComplete="off"
                  value={form.portalKey || ""} onChange={event => set("portalKey", event.target.value)} helperText="Começa com pk_ac_. Fica criptografada." />
                <Button variant="outlined" onClick={testPortal} disabled={checkingPortal} style={{ marginTop: 8 }}>
                  {checkingPortal ? "Testando…" : "Testar conexão com o Portal"}
                </Button>
              </Paper>

              <Paper className={classes.section} variant="outlined">
                <Typography className={classes.sectionTitle}>Testar conversa</Typography>
                <Typography className={classes.help}>Converse como se fosse o cliente. Usa o Claude e a base de verdade (gasta créditos da Anthropic), mas não manda nada a clientes nem abre chamado. Salve antes de testar.</Typography>
                <div className={classes.chat}>
                  {chat.length === 0 && <Typography className={classes.help}>Ex.: "Como emito a segunda via do boleto?"</Typography>}
                  {chat.map((line, index) => (
                    <div key={index} className={`${line.kind === "log" ? classes.log : `${classes.bubble} ${line.kind === "customer" ? classes.customer : classes.agent}`}`}>{line.text}</div>
                  ))}
                  {thinking && <CircularProgress size={18} />}
                  <div ref={chatEnd} />
                </div>
                <form className={classes.composer} onSubmit={sendTest}>
                  <TextField variant="outlined" size="small" fullWidth placeholder="Mensagem do cliente" value={draft} onChange={event => setDraft(event.target.value)} disabled={thinking} />
                  <Button type="submit" variant="contained" color="primary" disabled={thinking || !draft.trim()}>Enviar</Button>
                  <Button onClick={() => setChat([])} disabled={thinking || !chat.length}>Limpar</Button>
                </form>
              </Paper>
            </Grid>
          </Grid>
        </div>
      )}
    </MainContainer>
  );
}
