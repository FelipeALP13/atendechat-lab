import React, { useCallback, useContext, useEffect, useState } from "react";
import {
  Button,
  Chip,
  FormControlLabel,
  Grid,
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
  Typography
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { toast } from "react-toastify";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import toastError from "../../errors/toastError";
import api from "../../services/api";
import { AuthContext } from "../../context/Auth/AuthContext";

const useStyles = makeStyles(theme => ({
  paper: { flex: 1, padding: theme.spacing(2), overflowY: "auto", ...theme.scrollbarStyles },
  block: { marginBottom: theme.spacing(3) },
  hint: { color: theme.palette.text.secondary, fontSize: 13 }
}));

const RULES = [
  ["asks_human", "Cliente pede uma pessoa"],
  ["repetition", "Cliente repete a pergunta sem resolver"],
  ["billing_complaint", "Reclamação de cobrança"],
  ["angry", "Cliente irritado"],
  ["outage", "Possível indisponibilidade do sistema"]
];
const DECISIONS = { answer: "Respondeu", draft: "Rascunho", handoff: "Transferiu", refuse: "Recusou", truth: "Disse que é IA" };
const when = t => (t ? new Date(Number(t)).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");

const Config = () => {
  const classes = useStyles();
  const [cfg, setCfg] = useState(null);
  const [stats, setStats] = useState(null);
  const [queues, setQueues] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/n1/config");
      setCfg(data.config);
      setStats(data.stats);
      const q = await api.get("/queue");
      setQueues(q.data || []);
    } catch (e) { toastError(e); }
  }, []);
  useEffect(() => { load(); }, [load]);
  if (!cfg) return <LinearProgress />;
  const set = (k, v) => setCfg({ ...cfg, [k]: v });

  const save = async () => {
    setBusy(true);
    try {
      const { data } = await api.put("/n1/config", { ...cfg, answerAt: Number(cfg.answerAt), draftAt: Number(cfg.draftAt), monthlyCap: Number(cfg.monthlyCap), fx: Number(cfg.fx) });
      setCfg(data.config);
      toast.success("Configuração salva.");
    } catch (e) { toastError(e); }
    setBusy(false);
  };
  const sync = async () => {
    setBusy(true);
    try {
      await api.put("/n1/config", { gitbookUrl: cfg.gitbookUrl });
      const { data } = await api.post("/n1/sync");
      setStats(data.stats);
      const r = data.result;
      toast.success(`Documentação sincronizada: ${r.added} novas, ${r.changed} alteradas, ${r.same} iguais, ${r.removed} removidas${r.failed.length ? `, ${r.failed.length} com falha` : ""}.`);
    } catch (e) { toastError(e); }
    setBusy(false);
  };

  return (
    <div>
      <div className={classes.block}>
        <Typography variant="subtitle1"><b>Agente</b></Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}><TextField fullWidth variant="outlined" size="small" label="Nome do agente" value={cfg.name} onChange={e => set("name", e.target.value)} /></Grid>
          <Grid item xs={12} sm={6}><TextField fullWidth variant="outlined" size="small" label="Produto sobre o qual ele responde" value={cfg.product} onChange={e => set("product", e.target.value)} /></Grid>
          <Grid item xs={12}><FormControlLabel control={<Switch color="primary" checked={cfg.introduceAsAssistant} onChange={e => set("introduceAsAssistant", e.target.checked)} />} label="Se apresentar como assistente virtual na primeira mensagem" /></Grid>
        </Grid>
        <p className={classes.hint}>O agente nunca nega ser uma IA quando alguém pergunta de verdade. Ative-o em cada conexão (Conexões → editar → Agente N1).</p>
      </div>

      <div className={classes.block}>
        <Typography variant="subtitle1"><b>Documentação (GitBook)</b></Typography>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={8}><TextField fullWidth variant="outlined" size="small" label="Endereço do GitBook (https)" placeholder="https://empresa.gitbook.io/documentacao" value={cfg.gitbookUrl} onChange={e => set("gitbookUrl", e.target.value)} /></Grid>
          <Grid item xs={12} sm={4}><Button variant="contained" color="primary" disabled={busy || !cfg.gitbookUrl} onClick={sync}>Sincronizar agora</Button></Grid>
        </Grid>
        <p className={classes.hint}>{stats ? `${stats.pages} páginas indexadas · ${stats.approved} respostas aprovadas · última sincronização: ${when(stats.lastSyncAt)}.` : ""} Só o que mudou é reindexado.</p>
      </div>

      <div className={classes.block}>
        <Typography variant="subtitle1"><b>Quando responder e quando transferir</b></Typography>
        <Grid container spacing={2}>
          <Grid item xs={6} sm={3}><TextField fullWidth variant="outlined" size="small" type="number" label="Responder sozinho a partir de (%)" value={cfg.answerAt} onChange={e => set("answerAt", e.target.value)} /></Grid>
          <Grid item xs={6} sm={3}><TextField fullWidth variant="outlined" size="small" type="number" label="Sugerir rascunho a partir de (%)" value={cfg.draftAt} onChange={e => set("draftAt", e.target.value)} /></Grid>
        </Grid>
        <p className={classes.hint}>Acima do primeiro limite o agente responde ao cliente; entre os dois, ele só prepara um rascunho para a equipe; abaixo, transfere.</p>
        {RULES.map(([k, label]) => (
          <div key={k}><FormControlLabel control={<Switch color="primary" checked={cfg.handoffRules[k] !== false} onChange={e => set("handoffRules", { ...cfg.handoffRules, [k]: e.target.checked })} />} label={`Transferir: ${label}`} /></div>
        ))}
        <TextField select fullWidth style={{ maxWidth: 360, marginTop: 8 }} variant="outlined" size="small" label="Fila do N2 (padrão)" value={cfg.queues.default || ""} onChange={e => set("queues", { ...cfg.queues, default: e.target.value || null })}>
          <MenuItem value="">Primeira fila da conexão</MenuItem>
          {queues.map(q => <MenuItem key={q.id} value={q.id}>{q.name}</MenuItem>)}
        </TextField>
      </div>

      <div className={classes.block}>
        <Typography variant="subtitle1"><b>Limite de gasto</b></Typography>
        <Grid container spacing={2}>
          <Grid item xs={6} sm={3}><TextField fullWidth variant="outlined" size="small" type="number" label="Limite mensal (R$)" value={cfg.monthlyCap} onChange={e => set("monthlyCap", e.target.value)} /></Grid>
          <Grid item xs={6} sm={3}><TextField fullWidth variant="outlined" size="small" type="number" label="Cotação do dólar (R$)" value={cfg.fx} onChange={e => set("fx", e.target.value)} /></Grid>
        </Grid>
        <p className={classes.hint}>O modelo cobra em dólar; aqui o limite é em reais. Ao atingir, o agente passa tudo para a equipe.</p>
      </div>
      <Button variant="contained" color="primary" disabled={busy} onClick={save}>Salvar</Button>
    </div>
  );
};

