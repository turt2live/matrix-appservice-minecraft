var RemoteRoom = require("matrix-appservice-bridge").RemoteRoom;
var mcutils = require("mc-utils");

/**
 * Represents a Minecraft server
 */
class MinecraftServer extends RemoteRoom {

    /**
     * Creates a new Minecraft server object
     * @param {string} hostname the server's hostname
     * @param {number} port the port number for the server (default 25565)
     */
    constructor(hostname, port) {
        if (!port) port = 25565;
        port = parseInt(port);

        super(hostname + " " + port, {
            hostname: hostname,
            port: port
        });

        this.hostname = hostname;
        this.port = port;
    }

    /**
     * Gets the hostname of the server
     * @returns {string} The server's hostname
     */
    getHostname() {
        return this.get("hostname");
    }

    /**
     * Gets the port for the server (default is 25565)
     * @returns {number} The server's port
     */
    getPort() {
        return this.get("port");
    }

    /**
     * Pings the server
     * @returns {Promise<{ motd: string, favicon_b64: string}>} a promise that resolves to the ping response. Rejected if offline
     */
    ping() {
        return new Promise((resolve, reject)=> {
            mcutils.ping(this.getHostname(), this.getPort(), function (err, response) {
                if (err) reject(err);
                else {
                    resolve({
                        motd: response.description,
                        favicon_b64: response.favicon
                    });
                }
            }, 3000);
        });
    }

    /**
     * Gets the "friendly" name for this server.
     * Examples:
     * * mc.turt2live.com
     * * mc.turt2live.com:32221
     * @returns {string} the server's friendly name
     */
    friendlyName() {
        var hostname = this.getHostname();

        if (this.getPort() != 25565)
            hostname += ":" + this.getPort();

        return hostname;
    }

    /**
     * Gets the full name for this server.
     * Examples:
     * * mc.turt2live.com:25565
     * * mc.turt2live.com:1122
     * @returns {string} the server's full name
     */
    fullName() {
        return this.getHostname() + ":" + this.getPort();
    }

    /**
     * Creates MinecraftServers from remote rooms
     * @param {RemoteRoom[]} remoteRooms the matrix bridge remote rooms
     * @returns {MinecraftServer[]} the minecraft servers
     */
    static createServersFromRemote(remoteRooms) {
        var newRooms = [];

        for (var room of remoteRooms) {
            newRooms.push(new MinecraftServer(room.get("minecraft_hostname"), room.get("minecraft_port")));
        }

        return newRooms;
    }

    /**
     * Creates MinecraftServer from a remote room
     * @param {RemoteRoom} remoteRoom the matrix bridge remote room
     * @returns {MinecraftServer} the minecraft server
     */
    static createServerFromRemote(remoteRoom) {
        return new MinecraftServer(remoteRoom.get("minecraft_hostname"), remoteRoom.get("minecraft_port"));
    }
}

module.exports = MinecraftServer;