class iTicket {
    constructor(unbug){
        this.log = console.log;
        this.ticketCounter = 0;
        this.debugMod = unbug;
    }

    get debug(){
        return this.debugMod == true;
    }

    date(type){
        let date = new Date();
        switch(type) {
            case "day":
                return date.getDate();
            case "hours":
                return date.getHours();
            case "minutes":
                return date.getMinutes();
            case "complete":
                return date.toLocaleDateString();
        default:
        }
    }

    async countTickets(param) {
        this.ticketCounter = 0;
        for (let i = 0; i < param.menu.length; i++){
            let cat = param.menu[i];
            const guild = param.client.guilds.cache.get(param.guild);
            await guild.channels.fetch(cat.value).then(channel => {
                if (channel.type === "GUILD_CATEGORY"){
                    this.ticketCounter += channel.children.size;
                }
            });
        };

        return this.ticketCounter;
    }

    haveAcessAdmin(memberId, content){
        for (let i = 0; i < content.length; i++){
            let val = content[i];
            if (memberId === val.id){
                return true;
            }
        }
        return false;
    }

    sentTicketPerms(interact, permissions, Perms){
        this.permissions = [{id: interact.guild.id, deny: [Perms.FLAGS.VIEW_CHANNEL]}, {id: interact.user.id, allow: [Perms.FLAGS.VIEW_CHANNEL]}];

        for (let i = 0; i < permissions.length; i++){
            let role = permissions[i];
            this.permissions.push({
                id: interact.guild.roles.cache.get(role.id),
                allow: [Perms.FLAGS.VIEW_CHANNEL]
            });
        }

        return this.permissions;
    }

    defaultPerms(interact, Perms){
        return [{id: interact.guild.id, deny: [Perms.FLAGS.VIEW_CHANNEL]}, {id: interact.user.id, allow: [Perms.FLAGS.VIEW_CHANNEL]}];
    }

    findById(id, configId){
        for (let i = 0; i < configId.length; i++){
            if (id === configId[i].value){
                return i;
            }
        }
        return false;
    }

    channel(param) {
        if (!param.key) return param.client.channels.cache.get(param.id);
        return param.client.channels.cache.get(param.id)[param.key];
    }

    user(param) {
        if (!param.key) return param.client.users.cache.find(user => user.id === param.id);
        return param.client.users.cache.find(user => user.id === param.id)[param.key];
    }
}

module.exports = iTicket;