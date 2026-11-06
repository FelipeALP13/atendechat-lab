import React, { useState, useContext } from "react";
import { i18n } from "../../translate/i18n";
import { 
    Avatar, 
    CardHeader, 
    Grid,
    Dialog,
    DialogContent,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { AuthContext } from "../../context/Auth/AuthContext";

const useStyles = makeStyles((theme) => ({
    // Estilos para o modal da imagem
    imageModal: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
    },
    imageModalContent: {
        outline: "none",
        maxWidth: "90vw",
        maxHeight: "90vh",
    },
    expandedImage: {
        width: "100%",
        height: "auto",
        maxWidth: "500px",
        borderRadius: theme.spacing(1),
    },
    clickableAvatar: {
        cursor: "pointer",
        "&:hover": {
            opacity: 0.8,
        },
    },
    modernInfo: {
        minWidth: 0,
        flex: "1 1 auto",
        "& .MuiCardHeader-root": {
            padding: theme.spacing(.5, 1),
        },
        "& .MuiCardHeader-avatar": {
            marginRight: theme.spacing(1.25),
        },
        "& .MuiAvatar-root": {
            width: 44,
            height: 44,
            borderRadius: 14,
            boxShadow: "0 0 0 3px rgba(109,57,232,.10)",
        },
        "& .MuiCardHeader-title": {
            fontSize: 14,
            fontWeight: 900,
            letterSpacing: "-.01em",
        },
        "& .MuiCardHeader-subheader": {
            marginTop: 2,
            fontSize: 10.5,
        },
    },
    fullWidthGrid: {
        width: "100%",
        margin: 0,
    },
    fullWidthItem: {
        maxWidth: "100%",
        flexBasis: "100%",
        padding: "0 !important",
    },
}));

const TicketInfo = ({ contact, ticket, onClick, modern = false }) => {
    const classes = useStyles();
    const [amount, setAmount] = useState("");
    const { user } = useContext(AuthContext);
    const [imageModalOpen, setImageModalOpen] = useState(false); // Estado para o modal da imagem

    // Função para abrir modal da imagem
    const handleImageClick = (e) => {
        e.stopPropagation(); // Prevenir que o clique no avatar execute outros handlers
        if (contact?.urlPicture) {
            setImageModalOpen(true);
        }
    };

    // Função para fechar modal da imagem
    const handleImageModalClose = () => {
        setImageModalOpen(false);
    };

    const renderCardReader = () => {
        return (
            <CardHeader
                onClick={onClick}
                style={{ cursor: "pointer" }}
                titleTypographyProps={{ noWrap: true }}
                subheaderTypographyProps={{ noWrap: true }}
                avatar={
                    <Avatar 
                        src={contact?.urlPicture} 
                        alt="contact_image" 
                        className={classes.clickableAvatar}
                        onClick={handleImageClick}
                    />
                }
                title={`${(contact?.name && contact.name.length > 12) ? 
                    `${contact.name.substring(0, 12)}...` : 
                    contact?.name || '(sem contato)'} #${ticket?.id}`}
                subheader={[
                    ticket?.user && `${i18n.t("messagesList.header.assignedTo")} ${ticket?.user?.name}`,
                    contact?.contactWallets && contact.contactWallets.length > 0
                        ? `• ${i18n.t("wallets.wallet")}: ${contact.contactWallets[0].wallet?.name || 'N/A'}`
                        : null
                ].filter(Boolean).join(' ')}
            />
        );
    }

    const handleChange = (event) => {
        const value = event.target.value;
        setAmount(value);
    }

    return (
        <React.Fragment>
            <Grid
                className={modern ? classes.fullWidthGrid : undefined}
                container
                alignItems="center"
                spacing={modern ? 0 : 10}
            >
                {/* Conteúdo do contato à esquerda */}
                <Grid className={modern ? classes.fullWidthItem : undefined} item xs={modern ? 12 : 6}>
                    <div className={modern ? classes.modernInfo : undefined}>{renderCardReader()}</div>
                </Grid>
            </Grid>

            {/* Modal da Imagem */}
            <Dialog
                open={imageModalOpen}
                onClose={handleImageModalClose}
                className={classes.imageModal}
                maxWidth="md"
                fullWidth
            >
                <DialogContent className={classes.imageModalContent}>
                    <img 
                        src={contact?.urlPicture} 
                        alt={contact?.name || "Foto do contato"}
                        className={classes.expandedImage}
                    />
                </DialogContent>
            </Dialog>
        </React.Fragment>
    );
};

export default TicketInfo;