const Gaps = ({ isAdmin }) => {
  const classes = useStyles();
  const [rows, setRows] = useState([]);
  const [texts, setTexts] = useState({});
  const load = useCallback(async () => {
    try { setRows((await api.get("/n1/proposals?status=pending")).data); } catch (e) { toastError(e); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const act = async (fn, ok) => { try { await fn(); toast.success(ok); load(); } catch (e) { toastError(e); } };
  return (
    <div>
      <p className={classes.hint}>Perguntas que o agente não soube responder, das mais repetidas para as menos. A equipe (N2) escreve a resposta certa; um administrador aprova, e só então ela entra na base. Dados pessoais são removidos antes.</p>
      {rows.length === 0 && <Typography>Nenhuma lacuna pendente.</Typography>}
      {rows.map(r => {
        const origins = r.origins ? Object.entries(JSON.parse(r.origins)).map(([k, v]) => `${k}: ${v}`).join(" · ") : "";
        return (
          <Paper key={r.id} variant="outlined" style={{ padding: 12, marginBottom: 12 }}>
            <Typography><b>{r.question}</b></Typography>
            <Typography className={classes.hint}>Perguntada {r.times}× {origins && `(${origins})`} · última vez {when(r.lastAt)}</Typography>
            {r.answer && <Typography style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>Resposta do N2 ({r.answeredBy}): {r.answer}</Typography>}
            <TextField fullWidth multiline minRows={2} variant="outlined" size="small" style={{ marginTop: 8 }} placeholder={r.answer ? "Corrigir a resposta…" : "Escreva a resposta correta…"} value={texts[r.id] || ""} onChange={e => setTexts({ ...texts, [r.id]: e.target.value })} />
            <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button size="small" variant="outlined" disabled={!(texts[r.id] || "").trim()} onClick={() => act(() => api.post("/n1/proposals/answer", { question: r.question, answer: texts[r.id] }), "Resposta registrada.")}>Registrar resposta</Button>
              {isAdmin && <Button size="small" variant="contained" color="primary" disabled={!r.answer && !(texts[r.id] || "").trim()} onClick={() => act(() => api.post(`/n1/proposals/${r.id}/approve`, { answer: (texts[r.id] || "").trim() || undefined }), "Aprovada: o agente já pode usar.")}>Aprovar e publicar</Button>}
              {isAdmin && <Button size="small" onClick={() => act(() => api.post(`/n1/proposals/${r.id}/reject`), "Descartada.")}>Descartar</Button>}
            </div>
          </Paper>
        );
      })}
    </div>
  );
};

const Approved = ({ isAdmin }) => {
  const classes = useStyles();
  const [rows, setRows] = useState([]);
  const load = useCallback(async () => { try { setRows((await api.get("/n1/approved")).data); } catch (e) { toastError(e); } }, []);
  useEffect(() => { load(); }, [load]);
  return (
    <div>
      <p className={classes.hint}>Respostas que a equipe ensinou ao agente. Se a página da documentação em que se apoiam mudar, elas voltam para revisão.</p>
      <Table size="small">
        <TableHead><TableRow><TableCell>Pergunta</TableCell><TableCell>Resposta</TableCell><TableCell>Aprovada por</TableCell><TableCell>Situação</TableCell><TableCell /></TableRow></TableHead>
        <TableBody>{rows.map(r => (
          <TableRow key={r.id}><TableCell>{r.question}</TableCell><TableCell style={{ maxWidth: 360, whiteSpace: "pre-wrap" }}>{r.body}</TableCell><TableCell>{r.approvedBy} · {when(r.approvedAt)}</TableCell>
            <TableCell><Chip size="small" label={{ active: "Ativa", review: "Em revisão", revoked: "Revogada" }[r.status] || r.status} /></TableCell>
            <TableCell>{isAdmin && r.status !== "revoked" && <Button size="small" onClick={async () => { try { await api.post(`/n1/approved/${r.id}/revoke`); load(); } catch (e) { toastError(e); } }}>Revogar</Button>}</TableCell></TableRow>))}</TableBody>
      </Table>
      {rows.length === 0 && <Typography style={{ marginTop: 12 }}>Nenhuma resposta aprovada ainda.</Typography>}
    </div>
  );
};

const Audit = () => {
  const classes = useStyles();
  const [rows, setRows] = useState([]);
  useEffect(() => { api.get("/n1/audit").then(r => setRows(r.data)).catch(toastError); }, []);
  return (
    <div>
      <p className={classes.hint}>As últimas 200 decisões do agente, com a confiança e as páginas consultadas.</p>
      <Table size="small">
        <TableHead><TableRow><TableCell>Quando</TableCell><TableCell>Pergunta</TableCell><TableCell>Decisão</TableCell><TableCell>Confiança</TableCell><TableCell>Fontes</TableCell></TableRow></TableHead>
        <TableBody>{rows.map(r => (
          <TableRow key={r.id}><TableCell>{when(r.at)}</TableCell><TableCell style={{ maxWidth: 320 }}>{r.question}</TableCell><TableCell>{DECISIONS[r.decision] || r.decision}</TableCell><TableCell>{r.confidence != null ? `${r.confidence}%` : "—"}</TableCell><TableCell style={{ maxWidth: 260 }}>{(() => { try { return JSON.parse(r.sources || "[]").join(", "); } catch (e) { return ""; } })()}</TableCell></TableRow>))}</TableBody>
      </Table>
    </div>
  );
};

const Usage = () => {
  const [u, setU] = useState(null);
  useEffect(() => { api.get("/n1/usage").then(r => setU(r.data)).catch(toastError); }, []);
  if (!u) return <LinearProgress />;
  const pct = u.cap > 0 ? Math.min(100, (u.spent / u.cap) * 100) : 0;
  return (
    <div style={{ maxWidth: 480 }}>
      <Typography variant="subtitle1"><b>Gasto de {u.month}</b></Typography>
      <Typography variant="h5">R$ {u.spent.toFixed(2).replace(".", ",")} <span style={{ fontSize: 14 }}>de R$ {Number(u.cap).toFixed(2).replace(".", ",")}</span></Typography>
      <LinearProgress variant="determinate" value={pct} style={{ margin: "12px 0" }} />
      <Typography variant="body2" color="textSecondary">US$ {u.spentUsd.toFixed(4)} × cotação {String(u.fx).replace(".", ",")}. Os preços usados são estimativas: confira o modelo escolhido em anthropic.com/pricing e ajuste com as variáveis N1_PRICE_IN e N1_PRICE_OUT no servidor.</Typography>
    </div>
  );
};

const AgenteN1 = () => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const [tab, setTab] = useState(0);
  const isAdmin = user.profile === "admin";
  return (
    <MainContainer>
      <MainHeader><Title>Agente N1</Title></MainHeader>
      <Paper className={classes.paper} variant="outlined">
        <Tabs value={tab} onChange={(e, v) => setTab(v)} indicatorColor="primary" textColor="primary" variant="scrollable" scrollButtons="auto" style={{ marginBottom: 16 }}>
          <Tab label="Configuração" /><Tab label="Lacunas e propostas" /><Tab label="Respostas aprovadas" /><Tab label="Auditoria" /><Tab label="Consumo" />
        </Tabs>
        {tab === 0 && (isAdmin ? <Config /> : <Typography>Somente administradores configuram o agente.</Typography>)}
        {tab === 1 && <Gaps isAdmin={isAdmin} />}
        {tab === 2 && <Approved isAdmin={isAdmin} />}
        {tab === 3 && <Audit />}
        {tab === 4 && <Usage />}
      </Paper>
    </MainContainer>
  );
};

export default AgenteN1;
