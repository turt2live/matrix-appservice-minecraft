var RemoteRoom = require("matrix-appservice-bridge").RemoteRoom;

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
    public getHostname() {
        return this.get("hostname");
    }

    /**
     * Gets the port for the server (default is 25565)
     * @returns {number} The server's port
     */
    public getPort() {
        return this.get("port");
    }
}

module.exports = MinecraftServer;