import React from "react";

import { Card, IconButton, Tooltip } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import TicketHeaderSkeleton from "../TicketHeaderSkeleton";
import ArrowBackIos from "@material-ui/icons/ArrowBackIos";
import { useHistory } from "react-router-dom";

const useStyles = makeStyles(theme => ({
	ticketHeader: {
		display: "flex",
		// backgroundColor: "#eee",
		background: theme.palette.total,
		flex: "none",
		borderBottom: "1px solid rgba(0, 0, 0, 0.12)",
		height: "65px",
		[theme.breakpoints.down("sm")]: {
			flexWrap: "wrap",
			height: 'max-content'
		},
	},
	modernHeader: {
		minHeight: 72,
		height: "auto",
		padding: theme.spacing(.75, 1.25),
		alignItems: "center",
		gap: theme.spacing(.5),
		background: theme.palette.background.paper,
		borderBottom: `1px solid ${theme.palette.divider}`,
		boxShadow: theme.palette.type === "dark" ? "none" : "0 4px 18px rgba(48,39,82,.035)",
	},
	backButton: {
		width: 36,
		height: 36,
		flex: "0 0 auto",
		color: theme.palette.text.secondary,
		border: `1px solid ${theme.palette.divider}`,
		borderRadius: 11,
		"&:hover": {
			color: theme.palette.primary.main,
			background: theme.palette.type === "dark" ? "rgba(109,57,232,.16)" : "#f1ecff",
		},
	},
}));

const TicketHeader = ({ loading, children, modern = false, routeBase = "/tickets" }) => {
	const classes = useStyles();
	const history = useHistory();

	const handleBack = () => {

		history.push(routeBase);
	};

	// useEffect(() => {
	// 	const handleKeyDown = (event) => {
	// 		if (event.key === "Escape") {
	// 			handleBack();
	// 		}
	// 	};
	// 	document.addEventListener("keydown", handleKeyDown);
	// 	return () => {
	// 		document.removeEventListener("keydown", handleKeyDown);
	// 	};
	// }, [history]);

	return (
		<>
			{loading ? (
				<TicketHeaderSkeleton />
			) : (
				<Card
					square
					className={`${classes.ticketHeader} ${modern ? classes.modernHeader : ""}`}
				>
					<Tooltip title="Voltar para as conversas">
						<IconButton className={modern ? classes.backButton : undefined} color="primary" onClick={handleBack}>
							<ArrowBackIos fontSize="small" />
						</IconButton>
					</Tooltip>
					{children}
				</Card>
			)}
		</>
	);
};

export default TicketHeader;
