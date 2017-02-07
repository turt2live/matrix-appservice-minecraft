/**
 * Represents a Minecraft server bridge. Intended to be extended by bridge components to provide functionality back
 * to Matrix. For instance, this could be a bridge to a player bridge or a custom plugin solution.
 */
class MinecraftServerBridge {

    /**
     * Creates a new Minecraft Server Bridge base
     * @param roomHandler the RoomHandler for this particular bridge
     */
    constructor(roomHandler) {
        this._roomHandler = roomHandler;
    }

    /**
     * Protected API. Send a message to the bridged matrix room
     * @param fromPlayer the player sending the message
     * @param messageHtml the HTML to send that represents the player's message
     * @param messageType the Matrix message type (m.text, m.emote, etc)
     * @private
     */
    _toMatrix(fromPlayer, messageHtml, messageType) {
        this._roomHandler.sendMessage(fromPlayer, messageHtml, messageType);
    }
}

module.exports = MinecraftServerBridge;