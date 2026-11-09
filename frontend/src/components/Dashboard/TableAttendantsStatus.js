import React from "react";

import Paper from "@material-ui/core/Paper";
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Tooltip from '@material-ui/core/Tooltip';
import Skeleton from "@material-ui/lab/Skeleton";

import { makeStyles } from "@material-ui/core/styles";
import { green, grey } from '@material-ui/core/colors';

import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import ErrorIcon from '@material-ui/icons/Error';
import moment from 'moment';

import Rating from '@material-ui/lab/Rating';
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles(theme => ({
    tableContainer: {
        borderRadius: 14,
        overflowX: "auto",
        background: theme.palette.type === "dark" ? "#1a1d2b" : "#ffffff",
    },
    table: {
        minWidth: 760,
        background: theme.palette.type === "dark" ? "#1a1d2b" : "#ffffff",
    },
    headCell: {
        background: theme.palette.type === "dark" ? "#25293a" : "#f1eff8",
        color: theme.palette.type === "dark" ? "#c9c3d8" : "#625d70",
        borderBottom: `1px solid ${theme.palette.type === "dark" ? "#34384d" : "#e5e4ee"}`,
        fontSize: 10,
        fontWeight: 900,
        letterSpacing: ".06em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
    },
    bodyRow: {
        transition: "background .18s ease",
        "&:hover": {
            background: theme.palette.type === "dark" ? "#222638" : "#faf8ff",
        },
    },
    bodyCell: {
        color: theme.palette.type === "dark" ? "#f1edf8" : theme.palette.text.primary,
        borderBottom: `1px solid ${theme.palette.type === "dark" ? "#2b3042" : "#efedf4"}`,
        fontSize: 12,
        fontWeight: 600,
    },
    on: {
        color: green[600],
        fontSize: '20px'
    },
    off: {
        color: grey[600],
        fontSize: '20px'
    },
    pointer: {
        cursor: "pointer"
    }
}));

export function RatingBox({ rating }) {
    const ratingTrunc = rating === null ? 0 : Math.trunc(rating);
    return <Rating
        defaultValue={ratingTrunc}
        max={3}
        readOnly
    />
}

export default function TableAttendantsStatus(props) {
    const { loading, attendants } = props
    const classes = useStyles();

    function renderList() {
        return attendants.map((a, k) => (
            <TableRow key={k} className={classes.bodyRow}>
                <TableCell className={classes.bodyCell}>{a.name}</TableCell>
                {/* <TableCell align="center" title="1 - Insatisfeito, 2 - Satisfeito, 3 - Muito Satisfeito" className={classes.pointer}>
                    <RatingBox rating={a.rating} />
                </TableCell> */}
                <TableCell className={classes.bodyCell} align="center">{a.rating}</TableCell>
                <TableCell className={classes.bodyCell} align="center">{a.countRating}</TableCell>
                <TableCell className={classes.bodyCell} align="center">{a.tickets}</TableCell>
                <TableCell className={classes.bodyCell} align="center">{formatTime(a.avgWaitTime, 2)}</TableCell>
                <TableCell className={classes.bodyCell} align="center">{formatTime(a.avgSupportTime, 2)}</TableCell>
                <TableCell className={classes.bodyCell} align="center">
                    {a.online ?
                        <Tooltip title="Online">
                            <CheckCircleIcon className={classes.on} />
                        </Tooltip>
                        :
                        <Tooltip title="Offline">
                            <ErrorIcon className={classes.off} />
                        </Tooltip>
                    }
                </TableCell>
            </TableRow>
        ))
    }

    function formatTime(minutes) {
        return moment().startOf('day').add(minutes, 'minutes').format('HH[h] mm[m]');
    }

    return (!loading ?
        <TableContainer className={classes.tableContainer} component={Paper}>
            <Table className={classes.table}>
                <TableHead>
                    <TableRow>
                        <TableCell className={classes.headCell}>{i18n.t("dashboard.users.name")}</TableCell>
                        <TableCell className={classes.headCell} align="center">{i18n.t("dashboard.assessments.score")}</TableCell>
                        <TableCell className={classes.headCell} align="center">{i18n.t("dashboard.assessments.ratedCalls")}</TableCell>
                        <TableCell className={classes.headCell} align="center">{i18n.t("dashboard.assessments.totalCalls")}</TableCell>
                        <TableCell className={classes.headCell} align="center">{i18n.t("dashboard.cards.averageWaitingTime")}</TableCell>
                        <TableCell className={classes.headCell} align="center">{i18n.t("dashboard.cards.averageServiceTime")}</TableCell>
                        <TableCell className={classes.headCell} align="center">{i18n.t("dashboard.cards.status")}</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {renderList()}
                </TableBody>
            </Table>
        </TableContainer>
        : <Skeleton variant="rect" height={150} />
    )
}
