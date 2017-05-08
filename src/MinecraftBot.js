var mineflayer = require('mineflayer');
var log = require("./LogService");
var UuidCache = require("./UuidCache");

/**
 * Represents a connection to a Minecraft server
 */
class MinecraftBot {

    /**
     * Sets up a new Minecraft bot
     * @param {MinecraftServer} mcServer the server to prepare
     * @param {MinecraftBridge} bridge the bridge to use
     * @param {string} roomId the room ID being bridged to
     */
    constructor(mcServer, bridge, roomId) {
        this._server = mcServer;
        this._bot = null;
        this._bridge = bridge;
        this._roomId = roomId;
    }

    /**
     * Starts the Minecraft bot, connecting to the server
     * @param {string} username the Mojang username for the bot
     * @param {string} password the Mojang password for the bot
     */
    start(username, password) {
        this._bot = mineflayer.createBot({
            host: this._server.hostname,
            port: this._server.port,
            username: username,
            password: password
        });

        this._bot.on('chat', (username, message) => {
            if (username == this._bot.username) return; // self

            UuidCache.lookupFromName(username).then(profile => {
                this._bridge.getMcUserIntent(profile.uuid).sendText(this._roomId, message.toString());
            });
        });
        //
        // this._bot.on('playerJoined', (player) => {
        //     if (player.username == this._bot.username) return; // self
        //
        //     UuidCache.lookupFromName(player.username).then(profile => {
        //         var intent = this._bridge.getMinecraftUser(profile.uuid);
        //         intent.join(this._roomId);
        //     });
        // });
    }

    /**
     * Sends a message to the Minecraft server, as the particular sender
     * @param {{displayname: string, avatar_url: string, user_id: string}} sender the sender of the message
     * @param {string} message the plain text message sent
     */
    sendMessage(sender, message) {
        this._bot.chat("<" + (sender.displayname || sender.user_id) + "> " + message);
    }
}

module.exports = MinecraftBot;