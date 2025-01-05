const config = require("./config/config.json");
const commands = require("./config/commands.json");
const { token } = require("./config/token.json");

// Initialize Objects
const {Client, Intents, Permissions, MessageEmbed, MessageActionRow, MessageSelectMenu, MessageButton, MessageAttachment} = require("discord.js");
const Tckt = require("./classes.js");
const hastebin = require("hastebin-gen");
const iTicket = new Tckt(config.debug);

const client = new Client({
    intents: [ 
		Intents.FLAGS.GUILDS, 
		Intents.FLAGS.GUILD_BANS, 
        Intents.FLAGS.GUILD_MEMBERS,
		Intents.FLAGS.GUILD_EMOJIS_AND_STICKERS, 
		Intents.FLAGS.GUILD_INTEGRATIONS, 
		Intents.FLAGS.GUILD_WEBHOOKS, 
		Intents.FLAGS.GUILD_INVITES, 
		Intents.FLAGS.GUILD_VOICE_STATES, 
		Intents.FLAGS.GUILD_PRESENCES, 
		Intents.FLAGS.GUILD_MESSAGES, 
		Intents.FLAGS.GUILD_MESSAGE_REACTIONS, 
		Intents.FLAGS.GUILD_MESSAGE_TYPING, 
		Intents.FLAGS.DIRECT_MESSAGES, 
		Intents.FLAGS.DIRECT_MESSAGE_REACTIONS, 
		Intents.FLAGS.DIRECT_MESSAGE_TYPING
	],
    restTimeOffset: 0,
    partials: ["USER", "CHANNEL", "GUILD_MEMBER", "MESSAGE", "REACTION", "MANAGE_ROLES"]
});

client.on("ready", async (client) => {
    if (config.activeBotActivity === true){
        setInterval(async () => {
            let result = await iTicket.countTickets({
                client: client,
                menu: config.ticket.menu,
                guild: config.guildId
            });
    
            client.user.setActivity(`${result} Ticket${result > 1 ? "s" : ""} ouvert`, {type: "WATCHING"});
        }, 5 * 1000);
    }

    try {
		await client.guilds.cache.forEach(async guild => {
			for (let i = 0; i < commands.length; i++) {
				await guild?.commands.create(commands[i]).catch(err => {
					iTicket.log("y'a une erreur!", err);
				}).then(command => {
                    iTicket.log(`commande ${command.name} crée avec succès`);
                });
			}
		});
	} catch (err) {
		client.logger(`SlashCommandLoad Error => ${err}`) 
	};

    iTicket.log(`Bot ${client.user.tag} is ready to use!`);
});

