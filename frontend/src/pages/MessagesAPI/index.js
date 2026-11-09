import React, { useState, useEffect, useContext } from "react";
import { useHistory } from "react-router-dom";
import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";

import { i18n } from "../../translate/i18n";
import {
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  Grid,
  MenuItem,
  TextField,
  Typography,
} from "@material-ui/core";
import { Field, Form, Formik } from "formik";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";

import axios from "axios";
import usePlans from "../../hooks/usePlans";
import api from "../../services/api";
import { AuthContext } from "../../context/Auth/AuthContext";

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    padding: theme.spacing(2),
    paddingBottom: 100,
  },
  mainHeader: {
    marginTop: theme.spacing(1),
  },
  elementMargin: {
    padding: theme.spacing(2),
  },
  formContainer: {
    maxWidth: 500,
  },
  textRight: {
    textAlign: "right",
  },
}));

const MessagesAPI = () => {
  const classes = useStyles();
  const history = useHistory();

  const [formMessageTextData] = useState({
    token: "",
    number: "",
    body: "",
    userId: "",
    queueId: "",
    sendSignature: false,
    closeTicket: false,
  });
  const [formMessageMediaData] = useState({
    token: "",
    number: "",
    medias: "",
    body: "",
    userId: "",
    queueId: "",
    sendSignature: false,
    closeTicket: false,
  });
  const [users, setUsers] = useState([]);
  const [queues, setQueues] = useState([]);
  const [file, setFile] = useState({});
  const { user, socket } = useContext(AuthContext);

  const { getPlanCompany } = usePlans();

  useEffect(() => {
    async function fetchData() {
      const companyId = user.companyId;
      const planConfigs = await getPlanCompany(undefined, companyId);
      if (!planConfigs.plan.useExternalApi) {
        toast.error(
          "Esta empresa não possui permissão para acessar essa página! Estamos lhe redirecionando."
        );
        setTimeout(() => {
          history.push(`/`);
        }, 1000);
      }
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Atendentes e filas para escolher pelo nome, em vez de decorar o número.
  useEffect(() => {
    api
      .get("/users/list")
      .then((r) => setUsers(Array.isArray(r.data) ? r.data : r.data.users || []))
      .catch(() => setUsers([]));
    api
      .get("/queue")
      .then((r) => setQueues(r.data || []))
      .catch(() => setQueues([]));
  }, []);

  const getEndpoint = () => {
    return process.env.REACT_APP_BACKEND_URL + "/api/messages/send";
  };

  /** Campo vazio não vai no corpo: o backend trata ausente e "" de formas diferentes. */
  const clean = (values) => {
    const data = { number: values.number, body: values.body };
    if (values.userId) data.userId = Number(values.userId);
    if (values.queueId) data.queueId = Number(values.queueId);
    if (values.sendSignature) data.sendSignature = true;
    if (values.closeTicket) data.closeTicket = true;
    return data;
  };

  const curlFor = (values) => {
    const data = clean(values);
    return [
      `curl -X POST ${getEndpoint()} \\`,
      `  -H 'Authorization: Bearer ${values.token || "SEU_TOKEN"}' \\`,
      `  -H 'Content-Type: application/json' \\`,
      `  -d '${JSON.stringify(data)}'`,
    ].join("\n");
  };

  const copyCurl = (values) => {
    try {
      navigator.clipboard.writeText(curlFor(values));
      toast.success("Comando copiado.");
    } catch (e) {
      toast.info("Não consegui copiar; selecione o comando manualmente.");
    }
  };

  const handleSendTextMessage = async (values) => {
    const data = clean(values);
    try {
      await axios.request({
        url: getEndpoint(),
        method: "POST",
        data,
        headers: {
          "Content-type": "application/json",
          Authorization: `Bearer ${values.token}`,
        },
      });
      toast.success("Mensagem enviada com sucesso");
    } catch (err) {
      toastError(err);
    }
  };

  const handleSendMediaMessage = async (values) => {
    try {
      const firstFile = file[0];
      const data = new FormData();
      data.append("number", values.number);
      data.append("body", values.body ? values.body : firstFile.name);
      if (values.userId) data.append("userId", values.userId);
      if (values.queueId) data.append("queueId", values.queueId);
      if (values.sendSignature) data.append("sendSignature", "true");
      if (values.closeTicket) data.append("closeTicket", "true");
      data.append("medias", firstFile);
      await axios.request({
        url: getEndpoint(),
        method: "POST",
        data,
        headers: {
          "Content-type": "multipart/form-data",
          Authorization: `Bearer ${values.token}`,
        },
      });
      toast.success("Mensagem enviada com sucesso");
    } catch (err) {
      toastError(err);
    }
  };

  const renderFormMessageText = () => {
    return (
      <Formik
        initialValues={formMessageTextData}
        enableReinitialize={true}
        onSubmit={(values, actions) => {
          setTimeout(async () => {
            await handleSendTextMessage(values);
            actions.setSubmitting(false);
            actions.resetForm();
          }, 400);
        }}
        className={classes.elementMargin}
      >
        {({ isSubmitting, values }) => (
          <Form className={classes.formContainer}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Field
                  as={TextField}
                  label={i18n.t("messagesAPI.textMessage.token")}
                  name="token"
                  autoFocus
                  variant="outlined"
                  margin="dense"
                  fullWidth
                  className={classes.textField}
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Field
                  as={TextField}
                  label={i18n.t("messagesAPI.textMessage.number")}
                  name="number"
                  autoFocus
                  variant="outlined"
                  margin="dense"
                  fullWidth
                  className={classes.textField}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <Field
                  as={TextField}
                  label={i18n.t("messagesAPI.textMessage.body")}
                  name="body"
                  autoFocus
                  variant="outlined"
                  margin="dense"
                  fullWidth
                  className={classes.textField}
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Field
                  as={TextField}
                  select
                  label="Atendente (opcional)"
                  name="userId"
                  variant="outlined"
                  margin="dense"
                  fullWidth
                  className={classes.textField}
                >
                  <MenuItem value="">Nenhum</MenuItem>
                  {users.map((u) => (
                    <MenuItem key={u.id} value={u.id}>
                      {u.name}
                    </MenuItem>
                  ))}
                </Field>
              </Grid>
              <Grid item xs={12} md={6}>
                <Field
                  as={TextField}
                  select
                  label="Fila (opcional)"
                  name="queueId"
                  variant="outlined"
                  margin="dense"
                  fullWidth
                  className={classes.textField}
                >
                  <MenuItem value="">Nenhuma</MenuItem>
                  {queues.map((q) => (
                    <MenuItem key={q.id} value={q.id}>
                      {q.name}
                    </MenuItem>
                  ))}
                </Field>
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Field as={Checkbox} type="checkbox" name="sendSignature" color="primary" />
                  }
                  label="Assinar com o nome do atendente"
                />
                <FormControlLabel
                  control={
                    <Field as={Checkbox} type="checkbox" name="closeTicket" color="primary" />
                  }
                  label="Encerrar o ticket depois de enviar"
                />
              </Grid>
              <Grid item xs={12} className={classes.textRight}>
                <Button
                  onClick={() => copyCurl(values)}
                  color="primary"
                  className={classes.btnWrapper}
                >
                  Copiar comando curl
                </Button>
                <Button
                  type="submit"
                  color="primary"
                  variant="contained"
                  className={classes.btnWrapper}
                >
                  {isSubmitting ? (
                    <CircularProgress
                      size={24}
                      className={classes.buttonProgress}
                    />
                  ) : (
                    <>{i18n.t("messagesAPI.toSend")}</>
                  )}
                </Button>
              </Grid>
            </Grid>
          </Form>
        )}
      </Formik>
    );
  };

  const renderFormMessageMedia = () => {
    return (
      <Formik
        initialValues={formMessageMediaData}
        enableReinitialize={true}
        onSubmit={(values, actions) => {
          setTimeout(async () => {
            await handleSendMediaMessage(values);
            actions.setSubmitting(false);
            actions.resetForm();
            document.getElementById("medias").files = null;
            document.getElementById("medias").value = null;
          }, 400);
        }}
        className={classes.elementMargin}
      >
        {({ isSubmitting }) => (
          <Form className={classes.formContainer}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Field
                  as={TextField}
                  label={i18n.t("messagesAPI.mediaMessage.token")}
                  name="token"
                  autoFocus
                  variant="outlined"
                  margin="dense"
                  fullWidth
                  className={classes.textField}
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Field
                  as={TextField}
                  label={i18n.t("messagesAPI.mediaMessage.number")}
                  name="number"
                  autoFocus
                  variant="outlined"
                  margin="dense"
                  fullWidth
                  className={classes.textField}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <Field
                  as={TextField}
                  label={i18n.t("messagesAPI.textMessage.body")}
                  name="body"
                  autoFocus
                  variant="outlined"
                  margin="dense"
                  fullWidth
                  className={classes.textField}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Field
                  as={TextField}
                  select
                  label="Atendente (opcional)"
                  name="userId"
                  variant="outlined"
                  margin="dense"
                  fullWidth
                  className={classes.textField}
                >
                  <MenuItem value="">Nenhum</MenuItem>
                  {users.map((u) => (
                    <MenuItem key={u.id} value={u.id}>
                      {u.name}
                    </MenuItem>
                  ))}
                </Field>
              </Grid>
              <Grid item xs={12} md={6}>
                <Field
                  as={TextField}
                  select
                  label="Fila (opcional)"
                  name="queueId"
                  variant="outlined"
                  margin="dense"
                  fullWidth
                  className={classes.textField}
                >
                  <MenuItem value="">Nenhuma</MenuItem>
                  {queues.map((q) => (
                    <MenuItem key={q.id} value={q.id}>
                      {q.name}
                    </MenuItem>
                  ))}
                </Field>
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Field as={Checkbox} type="checkbox" name="sendSignature" color="primary" />
                  }
                  label="Assinar com o nome do atendente"
                />
                <FormControlLabel
                  control={
                    <Field as={Checkbox} type="checkbox" name="closeTicket" color="primary" />
                  }
                  label="Encerrar o ticket depois de enviar"
                />
              </Grid>
              <Grid item xs={12}>
                <input
                  type="file"
                  name="medias"
                  id="medias"
                  required
                  onChange={(e) => setFile(e.target.files)}
                />
              </Grid>
              <Grid item xs={12} className={classes.textRight}>
                <Button
                  type="submit"
                  color="primary"
                  variant="contained"
                  className={classes.btnWrapper}
                >
                  {isSubmitting ? (
                    <CircularProgress
                      size={24}
                      className={classes.buttonProgress}
                    />
                  ) : (
                    "Enviar"
                  )}
                </Button>
              </Grid>
            </Grid>
          </Form>
        )}
      </Formik>
    );
  };

  return (
    <Paper
      className={classes.mainPaper}
      style={{ marginLeft: "5px" }}
      // className={classes.elementMargin}
      variant="outlined"
    >
      <Typography variant="h5">{i18n.t("messagesAPI.API.title")}</Typography>
      <Typography
        variant="h6"
        color="primary"
        className={classes.elementMargin}
      >
        {i18n.t("messagesAPI.API.methods.title")}
      </Typography>
      <Typography component="div">
        <ol>
          <li>{i18n.t("messagesAPI.API.methods.messagesText")}</li>
          <li>{i18n.t("messagesAPI.API.methods.messagesMidia")}</li>
        </ol>
      </Typography>
      <Typography
        variant="h6"
        color="primary"
        className={classes.elementMargin}
      >
        {i18n.t("messagesAPI.API.instructions.title")}
      </Typography>
      <Typography className={classes.elementMargin} component="div">
        <b>{i18n.t("messagesAPI.API.instructions.comments")}</b>
        <br />
        <ul>
          <li>{i18n.t("messagesAPI.API.instructions.comments1")}</li>
          <li>
            {i18n.t("messagesAPI.API.instructions.comments2")}
            <ul>
              <li>{i18n.t("messagesAPI.API.instructions.codeCountry")}</li>
              <li>{i18n.t("messagesAPI.API.instructions.code")}</li>
              <li>{i18n.t("messagesAPI.API.instructions.number")}</li>
            </ul>
          </li>
        </ul>
      </Typography>
      <Typography
        variant="h6"
        color="primary"
        className={classes.elementMargin}
      >
        {i18n.t("messagesAPI.API.text.title")}
      </Typography>
      <Grid container>
        <Grid item xs={12} sm={6}>
          <Typography className={classes.elementMargin} component="div">
            <p>{i18n.t("messagesAPI.API.text.instructions")}</p>
            <b>
              {i18n.t("messagesAPIInstructions.endpoint")}
            </b> {getEndpoint()} <br />
            <b>{i18n.t("messagesAPIInstructions.method")}</b>{" "}
            {i18n.t("messagesAPIInstructions.post")} <br />
            <b>{i18n.t("messagesAPIInstructions.headers")}</b>{" "}
            {i18n.t("messagesAPIInstructions.headerAuthorization")} <br />
            <b>{i18n.t("messagesAPIInstructions.body")}</b> {"{"} <br />
            {i18n.t("messagesAPIInstructions.fieldNumber")} <br />
            {i18n.t("messagesAPIInstructions.fieldBody")} <br />
            {i18n.t("messagesAPIInstructions.fieldUserId")} <br />
            {i18n.t("messagesAPIInstructions.fieldQueueId")} <br />
            {i18n.t("messagesAPIInstructions.fieldSendSignature")} <br />
            {i18n.t("messagesAPIInstructions.fieldCloseTicket")} <br />
            {"}"}
          </Typography>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Typography className={classes.elementMargin}>
            <b>{i18n.t("messagesAPIInstructions.testSend")}</b>
          </Typography>
          {renderFormMessageText()}
        </Grid>
      </Grid>
      <Typography
        variant="h6"
        color="primary"
        className={classes.elementMargin}
      >
        {i18n.t("messagesAPI.API.media.title")}
      </Typography>
      <Grid container>
        <Grid item xs={12} sm={6}>
          <Typography className={classes.elementMargin} component="div">
            <p>{i18n.t("messagesAPI.API.media.instructions")}</p>
            <b>Endpoint: </b> {getEndpoint()} <br />
            <b>Método: </b> POST <br />
            <b>Headers: </b> Authorization Bearer (token cadastrado) e
            Content-Type (multipart/form-data) <br />
            <b>FormData: </b> <br />
            <ul>
              <li>
                <b>number: </b> 558599999999
              </li>
              <li>
                <b>body:</b> Message
              </li>
              <li>
                <b>userId:</b> ID usuário ou ""
              </li>
              <li>
                <b>queueId:</b> ID da fila ou ""
              </li>
              <li>
                <b>medias: </b> arquivo
              </li>
              <li>
                <b>sendSignature:</b>{" "}
                {i18n.t("messagesAPIInstructions.singMessage")} <br />
              </li>
              <li>
                <b>closeTicket:</b>{" "}
                {i18n.t("messagesAPIInstructions.closeTicket")} <br />
              </li>
            </ul>
          </Typography>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Typography className={classes.elementMargin}>
            <b>{i18n.t("messagesAPIInstructions.testSend")}</b>
          </Typography>
          {renderFormMessageMedia()}
        </Grid>
      </Grid>
    </Paper>
  );
};

export default MessagesAPI;
