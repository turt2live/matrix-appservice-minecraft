/**
 * Represents a profile service for Minecraft users
 */
class ProfileService {
    constructor(){
        this._profiles = {}; // { uuid: { displayName, expiration } }

        this._loadFromCache();

        setInterval(this._checkProfiles.bind(this), 10 * 60 * 60 * 1000); // every 10 minutes
        this._checkProfiles();
    }

    _checkProfiles() {
        var maxProfiles = 450; // API limit is 600/10min, so we should keep a few for us
    }
}

var service = new ProfileService();
module.exports = service;