client.on("interactionCreate", async (interaction) => {
    if (interaction.isSelectMenu()) {
        if (interaction.customId == "selectedTicket"){
            config.ticket.menu.map(cat => {
                if (interaction.values[0] === cat.value){
                    let channelExist = interaction.guild.channels.cache.find(channels => channels.topic == interaction.user.id);
                    if (channelExist) return interaction.reply({content: "Vous avez déja un ticket d'ouvert sur le serveur.", ephemeral: true});
    
                    let findId = iTicket.findById(interaction.values[0], config.ticket.menu);
    
                    if (findId !== false){
                        const closeButton = new MessageActionRow().addComponents(new MessageButton()
                            .setCustomId("closeTicket")
                            .setLabel("Fermer le Ticket")
                            .setStyle("DANGER")
                        );
    
                        let permissions = iTicket.sentTicketPerms ? iTicket.sentTicketPerms(interaction, config.ticket.accessRoles, Permissions) : iTicket.defaultPerms(interaction, Permissions);
                        if (iTicket.debug) iTicket.log("SENT PERMS", permissions, "\n\nBACK\n\n-----------------------\n");
    
                        interaction.guild.channels.create(interaction.user.username, {
                            type: 'GUILD_TEXT', topic: interaction.user.id, parent: interaction.values[0],
                            permissionOverwrites: permissions
                        }).then(channel => {
                            const openedTicket = new MessageEmbed()
                            .setDescription(`**Informations**\nVeuillez précisez votre demande auprès de l'équipe de <@${client.user.id}>\n\n**Support**\nUne réponse/aide vous sera apportez sous __72h maximum__ (Jours ouvrés) sauf exception.\n\n**Type de Ticket**\n${config.ticket.menu[findId].label}`)
                            .setColor(config.ticket.embed.color || "#5865F2")
                            .setThumbnail(interaction.user.avatarURL({dynamic: true}))
                            .setFooter({text: `${config.serverName}・${iTicket.date("complete")}`})
                            channel.send({
                                embeds: [openedTicket], 
                                content: `Ticket Crée par ${interaction.user} / ${interaction.user.tag} <@&1308377124578787336>`,
                                components: [closeButton]
                            }).then(() => {
                                interaction.reply({
                                    content: `Votre ticket à été ouvert avec succès. <#${channel.id}>`, 
                                    ephemeral: true
                                })
                            })
                        }).catch(error => {
                            interaction.reply({content: `Une erreur est survenu lors de la création de votre ticket. ${error}`, ephemeral: true})
                        })
                    } else {
                        interaction.reply({
                            content: "Une erreur est survenu lors de la création de votre ticket. (CHANNEL_ID_TICKET)", 
                            ephemeral: true
                        });
                    }
                }
            })
        }

        if (interaction.customId == "verifTicketClose"){
            if (interaction.values[0] === "yes"){
                if (!iTicket.haveAcessAdmin(interaction.user.id, config.acessToCommandsAdmin)){
                    return interaction.reply({
                        content: "Vous n'avez pas accès a cette action!",
                        ephemeral: true
                    });
                }
    
                interaction.reply({
                    content: `Le salon va être supprimé dans ${config.ticket.closeAfterSeconds || "7"} secondes.`, 
                    ephemeral: true
                }).then(() => {
                    setTimeout(() => {
                        const guild = client.guilds.cache.get(interaction.guildId);
                        const closeChannel = guild.channels.cache.get(interaction.channelId);
                
                        closeChannel.messages.fetch().then(async (messages) => {
                            let fetchMessage = messages.filter(m => m.author.bot !== true).map(m => `${iTicket.date("complete")} - ${m.author.username}#${m.author.discriminator}: ${m.attachments.size > 0 ? m.attachments.first().proxyURL : m.content}`).reverse().join('\n');
                            if (fetchMessage.length < 1) fetchMessage = "Pas de message";
                            
                            hastebin(fetchMessage, {
                                extension: "diff",
                                url: "https://haste.chaun14.fr/"
                            }).then(haste => {
                                let channelLogs = iTicket.channel({client: client, id: config.channel.logs});
                                if (!channelLogs) return interaction.editReply("Le ticket n'a pas pu être fermé car le salon de logs n'existe pas.");
            
                                let userById = iTicket.user({client: client, id: interaction.channel.topic});
                                const closeTicket = new MessageEmbed();
            
                                closeTicket.setDescription(`Fermé par ${interaction.user}\n\n**Informations**\n\n**Utilisateur**\n${userById}\n**Tag**\n${interaction.user.tag}\n**Discriminateur**\n#${userById.discriminator}\n**ID**\n${userById.id}\n**Pseudo**\n${userById.username}\n**Logs**\n[Conversation](${haste})`)
                                closeTicket.setColor(config.ticket.embed.color || "#5865F2")
                                closeTicket.setThumbnail(interaction.user.avatarURL({dynamic: true}))
                                closeTicket.setFooter({text: `${config.serverName}・${iTicket.date("complete")}`})
            
                                channelLogs.send({
                                    content: `Ticket Fermé par ${interaction.user} / ${interaction.user.tag}`,
                                    embeds: [closeTicket]
                                }).then(() => {
                                    interaction.channel.delete();
                                }).catch(error => {
                                    interaction.reply({
                                        content: `Une erreur est survenu lors de la fermeture du ticket. (${error}`,
                                    })
                                })
                            }).catch(err => {
                                interaction.channel.send({
                                    content: `Il y a une erreur par rapport a l'envoi du fichier sur le serveur ${err}`
                                });
                            });
                        })
                    }, config.ticket.closeAfterSeconds || 7 * 1000);
                });
            }
        }


        return;
    }

    if (interaction.isButton()){
        if (interaction.customId === "closeTicket"){
            if (!iTicket.haveAcessAdmin(interaction.user.id, config.acessToCommandsAdmin)){
                return interaction.reply({
                    content: "Vous n'avez pas accès a cette action!",
                    ephemeral: true
                });
            }

            const verificationClosing = new MessageActionRow().addComponents(
                new MessageSelectMenu()
                .setCustomId("verifTicketClose")
                .setPlaceholder("Oui?")
				.addOptions([
                    {
                        label: "Oui",
                        description: "Si vous cochez oui, le ticket sera fermé.",
                        value: "yes"
                    }
                ])
			);

            interaction.reply({
                content: "Voulez-vous vraiment fermer le ticket ?",
                components: [verificationClosing],
                ephemeral: true
            });
        }
    } else if (interaction.isCommand()) {
        if (interaction.commandName === "ticket"){
            if (!iTicket.haveAcessAdmin(interaction.user.id, config.acessToCommandsAdmin)){
                return interaction.reply({
                    content: "Vous n'avez pas accès a cette commande!",
                    ephemeral: true
                });
            }

            if (interaction.channel.id !== config.channel.ticket){
                return interaction.reply({
                    content: "Vous ne pouvez pas utiliser cette commande dans ce salon!",
                    ephemeral: true
                });
            }

            let embed = config.ticket.embed;
            const ticketEmbed = new MessageEmbed();

            if (embed["author"] && embed["author"].name !== "") ticketEmbed.setAuthor(embed["author"]);
            if (embed["title"] && embed["title"] !== "") ticketEmbed.setTitle(embed["title"]);
            if (embed["description"] && embed["description"] !== "") ticketEmbed.setDescription(embed["description"]);
            ticketEmbed.setColor(embed["color"] || "#5865F2");
            if (embed["thumbnail"] && embed["thumbnail"] !== false) ticketEmbed.setThumbnail(config.urlLogo);
            ticketEmbed.setTimestamp();

            const selectedMenu = new MessageActionRow().addComponents(
                new MessageSelectMenu()
                .setCustomId("selectedTicket")
                .setPlaceholder(config.ticket["messageMenu"] || "Selectionner une option!")
				.addOptions(config.ticket.menu)
			);

            interaction.reply({embeds: [ticketEmbed], ephemeral: false, components: [selectedMenu]});
        }
    }
});

client.login(token);