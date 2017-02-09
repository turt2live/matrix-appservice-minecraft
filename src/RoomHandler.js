var log = require('npmlog');
var striptags = require('striptags');

/**
 * Provides a generic public interface to process room-related actions with respect to Matrix.
 */
class RoomHandler {

    constructor(matrixApp, roomId) {
        this._matrixApp = matrixApp;
        this._roomId = roomId;
        this._userMap = {};
    }

    sendMessage(userId, htmlMessage, msgType) {
        if (!this._userMap.hasOwnProperty(userId)) {
            this._userMap[userId] = this._createUser(userId);
        }

        var mtxUser = this._userMap[userId];

        var message = {
            msgtype: msgType,
            formatted_body: htmlMessage,
            format: "org.matrix.custom.html",
            body: striptags(htmlMessage)
        };

        this._matrixApp.sendMessage(mtxUser, this._roomId, message);
    }

    _createUser(userId) {
        log.debug('RoomHandler', 'Account creation request for ' + userId + ' in room ' + this._roomId);

    }
}

module.exports = RoomHandler;
