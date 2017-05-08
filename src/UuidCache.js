var mojang = require('mojang');
var moment = require('moment');
var log = require('./LogService');

class UuidCache {
    constructor() {
        this._uuidCache = {};
        this._nameCache = {};
    }

    lookupFromUuid(uuid) {
        uuid = uuid.replace(/-/g, '');

        var generate = true;
        if (this._uuidCache.hasOwnProperty(uuid)) {
            if (moment().isBefore(this._uuidCache[uuid].expires)) {
                generate = false;
            }
        }

        if (generate) {
            return new Promise((resolve, reject) => {
                mojang.profile(uuid).then(profile => {
                    if (profile.error) {
                        reject(new Error(profile.error + ": " + profile.errorMessage));
                        return;
                    }

                    this._uuidCache[uuid] = {
                        profile: new PlayerInfo(profile.id, profile.name),
                        expires: moment().add(4, 'hours')
                    };

                    this._nameCache[profile.name] = this._uuidCache[uuid];

                    resolve(this._uuidCache[uuid].profile);
                }, error => {
                    log.error("UuidCache", "Could not lookup profile for '" + uuid + "'");
                    log.error("UuidCache", error);
                    reject(error);
                });
            });
        } else {
            return new Promise((resolve, reject) => {
                var profile = this._uuidCache[uuid];
                if (profile)resolve(profile.profile);
                else reject(new Error("Profile not found: " + uuid));
            });
        }
    }

    lookupFromName(name) {
        var generate = true;
        if (this._nameCache.hasOwnProperty(name)) {
            if (moment().isBefore(this._nameCache[name].expires)) {
                generate = false;
            }
        }

        if (generate) {
            return new Promise((resolve, reject) => {
                mojang.username(name).then(profile => {
                    this._nameCache[name] = {
                        profile: new PlayerInfo(profile.id, profile.name),
                        expires: moment().add(4, 'hours')
                    };

                    this._uuidCache[profile.id] = this._nameCache[name];

                    resolve(this._nameCache[name].profile);
                }, err => reject(err));
            });
        } else {
            return new Promise((resolve, reject) => {
                var profile = this._nameCache[name];
                if (profile)resolve(profile.profile);
                else reject(new Error("Profile not found: " + name));
            });
        }
    }
}

class PlayerInfo {
    constructor(uuid, displayName) {
        this.uuid = uuid.replace(/-/g, '');
        this.uuidExpanded = this.uuid.substring(0, 7) + '-' + this.uuid.substring(8, 12) + '-' + this.uuid.substring(13, 17) + '-' + this.uuid.substring(18);
        this.displayName = displayName;
    }
}

var cache = new UuidCache();
module.exports = cache;
