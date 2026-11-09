import React, { useEffect, useState } from "react";
import {
  Grid,
  LinearProgress,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";
import toastError from "../../errors/toastError";
import api from "../../services/api";

const useStyles = makeStyles(theme => ({
  paper: { flex: 1, padding: theme.spacing(2), overflowY: "auto", ...theme.scrollbarStyles },
  card: { padding: theme.spacing(2), height: "100%" },
  big: { fontSize: 30, fontWeight: 600, lineHeight: 1.1 },
  label: { color: theme.palette.text.secondary, fontSize: 13 },
  hint: { color: theme.palette.text.secondary, fontSize: 13, margin: "4px 0 0" },
  group: { marginTop: theme.spacing(3), fontWeight: 600 },
  chart: { display: "flex", alignItems: "flex-end", gap: 6, height: 140, marginTop: 8 },
  col: { flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", minWidth: 0 },
  barUp: { width: "100%", background: theme.palette.primary.main, borderRadius: "3px 3px 0 0" },
  barEsc: { width: "100%", background: theme.palette.type === "dark" ? "#6b7088" : "#c9cde0" },
  day: { fontSize: 10, color: theme.palette.text.secondary, marginTop: 4, whiteSpace: "nowrap" }
}));

const brl = n => `R$ ${Number(n || 0).toFixed(2).replace(".", ",")}`;
const dayLabel = t => new Date(Number(t)).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
const DECISIONS = {
  answer: "Respondeu",
  draft: "Rascunho para a equipe",
  handoff: "Transferiu",
  refuse: "Recusou (dado sensível)",
  truth: "Disse que é uma IA"
};

const Card = ({ classes, value, label, hint }) => (
  <Grid item xs={6} md={3}>
    <Paper variant="outlined" className={classes.card}>
      <Tooltip title={hint || ""}>
        <div>
          <div className={classes.big}>{value}</div>
          <div className={classes.label}>{label}</div>
        </div>
      </Tooltip>
    </Paper>
  </Grid>
);

const Resultados = () => {
  const classes = useStyles();
  const [days, setDays] = useState(30);
  const [r, setR] = useState(null);

  useEffect(() => {
    setR(null);
    api
      .get(`/results?days=${days}`)
      .then(res => setR(res.data))
      .catch(toastError);
  }, [days]);

  const period = (
    <TextField select size="small" variant="outlined" label="Período" value={days} onChange={e => setDays(e.target.value)} style={{ width: 150 }}>
      <MenuItem value={7}>7 dias</MenuItem>
      <MenuItem value={30}>30 dias</MenuItem>
      <MenuItem value={90}>90 dias</MenuItem>
    </TextField>
  );

  const top = r ? Math.max(1, ...r.daily.map(d => d.conversations)) : 1;

  return (
    <MainContainer>
      <MainHeader>
        <Title>Resultados do agente</Title>
        <MainHeaderButtonsWrapper>{period}</MainHeaderButtonsWrapper>
      </MainHeader>
      <Paper className={classes.paper} variant="outlined">
        {!r ? (
          <LinearProgress />
        ) : (
          <>
            <Grid container spacing={2}>
              <Card classes={classes} value={r.totals.conversations} label="Conversas atendidas pelo agente" />
              <Card
                classes={classes}
                value={`${r.totals.resolvedPct}%`}
                label={`Resolvidas sem a equipe (${r.totals.resolved})`}
                hint="Conversas em que o agente respondeu e nenhuma transferência ou rascunho aconteceu."
              />
              <Card classes={classes} value={brl(r.totals.costPerConversationBrl)} label="Custo por conversa" />
              <Card classes={classes} value={brl(r.totals.costBrl)} label={`Custo do período (US$ ${r.totals.costUsd})`} />
            </Grid>
            <p className={classes.hint}>
              Resolvida é a conversa que o agente tocou sem precisar da equipe. Não é prova de que o cliente ficou satisfeito. Os valores em
              reais usam a cotação {String(r.fx).replace(".", ",")} da configuração do agente, e os preços do modelo são estimativas.
            </p>

            <Typography className={classes.group}>Conversas por dia</Typography>
            {r.daily.length === 0 ? (
              <Typography variant="body2">Nada no período.</Typography>
            ) : (
              <>
                <div className={classes.chart}>
                  {r.daily.map(d => (
                    <div key={d.day} className={classes.col}>
                      <Tooltip title={`${d.conversations} conversas, ${d.escalated} com a equipe, ${brl(d.costBrl)}`}>
                        <div style={{ width: "100%" }}>
                          <div className={classes.barUp} style={{ height: ((d.conversations - d.escalated) / top) * 110 }} />
                          <div className={classes.barEsc} style={{ height: (d.escalated / top) * 110 }} />
                        </div>
                      </Tooltip>
                      <span className={classes.day}>{dayLabel(d.day)}</span>
                    </div>
                  ))}
                </div>
                <p className={classes.hint}>Barra cheia: resolvidas pelo agente. Barra clara: precisaram da equipe.</p>
              </>
            )}

            <Typography className={classes.group}>Por canal</Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Canal</TableCell>
                  <TableCell>Conversas</TableCell>
                  <TableCell>Resolvidas</TableCell>
                  <TableCell>Com a equipe</TableCell>
                  <TableCell>Custo</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {[
                  ["WhatsApp", r.channels.whatsapp],
                  ["Chat do site", r.channels.site]
                ].map(([name, c]) => (
                  <TableRow key={name}>
                    <TableCell>{name}</TableCell>
                    <TableCell>{c.conversations}</TableCell>
                    <TableCell>{c.resolved}</TableCell>
                    <TableCell>{c.escalated}</TableCell>
                    <TableCell>{brl(c.costBrl)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <Typography className={classes.group}>O que o agente fez</Typography>
            <Table size="small">
              <TableBody>
                {Object.keys(r.decisions).length === 0 && (
                  <TableRow>
                    <TableCell>Nada no período.</TableCell>
                  </TableRow>
                )}
                {Object.entries(r.decisions).map(([k, n]) => (
                  <TableRow key={k}>
                    <TableCell>{DECISIONS[k] || k}</TableCell>
                    <TableCell style={{ width: 90 }}>{n}×</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <Typography className={classes.group}>Campanhas (chat do site)</Typography>
            {r.campaigns.length === 0 ? (
              <Typography variant="body2">Nenhuma visita ao chat do site no período.</Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Campanha</TableCell>
                    <TableCell>Visitantes</TableCell>
                    <TableCell>Conversas</TableCell>
                    <TableCell>Com a equipe</TableCell>
                    <TableCell>Contatos</TableCell>
                    <TableCell>Custo</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {r.campaigns.map(c => (
                    <TableRow key={c.campaign}>
                      <TableCell>{c.campaign}</TableCell>
                      <TableCell>{c.sessions}</TableCell>
                      <TableCell>{c.conversations}</TableCell>
                      <TableCell>{c.escalated}</TableCell>
                      <TableCell>{c.leads}</TableCell>
                      <TableCell>{brl(c.costBrl)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <p className={classes.hint}>A campanha vem do utm_campaign do endereço em que o visitante abriu o chat.</p>

            <Typography className={classes.group}>O que o agente mais deixou de responder</Typography>
            {r.topGaps.length === 0 ? (
              <Typography variant="body2">Nenhuma lacuna pendente.</Typography>
            ) : (
              <Table size="small">
                <TableBody>
                  {r.topGaps.map(g => (
                    <TableRow key={g.question}>
                      <TableCell>{g.question}</TableCell>
                      <TableCell style={{ width: 90 }}>{g.times}×</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <p className={classes.hint}>Responda essas na aba Lacunas e propostas do Agente N1 para a taxa de resolvidas subir.</p>
          </>
        )}
      </Paper>
    </MainContainer>
  );
};

export default Resultados;
